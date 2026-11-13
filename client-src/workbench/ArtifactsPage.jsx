import React, { useState } from 'react'
import { Badge, Button, EmptyState, Panel } from './components/ui.jsx'
import { visibleItems } from './bounded-list.js'

const ARTIFACT_PREVIEW_LIMIT = 5

function timestampLabel(value) {
  const time = Number(value || 0)
  return Number.isFinite(time) && time > 0 ? new Date(time).toLocaleString() : '时间未记录'
}

function retryUrl(url, attempt) {
  if (!url || !attempt) return url
  return `${url}${url.includes('?') ? '&' : '?'}previewAttempt=${attempt}`
}

function ImagePreview({ figure, compact = false }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retry = () => { setFailed(false); setAttempt((value) => value + 1) }
  if (!figure.previewable || !figure.url || failed) {
    return <div className="sci-image-fallback sci-empty" role={failed ? 'alert' : 'status'} style={{ minHeight: compact ? 180 : 260 }}>
      <b>{failed ? '图片未能加载' : '此文件不适合内嵌预览'}</b>
      <span className="sci-small">{failed ? '文件可能不存在、格式不受浏览器支持，或当前工作区无法读取。' : figure.path?.split('.').pop()?.toUpperCase() || '文件'}</span>
      <div className="sci-result-actions">
        {figure.previewable && figure.url && <Button small onClick={retry}>重新加载</Button>}
        {figure.url && <a className="sci-button sci-button-small" href={figure.url} target="_blank" rel="noreferrer">打开原文件</a>}
      </div>
    </div>
  }
  return <img
    key={attempt}
    className={compact ? 'sci-figure-image-compact' : 'sci-figure-image-large'}
    src={retryUrl(figure.url, attempt)}
    alt={figure.title}
    loading={compact ? 'lazy' : undefined}
    onError={() => setFailed(true)}
    style={compact
      ? { width: '100%', height: 180, objectFit: 'contain', background: 'var(--sci-raised)', display: 'block' }
      : { maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto', objectFit: 'contain' }}
  />
}

function FigureCard({ figure, previous, onOpen, onCompare }) {
  const audit = figure.audit?.overallStatus || figure.audit?.status
  const manual = audit === 'approved' ? '人工终审已批准' : audit === 'ready-for-manual-review' ? '等待人工终审' : audit ? `前检状态：${audit}` : '尚无前检记录'
  const dimensions = figure.width && figure.height ? `${figure.width} × ${figure.height}${figure.unit ? ` ${figure.unit}` : ''}` : figure.dimensions || '尺寸未记录'
  const previousLabel = figure.previousVersionRelation === 'recorded' ? '上一登记版本' : '可能的上一条同名记录（推测）'
  return <article className="sci-figure">
    <div className="sci-figure-preview" role="group" aria-label={`图件预览：${figure.title}`} style={{ width: '100%', padding: 0, color: 'inherit', textAlign: 'left', font: 'inherit' }}>
      <ImagePreview figure={figure} compact />
      <div className="sci-figure-copy"><strong>{figure.title}</strong><span>{figure.resultId || '未关联研究结果'} · {figure.version ? `版本 ${figure.version}` : '版本未记录'}</span><span>{dimensions} · {manual}</span></div>
    </div>
    {previous && <div className="sci-figure-history"><span>{previousLabel}：{previous.version ? `版本 ${previous.version}` : previous.title}</span><span>{timestampLabel(previous.registeredAt || previous.createdAt)}</span></div>}
    <div className="sci-result-actions sci-figure-actions">
      <Button small onClick={() => onOpen(figure)}>放大查看</Button>
      {previous && <Button small onClick={() => onCompare({ current: figure, previous })}>{figure.previousVersionRelation === 'recorded' ? '对比上一版本' : '对比上一条记录'}</Button>}
      {figure.url && <a className="sci-button sci-button-small" href={figure.url} target="_blank" rel="noreferrer">打开文件</a>}
    </div>
  </article>
}

function FileGroup({ group }) {
  const [expanded, setExpanded] = useState(false)
  const items = visibleItems(group.items, expanded, ARTIFACT_PREVIEW_LIMIT)
  return <div className="sci-group"><h3>{group.label} <span className="sci-small">共 {group.items.length} 项</span></h3>{group.items.length ? <><div className="sci-file-list">{items.map((file) => <div className="sci-file" key={file.path}><div><strong>{file.path.split(/[\\/]/).pop() || file.path}</strong><span className="sci-small">{file.path}</span></div><a className="sci-button sci-button-small" href={file.url} target="_blank" rel="noreferrer">打开</a></div>)}</div>{group.items.length > ARTIFACT_PREVIEW_LIMIT && <button type="button" className="sci-button sci-button-small" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? '收起' : `查看全部 ${group.items.length} 项`}</button>}</> : <div className="sci-small">暂无{group.label}。</div>}</div>
}

function ReviewGroup({ reviews }) {
  const [expanded, setExpanded] = useState(false)
  const items = visibleItems(reviews, expanded, ARTIFACT_PREVIEW_LIMIT)
  return <div className="sci-group"><h3>审查记录 <span className="sci-small">共 {reviews.length} 条</span></h3>{reviews.length ? <><div className="sci-task-list">{items.map((review) => <div className="sci-task-row" key={review.runId || review.id || JSON.stringify(review)}><div><b>{review.resultTitle || review.scope || review.runId || '主张审查'}</b><div className="sci-small">{review.message || review.summary || '摘要未提供'}</div></div><Badge tone={review.severity === 'fail' ? 'bad' : review.severity === 'warn' ? 'warn' : 'default'}>{review.severity || '状态待核对'}</Badge></div>)}</div>{reviews.length > ARTIFACT_PREVIEW_LIMIT && <button type="button" className="sci-button sci-button-small" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? '收起' : `查看全部 ${reviews.length} 条`}</button>}</> : <div className="sci-small">暂无审查记录。</div>}</div>
}

