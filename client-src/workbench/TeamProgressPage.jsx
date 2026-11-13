import React, { useMemo, useState } from 'react'
import { Badge, Button, EmptyState, Panel, StatusMessage } from './components/ui.jsx'

function graphLayout(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const depthCache = new Map()
  const depthOf = (task, visiting = new Set()) => {
    if (depthCache.has(task.id)) return depthCache.get(task.id)
    if (visiting.has(task.id)) return 0
    const nextVisiting = new Set(visiting).add(task.id)
    const dependencies = Array.isArray(task.blockedBy) ? task.blockedBy.map((id) => byId.get(id)).filter(Boolean) : []
    const depth = dependencies.length ? Math.min(6, 1 + Math.max(...dependencies.map((dep) => depthOf(dep, nextVisiting)))) : 0
    depthCache.set(task.id, depth)
    return depth
  }
  const columns = []
  for (const task of tasks) {
    const depth = depthOf(task)
    columns[depth] ||= []
    columns[depth].push(task)
  }
  columns.forEach((column) => column?.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true })))
  const position = new Map()
  columns.forEach((column, col) => column?.forEach((task, row) => position.set(task.id, { x: col * 228, y: row * 96 })))
  const width = Math.max(228, columns.length * 228)
  const height = Math.max(180, ...columns.map((col) => col?.length * 96 || 0))
  return { columns, position, width, height, byId }
}

const STATE_TONE = { completed: 'good', failed: 'bad', blocked: 'warn', in_progress: 'default', claimed: 'default', pending: 'default' }

export function TeamProgressPage({ view, openMemberSession, memberOpenAvailable }) {
  const [mode, setMode] = useState('graph')
  const [memberError, setMemberError] = useState(null)
  const tasks = view.team.tasks
  const layout = useMemo(() => graphLayout(tasks), [tasks])
  const openMember = async (member) => {
    try {
      await openMemberSession(member)
      setMemberError(null)
    } catch (error) {
      setMemberError({ member, message: error?.message || '无法打开该成员会话。' })
    }
  }
  return <div className="sci-stack">
    <div className="sci-stat-row">
      <div className="sci-stat"><strong>{view.team.counts.running}</strong><span>运行中</span></div><div className="sci-stat"><strong>{view.team.counts.waiting}</strong><span>等待中</span></div><div className="sci-stat"><strong>{view.team.counts.completed}</strong><span>已完成</span></div><div className="sci-stat"><strong>{view.team.counts.blocked}</strong><span>受阻</span></div>
    </div>
    <Panel title="研究团队" subtitle="成员状态和当前负责的任务。点击成员可查看对应会话。">
      {memberError && <StatusMessage tone="error"><b>{memberError.member.name || '成员'}会话未能打开。</b><div>{memberError.message}</div><div className="sci-result-actions"><Button small onClick={() => openMember(memberError.member)}>重试</Button><Button small onClick={() => setMemberError(null)}>关闭提示</Button></div></StatusMessage>}
      {view.team.members.length ? <div className="sci-members">{view.team.members.map((member) => <div className="sci-member" key={member.name}>
        <div className="sci-result-top"><h3>{view.experts.roles?.[member.role]?.label || member.role || member.name}</h3><Badge tone={member.liveStatusTone}>{member.liveStatusLabel}</Badge></div>
        <p>{member.currentTasks.length ? member.currentTasks.map((task) => task.subject || task.id).join('；') : '当前没有进行中的任务'}</p>
        {member.lastReport && <p><b>最近回报：</b>{member.lastReport}</p>}
        {memberOpenAvailable && <div className="sci-result-actions"><Button small onClick={() => openMember(member)}>打开成员会话</Button></div>}
      </div>)}</div> : <EmptyState title="团队尚未启动">开始细化已确认的研究结果后，团队任务会显示在这里。</EmptyState>}
    </Panel>
    <Panel title="执行任务" subtitle="依赖线从上游任务指向等待它完成的任务。" action={<div className="sci-result-actions"><Button small onClick={() => setMode('graph')} aria-pressed={mode === 'graph'}>依赖图</Button><Button small onClick={() => setMode('list')} aria-pressed={mode === 'list'}>列表</Button></div>}>
      {tasks.length === 0 ? <div className="sci-small">还没有记录的执行任务。</div> : mode === 'list' ? <div className="sci-task-list">{tasks.map((task) => <div className="sci-task-row" key={task.id}><div><b>{task.subject || task.id}</b><div className="sci-small">{task.description || task.resultIds.join('、') || '未关联研究结果'}</div></div><div>{task.assignee || '未分配'}</div><Badge tone={STATE_TONE[task.status]}>{task.label}</Badge>{task.blockers.length > 0 && <div className="sci-small">阻塞：{task.blockers.join('；')}</div>}</div>)}</div> : <div className="sci-task-graph"><div className="sci-task-canvas" style={{ width: layout.width, height: layout.height }}>
        <svg className="sci-task-lines" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">{tasks.flatMap((task) => (task.blockedBy || []).map((id) => {
          const from = layout.position.get(id), to = layout.position.get(task.id)
          if (!from || !to) return null
          const startX = from.x + 188, startY = from.y + 36, endX = to.x, endY = to.y + 36, bend = Math.max(22, (endX - startX) / 2)
          return <path className="sci-task-line" key={`${id}-${task.id}`} d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`} markerEnd="url(#sci-arrow)" />
        }))}<defs><marker id="sci-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="currentColor" /></marker></defs></svg>
        {tasks.map((task) => { const point = layout.position.get(task.id); return <div key={task.id} className="sci-task-node" style={{ left: point.x, top: point.y }}><strong>{task.subject || task.id}</strong><span>{task.assignee || '未分配'} · {task.label}</span>{task.resultIds.length > 0 && <span>{task.resultIds.join('、')}</span>}</div> })}
      </div></div>}
    </Panel>
    {view.team.blockedTasks.length > 0 && <Panel title="受阻事项" subtitle="只列出明确的未完成依赖或被标记为阻塞的任务。"><div className="sci-task-list">{view.team.blockedTasks.map((task) => <div className="sci-task-row" key={task.id}><b>{task.subject || task.id}</b><span className="sci-small">{task.blockers.join('；')}</span><Badge tone="warn">受阻</Badge></div>)}</div></Panel>}
    <Panel title="最近回报">{view.team.activity.length ? <div className="sci-task-list">{view.team.activity.map((item) => <div className="sci-task-row" key={item.id}><b>{item.summary}</b><span className="sci-small">{item.resultIds.length ? `关联结果：${item.resultIds.join('、')}` : '未关联结果'}</span><span className="sci-small">{item.at ? new Date(item.at).toLocaleString() : '时间未记录'}</span></div>)}</div> : <div className="sci-small">暂无成员回报。</div>}</Panel>
  </div>
}
