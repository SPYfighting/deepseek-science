const STAGES = Object.freeze([
  { id: 'explore', label: '研究探索' },
  { id: 'frame', label: '文章结构' },
  { id: 'execute', label: '任务细化' },
  { id: 'synthesize', label: '分析与绘图' },
  { id: 'draft', label: '论文写作' },
  { id: 'audit', label: '汇报与投稿' },
])

const LIVE_STATUSES = new Set(['claimed', 'in_progress', 'running', 'working'])
const DONE_STATUSES = new Set(['completed', 'done'])
const HIDDEN_STATUSES = new Set(['deleted', 'cancelled'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg'])

const asArray = (value) => Array.isArray(value) ? value : []
const asText = (value) => typeof value === 'string' ? value : ''
const nonEmpty = (value) => asText(value).trim()

function listOf(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function stageStateOf(stage, currentStage) {
  const stageIndex = STAGES.findIndex((item) => item.id === stage.id)
  const currentIndex = Math.max(0, STAGES.findIndex((item) => item.id === currentStage))
  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'current'
  return 'upcoming'
}

function statusLabel(status) {
  const labels = {
    pending: '等待中',
    claimed: '已领取',
    in_progress: '进行中',
    working: '工作中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    blocked: '受阻',
    cancelled: '已取消',
  }
  return labels[status] || '状态待更新'
}

function taskResultIds(task) {
  const ids = []
  if (typeof task?.resultId === 'string' && task.resultId) ids.push(task.resultId)
  for (const id of asArray(task?.resultIds)) if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id)
  return ids
}

function readinessForResult(blueprint, result) {
  const row = asArray(blueprint?.paperSpine?.results).find((item) => item && item.id === result.id)
  if (row?.readiness && typeof row.readiness === 'object') return row.readiness
  const evidence = asArray(result.evidence).filter((item) => item && item.state === 'verified').length
  const claims = asArray(result.claims).length
  const manuscript = nonEmpty(result.manuscriptRole) && result.manuscriptRole !== 'excluded'
  return {
    scientific: { state: evidence > 0 ? 'in_progress' : 'blocked', blockers: evidence > 0 ? [] : ['尚无可核验证据'] },
    manuscript: { state: manuscript && claims > 0 ? 'in_progress' : 'blocked', blockers: manuscript && claims > 0 ? [] : ['尚无写作材料'] },
    submission: { state: 'blocked', blockers: ['投稿准备信息尚未核对'] },
  }
}

function memberLiveLabel(status) {
  const labels = {
    claimed: '已领取',
    working: '工作中',
    running: '正在运行',
    idle: '空闲',
    offline: '离线',
    'claimed/working': '已领取 · 工作状态待确认',
  }
  return labels[status] || '状态待更新'
}

function memberLiveTone(status) {
  if (status === 'running' || status === 'working') return 'good'
  if (status === 'claimed' || status === 'claimed/working') return 'warn'
  if (status === 'offline') return 'bad'
  return 'default'
}

function taskBlockers(task, taskById) {
  const blockers = []
  if (task.status === 'blocked') blockers.push(nonEmpty(task.blockedReason) || '任务已标记为受阻')
  for (const id of asArray(task.blockedBy)) {
    const dependency = taskById.get(id)
    if (!dependency || !DONE_STATUSES.has(dependency.status)) {
      blockers.push(dependency ? `等待“${dependency.subject || dependency.id}”完成` : `依赖任务 ${id} 不在当前任务板`)
    }
  }
  return [...new Set(blockers)]
}

function nextStepOf(paper, team) {
  if (!paper.core.claim && paper.results.length === 0) return { label: '开始探索研究问题', action: 'explore' }
  if (paper.core.claim && !paper.core.confirmed) return { label: '确认核心研究结论', action: 'confirm', targetId: 'core' }
  const unconfirmed = paper.results.find((result) => !result.confirmed)
  if (unconfirmed) return { label: '检查并确认文章结构', action: 'confirm', targetId: unconfirmed.id }
  const withoutTasks = paper.results.find((result) => result.confirmed && result.taskCount === 0 && !['dropped'].includes(result.status))
  if (withoutTasks) return { label: '细化执行任务', action: 'refine_tasks', targetId: withoutTasks.id }
  if (team.counts.running > 0 || team.counts.waiting > 0 || team.counts.blocked > 0) return { label: '查看团队执行进展', page: 'team' }
  if (paper.results.length > 0) return { label: '根据已确认结果继续写作', action: 'write' }
  return { label: '生成文章结构草案', action: 'generate_structure' }
}

function fileCategory(path) {
  const text = asText(path).toLowerCase()
  const ext = text.split('.').pop() || ''
  if (IMAGE_EXTENSIONS.has(ext) || ['pdf', 'tif', 'tiff', 'eps'].includes(ext) || /figure|plot|chart|图/.test(text)) return 'figures'
  if (['doc', 'docx', 'md', 'tex', 'rtf'].includes(ext) || /manuscript|paper|draft|论文/.test(text)) return 'manuscript'
  if (['ppt', 'pptx', 'key'].includes(ext) || /slide|presentation|汇报|答辩/.test(text)) return 'presentation'
  if (['csv', 'tsv', 'parquet', 'rds', 'rdata', 'ipynb', 'py', 'r', 'm', 'jl', 'json'].includes(ext) || /data|code|analysis|result|数据|代码/.test(text)) return 'data-code'
  return 'other'
}

function fileUrl(path) {
  return `/plugins/dsh-science/file?path=${encodeURIComponent(path)}`
}

/** Convert the backend snapshot to page-ready data while preserving unknown/empty states. */
export function stateViewOf(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.error) {
    return { available: false, error: asText(snapshot?.error) || '当前无法读取科研工作台状态。' }
  }

  const blueprint = snapshot.blueprint && typeof snapshot.blueprint === 'object' ? snapshot.blueprint : {}
  const teamState = snapshot.team && typeof snapshot.team === 'object' ? snapshot.team : {}
  const rawResults = asArray(blueprint.results)
  const rawTasks = asArray(teamState.tasks).filter((task) => task && !HIDDEN_STATUSES.has(task.status))
  const taskById = new Map(rawTasks.filter((task) => task.id).map((task) => [task.id, task]))
  const figures = listOf(snapshot.figures)
  const files = asArray(snapshot.files)

  const tasks = rawTasks.map((task) => {
    const blockers = taskBlockers(task, taskById)
    return {
      ...task,
      label: statusLabel(task.status),
      resultIds: taskResultIds(task),
      blockers,
      isBlocked: blockers.length > 0,
      isRunning: LIVE_STATUSES.has(task.status),
      isComplete: DONE_STATUSES.has(task.status),
    }
  })

  const resultRows = rawResults.filter((result) => result && typeof result === 'object').map((result) => {
    const linkedTasks = tasks.filter((task) => taskResultIds(task).includes(result.id) || asArray(result.tasks).includes(task.id))
    const linkedFigures = figures.filter((figure) => figure && (figure.resultId === result.id || asArray(figure.resultIds).includes(result.id) || asArray(result.figures).includes(figure.id)))
    const readiness = readinessForResult(blueprint, result)
    const required = Object.values(readiness).filter((item) => item && item.state === 'blocked').flatMap((item) => asArray(item.blockers))
    const recommended = Object.values(readiness).filter((item) => item && item.state === 'in_progress').flatMap((item) => asArray(item.blockers))
    return {
      ...result,
      title: nonEmpty(result.title) || nonEmpty(result.claim) || '未命名研究结果',
      statusLabel: ({ planned: '计划中', in_progress: '进行中', supported: '已获得支持', negative: '与预期不符', dropped: '不纳入正文' })[result.status] || '状态待核对',
      confirmed: result.confirmed === true,
      readiness,
      taskCount: linkedTasks.length,
      completedTaskCount: linkedTasks.filter((task) => task.isComplete).length,
      runningTaskCount: linkedTasks.filter((task) => task.isRunning).length,
      figures: linkedFigures,
      requiredItems: [...new Set(required)],
      recommendedItems: [...new Set(recommended)],
      tasks: linkedTasks,
    }
  })

  const activeTasks = tasks.filter((task) => !task.isComplete)
  const counts = {
    running: tasks.filter((task) => task.isRunning && !task.isBlocked).length,
    waiting: tasks.filter((task) => task.status === 'pending' && !task.isBlocked).length,
    completed: tasks.filter((task) => task.isComplete).length,
    blocked: tasks.filter((task) => task.isBlocked).length,
  }
  const members = asArray(teamState.members).map((member) => {
    const liveStatus = snapshot.memberLive?.[member.name] || 'offline'
    return {
      ...member,
      liveStatus,
      liveStatusLabel: memberLiveLabel(liveStatus),
      liveStatusTone: memberLiveTone(liveStatus),
      currentTasks: tasks.filter((task) => task.assignee === member.name && !task.isComplete),
      lastReport: nonEmpty(member.lastReport) || nonEmpty(member.lastSummary) || '',
    }
  })
  const blockedTasks = tasks.filter((task) => task.isBlocked)
  const activity = tasks
    .filter((task) => nonEmpty(task.report) || nonEmpty(task.resultSummary) || nonEmpty(task.updatedAt) || nonEmpty(task.completedAt))
    .sort((a, b) => Number(b.updatedAt || b.completedAt || 0) - Number(a.updatedAt || a.completedAt || 0))
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      summary: nonEmpty(task.report) || nonEmpty(task.resultSummary) || task.subject || task.id,
      resultIds: task.resultIds,
      at: task.updatedAt || task.completedAt || task.createdAt || null,
      status: task.status,
    }))

  const paper = {
    title: nonEmpty(blueprint.core?.title) || '未命名研究项目',
    stage: STAGES.some((stage) => stage.id === blueprint.stage) ? blueprint.stage : 'explore',
    stageLabel: STAGES.find((stage) => stage.id === blueprint.stage)?.label || '研究探索',
    stageUpdatedAt: Number(blueprint.stageUpdatedAt || 0),
    stages: STAGES.map((stage) => ({ ...stage, state: stageStateOf(stage, blueprint.stage || 'explore') })),
    venue: nonEmpty(blueprint.core?.venue),
    core: {
      title: nonEmpty(blueprint.core?.title),
      claim: nonEmpty(blueprint.core?.claim),
      innovation: nonEmpty(blueprint.core?.innovation),
      confirmed: blueprint.core?.confirmed === true,
      revision: blueprint.core?.revision || 1,
    },
    narrative: nonEmpty(blueprint.narrative),
    results: resultRows,
    supportedResults: resultRows.filter((result) => result.status === 'supported').length,
    totalResults: resultRows.length,
    updatedAt: blueprint.updatedAt || snapshot.ts || null,
    error: nonEmpty(snapshot.blueprintError),
  }

  const artifacts = files.map((file) => {
    const path = asText(file.path)
    const category = fileCategory(path)
    const ext = path.split('.').pop()?.toLowerCase() || ''
    return {
      ...file,
      path,
      category,
      url: path ? fileUrl(path) : null,
      previewable: category === 'figures' && IMAGE_EXTENSIONS.has(ext),
    }
  })

  const figureRecords = figures.map((figure) => {
    const path = nonEmpty(figure.file) || nonEmpty(figure.path) || nonEmpty(figure.filePath) || nonEmpty(figure.outputPath)
    const ext = path.split('.').pop()?.toLowerCase() || ''
    return {
      ...figure,
      path,
      url: path ? fileUrl(path) : null,
      previewable: IMAGE_EXTENSIONS.has(ext),
      title: nonEmpty(figure.title) || nonEmpty(figure.name) || nonEmpty(path.split(/[\\/]/).pop()) || figure.id || '未命名图件',
    }
  })

  const figureById = new Map(figureRecords.filter((figure) => figure.id).map((figure) => [figure.id, figure]))
  const figureFamilyKey = (figure) => {
    const familyId = nonEmpty(figure.figureId) || nonEmpty(figure.familyId)
    if (familyId) return `id:${familyId}`
    const stem = figure.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '').trim().toLowerCase()
    const resultId = nonEmpty(figure.resultId)
    return stem && resultId ? `result:${resultId}:stem:${stem}` : ''
  }
  for (const figure of figureRecords) {
    const explicitPreviousId = nonEmpty(figure.prevId) || nonEmpty(figure.previousVersionId)
    if (explicitPreviousId && figureById.has(explicitPreviousId)) {
      figure.previousVersionId = explicitPreviousId
      figure.previousVersionRelation = 'recorded'
      continue
    }
    const timestamp = Number(figure.registeredAt || figure.createdAt || 0)
    const family = figureFamilyKey(figure)
    if (!family || !Number.isFinite(timestamp) || timestamp <= 0) continue
    const previous = figureRecords
      .filter((candidate) => candidate !== figure && figureFamilyKey(candidate) === family)
      .filter((candidate) => {
        const candidateTime = Number(candidate.registeredAt || candidate.createdAt || 0)
        return Number.isFinite(candidateTime) && candidateTime > 0 && candidateTime < timestamp
      })
      .sort((a, b) => Number(b.registeredAt || b.createdAt || 0) - Number(a.registeredAt || a.createdAt || 0))[0]
    if (previous?.id) {
      figure.previousVersionId = previous.id
      figure.previousVersionRelation = 'inferred'
    }
  }

  const team = {
    members,
    tasks,
    activeTasks,
    counts,
    blockedTasks,
    activity,
    updatedAt: snapshot.ts || null,
  }

  paper.nextStep = nextStepOf(paper, team)
  return {
    available: true,
    generatedAt: snapshot.generatedAt || null,
    paper,
    team,
    artifacts: {
      figures: figureRecords,
      plans: asArray(snapshot.figurePlans),
      files: artifacts,
      reviews: asArray(snapshot.reviews),
      workspaceRoot: asText(snapshot.workspaceRoot),
      groups: [
        { id: 'figures', label: '图表', items: artifacts.filter((item) => item.category === 'figures') },
        { id: 'manuscript', label: '论文文稿', items: artifacts.filter((item) => item.category === 'manuscript') },
        { id: 'presentation', label: '汇报材料', items: artifacts.filter((item) => item.category === 'presentation') },
        { id: 'data-code', label: '数据与代码', items: artifacts.filter((item) => item.category === 'data-code') },
        { id: 'other', label: '其他文件', items: artifacts.filter((item) => item.category === 'other') },
      ],
    },
    experts: {
      roles: snapshot.roles && typeof snapshot.roles === 'object' ? snapshot.roles : {},
      skillMenu: snapshot.skillMenu && typeof snapshot.skillMenu === 'object' ? snapshot.skillMenu : { catalog: {}, installed: {}, integrations: [] },
    },
  }
}

export { STAGES as PAPER_STAGES }
