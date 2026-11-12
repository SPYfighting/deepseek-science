// dsh-science — 蓝图主张级审查覆盖
// 把 reviews.json 里 check="blueprint-claim" 的 findings 对回蓝图 core/results，
// 让 sci_blueprint_overview / /state 能回答"哪些已确认主张被审过、最近结论是什么"。
// 匹配策略：先按归一化文本（NFKC + 空白折叠）精确匹配，再退化为 ≥12 字符的唯一包含匹配
// （审查器可能截断长 claim）；文本无解或歧义时才用 core/res-N 前缀兜底；都不命中则不匹配。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirOf } from './store.js'

const CLAIM_CHECK = 'blueprint-claim'
const MIN_CONTAIN_LEN = 12
const SEV_RANK = { pass: 0, warn: 1, fail: 2 }
const SEV_ALIASES = {
  pass: 'pass', ok: 'pass', success: 'pass', passed: 'pass',
  warn: 'warn', warning: 'warn', medium: 'warn',
  fail: 'fail', error: 'fail', fatal: 'fail', critical: 'fail', high: 'fail',
}

export function normSeverity(raw) {
  const key = String(raw ?? '').trim().toLowerCase()
  return SEV_ALIASES[key] || 'warn'
}

function normText(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

// finishedAt 可能是毫秒数，也可能是 ISO 字符串；无法解析按 0（最旧）。
function timeOf(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
  }
  return 0
}

function idPrefixOf(raw) {
  const m = /^\s*(core|res-\d+)\s*(?:[:：\-–—]\s*|\s+)/i.exec(String(raw ?? ''))
  if (!m) return null
  return /^core$/i.test(m[1]) ? 'core' : m[1].toLowerCase()
}

