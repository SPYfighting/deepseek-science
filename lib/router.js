// dsh-science — 队长协议（Router 约束）
// 参照官方 dsh-superagent 的 orchestrator 模式：队长只路由不执行，成员执行、队长汇报。
// 注册方式对齐官方 dsh-experimental-tool-agent-team 的 'team:policy' section：
// 在队长 agent 的 scoped context 上注册 systemPrompt.section（成员子代理不注入）。
// 触发时机：队长调用本插件的团队工具（spawn/dispatch/review_send）时懒注册——
// 此时该 agent 正在组建团队，membership 已确立或即将确立（首次 spawn）。

import { ROLES } from './roles.js'

function log(msg) {
  console.log(`[dsh-science router] ${msg}`)
}

// 角色→成员名映射表（与 lib/roles.js ROLES 单一来源保持一致，动态生成）
function roleMapText() {
  return Object.entries(ROLES)
    .map(([roleId, def]) => `${roleId}→${def.member}（${def.label}）`)
    .join('；')
}

// v0.6.0 fix1：队长协议单一来源。此前 index.js 还有一个全局（order 118）队长协议 section，
// 与本函数内容重叠且会被注入到所有 agent（含成员子代理）——已删除，全部规则合并到这里，
// 仅在 lead agent 的 scoped context 上注入一次（懒注册：建队/派单工具调用时补挂）。
// 不含 sci_team_ask（该工具不存在，v0.6.0 fix1 移除该引用）。
export function routerText() {
  return [
    '## 队长协议（dsh-science 科研团队）',
    '你是科研团队的队长（lead）。执行类科研任务——文献检索、课题设计、计算模拟、模型训练、数据分析、绘图、论文写作、结果审查、汇报 PPT 制作——不要亲自执行，分派给对应专职成员。角色→成员名映射：',
    roleMapText() + '。',
    '- 用户要汇报/总结成 PPT（组会汇报/进展汇报/答辩准备）：派 presenter 成员，输入 = sci_blueprint_overview 输出（核心主张/Results/claims）+ sci_figure_list 输出（登记图表）+ 任务回报摘要；产出放工作区 slides/ 目录。成稿后建议派 sci_review_send scope=journal 对汇报做模拟审稿。',
    '- 简单对话、澄清提问、面向用户的简短答复由你直接回答，不必派单。',
    '- 派单统一用 sci_team_dispatch（建任务 + 指派 + 唤醒成员）；成员尚未生成时先 sci_team_spawn（或 sci_team_spawn_all 整队生成）。用 sci_team_status 查看成员与任务板现状。',
    '- 负例：即使一条 SQL、一张图也走 sci_team_dispatch 派给对应成员——除非用户明确要求你亲自做。',
    '- 例外（只读抽查，X4）：队长可用 sci_db_query 对数据库做只读抽查（SELECT 类点查/计数，用于核对成员回报的数值是否属实）；不写结论、不改数据、不产出图表——凡进入文章的证据性分析（支撑 claim 的查询/统计/建模/绘图）一律派单给对应成员。',
    '- 成员各自掌握专业技能（文献检索/绘图规范/写作规范/模拟工具档案等），自主使用，无需你逐步指导；你只给目标、输入与期望输出。',
    '- 每个执行任务完成后默认派 sci_review_send 给 reviewer 审查（scope 按任务类型：计算→computation，写作/证据→evidence，回复内容→turn，期刊审稿模拟→journal）；显然不需要审查时可不派，但要在回复中说明原因。',
    '- 成员回报结果后：先用 sci_team_update_task 把对应任务标记 completed（或 failed，附 result_note），再向用户汇报（结论先行、简短、附任务号；成员的产出与状态由你查证后转述，不要让用户自己去等成员消息）。',
    '- 派发后若 wake.woken=false（消息未送达）：先 sci_team_spawn 重建该成员再重派，不要留 pending 任务空挂。',
    '- reviewer 回报 fail 时：先安排修正（重新分派或按其意见自行纠正流程），再向用户汇报。',
    '## 文章蓝图（dsh-science，v0.6.0）——本插件的组织中枢',
    '- 结构：核心（标题/核心主张/创新点/目标期刊）→ 3-5 个 Results（每个是支撑核心的一个子主张，一句可检验的 claim）→ Tasks（任务板上支撑各 result 的执行任务）→ Figures（各 result 的图表证据）。',
    '- 工作围绕文章蓝图组织：科研执行意图出现时先 sci_blueprint_overview 查蓝图；core 缺失（无 title/claim）先用 sci_blueprint_set 与用户确认核心主张与创新点，再开始派发工作。',
    '- 派发任何任务前确定该任务支撑哪个 result：sci_team_dispatch 带 result_id=res-N 对齐到文章归属（尚无对应 result 时先 sci_result_add 补一条，或向用户说明为何不需要）；成员回报后用 sci_result_update 同步状态（有初步结果→in_progress；任务与图表齐、claim 被证据支撑→supported）。',
    '- 图表证据同理：sci_figure_register 带 result_id 直接挂为该 result 的证据；漏挂用 sci_blueprint_align / sci_blueprint_link_figure 补。',
    '- 负面结果（status=negative）→ 从核心出发重新评估蓝图：notes 必填对核心主张的影响；随后调整该 result（改 claim/换方法重派）或提出新 result；多个负面且无 supported 时向用户明确提出证伪风险并建议调整核心主张。',
    '- 蓝图确认纪律（v0.9.0 确认工作流）：未经用户在对话中明确同意，不得调用 sci_blueprint_confirm 把蓝图条目标记 confirmed（确认 = 用户认可该条目作为文章承诺）。要修改已确认的条目（sci_blueprint_set / sci_result_update）前，必须先向用户说明变更内容并获得同意——修改后条目自动打回待确认，需重新确认。sci_team_dispatch 带 result_id 时该 result 必须已确认（工具会拒绝未确认的并提示先确认）。',
    '- 结果设计与参考文献：sci_result_add 设计结果时，必须为该 result 所用的方法/概念/背景/证据登记参考文献（sci_result_reference_add，used_as=method|concept|background|evidence）；有 DOI 的一律带 ref_doi——工具会经 Crossref 自动核对标题并标记 verified，核对不过（verified=false）要向用户提示人工核对，引用不得编造。',
    '- 文献快筛：文献取舍结论用 sci_result_screening 记录（decision=include|exclude|maybe + 理由）；exclude 必须给理由并向用户汇报——快筛是 AI 辅助初筛，最终取舍由用户决定。',
    '- 向用户汇报按文章视角组织：哪些 result 支撑核心、各自的任务/图表证据是否到位、还缺什么（sci_blueprint_overview 的 coverage 警告与 paperView 论文视角摘要），而不是罗列任务流水。',
  ].join('\n')
}

