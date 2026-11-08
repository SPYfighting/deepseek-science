// dsh-science client — 科研工作台 v0.7.1（三标签：团队 / 文章框架 / 产物）
// v0.10.0：B3 双份挂载修复——apply() 入口加 window.__DSH_SCIENCE_CLIENT_MOUNTED 幂等 guard
//   （同页面域重复 apply 直接 return 保留首次注册；整页 reload/双开新窗口不受影响）。
// v0.7.1（round-1 review 修复）：F1 DAG 选点连通性优先（被 blockedBy 引用的任务与其依赖同屏，
//   task-31→34 全链可见）；F2 任务节点用更高层 surface（--dsw-alias-bg-layer-2）+ border-l4 边框
//   （暗色 alpha 0.2 ≥ 0.18）；F3 列头真实计数（全量任务）+ 第四列「已结束」（failed/cancelled/
//   deleted 不再混入已完成）；F4 框架图叶 = union(blueprint tasks, 任务板 resultId 反查) 去重；
//   F5 成员会话优先用 spawn 记录的 parentSessionId（旧成员回退当前主会话）；F6 依赖边 <title>
//   hover + 「+N 更多」可点击展开全量；F7 ensureId 不突破 CAP / SVG marker 实例唯一前缀 /
//   edge key 去重 / framework results 超 8 显示 +N。
// 设计基线（v0.4.0 设计转向 → v0.7.0 游戏化流程转向）：右栏标签——
//   ①「团队」（v0.7.0 重构）：任务流 DAG 视图——成员带（40px 吉祥物头像 + 状态点 + 动作姿态：
//     running→working 叠加 + CSS 呼吸动画 / 有待办任务→thinking 思考姿态 / 离线→灰度滤镜）
//     · 状态列 kanban 式画布（待办 → 进行中 → 已完成 三列，节点按 最长路径依赖深度 + id 排序）
//     · blockedBy 依赖边以 SVG 贝塞尔箭头绘制（active 依赖高亮，已完成依赖淡化为虚线）
//     · 点击任务节点 → 画布下方详情卡（描述/结果/负责人/时间）· 点击成员 → 打开成员会话
//     · 节点上限 18（进行中/待办优先），溢出显示「+N 更多」；「列表视图」切换回退旧任务板
//     保留：数值进度总览（分段条 + 状态计数）+ DataGate + 3s 轮询
//   ②「文章框架」（v0.7.0 由「文章」改名）：框架图视图——核心节点（顶部，lead 吉祥物 + 标题 +
//     主张）→ Result 节点（状态色边框，claim 内嵌）→ 各 result 的任务叶节点（状态点）与图表
//     叶节点（🖼 标题）；SVG 边 核心→result（扇形贝塞尔）+ result→叶（树干+横枝）；点击节点 →
//     详情卡（result: claim/notes/对齐 chips；task: 描述/状态；figure: file 路由图片预览）。
//     「列表视图」切换回退 v0.6.0 的核心卡 + Results 列表。覆盖检查 + 命令芯片两视图共用。
//   ③「产物」：图表（含 <img> 预览，经 GET /plugins/dsh-science/file 服务工作区内文件，点击新标签页查看）
//             · 文件（工作区文件树，点击复制绝对路径，⬇ 新标签页打开）· 远程（SSH 主机 + 最近作业）
//             · 审查（/sci-review 历次 run：状态点 + fail/warn 计数，行点击展开 findings）
// v0.5.0：科研鲸鱼娘吉祥物（assets/mascots/*.svg 原创矢量图——科学风格致敬 agent-teams
//   插件的鲸鱼娘模式，MIT License；flat chibi 鲸鱼身体 + 发髻/呆毛/腮红 + 角色道具，
//   亮色填充随主题自适应）。host 经 GET /plugins/dsh-science/assets/<file>.svg 服务（白名单路由）。
//   v0.7.0 新增 thinking.svg（思考姿态叠加图，host 白名单同步放行）。
// 文章蓝图数据模型（host 侧 lib/blueprint.js）：核心 → 3-5 个 Results（子主张）→ Tasks（任务板上
//   支撑各 result 的执行任务）→ Figures（图表证据）；负面结果从核心出发重新评估。
// 布局模式（分段进度条 / 状态列 DAG / 树形框架图：任务节点卡 + 贝塞尔依赖边）参考并改写自
//   agent-teams 插件的 ActivityPanel DependencyMap（compactDagLayout 最长路径分层思想，MIT
//   License, Copyright (c) DSH contributors），以 inline-style + --dsw-alias-* 变量重实现；
//   与 agent-teams 的差异：x 轴改为状态列（待办→进行中→已完成，贴合「分工与进度」critique），
//   依赖深度用于列内 y 排序；仅绘制两端均可见的依赖边（溢出节点不画断头线）。
// 数据通道：GET /plugins/dsh-science/state（host 侧 lib/httpdata.js 注册，同源 fetch 自带会话凭证，
//   快照含 blueprint/team/figures/memberLive/roles 等）；桌面版无该路由 → DataGate 降级提示
//   （团队工具仍可用；吉祥物 404 时 onError 回退 emoji 图标）。
// 跨标签跳转协议（v0.6.0 fix3/fix6）：文章框架 tab 的任务/图表 chip 携带 focus id 切换标签，
//   团队 tab 的 DAG 自动选中该节点并 scrollIntoView；产物 tab 图表卡滚动高亮，处理后清除 focus。
// v0.9.0（三轨升级）：① Track 1 团队 UI 对齐 agent-teams ActivityPanel——成员行 hover 高亮 +
//   角色标签/状态文本 + 点击展开该成员在办任务子列表；blockedBy chip 可点击跳转目标任务行
//   （DAG 与列表视图一致）；进度总览 data-state 分段（pending/claimed/running/completed/failed/
//   cancelled）+ 状态摘要行；队长收件箱卡（成员回报摘要，team.json tasks.result+updatedAt 排序）；
//   全量 hover/transition 打磨（CSS data-attr :hover + !important 覆盖内联底色）。成员条形态保留
//   （右栏横排头像带 vs agent-teams 纵向 delegationTree，布局不同不硬抄）。
//   ② Track 2 确认工作流 + 每Result参考文献——文章框架 tab：核心/Results 显示 🔒 已确认 /
//   ⏳ 待确认 徽章 + 确认命令芯片（/sci_blueprint_confirm core · /sci_blueprint_confirm res-N）；
//   result 展开区新增「参考文献」小节（usedAs 分组 chips，verified 绿/未验证黄 + 添加命令芯片）
//   与快筛徽章（sci_result_screening include/exclude/maybe）。
//   ③ Track 3——图表版本链（register 记 version/prevId/prevSha，图表卡 ↩ 上一版本对比入口）+
//   蓝图导出（sci_blueprint_export → research/blueprint-report.md 命令芯片）。
// externals（react 等）由 DSH 平台模块表在运行时提供——绝不打包。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const inject = ['sidebarRightTabs', 'slots', 'resources']

const VERSION = '0.10.1'
const STATE_URL = '/plugins/dsh-science/state'
const POLL_MS = 3000
// 模块级运行时标记：成员是否记录了真实父会话（供 apply 层 memberOpenAvailable 判定）
const teamRuntime = { hasRecordedParents: false }
// 吉祥物路由（host 白名单服务 assets/mascots/*.svg）
const MASCOT_BASE = '/plugins/dsh-science/assets/'
const LEAD_MASCOT = 'lead.svg'
// 版本参数：SVG 资产在版本升级时会换色/改形，host 侧长缓存（max-age=86400）需要 URL 失效
const mascotUrl = (file) => `${MASCOT_BASE}${file}?v=${VERSION}`
// roles meta（state.roles[id].mascot）缺失时的客户端兜底映射（与 lib/roles.js 保持一致）
const ROLE_MASCOT_FALLBACK = {
  'literature-scout': 'scout.svg',
  'topic-designer': 'designer.svg',
  simulator: 'simulator.svg',
  trainer: 'trainer.svg',
  'figure-expert': 'figure.svg',
  writer: 'writer.svg',
  reviewer: 'reviewer.svg',
  analyst: 'analyst.svg',
  presentation: 'presentation.svg',
}

// 色板：优先用平台 --dsw-alias-* 设计变量（随主题明暗自适应），括号内为回退值。
// v0.7.1 F2：新增 surface（bg-layer-2，比画布 layer-1 高一层）与 borderNode（border-l4，
// 暗色为 rgba(255,255,255,0.2)——alpha ≥ 0.18，任务节点在深色主题下可辨；layer-1 边框
// 暗色仅 rgba(255,255,255,0.06)，节点会与画布融为一体）。
const C = {
  fg: 'var(--dsw-alias-label-primary, inherit)',
  muted: 'var(--dsw-alias-label-secondary, #888)',
  faint: 'var(--dsw-alias-label-tertiary, #aaa)',
  accent: 'var(--dsw-alias-state-business-primary, #1B6EC2)',
  ok: 'var(--dsw-alias-state-success-primary, #009E73)',
  warn: 'var(--dsw-alias-state-warn-primary, #E69F00)',
  err: 'var(--dsw-alias-state-error-primary, #D55E00)',
  card: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08))',
  surface: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.18))',
  chip: 'var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))',
  border: 'var(--dsw-alias-border-l1, rgba(127,127,127,0.25))',
  borderNode: 'var(--dsw-alias-border-l4, rgba(127,127,127,0.4))',
  divider: 'var(--dsw-alias-separator-primary, rgba(127,127,127,0.18))',
}

// 任务状态 → 状态点/分段条/DAG 节点颜色（warn/business/ok 为主，failed/cancelled/deleted 补充；
// X2：cancelled/deleted 同为灰色口径——主动取消与删除都不是审查意义上的失败）
const STATUS_COLOR = {
  pending: C.warn,
  claimed: C.accent,
  in_progress: C.accent,
  completed: C.ok,
  failed: C.err,
  cancelled: C.faint,
  deleted: C.faint,
}

// 蓝图 result 状态 → 状态点颜色（planned 灰 / in_progress business / supported ok /
// negative err / dropped faint——与 lib/blueprint.js RESULT_STATUSES 一一对应）
const RESULT_STATUS_COLOR = {
  planned: C.muted,
  in_progress: C.accent,
  supported: C.ok,
  negative: C.err,
  dropped: C.faint,
}
const RESULT_STATUS_LABEL = {
  planned: '计划',
  in_progress: '进行中',
  supported: '已支撑',
  negative: '负面',
  dropped: '已弃',
}

// v0.9.0 参考文献用途标签（sci_result_reference_add used_as 枚举）
const USED_AS_LABEL = {
  method: '方法',
  concept: '概念',
  background: '背景',
  evidence: '证据',
}
// v0.9.0 文献快筛标签（sci_result_screening decision 枚举）
const SCREENING_LABEL = {
  include: '快筛·纳入',
  exclude: '快筛·排除',
  maybe: '快筛·待定',
}
const SCREENING_COLOR = {
  include: C.ok,
  exclude: C.err,
  maybe: C.warn,
}

// 成员实时状态 → 颜色（memberLive: 'running' | 'idle' | 'claimed/working' | 'offline'；
// 'claimed/working' = agents 注册表无该成员实时记录，但任务板上有其 claimed/in_progress 任务）
const LIVE_COLOR = {
  running: C.accent,
  idle: C.ok,
  'claimed/working': C.accent,
  offline: C.faint,
}
const LIVE_LABEL = {
  running: '运行中',
  idle: '空闲',
  'claimed/working': '在办',
  offline: '离线',
}

const TERMINAL_STATUS = new Set(['completed', 'failed', 'cancelled', 'deleted'])

function copyText(text) {
  try {
    navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function fmtBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString()
}

// 归一化路径用于前缀比较（Windows 大小写不敏感 + 统一分隔符）
function normPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function pathInsideWorkspace(absPath, workspaceRoot) {
  if (!absPath || !workspaceRoot) return false
  const p = normPath(absPath)
  const root = normPath(workspaceRoot)
  return p === root ? false : p.startsWith(`${root}/`)
}

// 轮询 host 状态路由。web 档案可用；桌面版 fetch 失败 → error 态（DataGate 降级提示）。
// v0.9.0：暴露 refresh()（技能库 POST 成功后立即拉取一次，不等下一个 3s 轮询）。
function usePollState(intervalMs) {
  const [snap, setSnap] = useState({ data: null, error: null, loading: true, ts: 0 })
  const tickNow = useCallback(async (aliveObj) => {
    try {
      const res = await fetch(STATE_URL, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!aliveObj || aliveObj.alive) setSnap({ data, error: null, loading: false, ts: Date.now() })
    } catch (err) {
      if (!aliveObj || aliveObj.alive) setSnap((s) => ({ ...s, error: err, loading: false }))
    }
  }, [])
  useEffect(() => {
    const aliveObj = { alive: true }
    let timer = null
    const loop = async () => {
      await tickNow(aliveObj)
      if (aliveObj.alive) timer = setTimeout(loop, intervalMs)
    }
    loop()
    return () => {
      aliveObj.alive = false
      if (timer) clearTimeout(timer)
    }
  }, [intervalMs, tickNow])
  const refresh = useCallback(() => tickNow(null), [tickNow])
  return { ...snap, refresh }
}

// 数据面板可用性门：加载中 / 网络失败（无缓存）/ 桌面版降级 / 刷新失败提示（保留最近缓存）。
// v0.9.0：可选 fallback prop——无数据（桌面版/断连）时渲染在降级提示之下（角色技能库命令 chips）。
function DataGate({ state, children, fallback }) {
  if (state.loading && !state.data) return <Empty>加载中…</Empty>
  if (!state.data) {
    if (state.error) {
      return (
        <>
          <Empty>连接数据通道失败（web 档案请确认服务已启动）。</Empty>
          {fallback}
        </>
      )
    }
    return (
      <>
        <Empty>桌面版数据面板开发中（原生团队面板与全部团队工具可用）。web 档案下此处展示实时数据。</Empty>
        {fallback}
      </>
    )
  }
  const content = typeof children === 'function' ? children() : children
  return (
    <>
      {state.error && <p style={{ color: C.faint, fontSize: 10, margin: '0 0 4px' }}>刷新失败（{String(state.error && state.error.message)}），以下为最近缓存。</p>}
      {content}
    </>
  )
}

// ---------------------------------------------------------------- 基础组件 ----

// 空态提示：兼容 text 属性与 children 两种用法（v0.5.0 修复：此前全部调用方传 children，
// 而组件只读 text → 空态文案从未渲染，只显示空白）。
function Empty({ text, children }) {
  return <p style={{ color: C.muted, fontSize: 12, margin: '4px 0', lineHeight: 1.6 }}>{children != null ? children : text}</p>
}

function Dot({ color, pulse, size = 8 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: pulse ? 'dsh-sci-pulse 1.6s ease-in-out infinite' : undefined,
      }}
    />
  )
}

// 吉祥物头像：鲸鱼娘 SVG（host 白名单路由服务）；路由不存在/加载失败 → 回退 emoji 角色图标。
function MascotAvatar({ file, emoji, size = 26, overlay, style }) {
  const [failed, setFailed] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: size, height: size, ...style }}>
      {failed || !file ? (
        <span style={{ width: '100%', textAlign: 'center', fontSize: Math.round(size * 0.6), lineHeight: `${size}px` }}>
          {emoji || '👤'}
        </span>
      ) : (
        <img
          src={mascotUrl(file)}
          alt=""
          aria-hidden
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{ display: 'block', width: size, height: size }}
        />
      )}
      {overlay}
    </span>
  )
}

// 头像角标 action art（agent-teams ACTION_ART 模式）：running→working 弧、有待办→thinking
// 气泡（v0.7.0 新姿态）。加载失败静默隐藏（状态本来就有 Dot 颜色表达）。
function ActionOverlay({ file, avatarSize = 26 }) {
  const [failed, setFailed] = useState(false)
  if (failed || !file) return null
  const s = Math.max(10, Math.round(avatarSize * 0.48))
  return (
    <img
      src={mascotUrl(file)}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
      style={{ position: 'absolute', right: -4, bottom: -3, width: s, height: s, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.18))' }}
    />
  )
}

