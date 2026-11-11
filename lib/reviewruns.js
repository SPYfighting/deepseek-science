// dsh-science — 审查 run 的轻量视图
// /state 每 3s 被轮询，完整 run.findings 可达上百 KB；快照只传摘要，
// 客户端展开某行时再经 GET /plugins/dsh-science/review?run=<id> 取详情。
// 对象键（reviews.json 的常规形态）与数组形态都接受；脏条目一律忽略。

import { normSeverity } from './reviewcov.js'

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function timeOf(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  const n = Date.parse(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (isObj(value)) {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (/pass(word|phrase)/i.test(k)) continue
      out[k] = redactSensitive(v)
    }
    return out
  }
  return value
}

function collectRuns(raw) {
  const entries = []
  if (Array.isArray(raw)) {
    raw.forEach((run, i) => {
      if (isObj(run)) {
        const key = typeof run.key === 'string' && run.key.trim() ? run.key.trim() : null
        entries.push({ run, key, fallback: key || `run-${i}` })
      }
    })
  } else if (isObj(raw)) {
    for (const [key, run] of Object.entries(raw)) {
      if (isObj(run)) entries.push({ run, key, fallback: key })
    }
  }
  // id 只认非空字符串；重复时用对象键/序号加后缀，避免 React key、展开态与详情缓存互相串台。
  const used = new Set()
  return entries.map(({ run, key, fallback }) => {
    const base = (typeof run.id === 'string' && run.id.trim() && run.id.trim()) || key || fallback
    let id = base
    if (used.has(id)) {
      const suffix = key || fallback
      let n = 1
      do { id = `${base}~${suffix}${n > 1 ? `~${n}` : ''}`; n++ } while (used.has(id))
    }
    used.add(id)
    return { id, key: key || id, run }
  })
}

function summaryOf(id, key, run) {
  const findings = Array.isArray(run.findings) ? run.findings.filter(isObj) : []
  const counts = { fail: 0, warn: 0, pass: 0, total: findings.length }
  for (const f of findings) counts[normSeverity(f.severity)]++
  return {
    id,
    key,
    status: String(run.status || 'unknown'),
    trigger: String(run.trigger || ''),
    turn: typeof run.turn === 'number' ? run.turn : null,
    sessionId: run.sessionId ? String(run.sessionId) : null,
    startedAt: timeOf(run.startedAt),
    finishedAt: timeOf(run.finishedAt),
    counts,
  }
}

export function reviewSummariesOf(raw) {
  return collectRuns(raw)
    .map(({ id, key, run }) => summaryOf(id, key, run))
    .sort((a, b) => (b.finishedAt || b.startedAt) - (a.finishedAt || a.startedAt))
}

export function reviewRunOf(raw, id) {
  const wanted = String(id ?? '').trim()
  if (!wanted) return null
  const hit = collectRuns(raw).find((r) => r.id === wanted || r.key === wanted)
  if (!hit) return null
  const { raw: _raw, ...rest } = hit.run
  return redactSensitive({ ...rest, id: hit.id, key: hit.key })
}