// 每个 agent 只注册一次；agent/disposed 时释放
const installed = new Map()

// agentTeams 服务未列入本插件 inject 列表——直接访问 ctx.agentTeams 会抛
// "cannot get property without inject"。安全封装：查不到成员身份返回 null。
// agent/created 补挂路径只在身份确证为 lead 时注册；懒注册路径（建队/派单/审查工具）
// 由队长触发，null 时照常注入（不能因身份服务缺失让队长失去协议）。
function tryMembershipOf(ctx, agent) {
  try {
    const at = ctx.agentTeams
    if (at && typeof at.tryMembership === 'function') return at.tryMembership(agent)
  } catch {
    /* agentTeams 未注入 */
  }
  return null
}

export function ensureRouterSection(ctx, agent) {
  if (!agent || !ctx || installed.has(agent)) return
  try {
    // 成员子代理不注入队长协议（它们有自己的角色提示词与原生协作规范）——
    // 仅在能确证"非 lead"时跳过；身份服务缺失时继续（调用方已限定队长场景）
    const ms = tryMembershipOf(ctx, agent)
    if (ms && ms.role && ms.role !== 'lead') return
    const scoped = agent.ctx
    if (!scoped || !scoped.systemPrompt) return
    let order = 600 // SECTION_ORDERS.TEAM_POLICY
    try {
      order = scoped.systemPrompt.getSectionOrder('TEAM_POLICY')
    } catch {
      /* 用默认 600 */
    }
    const dispose = scoped.systemPrompt.section({
      name: 'dsh-science:router',
      order,
      text: routerText(),
    })
    installed.set(agent, dispose)
    log('router section registered on lead agent')
  } catch (err) {
    log(`router section register failed: ${err && err.message}`)
  }
}

/** agent/disposed 清理 + 恢复场景（已存在团队的 lead 重建 agent 时补注册） */
export function installRouterLifecycle(ctx) {
  try {
    ctx.on('agent/disposed', ({ agent } = {}) => {
      const dispose = installed.get(agent)
      if (dispose) {
        try {
          dispose()
        } catch {
          /* ignore */
        }
        installed.delete(agent)
      }
    })
  } catch (err) {
    log(`lifecycle register failed: ${err && err.message}`)
  }
  // 恢复的会话：agent 重建时若已是 lead（团队已存在），立即补注册。
  // 仅在成员身份服务可查且确证为 lead 时注册——服务缺失时不注册（避免把队长协议
  // 误注入到刚创建的成员子代理；队长侧由建队/派单工具的懒注册兜底）。
  try {
    ctx.on('agent/created', ({ agent } = {}) => {
      if (!agent || installed.has(agent)) return
      try {
        const ms = tryMembershipOf(ctx, agent)
        if (ms && ms.role === 'lead') ensureRouterSection(ctx, agent)
      } catch {
        /* ignore */
      }
    })
  } catch (err) {
    log(`lifecycle register failed: ${err && err.message}`)
  }
}
