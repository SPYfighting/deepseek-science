// dsh-science — 科研图件投稿前检内核
//
// 只检查可从文件与登记元数据观察到的属性；科学正确性、图像完整性和最终尺寸可读性
// 必须由研究者人工确认。这里的 "approved" 表示完成本插件前检，不代表期刊接收保证。

import { extname } from 'node:path'

export const JOURNAL_PROFILES = Object.freeze({
  generic: Object.freeze({
    id: 'generic',
    label: '通用科研图件',
    checkedAt: '2026-11-12',
    source: 'https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/',
    widthsMm: Object.freeze({ single: 89, double: 183 }),
    maxHeightMm: 170,
    fontPt: Object.freeze({ min: 5, max: 8 }),
    rasterDpi: 300,
  }),
  nature: Object.freeze({
    id: 'nature',
    label: 'Nature 研究论文图件',
    checkedAt: '2026-11-12',
    source: 'https://research-figure-guide.nature.com/figures/building-and-exporting-figure-panels/',
    widthsMm: Object.freeze({ single: 89, double: 183 }),
    maxHeightMm: 170,
    fontPt: Object.freeze({ min: 5, max: 7 }),
    rasterDpi: 300,
  }),
})

const FORMAT_KIND = Object.freeze({
  png: 'raster', jpg: 'raster', jpeg: 'raster', gif: 'raster', webp: 'raster', tiff: 'raster',
  svg: 'vector', pdf: 'vector',
})

function numberOrNull(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
function round(v, digits = 2) {
  if (!Number.isFinite(v)) return null
  const m = 10 ** digits
  return Math.round(v * m) / m
}
function decodeXmlText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const body = buf.subarray(2, buf.length - ((buf.length - 2) % 2))
    return Buffer.from(body).swap16().toString('utf16le')
  }
  if (buf[0] === 0x3c && buf[1] === 0x00) return buf.subarray(0, buf.length - (buf.length % 2)).toString('utf16le')
  if (buf[0] === 0x00 && buf[1] === 0x3c) return Buffer.from(buf.subarray(0, buf.length - (buf.length % 2))).swap16().toString('utf16le')
  return buf.toString('utf8')
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    i += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    if (i + 2 > buf.length) break
    const len = buf.readUInt16BE(i)
    if (len < 2 || i + len > buf.length) break
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: buf.readUInt16BE(i + 5), height: buf.readUInt16BE(i + 3) }
    }
    i += len
  }
  return null
}

function tiffSize(buf) {
  if (buf.length < 16) return null
  const le = buf.toString('latin1', 0, 2) === 'II'
  const be = buf.toString('latin1', 0, 2) === 'MM'
  if (!le && !be) return null
  const u16 = (off) => le ? buf.readUInt16LE(off) : buf.readUInt16BE(off)
  const u32 = (off) => le ? buf.readUInt32LE(off) : buf.readUInt32BE(off)
  const ifd = u32(4)
  if (ifd + 2 > buf.length) return null
  const count = u16(ifd)
  let width = null
  let height = null
  for (let n = 0; n < count; n++) {
    const off = ifd + 2 + n * 12
    if (off + 12 > buf.length) break
    const tag = u16(off)
    const type = u16(off + 2)
    const value = type === 3 ? u16(off + 8) : u32(off + 8)
    if (tag === 256) width = value
    if (tag === 257) height = value
  }
  return width && height ? { width, height } : null
}

function cssLengthToMm(raw) {
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(mm|cm|in|pt|px)?\s*$/i.exec(String(raw || ''))
  if (!m) return null
  const value = Number(m[1])
  const unit = (m[2] || 'px').toLowerCase()
  if (unit === 'mm') return value
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * 25.4
  if (unit === 'pt') return value * 25.4 / 72
  return null // px 没有可靠物理尺寸，留给目标宽度计算
}

