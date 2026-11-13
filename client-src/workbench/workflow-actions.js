const ACTION_SKILLS = Object.freeze({
  explore: 'sci-hypothesis',
  literature: 'sci-research',
  draw: 'sci-figures',
  write: 'sci-writing',
  slides: 'sci-slides',
})

const textOf = (value) => typeof value === 'string' ? value.trim() : ''
const resultListOf = (paperState) => Array.isArray(paperState?.results) ? paperState.results : []

function resultById(paperState, id) {
  return resultListOf(paperState).find((result) => result && result.id === id) || null
}

function resultLabel(result) {
  const title = textOf(result?.title) || textOf(result?.claim) || '未命名结果'
  return `${title}（${result?.id || '无编号'}）`
}

export function resultConfirmationGate(coreConfirmed, resultConfirmed) {
  if (coreConfirmed !== true) return 'core'
  if (resultConfirmed !== true) return 'result'
  return null
}

function block(code, message, recovery, field = null) {
  return { ok: false, error: { code, message, recovery, field } }
}

function request(action, text, targetId = null) {
  return { ok: true, request: { action, text, targetId, mode: 'queue' } }
}

function skillRequest(skill, instructions, extra) {
  const suffix = extra ? `\n\n补充要求：${extra}` : ''
  return `${ACTION_SKILLS[skill] ? `/${ACTION_SKILLS[skill]}` : `/${skill}`}\n\n${instructions}${suffix}`
}

