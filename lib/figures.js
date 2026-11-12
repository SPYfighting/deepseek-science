// dsh-science — 绘图登记模块（P3-3）
// 模型生成图后调用 sci_figure_register 登记；工作台图库与审查器都从这里取数据。
// v0.6.0：登记时可带 result_id，把图表直接挂为文章蓝图 result 的图表证据
// （对齐逻辑在 lib/blueprint.js linkFigureToResult，失败不阻断登记）。
// v0.9.0（Track 3，对齐 aipoch artifacts 不可变版本 + Claude Science 版本 stepper，机制原创）：
// 版本链——同一 path（或同一标题）再次登记且内容变化（sha 不同）→ 新档案记
// prevId/prevSha/version（对比入口在客户端图表卡）；内容完全相同 → 幂等返回旧档案不新建。
// v0.10.0（B1，v0.7 遗留①）：图片格式校验——扩展名白名单 + 文件头 magic bytes 双重校验，
// 任意文件（如 .txt）不再能冒充图表混进图库。

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { dataDirOf } from './store.js'
import { linkFigureToResult } from './blueprint.js'
import { inspectFigureBuffer, auditFigureRecord, JOURNAL_PROFILES } from './figureqa.js'

// B1：图片扩展名白名单与 magic bytes 校验。错误信息统一以「文件不是有效图片」开头。
const IMAGE_EXT_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'tiff', 'pdf'])
const IMAGE_EXT_HINT = 'png/jpg/jpeg/svg/gif/webp/tiff/pdf'

function charOf(cp) {
  return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
}

// 扫描前先解码字符引用，防 &#106;avascript: / java&Tab;script&colon; 一类混淆绕过；
// 数字引用允许省略分号（HTML 解析器同样接受），否则 &#106avascript: 会漏检。
function decodeCharRefs(s) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => charOf(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => charOf(Number(d)))
    .replace(/&Tab;/gi, '\t')
    .replace(/&NewLine;/gi, '\n')
    .replace(/&colon;/gi, ':')
}

// 去掉成对 XML 注释：注释里的 <script> 不执行，不构成风险（未闭合注释保留 → fail-closed）。
function stripXmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

// 单遍标签扫描：返回每个标签的原文与位置。属性值里的 ">" 不会截断标签；
// 遇到没有闭合 ">" 的 "<" 直接结束（其后不可能再有完整标签），避免 /<...>*>/ 的回溯爆炸。
function scanTags(text) {
  const tags = []
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) break
    let j = lt + 1
    let quote = null
    for (; j < text.length; j++) {
      const ch = text[j]
      if (quote) {
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'") quote = ch
      else if (ch === '>') break
    }
    if (j >= text.length) break
    tags.push({ start: lt, end: j + 1, raw: text.slice(lt, j + 1) })
    i = j + 1
  }
  return tags
}

function tagNameOf(raw) {
  let i = 1
  if (raw[i] === '/') i++
  while (i < raw.length && /\s/.test(raw[i])) i++
  let name = ''
  while (i < raw.length && !/[\s/>]/.test(raw[i])) {
    name += raw[i]
    i++
  }
  return name.toLowerCase()
}

// 引号感知的属性解析：`<svg a="b"onload=…>` 能被识别出 onload；
// `title="onload=x"`（值里出现 on* 文本）不会被误判。
function attrsOf(raw) {
  const attrs = []
  let i = 1
  if (raw[i] === '/') i++
  while (i < raw.length && !/[\s/>]/.test(raw[i])) i++
  while (i < raw.length) {
    while (i < raw.length && /\s/.test(raw[i])) i++
    if (i >= raw.length || raw[i] === '>') break
    if (raw[i] === '/') {
      i++
      continue
    }
    let name = ''
    while (i < raw.length && !/[\s=/>]/.test(raw[i])) {
      name += raw[i]
      i++
    }
    if (!name) {
      i++
      continue
    }
    while (i < raw.length && /\s/.test(raw[i])) i++
    let value = ''
    if (raw[i] === '=') {
      i++
      while (i < raw.length && /\s/.test(raw[i])) i++
      const q = raw[i]
      if (q === '"' || q === "'") {
        i++
        while (i < raw.length && raw[i] !== q) {
          value += raw[i]
          i++
        }
        i++
      } else {
        while (i < raw.length && !/[\s>]/.test(raw[i])) {
          value += raw[i]
          i++
        }
      }
    }
    attrs.push({ name, value })
  }
  return attrs
}

