// dsh-science — 文章蓝图（Paper Blueprint，v0.6.0）
// 插件的组织中枢：整个插件围绕一篇科学论文组织——
//   核心（标题/主张/创新点/目标期刊）→ 3-5 个 Results（每个是支撑核心的一个子主张）
//   → Tasks（团队任务板上支撑各 Result 的执行任务）→ Figures（各 Result 的图表证据）。
// 负面结果治理：某 result 被证据证伪时，从核心出发重新评估（调整该 result 的表述/方法，
// 或提出新 result）；多个负面且无 supported 时提示核心主张面临证伪风险。
//
// 方法论出处：
// - ARS academic-paper（research/ars/academic-paper/SKILL.md）：8 阶段编排里的
//   Paper Outline + Evidence Map（Phase 2）与 Argument Blueprint 的 claim-evidence 链
//   （Phase 3）；review criteria 预承诺（先固定判据再用证据说话）。
// - PaperSpine（research/paperspine/src/skill/SKILL.md + references/）：skeleton-first
//   （先骨架后血肉）、writing rationale matrix（每个单元标注它推进哪条贡献承诺）、
//   "用户的材料/结果是主张的唯一权威"、不留占位符。
// - 证据台账模式（paperspine references/scientific-evidence-ledger.md）：claim↔result↔evidence
//   可核对的绑定关系，本模块用 result.tasks / result.figures 双向登记落实。

// v0.9.0（Track 2）新增三个维度：
// - 确认工作流：core/results 带 confirmed 布尔——新建/修改后回到 false（待确认），
//   只有用户在对话中明确同意后队长才可 sci_blueprint_confirm 置 true；sci_team_dispatch
//   引用未确认 result 会被拒（闸门在 lib/team.js）。语义：蓝图条目是文章的承诺，确认后
//   才允许作为派发/汇报的依据；修改已确认条目前必须先向用户说明变更（队长协议，lib/router.js）。
// - 每Result参考文献：results[].references = [{doi,title,usedAs,verified,…}]（usedAs:
//   method|concept|background|evidence），带 DOI 时自动经 Crossref 核对（lib/lit.js verifyDoi）。
// - 文献快筛：results[].screening = {decision: include|exclude|maybe, note, decidedAt}
//   （对齐 aipoch Smart Screening 的轻量版，ALIGNMENT-v09 E3）。
// - 导出：sci_blueprint_export 生成 research/blueprint-report.md（对齐 .science 包思想的
//   轻量替身，ALIGNMENT-v09 E7/T3）。

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirOf } from './store.js'
import { verifyDoi, normalizeDoi } from './lit.js'

function log(msg) {
  console.log(`[dsh-science blueprint] ${msg}`)
}

const blueprintFile = () => join(dataDirOf(), 'blueprint.json')
const teamFile = () => join(dataDirOf(), 'team.json')
const figuresFile = () => join(dataDirOf(), 'figures.json')

// result 状态机：planned（计划）→ in_progress（执行中）→ supported（证据已支撑）
//   negative（负面结果，需重新评估说明）| dropped（弃用）
export const RESULT_STATUSES = ['planned', 'in_progress', 'supported', 'negative', 'dropped']
// 文章通常只支撑 3-5 个子主张：第 6 个可加但警告，第 7 个拒绝
export const RESULT_SOFT_CAP = 5
export const RESULT_HARD_CAP = 6

function normalizeIdSeq(results) {
  let seq = 0
  for (const r of Array.isArray(results) ? results : []) {
    const m = /^res-(\d+)$/.exec(String((r && r.id) || ''))
    if (m) seq = Math.max(seq, Number(m[1]))
  }
  return seq
}

export function emptyBlueprint() {
  return {
    core: { title: '', claim: '', innovation: '', venue: '', confirmed: false, updatedAt: 0 },
    results: [],
    narrative: '',
    resultSeq: 0,
    updatedAt: 0,
  }
}

// 蓝图文件损坏隔离（v0.6.0 fix4，X3 推广）：解析失败 **或** 合法 JSON 但结构非法
// （数组/缺 results 字段等非蓝图形状）→ 统一走 quarantine：坏文件改名备份为
// blueprint.json.corrupt-<ts>（备份保留），console.error 报警，blueprintError 置位——
// /state 快照下发，客户端文章 tab 显示警示横幅；下一次成功持久化（如 sci_blueprint_set
// 重建蓝图）自动清除。文件不存在（首跑常态）不算损坏：返回空蓝图且不清不动既有标记。
let blueprintError = null

export function blueprintErrorOf() {
  return blueprintError
}

function quarantineBlueprint(reason) {
  const backupName = `blueprint.json.corrupt-${Date.now()}`
  try {
    renameSync(blueprintFile(), join(dataDirOf(), backupName))
    blueprintError = `blueprint.json ${reason}，已隔离备份为 ${backupName}`
  } catch (berr) {
    blueprintError = `blueprint.json ${reason}且隔离备份失败（${berr && berr.message}）`
  }
  console.error(`[dsh-science blueprint] ${blueprintError}`)
  return emptyBlueprint()
}

