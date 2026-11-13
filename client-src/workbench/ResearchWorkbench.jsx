import React, { useState } from 'react'
import { buildWorkflowRequest, submitWorkflowRequest } from './workflow-actions.js'
import { WorkbenchStyles } from './styles.js'
import { ActionDialog, Badge, Button, Panel, StatusMessage } from './components/ui.jsx'
import { PaperSpinePage } from './PaperSpinePage.jsx'
import { TeamProgressPage } from './TeamProgressPage.jsx'
import { ArtifactsPage } from './ArtifactsPage.jsx'
import { ExpertSetupPage } from './ExpertSetupPage.jsx'
import { useWorkbenchState } from './use-workbench-state.js'

const NAV = [
  { id: 'paper', label: '论文主线' },
  { id: 'team', label: '团队进展' },
  { id: 'artifacts', label: '图表与成果' },
  { id: 'experts', label: '专家配置' },
]

function WorkbenchMark() {
  return <span className="sci-wb-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6.2l-5.3 9.1A2.5 2.5 0 0 0 6.9 22h10.2a2.5 2.5 0 0 0 2.2-3.7L14 9.2V3"/><path d="M8 15h8M9.4 12.5h5.2"/></svg></span>
}

export function ResearchWorkbench({ services }) {
  const state = useWorkbenchState()
  const [page, setPage] = useState('paper')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')

  const openAction = (action, targetId = null) => {
    setError(null)
    setDialog({ action, targetId })
  }
  const openConversation = () => services?.openConversation?.()
  const submitAction = async (values) => {
    if (!dialog || busy || !state.raw) return
    const built = buildWorkflowRequest({ action: dialog.action, paperState: state.raw.blueprint || {}, targetId: dialog.targetId, userInput: values })
    if (!built.ok) { setError(built.error); return }
    setBusy(true); setError(null)
    try {
      const session = await services?.getCurrentSession?.()
      const result = await submitWorkflowRequest({ session, request: built.request })
      if (!result.ok) { setError(result); return }
      setDialog(null)
      setToast('请求已提交到当前对话；研究状态会在后端记录更新后刷新。')
      window.setTimeout(() => setToast(''), 5200)
      await state.refresh()
    } catch (errorValue) {
      setError({ message: '无法提交到当前对话。', recovery: '确认 DSH 会话仍然打开后，可以安全重试。', detail: errorValue.message })
    } finally { setBusy(false) }
  }
  const copyDiagnostic = async (detail) => {
    try { await navigator.clipboard.writeText([detail.message, detail.recovery, detail.detail].filter(Boolean).join('\n')) } catch { /* clipboard is optional */ }
  }

  const currentView = state.view
  return <div className="sci-workbench">
    <WorkbenchStyles />
    <div className="sci-wb-shell">
      <header className="sci-wb-header">
        <div className="sci-wb-brand"><WorkbenchMark /><div><h1>科研工作台</h1><div className="sci-wb-subtitle">{currentView ? currentView.paper.title : '论文主线 · 团队进展 · 科研成果'}</div></div></div>
        <div className="sci-wb-head-actions">{currentView && <Badge>{currentView.paper.stageLabel}</Badge>}<Button onClick={openConversation}>打开对话</Button></div>
      </header>
      <main className="sci-wb-content">
        <nav className="sci-wb-nav" aria-label="科研工作台页面">{NAV.map((item) => <button key={item.id} type="button" aria-current={page === item.id ? 'true' : undefined} onClick={() => setPage(item.id)}>{item.label}</button>)}</nav>
        {state.loading && !currentView ? <Panel><div className="sci-empty"><div><h2>正在读取研究状态</h2><p>工作台从当前 DSH 项目读取论文蓝图、团队任务和已登记成果。</p></div></div></Panel> : state.error && !currentView ? <Panel title="暂时无法读取工作台状态"><StatusMessage tone="error">{state.error}<div className="sci-result-actions"><Button onClick={state.refresh}>重新读取</Button><Button onClick={openConversation}>打开对话</Button></div></StatusMessage></Panel> : currentView && <>
          {page === 'paper' && <PaperSpinePage view={currentView} raw={state.raw} onAction={openAction} onOpenConversation={openConversation} onNavigate={setPage} />}
          {page === 'team' && <TeamProgressPage view={currentView} openMemberSession={services?.openMemberSession} memberOpenAvailable={services?.memberOpenAvailable?.(currentView)} />}
          {page === 'artifacts' && <ArtifactsPage view={currentView} onAction={openAction} />}
          {page === 'experts' && <ExpertSetupPage view={currentView} refresh={state.refresh} />}
          {state.error && <div className="sci-small" style={{ marginTop: 14 }} role="status">状态刷新失败，正在显示上一次成功读取的数据：{state.error}</div>}
        </>}
      </main>
    </div>
    {dialog && <ActionDialog action={dialog.action} target={dialog.targetId && currentView?.paper.results.find((result) => result.id === dialog.targetId)} onClose={() => { if (!busy) { setDialog(null); setError(null) } }} onSubmit={submitAction} busy={busy} error={error} onOpenConversation={openConversation} onCopyDiagnostic={copyDiagnostic} />}
    {toast && <div className="sci-toast" role="status">{toast}<div className="sci-result-actions"><Button small onClick={openConversation}>打开对话</Button><Button small onClick={() => setToast('')}>关闭</Button></div></div>}
  </div>
}