function Panel({ title, children, extra }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${C.divider}`, paddingBottom: 3, marginBottom: 6 }}>
        <h4 style={{ margin: 0, fontSize: 12, color: C.fg, letterSpacing: 0.3 }}>{title}</h4>
        {extra}
      </div>
      {children}
    </div>
  )
}

// 状态徽章（blockedBy 依赖 chip：task-N）
function DepChip({ id }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0 6px',
      marginLeft: 4,
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      background: C.chip,
      fontSize: 10,
      lineHeight: '16px',
      color: C.muted,
      flexShrink: 0,
    }}>
      {id}
    </span>
  )
}

// result 徽章（v0.6.0 fix5）：任务/图表与蓝图 result 双向对齐的 res-N 标记
//（accent 色区分于灰色依赖 chip；数据来自 host 双向回写 task.resultId / figure.resultId）
function ResBadge({ id }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0 6px',
      marginLeft: 4,
      borderRadius: 8,
      border: `1px solid ${C.accent}`,
      fontSize: 10,
      lineHeight: '16px',
      color: C.accent,
      flexShrink: 0,
      fontFamily: 'ui-monospace, monospace',
    }}>
      {id}
    </span>
  )
}

// 命令芯片（v0.6.0）：点击复制命令文本（供粘贴到会话输入框）。
// 文章框架 tab 底部的 sci_result_add / sci_blueprint_overview 与核心卡的 sci_blueprint_set 用。
function CmdChip({ cmd }) {
  const [copied, setCopied] = useState(false)
  return (
    <span
      onClick={() => {
        if (copyText(cmd)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }
      }}
      title={`点击复制命令：${cmd}`}
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        background: C.chip,
        fontSize: 10,
        lineHeight: '16px',
        color: C.muted,
        cursor: 'pointer',
        fontFamily: 'ui-monospace, monospace',
        flexShrink: 0,
      }}
    >
      {copied ? '已复制 ✓' : cmd}
    </span>
  )
}

// 视图切换芯片（v0.7.0）：框架图/列表视图、任务流图/列表视图 共用
function ViewToggle({ view, graphValue, listValue, graphLabel, listLabel, onChange }) {
  const chip = (active) => ({
    padding: '1px 8px',
    borderRadius: 9,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.muted,
    fontSize: 10,
    lineHeight: '16px',
    cursor: 'pointer',
    flexShrink: 0,
  })
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button type="button" onClick={() => onChange(graphValue)} style={chip(view === graphValue)}>{graphLabel}</button>
      <button type="button" onClick={() => onChange(listValue)} style={chip(view === listValue)}>{listLabel}</button>
    </span>
  )
}

// ---------------------------------------------------------------- 团队标签 ----

// 任务状态 → data-state 口径（v0.9.0 对齐 agent-teams progressSegments data-state 模式：
// pending/claimed/running/completed/failed/cancelled——claimed 从「进行中」拆出独立分段与图例）
function taskToneOf(status) {
  if (status === 'claimed') return 'claimed'
  if (status === 'in_progress') return 'running'
  if (status === 'pending' || status == null) return 'pending'
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'
  return 'cancelled' // cancelled / deleted
}

const SEG_COLOR = {
  pending: C.warn,
  claimed: C.accent,
  running: C.accent,
  completed: C.ok,
  failed: C.err,
  cancelled: C.faint,
}

// 分段水平进度条：每任务一段（flex 等宽），按状态着色 —— agent-teams ProgressOverview 模式
// 失败计数不含 cancelled/deleted（v0.5.0 修复 + X2：取消/删除是主动放弃或清理，不是审查意义上的
// 失败；图例中 cancelled/deleted 共用灰色口径）
// v0.9.0：分段与图例带 data-state（样式钩子/测试探针）+ claimed 独立图例 + 底部状态摘要行
//（agent-teams progressSummary 模式：一句话概括当前状态，tone=running|warning|completed）
function ProgressOverview({ tasks }) {
  const count = (st) => tasks.filter((t) => t.status === st).length
  const pending = count('pending')
  const claimed = count('claimed')
  const running = count('in_progress')
  const completed = count('completed')
  const failed = count('failed')
  const cancelled = count('cancelled')
  const deleted = count('deleted')
  // 受阻 = pending/claimed 但依赖里有未终态任务（TaskBoard/DAG 同口径）
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const blockedIds = tasks
    .filter((t) => (t.blockedBy || []).some((dep) => {
      const d = tasksById.get(dep)
      return d && !TERMINAL_STATUS.has(d.status)
    }))
    .filter((t) => t.status === 'pending' || t.status === 'claimed')
    .map((t) => t.id)
  // 状态摘要（agent-teams taskSummary 精简版）
  const terminalAll = tasks.length > 0 && tasks.every((t) => TERMINAL_STATUS.has(t.status))
  let summaryText = '还没有任务——让队长 sci_team_dispatch 派发第一项工作'
  let summaryTone = 'running'
  if (tasks.length === 0) {
    summaryTone = 'empty'
  } else if (terminalAll) {
    summaryText = `全部结束：完成 ${completed}${failed ? ` · 失败 ${failed}` : ''}${cancelled + deleted ? ` · 取消/删除 ${cancelled + deleted}` : ''}`
    summaryTone = failed > 0 ? 'warning' : 'completed'
  } else if (blockedIds.length > 0) {
    summaryText = `受阻 ${blockedIds.slice(0, 2).join('、')}${blockedIds.length > 2 ? ` 等 ${blockedIds.length} 项（依赖未完成）` : '（依赖未完成）'}`
    summaryTone = 'warning'
  } else if (running > 0 || claimed > 0) {
    const act = tasks.filter((t) => t.status === 'in_progress' || t.status === 'claimed').map((t) => t.id)
    summaryText = `执行中 ${act.slice(0, 3).join('、')}${act.length > 3 ? ` 等 ${act.length} 项` : ''}`
  } else if (pending > 0) {
    summaryText = `${pending} 项待领（sci_team_dispatch 指派成员）`
  }
  return (
    <div style={{ margin: '8px 0 10px', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={26} />
        <b style={{ fontSize: 12, color: C.fg }}>科研小队</b>
        <span style={{ fontSize: 10, color: C.muted }}>队长统筹 · 成员执行</span>
      </div>
      <div
        aria-hidden
        data-progress-segments=""
        style={{
          display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden',
          background: tasks.length === 0 ? C.chip : 'transparent',
        }}
      >
        {tasks.map((t) => (
          <span key={t.id} data-state={taskToneOf(t.status)} style={{ flex: 1, background: SEG_COLOR[taskToneOf(t.status)] || C.faint }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 7, fontSize: 12, color: C.fg }} data-progress-legend="">
        <span data-state="pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.warn} />待办 {pending}</span>
        {claimed > 0 && (
          <span data-state="claimed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.accent} />已领取 {claimed}</span>
        )}
        <span data-state="running" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.accent} />进行中 {running}</span>
        <span data-state="completed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.ok} />已完成 {completed}</span>
        {failed > 0 && (
          <span data-state="failed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.err} />失败 {failed}</span>
        )}
        {cancelled > 0 && (
          <span data-state="cancelled" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.faint} />已取消 {cancelled}</span>
        )}
        {deleted > 0 && (
          <span data-state="cancelled" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Dot color={C.faint} />已删除 {deleted}</span>
        )}
      </div>
      <div
        data-progress-summary=""
        data-tone={summaryTone}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, color: summaryTone === 'warning' ? C.err : summaryTone === 'completed' ? C.ok : C.muted }}
      >
        <Dot color={summaryTone === 'warning' ? C.err : summaryTone === 'completed' ? C.ok : C.accent} size={6} />
        <span>{summaryText}</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------ 成员带（动作姿态）----

// 成员吉祥物查找（v0.9.0 提取共用：MemberStrip / CaptainInbox / DAG ownerMascotOf 同源）
function mascotForMember(name, members, roles) {
  const m = (members || []).find((x) => x && x.name === name)
  if (!m) return null
  const meta = (roles || {})[m.role]
  return (meta && meta.mascot) || ROLE_MASCOT_FALLBACK[m.role] || null
}

// 成员带（v0.7.0 形态 · v0.9.0 对齐 agent-teams memberRow 能力）：DAG 顶部一排 40px 吉祥物头像——
//   动作姿态随状态变化（running→working 弧 + bob 动画 / 有待办→thinking / 离线→灰度）
// v0.9.0 新增（agent-teams ActivityPanel 对齐）：
//   · hover 高亮（CSS data-member-tile:hover）+ 角色标签行（meta.label）+ 状态文本行（LIVE_LABEL）
//   · 点击「▾」展开该成员的任务子列表（filter by assignee，含回报摘要）——点击头像本体仍是
//     打开成员会话（agent-teams 同款点击语义，展开是独立点击目标，互不干扰）
function MemberStrip({ members, tasks, roles, memberLive, openMemberSession, memberOpenAvailable }) {
  const [expandedMember, setExpandedMember] = useState(null)
  const roleMetaOf = (m) => {
    const table = roles || {}
    if (m.role && table[m.role]) return table[m.role]
    return Object.values(table).find((r) => r && r.member === m.name) || {}
  }
  let openable = false
  try {
    openable = typeof memberOpenAvailable === 'function' ? !!memberOpenAvailable() : false
  } catch {
    openable = false
  }
  const expTaskList = expandedMember ? tasks.filter((t) => t.assignee === expandedMember) : []
  return (
    <div
      data-member-strip=""
      style={{ borderBottom: `1px solid ${C.divider}`, marginBottom: 8 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 2px', padding: '2px 0 8px' }}>
        {members.map((m) => {
          const meta = roleMetaOf(m)
          const mascot = meta.mascot || ROLE_MASCOT_FALLBACK[m.role] || null
          const live = (memberLive && memberLive[m.name]) || 'offline'
          const owned = tasks.filter((t) => t.assignee === m.name && !TERMINAL_STATUS.has(t.status))
          const running = live === 'running' || live === 'claimed/working'
          const pose = running ? 'working' : owned.length > 0 ? 'thinking' : 'idle'
          const offline = live === 'offline'
          const poseLabel = pose === 'working' ? '正在执行' : pose === 'thinking' ? '领了任务待开工' : '暂无在办'
          const isExp = expandedMember === m.name
          return (
            <div
              key={m.name}
              data-member-tile=""
              data-member-pose={pose}
              data-live={live}
              onClick={openable ? () => { try { openMemberSession(m) } catch { /* TeamTab 统一 toast */ } } : undefined}
              title={`${m.name} · ${meta.label || m.label || ''} · ${LIVE_LABEL[live] || live} · ${poseLabel}（在办 ${owned.length}）${openable ? ' · 点击头像打开会话' : ''}`}
              style={{
                width: 66,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                padding: '3px 2px',
                borderRadius: 8,
                cursor: openable ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  filter: offline ? 'grayscale(1)' : 'none',
                  opacity: offline ? 0.55 : 1,
                  animation: running ? 'dsh-sci-bob 1.4s ease-in-out infinite' : undefined,
                }}
              >
                <MascotAvatar
                  file={mascot}
                  emoji={meta.icon}
                  size={40}
                  overlay={<ActionOverlay file={pose === 'working' ? 'working.svg' : pose === 'thinking' ? 'thinking.svg' : null} avatarSize={40} />}
                />
                <span
                  style={{
                    position: 'absolute', right: -1, top: -1, width: 9, height: 9,
                    borderRadius: '50%', background: LIVE_COLOR[live] || C.faint,
                    border: '1.5px solid rgba(127,127,127,0.2)',
                    animation: running ? 'dsh-sci-pulse 1.6s ease-in-out infinite' : undefined,
                  }}
                />
              </span>
              <b style={{ fontSize: 10, color: C.fg, maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{m.name}</b>
              <span style={{ fontSize: 9, color: C.muted, maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={meta.label || m.label || m.role || ''}>
                {meta.label || m.label || m.role || ''}
              </span>
              <span
                data-member-state=""
                style={{ fontSize: 9, color: LIVE_COLOR[live] || C.faint, lineHeight: '12px' }}
                title={`${LIVE_LABEL[live] || live} · ${poseLabel}`}
              >
                {LIVE_LABEL[live] || live}
              </span>
              <span
                title={`在办任务 ${owned.length} 个`}
                style={{
                  minWidth: 16, textAlign: 'center', padding: '0 4px', borderRadius: 8,
                  fontSize: 9, lineHeight: '14px',
                  color: owned.length > 0 ? '#fff' : C.muted,
                  background: owned.length > 0 ? (running ? C.ok : C.accent) : C.chip,
                }}
              >
                {owned.length}
              </span>
              <span
                data-member-expand={isExp ? 'open' : 'closed'}
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedMember(isExp ? null : m.name)
                }}
                title={isExp ? `收起 ${m.name} 的任务列表` : `展开 ${m.name} 的任务列表（${tasks.filter((t) => t.assignee === m.name).length}）`}
                style={{ fontSize: 9, color: isExp ? C.accent : C.faint, cursor: 'pointer', lineHeight: '12px', padding: '0 6px' }}
              >
                {isExp ? '▴' : '▾'}
              </span>
            </div>
          )
        })}
      </div>
      {expandedMember && (
        <div
          data-member-tasks=""
          data-member={expandedMember}
          style={{ border: `1px solid ${C.divider}`, borderRadius: 8, background: C.chip, padding: '5px 8px', marginBottom: 8, fontSize: 11 }}
        >
          <div style={{ color: C.faint, marginBottom: 3 }}>
            {expandedMember} 的任务（{expTaskList.length}）——点击成员头像打开会话
          </div>
          {expTaskList.length === 0 && <Empty>该成员暂无任务记录。</Empty>}
          {expTaskList.map((t) => (
            <div
              key={t.id}
              data-member-task-row={t.id}
              title={`${t.id} · ${t.subject || ''} · ${t.status}${t.result ? ` · 回报：${t.result}` : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', color: C.fg }}
            >
              <Dot color={STATUS_COLOR[t.status] || C.faint} size={6} />
              <DepChip id={t.id} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || t.id}</span>
              {t.result && (
                <span style={{ color: C.ok, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }} title={t.result}>
                  ↩ {String(t.result).slice(0, 30)}
                </span>
              )}
              <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(t.updatedAt || t.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------- 任务流 DAG ----

// DAG 画布参数（v0.7.1）：四状态列 kanban（待办 → 进行中 → 已完成 → 已结束），节点按依赖深度排序
const DAG_CAP = 18
const DAG_NODE_W = 150
const DAG_NODE_H = 50
const DAG_COL_GAP = 54
const DAG_ROW_GAP = 12
const DAG_PAD_X = 10
const DAG_HEAD_H = 24

// F3（v0.7.1）：failed/cancelled/deleted 不再混入「已完成」，单列「已结束」（按终态语义分色：
// 节点左缘色条仍随具体状态——failed 红 / cancelled·deleted 灰）
const DAG_COLS = [
  { label: '待办', color: C.warn },
  { label: '进行中', color: C.accent },
  { label: '已完成', color: C.ok },
  { label: '已结束', color: C.faint },
]

// 状态 → 列号（v0.7.1）：pending→待办；claimed/in_progress→进行中；completed→已完成；
// failed/cancelled/deleted→已结束
function statusColIndex(status) {
  if (status === 'claimed' || status === 'in_progress') return 1
  if (status === 'completed') return 2
  if (status === 'pending' || status == null) return 0
  return 3
}

// F1（v0.7.1）选点用列配额：连通核心优先占位，四列保底（待办6/进行中6/已完成4/已结束2，
// 合计 18=CAP）——已结束列始终有代表节点（失败任务可见），余量按列轮流回填
const DAG_COL_QUOTAS = [6, 6, 4, 2]
// F3：连通核心之外为「已结束」列保留的席位（核心预算 = CAP - 2，保证失败任务可见）
const DAG_ENDED_RESERVE = 2

// 最长路径分层（参考 agent-teams compactDagLayout 的 task.depth 思想）：dep 无依赖则 depth 0，
// 否则 1 + max(dep.depth)。环（脏数据）→ 栈内直接返回 0 防爆栈，仅影响布局不影响数据。
function depDepthOf(tasksById, id, memo, stack) {
  if (memo.has(id)) return memo.get(id)
  if (stack.has(id)) return 0
  stack.add(id)
  const t = tasksById.get(id)
  let d = 0
  if (t && Array.isArray(t.blockedBy)) {
    for (const dep of t.blockedBy) {
      const dd = depDepthOf(tasksById, dep, memo, stack)
      if (dd + 1 > d) d = dd + 1
    }
  }
  stack.delete(id)
  memo.set(id, d)
  return d
}

function dagNumId(t) {
  const m = /(\d+)/.exec(String(t.id))
  return m ? parseInt(m[1], 10) : 0
}

// 依赖边贝塞尔路径：跨列沿阅读方向（右→左进），回边/同列走竖向 S 弯
function dagEdgePath(a, b) {
  if (b.col > a.col) {
    const x1 = a.x + DAG_NODE_W
    const y1 = a.y + DAG_NODE_H / 2
    const x2 = b.x
    const y2 = b.y + DAG_NODE_H / 2
    const dx = Math.max(18, (x2 - x1) / 2)
    return `M${x1} ${y1}C${x1 + dx} ${y1},${x2 - dx} ${y2},${x2} ${y2}`
  }
  if (b.col < a.col) {
    const x1 = a.x
    const y1 = a.y + DAG_NODE_H / 2
    const x2 = b.x + DAG_NODE_W
    const y2 = b.y + DAG_NODE_H / 2
    const dx = Math.max(18, (x1 - x2) / 2)
    return `M${x1} ${y1}C${x1 - dx} ${y1},${x2 + dx} ${y2},${x2} ${y2}`
  }
  const x1 = a.x + DAG_NODE_W / 2
  const y1 = a.y + DAG_NODE_H
  const x2 = b.x + DAG_NODE_W / 2
  const y2 = b.y
  if (y2 >= y1) {
    const dy = Math.max(16, (y2 - y1) / 2)
    return `M${x1} ${y1}C${x1} ${y1 + dy},${x2} ${y2 - dy},${x2} ${y2}`
  }
  const dy = Math.max(16, (y1 - y2) / 2)
  return `M${x1} ${y1}C${x1} ${y1 - dy},${x2} ${y2 + dy},${x2} ${y2}`
}

// 依赖反向索引：dep id → 引用它的任务 id 列表（F1 连通 BFS 的「被依赖」方向遍历用）
function dependentsMapOf(tasks) {
  const map = new Map()
  for (const t of tasks) {
    if (!t) continue
    for (const dep of Array.isArray(t.blockedBy) ? t.blockedBy : []) {
      if (!map.has(dep)) map.set(dep, [])
      map.get(dep).push(t.id)
    }
  }
  return map
}

// DAG 布局（v0.7.1）：x=状态列（四列），y=列内按（依赖深度, 数字 id）排序；选取上限 cap
// （默认 18，F6 展开 = Infinity 全量）。选点三阶段（F1 连通性优先）：
//   ① 连通核心：从进行中/待办种子出发沿 blockedBy 双向 BFS（依赖 + 被依赖），
//      被引用任务与其依赖同屏——task-31→32→33→34 全链可见，不出现「32/34 被 +N 隐藏」；
//   ② 配额回填：按列（进行中→待办→已完成→已结束）取各列 top（深度,id) 补足保底配额；
//   ③ 余量循环回填：配额满但 CAP 未满时按列轮流补位（已结束优先）。
// ensureId（focusTaskId）强制入选，满员时挤出最后回填节点，不突破 CAP（F7）。
// 列头计数 = 全量任务按状态列统计（F3），与选中子集无关。
// 仅绘制两端均可见的依赖边（溢出节点不画断头线）；edge key 去重（F7，blockedBy 脏数据容错）。
function dagLayout(tasks, ensureId, cap) {
  const maxNodes = typeof cap === 'number' ? cap : DAG_CAP
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const depthMemo = new Map()
  const wrapped = tasks.map((t) => ({
    t,
    col: statusColIndex(t.status),
    depth: depDepthOf(tasksById, t.id, depthMemo, new Set()),
  }))
  const wrapById = new Map(wrapped.map((w) => [w.t.id, w]))
  const byCol = [[], [], [], []]
  for (const w of wrapped) byCol[w.col].push(w)
  byCol.forEach((list) => list.sort((a, b) => (a.depth - b.depth) || (dagNumId(a.t) - dagNumId(b.t))))
  // F3：列头真实计数——全量 tasks 而非选中子集
  const colTotals = [0, 0, 0, 0]
  for (const w of wrapped) colTotals[w.col] += 1
  const dependentsOf = dependentsMapOf(tasks)
  const chosen = []
  const chosenSet = new Set()
  const counts = [0, 0, 0, 0]
  const push = (w, ignoreQuota) => {
    if (!w || chosenSet.has(w.t.id) || chosen.length >= maxNodes) return
    if (!ignoreQuota && counts[w.col] >= DAG_COL_QUOTAS[w.col]) return
    chosen.push(w)
    chosenSet.add(w.t.id)
    counts[w.col] += 1
  }
  // ① 连通核心（F1）：多源 BFS——种子 = 全部进行中/待办（按 深度,id 排序一次性入队），
  // 队首种子先于其拉入的终态邻居出队 → 活动任务全部入选后才开始收其已完成依赖；
  // 邻居扩展活动优先。queued 集合保证每个 id 至多入队一次（否则 A↔B 互为依赖/被依赖时
  // 会无限循环——v0.7.1 初版实测踩坑，页面假死）。本阶段不受列配额限制（链路完整优先），
  // 仅受 coreCap = maxNodes - 已结束保留席位约束（给 F3 的已结束列留代表席位）。
  const coreCap = Math.max(0, maxNodes - DAG_ENDED_RESERVE)
  const isActiveId = (id) => {
    const t = tasksById.get(id)
    return !!t && !TERMINAL_STATUS.has(t.status)
  }
  const seeds = wrapped
    .filter((w) => w.col === 0 || w.col === 1)
    .sort((a, b) => (a.depth - b.depth) || (dagNumId(a.t) - dagNumId(b.t)))
    .map((w) => w.t.id)
  const queue = []
  const queued = new Set()
  for (const id of seeds) {
    queue.push(id)
    queued.add(id)
  }
  while (queue.length && chosen.length < coreCap) {
    const id = queue.shift()
    push(wrapById.get(id), true)
    const t = tasksById.get(id)
    if (!t) continue
    const next = []
    for (const dep of Array.isArray(t.blockedBy) ? t.blockedBy : []) {
      if (!queued.has(dep)) {
        queued.add(dep)
        next.push(dep)
      }
    }
    for (const depId of dependentsOf.get(id) || []) {
      if (!queued.has(depId)) {
        queued.add(depId)
        next.push(depId)
      }
    }
    // 活动（待办/进行中）邻居排前，终态邻居靠后
    next.sort((x, y) => (isActiveId(y) ? 1 : 0) - (isActiveId(x) ? 1 : 0))
    queue.push(...next)
  }
  // ② 已结束保留席位（F3）：failed/cancelled/deleted 至少 DAG_ENDED_RESERVE 个可见
  for (const w of byCol[3]) {
    if (chosen.length >= maxNodes || counts[3] >= DAG_ENDED_RESERVE) break
    push(w)
  }
  // ③ 余量循环回填（已完成 → 已结束 → 待办 → 进行中 轮流补位，突破配额到 CAP 为止）
  while (chosen.length < maxNodes) {
    let added = false
    for (const c of [2, 3, 0, 1]) {
      if (chosen.length >= maxNodes) break
      const w = byCol[c].find((x) => !chosenSet.has(x.t.id))
      if (w) {
        chosen.push(w)
        chosenSet.add(w.t.id)
        counts[c] += 1
        added = true
      }
    }
    if (!added) break
  }
  // ensureId 强制入选（F7：满员挤出最后回填节点，不突破 CAP）
  if (ensureId && !chosenSet.has(ensureId)) {
    const w = wrapById.get(ensureId)
    if (w) {
      if (chosen.length >= maxNodes && chosen.length > 0) {
        const evicted = chosen.pop()
        chosenSet.delete(evicted.t.id)
        counts[evicted.col] -= 1
      }
      chosen.push(w)
      chosenSet.add(w.t.id)
      counts[w.col] += 1
    }
  }
  const colLists = [[], [], [], []]
  for (const w of chosen) colLists[w.col].push(w)
  const nodes = []
  colLists.forEach((list, c) => {
    list.forEach((w, row) => {
      nodes.push({ w, col: c, x: DAG_PAD_X + c * (DAG_NODE_W + DAG_COL_GAP), y: DAG_HEAD_H + row * (DAG_NODE_H + DAG_ROW_GAP) })
    })
  })
  const posById = new Map(nodes.map((n) => [n.w.t.id, n]))
  const edges = []
  const edgeSeen = new Set()
  for (const n of nodes) {
    for (const dep of Array.isArray(n.w.t.blockedBy) ? n.w.t.blockedBy : []) {
      const key = `${dep}->${n.w.t.id}`
      if (edgeSeen.has(key)) continue // F7：blockedBy 重复项 → 边去重
      edgeSeen.add(key)
      const s = posById.get(dep)
      if (!s) continue
      const depTask = tasksById.get(dep)
      edges.push({ from: dep, to: n.w.t.id, d: dagEdgePath(s, n), active: depTask ? !TERMINAL_STATUS.has(depTask.status) : true })
    }
  }
  const rows = Math.max(1, ...colLists.map((l) => l.length))
  const width = DAG_PAD_X * 2 + DAG_COLS.length * DAG_NODE_W + (DAG_COLS.length - 1) * DAG_COL_GAP
  const height = DAG_HEAD_H + rows * (DAG_NODE_H + DAG_ROW_GAP) - DAG_ROW_GAP + 6
  return { nodes, edges, width, height, hidden: tasks.length - chosen.length, colCounts: colTotals, tasksById }
}

// 任务详情卡：DAG 节点点击展开 / 列表视图行内展开共用（desc/result/依赖/时间戳）。
// v0.9.0：onJumpTask 提供时，依赖（含已完成）渲染为可点击 chip → 跳转目标任务行/节点
//（对齐 agent-teams 任务详情的依赖可追踪语义）；未提供时保持纯文本。
function TaskDetailCard({ t, tasksById, onJumpTask }) {
  if (!t) return null
  const deps = Array.isArray(t.blockedBy) ? t.blockedBy : []
  const unfinishedDeps = deps.filter((dep) => {
    const depTask = tasksById.get(dep)
    return depTask ? !TERMINAL_STATUS.has(depTask.status) : false
  })
  const blocked = unfinishedDeps.length > 0
  const jumpable = typeof onJumpTask === 'function'
  return (
    <div
      data-task-detail={t.id}
      style={{
        border: `1px solid ${C.divider}`, borderRadius: 8,
        padding: '6px 10px', marginBottom: 4,
        background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6,
      }}
    >
      <div style={{ color: C.faint }}>{t.id} · 状态 {t.status} · 负责人 {t.assignee || '待领'}{t.resultId ? ` · 对齐 ${t.resultId}` : ''}</div>
      {deps.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ color: C.faint, flexShrink: 0 }}>依赖：</span>
          {deps.map((dep) => {
            const depTask = tasksById.get(dep)
            const depOpen = depTask ? !TERMINAL_STATUS.has(depTask.status) : true
            return (
              <span
                key={dep}
                data-dep-chip={dep}
                onClick={(e) => {
                  e.stopPropagation()
                  if (jumpable) {
                    try { onJumpTask(dep) } catch { /* ignore */ }
                  }
                }}
                title={depTask ? `${dep} · ${depTask.subject || ''} · ${depTask.status} · 点击${jumpable ? '跳转' : '查看'}` : `${dep}（不在任务板上）`}
                style={{
                  display: 'inline-block', padding: '0 6px', borderRadius: 8,
                  border: `1px solid ${depOpen ? C.warn : C.border}`,
                  background: C.card,
                  fontSize: 10, lineHeight: '16px',
                  color: depOpen ? C.warn : C.muted,
                  cursor: jumpable ? 'pointer' : 'default',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {dep}{depOpen ? ' ⏳' : ' ✓'}
              </span>
            )
          })}
        </div>
      )}
      {t.desc && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: C.fg }}>{t.desc}</div>}
      {t.result && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}><b style={{ color: C.ok }}>结果：</b>{t.result}</div>}
      <div style={{ marginTop: 4, color: C.faint }}>
        创建 {fmtTime(t.createdAt) || '—'}
        {t.claimedAt ? ` · 领取 ${fmtTime(t.claimedAt)}` : ''}
        {t.updatedAt ? ` · 更新 ${fmtTime(t.updatedAt)}` : ''}
      </div>
    </div>
  )
}

