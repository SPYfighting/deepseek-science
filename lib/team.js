// dsh-science — 科研团队（自研实现，建在稳定的 ctx.subagents spawn/fork 原语上）
// 说明：npm 的 experimental agent-team 包（0.1.5-alpha.2）与 dsh 0.2.2-rc.1 不兼容（启动即禁用），
// 因此参照 agent-teams 插件的做法：成员 = 命名子代理（spawn, fresh context, delivery 'parent'），
// 任务板 = 本插件文件状态（$DSH_HOME/dsh-science/team.json + 工作区镜像），派发 = 建任务 + sendMessage 唤醒成员。
// 队长 = 主会话（lead），Router 约束由 index.js 的 systemPrompt section 提供。

import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirOf } from './store.js'
import { ROLES, DEFAULT_TEAM, rolePrompt, roleLabel } from './roles.js'
import { alignTaskToResult, pruneTasksFromResults, loadBlueprint } from './blueprint.js'
import { ensureRouterSection } from './router.js'
// v0.9.0 角色级 skill 菜单：spawn 提示词末尾追加「扩展技能库」段（已安装技能 INDEX.md 路径清单）
// + simulator 专属的通用计算模拟规范（新工具上手 8 步规范绝对路径）。技能不进全局 registry，
// 只经这段提示词对对应角色成员生效（跨角色隔离），成员用读文件工具按需取用。
import { roleSkillSectionText, universalOnboardingText } from './skillmenu.js'

function log(msg) {
  console.log(`[dsh-science team] ${msg}`)
}

const teamFile = () => join(dataDirOf(), 'team.json')

// 队长协议懒注册（v0.6.0 fix1）：全局 section 已删，协议单一来源在 lib/router.js（scoped）。
// 队长调用建队/派单工具时补挂一次（ensureRouterSection 内部有幂等与成员豁免守卫）。
function ensureLeadProtocol(ctx, exec) {
  try {
    ensureRouterSection(ctx, exec && exec.agent)
  } catch {
    /* 注册失败不影响工具执行 */
  }
}

// 任务板损坏隔离（X3，对齐 blueprint fix4）：解析失败或结构非法（members/tasks 缺失或非数组）
// → 坏文件改名备份为 team.json.corrupt-<ts>（quarantine，备份保留）+ console.error 报警，
// 返回空任务板。文件不存在（首跑常态）不算损坏。
function quarantineTeam(reason) {
  const backupName = `team.json.corrupt-${Date.now()}`
  try {
    renameSync(teamFile(), join(dataDirOf(), backupName))
    console.error(`[dsh-science team] team.json ${reason}，已隔离备份为 ${backupName}`)
  } catch (berr) {
    console.error(`[dsh-science team] team.json ${reason}且隔离备份失败（${berr && berr.message}）`)
  }
}

function loadTeam() {
  let raw = null
  try {
    raw = readFileSync(teamFile(), 'utf8')
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.error(`[dsh-science team] team.json read failed (treated as empty): ${err && err.message}`)
    }
    return { members: [], tasks: [], taskSeq: 0 }
  }
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    quarantineTeam(`解析失败（${err && err.message}）`)
    return { members: [], tasks: [], taskSeq: 0 }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.members) || !Array.isArray(parsed.tasks)) {
    quarantineTeam('结构非法（不是任务板对象或缺 members/tasks 数组）')
    return { members: [], tasks: [], taskSeq: 0 }
  }
  if (typeof parsed.taskSeq !== 'number') parsed.taskSeq = 0
  // v0.8.0：taskSeq 与现存 task-N 最大序号对齐（同 lib/blueprint.js normalizeIdSeq 思路）——
  // 历史会话/并发写回可能让 taskSeq 落后于实际任务数（实测：34 条任务 taskSeq=31），再派发
  // 就会生成重复 task-N id（presenter 首派即撞 task-31）。读档即对齐，一次性自愈。
  let maxTaskSeq = 0
  for (const t of parsed.tasks) {
    const m = /^task-(\d+)$/.exec(String((t && t.id) || ''))
    if (m) maxTaskSeq = Math.max(maxTaskSeq, Number(m[1]))
  }
  if (maxTaskSeq > parsed.taskSeq) {
    log(`taskSeq ${parsed.taskSeq} 落后于现存最大 task id（task-${maxTaskSeq}），读档对齐`)
    parsed.taskSeq = maxTaskSeq
  }
  return parsed
}