const EXEC_URL_RE = /javascript:|vbscript:|data:text\/html|data:image\/svg\+xml/
const CSS_EXEC_RE = /(?:javascript|vbscript):|expression\(/

// CSS 十六进制转义（\6a avascript: → javascript:）先还原再检测，防拆词绕过。
function decodeCssEscapes(s) {
  return String(s).replace(/\\([0-9a-f]{1,6})[ \t\r\n\f]?/gi, (_, h) => {
    const cp = parseInt(h, 16)
    return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
  })
}

// SVG 解码（UTF-16LE/BE：先看 BOM，再看首字节 3C 00 / 00 3C 的无 BOM 形态；
// 奇数尾字节先截齐，避免 swap16 抛错）。其余按 UTF-8。
export function decodeSvgText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le')
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const body = buf.subarray(2)
    return Buffer.from(body.subarray(0, body.length - (body.length % 2))).swap16().toString('utf16le')
  }
  if (buf[0] === 0x3c && buf[1] === 0x00) {
    const body = buf.subarray(0, buf.length - (buf.length % 2))
    return body.toString('utf16le')
  }
  if (buf[0] === 0x00 && buf[1] === 0x3c) {
    const body = buf.subarray(0, buf.length - (buf.length % 2))
    return Buffer.from(body).swap16().toString('utf16le')
  }
  return buf.toString('utf8')
}

// SVG 可执行内容检测（安全）：图库与 /file 路由以 image/svg+xml 原样提供 SVG，浏览器直接
// 打开时脚本会执行——登记闸门拒绝 script 标签/事件属性/可执行 URL/内嵌 ENTITY 声明。
// 返回拒绝原因字符串；纯静态 SVG 返回 null。
export function svgActiveContentReason(svgText) {
  const text = stripXmlComments(decodeCharRefs(String(svgText)))
  // 命名空间前缀（<svg:script>/<x:script>）同样可执行，需一并拦截
  if (/<\s*(?:[\w.-]+:)?script\b/i.test(text)) return '<script> 标签'
  if (/<\?xml-stylesheet\b/i.test(text)) return 'xml-stylesheet 处理指令（XSLT 可输出脚本化 HTML）'
  // HTML 嵌入标签会创建可执行上下文（iframe srcdoc 会把 &lt;script&gt; 解码成脚本），静态图不需要
  if (/<\s*(?:[\w.-]+:)?(foreignObject|iframe|embed|object)\b/i.test(text)) return 'HTML 嵌入标签（foreignObject/iframe/embed/object）'
  if (/<!ENTITY/i.test(text)) return 'DOCTYPE 内嵌 XML 实体声明'
  const tags = scanTags(text)
  for (const t of tags) {
    if (tagNameOf(t.raw) === 'style') continue
    for (const a of attrsOf(t.raw)) {
      if (/^(?:[A-Za-z_][\w.-]*:)?on[a-z]+$/i.test(a.name)) return `事件属性 ${a.name}`
      // 去掉属性值内全部空白/控制字符再查 URL scheme，堵 java&Tab;script 拆词混淆
      const compact = a.value.replace(/[\s\x00-\x20]+/g, '').toLowerCase()
      if (EXEC_URL_RE.test(compact)) return '可执行 URL（javascript:/vbscript:/data:text/html/data:image/svg+xml）'
      if (a.name.toLowerCase() === 'style' && CSS_EXEC_RE.test(decodeCssEscapes(a.value).replace(/[\s\x00-\x20]+/g, '').toLowerCase())) return '样式表内可执行 URL（style）'
    }
  }
  // <style> 块内容同样可执行（CSS url(javascript:)/expression()）——按标签位置配对内容，避免全文重复扫描
  for (let k = 0; k < tags.length; k++) {
    if (tagNameOf(tags[k].raw) !== 'style' || tags[k].raw.startsWith('</')) continue
    for (let m = k + 1; m < tags.length; m++) {
      if (tagNameOf(tags[m].raw) === 'style' && tags[m].raw.startsWith('</')) {
        const body = text.slice(tags[k].end, tags[m].start)
        if (CSS_EXEC_RE.test(decodeCssEscapes(body).replace(/[\s\x00-\x20]+/g, '').toLowerCase())) return '样式表内可执行 URL（style）'
        k = m
        break
      }
    }
  }
  return null
}