/** Build one deterministic, user-readable request without accessing DSH services. */
export function buildWorkflowRequest({ action, paperState = {}, targetId = null, userInput = {} } = {}) {
  const input = userInput && typeof userInput === 'object' ? userInput : {}
  const core = paperState?.core || {}
  const results = resultListOf(paperState)
  const target = targetId ? resultById(paperState, targetId) : null

  if (targetId && !target && targetId !== 'core') {
    return block('missing-result', '找不到所选研究结果，页面状态可能已更新。', '刷新工作台后重新选择研究结果。')
  }

  switch (action) {
    case 'explore': {
      const question = textOf(input.question)
      if (!question) return block('missing-input', '请先写下想探索的研究问题。', '补充研究问题后再开始探索。', 'question')
      const details = [
        `研究问题：${question}`,
        textOf(input.scope) && `研究范围：${textOf(input.scope)}`,
        textOf(input.existingData) && `已有数据：${textOf(input.existingData)}`,
        textOf(input.constraints) && `算力与时间约束：${textOf(input.constraints)}`,
      ].filter(Boolean).join('\n')
      return request(action, skillRequest('explore', `请按科研探索流程处理以下问题。先核对已有证据、关键假设和可行范围，再提出可检验的研究方向；不要把假设写成研究结论。\n\n${details}`, textOf(input.notes)))
    }
    case 'import_results': {
      const source = textOf(input.source)
      if (!source) return block('missing-input', '请说明要导入的已有结果来自哪里。', '写入文件路径、会话材料或结果摘要，再提交给当前对话。', 'source')
      return request(action, `请检查并整理我已有的科研结果，不要补造缺失数据。\n\n结果来源或摘要：${source}${textOf(input.notes) ? `\n\n补充说明：${textOf(input.notes)}` : ''}\n\n先列出可追溯的结果、来源和不确定项，再提出文章结构草案；未经我确认，不要派发正式执行任务。`)
    }
    case 'literature': {
      const question = textOf(input.question) || textOf(core.claim) || textOf(core.title)
      if (!question) return block('missing-input', '还没有可用于文献探索的研究问题。', '先开始探索，或补充一句当前研究问题。', 'question')
      const existing = results.map(resultLabel).join('；')
      const text = skillRequest('literature', `围绕以下研究问题扩展文献探索，并区分已知证据、争议和未解决问题。不要把摘要或模型推断写成已验证结果。\n\n研究问题：${question}${existing ? `\n\n当前文章结果：${existing}` : ''}`, textOf(input.notes))
      return request(action, text)
    }
    case 'generate_structure': {
      const question = textOf(input.question) || textOf(core.claim) || textOf(core.title)
      if (!question && results.length === 0) return block('missing-context', '当前没有研究问题或已有结果可供组织。', '先开始探索，或导入一项已有结果。')
      const context = question ? `研究问题或核心结论候选：${question}` : `已有研究结果：${results.map(resultLabel).join('；')}`
      return request(action, `请基于当前会话证据与下列研究背景建立文章结构草案：提出核心结论候选，并拆分为 3–5 个可独立核验的 Result。每项写清研究问题、证据需求、反证条件和建议呈现方式。只生成待确认草案，不要自动确认或派发任务。\n\n${context}${textOf(input.notes) ? `\n\n补充要求：${textOf(input.notes)}` : ''}`)
    }
    case 'optimize_structure': {
      const guidance = textOf(input.guidance)
      if (!guidance) return block('missing-input', '请说明希望如何调整结构或研究结果。', '写下修改依据后再提交。', 'guidance')
      const targetText = target ? `目标研究结果：${resultLabel(target)}\n当前主张：${textOf(target.claim) || '未填写'}` : '目标：整体文章结构与 Result 之间的关系'
      return request(action, `请按新的研究事实修改论文结构。保留可追溯证据，不把修改建议直接当成已确认内容。\n\n${targetText}\n\n修改说明：${guidance}${textOf(input.notes) ? `\n\n补充要求：${textOf(input.notes)}` : ''}`, target?.id || null)
    }
    case 'confirm': {
      const confirmCore = targetId === 'core' || !targetId
      if (confirmCore && !textOf(core.claim)) return block('missing-core', '核心研究结论还没有填写。', '先生成文章结构或补充核心结论，再请求确认。')
      if (!confirmCore && !target) return block('missing-result', '找不到待确认的研究结果。', '刷新工作台后重新选择。')
      if (confirmCore && core.confirmed) return block('already-confirmed', '核心研究结论的当前修订已经确认。', '如需修改，请先提交结构修改；修改后的内容需要重新确认。')
      if (target?.confirmed) return block('already-confirmed', '该研究结果的当前修订已经确认。', '如需修改，请先提交结构修改；修改后的内容需要重新确认。')
      const subject = confirmCore ? `核心研究结论“${textOf(core.title) || textOf(core.claim)}”` : `研究结果“${resultLabel(target)}”`
      return request(action, `请调用论文蓝图确认工具，为${subject}发起 DSH 原生审批卡。审批通过前保持待确认状态，不要继续创建正式执行任务。${textOf(input.notes) ? `\n\n需要一并说明：${textOf(input.notes)}` : ''}`, confirmCore ? 'core' : target.id)
    }
    case 'refine_tasks': {
      if (!target) return block('missing-result', '请先选择要细化的研究结果。', '从论文主线选择一个研究结果后再试。')
      const gate = resultConfirmationGate(core.confirmed, target.confirmed)
      if (gate === 'core') return block('unconfirmed-core', '核心研究结论尚未确认，不能创建正式执行任务。', '先检查核心结论并完成确认；如需修改，先优化文章结构。')
      if (gate === 'result') return block('unconfirmed-result', `“${resultLabel(target)}”尚未确认，不能创建正式执行任务。`, '先检查研究结果并完成确认；如需修改，先优化结构。')
      const text = `请为已确认的研究结果细化执行任务、依赖关系和可核验的完成判据。保持结果与任务双向关联；未解决依赖须标明，不要把派单视为完成。\n\n研究结果：${resultLabel(target)}\n主张：${textOf(target.claim) || '未填写'}${textOf(input.notes) ? `\n\n补充要求：${textOf(input.notes)}` : ''}`
      return request(action, text, target.id)
    }
    case 'draw': {
      if (!target) return block('missing-result', '还没有可关联的研究结果。', '先建立或导入结果，再从该结果开始绘图。')
      const gate = resultConfirmationGate(core.confirmed, target.confirmed)
      if (gate === 'core') return block('unconfirmed-core', '核心研究结论尚未确认，不能启动正式绘图任务。', '先检查核心结论并完成确认；如需修改，先优化文章结构。')
      if (gate === 'result') return block('unconfirmed-result', `“${resultLabel(target)}”尚未确认，不能启动正式绘图任务。`, '先确认结果主张，或继续修改文章结构。')
      const text = skillRequest('draw', `为已确认的研究结果制定可追溯图件计划。先确认图要回答的问题、数据来源、统计方法和目标期刊；需要输出投稿候选图时保留源数据、绘图代码、物理尺寸与人工终审要求。不要声称自动达到期刊标准。\n\n研究结果：${resultLabel(target)}\n主张：${textOf(target.claim) || '未填写'}\n目标期刊：${textOf(input.journal) || textOf(paperState?.venue) || '待选择'}\n图件要求：${textOf(input.requirements) || '请先提出图件方案供确认。'}`, textOf(input.notes))
      return request(action, text, target.id)
    }
    case 'write': {
      const outline = results.map(resultLabel).join('；') || '当前尚无研究结果'
      return request(action, skillRequest('write', `根据论文主线起草或修改稿件。只把已确认且有证据支持的结果写成研究结论；未确认或阴性结果要准确标注。\n\n核心结论：${textOf(core.claim) || '尚未确认'}\n现有结果：${outline}\n目标期刊：${textOf(input.journal) || textOf(paperState?.venue) || '待选择'}\n写作语言：${textOf(input.language) || '中文'}`, textOf(input.notes)))
    }
    case 'slides': {
      if (results.length === 0) return block('no-results', '目前没有可用于汇报的研究结果。', '先生成或导入研究结果，再制作汇报材料。')
      const confirmed = results.filter((result) => result.confirmed === true).map(resultLabel)
      const unconfirmed = results.filter((result) => result.confirmed !== true).map(resultLabel)
      const text = skillRequest('slides', `基于已有科研证据制作汇报 PPT。只使用下列已有结果，不创造新实验结果、数字或图表。未确认结果应明确标为待验证，不作为已证实结论。\n\n已确认结果：${confirmed.join('；') || '无'}\n待确认结果：${unconfirmed.join('；') || '无'}\n页数：${textOf(input.pages) || '按汇报时长建议'}\n风格：${textOf(input.style) || '清晰、克制、便于口头讲解'}`, textOf(input.notes))
      return request(action, text)
    }
    default:
      return block('unknown-action', '无法识别这个工作流动作。', '刷新工作台后重试。')
  }
}

