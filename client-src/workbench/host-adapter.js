// DSH 0.2.2 Cordis injection uses service IDs rather than npm package names.
// Verified against test-env client typings and exports for the required services.
export const WORKBENCH_REQUIRED_SERVICES = Object.freeze([
  'slots',
  'sessions',
  'layout',
  'sidebarRightTabs',
  'uiWorkspace',
])

/** Keep each host registration idempotent across client hot reloads. */
export function registerGuardedPart(mount, part, register) {
  const state = mount && typeof mount === 'object' ? mount : {}
  if (state[part]) return () => {}
  const dispose = register()
  state[part] = true
  return () => {
    state[part] = false
    if (typeof dispose === 'function') dispose()
  }
}