export function validateImageFile(filePath, buf) {
  const ext = (String(filePath).split('.').pop() || '').toLowerCase()
  if (!IMAGE_EXT_WHITELIST.has(ext)) {
    return { ok: false, error: `文件不是有效图片：扩展名 .${ext || '(无)'} 不在白名单（允许 ${IMAGE_EXT_HINT}）` }
  }
  const head = buf.subarray(0, 12)
  const ascii = (start, len) => head.subarray(start, start + len).toString('latin1')
  let magicOk = false
  switch (ext) {
    case 'png':
      magicOk = head[0] === 0x89 && ascii(1, 3) === 'PNG'
      break
    case 'jpg':
    case 'jpeg':
      magicOk = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
      break
    case 'gif':
      magicOk = ascii(0, 4) === 'GIF8'
      break
    case 'webp':
      magicOk = ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
      break
    case 'tiff':
      magicOk =
        (ascii(0, 2) === 'II' && head[2] === 0x2a && head[3] === 0x00) ||
        (ascii(0, 2) === 'MM' && head[2] === 0x00 && head[3] === 0x2a)
      break
    case 'svg': {
      // SVG 是文本格式：头部（含 BOM/注释/doctype 的容差窗口）内应出现 '<svg' 根标签。
      // UTF-16（LE/BE BOM）先解码成 UTF-8 字符串再校验，否则交错的 \0 会让 magic 误判。
      const svgText = decodeSvgText(buf)
      magicOk = svgText.slice(0, 2048).includes('<svg')
      if (magicOk) {
        const reason = svgActiveContentReason(svgText)
        if (reason) {
          return { ok: false, error: `SVG 含可执行内容（${reason}），拒绝登记——请移除脚本/事件属性/可执行 URL，重新导出纯静态 SVG` }
        }
      }
      break
    }
    case 'pdf':
      magicOk = ascii(0, 5) === '%PDF-'
      break
    default:
      magicOk = false
  }
  if (!magicOk) {
    return { ok: false, error: `文件不是有效图片：文件头与 .${ext} 格式不符（扩展名 ${IMAGE_EXT_HINT} 需匹配对应 magic bytes）` }
  }
  return { ok: true, ext }
}

// 路径归一化（版本链同图判断用：Windows 大小写不敏感 + 统一分隔符）
function normPath(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase()
}

function log(msg) {
  console.log(`[dsh-science figures] ${msg}`)
}

const figuresFile = () => join(dataDirOf(), 'figures.json')
const figurePlansFile = () => join(dataDirOf(), 'figure-plans.json')

// 图表档案损坏隔离（X3，对齐 blueprint fix4）：解析失败或结构非法（应为键值对象，数组/标量
// 均不行）→ 坏文件改名备份为 figures.json.corrupt-<ts>（quarantine，备份保留）+ console.error
// 报警，返回空档案。文件不存在（首跑常态）不算损坏。
function quarantineFigures(reason) {
  const backupName = `figures.json.corrupt-${Date.now()}`
  try {
    renameSync(figuresFile(), join(dataDirOf(), backupName))
    console.error(`[dsh-science figures] figures.json ${reason}，已隔离备份为 ${backupName}`)
  } catch (berr) {
    console.error(`[dsh-science figures] figures.json ${reason}且隔离备份失败（${berr && berr.message}）`)
  }
}

function loadFigures() {
  let raw = null
  try {
    raw = readFileSync(figuresFile(), 'utf8')
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.error(`[dsh-science figures] figures.json read failed (treated as empty): ${err && err.message}`)
    }
    return {}
  }
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    quarantineFigures(`解析失败（${err && err.message}）`)
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    quarantineFigures('结构非法（应为键值对象）')
    return {}
  }
  return parsed
}

function saveFigures(figures) {
  // X3：原子写（先写 .tmp 再 renameSync 覆盖；rename 失败退回直接写，避免登记丢失）
  const text = JSON.stringify(figures, null, 2)
  const tmp = `${figuresFile()}.tmp`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, figuresFile())
  } catch (err) {
    log(`atomic persist fallback: ${err && err.message}`)
    writeFileSync(figuresFile(), text, 'utf8')
  }
}

