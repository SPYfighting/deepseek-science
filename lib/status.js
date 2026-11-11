// dsh-science — /sci-status 实时体检
// 读当前状态文件并给出计数、配置与唯一的下一步；空状态就是首次使用引导。
// 输出保持短行、可扫读，不罗列静态功能清单。

import { reviewSummariesOf } from './reviewruns.js'

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function entriesOf(raw) {
  if (Array.isArray(raw)) return raw.filter(isObj)
  if (isObj(raw)) return Object.values(raw).filter(isObj)
  return []
}

function oneLine(s, max = 80) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(t)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : t
}

// 超出 Date 可表示范围的毫秒值（如纳秒戳 1e20）会让 toISOString 抛 RangeError
const MAX_TIME_MS = 8.64e15

function isoMinuteOf(ms) {
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_TIME_MS) return ''
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

export function statusReportOf(input) {
  const version = String((input && input.version) || '')
  const dataDir = oneLine(input && input.dataDir, 120)
  const workspaceRoot = oneLine(input && input.workspaceRoot, 120)
  const bp = isObj(input && input.blueprint) ? input.blueprint : {}
  const core = isObj(bp.core) ? bp.core : {}
  const coreClaim = String(core.claim ?? '').trim()
  const results = Array.isArray(bp.results) ? bp.results.filter(isObj) : []
  const confirmedResults = results.filter((r) => r.confirmed === true).length
  const team = isObj(input && input.team) ? input.team : {}
  const members = Array.isArray(team.members) ? team.members.filter(isObj).length : 0
  const allTasks = Array.isArray(team.tasks) ? team.tasks.filter(isObj) : []
  const isDeleted = (t) => String(t.status ?? '').toLowerCase() === 'deleted'
  const tasks = allTasks.filter((t) => !isDeleted(t))
  const deletedTasks = allTasks.length - tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'completed').length

  const summaries = reviewSummariesOf(input && input.reviews)
  let fail = 0
  let warn = 0
  let abnormal = 0
  let latest = 0
  for (const s of summaries) {
    fail += s.counts.fail
    warn += s.counts.warn
    if (s.status === 'parse-failed' || s.status === 'failed') abnormal++
    latest = Math.max(latest, s.finishedAt || s.startedAt || 0)
  }
  const stateErrors = Array.isArray(input && input.stateErrors)
    ? input.stateErrors.filter((x) => typeof x === 'string')
    : []

  const figures = entriesOf(input && input.figures).length
  const dbProfiles = entriesOf(input && input.dbProfiles).length
  const sshProfiles = entriesOf(input && input.sshProfiles).length
  const sshJobs = entriesOf(input && input.sshJobs).length

  const cfg = isObj(input && input.config) ? input.config : {}
  const gate = String(cfg.blockedGate ?? '').trim().toLowerCase() === 'hard' ? 'hard' : 'warn'
  const rawThreshold = cfg.falsificationThreshold
  const thresholdNum =
    typeof rawThreshold === 'number'
      ? rawThreshold
      : typeof rawThreshold === 'string' && /^\d+$/.test(rawThreshold.trim())
        ? Number(rawThreshold.trim())
        : NaN
  const threshold = Number.isSafeInteger(thresholdNum) && thresholdNum >= 1 ? thresholdNum : 2

  const error = oneLine(input && input.blueprintError, 80)
  let bpLine
  if (!coreClaim) bpLine = `未开始${error ? ` · ${error}` : ''}`
  else bpLine = `核心已定 · ${results.length} 结果（已确认 ${confirmedResults}）${error ? ` · ${error}` : ''}`

  const latestText = latest
    ? isoMinuteOf(latest)
      ? ` · 最近 ${isoMinuteOf(latest)}`
      : ' · 最近 时间异常'
    : ''
  const abnormalText = abnormal ? ` · 异常 ${abnormal}` : ''
  const reviewLine = summaries.length
    ? `${summaries.length} 次 · fail ${fail} / warn ${warn}${abnormalText}${latestText}`
    : '0 次'
  const stateErrorText = stateErrors.length ? ` · ${stateErrors.length} 个状态文件无法解析` : ''

  let hint
  if (!coreClaim) {
    hint = '首次使用：sci_blueprint_set 写核心主张 → sci_result_add 拆 3–5 条可证伪结果 → sci_team_spawn / sci_team_dispatch 派任务；起草用 /sci-write。'
  } else if (results.length === 0) {
    hint = '下一步：sci_result_add 拆 3–5 条可证伪结果，再给结果挂任务与图表。'
  } else if (tasks.length === 0) {
    hint = '下一步：sci_team_spawn 组队后 sci_team_dispatch 派任务，或 /sci-write 直接起草。'
  } else if (summaries.length === 0) {
    hint = '下一步：/sci-review 审查最近一轮，结论会进入蓝图主张覆盖。'
  } else if (core.confirmed === true) {
    hint = '下一步：/sci-polish 或 sci_blueprint_export 整理写作材料。'
  } else {
    hint = '下一步：sci_blueprint_confirm 确认核心主张，再 /sci-polish 整理写作。'
  }

  return {
    counts: {
      members,
      tasks: tasks.length,
      deletedTasks,
      doneTasks,
      results: results.length,
      confirmedResults,
      reviews: summaries.length,
      fail,
      warn,
      reviewAbnormal: abnormal,
      stateErrors: stateErrors.length,
      figures,
      dbProfiles,
      sshProfiles,
      sshJobs,
    },
    lines: [
      `dsh-science ${version} · 数据 ${dataDir || '—'} · 工作区 ${workspaceRoot || '—'}`,
      `团队  ${members} 成员 · 任务 ${tasks.length}（完成 ${doneTasks}）${deletedTasks ? ` · 已删 ${deletedTasks}` : ''}`,
      `蓝图  ${bpLine}`,
      `审查  ${reviewLine}`,
      `资产  图表 ${figures} · DB ${dbProfiles} · SSH ${sshProfiles} / 作业 ${sshJobs}`,
      `配置  依赖闸门 ${gate} · 证伪阈值 ${threshold}${stateErrorText}`,
      hint,
    ],
  }
}
