/** Return a bounded preview without changing the original collection. */
export function visibleItems(items, expanded = false, limit = 5) {
  const rows = Array.isArray(items) ? items : []
  const safeLimit = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : 5
  return expanded ? rows : rows.slice(0, safeLimit)
}