export function loadBlueprint() {
  let raw = null
  try {
    raw = readFileSync(blueprintFile(), 'utf8')
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      log(`blueprint read failed (treated as empty): ${err && err.message}`)
    }
    return emptyBlueprint()
  }
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return quarantineBlueprint(`解析失败（${err && err.message}）`)
  }
  // X3：合法 JSON 但结构非法（数组 / 缺 results 字段 / results 非数组）同样隔离——
  // 否则后续 persist 会把非蓝图形状回写，损坏被放大。
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.results)) {
    return quarantineBlueprint('结构非法（不是蓝图对象或缺 results 数组）')
  }
  blueprintError = null
  const bp = parsed
  const core = bp.core && typeof bp.core === 'object' ? bp.core : {}
  const results = Array.isArray(bp.results) ? bp.results : []
  return {
    core: {
      title: typeof core.title === 'string' ? core.title : '',
      claim: typeof core.claim === 'string' ? core.claim : '',
      innovation: typeof core.innovation === 'string' ? core.innovation : '',
      venue: typeof core.venue === 'string' ? core.venue : '',
      confirmed: core.confirmed === true,
      updatedAt: core.updatedAt || 0,
    },
    results,
    narrative: typeof bp.narrative === 'string' ? bp.narrative : '',
    resultSeq: typeof bp.resultSeq === 'number' ? bp.resultSeq : normalizeIdSeq(results),
    updatedAt: bp.updatedAt || 0,
  }
}

// 原子持久化（tmp + rename，rename 失败退回直接写）+ 工作区镜像（.dsh-science/blueprint.json）
export function persistBlueprint(state, exec, mirror) {
  const text = JSON.stringify(state, null, 2)
  const tmp = `${blueprintFile()}.tmp`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, blueprintFile())
  } catch (err) {
    log(`atomic persist fallback: ${err && err.message}`)
    writeFileSync(blueprintFile(), text, 'utf8')
  }
  // fix4：成功持久化 = 蓝图文件重新有效，清除损坏标记（覆盖 sci_blueprint_set 的下一次成功调用）
  blueprintError = null
  if (mirror) mirror('blueprint.json', text, exec)
}

function readTeamState() {
  try {
    return JSON.parse(readFileSync(teamFile(), 'utf8'))
  } catch {
    return null
  }
}

// team.json 原子写（X4 对齐回填用）：与 lib/team.js persist 同口径（tmp+rename，失败退回直接写）
function persistTeamState(team, exec, mirror) {
  const text = JSON.stringify(team, null, 2)
  const tmp = `${teamFile()}.tmp`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, teamFile())
  } catch (err) {
    log(`team atomic persist fallback: ${err && err.message}`)
    writeFileSync(teamFile(), text, 'utf8')
  }
  if (mirror) mirror('team.json', text, exec)
}

