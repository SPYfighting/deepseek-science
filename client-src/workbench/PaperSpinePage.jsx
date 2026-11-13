import React, { useState } from 'react'
import { Badge, Button, EmptyState, Panel, StageTrack } from './components/ui.jsx'
import { resultConfirmationGate } from './workflow-actions.js'

const READINESS_LABELS = [['scientific', '科学证据'], ['manuscript', '稿件就绪'], ['submission', '投稿就绪']]

function readinessText(value) {
  if (!value) return '待核对'
  if (value.state === 'ready' || value.state === 'completed') return '已具备'
  if (value.state === 'in_progress') return '进行中'
  return '待完善'
}

function ResultCard({ result, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const gate = resultConfirmationGate(result.coreConfirmed, result.confirmed)
  const gatesOpen = gate === null
  const unconfirmedReason = gate === 'core'
    ? '核心研究结论尚未确认；先确认核心结论后，才能细化正式任务或启动正式绘图。'
    : `“${result.title}”尚未确认；先确认该研究结果后，才能细化正式任务或启动正式绘图。`
  const run = (action) => onAction(action, result.id)
  return <article className="sci-result-card">
    <div className="sci-result-top"><div><h3>{result.title}</h3><div className="sci-small">{result.statusLabel} · {result.confirmed ? '当前修订已确认' : '待确认'}</div></div><Badge tone={result.confirmed ? 'good' : 'warn'}>{result.confirmed ? '已确认' : '待确认'}</Badge></div>
    {result.claim && <p className="sci-result-claim">{result.claim}</p>}
    <div className="sci-readiness" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>{READINESS_LABELS.map(([key, label]) => <div className="sci-readiness-item" key={key}><b>{label}</b><span>{readinessText(result.readiness?.[key])}</span></div>)}</div>
    {result.requiredItems.length > 0 && <div><b className="sci-small">必须处理</b><ul className="sci-note-list">{result.requiredItems.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {result.recommendedItems.length > 0 && <div><b className="sci-small">建议处理</b><ul className="sci-note-list">{result.recommendedItems.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div className="sci-result-actions">
      <Button small onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? '收起详情' : '查看详情'}</Button>
      <Button small onClick={() => run('optimize_structure')}>优化结构</Button>
      <Button small disabled={!gatesOpen} title={!gatesOpen ? unconfirmedReason : undefined} onClick={() => run('refine_tasks')}>细化任务</Button>
      <Button small disabled={!gatesOpen} title={!gatesOpen ? unconfirmedReason : undefined} onClick={() => run('draw')}>开始绘图</Button>
      {!result.confirmed && <Button small primary onClick={() => run('confirm')}>确认并继续</Button>}
    </div>
    {!gatesOpen && <div className="sci-small" role="note" style={{ marginTop: 8 }}>{unconfirmedReason}</div>}
    {expanded && <div className="sci-small" style={{ marginTop: 14 }}>
      <div><b>Result 编号：</b>{result.id}　<b>修订：</b>{result.revision || 1}</div>
      {result.purpose && <div><b>目的：</b>{result.purpose}</div>}
      {result.direction && <div><b>结果方向：</b>{result.direction}</div>}
      {result.notes && <div><b>备注：</b>{result.notes}</div>}
      {result.evidence?.length > 0 && <div><b>证据记录：</b>{result.evidence.map((row, index) => row?.title || row?.source || row?.sourceLocator || `证据 ${index + 1}`).join('；')}</div>}
      {result.references?.length > 0 && <div><b>参考文献：</b>{result.references.map((row) => row?.title || row?.doi || row?.id || '未命名文献').join('；')}</div>}
    </div>}
  </article>
}

export function PaperSpinePage({ view, raw, onAction, onOpenConversation, onNavigate }) {
  const paper = view.paper
  const hasSpine = Boolean(paper.core.claim || paper.results.length || paper.core.title)
  const nextStep = paper.nextStep
  const nextAction = () => nextStep.action ? onAction(nextStep.action, nextStep.targetId || null) : nextStep.page && onNavigate(nextStep.page)
  return <div className="sci-stack">
    <Panel className="sci-panel" title="研究阶段" subtitle={`当前阶段：${paper.stageLabel}${paper.venue ? ` · 目标期刊：${paper.venue}` : ''}`} action={<Button small onClick={onOpenConversation}>打开对话</Button>}>
      <StageTrack stages={paper.stages} />
      <div className="sci-small">{paper.totalResults ? `${paper.totalResults} 项研究结果 · ${paper.supportedResults} 项标记为“已获得支持”` : '尚未登记研究结果'}{paper.updatedAt ? ` · 最近更新 ${new Date(paper.updatedAt).toLocaleString()}` : ''}</div>
    </Panel>
    {!hasSpine ? <Panel className="sci-hero">
      <EmptyState title="开始一项研究">从一个研究问题开始，也可以先整理已经完成的结果。</EmptyState>
      <button type="button" className="sci-button sci-button-primary" onClick={() => onAction('explore')}>开始探索</button>
      <Button onClick={() => onAction('import_results')}>导入已有结果</Button>
      <div className="sci-step-row"><div className="sci-step"><b>1. 探索问题</b><span>澄清问题、已有证据与可行范围</span></div><div className="sci-step"><b>2. 组织结果</b><span>形成可核验的文章结构</span></div><div className="sci-step"><b>3. 执行与写作</b><span>确认后细化任务、分析和呈现</span></div></div>
    </Panel> : <div className="sci-grid">
      <div className="sci-col-8 sci-stack">
        <Panel title="核心研究结论" subtitle={paper.core.confirmed ? '当前修订已确认' : '候选结论仍待确认'} action={<Badge tone={paper.core.confirmed ? 'good' : 'warn'}>{paper.core.confirmed ? '已确认' : '待确认'}</Badge>}>
          <h2 className="sci-title">{paper.core.title || '尚未命名'}</h2>
          <p className="sci-copy">{paper.core.claim || '当前还没有核心结论候选。你可以先生成文章结构。'}</p>
          {paper.core.innovation && <p className="sci-small" style={{ marginTop: 10 }}>创新点：{paper.core.innovation}</p>}
          <div className="sci-result-actions"><Button primary onClick={() => onAction(paper.results.length ? 'optimize_structure' : 'generate_structure', 'core')}>{paper.results.length ? '优化结构' : '生成文章结构'}</Button>{!paper.core.confirmed && paper.core.claim && <Button onClick={() => onAction('confirm', 'core')}>确认并继续</Button>}</div>
        </Panel>
        <Panel title={`文章结构 · ${paper.totalResults} 项研究结果`} subtitle="每项结果都保留真实状态、证据缺口和确认闸门。">
          {paper.results.length ? <div className="sci-stack">{paper.results.map((result) => <ResultCard key={result.id} result={{ ...result, coreConfirmed: paper.core.confirmed }} onAction={onAction} />)}</div> : <div className="sci-small">还没有研究结果草案。生成文章结构后，候选结果会显示在这里。</div>}
        </Panel>
      </div>
      <aside className="sci-col-4 sci-stack">
        <Panel title="下一步建议" subtitle="根据当前保存状态生成">
          <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{nextStep.label}</h3>
          <Button primary onClick={nextAction}>继续下一步</Button>
        </Panel>
        <Panel title="近期活动">
          {view.team.activity.length ? <div className="sci-stack">{view.team.activity.slice(0, 4).map((row) => <div key={row.id} className="sci-small"><b>{row.summary}</b><div>{row.at ? new Date(row.at).toLocaleString() : '时间未记录'} · {row.status}</div></div>)}</div> : <div className="sci-small">暂无任务回报记录。</div>}
        </Panel>
        {view.team.blockedTasks.length > 0 && <Panel title="当前阻塞" subtitle={`${view.team.blockedTasks.length} 项任务有未完成依赖`}>
          <ul className="sci-note-list">{view.team.blockedTasks.slice(0, 5).map((task) => <li key={task.id}>{task.subject || task.id}：{task.blockers.join('；')}</li>)}</ul>
          <Button small onClick={() => onNavigate('team')}>查看团队进展</Button>
        </Panel>}
      </aside>
    </div>}
    <div className="sci-result-actions"><Button small onClick={() => onAction('literature')}>扩展文献探索</Button><Button small onClick={() => onAction('write')}>撰写论文</Button><Button small onClick={() => onNavigate('artifacts')}>查看图表与成果</Button></div>
  </div>
}