export function registerTeamTools(ctx, opts = {}) {
  const mirror = opts.mirror

  // 原子写：先写 .tmp 再 renameSync 覆盖目标（rename 失败时退回直接写，避免状态丢失）
  function persist(state, exec) {
    const text = JSON.stringify(state, null, 2)
    const tmp = `${teamFile()}.tmp`
    try {
      writeFileSync(tmp, text, 'utf8')
      renameSync(tmp, teamFile())
    } catch (err) {
      log(`atomic persist fallback: ${err && err.message}`)
      writeFileSync(teamFile(), text, 'utf8')
    }
    if (mirror) mirror('team.json', text, exec)
  }

  // runtime 0.2.2 无 resolveName：成员身份用 spawn 时记录的 childId（直接父子可 sendMessage）
  function childIdOf(memberName) {
    const state = loadTeam()
    const m = state.members.find((x) => x.name === memberName)
    return m && m.childId
  }

  async function wake(agent, memberName, text) {
    const childId = childIdOf(memberName)
    if (!childId) return { woken: false, error: `成员 ${memberName} 不存在或未记录 childId（先 sci_team_spawn）` }
    try {
      await ctx.subagents.sendMessage(agent, childId, [{ type: 'text', text }], {})
      return { woken: true }
    } catch (err) {
      const msg = String(err && err.message)
      // harness 在消息已被接受后仍可能抛中止类异常（成员实际已收到）——视为已送达
      if (msg.includes('throwIfAborted') || msg.includes('aborted')) {
        log(`wake post-delivery abort ignored for ${memberName}`)
        return { woken: true, note: 'post-delivery abort ignored' }
      }
      return { woken: false, error: msg }
    }
  }

  async function spawnMember(exec, role, nameOverride) {
    const def = ROLES[role]
    if (!def) throw new Error(`未知角色 ${role}。可用：${Object.keys(ROLES).join(' | ')}`)
    const agent = exec && exec.agent
    if (!agent) throw new Error('无法确定调用者（需要主会话）')
    ensureLeadProtocol(ctx, exec)
    const prompt = rolePrompt(role)
    if (!prompt) throw new Error(`角色提示词缺失：${role}`)
    const name = (nameOverride || def.member).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const state = loadTeam()
    const existing = state.members.find((m) => m.name === name)
    if (existing) {
      // X4：同名成员已存在 → 复用现有成员（返回 childId 供 sci_team_send 唤醒），不逼新名。
      // F5（v0.7.1）：存量成员缺 parentSessionId 时补记当前主会话（建队/派单工具须主会话调用，
      // exec.agent 即其真实父会话）——成员会话跳转（客户端优先用该字段）随复用自愈。
      const liveParentId = agent && (agent.id || agent.sessionId)
      if (!existing.parentSessionId && liveParentId) {
        existing.parentSessionId = liveParentId
        persist(state, exec)
        log(`member ${name} parentSessionId backfilled: ${liveParentId}`)
      }
      return {
        ok: true,
        name,
        role: existing.role || role,
        childId: existing.childId || null,
        reused: true,
        note: '成员已存在，复用现有成员（返回 childId）——直接用 sci_team_send 按成员名唤醒即可，无需改名。',
      }
    }
    // v0.9.0：团队协作规范之后追加 ① simulator 通用模拟规范（新工具 8 步上手）② 该角色已安装
    // 扩展技能的 INDEX.md 索引段（无已安装技能时 roleSkillSectionText 返回 ''，提示词保持精简）。
    const fullPrompt = `${prompt}\n\n${teamProtocolText()}${universalOnboardingText(role)}${roleSkillSectionText(role)}`
    const childId = `sci-${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    let activation
    try {
      activation = await ctx.subagents.startActivation({
        delivery: 'parent',
        childId,
        provider: 'spawn',
        label: `dsh-science:${role}:${name}`,
        request: {
          prompt: [{ type: 'text', text: fullPrompt }],
          parent: agent,
        },
        signal: AbortSignal.timeout(120000),
      })
    } catch (err) {
      log(`spawn FAILED stack: ${err && err.stack}`)
      throw err
    }
    state.members.push({
      name,
      role,
      label: def.label,
      childId,
      // F5（v0.7.1）：记录 spawn 时的真实父会话 id（成员会话跳转用——客户端 openMemberSession
      // 优先于「当前主会话」推断；httpdata /state 对 team.members 原样透传）。
      // Agent 身份 = agent.id（dsh-agent/types Agent 接口；sessionId 为旧字段名兜底）
      parentSessionId: (agent && (agent.id || agent.sessionId)) || null,
      spawnedAt: Date.now(),
    })
    persist(state, exec)
    log(`member spawned: ${name} (${role}) childId=${activation.childId}`)
    return { ok: true, name, role, childId: activation.childId }
  }

  function teamProtocolText() {
    return [
      '## 团队协作规范（dsh-science）',
      '- 你是科研团队的专职成员，由队长（lead）通过消息给你派任务。',
      '- 收到任务消息后：按你的角色提示词执行，完成后把结果作为回复发回（结果会送达队长）。',
      '- 严格遵守角色提示词中的工具纪律与输出合同；超出职责/需要新资源时如实说明，不要编造。',
    ].join('\n')
  }

  // -- 生成成员 ---------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_team_spawn',
    description: `生成科研团队专职成员（可续跑的命名子代理）。role 可选：${Object.keys(ROLES).join(' | ')}。需要主会话调用。`,
    parameters: {
      role: { type: 'string' /*必填*/, description: `角色 id：${Object.keys(ROLES).join(' | ')}` },
      name: { type: 'string', description: '成员名（缺省用角色默认名）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      return spawnMember(exec, String(args.role), args.name ? String(args.name) : undefined)
    },
  })

  // -- 整队生成 ----------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_team_spawn_all',
    description: `按默认科研编制一次性生成全部成员（${DEFAULT_TEAM.join(', ')}）。已存在的跳过。`,
    parameters: {},
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const results = []
      for (const role of DEFAULT_TEAM) {
        try {
          const def = ROLES[role]
          const state = loadTeam()
          if (state.members.some((m) => m.name === def.member)) {
            results.push({ name: def.member, skipped: true })
            continue
          }
          results.push(await spawnMember(exec, role, def.member))
        } catch (err) {
          results.push({ role, error: String(err && err.message) })
        }
      }
      return { ok: true, results }
    },
  })

  // -- 任务派发 ----------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_team_dispatch',
    description:
      '向团队任务板派发科研任务并唤醒执行成员。assignee 填成员名（scout/designer/analyst/simulator/trainer/figure/writer/reviewer/presenter）；成员未生成时任务挂板待领。完成后成员会把结果作为消息发回。result_id 可把任务直接对齐到文章蓝图的某个 result（res-N）。',
    parameters: {
      subject: { type: 'string' /*必填*/, description: '任务标题（一句话）' },
      task_desc: { type: 'string' /*必填*/, description: '任务详细描述：目标、输入、期望输出' },
      assignee: { type: 'string', description: '成员名（可缺省=待领）' },
      blocked_by: { type: 'array', description: '依赖任务 id 数组（task-1 等）' },
      result_id: { type: 'string', description: '文章蓝图 result id（res-N，见 sci_blueprint_overview）；提供时任务自动挂为该 result 的支撑工作' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const agent = exec && exec.agent
      if (!agent) throw new Error('无法确定调用者')
      ensureLeadProtocol(ctx, exec)
      // 确认工作流闸门（v0.9.0 Track 2 B1）：dispatch 引用的 result 必须已确认（confirmed）。
      // 未确认 → 拒绝并提示先与用户确认、sci_blueprint_confirm 置位后重派——未确认的子主张
      // 不构成文章承诺，不能开始烧算力派工。
      if (args.result_id) {
        const rid = String(args.result_id)
        const bp = loadBlueprint()
        const result = (bp.results || []).find((r) => r && r.id === rid)
        if (!result) {
          throw new Error(`result ${rid} 不存在（现有：${(bp.results || []).map((r) => r && r.id).filter(Boolean).join(', ') || '（空）'}）。先 sci_result_add 创建，或 sci_blueprint_overview 查看。`)
        }
        if (result.confirmed !== true) {
          throw new Error(`result ${rid} 尚未确认（confirmed=false）——未经用户确认的子主张不能派发支撑任务。先向用户复述该 result 的主张（${result.claim || '（无 claim）'}）并获明确同意，然后调用 sci_blueprint_confirm kind=result result_id=${rid}，再重新派发。`)
        }
      }
      const state = loadTeam()
      state.taskSeq = (state.taskSeq || 0) + 1
      const id = `task-${state.taskSeq}`
      const task = {
        id,
        subject: String(args.subject).slice(0, 200),
        desc: String(args.task_desc || '').slice(0, 4000),
        assignee: args.assignee ? String(args.assignee) : null,
        status: 'pending',
        blockedBy: Array.isArray(args.blocked_by) ? args.blocked_by.map(String) : [],
        // 双向对齐回写（v0.6.0 fix5/X4）：result.tasks 含 task-N 之外，task 对象也记录 resultId
        //（团队 tab 任务行据此显示 res-N 徽章；对齐失败时清除该标记，徽章与蓝图实际对齐状态
        // 保持一致——错误经 blueprintAlign 回报，X4）
        resultId: args.result_id ? String(args.result_id) : null,
        createdAt: Date.now(),
      }
      state.tasks.push(task)
      // 任务板截断（>200）：同时把被截掉的 task id 从蓝图 result.tasks 里摘除（防死引用）
      if (state.tasks.length > 200) {
        const removed = state.tasks.slice(0, state.tasks.length - 200).map((t) => t && t.id).filter(Boolean)
        state.tasks = state.tasks.slice(-200)
        if (removed.length > 0) {
          try {
            pruneTasksFromResults(removed, { exec, mirror })
          } catch (err) {
            log(`prune truncated tasks from blueprint failed: ${err && err.message}`)
          }
        }
      }
      persist(state, exec)
      let wakeResult = { woken: false }
      let taskAfterWake = task
      if (task.assignee) {
        wakeResult = await wake(agent, task.assignee, `新任务 ${id}：${task.subject}\n\n${task.desc}${task.blockedBy.length ? `\n（依赖：${task.blockedBy.join(', ')}，若未完成请先在任务板确认）` : ''}\n\n完成后把结果作为消息发回队长。`)
        if (wakeResult.woken) {
          // 唤醒成功即视为成员已领任务：pending → claimed（持久化到任务板）
          // 读-改-写：唤醒期间成员侧可能已回写任务板，先重读 state 再改，避免用 stale 副本覆盖
          const st2 = loadTeam()
          const t2 = st2.tasks.find((x) => x.id === id)
          if (t2) {
            t2.status = 'claimed'
            t2.claimedAt = Date.now()
            persist(st2, exec)
            taskAfterWake = t2
          }
        }
      }
      log(`task dispatched: ${id} → ${task.assignee || 'unowned'} (${taskAfterWake.status})`)
      // 文章蓝图对齐（v0.6.0）：带 result_id 时把任务挂到对应 result（对齐失败不阻断派发，只回报原因）
      let alignment = null
      if (args.result_id) {
        try {
          alignment = alignTaskToResult(id, args.result_id, { exec, mirror })
        } catch (err) {
          log(`blueprint align failed for ${id} → ${args.result_id}: ${err && err.message}`)
          alignment = { error: String(err && err.message) }
          // X4：对齐失败不给 task.resultId——回写清除，避免团队 tab 出现指向未对齐 result 的徽章
          try {
            const st3 = loadTeam()
            const t3 = st3.tasks.find((x) => x.id === id)
            if (t3 && t3.resultId) {
              t3.resultId = null
              t3.updatedAt = Date.now()
              persist(st3, exec)
            }
          } catch (e2) {
            log(`clear resultId after failed align for ${id} failed: ${e2 && e2.message}`)
          }
        }
      }
      const out = { ok: true, taskId: id, task: taskAfterWake, wake: wakeResult }
      if (alignment) out.blueprintAlign = alignment
      return out
    },
  })

  // -- 团队状态 ----------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_team_status',
    description: '查看科研团队现状：成员（角色）与任务板（状态/负责人/依赖）。',
    parameters: {},
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute() {
      const state = loadTeam()
      return {
        members: state.members.map((m) => ({ name: m.name, role: m.role, label: m.label })),
        tasks: state.tasks.slice(-50).map((t) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          assignee: t.assignee,
          blockedBy: t.blockedBy,
        })),
      }
    },
  })

  // -- 审查派发 ----------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_review_send',
    description:
      '把审查工作派给团队 reviewer 成员（未生成则自动生成）。scope: turn(回答审查) | computation(计算过程) | evidence(文章证据) | journal(期刊审稿模拟)。审查任务默认不要求对齐到蓝图 result（质量闸门，非证据工作）；确需归档到某 result 时可传 result_id。',
    parameters: {
      scope: { type: 'string' /*必填*/, description: 'turn | computation | evidence | journal' },
      target: { type: 'string', description: '审查对象说明（turn 号/文件路径/章节名）' },
      note: { type: 'string', description: '补充要求' },
      result_id: { type: 'string', description: '可选：文章蓝图 result id（res-N）；提供时该审查任务挂入该 result（一般不需要）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      ensureLeadProtocol(ctx, exec)
      const state = loadTeam()
      if (!state.members.some((m) => m.role === 'reviewer')) {
        await spawnMember(exec, 'reviewer', ROLES.reviewer.member)
      }
      const scopeText = {
        turn: '审查最近一轮回复：数字溯源/断言-执行一致性/伪造迹象。',
        computation: '审查计算过程：软件版本、参数、随机种子、收敛证据四要素；输入文件是否经过查手册协议。',
        evidence: '审查文章证据：每个 claim 的证据链、图表与描述一致性（表格程序化解析）。',
        journal: '期刊审稿模拟：以目标期刊审稿人视角出 major/minor 意见（新颖性/方法/统计/结论强度）。',
      }[String(args.scope)] || '综合审查。'
      // 蓝图深度绑定（v0.9.0 Track 2 B3）：evidence scope 自动带上蓝图 claims 逐条核对清单
      //（蓝图存在且有 result 时）——审查员逐条核对 claim 的证据链，而不是凭印象泛审。
      let claimsSection = ''
      if (String(args.scope) === 'evidence') {
        try {
          const bp = loadBlueprint()
          const claimed = (bp.results || []).filter((r) => r && (r.claim || '').trim())
          if (claimed.length > 0) {
            claimsSection = `\n\n蓝图 claims 逐条核对清单（每条都要在 findings 里给出结论，check=blueprint-claim）：\n${claimed
              .map((r) => `- ${r.id}${r.confirmed === true ? ' [已确认]' : ' [待确认]'}（${r.status || 'planned'}）: ${r.claim}；任务 ${(Array.isArray(r.tasks) ? r.tasks : []).join('、') || '无'}，图表 ${(Array.isArray(r.figures) ? r.figures : []).join('、') || '无'}`)
              .join('\n')}`
          }
        } catch {
          /* 蓝图缺失/损坏不阻断审查派发 */
        }
      }
      const subject = `[${args.scope}] 审查：${String(args.target || '最近工作').slice(0, 80)}`
      const desc = `${scopeText}${claimsSection}${args.note ? `\n补充要求：${args.note}` : ''}\n目标对象：${args.target || '最近工作'}\n\n输出 findings JSON。`
      const agent = exec && exec.agent
      const st = loadTeam()
      st.taskSeq = (st.taskSeq || 0) + 1
      const id = `task-${st.taskSeq}`
      const resultId = args.result_id ? String(args.result_id) : null
      st.tasks.push({
        id,
        subject,
        desc,
        assignee: 'reviewer',
        status: 'pending',
        blockedBy: [],
        // X1：创建时即标记 isReview——coverage unalignedTasks 对审查类任务豁免（审查是质量
        // 闸门，不支撑文章子主张）；resultId 仅在显式传 result_id 时记录。
        isReview: true,
        resultId,
        createdAt: Date.now(),
      })
      persist(st, exec)
      const wakeResult = agent ? await wake(agent, 'reviewer', `新审查任务 ${id}：${subject}\n\n${desc}`) : { woken: false }
      if (wakeResult.woken) {
        // 与 sci_team_dispatch 的派发语义一致：唤醒成功 → claimed + claimedAt（先重读再改，防 race）
        const st2 = loadTeam()
        const t2 = st2.tasks.find((x) => x.id === id)
        if (t2) {
          t2.status = 'claimed'
          t2.claimedAt = Date.now()
          persist(st2, exec)
        }
      }
      // X1：显式传 result_id 时把审查任务挂入蓝图 result（失败不阻断审查派发，只回报原因；
      // 失败时同样清除 resultId 徽章，与 dispatch 口径一致）
      let alignment = null
      if (resultId) {
        try {
          alignment = alignTaskToResult(id, resultId, { exec, mirror })
        } catch (err) {
          log(`blueprint align failed for review ${id} → ${resultId}: ${err && err.message}`)
          alignment = { error: String(err && err.message) }
          try {
            const st3 = loadTeam()
            const t3 = st3.tasks.find((x) => x.id === id)
            if (t3 && t3.resultId) {
              t3.resultId = null
              t3.updatedAt = Date.now()
              persist(st3, exec)
            }
          } catch (e2) {
            log(`clear resultId after failed review align for ${id} failed: ${e2 && e2.message}`)
          }
        }
      }
      log(`review dispatched: ${id} (${wakeResult.woken ? 'claimed' : 'pending'}${resultId ? ', aligned' : ''})`)
      const out = { ok: true, taskId: id, reviewer: 'reviewer', isReview: true, wake: wakeResult }
      if (alignment) out.blueprintAlign = alignment
      return out
    },
  })

  // -- 任务状态回写（队长在成员回报结果后标记完成）--------------------------------
  // X2：status 枚举扩展 cancelled（主动取消，区别于 failed）——coverage 对 cancelled 豁免对齐，
  // 客户端进度图例按灰色计数。
  const TASK_STATUSES = ['pending', 'claimed', 'in_progress', 'completed', 'failed', 'cancelled']
  ctx.tools.register({
    name: 'sci_team_update_task',
    description: '更新团队任务板状态。成员回报结果后由队长调用标记 completed（或 failed/in_progress/cancelled）。task_id 形如 task-3。',
    parameters: {
      task_id: { type: 'string' /*必填*/, description: '任务 id（task-N）' },
      status: { type: 'string' /*必填*/, description: `枚举：${TASK_STATUSES.join(' | ')}` },
      result_note: { type: 'string', description: '结果摘要（可选，记录成员产出要点）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadTeam()
      const task = state.tasks.find((t) => t.id === String(args.task_id))
      if (!task) throw new Error(`任务 ${args.task_id} 不存在`)
      const status = String(args.status)
      if (!TASK_STATUSES.includes(status)) {
        throw new Error(`非法 status "${status}"（可用枚举：${TASK_STATUSES.join(' | ')}）`)
      }
      task.status = status
      if (args.result_note) task.result = String(args.result_note).slice(0, 2000)
      task.updatedAt = Date.now()
      persist(state, exec)
      return { ok: true, taskId: task.id, status: task.status }
    },
  })

  // -- 任务删除（X2）：标记 deleted（tombstone 保留在任务板上）+ 从蓝图 result.tasks 摘除 ----
  // 与 cancelled 的区别：deleted 表示"这条任务不该存在"（误派/废弃），终态且从文章归属中摘除；
  // 记录仍保留（墓碑），进度图例按灰色计数，审计可查。
  ctx.tools.register({
    name: 'sci_team_delete_task',
    description:
      '删除团队任务板上的任务：任务标记 deleted（墓碑保留，可审计），并从文章蓝图 result.tasks 中摘除对齐（若有）。误派/废弃任务用本工具清理；status 已是 deleted 时幂等返回。',
    parameters: {
      task_id: { type: 'string' /*必填*/, description: '任务 id（task-N）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const state = loadTeam()
      const task = state.tasks.find((t) => t.id === String(args.task_id))
      if (!task) throw new Error(`任务 ${args.task_id} 不存在`)
      if (task.status === 'deleted') {
        return { ok: true, taskId: task.id, status: 'deleted', note: '任务已是 deleted（幂等，无变化）。' }
      }
      task.status = 'deleted'
      task.deletedAt = Date.now()
      task.updatedAt = task.deletedAt
      persist(state, exec)
      // 蓝图摘除（调 lib/blueprint.js 摘除逻辑）：从所有 result.tasks 移除该任务 id（幂等）
      let blueprintPrune = { pruned: false }
      try {
        blueprintPrune = { pruned: pruneTasksFromResults([task.id], { exec, mirror }) }
      } catch (err) {
        log(`blueprint prune failed for ${task.id}: ${err && err.message}`)
        blueprintPrune = { pruned: false, error: String(err && err.message) }
      }
      log(`task deleted: ${task.id}（tombstone 保留）`)
      return { ok: true, taskId: task.id, status: 'deleted', deletedAt: task.deletedAt, blueprintPrune }
    },
  })

  // -- 给成员发消息 --------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_team_send',
    description: '向指定团队成员发消息（唤起其处理）。to 为成员名。',
    parameters: {
      to: { type: 'string' /*必填*/, description: '成员名' },
      message: { type: 'string' /*必填*/, description: '消息内容' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args, exec) {
      const agent = exec && exec.agent
      if (!agent) throw new Error('无法确定调用者')
      const wakeResult = await wake(agent, String(args.to), String(args.message).slice(0, 20000))
      if (!wakeResult.woken) throw new Error(`成员 ${args.to} 不可达：${wakeResult.error}`)
      return { ok: true, to: args.to }
    },
  })

  log('team tools registered (spawn/spawn_all/dispatch/status/review_send/send on ctx.subagents)')
}