// 任务流 DAG 画布（v0.7.1）：四状态列 + 依赖边（<title> hover，F6）+ 节点点击详情 +
// 「+N 更多」点击展开全量节点（F6，CAP 切至 Infinity）。纯 SVG/CSS，无三方库。
function TaskDag({ tasks, members, roles, focusTaskId, onClearFocus }) {
  const [sel, setSel] = useState(null)
  // F6：展开全部（CAP → 全量）；点击底部「+N 更多」置位，展开后显示「收起」
  const [expandedAll, setExpandedAll] = useState(false)
  // F7：SVG marker id 加实例唯一前缀（多实例/热重载下 DOM 全局 id 不串线）
  const uidRef = useRef('')
  if (!uidRef.current) uidRef.current = `dshsci-${Math.random().toString(36).slice(2, 8)}`
  const uid = uidRef.current
  const layout = useMemo(
    () => dagLayout(tasks, focusTaskId || sel || null, expandedAll ? Infinity : DAG_CAP),
    [tasks, focusTaskId, sel, expandedAll],
  )
  const vpRef = useRef(null)
  useEffect(() => {
    // 初始与展开时把视口滚到末列（已结束），失败/取消节点可见
    try {
      const el = vpRef.current
      if (el && layout.width) el.scrollLeft = Math.max(0, layout.width - el.clientWidth)
    } catch {
      /* ignore */
    }
  }, [expandedAll, layout.width])
  useEffect(() => {
    if (!focusTaskId) return undefined
    setSel(focusTaskId)
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-dag-node="${focusTaskId}"]`)
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      } catch {
        /* ignore */
      }
      if (typeof onClearFocus === 'function') onClearFocus()
    }, 120)
    return () => clearTimeout(timer)
  }, [focusTaskId])
  const memberByName = useMemo(() => new Map((members || []).map((m) => [m.name, m])), [members])
  const ownerMascotOf = (assignee) => {
    const m = memberByName.get(assignee)
    if (!m) return null
    const meta = (roles || {})[m.role]
    return (meta && meta.mascot) || ROLE_MASCOT_FALLBACK[m.role] || null
  }
  // v0.9.0：依赖 chip 跳转——选中目标任务节点并滚动到可见；节点被 +N 隐藏时先展开全量再滚
  const jumpToTask = useCallback((id) => {
    if (!id) return
    setSel(id)
    const attempt = (n) => {
      setTimeout(() => {
        try {
          const el = document.querySelector(`[data-dag-node="${id}"]`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
            return
          }
        } catch {
          /* ignore */
        }
        if (n === 0) {
          setExpandedAll(true)
          attempt(1)
        }
      }, 60)
    }
    attempt(0)
  }, [])
  const selTask = sel ? layout.tasksById.get(sel) : null
  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 6px 4px' }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={44} style={{ display: 'inline-flex' }} />
        <Empty>暂无任务。队长用 sci_team_dispatch 派发，成员会自动被唤醒执行。</Empty>
      </div>
    )
  }
  return (
    <div>
      <div
        data-dag-viewport=""
        ref={vpRef}
        style={{ maxHeight: 380, overflow: 'auto', border: `1px solid ${C.divider}`, borderRadius: 8, background: C.card, position: 'relative' }}
      >
        <div data-dag-canvas="" style={{ position: 'relative', width: layout.width, height: layout.height }}>
          {/* 列头 */}
          {DAG_COLS.map((c, i) => (
            <div
              key={c.label}
              data-dag-col={c.label}
              style={{
                position: 'absolute', left: DAG_PAD_X + i * (DAG_NODE_W + DAG_COL_GAP), top: 4, width: DAG_NODE_W,
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted,
              }}
            >
              <Dot color={c.color} size={6} />
              {c.label} {layout.colCounts[i]}
            </div>
          ))}
          {/* 依赖边层（SVG 贝塞尔箭头；active=上游未完成） */}
          <svg
            data-dag-edges=""
            width={layout.width}
            height={layout.height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
            aria-hidden
          >
            <defs>
              <marker id={`${uid}-arrow-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L8 4 L0 8 Z" style={{ fill: C.accent }} />
              </marker>
              <marker id={`${uid}-arrow-f`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L8 4 L0 8 Z" style={{ fill: C.faint }} />
              </marker>
            </defs>
            {layout.edges.map((e) => (
              <path
                key={`${e.from}->${e.to}`}
                data-dag-edge={`${e.from}->${e.to}`}
                d={e.d}
                fill="none"
                style={{ stroke: e.active ? C.accent : C.faint, pointerEvents: 'stroke' }}
                strokeWidth={e.active ? 1.6 : 1}
                strokeDasharray={e.active ? undefined : '3 3'}
                opacity={e.active ? 0.9 : 0.55}
                markerEnd={e.active ? `url(#${uid}-arrow-a)` : `url(#${uid}-arrow-f)`}
              >
                {/* F6：hover 显示依赖语义（svg 自身 pointer-events:none，path 以 stroke 命中） */}
                <title>{`${e.from} → ${e.to} 依赖`}</title>
              </path>
            ))}
          </svg>
          {/* 任务节点层 */}
          {layout.nodes.map(({ w, x, y, col }) => {
            const t = w.t
            const isSel = sel === t.id
            const running = t.status === 'claimed' || t.status === 'in_progress'
            const color = STATUS_COLOR[t.status] || C.faint
            return (
              <div
                key={t.id}
                data-dag-node={t.id}
                data-status={t.status}
                data-col={DAG_COLS[col].label}
                onClick={() => setSel(isSel ? null : t.id)}
                title={`${t.id} · ${t.subject || ''} · ${t.assignee || '待领'} · 点击${isSel ? '收起' : '展开'}详情`}
                style={{
                  position: 'absolute', left: x, top: y, width: DAG_NODE_W, height: DAG_NODE_H,
                  // F2：节点用更高层 surface（bg-layer-2）+ border-l4 边框（暗色 alpha 0.2 ≥ 0.18）
                  border: `1px solid ${isSel ? C.accent : C.borderNode}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8, background: isSel ? C.chip : C.surface,
                  padding: '3px 6px', cursor: 'pointer',
                  animation: running ? 'dsh-sci-nodeglow 2.2s ease-in-out infinite' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 15 }}>
                  <span style={{ fontSize: 9, color: C.faint, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{t.id}</span>
                  {t.result && (
                    <span title={`有回报摘要：${String(t.result).slice(0, 80)}`} style={{ fontSize: 9, color: C.ok, flexShrink: 0 }}>↩</span>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: DAG_NODE_W - 46, overflow: 'hidden' }}>
                    <span style={{ fontSize: 9, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignee || '待领'}</span>
                    <MascotAvatar file={ownerMascotOf(t.assignee)} emoji="👤" size={13} />
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11, color: C.fg, lineHeight: '13px', height: 26, marginTop: 1,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-all',
                  }}
                >
                  {t.subject || t.id}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {layout.hidden > 0 ? (
        // F6：可点击展开全部隐藏节点（CAP 切至全量）
        <div style={{ textAlign: 'center', padding: '3px 0 0' }}>
          <button
            data-dag-expand=""
            onClick={() => setExpandedAll(true)}
            title="点击展开全部任务节点"
            style={{
              fontSize: 10, color: C.accent, background: 'transparent', border: 'none',
              cursor: 'pointer', padding: '2px 8px', textDecoration: 'underline',
            }}
          >
            +{layout.hidden} 更多（点击展开全部）
          </button>
        </div>
      ) : (
        expandedAll && tasks.length > DAG_CAP && (
          <div style={{ textAlign: 'center', padding: '3px 0 0' }}>
            <button
              data-dag-collapse=""
              onClick={() => setExpandedAll(false)}
              title="收起，回到 18 节点概览"
              style={{
                fontSize: 10, color: C.muted, background: 'transparent', border: 'none',
                cursor: 'pointer', padding: '2px 8px', textDecoration: 'underline',
              }}
            >
              收起（已展开全部 {tasks.length} 个节点）
            </button>
          </div>
        )
      )}
      <div style={{ marginTop: 6 }} data-task-detail-host="">
        {selTask ? (
          <TaskDetailCard t={selTask} tasksById={layout.tasksById} onJumpTask={jumpToTask} />
        ) : (
          <Empty>点击任务节点查看详情（描述/结果/依赖/时间）；依赖 chip 可点击跳转；点击上方成员头像打开会话，▾ 展开其任务列表。</Empty>
        )}
      </div>
    </div>
  )
}

// 任务板（列表视图，v0.4.0 起的原平铺列表；v0.7.0 起作为 DAG 的回退视图）
// 状态点 + 任务号 chip（task-N，fix3）+ 标题(粗体，单行截断) + 负责人 + res-N 对齐徽章
// （fix5）+ blockedBy 徽章 + 更新时间。最新在前，上限 20。
// 依赖未完成（blockedBy 里有任务板上非终态的 dep）→ 灰色状态点 + 「阻塞」chip（v0.5.0）。
// 超过 20 条时底部显示「还有 N 条…」。行点击 → 展开/收起详情区（TaskDetailCard）。
// fix3：focusTaskId（文章 tab 任务 chip 跳转）→ 自动展开该行 + scrollIntoView，处理后清除。
function TaskBoard({ tasks, focusTaskId, onClearFocus }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // fix3：跨标签聚焦——展开目标行 + 滚动到可见，处理完即清除 focus（3s 轮询重渲染不重复滚动）
  useEffect(() => {
    if (!focusTaskId) return undefined
    setExpanded((prev) => {
      if (prev.has(focusTaskId)) return prev
      const next = new Set(prev)
      next.add(focusTaskId)
      return next
    })
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-task-row="${focusTaskId}"]`)
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        /* ignore */
      }
      if (typeof onClearFocus === 'function') onClearFocus()
    }, 120)
    return () => clearTimeout(timer)
  }, [focusTaskId])
  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 6px 4px' }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={44} style={{ display: 'inline-flex' }} />
        <Empty>暂无任务。队长用 sci_team_dispatch 派发，成员会自动被唤醒执行。</Empty>
      </div>
    )
  }
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  // v0.9.0：依赖 chip 跳转——展开目标任务行 + scrollIntoView（列表视图版 jumpToTask）
  const jumpToTask = (id) => {
    if (!id || !tasksById.has(id)) return
    setExpanded((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setTimeout(() => {
      try {
        const el = document.querySelector(`[data-task-row="${id}"]`)
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        /* ignore */
      }
    }, 60)
  }
  const rows = [...tasks]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 20)
  // 聚焦任务在 20 条之外时提升进可见列表（保证自动展开/滚动可达）
  if (focusTaskId) {
    const focusTask = tasks.find((t) => t && t.id === focusTaskId)
    if (focusTask && !rows.some((t) => t.id === focusTaskId)) rows.unshift(focusTask)
  }
  const hidden = tasks.length - rows.length
  return (
    <div>
      {rows.map((t) => {
        const isOpen = expanded.has(t.id)
        const unfinishedDeps = (t.blockedBy || []).filter((dep) => {
          const depTask = tasksById.get(dep)
          return depTask ? !TERMINAL_STATUS.has(depTask.status) : false
        })
        const blocked = unfinishedDeps.length > 0
        return (
          <div key={t.id}>
            <div
              data-task-row={t.id}
              onClick={() => toggle(t.id)}
              title={`${t.id} · 点击${isOpen ? '收起' : '展开'}详情`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', marginBottom: 4,
                border: `1px solid ${C.border}`, borderRadius: 8, background: C.card,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <Dot color={blocked ? C.faint : STATUS_COLOR[t.status] || C.faint} size={7} />
              <DepChip id={t.id} />
              <b style={{ color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>
                {t.subject || t.id}
              </b>
              <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>{t.assignee || '待领'}</span>
              {t.resultId && <ResBadge id={t.resultId} />}
              {t.result && (
                <span
                  title={`回报摘要：${t.result}`}
                  style={{ color: C.ok, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}
                >
                  ↩ {String(t.result).slice(0, 40)}
                </span>
              )}
              {blocked && <DepChip id="阻塞" />}
              {(t.blockedBy || []).length > 0 && (
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                  {(t.blockedBy || []).slice(0, 3).map((dep) => {
                    const depTask = tasksById.get(dep)
                    const depOpen = depTask ? !TERMINAL_STATUS.has(depTask.status) : true
                    return (
                      <span
                        key={dep}
                        data-row-dep-chip={dep}
                        onClick={(e) => { e.stopPropagation(); jumpToTask(dep) }}
                        title={`${dep}${depTask ? ` · ${depTask.status}` : ''} · 点击跳转该任务`}
                        style={{
                          display: 'inline-block', padding: '0 6px', marginLeft: 4, borderRadius: 8,
                          border: `1px solid ${depOpen ? C.warn : C.border}`,
                          fontSize: 10, lineHeight: '16px',
                          color: depOpen ? C.warn : C.muted,
                          cursor: 'pointer', fontFamily: 'ui-monospace, monospace', flexShrink: 0,
                        }}
                      >
                        {dep}{depOpen ? ' ⏳' : ''}
                      </span>
                    )
                  })}
                </span>
              )}
              <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
                {fmtTime(t.updatedAt || t.createdAt)}
              </span>
              <span style={{ color: C.faint, fontSize: 10, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
            </div>
            {isOpen && <TaskDetailCard t={t} tasksById={tasksById} onJumpTask={jumpToTask} />}
          </div>
        )
      })}
      {hidden > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: C.faint, padding: '2px 0 6px' }}>
          还有 {hidden} 条…
        </div>
      )}
    </div>
  )
}

// 队长收件箱（v0.9.0，对齐 agent-teams WorkspaceSummary 的 captainInbox 卡）：成员回报摘要列表——
// 数据源 = team.json tasks 里带 result（result_note，sci_team_update_task 回写）的任务，
// 按 updatedAt 倒序取最近 8 条；行 = 成员吉祥物 + 任务号 + 回报摘要 + 时间。不是完整聊天记录：
// 只展示队长侧可见的回报摘要（agent-teams 同款克制语义）。
function CaptainInbox({ tasks, members, roles }) {
  const reports = (tasks || [])
    .filter((t) => t && typeof t.result === 'string' && t.result.trim() && t.status !== 'deleted')
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 8)
  if (reports.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '6px 4px 2px' }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={36} style={{ display: 'inline-flex' }} />
        <Empty>收件箱空。成员完成任务并回报后，队长用 sci_team_update_task 记录 result_note，回报摘要会出现在这里。</Empty>
      </div>
    )
  }
  return (
    <div data-captain-inbox="">
      {reports.map((t) => {
        const mascot = mascotForMember(t.assignee, members, roles)
        const member = (members || []).find((x) => x && x.name === t.assignee)
        const emoji = member ? ((roles || {})[member.role] || {}).icon : undefined
        return (
          <div
            key={t.id}
            data-inbox-row={t.id}
            title={`${t.assignee || '待领'} · ${t.subject || ''} · ${t.status} · ${t.result}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '4px 8px', marginBottom: 4,
              border: `1px solid ${C.border}`, borderRadius: 8, background: C.card,
              fontSize: 11,
            }}
          >
            <MascotAvatar file={mascot} emoji={emoji} size={20} style={{ marginTop: 1 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <b style={{ color: C.fg, flexShrink: 0 }}>{t.assignee || '待领'}</b>
                <DepChip id={t.id} />
                <Dot color={STATUS_COLOR[t.status] || C.faint} size={6} />
                <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>{fmtTime(t.updatedAt || t.createdAt)}</span>
              </div>
              <div style={{ color: C.fg, whiteSpace: 'pre-wrap', marginTop: 2, lineHeight: 1.5 }}>
                {String(t.result).slice(0, 160)}
                {String(t.result).length > 160 ? '…' : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------- 角色技能库（v0.9.0）----
// 数据来源：/state 快照 skillMenu 字段（lib/skillmenu.js skillMenuSnapshot）——
//   catalog: { <role>: [{id,name,description,license,subdir}] }（每角色 ≤3 精选开源仓库）
//   installed: { <role>: [{name, catalogId, warn, skillNames}] }
// 勾选/取消勾选 → POST /plugins/dsh-science/skill-manage {action:'install'|'remove', role, repoId/name}
// → host 侧 git clone --depth 1 到 role-skills/<role>/<name>/（角色隔离：不进全局技能注册表）。
const SKILL_MANAGE_URL = '/plugins/dsh-science/skill-manage'

// 桌面版降级用的静态目录镜像（与 lib/skillmenu.js CATALOG 保持一致——仅 id 列表，供命令 chip）
const SKILL_CATALOG_FALLBACK = {
  simulator: ['kdense-cantera', 'academicforge-compute-env', 'scimate-hpc-openfoam'],
  trainer: ['hf-llm-trainer', 'orchestra-fine-tuning', 'kdense-pytorch-lightning'],
  'literature-scout': ['kdense-bgpt-paper-search', 'kdense-exa-search', 'paper-search-pro'],
  writer: ['research-paper-writing', 'ai-research-writing', 'orchestra-paper-writing'],
  'figure-expert': ['academicforge-sci-viz', 'paperbanana', 'agent-figure-gallery'],
  reviewer: ['ars-paper-reviewer', 'manuscript-review', 'ai-peer-review'],
  analyst: ['kdense-eda', 'hf-datasets', 'kdense-dask'],
  'topic-designer': ['orchestra-ideation', 'kdense-experimental-design', 'academic-research-agent'],
  presentation: ['open-kimi-ppt', 'thesis-defense-pptx', 'beamer-academic'],
}

// 桌面版降级：无 webServer/断连时展示安装命令 chips（点击复制，经会话内的工具执行）。
function SkillMenuDesktopFallback() {
  const roleLabels = ROLE_LABEL_FALLBACK
  return (
    <details style={{ margin: '6px 0', fontSize: 12 }} data-skill-fallback>
      <summary style={{ cursor: 'pointer', color: C.muted }}>角色技能库安装命令（桌面版降级）</summary>
      <p style={{ color: C.faint, fontSize: 10, margin: '4px 0' }}>
        每角色 ≤3 个精选开源 skill 仓库；点击 chip 复制命令后发给队长执行。web 档案下可直接在团队 tab 勾选安装。
      </p>
      {Object.entries(SKILL_CATALOG_FALLBACK).map(([role, ids]) => (
        <div key={role} style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.fg, marginRight: 6 }}>{roleLabels[role] || role}</span>
          {ids.map((id) => (
            <span key={id} style={{ display: 'inline-block', marginRight: 4, marginBottom: 2 }}>
              <CmdChip cmd={`sci_skill_install role=${role} repo_id=${id}`} />
            </span>
          ))}
        </div>
      ))}
    </details>
  )
}

// 客户端兜底角色标签（state.roles meta 缺失时用；与 lib/roles.js 保持一致）
const ROLE_LABEL_FALLBACK = {
  'literature-scout': '📚 文献调研专员',
  'topic-designer': '💡 课题设计专家',
  simulator: '🖥 计算模拟专家',
  trainer: '🧠 模型训练专家',
  'figure-expert': '📊 科研绘图专家',
  writer: '📝 文章撰写专家',
  reviewer: '🔍 科研审查专家',
  analyst: '📈 数据分析师',
  presentation: '📽 汇报PPT专家',
}

function SkillMenuSection({ skillMenu, roles, notify, refresh }) {
  const catalog = (skillMenu && skillMenu.catalog) || {}
  const installed = (skillMenu && skillMenu.installed) || {}
  const [busyRole, setBusyRole] = useState(null)
  const [customUrl, setCustomUrl] = useState({})
  const roleEntries = Object.entries(roles || {}).filter(([id]) => catalog[id])
  const postManage = async (body, okMsg) => {
    const roleKey = body.role
    setBusyRole(roleKey)
    try {
      const res = await fetch(SKILL_MANAGE_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok || !result || result.ok !== true) {
        throw new Error((result && result.error) || `HTTP ${res.status}`)
      }
      notify(okMsg || '技能库已更新')
      if (typeof refresh === 'function') refresh()
      return true
    } catch (err) {
      notify(`技能库操作失败：${(err && err.message) || err}`)
      return false
    } finally {
      setBusyRole(null)
    }
  }
  const installedOf = (role) => (Array.isArray(installed[role]) ? installed[role] : [])
  if (roleEntries.length === 0) return null
  return (
    <Panel
      title="角色技能库"
      extra={<span style={{ fontSize: 10, color: C.faint }}>每角色 ≤3 精选仓库 · 勾选即安装（仅本插件对应角色可用）</span>}
    >
      {roleEntries.map(([role, meta]) => {
        const inst = installedOf(role)
        const byCatalogId = (id) => inst.find((x) => x.catalogId === id || x.name === id)
        const urlDraft = customUrl[role] || { url: '', name: '' }
        const busy = busyRole === role
        return (
          <details key={role} data-skill-role={role} style={{ margin: '0 0 6px', border: `1px solid ${C.divider}`, borderRadius: 8, padding: '4px 8px' }} open={inst.length > 0}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: C.fg }}>
              {(meta && meta.icon ? `${meta.icon} ` : '') + ((meta && meta.label) || role)}
              <span
                data-skill-count={role}
                style={{ marginLeft: 8, fontSize: 10, color: inst.length > 0 ? C.ok : C.faint, border: `1px solid ${inst.length > 0 ? C.ok : C.border}`, borderRadius: 8, padding: '0 6px' }}
              >
                {inst.length} 已安装
              </span>
            </summary>
            {busy && <p style={{ fontSize: 10, color: C.accent, margin: '2px 0' }}>处理中（git clone --depth 1，最长约 2 分钟）…</p>}
            {(catalog[role] || []).map((item) => {
              const entry = byCatalogId(item.id)
              const checked = !!entry
              return (
                <label
                  key={item.id}
                  data-skill-item={item.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0', cursor: busy ? 'wait' : 'pointer', fontSize: 11, color: C.fg }}
                >
                  <input
                    type="checkbox"
                    data-skill-check={item.id}
                    checked={checked}
                    disabled={busy}
                    onChange={() => {
                      if (checked) {
                        postManage({ action: 'remove', role, name: entry.name }, `已移除 ${item.name}`)
                      } else {
                        postManage({ action: 'install', role, repoId: item.id }, `已安装 ${item.name}（成员 spawn 后生效；已 spawn 的成员用 sci_team_send 通知）`)
                      }
                    }}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <b>{item.name}</b>
                    <span style={{ color: C.faint, marginLeft: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{item.license}</span>
                    <br />
                    <span style={{ color: C.muted }}>{item.description}</span>
                    {checked && entry && entry.skillNames && entry.skillNames.length > 0 && (
                      <span style={{ color: C.ok }}>（技能：{entry.skillNames.join('、')}）</span>
                    )}
                  </span>
                </label>
              )
            })}
            {/* 自定义安装（repo_url，无 catalogId）：安装清单 + 移除入口 */}
            {inst.filter((e) => !e.catalogId).length > 0 && (
              <div data-skill-custom-list={role} style={{ margin: '4px 0', borderTop: `1px dashed ${C.border}`, paddingTop: 4 }}>
                {inst
                  .filter((e) => !e.catalogId)
                  .map((e) => (
                    <div key={e.name} data-skill-custom-entry={e.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
                      <span style={{ color: C.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.name}
                        {e.warn ? '（⚠ 无 SKILL.md）' : ''}
                      </span>
                      <button
                        data-skill-custom-remove={e.name}
                        disabled={busy}
                        onClick={() => postManage({ action: 'remove', role, name: e.name }, `已移除 ${e.name}`)}
                        style={{ fontSize: 10, padding: '1px 8px', border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        移除
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {/* 自定义仓库链接（https github/gitlab） */}
            <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                data-skill-custom-url={role}
                type="text"
                placeholder="https://github.com/owner/repo（自定义 skill 仓库）"
                value={urlDraft.url}
                disabled={busy}
                onChange={(e) => setCustomUrl((m) => ({ ...m, [role]: { ...urlDraft, url: e.target.value } }))}
                style={{ flex: 1, minWidth: 160, fontSize: 11, padding: '2px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.fg }}
              />
              <input
                data-skill-custom-name={role}
                type="text"
                placeholder="目录名(可选)"
                value={urlDraft.name}
                disabled={busy}
                onChange={(e) => setCustomUrl((m) => ({ ...m, [role]: { ...urlDraft, name: e.target.value } }))}
                style={{ width: 90, fontSize: 11, padding: '2px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.fg }}
              />
              <button
                data-skill-custom-install={role}
                disabled={busy || !urlDraft.url.trim()}
                onClick={() => {
                  const body = { action: 'install', role, repoUrl: urlDraft.url.trim() }
                  if (urlDraft.name.trim()) body.name = urlDraft.name.trim()
                  postManage(body, '自定义技能已安装（成员 spawn 后生效）')
                }}
                style={{ fontSize: 11, padding: '2px 10px', border: `1px solid ${C.accent}`, borderRadius: 6, background: 'transparent', color: C.accent, cursor: busy || !urlDraft.url.trim() ? 'not-allowed' : 'pointer' }}
              >
                安装
              </button>
            </div>
          </details>
        )
      })}
      <p style={{ fontSize: 10, color: C.faint, margin: '2px 0 0' }}>
        安装即 git clone --depth 1 到 role-skills/&lt;角色&gt;/ 并生成 INDEX.md；只有该角色成员 spawn 提示词携带索引（跨角色隔离）。已 spawn 的成员需 sci_team_send 通知新技能路径。
      </p>
    </Panel>
  )
}

function TeamTab({ data, openMemberSession, memberOpenAvailable, focusTaskId, onClearFocusTask, refresh }) {
  const [view, setView] = useState('dag')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const notify = (msg) => {
    setToast(String(msg))
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const team = data.team || { members: [], tasks: [] }
  const members = Array.isArray(team.members) ? team.members : []
  const tasks = Array.isArray(team.tasks) ? team.tasks : []
  const onOpenMember = (m) => {
    try {
      if (typeof openMemberSession !== 'function') throw new Error('成员会话跳转不可用')
      openMemberSession(m)
    } catch (err) {
      notify(`无法打开成员会话：${(err && err.message) || err}`)
    }
  }
  return (
    <div>
      <ProgressOverview tasks={tasks} />
      {members.length === 0 ? (
        // 空队伍：lead 鲸鱼娘 + 一键建队引导（原花名册空态）
        <Panel title="团队（0）">
          <div style={{ textAlign: 'center', padding: '10px 6px 6px' }}>
            <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={64} style={{ display: 'inline-flex' }} />
            <Empty>队伍还没有成员。唤醒你的科研团队：让队长调用 sci_team_spawn_all（一键建全队）或 sci_team_spawn 按需生成。</Empty>
          </div>
        </Panel>
      ) : (
        <Panel
          title={`任务流 DAG（${tasks.length}）`}
          extra={(
            <ViewToggle
              view={view}
              graphValue="dag"
              listValue="list"
              graphLabel="任务流图"
              listLabel="列表视图"
              onChange={setView}
            />
          )}
        >
          <MemberStrip
            members={members}
            tasks={tasks}
            roles={data.roles}
            memberLive={data.memberLive}
            openMemberSession={onOpenMember}
            memberOpenAvailable={memberOpenAvailable}
          />
          {view === 'dag' ? (
            <TaskDag
              tasks={tasks}
              members={members}
              roles={data.roles}
              focusTaskId={focusTaskId}
              onClearFocus={onClearFocusTask}
            />
          ) : (
            <TaskBoard tasks={tasks} focusTaskId={focusTaskId} onClearFocus={onClearFocusTask} />
          )}
        </Panel>
      )}
      <Panel title="收件箱" extra={<span style={{ fontSize: 10, color: C.faint }}>成员回报摘要（最近 8 条）</span>}>
        <CaptainInbox tasks={tasks} members={members} roles={data.roles} />
      </Panel>
      {/* v0.9.0 角色技能库：勾选精选目录 / 自定义仓库链接安装（POST /skill-manage） */}
      <SkillMenuSection skillMenu={data.skillMenu} roles={data.roles} notify={notify} refresh={refresh} />
      {toast && (
        <div
          style={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 14px', fontSize: 12, color: C.fg,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 9999, maxWidth: '80%',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------- 文章框架标签 ----

// 核心卡（列表视图用，v0.6.0 形态保留）：lead 吉祥物徽章 + 标题（大字）+ 核心主张/创新点/目标期刊
// + sci_blueprint_set 编辑芯片。core 为空时显示 lead 吉祥物 + 引导。
function CoreCard({ core }) {
  const c = core || {}
  const hasCore = !!(c.title || c.claim)
  if (!hasCore) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 8px 8px', border: `1px dashed ${C.border}`, borderRadius: 8, marginBottom: 8 }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={48} style={{ display: 'inline-flex' }} />
        <Empty>文章蓝图还没有核心。让队长用 sci_blueprint_set 与你确认标题、核心主张与创新点，之后的任务与图表都会围绕它组织。</Empty>
        <div style={{ paddingBottom: 6 }}><CmdChip cmd="sci_blueprint_set" /></div>
      </div>
    )
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', background: C.card, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={28} />
        <span style={{ fontSize: 15, fontWeight: 700, color: C.fg, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.title || '（未命名）'}
        </span>
        {/* 确认工作流（v0.9.0）：核心确认徽章 + 确认命令芯片 */}
        {c.confirmed ? (
          <span
            data-core-confirmed="true"
            title="核心已确认（用户同意后的文章承诺；修改会打回待确认）"
            style={{ fontSize: 10, color: C.ok, border: `1px solid ${C.ok}`, borderRadius: 8, padding: '0 6px', lineHeight: '16px', flexShrink: 0 }}
          >
            🔒 已确认
          </span>
        ) : (
          <span
            data-core-confirmed="false"
            title="核心待确认：向用户复述并获同意后，队长调用 sci_blueprint_confirm kind=core"
            style={{ fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: '0 6px', lineHeight: '16px', flexShrink: 0 }}
          >
            ⏳ 待确认
          </span>
        )}
      </div>
      {c.claim && (
        <div style={{ fontSize: 12, color: C.fg, marginTop: 6, lineHeight: 1.6 }}>
          <b style={{ color: C.accent }}>主张</b> · {c.claim}
        </div>
      )}
      {c.innovation && (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.6 }}>
          <b style={{ color: C.fg }}>创新</b> · {c.innovation}
        </div>
      )}
      {c.venue && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>目标期刊：{c.venue}</div>}
      <div style={{ fontSize: 10, color: C.faint, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {!c.confirmed && <span>确认核心：</span>}
        {!c.confirmed && <CmdChip cmd="/sci_blueprint_confirm core" />}
        <span>修改核心：</span>
        <CmdChip cmd="sci_blueprint_set" />
      </div>
    </div>
  )
}

// 单个 result 行（列表视图用，v0.6.0 形态保留）：状态点 + 标题 + 状态标签 + 任务数 + 图表数；
// 行点击展开详情（完整 claim + 支撑任务 chips + 图表证据 chips + notes）。
// F4（v0.7.1）：支撑任务 = union(blueprint tasks, 任务板 resultId 反查)，与框架图同口径。
function ResultRow({ r, tasksById, onOpenTask, onOpenFigure }) {
  const [open, setOpen] = useState(false)
  const status = r.status || 'planned'
  const tasks = [...resultTaskIdsOf(r, tasksById)]
  const figures = Array.isArray(r.figures) ? r.figures : []
  // v0.9.0：确认状态 + 参考文献 + 快筛
  const confirmed = r.confirmed === true
  const refs = Array.isArray(r.references) ? r.references : []
  const unverified = refs.filter((x) => x && !x.verified).length
  const screening = r.screening || null
  const refGroups = []
  for (const usedAs of Object.keys(USED_AS_LABEL)) {
    const group = refs.filter((x) => (x && x.usedAs) === usedAs)
    if (group.length > 0) refGroups.push([usedAs, group])
  }
  return (
    <div>
      <div
        data-result-row={r.id}
        onClick={() => setOpen(!open)}
        title={`${r.id} · 点击${open ? '收起' : '展开'}详情`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', marginBottom: 4,
          border: `1px solid ${C.border}`, borderRadius: 8, background: C.card,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        <Dot color={RESULT_STATUS_COLOR[status] || C.faint} size={7} />
        <b style={{ color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>
          {r.title || r.id}
        </b>
        <DepChip id={RESULT_STATUS_LABEL[status] || status} />
        {confirmed ? (
          <span
            data-result-confirmed="true"
            title="已确认：用户同意后的子主张（修改会打回待确认）"
            style={{ fontSize: 10, color: C.ok, flexShrink: 0 }}
          >
            🔒
          </span>
        ) : (
          <span
            data-result-confirmed="false"
            title="待确认：用户同意前不能派发支撑任务（dispatch 会拒绝）"
            style={{ fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: '0 5px', lineHeight: '15px', flexShrink: 0 }}
          >
            待确认
          </span>
        )}
        <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>{tasks.length} 任务</span>
        <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>{figures.length} 图</span>
        {refs.length > 0 && (
          <span
            data-result-refs=""
            title={`参考文献 ${refs.length} 条${unverified > 0 ? `（${unverified} 条未核对）` : '（全部已核对）'}`}
            style={{ fontSize: 10, color: unverified > 0 ? C.warn : C.ok, flexShrink: 0 }}
          >
            📚{refs.length}{unverified > 0 ? '?' : ''}
          </span>
        )}
        {screening && (
          <span
            data-result-screening={screening.decision}
            title={`快筛：${screening.decision}${screening.note ? ` · ${screening.note}` : ''}`}
            style={{ fontSize: 10, color: SCREENING_COLOR[screening.decision] || C.faint, border: `1px solid ${SCREENING_COLOR[screening.decision] || C.faint}`, borderRadius: 8, padding: '0 5px', lineHeight: '15px', flexShrink: 0 }}
          >
            {SCREENING_LABEL[screening.decision] || screening.decision}
          </span>
        )}
        <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div
          style={{
            border: `1px solid ${C.divider}`, borderRadius: 8,
            padding: '6px 10px', marginBottom: 4,
            background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6,
          }}
        >
          <div style={{ color: C.faint }}>{r.id} · {RESULT_STATUS_LABEL[status] || status}</div>
          {r.claim && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: C.fg }}><b style={{ color: C.accent }}>主张：</b>{r.claim}</div>}
          {tasks.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ flexShrink: 0 }}>支撑任务：</span>
              {tasks.map((tid) => (
                <span
                  key={tid}
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      if (typeof onOpenTask === 'function') onOpenTask(tid)
                    } catch {
                      /* ignore */
                    }
                  }}
                  title="点击前往团队任务板查看详情"
                  style={{
                    display: 'inline-block', padding: '0 6px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.card,
                    fontSize: 10, lineHeight: '16px', color: C.muted,
                    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {tid} →
                </span>
              ))}
            </div>
          )}
          {figures.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ flexShrink: 0 }}>图表证据：</span>
              {figures.map((fid) => (
                <span
                  key={fid}
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      if (typeof onOpenFigure === 'function') onOpenFigure(fid)
                    } catch {
                      /* ignore */
                    }
                  }}
                  title="点击前往产物 tab 图库查看"
                  style={{
                    display: 'inline-block', padding: '0 6px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.card,
                    fontSize: 10, lineHeight: '16px', color: C.muted,
                    cursor: 'pointer', fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {fid} →
                </span>
              ))}
            </div>
          )}
          {/* 参考文献（v0.9.0 Track 2 B2）：usedAs 分组 chips，verified 绿 / 未验证黄 */}
          <div data-result-references={r.id} style={{ marginTop: 5, borderTop: `1px dashed ${C.divider}`, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ flexShrink: 0, color: C.fg }}>
                参考文献（{refs.length}{unverified > 0 ? `，${unverified} 未核对` : ''}）：
              </span>
              {refs.length === 0 && <span style={{ color: C.faint }}>无——用 sci_result_reference_add 为所用方法/概念登记</span>}
            </div>
            {refGroups.map(([usedAs, group]) => (
              <div key={usedAs} style={{ marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ flexShrink: 0, color: C.accent, fontSize: 10, minWidth: 34 }}>{USED_AS_LABEL[usedAs]}</span>
                {group.map((ref, i) => (
                  <span
                    key={`${ref.doi || ref.title}:${i}`}
                    data-ref-verified={ref.verified ? 'true' : 'false'}
                    title={`${ref.verified ? '✓ 已核对（Crossref）' : '⚠ 未核对'}${ref.doi ? ` · doi:${ref.doi}` : ''} · ${ref.title || ''}${ref.verifyError ? ` · ${ref.verifyError}` : ''}`}
                    style={{
                      display: 'inline-block', padding: '0 6px', borderRadius: 8,
                      border: `1px solid ${ref.verified ? C.ok : C.warn}`,
                      background: C.card, fontSize: 10, lineHeight: '16px',
                      color: ref.verified ? C.ok : C.warn,
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {ref.verified ? '✓' : '⚠'} {ref.doi ? `doi:${ref.doi}` : ref.title || '（无标题）'}
                  </span>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: C.faint }}>添加文献：</span>
              <CmdChip cmd={`sci_result_reference_add result_id=${r.id} used_as=method`} />
              <CmdChip cmd={`sci_result_reference_add result_id=${r.id} used_as=evidence`} />
            </div>
          </div>
          {/* 确认/快筛命令芯片（v0.9.0） */}
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {!confirmed && <span style={{ fontSize: 10, color: C.warn }}>确认该 result：</span>}
            {!confirmed && <CmdChip cmd={`/sci_blueprint_confirm ${r.id}`} />}
            <span style={{ fontSize: 10, color: C.faint }}>快筛：</span>
            <CmdChip cmd={`sci_result_screening result_id=${r.id} decision=include`} />
          </div>
          {r.notes && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}><b style={{ color: status === 'negative' ? C.err : C.ok }}>notes：</b>{r.notes}</div>}
        </div>
      )}
    </div>
  )
}

// Results 列表（列表视图）+ 空态引导（tasksById 传入 → F4 支撑任务与框架图同口径 union）
function ResultsList({ results, tasksById, onOpenTask, onOpenFigure }) {
  if (results.length === 0) {
    return <Empty>还没有 Results。让队长用 sci_result_add 添加支撑核心的子主张（建议 3-5 个，每个一句可检验的 claim）。</Empty>
  }
  return (
    <div>
      {results.map((r) => <ResultRow key={r.id} r={r} tasksById={tasksById} onOpenTask={onOpenTask} onOpenFigure={onOpenFigure} />)}
    </div>
  )
}

// ------------------------------------------------------ 框架图（v0.7.0）----

// 框架图画布参数：核心（顶）→ Results（横排）→ 任务/图表叶节点（各 result 下方树形排列）
const FG_PAD = 12
const FG_CORE_W = 240
const FG_CORE_H = 64
const FG_RES_W = 190
const FG_RES_H = 62
const FG_LEAF_W = 168
const FG_LEAF_H = 24
const FG_RES_GAP = 34
const FG_LEAF_GAP = 6
const FG_LEAF_INDENT = 22
const FG_CORE_GAP = 44
const FG_LEAF_CAP = 8

// F4（v0.7.1）：result 的支撑任务 = union(blueprint results[].tasks, 任务板 resultId 反查)，
// 按 id 去重——修复 blueprint 只登记部分任务（如 res-2 漏挂 5/7）时框架图叶节点系统性缺失。
function resultTaskIdsOf(r, tasksById) {
  const ids = new Set(Array.isArray(r && r.tasks) ? r.tasks : [])
  if (r && r.id && tasksById) {
    for (const t of tasksById.values()) {
      if (t && t.resultId === r.id) ids.add(t.id)
    }
  }
  return ids
}

// 框架图布局（v0.7.1）：核心居中；result i 横排；叶 = union(result.tasks, 任务板 resultId 反查)
//（状态从 team.tasks 交叉引用）+ result.figures（标题/路径从 figures 登记表交叉引用），
// 超出 FG_LEAF_CAP 显示 +N 汇总叶；results 超 8 显示 +N 汇总 result 节点（F7）。
function frameworkLayout(bp, tasksById, figById) {
  const allResults = Array.isArray(bp.results) ? bp.results : []
  const results = allResults.slice(0, 8)
  const hiddenResults = allResults.length - results.length
  const canvasW = Math.max(
    FG_CORE_W + FG_PAD * 2,
    (results.length + (hiddenResults > 0 ? 1 : 0)) * (FG_RES_W + FG_RES_GAP) - FG_RES_GAP + FG_PAD * 2,
  )
  const core = { x: Math.round((canvasW - FG_CORE_W) / 2), y: FG_PAD, w: FG_CORE_W, h: FG_CORE_H }
  const resY = core.y + FG_CORE_H + FG_CORE_GAP
  const resNodes = []
  const leafNodes = []
  const overflowNodes = []
  const edges = []
  let maxBottom = resY + FG_RES_H
  results.forEach((r, i) => {
    const x = FG_PAD + i * (FG_RES_W + FG_RES_GAP)
    const taskIds = resultTaskIdsOf(r, tasksById)
    resNodes.push({ r, x, y: resY, taskCount: taskIds.size })
    const leaves = []
    for (const tid of taskIds) leaves.push({ kind: 'task', id: tid })
    for (const fid of Array.isArray(r.figures) ? r.figures : []) leaves.push({ kind: 'figure', id: fid })
    const shown = leaves.slice(0, FG_LEAF_CAP)
    const overflow = leaves.length - shown.length
    let ly = resY + FG_RES_H + 16
    for (const leaf of shown) {
      leaf.x = x + FG_LEAF_INDENT
      leaf.y = ly
      leaf.parentId = r.id
      if (leaf.kind === 'task') {
        const t = tasksById.get(leaf.id)
        leaf.status = t ? t.status : null
        leaf.title = (t && (t.subject || t.id)) || leaf.id
        leaf.assignee = t ? t.assignee : ''
      } else {
        const f = figById.get(leaf.id)
        leaf.title = (f && f.title) || leaf.id
        leaf.fig = f || null
      }
      leafNodes.push(leaf)
      ly += FG_LEAF_H + FG_LEAF_GAP
    }
    if (overflow > 0) {
      overflowNodes.push({ parentId: r.id, x: x + FG_LEAF_INDENT, y: ly, count: overflow })
      ly += FG_LEAF_H + FG_LEAF_GAP
    }
    maxBottom = Math.max(maxBottom, ly)
    // 核心底部中心 → result 顶部中心（扇形贝塞尔）
    const coreCx = core.x + core.w / 2
    const coreBy = core.y + core.h
    const tx = x + FG_RES_W / 2
    const ty = resY
    edges.push({
      d: `M${coreCx} ${coreBy}C${coreCx} ${coreBy + FG_CORE_GAP / 2},${tx} ${ty - FG_CORE_GAP / 2},${tx} ${ty}`,
      kind: 'core-result',
      to: r.id,
    })
    // result → 叶：树干（纵）+ 横枝（树形，避免叶间连线穿插）
    const kids = leafNodes.filter((l) => l.parentId === r.id)
    if (kids.length > 0) {
      const trunkX = x + 10
      const topY = resY + FG_RES_H
      const lastY = kids[kids.length - 1].y + FG_LEAF_H / 2
      edges.push({ d: `M${trunkX} ${topY}L${trunkX} ${lastY}`, kind: 'trunk', to: r.id })
      for (const k of kids) {
        edges.push({ d: `M${trunkX} ${k.y + FG_LEAF_H / 2}L${k.x} ${k.y + FG_LEAF_H / 2}`, kind: 'stub', to: k.id })
      }
    }
  })
  return {
    canvasW,
    canvasH: maxBottom + FG_PAD,
    core,
    resNodes,
    leafNodes,
    overflowNodes,
    edges,
    resultCount: results.length,
    resultTotal: allResults.length,
    hiddenResults,
    // F7：results 超 8 的汇总节点（排在末位 result 之后）
    resultOverflow: hiddenResults > 0 ? { x: FG_PAD + results.length * (FG_RES_W + FG_RES_GAP), y: resY } : null,
  }
}

// 框架图详情卡：节点点击 → result（claim/notes/对齐 chips）/ task（描述/状态）/ figure（图片预览）
function FrameworkDetail({ sel, bp, tasksById, figById, workspaceRoot, onOpenTask, onOpenFigure }) {
  if (!sel) return <Empty>点击图中节点查看详情（result 主张 / 任务描述 / 图表预览）。</Empty>
  if (sel.kind === 'core') {
    const c = bp.core || {}
    return (
      <div data-framework-detail="core" style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: '6px 10px', background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.fg, fontWeight: 700 }}>{c.title || '（未命名）'}</div>
        {c.claim && <div style={{ marginTop: 3, color: C.fg }}><b style={{ color: C.accent }}>主张：</b>{c.claim}</div>}
        {c.innovation && <div style={{ marginTop: 3 }}><b style={{ color: C.fg }}>创新：</b>{c.innovation}</div>}
        {c.venue && <div style={{ marginTop: 3 }}>目标期刊：{c.venue}</div>}
      </div>
    )
  }
  if (sel.kind === 'result') {
    const r = (bp.results || []).find((x) => x && x.id === sel.id)
    if (!r) return <Empty>该 result 已不存在（蓝图已更新）。</Empty>
    const status = r.status || 'planned'
    // F4：与框架图同口径——union(blueprint tasks, 任务板 resultId 反查) 去重
    const tasks = [...resultTaskIdsOf(r, tasksById)]
    const figures = Array.isArray(r.figures) ? r.figures : []
    return (
      <div data-framework-detail={r.id} style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: '6px 10px', background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: C.faint }}>{r.id} · {RESULT_STATUS_LABEL[status] || status}</span>
          {r.confirmed === true ? (
            <span style={{ fontSize: 10, color: C.ok }}>🔒 已确认</span>
          ) : (
            <span style={{ fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: '0 5px', lineHeight: '15px' }}>待确认</span>
          )}
          {Array.isArray(r.references) && r.references.length > 0 && (
            <span style={{ fontSize: 10, color: r.references.some((x) => x && !x.verified) ? C.warn : C.ok }}>
              📚 {r.references.length} 条文献{r.references.some((x) => x && !x.verified) ? '（含未核对）' : ''}
            </span>
          )}
          {r.screening && (
            <span style={{ fontSize: 10, color: SCREENING_COLOR[r.screening.decision] || C.faint }}>
              {SCREENING_LABEL[r.screening.decision] || r.screening.decision}
            </span>
          )}
        </div>
        {r.claim && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: C.fg }}><b style={{ color: C.accent }}>主张：</b>{r.claim}</div>}
        {tasks.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ flexShrink: 0 }}>支撑任务：</span>
            {tasks.map((tid) => (
              <span
                key={tid}
                onClick={(e) => { e.stopPropagation(); try { if (typeof onOpenTask === 'function') onOpenTask(tid) } catch { /* ignore */ } }}
                title="点击前往团队任务流查看"
                style={{ display: 'inline-block', padding: '0 6px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, lineHeight: '16px', color: C.muted, cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}
              >
                {tid} →
              </span>
            ))}
          </div>
        )}
        {figures.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ flexShrink: 0 }}>图表证据：</span>
            {figures.map((fid) => (
              <span
                key={fid}
                onClick={(e) => { e.stopPropagation(); try { if (typeof onOpenFigure === 'function') onOpenFigure(fid) } catch { /* ignore */ } }}
                title="点击前往产物 tab 图库查看"
                style={{ display: 'inline-block', padding: '0 6px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, lineHeight: '16px', color: C.muted, cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}
              >
                {fid} →
              </span>
            ))}
          </div>
        )}
        {r.notes && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}><b style={{ color: status === 'negative' ? C.err : C.ok }}>notes：</b>{r.notes}</div>}
        {r.confirmed !== true && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: C.warn }}>确认该 result：</span>
            <CmdChip cmd={`/sci_blueprint_confirm ${r.id}`} />
          </div>
        )}
      </div>
    )
  }
  if (sel.kind === 'task') {
    const t = tasksById.get(sel.id)
    if (!t) return <Empty>任务 {sel.id} 不在任务板上（可能已被删除）。</Empty>
    return (
      <div data-framework-detail={t.id} style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: '6px 10px', background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.faint }}>{t.id} · 状态 {t.status} · 负责人 {t.assignee || '待领'}{t.resultId ? ` · 对齐 ${t.resultId}` : ''}</div>
        <div style={{ color: C.fg, marginTop: 3, fontWeight: 700 }}>{t.subject || t.id}</div>
        {t.desc && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, color: C.fg }}>{t.desc}</div>}
        {t.result && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}><b style={{ color: C.ok }}>结果：</b>{t.result}</div>}
      </div>
    )
  }
  // figure：file 路由图片预览 + 元信息
  const f = figById.get(sel.id)
  if (!f) return <Empty>图表 {sel.id} 未登记（或已清理）。</Empty>
  const inside = pathInsideWorkspace(f.path, workspaceRoot)
  return (
    <div data-framework-detail={f.id} style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: '6px 10px', background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
      <div style={{ color: C.fg, fontWeight: 700 }}>{f.title}</div>
      <div style={{ marginTop: 2 }}>{f.id} · {f.sha256_12} · {fmtBytes(f.bytes)} · {fmtTime(f.registeredAt)}</div>
      {inside && (
        <img
          src={`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`}
          alt={f.title}
          style={{ display: 'block', maxWidth: '100%', maxHeight: 180, marginTop: 6, borderRadius: 6, border: `1px solid ${C.divider}` }}
        />
      )}
      {!inside && f.path && <div style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.path}>{f.path}</div>}
    </div>
  )
}

// 框架图画布（v0.7.0）：核心 → Results → 任务/图表叶，SVG 边 + HTML 节点，纯 CSS/SVG 无三方库。
function FrameworkGraph({ bp, tasksById, figById, workspaceRoot, onOpenTask, onOpenFigure }) {
  const [sel, setSel] = useState(null)
  const layout = useMemo(() => frameworkLayout(bp || {}, tasksById, figById), [bp, tasksById, figById])
  const viewportRef = useRef(null)
  // 画布宽于视口时初始滚动到核心节点居中（核心在 canvas 中央，默认 scrollLeft=0 会被裁一半）
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const target = (layout.canvasW - vp.clientWidth) / 2
    if (target > 0) vp.scrollLeft = target
  }, [layout.canvasW])
  if (layout.resultCount === 0 && !(bp && bp.core && (bp.core.title || bp.core.claim))) {
    return <Empty>还没有文章框架。让队长用 sci_blueprint_set 确立核心、sci_result_add 添加 Results，这里会长出框架图。</Empty>
  }
  const nodeBase = {
    position: 'absolute',
    cursor: 'pointer',
    boxSizing: 'border-box',
  }
  return (
    <div>
      <div
        data-framework-viewport=""
        ref={viewportRef}
        style={{ maxHeight: 420, overflow: 'auto', border: `1px solid ${C.divider}`, borderRadius: 8, background: C.card, position: 'relative' }}
      >
        <div data-framework-canvas="" style={{ position: 'relative', width: layout.canvasW, height: layout.canvasH }}>
          <svg
            data-framework-edges=""
            width={layout.canvasW}
            height={layout.canvasH}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
            aria-hidden
          >
            {layout.edges.map((e, i) => (
              <path
                key={i}
                data-framework-edge={`${e.kind}:${e.to}`}
                d={e.d}
                fill="none"
                style={{ stroke: e.kind === 'core-result' ? C.accent : C.faint }}
                strokeWidth={e.kind === 'core-result' ? 1.5 : 1}
                opacity={e.kind === 'core-result' ? 0.8 : 0.6}
              />
            ))}
          </svg>
          {/* 核心节点（顶部） */}
          <div
            data-framework-node="core"
            onClick={() => setSel({ kind: 'core' })}
            title="核心 · 点击查看完整主张"
            style={{
              ...nodeBase,
              left: layout.core.x, top: layout.core.y, width: layout.core.w, height: layout.core.h,
              border: `1.5px solid ${sel && sel.kind === 'core' ? C.accent : C.border}`,
              borderRadius: 10, background: C.chip, padding: '5px 8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MascotAvatar file={LEAD_MASCOT} emoji="🧑‍🔬" size={18} />
              <span style={{ fontSize: 9, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '0 5px', lineHeight: '14px', flexShrink: 0 }}>核心</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(bp.core && bp.core.title) || '（未命名）'}
              </span>
            </div>
            <div
              style={{
                fontSize: 10, color: C.muted, lineHeight: '13px', marginTop: 3, height: 26, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-all',
              }}
            >
              {(bp.core && bp.core.claim) || '（还没有核心主张）'}
            </div>
          </div>
          {/* Result 节点（状态色边框 + claim 内嵌；taskCount = F4 union 后数量） */}
          {layout.resNodes.map(({ r, x, y, taskCount }) => {
            const status = r.status || 'planned'
            const rc = RESULT_STATUS_COLOR[status] || C.faint
            const isSel = sel && sel.kind === 'result' && sel.id === r.id
            const figCount = Array.isArray(r.figures) ? r.figures.length : 0
            return (
              <div
                key={r.id}
                data-framework-node={r.id}
                data-result-status={status}
                data-result-confirmed={r.confirmed === true ? 'true' : 'false'}
                onClick={() => setSel({ kind: 'result', id: r.id })}
                title={`${r.id} · ${RESULT_STATUS_LABEL[status] || status} · ${r.confirmed === true ? '已确认' : '待确认（dispatch 前需确认）'} · 点击查看 claim/notes`}
                style={{
                  ...nodeBase,
                  left: x, top: y, width: FG_RES_W, height: FG_RES_H,
                  border: `1.5px solid ${isSel ? C.accent : rc}`,
                  borderRadius: 10, background: C.surface, padding: '4px 7px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Dot color={rc} size={6} />
                  <span style={{ fontSize: 9, fontFamily: 'ui-monospace, monospace', color: rc, flexShrink: 0 }}>{r.id}</span>
                  <span style={{ fontSize: 8, flexShrink: 0 }} title={r.confirmed === true ? '已确认' : '待确认'}>
                    {r.confirmed === true ? '🔒' : <span style={{ color: C.warn }}>待确认</span>}
                  </span>
                  <span style={{ fontSize: 9, color: C.muted, marginLeft: 'auto', flexShrink: 0 }}>{taskCount} 任务 · {figCount} 图</span>
                </div>
                <div
                  style={{
                    fontSize: 10, fontWeight: 700, color: C.fg, lineHeight: '12px', marginTop: 2, height: 24,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-all',
                  }}
                >
                  {r.title || r.id}
                </div>
              </div>
            )
          })}
          {/* 任务/图表叶节点 */}
          {layout.leafNodes.map((leaf) => {
            const isSel = sel && sel.kind === leaf.kind && sel.id === leaf.id
            if (leaf.kind === 'task') {
              const color = STATUS_COLOR[leaf.status] || C.faint
              return (
                <div
                  key={`task:${leaf.id}`}
                  data-framework-node={leaf.id}
                  data-leaf-kind="task"
                  data-status={leaf.status || 'unknown'}
                  onClick={() => setSel({ kind: 'task', id: leaf.id })}
                  title={`任务 ${leaf.id} · ${leaf.title} · 状态 ${leaf.status || '未知'} · 点击查看描述`}
                  style={{
                    ...nodeBase,
                    left: leaf.x, top: leaf.y, width: FG_LEAF_W, height: FG_LEAF_H,
                    // F2：任务叶节点 surface + border-l4（深色主题可辨）
                    border: `1px solid ${isSel ? C.accent : C.borderNode}`,
                    borderRadius: 7, background: C.surface, padding: '2px 6px',
                    display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden',
                  }}
                >
                  <Dot color={color} size={6} />
                  <span style={{ fontSize: 10, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaf.title}</span>
                </div>
              )
            }
            return (
              <div
                key={`fig:${leaf.id}`}
                data-framework-node={leaf.id}
                data-leaf-kind="figure"
                onClick={() => setSel({ kind: 'figure', id: leaf.id })}
                title={`图表 ${leaf.id} · ${leaf.title} · 点击预览`}
                style={{
                  ...nodeBase,
                  left: leaf.x, top: leaf.y, width: FG_LEAF_W, height: FG_LEAF_H,
                  border: `1px solid ${isSel ? C.accent : C.borderNode}`,
                  borderRadius: 7, background: C.chip, padding: '2px 6px',
                  display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden',
                }}
              >
                <span style={{ fontSize: 10, flexShrink: 0 }}>🖼</span>
                <span style={{ fontSize: 10, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaf.title}</span>
              </div>
            )
          })}
          {/* +N 溢出叶 */}
          {layout.overflowNodes.map((o) => (
            <div
              key={`ovf:${o.parentId}`}
              data-framework-overflow={o.parentId}
              onClick={() => setSel({ kind: 'result', id: o.parentId })}
              title={`${o.parentId} 还有 ${o.count} 个叶子，点击展开该 result 详情`}
              style={{
                ...nodeBase,
                left: o.x, top: o.y, width: FG_LEAF_W, height: FG_LEAF_H,
                border: `1px dashed ${C.border}`, borderRadius: 7, padding: '2px 6px',
                display: 'flex', alignItems: 'center', fontSize: 10, color: C.faint,
              }}
            >
              +{o.count} 更多叶（点击展开）
            </div>
          ))}
          {/* F7：results 超 8 的汇总节点（列表视图可看全部） */}
          {layout.resultOverflow && (
            <div
              data-framework-results-overflow=""
              title={`还有 ${layout.hiddenResults} 个 result 未在图中展开（上限 8）：${(bp.results || []).slice(8).map((r) => r && r.id).filter(Boolean).join('、') || '—'}。切换「列表视图」可看全部`}
              style={{
                ...nodeBase,
                left: layout.resultOverflow.x, top: layout.resultOverflow.y, width: FG_RES_W, height: FG_RES_H,
                border: `1px dashed ${C.borderNode}`, borderRadius: 10, padding: '4px 7px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                fontSize: 10, color: C.muted,
              }}
            >
              <b style={{ fontSize: 11, color: C.fg }}>+{layout.hiddenResults} 更多 result</b>
              <span>超出画布上限 8，列表视图可看全部</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 6 }} data-framework-detail-host="">
        <FrameworkDetail
          sel={sel}
          bp={bp || {}}
          tasksById={tasksById}
          figById={figById}
          workspaceRoot={workspaceRoot}
          onOpenTask={onOpenTask}
          onOpenFigure={onOpenFigure}
        />
      </div>
    </div>
  )
}

// 覆盖检查：host 侧 coverageOf（lib/blueprint.js）产出的警告逐条渲染。
// 证伪风险（⚠ 开头）用 err 色加重；其余警告用 warn 色；无警告显示"覆盖完整"。
function CoverageSection({ coverage }) {
  const cov = coverage || {}
  const warnings = Array.isArray(cov.warnings) ? cov.warnings : []
  const negative = typeof cov.negativeCount === 'number' ? cov.negativeCount : 0
  const supported = typeof cov.supportedCount === 'number' ? cov.supportedCount : 0
  if (warnings.length === 0) {
    return <Empty>覆盖完整：每个 result 都有任务与图表，任务全部对齐到 result（supported {supported} · negative {negative}）。</Empty>
  }
  return (
    <div style={{ border: `1px solid ${cov.falsificationRisk ? C.err : C.border}`, borderRadius: 8, padding: '6px 10px', background: C.card }}>
      {warnings.map((w, i) => {
        const isRisk = String(w).indexOf('⚠') === 0
        return (
          <div
            key={i}
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              marginTop: i === 0 ? 0 : 3,
              color: isRisk ? C.err : C.warn,
              fontWeight: isRisk ? 700 : 400,
            }}
          >
            {w}
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>
        supported {supported} · negative {negative} · 详情命令：
        <CmdChip cmd="sci_blueprint_overview" />
      </div>
    </div>
  )
}

function BlueprintTab({ data, onOpenTask, onOpenFigure }) {
  const [view, setView] = useState('graph')
  const bp = (data && data.blueprint) || {}
  const core = bp.core || {}
  const results = Array.isArray(bp.results) ? bp.results : []
  const updatedAt = bp.updatedAt ? ` · 更新于 ${fmtTime(bp.updatedAt)}` : ''
  // fix4：蓝图文件损坏警示横幅（host 侧隔离备份后置位；sci_blueprint_set 重建成功即清除）
  const bpError = (data && data.blueprintError) || null
  const tasksById = useMemo(() => new Map(((data && data.team && data.team.tasks) || []).map((t) => [t.id, t])), [data])
  const figById = useMemo(() => new Map(((data && data.figures) || []).map((f) => [f.id, f])), [data])
  return (
    <div>
      {bpError && (
        <div
          style={{
            border: `1px solid ${C.err}`, borderRadius: 8,
            padding: '8px 10px', marginBottom: 8, background: C.card,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.err }}>
            ⚠ 蓝图文件损坏，已隔离（备份保留），请用 sci_blueprint_set 重建
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{String(bpError)}</div>
          <div style={{ marginTop: 5 }}><CmdChip cmd="sci_blueprint_set" /></div>
        </div>
      )}
      {view === 'graph' ? (
        <Panel
          title="文章框架图"
          extra={(
            <ViewToggle
              view={view}
              graphValue="graph"
              listValue="list"
              graphLabel="框架图"
              listLabel="列表视图"
              onChange={setView}
            />
          )}
        >
          <FrameworkGraph
            bp={bp}
            tasksById={tasksById}
            figById={figById}
            workspaceRoot={data.workspaceRoot}
            onOpenTask={onOpenTask}
            onOpenFigure={onOpenFigure}
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="核心"
            extra={(
              <ViewToggle
                view={view}
                graphValue="graph"
                listValue="list"
                graphLabel="框架图"
                listLabel="列表视图"
                onChange={setView}
              />
            )}
          >
            <CoreCard core={core} />
          </Panel>
          <Panel title={`Results（${results.length}）`} extra={<span style={{ fontSize: 10, color: C.faint }}>支撑核心的子主张{updatedAt}</span>}>
            <ResultsList results={results} tasksById={tasksById} onOpenTask={onOpenTask} onOpenFigure={onOpenFigure} />
          </Panel>
        </>
      )}
      <Panel title="覆盖检查">
        <CoverageSection coverage={bp.coverage} />
      </Panel>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        命令：<CmdChip cmd="sci_result_add" />
        <CmdChip cmd="sci_blueprint_overview" />
        <CmdChip cmd="sci_blueprint_export" />
        <span>（导出 research/blueprint-report.md）</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 产物标签 ----

// 图表：卡片（标题/sha/大小/时间/res-N 徽章）；路径在工作区内 → <img> 预览（经 file 路由服务）
// 卡片点击 → 新标签页打开原图（file 路由）
// fix6：focusFigureId（文章 tab 图表证据 chip 跳转）→ scrollIntoView + 短暂高亮，处理后清除。
function FiguresSection({ figures, workspaceRoot, focusFigureId, onClearFocus }) {
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (!focusFigureId) return undefined
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-fig-card="${focusFigureId}"]`)
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        /* ignore */
      }
      setFlash(focusFigureId)
      setTimeout(() => setFlash((cur) => (cur === focusFigureId ? null : cur)), 1600)
      if (typeof onClearFocus === 'function') onClearFocus()
    }, 120)
    return () => clearTimeout(timer)
  }, [focusFigureId])
  if (!figures || figures.length === 0) {
    return <Empty>暂无登记图表。让成员绘图后调用 sci_figure_register 登记，这里会出现预览。</Empty>
  }
  const openInNewTab = (f) => {
    try {
      if (f && f.path) window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`, '_blank')
    } catch {
      /* ignore */
    }
  }
  return (
    <div>
      {figures.map((f) => {
        const inside = pathInsideWorkspace(f.path, workspaceRoot)
        // 版本链（v0.9.0 Track 3）：register 记录 version/prevId/prevSha——上一版本档案在本列表里
        // 可查（旧档案可能已被截断清理，找不到时仅提示 sha）
        const prev = f.prevId ? figures.find((x) => x && x.id === f.prevId) : null
        return (
          <div
            key={f.id}
            data-fig-card={f.id}
            data-fig-version={f.version || 1}
            onClick={() => openInNewTab(f)}
            title={f.path ? `点击在新标签页查看：${f.path}` : undefined}
            style={{
              border: `1px solid ${flash === f.id ? C.accent : C.border}`,
              borderRadius: 8, padding: '6px 10px', marginBottom: 6,
              background: flash === f.id ? C.chip : C.card,
              cursor: f.path ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {f.resultId && <ResBadge id={f.resultId} />}
              <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
              {(f.version || 1) > 1 && (
                <span title={`第 ${f.version} 版（同图重绘的版本链）`} style={{ fontSize: 10, color: C.accent, flexShrink: 0 }}>v{f.version}</span>
              )}
              {f.prevId && (
                <span
                  data-fig-prev={f.prevId}
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      if (prev && prev.path) window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(prev.path)}`, '_blank')
                    } catch {
                      /* ignore */
                    }
                  }}
                  title={prev ? `对比上一版本 v${(f.version || 1) - 1}（sha ${f.prevSha || '?'}，${prev.title}）——点击新标签页打开` : `上一版本 ${f.prevId}（sha ${f.prevSha || '?'}）档案不在当前列表（可能已清理）`}
                  style={{
                    fontSize: 10, color: prev ? C.accent : C.faint, flexShrink: 0, cursor: 'pointer',
                    border: `1px solid ${prev ? C.accent : C.border}`, borderRadius: 8, padding: '0 6px', lineHeight: '16px',
                  }}
                >
                  ↩ v{(f.version || 1) - 1}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, margin: '2px 0' }}>
              {f.id} · {f.sha256_12} · {fmtBytes(f.bytes)} · {fmtTime(f.registeredAt)}
            </div>
            {f.codePath && <div style={{ fontSize: 10, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>code: {f.codePath}</div>}
            {inside && (
              <img
                src={`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`}
                alt={f.title}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 180, marginTop: 6, borderRadius: 6, border: `1px solid ${C.divider}` }}
              />
            )}
            {!inside && f.path && (
              <div style={{ fontSize: 10, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.path}>
                {f.path}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// 文件：工作区文件树（缩进列表；目录粗体，文件带可读大小 + ⬇ 新标签页打开/下载）
// 点击文件行复制绝对路径；⬇ 经 file 路由在新标签页打开（浏览器按类型预览/下载）
function FilesSection({ files, workspaceRoot }) {
  const [copied, setCopied] = useState(null)
  if (!files || files.length === 0) {
    return <Empty>工作区文件树为空（或 web 服务器未运行在工作区目录）。</Empty>
  }
  const rows = [...files].sort((a, b) => String(a.path).localeCompare(String(b.path)))
  const onClickRow = (f) => {
    const abs = `${workspaceRoot}/${String(f.path).replace(/\//g, '/')}`
    if (copyText(abs)) {
      setCopied(f.path)
      setTimeout(() => setCopied((cur) => (cur === f.path ? null : cur)), 1200)
    }
  }
  const downloadFile = (f) => {
    try {
      window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`, '_blank')
    } catch {
      /* ignore */
    }
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 0', maxHeight: 260, overflowY: 'auto' }}>
      {rows.map((f) => {
        const depth = String(f.path).split('/').length - 1
        const name = String(f.path).split('/').pop()
        return (
          <div
            key={f.path}
            onClick={() => { if (!f.dir) onClickRow(f) }}
            title={f.dir ? name : `点击复制绝对路径：${workspaceRoot}/${f.path}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px 3px',
              paddingLeft: 10 + depth * 14,
              fontSize: 12, lineHeight: 1.5,
              cursor: f.dir ? 'default' : 'pointer',
              color: C.fg,
            }}
          >
            <span style={{ fontSize: 11, flexShrink: 0 }}>{f.dir ? '📁' : '📄'}</span>
            <span style={{ fontWeight: f.dir ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {copied === f.path ? <span style={{ color: C.ok }}>✓ 已复制</span> : name}
            </span>
            {!f.dir && (
              <span
                onClick={(e) => { e.stopPropagation(); downloadFile(f) }}
                title="在新标签页打开/下载"
                style={{ flexShrink: 0, cursor: 'pointer', fontSize: 11, padding: '0 3px', color: C.muted }}
              >
                ⬇
              </span>
            )}
            {!f.dir && <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>{fmtBytes(f.size)}</span>}
          </div>
        )
      })}
    </div>
  )
}