function loadFigurePlans() {
  let raw = null
  try {
    raw = readFileSync(figurePlansFile(), 'utf8')
  } catch (err) {
    if (err && err.code !== 'ENOENT') console.error(`[dsh-science figures] figure-plans.json 读取失败（按空计划继续）: ${err && err.message}`)
    return {}
  }
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    quarantineFigurePlans(`解析失败（${err && err.message}）`)
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    quarantineFigurePlans('结构非法（应为键值对象）')
    return {}
  }
  return parsed
}

function quarantineFigurePlans(reason) {
  const backupName = `figure-plans.json.corrupt-${Date.now()}`
  try {
    renameSync(figurePlansFile(), join(dataDirOf(), backupName))
    console.error(`[dsh-science figures] figure-plans.json ${reason}，已隔离备份为 ${backupName}`)
  } catch (err) {
    console.error(`[dsh-science figures] figure-plans.json ${reason}且隔离备份失败（${err && err.message}）`)
  }
}

function saveFigurePlans(plans) {
  const text = JSON.stringify(plans, null, 2)
  const tmp = `${figurePlansFile()}.tmp`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, figurePlansFile())
  } catch (err) {
    log(`figure plan atomic persist fallback: ${err && err.message}`)
    writeFileSync(figurePlansFile(), text, 'utf8')
  }
}

function textList(v, max = 40) {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim().slice(0, 2000)) : []
}

function targetProfileOf(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'nature' || value.includes('nature')) return 'nature'
  return 'generic'
}

function planFromArgs(args) {
  const targetJournal = targetProfileOf(args.target_journal)
  const profile = JOURNAL_PROFILES[targetJournal]
  const targetWidth = Number(args.target_width_mm)
  return {
    title: String(args.figure_title || '').trim().slice(0, 300),
    resultId: args.result_id ? String(args.result_id).trim().slice(0, 100) : null,
    claim: String(args.figure_claim || '').trim().slice(0, 4000),
    figureRole: String(args.figure_role || 'main').trim().slice(0, 80),
    targetJournal,
    targetJournalName: String(args.target_journal || profile.label).trim().slice(0, 200),
    submissionStage: String(args.submission_stage || 'final').trim().slice(0, 40),
    targetWidthMm: Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : profile.widthsMm.single,
    requiresStatistics: args.requires_statistics === true,
    statisticsNote: String(args.statistics_note || '').trim().slice(0, 4000),
    sourceDataPaths: textList(args.source_data_paths),
    templateSource: String(args.template_source || '').trim().slice(0, 2000),
    templateVersion: String(args.template_version || '').trim().slice(0, 300),
    templateLicense: String(args.template_license || '').trim().slice(0, 300),
  }
}

