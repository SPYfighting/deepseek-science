import React, { useEffect, useRef, useState } from 'react'

export function Button({ children, primary = false, small = false, quiet = false, ...props }) {
  return <button {...props} className={['sci-button', primary && 'sci-button-primary', small && 'sci-button-small', quiet && 'sci-button-quiet', props.className].filter(Boolean).join(' ')}>{children}</button>
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`sci-panel ${className}`}>
    {(title || subtitle || action) && <header className="sci-panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</header>}
    {children}
  </section>
}

export function Badge({ children, tone = 'default' }) {
  return <span className={`sci-badge ${tone === 'good' ? 'sci-badge-good' : tone === 'warn' ? 'sci-badge-warn' : tone === 'bad' ? 'sci-badge-bad' : ''}`}>{children}</span>
}

export function EmptyState({ title, children, action, secondary }) {
  return <div className="sci-empty"><div><h2>{title}</h2><p>{children}</p><div className="sci-result-actions" style={{ justifyContent: 'center' }}>{action}{secondary}</div></div></div>
}

export function Field({ label, name, value, onChange, required = false, placeholder = '', rows = 0, type = 'text' }) {
  return <div className="sci-field"><label htmlFor={`sci-field-${name}`}>{label}{required ? ' *' : ''}</label>{rows
    ? <textarea id={`sci-field-${name}`} value={value || ''} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} rows={rows} required={required} />
    : <input id={`sci-field-${name}`} type={type} value={value || ''} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} required={required} />}</div>
}

const ACTION_META = {
  explore: { title: '开始探索', fields: [['question', '研究问题', true, '例如：某蛋白变体如何影响细胞应激反应？', 3], ['scope', '研究范围', false, '物种、模型或时间范围', 2], ['existingData', '已有数据', false, '已有样本、数据类型或观察', 2], ['constraints', '算力与时间约束', false, '例如：单卡 24 GB，三周内完成', 2], ['notes', '补充要求', false, '', 2]] },
  import_results: { title: '导入已有结果', fields: [['source', '结果来源或摘要', true, '粘贴结果摘要，或说明工作区文件路径', 4], ['notes', '补充说明', false, '希望保留的背景或边界', 2]] },
  literature: { title: '扩展文献探索', fields: [['question', '研究问题', false, '可使用当前论文主线', 3], ['notes', '补充要求', false, '时间范围、数据库或文献类型', 2]] },
  generate_structure: { title: '生成文章结构', fields: [['notes', '补充要求', false, '例如：优先组织现有的阴性结果', 3]] },
  optimize_structure: { title: '优化文章结构', fields: [['guidance', '调整依据', true, '写明新证据、逻辑问题或希望调整的部分', 4], ['notes', '补充要求', false, '', 2]] },
  confirm: { title: '请求确认研究结论', fields: [['notes', '需要说明的依据', false, '补充确认时需要展示的背景', 3]] },
  refine_tasks: { title: '细化执行任务', fields: [['notes', '执行约束', false, '资源、期限、方法或完成判据', 3]] },
  draw: { title: '开始绘图', fields: [['journal', '目标期刊', false, '期刊名称或暂未确定', 0], ['requirements', '图件要求', false, '图要回答的问题、现有数据、统计方法和格式', 4], ['notes', '补充要求', false, '', 2]] },
  write: { title: '撰写论文', fields: [['journal', '目标期刊', false, '期刊名称或暂未确定', 0], ['language', '写作语言', false, '中文或 English', 0], ['notes', '补充要求', false, '需要优先起草的部分或格式要求', 4]] },
  slides: { title: '制作汇报 PPT', fields: [['pages', '页数或汇报时长', false, '例如：12 页 / 15 分钟', 0], ['style', '表达风格', false, '清晰、克制、便于口头讲解', 2], ['notes', '补充要求', false, '', 2]] },
}

export function ActionDialog({ action, target, onClose, onSubmit, busy = false, error = null, onOpenConversation, onCopyDiagnostic }) {
  const meta = ACTION_META[action] || ACTION_META.explore
  const [values, setValues] = useState({})
  const modalRef = useRef(null)
  useEffect(() => { modalRef.current?.querySelector('textarea,input')?.focus() }, [])
  const change = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) onClose()
    if (event.key === 'Tab' && modalRef.current) {
      const items = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  return <div className="sci-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="sci-modal" role="dialog" aria-modal="true" aria-labelledby="sci-dialog-title" ref={modalRef} onKeyDown={onKeyDown}>
      <div className="sci-panel-heading"><div><h2 id="sci-dialog-title">{meta.title}</h2>{target && <p>关联研究结果：{target.title}</p>}</div><Button quiet small aria-label="关闭" onClick={onClose} disabled={busy}>关闭</Button></div>
      {meta.fields.map(([name, label, required, placeholder, rows]) => <Field key={name} name={name} label={label} required={required} placeholder={placeholder} rows={rows} value={values[name]} onChange={change} />)}
      {error && <div className="sci-error-box" role="alert"><strong>{error.message || '请求未提交'}</strong><div>{error.recovery}</div>{error.detail && <details><summary>错误详情</summary><code>{error.detail}</code></details>}<div className="sci-result-actions"><Button small onClick={() => onSubmit(values)} disabled={busy}>重新提交</Button>{onOpenConversation && <Button small onClick={onOpenConversation}>打开对话</Button>}{onCopyDiagnostic && error.detail && <Button small onClick={() => onCopyDiagnostic(error)}>复制诊断信息</Button>}</div></div>}
      <div className="sci-form-actions"><Button onClick={onClose} disabled={busy}>取消</Button><Button primary onClick={() => onSubmit(values)} disabled={busy}>{busy ? '正在提交…' : '提交到当前对话'}</Button></div>
    </section>
  </div>
}

export function StageTrack({ stages = [] }) {
  return <div className="sci-stage-track" aria-label="论文阶段">{stages.map((stage, index) => <div className="sci-stage" data-state={stage.state} key={stage.id}><div className="sci-stage-dot">{stage.state === 'completed' ? '✓' : index + 1}</div><div className="sci-stage-label">{stage.label}</div></div>)}</div>
}

export function StatusMessage({ tone = 'default', children }) {
  return <div className={tone === 'error' ? 'sci-error-box' : tone === 'success' ? 'sci-success-box' : 'sci-panel'} role={tone === 'error' ? 'alert' : undefined}>{children}</div>
}
