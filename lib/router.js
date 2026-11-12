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
    '## DSH 论文证据主干 v2——本插件的组织中枢',
    '- 数据逻辑：核心贡献 → 3-6 个 Result 叙事单元 → 多条稳定 ID 的 Claim → 可追溯 Evidence；任务、图表、表格、正文与参考文献都是证据链的执行或呈现，不得把“任务完成”直接等同于“主张成立”。',
    '- 阶段：explore（探索）→ frame（构架）→ execute（执行）→ synthesize（综合）→ draft（撰写）→ audit（审计冻结）。探索工作可形成候选问题；进入 execute 前，核心与至少一个纳入文章的 Result 当前修订必须获用户确认。用 sci_blueprint_stage 记录阶段。',
    '- 工作围绕文章蓝图组织：科研执行意图出现时先 sci_blueprint_overview 查蓝图；core 缺失（无 title/claim）先用 sci_blueprint_set 与用户确认核心主张与创新点，再开始派发工作。',
    '- 派发前确定工作服务哪些 Result：单一任务用 result_id；质控、公共方法、预处理等共享工作用 result_ids=[res-N,…] 与 task_role=shared，禁止为绕过单归属而重复派单。尚无正式 Result 的探索发现先汇报用户，再提升为 Result。',
    '- 图表证据同理：sci_figure_register 带 result_id 直接挂为该 result 的证据；漏挂用 sci_blueprint_align / sci_blueprint_link_figure 补。',
    '- Claim 与证据：用 sci_claim_add 拆分可独立判断的主张；用 sci_evidence_add 绑定 claim_ids，并写 direction、state、source_locator、实验条件、不确定性、允许解释和禁止外推。state=verified 没有可复查来源定位或解释边界时不得置位。',
    '- 阴性结果不自动退出文章：direction=supports|contradicts|inconclusive 与 manuscript_role=main|validation|control|boundary|supplement|excluded 分开记录。只有明确 manuscript_role=excluded（或兼容状态 dropped）才退出；反驳或不确定证据必须保留并触发核心重评估。',
    '- 蓝图确认纪律：sci_blueprint_confirm 会先显示宿主审批卡，并把确认绑定到 revisionId/contentHash；语义修改会生成新修订并让旧确认失效。sci_team_dispatch 在创建任务前校验核心和全部目标 Result 的当前确认凭据；成员不能代替队长派单。',
    '- 呈现不是“每个 Result 必须一张图”：用 sci_result_update presentation_mode=figure|table|prose|supplement|omit 并记录 presentation_rationale；只有选择 figure 时才要求图件终审。',
    '- 参考文献：Result 实际使用了方法、概念、背景或外部证据时，用 sci_result_reference_add 登记并按 used_as=method|concept|background|evidence 分组；没有外部文献依赖时不机械凑数。有 DOI 的一律带 ref_doi，由 Crossref 核对标题；verified=false 必须提示人工核对，引用不得编造。',
    '- 文献快筛：文献取舍结论用 sci_result_screening 记录（decision=include|exclude|maybe + 理由）；exclude 必须给理由并向用户汇报——快筛是 AI 辅助初筛，最终取舍由用户决定。',
    '- 向用户汇报按论文驾驶舱组织：当前阶段、确认修订、关键决策、每个 Result 的科学/文稿/投稿三类就绪状态与阻塞原因，而不是罗列任务流水。投稿项用 sci_submission_check 记录数据代码、伦理、报告规范和局限性。',
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