// 远程：SSH 主机行 + 最近作业
function RemoteSection({ sshHosts, sshJobs }) {
  const hosts = sshHosts || []
  const jobs = (sshJobs || []).slice(0, 5)
  return (
    <div>
      <Panel title="SSH 主机">
        {hosts.length === 0 && <Empty>暂无主机。命令 sci_ssh_profiles 可添加，sci_ssh_probe 探测。</Empty>}
        {hosts.map((h) => (
          <div key={h.name || h.key} style={{ fontSize: 12, padding: '4px 0', borderBottom: `1px solid ${C.divider}`, color: C.fg }}>
            🖥 <b>{h.name || h.key}</b> <span style={{ color: C.muted }}>{h.host} · {h.auth}{h.probedAt ? ' · 已探测' : ''}</span>
            {h.os && h.os !== '(空)' && <div style={{ fontSize: 10, color: C.faint, paddingLeft: 18 }}>{h.os}</div>}
          </div>
        ))}
      </Panel>
      <Panel title="远程作业（最近）">
        {jobs.length === 0 && <Empty>暂无作业。sci_job_submit 提交，结果经 sci_job_harvest 收回。</Empty>}
        {jobs.map((j) => (
          <div key={j.id || j.key} style={{ fontSize: 11, color: C.muted, padding: '3px 0' }}>
            {j.name || j.id || j.key} · {j.mode || j.profile || ''} · {fmtTime(j.submittedAt)}
          </div>
        ))}
      </Panel>
    </div>
  )
}

