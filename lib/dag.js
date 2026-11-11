// dsh-science — 任务 DAG 纯函数（client 依赖聚焦 + 单测共用）。
// blockedBy 数据可能含空串/非字符串/重复/自环（历史数据或手写 team.json），统一在此归一。

export function normalizedBlockedBy(task) {
  const raw = task && Array.isArray(task.blockedBy) ? task.blockedBy : []
  const self = task && typeof task.id === 'string' ? task.id.trim() : null
  const out = []
  const seen = new Set()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || id === self || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

// 任务板归一：剔除 null/标量条目，blockedBy 统一为字符串数组（client 列表/DAG 共用）。
export function normalizeTaskBoard(tasks) {
  const list = Array.isArray(tasks) ? tasks : []
  return list
    .filter((t) => t && typeof t === 'object' && typeof t.id === 'string')
    .map((t) => ({ ...t, blockedBy: normalizedBlockedBy(t) }))
}

// 上游（依赖闭包）+ 下游（被依赖闭包）+ 两者并集（含自身）。BFS 顺序、环安全。
export function dependencyClosure(startId, tasks) {
  const list = Array.isArray(tasks) ? tasks.filter((t) => t && typeof t.id === 'string') : []
  const byId = new Map(list.map((t) => [t.id, t]))
  const rev = new Map()
  for (const t of list) {
    for (const dep of normalizedBlockedBy(t)) {
      if (!rev.has(dep)) rev.set(dep, [])
      rev.get(dep).push(t.id)
    }
  }
  const upstream = []
  const downstream = []
  const related = new Set()
  if (!byId.has(startId)) return { upstream, downstream, related }
  related.add(startId)

  const walkUp = [startId]
  const seenUp = new Set([startId])
  for (let i = 0; i < walkUp.length; i++) {
    const t = byId.get(walkUp[i])
    for (const dep of normalizedBlockedBy(t)) {
      if (!byId.has(dep) || seenUp.has(dep)) continue
      seenUp.add(dep)
      upstream.push(dep)
      related.add(dep)
      walkUp.push(dep)
    }
  }

  const walkDown = [startId]
  const seenDown = new Set([startId])
  for (let i = 0; i < walkDown.length; i++) {
    for (const next of rev.get(walkDown[i]) || []) {
      if (seenDown.has(next)) continue
      seenDown.add(next)
      downstream.push(next)
      related.add(next)
      walkDown.push(next)
    }
  }
  return { upstream, downstream, related }
}