function errorMessageOf(value) {
  if (typeof value === 'string') return value
  if (value && typeof value.message === 'string') return value.message
  if (value && typeof value.code === 'string') return value.code
  return ''
}

function submissionError(message, detail = '') {
  const normalized = String(message || '').toLowerCase()
  if (normalized.includes('model') || normalized.includes('模型')) {
    return { ok: false, step: '提交到当前会话', accepted: false, message: '当前会话尚未配置可用模型。', recovery: '先在模型设置中选择可用模型，再重新提交。', detail }
  }
  return { ok: false, step: '提交到当前会话', accepted: false, message: 'DSH 没有接收这项请求。', recovery: '检查会话连接后安全重试；这次请求尚未进入研究流程。', detail }
}

/** Submit one request through DSH's current-session prompt contract. */
export async function submitWorkflowRequest({ session, request: workflowRequest, signal } = {}) {
  if (!session) {
    return { ok: false, step: '选择当前会话', accepted: false, message: '当前没有可接收任务的会话。', recovery: '请先在 DSH 中新建或打开一个项目会话，再重新提交。' }
  }
  const text = textOf(workflowRequest?.text)
  const mode = workflowRequest?.mode === 'steer' ? 'steer' : 'queue'
  if (!text) return { ok: false, step: '准备请求', accepted: false, message: '请求内容为空，尚未提交。', recovery: '关闭表单后重新填写，再试一次。' }
  if (typeof session.beginSubmission !== 'function' || typeof session.prompt !== 'function') {
    return { ok: false, step: '连接当前会话', accepted: false, message: '当前 DSH 会话不支持工作台提交。', recovery: '返回对话页确认会话已打开，然后刷新工作台。' }
  }

  let content
  try {
    content = [{ type: 'text', text }]
  } catch (error) {
    return submissionError('request serialization failed', errorMessageOf(error))
  }

  let submission
  try {
    submission = session.beginSubmission({ text, mode, attachments: [] })
  } catch (error) {
    return submissionError(errorMessageOf(error), errorMessageOf(error))
  }
  if (!submission || !submission.requestId || typeof submission.abandon !== 'function') {
    return submissionError('invalid submission handle', 'DSH 未返回有效的本地提交标识。')
  }

  try {
    const result = await session.prompt(content, mode, signal, submission.requestId)
    if (result?.ok === false) {
      return submissionError(errorMessageOf(result.error) || errorMessageOf(result), errorMessageOf(result.error))
    }
    if (result?.failed || result?.error) {
      return submissionError(errorMessageOf(result.error) || errorMessageOf(result), errorMessageOf(result.error))
    }
    if (result?.ok === true && result.value?.accepted !== true) {
      return submissionError('host did not accept prompt', 'DSH 未返回 accepted=true。')
    }
    if (result?.accepted === false || result == null) {
      return submissionError('host did not accept prompt', 'DSH 未确认接收这项请求。')
    }
    return { ok: true, step: '提交到当前会话', accepted: true, message: '请求已提交到当前对话。' }
  } catch (error) {
    try {
      submission.abandon()
    } catch {
      /* DSH may already have retired the echo. */
    }
    return submissionError(errorMessageOf(error), errorMessageOf(error))
  }
}