// 审查记录：/sci-review（或自动审查）每次 run 一条——状态点（done=绿/failed=红/parse-failed=琥珀）+
// turn + fail/warn 计数；行点击展开 findings 列表（与任务行同一展开模式）。N = reviews.length。
const REVIEW_STATUS_COLOR = {
  done: C.ok,
  failed: C.err,
  'parse-failed': C.warn,
}

function ReviewsSection({ reviews }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  if (!reviews || reviews.length === 0) {
    return <Empty>暂无审查记录。用 /sci-review 审查最近一轮回复，或让队长 sci_review_send 派给 reviewer。</Empty>
  }
  const rows = [...reviews].sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0))
  return (
    <div>
      {rows.map((r) => {
        const id = r.id || r.key
        const findings = Array.isArray(r.findings) ? r.findings : []
        const fails = findings.filter((f) => f && f.severity === 'fail').length
        const warns = findings.filter((f) => f && f.severity === 'warn').length
        const isOpen = expanded.has(id)
        return (
          <div key={id}>
            <div
              data-review-row={id}
              onClick={() => toggle(id)}
              title={`${id} · 点击${isOpen ? '收起' : '展开'}findings`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', marginBottom: 4,
                border: `1px solid ${C.border}`, borderRadius: 8, background: C.card,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <Dot color={REVIEW_STATUS_COLOR[r.status] || C.faint} size={7} />
              <b style={{ color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto' }}>
                {id}
              </b>
              <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>turn {typeof r.turn === 'number' ? r.turn : '—'}</span>
              <span style={{ color: C.muted, fontSize: 11, flexShrink: 0 }}>fail {fails} · warn {warns}</span>
              <span style={{ color: C.faint, fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
                {fmtTime(r.finishedAt || r.startedAt)}
              </span>
              <span style={{ color: C.faint, fontSize: 10, flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
            </div>
            {isOpen && (
              <div
                style={{
                  border: `1px solid ${C.divider}`, borderRadius: 8,
                  padding: '6px 10px', marginBottom: 4,
                  background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6,
                }}
              >
                <div style={{ color: C.faint }}>
                  {id} · {r.status} · 触发 {r.trigger || 'review'} · turn {typeof r.turn === 'number' ? r.turn : '—'}
                  {r.sessionId ? ` · 会话 ${String(r.sessionId).slice(0, 12)}` : ''}
                </div>
                {findings.length === 0 && (
                  <div style={{ marginTop: 4 }}>
                    （无 findings{r.status === 'parse-failed' ? '——审查器输出未解析为 JSON，本次不构成结论' : ''}）
                  </div>
                )}
                {findings.map((f, i) => (
                  <div key={i} style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    <b style={{ color: f && f.severity === 'fail' ? C.err : f && f.severity === 'warn' ? C.warn : C.ok }}>
                      [{String((f && f.severity) || '?').toUpperCase()}]
                    </b>{' '}
                    ({(f && f.check) || '?'}) {(f && f.message) || ''}
                    {f && f.evidence ? ` | 证据: ${String(f.evidence).slice(0, 160)}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArtifactsTab({ data, focusFigureId, onClearFocusFigure }) {
  const figs = Array.isArray(data.figures) ? data.figures : []
  const files = Array.isArray(data.files) ? data.files : []
  const reviews = Array.isArray(data.reviews) ? data.reviews : []
  return (
    <div>
      <Panel title={`图表（${figs.length}）`}>
        <FiguresSection figures={figs} workspaceRoot={data.workspaceRoot} focusFigureId={focusFigureId} onClearFocus={onClearFocusFigure} />
      </Panel>
      <Panel title={`文件（${files.length}）`}>
        <FilesSection files={files} workspaceRoot={data.workspaceRoot} />
      </Panel>
      <RemoteSection sshHosts={data.sshHosts} sshJobs={data.sshJobs} />
      <Panel title={`审查（${reviews.length}）`}>
        <ReviewsSection reviews={reviews} />
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- 主组件 ------

class SafeBody extends React.Component {
  constructor(p) {
    super(p)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 10, fontSize: 12, color: C.err }}>
          <b>工作台渲染出错</b>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{String((this.state.err && this.state.err.message) || this.state.err)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function WorkbenchBody({ openMemberSession, memberOpenAvailable }) {
  // 默认停留在「团队」（v0.7.0 保持；「文章框架」是第二标签，按需点击查看蓝图框架图）
  const [tab, setTab] = useState('team')
  // fix3/fix6：跨标签聚焦 id（文章框架 tab 任务/图表 chip → 目标面板展开+滚动后自行清除）
  const [focusTaskId, setFocusTaskId] = useState(null)
  const [focusFigureId, setFocusFigureId] = useState(null)
  const state = usePollState(POLL_MS)
  const goTeam = (taskId) => {
    if (taskId) setFocusTaskId(taskId)
    setTab('team')
  }
  const goArtifacts = (figureId) => {
    if (figureId) setFocusFigureId(figureId)
    setTab('artifacts')
  }
  return (
    <div style={{ padding: 10, fontSize: 13 }}>
      {/* 运行中状态点呼吸/成员工作律动/DAG 节点辉光动画 + v0.9.0 hover/transition 打磨
        （agent-teams 120-180ms ease 模式；:hover 需 !important 覆盖行内底色/边框） */}
      <style>{'@keyframes dsh-sci-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }'
        + '@keyframes dsh-sci-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }'
        + '@keyframes dsh-sci-nodeglow { 0%,100% { box-shadow: 0 0 0 0 rgba(27,110,194,0) } 50% { box-shadow: 0 0 6px 1px rgba(27,110,194,0.4) } }'
        + '[data-task-row],[data-fig-card],[data-result-row],[data-review-row],[data-inbox-row],[data-member-tile],[data-dag-node],[data-dep-chip],[data-row-dep-chip],[data-fig-prev]{transition:background-color 120ms ease,border-color 120ms ease,opacity 120ms ease,color 120ms ease}'
        + '[data-task-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}'
        + '[data-result-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}'
        + '[data-review-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}'
        + '[data-fig-card]:hover{border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}'
        + '[data-inbox-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important}'
        + '[data-member-tile]:hover{background:var(--dsw-alias-button-ghost-active-fill, rgba(127,127,127,0.14))}'
        + '[data-dag-node]{transition:border-color 140ms ease,background 140ms ease,box-shadow 220ms ease}'
        + '[data-dag-node]:hover{border-color:var(--dsw-alias-state-business-primary, #1B6EC2)!important}'
        + '[data-dep-chip]:hover,[data-row-dep-chip]:hover{border-color:var(--dsw-alias-state-business-primary, #1B6EC2)!important;color:var(--dsw-alias-state-business-primary, #1B6EC2)!important}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <b style={{ fontSize: 14 }}>🧪 科研工作台</b>
        <span style={{ fontSize: 10, color: C.muted }}>v{VERSION}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, margin: '4px 0 2px' }}>
        {[
          ['team', '团队'],
          ['paper', '文章框架'],
          ['artifacts', '产物'],
        ].map(([id, label]) => (
          <button
            key={id}
            data-tab={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 12,
              border: `1px solid ${tab === id ? C.accent : C.border}`,
              borderRadius: 6,
              background: tab === id ? C.accent : 'transparent',
              color: tab === id ? '#fff' : C.fg,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <SafeBody>
        <DataGate state={state} fallback={tab === 'team' ? <SkillMenuDesktopFallback /> : null}>
          {() =>
            tab === 'team' ? (
              <TeamTab
                data={state.data}
                openMemberSession={openMemberSession}
                memberOpenAvailable={memberOpenAvailable}
                focusTaskId={focusTaskId}
                onClearFocusTask={() => setFocusTaskId(null)}
                refresh={state.refresh}
              />
            ) : tab === 'paper' ? (
              <BlueprintTab data={state.data} onOpenTask={goTeam} onOpenFigure={goArtifacts} />
            ) : (
              <ArtifactsTab data={state.data} focusFigureId={focusFigureId} onClearFocusFigure={() => setFocusFigureId(null)} />
            )
          }
        </DataGate>
      </SafeBody>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 8, borderTop: `1px solid ${C.divider}`, paddingTop: 6 }}>
        技能由团队成员自主使用 · 数据每 3 秒刷新
      </div>
    </div>
  )
}

export function apply(ctx) {
  // B3（v0.10.0）防双份挂载 guard：v0.9 验收时发现右侧工作台面板出现双份（两次打开/档案 reload）。
  // 根因：同一页面域内 apply() 被再次调用（热重载/档案重挂载/插件重复激活）时，
  // sidebarRightTabs.register('dsh-science/workbench') 与 slots.inject 仍持有首次注册——
  // 重复注册会叠加出双份面板。guard：window.__DSH_SCIENCE_CLIENT_MOUNTED 已置位 → 直接 return
  // （保留首次注册，打日志）。整页 reload / 双开新窗口都是全新 window 对象，guard 不存在，
  // 正常重挂载不受影响。
  try {
    if (window.__DSH_SCIENCE_CLIENT_MOUNTED) {
      console.warn('[dsh-science] apply() re-invoked on an already-mounted page; keeping first registration (double-mount guard)')
      return
    }
    window.__DSH_SCIENCE_CLIENT_MOUNTED = true
    window.__DSH_SCIENCE_CLIENT_APPLIED = true
  } catch {
    /* ignore（非浏览器环境） */
  }

  // ---- 成员会话跳转（F4）------------------------------------------------------
  // 说明：uiWorkspace 与 sessions 均按可选能力探测（ctx.get + 特征检查），
  // 与 agent-teams 的处理一致——宿主缺失时整个客户端仍正常加载，仅隐藏跳转能力
  // （成员行指针不变、点击给提示），不做硬 inject 依赖。
  function service(name) {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }

  // 当前主会话 id：优先 byId + retainedBy.mainView（宿主 ui-workspace 自身用法），
  // 兼容快照直接带 current 的旧形态
  function currentSessionIdOf() {
    try {
      const list = service('sessions') && service('sessions').list
      if (!list || typeof list.getSnapshot !== 'function') return undefined
      const snap = list.getSnapshot()
      if (!snap) return undefined
      const row = Object.values(snap.byId || {}).find(
        (r) => r && r.retainedBy && (r.retainedBy.mainView ?? 0) > 0,
      )
      if (row && row.id) return row.id
      if (typeof snap.current === 'string') return snap.current
      return undefined
    } catch {
      return undefined
    }
  }

  // 打开成员会话：uiWorkspace.openSession({ parentSessionId, childSessionId, mode: 'continuable' })
  // 不可用时 throw（调用方 catch 后 toast 提示）。
  // F5（v0.7.1）：parentSessionId 优先用成员 spawn 时记录的真实父会话（team.members[].parentSessionId，
  // lib/team.js spawnMember 记录）；存量成员无该字段时回退「当前主会话」（v0.7.0 原行为）——
  // 若用户当前主视图停在另一成员会话，回退路径可能选错父会话，属已知限制（重生成员后自愈）。
  function openMemberSession(member) {
    const ws = service('uiWorkspace')
    if (!ws || typeof ws.openSession !== 'function') {
      throw new Error('当前宿主不支持打开成员会话（uiWorkspace 缺失）')
    }
    const childId = member && member.childId
    if (!childId) throw new Error('该成员未记录 childId（较老的任务板数据，重新生成成员后可用）')
    const recorded = member && member.parentSessionId
    const parentId = recorded || currentSessionIdOf()
    if (!parentId) throw new Error(recorded ? '该成员记录的父会话为空' : '无法确定当前主会话（该成员也未记录 parentSessionId）')
    ws.openSession({ parentSessionId: parentId, childSessionId: childId, mode: 'continuable' })
  }

  // 能力探测：uiWorkspace 可用且能确定 parent 会话 → 成员行才显示可点击
  function memberOpenAvailable() {
    try {
      const ws = service('uiWorkspace')
      if (!ws || typeof ws.openSession !== 'function') return false
      // 与 openMemberSession 同口径：有当前会话，或成员记录了真实父会话（跨会话成员）
      return !!currentSessionIdOf() || teamRuntime.hasRecordedParents
    } catch {
      return false
    }
  }

  // 右栏工作台标签页
  try {
    ctx.effect(
      () =>
        ctx.sidebarRightTabs.register({
          id: 'dsh-science/workbench',
          kind: 'workbench',
          title: () => '科研工作台',
          guide: [
            {
              id: 'workbench',
              order: 10,
              title: () => '科研工作台',
              description: () => '任务流 DAG（成员姿态/依赖跳转/收件箱）· 文章框架（确认/参考文献/快筛）· 产物（图表版本链/文件/远程/审查）（dsh-science）',
            },
          ],
        }),
      'dsh-science workbench tab type'
    )
    ctx.effect(
      () =>
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register(
            {
              name: 'sidebar.right.pane.tab',
              key: 'dsh-science/workbench',
              inject: () => ({ openMemberSession, memberOpenAvailable }),
            },
            WorkbenchBody,
          ),
        ),
      'dsh-science workbench tab body'
    )
  } catch (err) {
    console.error('[dsh-science] sidebar tab registration failed:', err)
  }
}
