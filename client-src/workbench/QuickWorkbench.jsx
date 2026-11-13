import React, { useState } from 'react'
import { buildWorkflowRequest, submitWorkflowRequest } from './workflow-actions.js'
import { WorkbenchStyles } from './styles.js'
import { Button, Panel, StatusMessage } from './components/ui.jsx'
import { useWorkbenchState } from './use-workbench-state.js'

export function QuickWorkbench({ services }) {
  const state = useWorkbenchState(8000)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const view = state.view
  const submitNext = async () => {
    if (!view || busy) return
    const step = view.paper.nextStep
    if (!step.action) { setMessage('请打开完整工作台查看当前建议。'); return }
    if (step.action === 'explore') { setMessage('请打开完整工作台填写研究问题后再开始探索。'); services?.openWorkbench?.(); return }
    const built = buildWorkflowRequest({ action: step.action, paperState: state.raw?.blueprint || {}, targetId: step.targetId })
    if (!built.ok) { setMessage(built.error.message); services?.openWorkbench?.(); return }
    setBusy(true); setMessage('')
    try {
      const session = await services?.getCurrentSession?.()
      const result = await submitWorkflowRequest({ session, request: built.request })
      setMessage(result.ok ? '请求已提交到当前对话。' : `${result.message} ${result.recovery}`)
      if (result.ok) await state.refresh()
    } finally { setBusy(false) }
  }
  return <div className="sci-workbench sci-quick"><WorkbenchStyles /><Panel title="科研工作台" subtitle={view ? `当前阶段：${view.paper.stageLabel}` : '论文进度与下一步操作'}>
    {state.error && !view ? <StatusMessage tone="error">{state.error}<Button small onClick={state.refresh}>重新读取</Button></StatusMessage> : view ? <>
      <h2 className="sci-title">{view.paper.title}</h2>
      <div className="sci-small">{view.paper.totalResults} 项结果 · {view.team.counts.running} 项运行中 · {view.team.counts.blocked} 项受阻</div>
      <hr className="sci-rule" /><b>{view.paper.nextStep.label}</b>
      <div className="sci-result-actions"><Button primary small onClick={submitNext} disabled={busy}>{busy ? '正在提交…' : '继续下一步'}</Button><Button small onClick={() => services?.openWorkbench?.()}>打开完整工作台</Button></div>
      {message && <div className="sci-small" role="status">{message}</div>}
    </> : <div className="sci-small">正在读取状态…</div>}
  </Panel></div>
}
