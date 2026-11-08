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

// B1：图片扩展名白名单与 magic bytes 校验。错误信息统一以「文件不是有效图片」开头。
const IMAGE_EXT_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'tiff'])
const IMAGE_EXT_HINT = 'png/jpg/jpeg/svg/gif/webp/tiff'

function validateImageFile(filePath, buf) {
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
    case 'svg':
      // SVG 是文本格式：头部（含 BOM/注释/doctype 的容差窗口）内应出现 '<svg' 根标签
      magicOk = buf.subarray(0, 2048).toString('utf8').includes('<svg')
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

export function registerFigureTools(ctx, opts = {}) {
  ctx.tools.register({
    name: 'sci_figure_register',
    description:
      '登记一张已生成的科研图表（绘图后必须调用）。参数：path（图片文件路径，必填）、figure_title、code_path（生成代码文件路径）、dpi、figure_note、result_id（挂为文章蓝图 result 的图表证据）。仅接受真实图片文件（扩展名 png/jpg/jpeg/svg/gif/webp/tiff 且文件头匹配，否则报「文件不是有效图片」）。返回 figureId，供图库与审查使用。',
    parameters: {
      path: { type: 'string', required: true },
      figure_title: { type: 'string', description: '图表标题' },
      code_path: { type: 'string', description: '生成该图的代码文件路径' },
      dpi: { type: 'number' },
      figure_note: { type: 'string', description: '备注' },
      result_id: { type: 'string', description: '文章蓝图 result id（res-N）；提供时图表自动挂为该 result 的证据' },
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
      const id = `fig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12)
      const title = args.figure_title || args.path.split(/[\\/]/).pop()
      // 版本链（v0.9.0）：同 path 优先、同标题兜底，取最近登记的一条作前驱
      const all = Object.values(figures)
      const byPath = all.filter((f) => f && normPath(f.path) === normPath(args.path)).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0))
      const byTitle = args.figure_title ? all.filter((f) => f && f.title === title).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0)) : []
      const prior = byPath[0] || byTitle[0] || null
      if (prior && prior.sha256_12 === sha) {
        // 内容与已登记版本完全一致 → 幂等返回旧档案（防重复登记刷版本）
        log(`figure unchanged (sha match): ${prior.id} v${prior.version || 1}`)
        return {
          ok: true,
          figureId: prior.id,
          unchanged: true,
          version: prior.version || 1,
          sha256_12: sha,
          note: '图片内容与已登记版本完全相同（sha 一致），未新建版本。',
        }
      }
      const version = prior ? (prior.version || 1) + 1 : 1
      figures[id] = {
        id,
        path: args.path,
        title,
        codePath: args.code_path,
        dpi: args.dpi,
        note: args.figure_note,
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
      const out = { ok: true, figureId: id, bytes: stat.size, sha256_12: sha, version, resultId: figures[id].resultId }
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

  log('figure tools registered (sci_figure_register / sci_figure_list)')
}