export function registerFigureTools(ctx, opts = {}) {
  ctx.tools.register({
    name: 'sci_figure_plan',
    description:
      '在绘图前建立期刊图件计划：声明所属 result、该图要表达的主张、目标期刊/最终宽度、统计说明、源数据路径和模板许可。返回 planId；随后 sci_figure_register 传 plan_id 绑定。当前内置 nature 与 generic 前检配置，其他期刊按 generic 执行并保留原名称。',
    parameters: {
      figure_title: { type: 'string', required: true, description: '图件标题' },
      result_id: { type: 'string', description: '所属文章 result（res-N）' },
      figure_claim: { type: 'string', description: '这张图支持的一句话主张' },
      figure_role: { type: 'string', description: 'main / extended-data / supplementary / graphical-abstract' },
      target_journal: { type: 'string', description: 'nature 或目标期刊名称；未内置者使用 generic 前检' },
      submission_stage: { type: 'string', description: 'initial / revision / final' },
      target_width_mm: { type: 'number', description: '最终版面宽度（mm）；缺省按目标配置单栏宽' },
      requires_statistics: { type: 'boolean', description: '图中是否包含需说明的统计结果' },
      statistics_note: { type: 'string', description: 'n、误差线、检验、多重比较等说明' },
      source_data_paths: { type: 'array', description: '图中数据的源文件路径列表' },
      template_source: { type: 'string', description: '模板/素材来源（如 SFL exact selector 或仓库 URL）' },
      template_version: { type: 'string', description: '模板精确版本、commit 或哈希' },
      template_license: { type: 'string', description: '模板/素材许可证' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const plan = planFromArgs(args || {})
      if (!plan.title) throw new Error('figure_title 为必填项——先说明这张图要表达什么。')
      if (plan.requiresStatistics && !plan.statisticsNote) {
        throw new Error('requires_statistics=true 时必须提供 statistics_note（n、误差线、检验与多重比较）。')
      }
      const plans = loadFigurePlans()
      const id = `figplan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      plans[id] = { id, ...plan, status: 'planned', figureId: null, createdAt: Date.now(), updatedAt: Date.now() }
      saveFigurePlans(plans)
      if (opts.mirror) opts.mirror('figure-plans.json', JSON.stringify(plans, null, 2), exec)
      return {
        ok: true,
        planId: id,
        plan: plans[id],
        profile: JOURNAL_PROFILES[plan.targetJournal],
        next: `完成绘图后调用 sci_figure_register plan_id=${id}，再调用 sci_figure_audit。`,
      }
    },
  })

  ctx.tools.register({
    name: 'sci_figure_register',
    description:
      '登记一张已生成的科研图件（绘图后必须调用）。推荐先用 sci_figure_plan 获得 plan_id；登记支持 PNG/JPEG/SVG/GIF/WebP/TIFF/PDF，校验扩展名与文件头；SVG 必须纯静态。登记只是形成档案，不等于通过投稿前检，随后必须调用 sci_figure_audit。',
    parameters: {
      path: { type: 'string', required: true },
      figure_title: { type: 'string', description: '图表标题' },
      code_path: { type: 'string', description: '生成该图的代码文件路径' },
      dpi: { type: 'number' },
      figure_note: { type: 'string', description: '备注' },
      result_id: { type: 'string', description: '文章蓝图 result id（res-N）；提供时图表自动挂为该 result 的证据' },
      plan_id: { type: 'string', description: 'sci_figure_plan 返回的计划 id' },
      source_data_paths: { type: 'array', description: '兼容无计划登记时补充源数据路径' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      if (!existsSync(args.path)) throw new Error(`图片文件不存在: ${args.path}`)
      const stat = statSync(args.path)
      const buf = readFileSync(args.path)
      // B1（v0.10.0）：登记前校验图片格式（扩展名白名单 + magic bytes），不符即拒绝
      const imgCheck = validateImageFile(args.path, buf)
      if (!imgCheck.ok) throw new Error(imgCheck.error)
      const figures = loadFigures()
      const plans = loadFigurePlans()
      const planId = args.plan_id ? String(args.plan_id).trim() : null
      const planRecord = planId ? plans[planId] : null
      if (planId && !planRecord) throw new Error(`图件计划不存在: ${planId}。先调用 sci_figure_plan，或去掉 plan_id 作为遗留图件登记。`)
      const planSnapshot = planRecord ? {
        targetJournal: planRecord.targetJournal,
        targetJournalName: planRecord.targetJournalName,
        submissionStage: planRecord.submissionStage,
        targetWidthMm: planRecord.targetWidthMm,
        figureRole: planRecord.figureRole,
        claim: planRecord.claim,
        requiresStatistics: planRecord.requiresStatistics,
        statisticsNote: planRecord.statisticsNote,
        templateSource: planRecord.templateSource,
        templateVersion: planRecord.templateVersion,
        templateLicense: planRecord.templateLicense,
      } : null
      const sourceDataPaths = planRecord ? textList(planRecord.sourceDataPaths) : textList(args.source_data_paths)
      const id = `fig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12)
      const title = args.figure_title || args.path.split(/[\\/]/).pop()
      // 版本链（v0.9.0）：同 path 优先、同标题兜底，取最近登记的一条作前驱
      const all = Object.values(figures)
      const byPath = all.filter((f) => f && normPath(f.path) === normPath(args.path)).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0))
      const byTitle = args.figure_title ? all.filter((f) => f && f.title === title).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0)) : []
      const prior = byPath[0] || byTitle[0] || null
      if (prior && prior.sha256_12 === sha) {
        // 内容未变时不刷版本；但允许补绑定图件计划、代码/源数据和 Result。
        // 这些元数据决定前检口径，一旦改变就清除旧审计与人工结论，强制重新审计。
        const nextCodePath = args.code_path || prior.codePath
        const nextSources = planRecord || args.source_data_paths ? sourceDataPaths : (prior.sourceDataPaths || [])
        const nextResultId = args.result_id ? String(args.result_id) : prior.resultId
        const previousPlanId = prior.planId || null
        const auditBasisChanged = (planRecord && prior.planId !== planId) ||
          (args.code_path && args.code_path !== prior.codePath) ||
          ((planRecord || args.source_data_paths) && JSON.stringify(nextSources) !== JSON.stringify(prior.sourceDataPaths || []))
        const metadataChanged = auditBasisChanged || (args.result_id && nextResultId !== prior.resultId)
        if (metadataChanged) {
          prior.planId = planRecord ? planId : prior.planId
          prior.plan = planRecord ? planSnapshot : prior.plan
          prior.codePath = nextCodePath
          prior.sourceDataPaths = nextSources
          prior.resultId = nextResultId || null
          if (auditBasisChanged) {
            delete prior.audit
            delete prior.manualReview
          }
          prior.updatedAt = Date.now()
          figures[prior.id] = prior
          saveFigures(figures)
          if (opts.mirror) opts.mirror('figures.json', JSON.stringify(figures, null, 2), exec)
          if (planRecord) {
            if (previousPlanId && previousPlanId !== planId && plans[previousPlanId]) {
              plans[previousPlanId] = {
                ...plans[previousPlanId], status: 'superseded', supersededBy: planId, updatedAt: Date.now(),
              }
            }
            plans[planId] = { ...planRecord, status: 'registered', figureId: prior.id, updatedAt: Date.now() }
            saveFigurePlans(plans)
            if (opts.mirror) opts.mirror('figure-plans.json', JSON.stringify(plans, null, 2), exec)
          }
        }
        let blueprintLink = null
        if (args.result_id) {
          try {
            blueprintLink = linkFigureToResult(prior.id, args.result_id, { exec, mirror: opts.mirror })
          } catch (err) {
            blueprintLink = { error: String(err && err.message) }
          }
        }
        log(`figure unchanged (sha match): ${prior.id} v${prior.version || 1}`)
        return {
          ok: true,
          figureId: prior.id,
          unchanged: true,
          metadataUpdated: metadataChanged,
          version: prior.version || 1,
          sha256_12: sha,
          planId: prior.planId || null,
          resultId: prior.resultId || null,
          blueprintLink,
          note: auditBasisChanged
            ? '文件内容未变，未新建版本；计划/溯源元数据已更新，旧前检结论已清除，请重新运行 sci_figure_audit。'
            : metadataChanged
              ? '文件内容未变，未新建版本；Result 关联已更新。'
              : '图片内容与已登记版本完全相同（sha 一致），未新建版本。',
        }
      }
      const version = prior ? (prior.version || 1) + 1 : 1
      figures[id] = {
        id,
        path: args.path,
        title,
        codePath: args.code_path,
        sourceDataPaths,
        dpi: args.dpi,
        note: args.figure_note,
        planId,
        plan: planSnapshot,
        bytes: stat.size,
        sha256_12: sha,
        // 版本链（v0.9.0）：prevId/prevSha 指向同 path/标题的上一登记版本，version 从 1 起递增
        version,
        prevId: prior ? prior.id : null,
        prevSha: prior ? prior.sha256_12 : null,
        // 双向对齐回写（v0.6.0 fix5）：result.figures 含 fig-* 之外，figure 对象也记录 resultId
        //（产物 tab 图表卡据此显示 res-N 徽章；挂接失败不回滚此标记，错误经 blueprintLink 回报）
        resultId: args.result_id ? String(args.result_id) : (prior && prior.resultId) || null,
        registeredAt: Date.now(),
      }
      saveFigures(figures)
      if (opts.mirror) opts.mirror('figures.json', JSON.stringify(figures, null, 2), exec)
      if (planRecord) {
        plans[planId] = { ...planRecord, status: 'registered', figureId: id, updatedAt: Date.now() }
        saveFigurePlans(plans)
        if (opts.mirror) opts.mirror('figure-plans.json', JSON.stringify(plans, null, 2), exec)
      }
      // 文章蓝图挂接（v0.6.0）：带 result_id 时挂为该 result 的图表证据（失败不阻断登记）
      let blueprintLink = null
      if (args.result_id) {
        try {
          blueprintLink = linkFigureToResult(id, args.result_id, { exec, mirror: opts.mirror })
        } catch (err) {
          log(`blueprint link failed for ${id} → ${args.result_id}: ${err && err.message}`)
          blueprintLink = { error: String(err && err.message) }
        }
      }
      const out = { ok: true, figureId: id, bytes: stat.size, sha256_12: sha, version, resultId: figures[id].resultId, planId }
      if (prior) {
        out.prevId = prior.id
        out.prevSha = prior.sha256_12 || null
        out.versionNote = `同图新版（v${version}）：上一版本 ${prior.id}（sha ${prior.sha256_12}），工作台图表卡可对比。`
      }
      if (blueprintLink) out.blueprintLink = blueprintLink
      return out
    },
  })

  ctx.tools.register({
    name: 'sci_figure_audit',
    description:
      '对已登记图件执行投稿前检：最终尺寸有效 dpi、格式、代码与源数据、统计说明、模板许可，并列出必须人工检查的字号/拼版/科学完整性。自动状态 ready-for-manual-review 后，只有研究者按最终尺寸实际查看并明确同意，才可传 manual_decision=approved 与 review_note；该批准不代表期刊接收保证。',
    parameters: {
      figure_id: { type: 'string', required: true },
      manual_decision: { type: 'string', description: '可选：approved / rejected / pending；仅记录真实人工审阅结论' },
      review_note: { type: 'string', description: '人工审阅依据；approved/rejected 时必填' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const figures = loadFigures()
      const id = String(args.figure_id || '').trim()
      const record = figures[id]
      if (!record) throw new Error(`图件不存在: ${id || '(空)'}。先用 sci_figure_list 查看。`)
      if (!record.path || !existsSync(record.path)) throw new Error(`图件文件不存在: ${record.path || '(未登记路径)'}`)
      const buf = readFileSync(record.path)
      const currentSha = createHash('sha256').update(buf).digest('hex').slice(0, 12)
      if ((record.sha256_12 && currentSha !== record.sha256_12) || (Number.isFinite(record.bytes) && buf.length !== record.bytes)) {
        throw new Error(`图件文件在登记后已改变（登记 sha ${record.sha256_12 || '?'}，当前 sha ${currentSha}）。先重新调用 sci_figure_register 生成新版本，再审计；旧版本结论不能沿用。`)
      }
      const valid = validateImageFile(record.path, buf)
      if (!valid.ok) throw new Error(valid.error)
      const inspected = inspectFigureBuffer(record.path, buf)
      let audit = auditFigureRecord(record, inspected, { pathExists: existsSync })
      const decision = args.manual_decision ? String(args.manual_decision).trim().toLowerCase() : ''
      if (decision) {
        if (!['approved', 'rejected', 'pending'].includes(decision)) throw new Error('manual_decision 仅允许 approved / rejected / pending。')
        const note = String(args.review_note || '').trim()
        if ((decision === 'approved' || decision === 'rejected') && note.length < 10) {
          throw new Error('人工批准/拒绝必须提供至少 10 个字符的 review_note，记录最终尺寸与主要检查依据。')
        }
        if (decision === 'approved' && audit.automaticStatus !== 'ready-for-manual-review') {
          throw new Error(`自动前检状态为 ${audit.automaticStatus}，不能批准。先处理 fail/warn 并重新审计。`)
        }
        record.manualReview = { decision, note, reviewedAt: Date.now() }
        audit = auditFigureRecord(record, inspected, { pathExists: existsSync })
      }
      record.audit = audit
      record.updatedAt = Date.now()
      figures[id] = record
      saveFigures(figures)
      if (opts.mirror) opts.mirror('figures.json', JSON.stringify(figures, null, 2), exec)
      const plans = loadFigurePlans()
      if (record.planId && plans[record.planId]) {
        plans[record.planId] = { ...plans[record.planId], status: audit.overallStatus, updatedAt: Date.now() }
        saveFigurePlans(plans)
        if (opts.mirror) opts.mirror('figure-plans.json', JSON.stringify(plans, null, 2), exec)
      }
      return { ok: true, figureId: id, audit }
    },
  })

  ctx.tools.register({
    name: 'sci_figure_list',
    description: '列出已登记的科研图表（最新的在前）。参数：limit?（默认 20）。',
    parameters: { limit: { type: 'number' } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const figures = Object.values(loadFigures()).sort((a, b) => b.registeredAt - a.registeredAt)
      return {
        figures: figures.slice(0, Math.min(args.limit || 20, 100)),
        total: figures.length,
      }
    },
  })

  log('figure tools registered (sci_figure_plan / sci_figure_register / sci_figure_audit / sci_figure_list)')
}