function readFiguresState() {
  try {
    const parsed = JSON.parse(readFileSync(figuresFile(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// v0.9.0：存量 result 补默认字段（confirmed/references/screening）——旧蓝图没有这些键，
// 读档即补齐内存视图（persist 时随写回落盘），工具逻辑不必处处判空。
function resultWithDefaults(r) {
  if (!r || typeof r !== 'object') return r
  if (r.confirmed === undefined) r.confirmed = false
  if (!Array.isArray(r.references)) r.references = []
  if (!r.screening) r.screening = null
  return r
}

// result 输出视图（工具/导出共用）：不泄漏内部时间戳以外的杂项
function resultOut(r) {
  return {
    id: r.id,
    title: r.title || r.id,
    claim: r.claim || '',
    status: r.status || 'planned',
    confirmed: r.confirmed === true,
    tasks: Array.isArray(r.tasks) ? r.tasks : [],
    figures: Array.isArray(r.figures) ? r.figures : [],
    references: Array.isArray(r.references) ? r.references : [],
    screening: r.screening || null,
    notes: r.notes || '',
  }
}

function findResult(state, resultId) {
  const id = String(resultId || '')
  const result = state.results.find((r) => r && r.id === id)
  if (!result) {
    const known = state.results.map((r) => r && r.id).filter(Boolean).join(', ') || '（空）'
    throw new Error(`result ${id} 不存在（现有：${known}）。先用 sci_result_add 创建，或用 sci_blueprint_overview 查看。`)
  }
  return result
}

// 任务对齐：把团队任务板上的 task 挂到 result.tasks（幂等，去重）
// 供 sci_blueprint_align 工具与 sci_team_dispatch 的 result_id 参数共用。
// X4：双向回填——result.tasks 挂上 task-N 的同时回写 task.resultId（含存量数据修复：
// result.tasks 已含 task-N 但该任务对象 resultId 为空/指向别处 → 统一回写为本次对齐的 result），
// team.json 原子写回，保证团队 tab 徽章与蓝图实际对齐一致。
export function alignTaskToResult(taskId, resultId, opts = {}) {
  const tid = String(taskId || '')
  const state = loadBlueprint()
  const result = findResult(state, resultId)
  const team = readTeamState()
  const task = team && Array.isArray(team.tasks) ? team.tasks.find((t) => t && t.id === tid) : null
  if (!task) throw new Error(`任务 ${tid} 不在团队任务板上（team.json）。先 sci_team_dispatch 派发（可带 result_id 一步对齐）。`)
  let resultIdBackfilled = false
  if (task.resultId !== result.id) {
    task.resultId = result.id
    task.updatedAt = Date.now()
    resultIdBackfilled = true
  }
  if (!Array.isArray(result.tasks)) result.tasks = []
  if (!result.tasks.includes(tid)) result.tasks.push(tid)
  result.updatedAt = Date.now()
  state.updatedAt = Date.now()
  persistBlueprint(state, opts.exec, opts.mirror)
  if (resultIdBackfilled) persistTeamState(team, opts.exec, opts.mirror)
  log(`task aligned: ${tid} → ${result.id}${resultIdBackfilled ? '（task.resultId 已回写）' : ''}`)
  return { taskId: tid, resultId: result.id, resultTasks: result.tasks.slice(), resultIdBackfilled }
}

// 图表挂接：把已登记（figures.json）的 fig-* 挂为 result 的图表证据（幂等，去重）
export function linkFigureToResult(figureId, resultId, opts = {}) {
  const fid = String(figureId || '')
  const state = loadBlueprint()
  const result = findResult(state, resultId)
  const figures = readFiguresState()
  if (!figures || !figures[fid]) {
    throw new Error(`图表 ${fid} 未登记（figures.json）。先由绘图成员 sci_figure_register 登记（可带 result_id 一步挂接）。`)
  }
  if (!Array.isArray(result.figures)) result.figures = []
  if (!result.figures.includes(fid)) result.figures.push(fid)
  result.updatedAt = Date.now()
  state.updatedAt = Date.now()
  persistBlueprint(state, opts.exec, opts.mirror)
  log(`figure linked: ${fid} → ${result.id}`)
  return { figureId: fid, resultId: result.id, resultFigures: result.figures.slice() }
}

// 任务板截断清理（v0.6.0 fix5）：team.json 任务 >200 截断时，被截掉的 task id 会变成
// result.tasks 里的死引用——这里把它们从所有 result.tasks 中摘除。幂等：无变化不落盘。
export function pruneTasksFromResults(taskIds, opts = {}) {
  const dead = new Set((Array.isArray(taskIds) ? taskIds : []).map(String))
  if (dead.size === 0) return false
  const state = loadBlueprint()
  let changed = false
  for (const r of Array.isArray(state.results) ? state.results : []) {
    if (!Array.isArray(r.tasks) || r.tasks.length === 0) continue
    const live = r.tasks.filter((id) => !dead.has(String(id)))
    if (live.length !== r.tasks.length) {
      r.tasks = live
      r.updatedAt = Date.now()
      changed = true
    }
  }
  if (changed) {
    state.updatedAt = Date.now()
    persistBlueprint(state, opts.exec, opts.mirror)
    log(`pruned truncated task refs from results: ${[...dead].join(', ')}`)
  }
  return changed
}

// 覆盖分析：result 缺任务/缺图表、任务未对齐、图表未挂接、负面结果计数与证伪风险。
// 工具（sci_blueprint_overview）与 /state 快照（httpdata）共用同一实现，保证口径一致。
// v0.6.0 fix2：negative/dropped 的 result 已退出支撑链，不再报"无任务/无图表"；
//   新增 unlinkedFigures（已登记但未挂到任何 result 的图表）警告；
// v0.6.0 fix5：result.tasks 里的死引用（任务板已截断/不存在）不计入覆盖（staleTaskRefs 列出，
//   sci_blueprint_overview 会就地摘除并持久化）。
// X1：unalignedTasks 口径修正——review 类任务（isReview:true）与 completed/failed/cancelled/
//   deleted 终态任务豁免；未对齐警告附补救提示（sci_blueprint_align 补挂）。
export function coverageOf(bp, teamState, figures) {
  const results = Array.isArray(bp.results) ? bp.results : []
  const tasks = teamState && Array.isArray(teamState.tasks) ? teamState.tasks : []
  const taskIds = new Set(tasks.map((t) => t && t.id).filter(Boolean))
  // figures：键值对象（figures.json 原样）或数组（已 toList）均可
  const figureList = Array.isArray(figures)
    ? figures.filter(Boolean)
    : figures && typeof figures === 'object'
      ? Object.values(figures).filter(Boolean)
      : []
  const linkedFigures = new Set()
  for (const r of results) {
    for (const f of Array.isArray(r && r.figures) ? r.figures : []) linkedFigures.add(f)
  }
  const aligned = new Set()
  const staleTaskRefs = []
  const resultsWithoutTasks = []
  const resultsWithoutFigures = []
  const warnings = []
  for (const r of results) {
    const status = r && r.status
    const exempt = status === 'negative' || status === 'dropped'
    const rawTasks = Array.isArray(r.tasks) ? r.tasks : []
    const liveTasks = rawTasks.filter((id) => taskIds.has(id))
    for (const id of rawTasks) {
      if (!taskIds.has(id)) staleTaskRefs.push({ resultId: r.id, taskId: id })
    }
    for (const t of liveTasks) aligned.add(t)
    if (!exempt && liveTasks.length === 0) {
      resultsWithoutTasks.push(r.id)
      warnings.push(`${r.id} 无任务——尚无执行工作支撑该子主张`)
    }
    const figs = Array.isArray(r.figures) ? r.figures : []
    if (!exempt && figs.length === 0) {
      resultsWithoutFigures.push(r.id)
      warnings.push(`${r.id} 无图表——缺少图表证据`)
    }
  }
  const unlinkedFigures = figureList.map((f) => f && f.id).filter((id) => id && !linkedFigures.has(id))
  if (unlinkedFigures.length > 0) {
    const shown = unlinkedFigures.slice(0, 5).join('、')
    warnings.push(
      `图表 ${shown}${unlinkedFigures.length > 5 ? ` 等 ${unlinkedFigures.length} 个` : ''} 未挂接任何 result——图表证据未定位（sci_blueprint_link_figure 补挂）`,
    )
  }
  const unalignedTasks = []
  for (const t of tasks) {
    // X1 口径修正：以下任务不支撑文章子主张，从未对齐名单与警告中豁免——
    //   ① 审查类任务（sci_review_send 创建时标记 isReview:true）：审查是质量闸门，不是证据工作；
    //   ② 终态任务 completed/failed/cancelled/deleted：已完结的工作不再要求补挂对齐。
    if (!t || t.isReview) continue
    if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'deleted') continue
    if (!aligned.has(t.id)) {
      unalignedTasks.push(t.id)
      warnings.push(`${t.id} 未对齐任何 result——该工作对文章的贡献未定位；用 sci_blueprint_align 补挂到某个 result（补挂后徽章与覆盖警告即消除）`)
    }
  }
  const negativeCount = results.filter((r) => r && r.status === 'negative').length
  const supportedCount = results.filter((r) => r && r.status === 'supported').length
  const droppedCount = results.filter((r) => r && r.status === 'dropped').length
  const falsificationRisk = negativeCount >= 2 && supportedCount === 0
  if (falsificationRisk) {
    warnings.push(`⚠ 负面结果 ${negativeCount} 个且无 supported——核心主张面临证伪风险，请从核心出发重新评估蓝图（调整 results 或证伪核心主张）`)
  }
  return {
    resultsWithoutTasks,
    resultsWithoutFigures,
    unalignedTasks,
    unlinkedFigures,
    staleTaskRefs,
    negativeCount,
    supportedCount,
    droppedCount,
    falsificationRisk,
    warnings,
  }
}

function coreOut(core) {
  return {
    title: (core && core.title) || '',
    claim: (core && core.claim) || '',
    innovation: (core && core.innovation) || '',
    venue: (core && core.venue) || '',
  }
}

// 论文视角摘要（v0.9.0 Track 2 B3）：哪些 result 证据齐备、哪些缺什么——
// 供 sci_blueprint_overview 输出与 sci_blueprint_export 报告共用。
function paperViewOf(state) {
  const rows = (state.results || []).map((r) => {
    resultWithDefaults(r)
    const tasks = Array.isArray(r.tasks) ? r.tasks : []
    const figures = Array.isArray(r.figures) ? r.figures : []
    const refs = Array.isArray(r.references) ? r.references : []
    const unverifiedRefs = refs.filter((x) => x && !x.verified).length
    const missing = []
    const exempt = r.status === 'negative' || r.status === 'dropped'
    if (!exempt && tasks.length === 0) missing.push('任务')
    if (!exempt && figures.length === 0) missing.push('图表')
    if (refs.length === 0) missing.push('参考文献')
    if (r.confirmed !== true) missing.push('确认')
    return {
      id: r.id,
      title: r.title || r.id,
      status: r.status || 'planned',
      confirmed: r.confirmed === true,
      tasksCount: tasks.length,
      figuresCount: figures.length,
      referencesCount: refs.length,
      unverifiedReferences: unverifiedRefs,
      screening: r.screening || null,
      evidenceReady: !exempt && tasks.length > 0 && figures.length > 0,
      missing,
    }
  })
  const ready = rows.filter((r) => r.evidenceReady)
  const missingRows = rows.filter((r) => !r.evidenceReady && r.status !== 'negative' && r.status !== 'dropped')
  const summary = `证据齐备 ${ready.length}/${rows.length}（${ready.map((r) => r.id).join('、') || '无'}）；缺证据 ${missingRows.map((r) => `${r.id}（缺${r.missing.join('/')}）`).join('；') || '无'}`
  return { results: rows, readyCount: ready.length, missingCount: missingRows.length, summary }
}

// 导出 markdown 报告（sci_blueprint_export 用）
function exportMarkdown(state, cov) {
  const core = state.core || {}
  const L = []
  L.push(`# 文章蓝图报告（dsh-science）`)
  L.push('')
  L.push(`> 导出时间：${new Date().toISOString()}  · 工具：sci_blueprint_export`)
  L.push('')
  L.push('## 核心')
  L.push('')
  L.push(`- 标题：${core.title || '（未命名）'}`)
  L.push(`- 核心主张：${core.claim || '（未确立）'}`)
  L.push(`- 创新点：${core.innovation || '—'}`)
  L.push(`- 目标期刊：${core.venue || '—'}`)
  L.push(`- 确认状态：${core.confirmed === true ? '🔒 已确认' : '待确认'}`)
  if (state.narrative) {
    L.push('')
    L.push('## 叙事主线')
    L.push('')
    L.push(state.narrative)
  }
  L.push('')
  L.push(`## Results（${(state.results || []).length}）`)
  for (const r0 of state.results || []) {
    const r = resultWithDefaults({ ...r0, tasks: [...(r0.tasks || [])], references: [...(r0.references || [])] })
    L.push('')
    L.push(`### ${r.id} · ${r.title}${r.status ? `（${r.status}）` : ''}${r.confirmed ? ' 🔒已确认' : ' ⏳待确认'}`)
    L.push('')
    L.push(`- 主张：${r.claim || '—'}`)
    L.push(`- 支撑任务：${(r.tasks || []).join('、') || '无'}`)
    L.push(`- 图表证据：${(r.figures || []).join('、') || '无'}`)
    if ((r.references || []).length > 0) {
      L.push(`- 参考文献（${r.references.length}）：`)
      for (const ref of r.references) {
        L.push(`  - [${ref.usedAs}] ${ref.doi ? `doi:${ref.doi}` : '（无 DOI）'} ${ref.title}${ref.verified ? '（✓ 已核对）' : '（⚠ 未核对）'}`)
      }
    } else {
      L.push('- 参考文献：无')
    }
    if (r.screening) L.push(`- 快筛：${r.screening.decision}${r.screening.note ? `（${r.screening.note}）` : ''}`)
    if (r.notes) L.push(`- notes：${r.notes}`)
  }
  const pv = paperViewOf(state)
  L.push('')
  L.push('## 论文视角摘要')
  L.push('')
  L.push(`- ${pv.summary}`)
  L.push('')
  L.push('## 覆盖警告')
  L.push('')
  if (cov.warnings.length === 0) L.push('- 覆盖完整，无警告。')
  else for (const w of cov.warnings) L.push(`- ${w}`)
  L.push('')
  return L.join('\n')
}

export function registerBlueprintTools(ctx, opts = {}) {
  const mirror = opts.mirror

  // -- 核心 ---------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_blueprint_set',
    description:
      '设置/更新文章蓝图核心（论文标题、核心主张、创新点、目标期刊、叙事主线）。科研会话开始时先确立核心（与用户确认核心主张与创新点）；重复调用可增量更新（只传需要改的字段）。',
    parameters: {
      core_title: { type: 'string', description: '论文标题（工作标题，可后续修改）' },
      claim: { type: 'string', description: '核心主张：一句话说清文章要论证什么（必填首次）' },
      innovation: { type: 'string', description: '创新点：与已有工作的区分' },
      venue: { type: 'string', description: '目标期刊/会议' },
      narrative: { type: 'string', description: '叙事主线：results 如何逐层支撑核心的一段话' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadBlueprint()
      const core = state.core
      if (core.confirmed === undefined) core.confirmed = false
      const wasConfirmed = core.confirmed === true
      const changed = []
      if (args.core_title != null) { core.title = String(args.core_title).slice(0, 300); changed.push('core_title') }
      if (args.claim != null) { core.claim = String(args.claim).slice(0, 1000); changed.push('claim') }
      if (args.innovation != null) { core.innovation = String(args.innovation).slice(0, 1000); changed.push('innovation') }
      if (args.venue != null) { core.venue = String(args.venue).slice(0, 200); changed.push('venue') }
      if (args.narrative != null) { state.narrative = String(args.narrative).slice(0, 4000); changed.push('narrative') }
      if (changed.length === 0) throw new Error('至少提供一个字段（core_title/claim/innovation/venue/narrative）')
      // 确认工作流（v0.9.0）：核心被修改 → 打回待确认（confirmed=false），需用户重新同意后
      // 由队长 sci_blueprint_confirm kind=core 重新确认（队长协议：修改已确认条目前先说明变更）
      if (wasConfirmed) core.confirmed = false
      core.updatedAt = Date.now()
      state.updatedAt = Date.now()
      persistBlueprint(state, exec, mirror)
      const out = { ok: true, changed, core: coreOut(core), coreConfirmed: core.confirmed === true, resultCount: state.results.length }
      if (wasConfirmed) {
        out.requireConfirm = true
        out.note = '核心已修改，confirmation 打回待确认（confirmed=false）——向用户说明变更并获同意后，用 sci_blueprint_confirm kind=core 重新确认。'
      } else {
        out.note = '核心当前待确认：向用户复述标题/主张/创新点并获明确同意后，调用 sci_blueprint_confirm kind=core。'
      }
      return out
    },
  })

  // -- Results --------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_result_add',
    description:
      '向文章蓝图添加一个 Result（支撑核心主张的子主张，建议 3-5 个；第 6 个可加但会警告，第 7 个拒绝）。claim 必须是一句可检验的论断。',
    parameters: {
      result_title: { type: 'string', description: '结果标题（短语，如"MYC 靶基因集显著上调"）' },
      claim: { type: 'string', description: '子主张：该 result 支撑核心的具体论断（必填）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      if (args.claim == null || String(args.claim).trim() === '') {
        throw new Error('claim 必填：一句话说清该 result 论证什么（可检验的子主张）')
      }
      const state = loadBlueprint()
      if (state.results.length >= RESULT_HARD_CAP) {
        throw new Error(`results 已达上限 ${RESULT_HARD_CAP} 个——一篇文章难以支撑更多子主张；先整合弱结果或用 sci_result_update status=dropped 弃用。`)
      }
      state.resultSeq = (state.resultSeq || 0) + 1
      const id = `res-${state.resultSeq}`
      state.results.push({
        id,
        title: String(args.result_title || id).slice(0, 200),
        claim: String(args.claim).slice(0, 1000),
        status: 'planned',
        confirmed: false,
        tasks: [],
        figures: [],
        references: [],
        screening: null,
        notes: '',
        updatedAt: Date.now(),
      })
      state.updatedAt = Date.now()
      persistBlueprint(state, exec, mirror)
      log(`result added: ${id} (${state.results.length} total)`)
      const out = { ok: true, resultId: id, resultCount: state.results.length, confirmed: false }
      if (state.results.length > RESULT_SOFT_CAP) {
        out.warning = `已超过 ${RESULT_SOFT_CAP} 个 results——论文通常只支撑 ${RESULT_SOFT_CAP} 个以内子主张，考虑合并或舍弃弱结果`
      }
      out.note = `result 待确认：向用户复述该子主张并获同意后 sci_blueprint_confirm kind=result result_id=${id}；确认前 sci_team_dispatch 不能引用它。为所用方法/概念登记参考文献：sci_result_reference_add result_id=${id}。`
      return out
    },
  })

  // -- 状态更新 --------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_result_update',
    description:
      '更新蓝图 result（status/notes/标题/claim）。status 枚举：planned | in_progress | supported | negative | dropped。标记 negative 必须 notes 写明对核心主张的影响（重新评估说明）。',
    parameters: {
      result_id: { type: 'string', description: 'result id（res-N）' },
      status: { type: 'string', description: `枚举：${RESULT_STATUSES.join(' | ')}` },
      notes: { type: 'string', description: '进展/评估说明；status=negative 时必填（对核心的影响与下一步）' },
      result_title: { type: 'string', description: '修改结果标题' },
      claim: { type: 'string', description: '修改子主张表述' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadBlueprint()
      const result = findResult(state, args.result_id)
      resultWithDefaults(result)
      let nextStatus = null
      if (args.status != null) {
        nextStatus = String(args.status)
        if (!RESULT_STATUSES.includes(nextStatus)) {
          throw new Error(`非法 status "${nextStatus}"（可用枚举：${RESULT_STATUSES.join(' | ')}）`)
        }
      }
      const effectiveNotes = args.notes != null ? String(args.notes).slice(0, 4000) : result.notes || ''
      // 负面结果强制重新评估：每次标记 negative 都必须随调用给出新的重新评估说明
      //（旧 notes 可能是进展记录，不能默认当作对核心的影响说明——V4 测试发现的漏洞，已收紧）
      if (nextStatus === 'negative' && (args.notes == null || String(args.notes).trim() === '')) {
        throw new Error(
          'status=negative 需要 notes 重新评估说明：该负面结果对核心主张意味着什么——调整本 result 的表述/方法重跑，还是动摇核心（证伪讨论）？从核心出发重新评估后再标记。',
        )
      }
      const wasConfirmed = result.confirmed === true
      const touched = []
      if (nextStatus) { result.status = nextStatus; touched.push('status') }
      if (args.notes != null) { result.notes = effectiveNotes; touched.push('notes') }
      if (args.result_title != null) { result.title = String(args.result_title).slice(0, 200); touched.push('result_title') }
      if (args.claim != null) { result.claim = String(args.claim).slice(0, 1000); touched.push('claim') }
      // 确认工作流（v0.9.0）：已确认的 result 被修改（status/notes/标题/claim）→ 打回待确认，
      // 需重新走 sci_blueprint_confirm（队长协议：修改前先向用户说明变更）
      if (wasConfirmed && touched.length > 0) result.confirmed = false
      result.updatedAt = Date.now()
      state.updatedAt = Date.now()
      persistBlueprint(state, exec, mirror)
      log(`result updated: ${result.id} → ${result.status}${wasConfirmed && touched.length > 0 ? '（confirmed 已打回）' : ''}`)
      const out = { ok: true, resultId: result.id, status: result.status, notes: result.notes || '', confirmed: result.confirmed === true, modified: touched }
      if (wasConfirmed && touched.length > 0) {
        out.requireConfirm = true
        out.note = '已确认的 result 被修改，confirmation 打回待确认——向用户说明变更并获同意后 sci_blueprint_confirm kind=result result_id=' + result.id + ' 重新确认。'
      }
      if (result.status === 'negative') {
        out.nextStep = '已记录负面结果——从核心出发重新评估：调整该 result（改 claim/换方法重派任务）或提出新 result；多个负面且无 supported 时向用户提示证伪风险'
      }
      return out
    },
  })

  // -- 确认工作流（v0.9.0 Track 2 B1）------------------------------------------
  // 语义：confirmed=true 只能由本工具设置，且前提是用户在对话中明确同意（队长协议约束）。
  // 修改已确认条目（sci_blueprint_set / sci_result_update）自动打回 false，需重新确认。
  ctx.tools.register({
    name: 'sci_blueprint_confirm',
    description:
      '确认文章蓝图条目（把 confirmed 置 true）。kind=core 确认核心（标题/主张/创新点）；kind=result 确认某个 result（result_id 必填）。只有用户在对话中明确同意该条目内容后才可调用；未确认的 result 不能被 sci_team_dispatch 引用（派发会被拒）。修改已确认条目会自动打回待确认。',
    parameters: {
      kind: { type: 'string' /*必填*/, description: '枚举：core | result（必填）' },
      result_id: { type: 'string', description: 'kind=result 时必填：result id（res-N）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const kind = String(args.kind || '')
      const state = loadBlueprint()
      if (kind === 'core') {
        const core = state.core
        if (!core.title && !core.claim) throw new Error('核心为空（无 title/claim）——先用 sci_blueprint_set 确立核心，与用户确认后再调用本工具。')
        core.confirmed = true
        core.updatedAt = Date.now()
        state.updatedAt = Date.now()
        persistBlueprint(state, exec, mirror)
        log('core confirmed')
        return { ok: true, kind: 'core', confirmed: true, core: coreOut(core) }
      }
      if (kind === 'result') {
        const result = findResult(state, args.result_id)
        resultWithDefaults(result)
        result.confirmed = true
        result.updatedAt = Date.now()
        state.updatedAt = Date.now()
        persistBlueprint(state, exec, mirror)
        log(`result confirmed: ${result.id}`)
        return { ok: true, kind: 'result', resultId: result.id, confirmed: true, status: result.status || 'planned' }
      }
      throw new Error(`非法 kind "${kind}"（可用：core | result）`)
    },
  })

  // -- 每Result参考文献（v0.9.0 Track 2 B2）-------------------------------------
  const REF_USED_AS = ['method', 'concept', 'background', 'evidence']
  ctx.tools.register({
    name: 'sci_result_reference_add',
      description:
      `为蓝图 result 登记一条参考文献（该 result 所用的方法/概念/背景/证据）。used_as 枚举：${REF_USED_AS.join(' | ')}。带 ref_doi 时自动经 Crossref 核对并回填标题（核对失败/无 DOI → verified=false，提示用户核对）；ref_doi 与 ref_title 至少提供一个。结果设计时必须为所用方法/概念登记参考文献（队长协议）。`,
    parameters: {
      result_id: { type: 'string' /*必填*/, description: 'result id（res-N，必填）' },
      ref_doi: { type: 'string', description: 'DOI（推荐提供，自动 Crossref 核对标题并标 verified）' },
      ref_title: { type: 'string', description: '文献标题（无 DOI 时必填；有 DOI 时可省略——自动回填）' },
      used_as: { type: 'string', description: `该文献在本 result 中的用途，枚举：${REF_USED_AS.join(' | ')}（缺省 method）` },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadBlueprint()
      const result = findResult(state, args.result_id)
      resultWithDefaults(result)
      const usedAs = REF_USED_AS.includes(String(args.used_as)) ? String(args.used_as) : 'method'
      const doiRaw = args.ref_doi != null && String(args.ref_doi).trim() !== '' ? String(args.ref_doi) : ''
      const titleRaw = args.ref_title != null ? String(args.ref_title).trim() : ''
      if (!doiRaw && !titleRaw) {
        throw new Error('ref_doi 与 ref_title 至少提供一个：有 DOI 一律带 DOI（自动核对）；无 DOI 手工登记需 ref_title（verified=false 待人工核对）。')
      }
      // 去重：同 DOI（归一化）或同标题已登记 → 幂等返回已有条目
      const doiNorm = doiRaw ? normalizeDoi(doiRaw) : ''
      const dup = (result.references || []).find(
        (x) => (doiNorm && x.doi && normalizeDoi(x.doi) === doiNorm) || (!doiNorm && titleRaw && x.title === titleRaw),
      )
      if (dup) {
        return { ok: true, resultId: result.id, reference: dup, duplicate: true, note: '该文献已在本文 result 登记（幂等，未重复添加）。' }
      }
      let ref = { doi: doiNorm || '', title: titleRaw, usedAs, verified: false, verifyError: '', checkedAt: 0, addedAt: Date.now() }
      const out = { ok: true, resultId: result.id, usedAs }
      if (doiRaw) {
        const v = await verifyDoi(doiRaw)
        if (v.ok) {
          ref = { doi: v.doi, title: titleRaw || v.title || '', usedAs, verified: true, verifyError: '', checkedAt: v.verifiedAt || Date.now(), addedAt: Date.now() }
          out.crossref = { title: v.title || '', container: v.containerTitle || '', year: v.year || null, authors: v.authors || [] }
        } else {
          // V2 发现并修复：核对失败也要登记（verified=false 待人工核对）——此前无 ref_title 时
          // 会 throw，假 DOI 反而进不了台账。标题缺省用 DOI 占位，UI/导出均以 doi 为标识。
          ref.verifyError = String(v.error || '核对失败')
          if (!ref.title) ref.title = `doi:${doiNorm}`
          out.crossrefError = ref.verifyError
          out.warning = 'DOI 未能核对通过（verified=false）——已按未核对登记，请人工核对引用真实性；编造引用是学术不端。'
        }
      } else {
        out.warning = '未提供 DOI，参考文献标记 verified=false（未经核对）——建议补 DOI 重新登记以自动核对。'
      }
      result.references.push(ref)
      result.updatedAt = Date.now()
      state.updatedAt = Date.now()
      persistBlueprint(state, exec, mirror)
      log(`reference added: ${result.id} ← ${ref.doi || ref.title} (${usedAs}, verified=${ref.verified})`)
      out.reference = ref
      out.referencesCount = result.references.length
      return out
    },
  })

  // -- 文献快筛（v0.9.0 Track 3，aipoch Smart Screening 轻量版）-------------------
  const SCREENING_DECISIONS = ['include', 'exclude', 'maybe']
  ctx.tools.register({
    name: 'sci_result_screening',
    description:
      `记录蓝图 result 的文献快筛结论（决定该子主张是否纳入文章证据链）。decision 枚举：${SCREENING_DECISIONS.join(' | ')}；screening_note 说明纳入/排除理由（exclude 必填）。快筛是 AI 辅助初筛，最终取舍由用户决定（建议 exclude/maybe 时向用户汇报）。`,
    parameters: {
      result_id: { type: 'string' /*必填*/, description: 'result id（res-N，必填）' },
      decision: { type: 'string' /*必填*/, description: `枚举：${SCREENING_DECISIONS.join(' | ')}（必填）` },
      screening_note: { type: 'string', description: '快筛理由；decision=exclude 时必填' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadBlueprint()
      const result = findResult(state, args.result_id)
      resultWithDefaults(result)
      const decision = String(args.decision || '')
      if (!SCREENING_DECISIONS.includes(decision)) {
        throw new Error(`非法 decision "${decision}"（可用枚举：${SCREENING_DECISIONS.join(' | ')}）`)
      }
      const note = args.screening_note != null ? String(args.screening_note).slice(0, 2000) : ''
      if (decision === 'exclude' && note.trim() === '') {
        throw new Error('decision=exclude 需要 screening_note 说明排除理由（可追溯）。')
      }
      result.screening = { decision, note, decidedAt: Date.now() }
      result.updatedAt = Date.now()
      state.updatedAt = Date.now()
      persistBlueprint(state, exec, mirror)
      log(`screening: ${result.id} → ${decision}`)
      return {
        ok: true,
        resultId: result.id,
        screening: result.screening,
        note: decision === 'include' ? '已纳入证据链——为所用方法/概念登记参考文献（sci_result_reference_add）。' : '快筛结论已记录，向用户汇报后由用户最终取舍。',
      }
    },
  })

  // -- 蓝图导出（v0.9.0 Track 3）------------------------------------------------
  // 生成 <工作区>/research/blueprint-report.md：任务/结果/参考文献/快筛/覆盖警告一页导出，
  // 供组会/存档/人工审阅（对齐 .science 可复现包思想的轻量替身）。
  ctx.tools.register({
    name: 'sci_blueprint_export',
    description:
      '把文章蓝图导出为 markdown 报告（<工作区>/research/blueprint-report.md）：核心、各 result（状态/确认/claim/任务/图表/参考文献/快筛/notes）、覆盖警告与论文视角摘要。供汇报与存档。',
    parameters: {},
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const agent = exec && exec.agent
      const session = agent && agent.session
      if (!session || !ctx.workingDirectory) {
        throw new Error('无法确定会话工作目录（workingDirectory 服务不可用）——报告导出需要 web/桌面会话上下文。')
      }
      let cwd = null
      try {
        cwd = ctx.workingDirectory.get(session)
      } catch (err) {
        throw new Error(`读取工作目录失败：${err && err.message}`)
      }
      if (!cwd) throw new Error('当前会话没有工作目录——先确认会话已打开工作区。')
      const state = loadBlueprint()
      const team = readTeamState()
      const figures = readFiguresState()
      const cov = coverageOf(state, team, figures)
      const md = exportMarkdown(state, cov)
      const dir = join(cwd, 'research')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, 'blueprint-report.md')
      writeFileSync(file, md, 'utf8')
      log(`blueprint exported: ${file} (${md.length} chars)`)
      return {
        ok: true,
        path: file,
        bytes: Buffer.byteLength(md, 'utf8'),
        resultCount: state.results.length,
        unverifiedReferences: state.results.reduce((n, r) => n + ((r.references || []).filter((x) => !x.verified).length || 0), 0),
        warningCount: cov.warnings.length,
      }
    },
  })

  // -- 任务对齐 --------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_blueprint_align',
    description:
      '把团队任务板上的任务对齐到蓝图 result（task-N → res-N）。sci_team_dispatch 支持 result_id 参数一步完成；本工具用于补挂/改挂已有任务。',
    parameters: {
      task_id: { type: 'string', description: '任务 id（task-N，必须已在团队任务板上）' },
      result_id: { type: 'string', description: 'result id（res-N）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      return alignTaskToResult(args.task_id, args.result_id, { exec, mirror })
    },
  })

  // -- 图表挂接 --------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_blueprint_link_figure',
    description:
      '把已登记的图表挂为蓝图 result 的图表证据（fig-* → res-N）。sci_figure_register 支持 result_id 参数一步完成；本工具用于补挂。',
    parameters: {
      figure_id: { type: 'string', description: '图表 id（sci_figure_register 返回的 figureId，fig-*）' },
      result_id: { type: 'string', description: 'result id（res-N）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      return linkFigureToResult(args.figure_id, args.result_id, { exec, mirror })
    },
  })

  // -- 总览 + 覆盖分析 ---------------------------------------------------------
  ctx.tools.register({
    name: 'sci_blueprint_overview',
    description:
      '文章蓝图总览 + 覆盖分析：核心、各 result 及其任务/图表对齐、缺失警告（无任务/无图表/任务未对齐/图表未挂接）、负面结果计数与证伪风险。派发任务前检查对齐；向用户汇报时按文章视角组织。',
    parameters: {},
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(_args, exec) {
      const state = loadBlueprint()
      const team = readTeamState()
      // fix5：覆盖校验 result.tasks ⊆ 团队任务板——死引用（任务已截断/删除）就地摘除并持久化，
      // prunedStaleTasks 附在输出里作为说明（note）。
      const existing = new Set(
        team && Array.isArray(team.tasks) ? team.tasks.map((t) => t && t.id).filter(Boolean) : [],
      )
      const prunedStaleTasks = []
      for (const r of state.results) {
        if (!Array.isArray(r.tasks) || r.tasks.length === 0) continue
        const live = r.tasks.filter((id) => existing.has(id))
        if (live.length !== r.tasks.length) {
          prunedStaleTasks.push({ resultId: r.id, dropped: r.tasks.filter((id) => !existing.has(id)) })
          r.tasks = live
          r.updatedAt = Date.now()
        }
      }
      if (prunedStaleTasks.length > 0) {
        state.updatedAt = Date.now()
        persistBlueprint(state, exec, mirror)
        log(`coverage pruned stale task refs: ${JSON.stringify(prunedStaleTasks)}`)
      }
      // v0.9.0：结果输出带确认状态/参考文献/快筛（resultOut 统一口径）+ 论文视角摘要 +
      // 确认汇总——队长江报按文章视角组织（哪些 result 证据齐备、哪些缺什么）。
      const results = state.results.map((r) => resultOut(resultWithDefaults(r)))
      const refsTotal = results.reduce((n, r) => n + r.references.length, 0)
      const unverifiedRefs = results.reduce((n, r) => n + r.references.filter((x) => !x.verified).length, 0)
      return {
        core: { ...coreOut(state.core), confirmed: state.core.confirmed === true },
        results,
        paperView: paperViewOf(state),
        confirmedSummary: {
          coreConfirmed: state.core.confirmed === true,
          resultsConfirmed: results.filter((r) => r.confirmed).length,
          resultsTotal: results.length,
          referencesTotal: refsTotal,
          unverifiedReferences: unverifiedRefs,
          note: unverifiedRefs > 0 ? `有 ${unverifiedRefs} 条参考文献未通过核对（verified=false）——人工核对或补 DOI 重新登记。` : '',
        },
        narrative: state.narrative,
        coverage: coverageOf(state, team, readFiguresState()),
        prunedStaleTasks,
        taskCount: team && Array.isArray(team.tasks) ? team.tasks.length : 0,
      }
    },
  })

  log('blueprint tools registered (sci_blueprint_set / sci_result_add / sci_result_update / sci_blueprint_confirm / sci_result_reference_add / sci_result_screening / sci_blueprint_export / sci_blueprint_align / sci_blueprint_link_figure / sci_blueprint_overview)')
}