function svgInfo(buf) {
  const text = decodeXmlText(buf)
  const root = /<svg\b([^>]*)>/i.exec(text)
  const attrs = root ? root[1] : ''
  const attr = (name) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attrs)
    return m ? m[1] : null
  }
  const view = String(attr('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const viewSize = view.length === 4 && view.every(Number.isFinite)
    ? { width: Math.abs(view[2]), height: Math.abs(view[3]) }
    : null
  const fontPt = []
  for (const m of text.matchAll(/font-size\s*(?:=|:)\s*["']?\s*([0-9]*\.?[0-9]+)\s*(px|pt)?/gi)) {
    const v = Number(m[1])
    if (Number.isFinite(v)) fontPt.push((m[2] || 'px').toLowerCase() === 'pt' ? v : v * 0.75)
  }
  const widthMm = cssLengthToMm(attr('width'))
  const heightMm = cssLengthToMm(attr('height'))
  return {
    text,
    viewSize,
    physicalSize: widthMm && heightMm ? { widthMm: round(widthMm), heightMm: round(heightMm) } : null,
    editableTextCount: (text.match(/<text\b/gi) || []).length,
    fontPt: fontPt.length ? { min: round(Math.min(...fontPt)), max: round(Math.max(...fontPt)) } : null,
  }
}
function pdfInfo(buf) {
  // 只读首段元数据；压缩对象中的字体与图层无法靠正则可靠判断，因此仍列为人工检查。
  const text = buf.subarray(0, Math.min(buf.length, 2 * 1024 * 1024)).toString('latin1')
  const m = /\/MediaBox\s*\[\s*[-0-9.]+\s+[-0-9.]+\s+([-0-9.]+)\s+([-0-9.]+)\s*\]/.exec(text)
  const widthPt = m ? Number(m[1]) : null
  const heightPt = m ? Number(m[2]) : null
  return {
    physicalSize: Number.isFinite(widthPt) && Number.isFinite(heightPt)
      ? { widthMm: round(widthPt * 25.4 / 72), heightMm: round(heightPt * 25.4 / 72) }
      : null,
    pageCountHint: (text.match(/\/Type\s*\/Page\b/g) || []).length || null,
  }
}

export function inspectFigureBuffer(filePath, buf) {
  const ext = extname(String(filePath || '')).slice(1).toLowerCase()
  const out = {
    ext,
    kind: FORMAT_KIND[ext] || 'unknown',
    bytes: buf.length,
    pixelSize: null,
    physicalSize: null,
    editableTextCount: null,
    fontPt: null,
  }
  try {
    if (ext === 'png' && buf.length >= 24) out.pixelSize = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    else if (ext === 'jpg' || ext === 'jpeg') out.pixelSize = jpegSize(buf)
    else if (ext === 'gif' && buf.length >= 10) out.pixelSize = { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    else if (ext === 'tiff') out.pixelSize = tiffSize(buf)
    else if (ext === 'svg') Object.assign(out, svgInfo(buf))
    else if (ext === 'pdf') Object.assign(out, pdfInfo(buf))
  } catch {
    // 文件已通过外层格式闸门时，解析失败只意味着该测量不可用，不伪造数值。
  }
  return out
}

function check(id, label, status, observed, requirement, action = '') {
  return { id, label, status, observed, requirement, action }
}

export function auditFigureRecord(record, inspected, options = {}) {
  const plan = record && record.plan && typeof record.plan === 'object' ? record.plan : {}
  const profile = JOURNAL_PROFILES[plan.targetJournal] || JOURNAL_PROFILES.generic
  const pathExists = typeof options.pathExists === 'function' ? options.pathExists : () => true
  const targetWidthMm = numberOrNull(plan.targetWidthMm)
  const targetHeightMm = targetWidthMm && inspected.pixelSize
    ? targetWidthMm * inspected.pixelSize.height / inspected.pixelSize.width
    : inspected.physicalSize && inspected.physicalSize.heightMm
  const effectiveDpi = inspected.kind === 'raster' && inspected.pixelSize && targetWidthMm
    ? inspected.pixelSize.width / (targetWidthMm / 25.4)
    : null
  const checks = []
  checks.push(check(
    'file-format', '投稿文件格式', FORMAT_KIND[inspected.ext] ? 'pass' : 'fail',
    inspected.ext || '未知', 'PNG/JPEG/TIFF 等位图或 SVG/PDF 矢量图', '导出受支持格式后重新登记。',
  ))
  const sizeTooLarge = !!targetWidthMm && (
    targetWidthMm > profile.widthsMm.double || (targetHeightMm != null && targetHeightMm > profile.maxHeightMm)
  )
  checks.push(check(
    'target-size', '最终物理尺寸', !targetWidthMm ? 'warn' : sizeTooLarge ? 'fail' : 'pass',
    targetWidthMm ? `${round(targetWidthMm)} × ${round(targetHeightMm)} mm` : '未声明目标宽度',
    `${profile.label}：宽度不超过 ${profile.widthsMm.double} mm，高度不超过 ${profile.maxHeightMm} mm`,
    sizeTooLarge ? '缩小画布或重排面板，并按新的最终宽度重新审计。' : '在 sci_figure_plan 中设置 target_width_mm。',
  ))
  if (inspected.kind === 'raster') {
    checks.push(check(
      'effective-dpi', '最终尺寸有效分辨率', effectiveDpi == null ? 'warn' : effectiveDpi >= profile.rasterDpi ? 'pass' : 'fail',
      effectiveDpi == null ? '无法计算' : `${round(effectiveDpi, 1)} dpi`,
      `至少 ${profile.rasterDpi} dpi`, '从原始数据重新导出更高像素图；不要只修改 dpi 元数据。',
    ))
  } else {
    checks.push(check(
      'effective-dpi', '矢量保留', inspected.kind === 'vector' ? 'pass' : 'warn',
      inspected.kind === 'vector' ? '矢量容器' : '无法判断', '线条与文字优先保持矢量', '改用 SVG/PDF 导出并人工检查。',
    ))
  }
  const codeOk = !!record.codePath && pathExists(record.codePath)
  checks.push(check(
    'code-source', '生成代码', codeOk ? 'pass' : 'warn',
    codeOk ? record.codePath : '缺少或路径不存在', '保留可复现绘图代码', '登记 code_path 并确认文件存在。',
  ))
  const sourcePaths = Array.isArray(record.sourceDataPaths) ? record.sourceDataPaths.filter(Boolean) : []
  const missingSources = sourcePaths.filter((p) => !pathExists(p))
  checks.push(check(
    'source-data', '源数据溯源', sourcePaths.length > 0 && missingSources.length === 0 ? 'pass' : 'warn',
    sourcePaths.length === 0 ? '未登记' : missingSources.length ? `缺失 ${missingSources.length}/${sourcePaths.length}` : `${sourcePaths.length} 个文件`,
    '图中数值可追溯到源数据', '在图件计划中登记 source_data_paths，并修复失效路径。',
  ))
  const statsNeeded = plan.requiresStatistics === true
  const statsOk = !statsNeeded || !!String(plan.statisticsNote || '').trim()
  checks.push(check(
    'statistics-note', '统计与重复说明', statsOk ? 'pass' : 'warn',
    statsNeeded ? (plan.statisticsNote || '缺少') : '该图声明不需要统计说明',
    statsNeeded ? '定义 n、误差线、检验与多重比较' : '按图件类型决定', '补充 statistics_note。',
  ))
  const templateSource = String(plan.templateSource || '').trim()
  const templateLicense = String(plan.templateLicense || '').trim()
  checks.push(check(
    'template-license', '模板与素材许可', !templateSource || templateLicense ? 'pass' : 'warn',
    !templateSource ? '未使用外部模板' : templateLicense || '使用了模板但未登记许可',
    '保存来源、精确版本与许可', '补充 template_license；逐项核对素材授权。',
  ))
  if (inspected.ext === 'svg' && inspected.fontPt) {
    const fontOk = inspected.fontPt.min >= profile.fontPt.min && inspected.fontPt.max <= profile.fontPt.max
    checks.push(check(
      'font-size', '矢量文字字号', fontOk ? 'pass' : 'fail',
      `${inspected.fontPt.min}–${inspected.fontPt.max} pt`,
      `${profile.fontPt.min}–${profile.fontPt.max} pt（最终尺寸）`, '调整字号并按最终宽度重新导出。',
    ))
  } else {
    checks.push(check(
      'font-size', '最终尺寸文字可读性', 'manual', '自动检查不足',
      `${profile.fontPt.min}–${profile.fontPt.max} pt，且文字保持可编辑`, '按最终物理尺寸打开 PDF/SVG 或打印检查。',
    ))
  }
  checks.push(check('panel-layout', '面板布局与裁切', 'manual', '待人工查看', '标签顺序、对齐、留白、无重叠或裁切', '逐面板审阅最终导出文件。'))
  checks.push(check('scientific-integrity', '科学与图像完整性', 'manual', '待研究者确认', '数据、标尺、颜色映射与统计表达真实准确', '对照源数据、分析代码和图注逐项确认。'))

  const summary = { pass: 0, warn: 0, fail: 0, manual: 0 }
  for (const c of checks) summary[c.status] = (summary[c.status] || 0) + 1
  const automaticStatus = summary.fail > 0 ? 'failed' : summary.warn > 0 ? 'needs-attention' : 'ready-for-manual-review'
  const manualReview = record.manualReview && typeof record.manualReview === 'object'
    ? { ...record.manualReview }
    : { decision: 'pending', note: '', reviewedAt: null }
  let overallStatus = automaticStatus
  if (manualReview.decision === 'rejected') overallStatus = 'rejected'
  else if (manualReview.decision === 'approved' && automaticStatus === 'ready-for-manual-review') overallStatus = 'approved'
  return {
    checkedAt: Date.now(),
    profile: { id: profile.id, label: profile.label, checkedAt: profile.checkedAt, source: profile.source },
    measurements: {
      format: inspected.ext,
      kind: inspected.kind,
      pixelSize: inspected.pixelSize,
      physicalSize: inspected.physicalSize,
      targetWidthMm: round(targetWidthMm),
      targetHeightMm: round(targetHeightMm),
      effectiveDpi: round(effectiveDpi, 1),
      fontPt: inspected.fontPt,
      editableTextCount: inspected.editableTextCount,
    },
    checks,
    summary,
    automaticStatus,
    manualReview,
    overallStatus,
    disclaimer: '自动前检只覆盖可观察属性；科学正确性、图像完整性和期刊接收仍需研究者与目标期刊确认。',
  }
}
// 本模块只生成投稿前检结论；期刊接收仍由研究者与编辑流程判定。