export function readReviewsSafe() {
  try {
    const file = join(dataDirOf(), 'reviews.json')
    if (!existsSync(file)) return {}
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function runsOf(reviews) {
  const vals = Array.isArray(reviews)
    ? reviews
    : reviews && typeof reviews === 'object'
      ? Object.values(reviews)
      : []
  return vals
    .filter((r) => r && typeof r === 'object' && Array.isArray(r.findings))
    .sort((a, b) => timeOf(a.finishedAt ?? a.startedAt) - timeOf(b.finishedAt ?? b.startedAt))
}

// 文本匹配优先：claim 文本以 "Core …" 开头时不能被 core 前缀劫持（H1）。
// 文本精确/包含命中不唯一时，才用 res-N/core 前缀消歧；仍无解 → 不匹配。
function matchTargetId(claimRaw, targets) {
  const token = String(claimRaw ?? '').trim().toLowerCase()
  if (token) {
    const aliasHits = targets.filter((t) => (t.aliases || []).some((alias) => String(alias).toLowerCase() === token))
    if (aliasHits.length === 1) return aliasHits[0].id
  }
  const n = normText(claimRaw)
  if (n) {
    const exact = targets.filter((t) => (t.norms || [t.norm]).includes(n))
    if (exact.length === 1) return exact[0].id
    if (exact.length === 0 && n.length >= MIN_CONTAIN_LEN) {
      const hits = targets.filter(
        (t) => (t.norms || [t.norm]).some((norm) => norm.length >= MIN_CONTAIN_LEN && (norm.includes(n) || n.includes(norm))),
      )
      if (hits.length === 1) return hits[0].id
    }
  }
  const byId = idPrefixOf(claimRaw)
  if (byId && targets.some((t) => t.id === byId)) return byId
  return null
}

// reviews 接受 reviews.json 的对象形态或数组形态；损坏/缺失一律按"无审查"处理。
export function reviewCoverageOf(bp, reviews) {
  const coreClaim = bp && bp.core && String(bp.core.claim ?? '').trim()
  const results = bp && Array.isArray(bp.results) ? bp.results.filter(Boolean) : []
  const targets = []
  if (coreClaim) {
    const revision = Math.max(1, Number(bp.core.revision) || 1)
    targets.push({ id: 'core', claim: coreClaim, norm: normText(coreClaim), norms: [normText(coreClaim)], aliases: [`core@r${revision}`, 'core'], revisionId: `core-r${revision}`, confirmed: bp.core.confirmed === true })
  }
  for (const r of results) {
    const claim = String(r.claim ?? '').trim()
    if (!claim) continue
    const revision = Math.max(1, Number(r.revision) || 1)
    const nested = (Array.isArray(r.claims) ? r.claims : []).filter((c) => c && c.status !== 'retired' && String(c.text || '').trim())
    targets.push({
      id: r.id, claim, norm: normText(claim),
      norms: [...new Set([normText(claim), ...nested.map((c) => normText(c.text)).filter(Boolean)])],
      aliases: [...new Set([`${r.id}@r${revision}`, r.id, ...nested.flatMap((c) => [`${c.id}@r${Math.max(1, Number(c.revision) || 1)}`, c.id])])],
      revisionId: `${r.id}-r${revision}`,
      confirmed: r.confirmed === true, status: r.status || 'planned',
    })
  }

  // runs 按时间升序；同一主张后审覆盖先审。同一 run 内取最严重结论（fail > warn > pass）。
  const picked = new Map()
  for (const run of runsOf(reviews)) {
    const perId = new Map()
    for (const f of run.findings) {
      if (!f || typeof f !== 'object') continue
      if (String(f.check ?? '').trim().toLowerCase() !== CLAIM_CHECK) continue
      const id = matchTargetId(f.claim, targets)
      if (!id) continue
      const severity = normSeverity(f.severity)
      const prev = perId.get(id)
      if (!prev || SEV_RANK[severity] > SEV_RANK[prev.severity]) {
        perId.set(id, { severity, message: String(f.message ?? '') })
      }
    }
    for (const [id, v] of perId) {
      picked.set(id, {
        ...v,
        runId: String(run.id ?? ''),
        reviewedAt: timeOf(run.finishedAt ?? run.startedAt),
      })
    }
  }

  const viewOf = (t) => {
    const p = picked.get(t.id)
    return {
      id: t.id,
      claim: t.claim,
      revisionId: t.revisionId || null,
      confirmed: t.confirmed,
      ...(t.status ? { status: t.status } : {}),
      severity: p ? p.severity : null,
      message: p ? p.message : '',
      runId: p ? p.runId : null,
      reviewedAt: p ? p.reviewedAt : 0,
    }
  }

  const resultViews = results.map((r) => {
    const t = targets.find((x) => x.id === r.id)
    if (t) return viewOf(t)
    return { id: r.id, claim: '', confirmed: r.confirmed === true, status: r.status || 'planned', severity: null, message: '', runId: null, reviewedAt: 0 }
  })
  const coreTarget = targets.find((t) => t.id === 'core')
  const core = coreTarget ? viewOf(coreTarget) : null

  const all = [...(core ? [core] : []), ...resultViews.filter((r) => r.claim)]
  const counts = { total: all.length, reviewed: 0, fail: 0, warn: 0, pass: 0, unreviewed: 0 }
  for (const v of all) {
    if (!v.severity) { counts.unreviewed++; continue }
    counts.reviewed++
    counts[v.severity]++
  }

  const warnings = []
  if (counts.total > 0 && counts.reviewed === 0) {
    warnings.push(`蓝图共 ${counts.total} 条主张，尚无审查记录（check=blueprint-claim）——用 /sci-review 或 sci_review_send scope=evidence 补一次主张级审查。`)
  }
  for (const v of all) {
    if (v.confirmed && v.severity === 'fail') {
      warnings.push(`${v.id} 的已确认主张在最近审查（${v.runId || '未记录'}）中判为 fail：${v.message || '（无说明）'}——先处理审查发现，再对外声称该结论。`)
    }
  }
  const confirmedUnreviewed = all.filter((v) => v.confirmed && !v.severity).map((v) => v.id)
  if (counts.reviewed > 0 && confirmedUnreviewed.length > 0) {
    warnings.push(`已确认主张 ${confirmedUnreviewed.join('、')} 尚未审查——先补审再推进写作。`)
  }
  return { core, results: resultViews, counts, warnings }
}
