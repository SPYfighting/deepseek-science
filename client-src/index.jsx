// DSH host adapter: the main workbench owns the full page; the right rail keeps a compact companion view.
import React from 'react'
import { ResearchWorkbench } from './workbench/ResearchWorkbench.jsx'
import { QuickWorkbench } from './workbench/QuickWorkbench.jsx'
import { registerGuardedPart, WORKBENCH_REQUIRED_SERVICES } from './workbench/host-adapter.js'

export const inject = [...WORKBENCH_REQUIRED_SERVICES]

const PANEL_ID = 'dsh-science/workbench'

function service(ctx, name) {
  try { return ctx.get(name) } catch { return undefined }
}

function currentSessionId(sessions) {
  try {
    const snapshot = sessions?.list?.getSnapshot?.()
    const main = Object.values(snapshot?.byId || {}).find((row) => row?.retainedBy && (row.retainedBy.mainView || 0) > 0)
    if (main?.id) return main.id
    return typeof snapshot?.current === 'string' ? snapshot.current : undefined
  } catch { return undefined }
}

function makeServices(ctx) {
  const getCurrentSession = () => {
    const sessions = service(ctx, 'sessions') || ctx.sessions
    const id = currentSessionId(sessions)
    if (!id || typeof sessions?.binding !== 'function') return undefined
    try { return sessions.binding(id)?.session } catch { return undefined }
  }
  const openConversation = () => {
    const layout = service(ctx, 'layout') || ctx.layout
    if (typeof layout?.selectPanel !== 'function') throw new Error('当前 DSH 不支持切换到对话面板。')
    layout.selectPanel(null)
  }
  const openWorkbench = () => {
    const layout = service(ctx, 'layout') || ctx.layout
    layout?.selectPanel?.(PANEL_ID)
  }
  const openMemberSession = (member) => {
    const workspace = service(ctx, 'uiWorkspace')
    if (typeof workspace?.openSession !== 'function') throw new Error('当前 DSH 不支持打开成员会话。')
    if (!member?.childId) throw new Error('该成员没有记录可打开的会话。')
    const sessions = service(ctx, 'sessions') || ctx.sessions
    const parentSessionId = member.parentSessionId || currentSessionId(sessions)
    if (!parentSessionId) throw new Error('无法确定成员会话所属的项目会话。')
    workspace.openSession({ parentSessionId, childSessionId: member.childId, mode: 'continuable' })
  }
  const memberOpenAvailable = (view) => {
    const workspace = service(ctx, 'uiWorkspace')
    const sessions = service(ctx, 'sessions') || ctx.sessions
    return typeof workspace?.openSession === 'function' && Boolean(currentSessionId(sessions) || view?.team?.members?.some((member) => member.parentSessionId && member.childId))
  }
  return { getCurrentSession, openConversation, openWorkbench, openMemberSession, memberOpenAvailable }
}

function WorkbenchIcon({ size = 22, active = false }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-active={active || undefined}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>
}

export function apply(ctx) {
  let mount
  try {
    mount = window.__DSH_SCIENCE_CLIENT_MOUNT__ || null
    if (!mount) window.__DSH_SCIENCE_CLIENT_MOUNT__ = mount = { main: false, panelIcon: false, quick: false, tab: false }
  } catch { mount = { main: false, panelIcon: false, quick: false, tab: false } }
  const services = makeServices(ctx)

  ctx.effect(() => registerGuardedPart(mount, 'main', () => ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: PANEL_ID, inject: () => ({ services }),
  }, ResearchWorkbench))), 'dsh-science main workbench')

  ctx.effect(() => registerGuardedPart(mount, 'panelIcon', () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: () => '科研工作台',
  }, WorkbenchIcon))), 'dsh-science global panel entry')

  const tabs = service(ctx, 'sidebarRightTabs') || ctx.sidebarRightTabs
  if (tabs && typeof tabs.register === 'function') {
    ctx.effect(() => registerGuardedPart(mount, 'tab', () => tabs.register({
      id: PANEL_ID,
      kind: 'workbench',
      title: () => '科研工作台',
      guide: [{ id: 'workbench', order: 10, title: () => '科研工作台', description: () => '显示研究阶段、下一步建议和团队运行状态。打开完整工作台可查看论文主线、团队进展、图表成果与专家配置。' }],
    })), 'dsh-science right-rail tab')

    ctx.effect(() => registerGuardedPart(mount, 'quick', () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: PANEL_ID, inject: () => ({ services }),
    }, QuickWorkbench))), 'dsh-science right-rail companion')
  }
}