function FigureDialog({ figure, onClose }) {
  return <div className="sci-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="sci-modal" role="dialog" aria-modal="true" aria-label={`图件预览：${figure.title}`}>
      <div className="sci-panel-heading"><div><h2>{figure.title}</h2><p>{figure.resultId || '未关联研究结果'}</p></div><Button onClick={onClose}>关闭</Button></div>
      <ImagePreview figure={figure} />
      <div className="sci-small" style={{ marginTop: 12 }}>{figure.version ? `登记版本 ${figure.version}` : '登记版本未记录'} · {timestampLabel(figure.registeredAt || figure.createdAt)} · {figure.path || '文件路径未记录'}</div>
    </section>
  </div>
}

function FigureCompareDialog({ comparison, onClose }) {
  const { current, previous } = comparison
  const inferred = current.previousVersionRelation !== 'recorded'
  return <div className="sci-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="sci-modal sci-modal-wide" role="dialog" aria-modal="true" aria-label={`图件版本对比：${current.title}`}>
      <div className="sci-panel-heading"><div><h2>图件版本对比</h2><p>{inferred ? '上一条记录按同一研究结果、同名文件和时间顺序推测；后端未记录版本关系。' : '上一版本来自后端登记的 prevId 版本链。'}</p></div><Button onClick={onClose}>关闭</Button></div>
      <div className="sci-compare-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        {[previous, current].map((figure, index) => <article className="sci-compare-item" key={figure.id || figure.path}>
          <h3>{index === 0 ? inferred ? '较早的同名记录（推测）' : '上一登记版本' : '当前记录'}</h3>
          <div className="sci-small">{figure.version ? `版本 ${figure.version}` : '版本未记录'} · {timestampLabel(figure.registeredAt || figure.createdAt)}</div>
          <ImagePreview figure={figure} />
          <div className="sci-small">{figure.path || '文件路径未记录'}</div>
        </article>)}
      </div>
    </section>
  </div>
}

export function ArtifactsPage({ view, onAction }) {
  const [preview, setPreview] = useState(null)
  const [comparison, setComparison] = useState(null)
  const figures = view.artifacts.figures
  const figureById = new Map(figures.filter((figure) => figure.id).map((figure) => [figure.id, figure]))
  return <div className="sci-stack">
    <Panel title="图表" subtitle="图件会在浏览器实际加载成功后显示；加载失败时可重试或直接打开文件。登记过版本关系的图件可并排比较。" action={<Button primary onClick={() => onAction('draw', view.paper.results.find((item) => item.confirmed)?.id || null)} disabled={!view.paper.results.some((item) => item.confirmed && view.paper.core.confirmed)} title={!view.paper.results.some((item) => item.confirmed && view.paper.core.confirmed) ? '先确认核心结论和一项研究结果，再建立正式绘图计划。' : undefined}>基于现有结果开始绘图</Button>}>
      {figures.length ? <div className="sci-gallery">{figures.map((figure) => <FigureCard key={figure.id || figure.path} figure={figure} previous={figureById.get(figure.previousVersionId)} onOpen={setPreview} onCompare={setComparison} />)}</div> : <EmptyState title="还没有登记图件">基于已确认的核心结论和研究结果建立绘图计划后，图件会出现在这里。</EmptyState>}
    </Panel>
    <Panel title="其他成果" subtitle="按用途分组浏览工作区文件。">
      {view.artifacts.groups.filter((group) => group.id !== 'figures').map((group) => <FileGroup key={group.id} group={group} />)}
      <ReviewGroup reviews={view.artifacts.reviews} />
    </Panel>
    <div className="sci-result-actions"><Button onClick={() => onAction('write')}>撰写论文</Button><Button onClick={() => onAction('slides')}>制作汇报 PPT</Button></div>
    {preview && <FigureDialog key={preview.id || preview.path} figure={preview} onClose={() => setPreview(null)} />}
    {comparison && <FigureCompareDialog key={`${comparison.previous.id}:${comparison.current.id}`} comparison={comparison} onClose={() => setComparison(null)} />}
  </div>
}
