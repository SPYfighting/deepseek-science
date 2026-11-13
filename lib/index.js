import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerDbTools } from './db.js'
import { registerSshTools } from './ssh.js'
import { registerFigureTools } from './figures.js'
import { registerReviewer } from './reviewer.js'
import { registerTeamTools } from './team.js'
import { registerBlueprintTools } from './blueprint.js'
import { registerLitTools } from './lit.js'
import { registerSkillMenuTools } from './skillmenu.js'
import { registerStateRoute } from './httpdata.js'
import { installRouterLifecycle } from './router.js'
import { loadBlueprint, blueprintErrorOf } from './blueprint.js'
import { sanitizeTeamState } from './team.js'
import { dataDirOf, blockedGateOf, falsificationThresholdOf } from './store.js'
import { statusReportOf } from './status.js'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = '0.14.0'

export const name = 'dsh-science'
export const inject = ['tools', 'commands', 'skills', 'sessions', 'agents', 'sessionPersistence', 'subagents', 'workingDirectory', 'systemPrompt']

function log(msg) {
  console.log(`[dsh-science ${VERSION}] ${msg}`)
}

function readStateJson(name) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(join(dataDirOf(), name), 'utf8')) }
  } catch (err) {
    // 文件不存在是首跑常态；存在但读不出/解析失败要在体检里点名，不能当成空状态
    if (err && err.code === 'ENOENT') return { ok: true, value: null }
    return { ok: false, value: null }
  }
}

// ---- skills provider: serve bundled SKILL.md files -------------------------
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

function createSkillsProvider() {
  const dir = join(PKG_ROOT, 'skills')
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const file = join(dir, e.name, 'SKILL.md')
        const text = readFileSync(file, 'utf8')
        const fm = parseFrontmatter(text)
        return {
          path: file,
          name: fm.name || e.name,
          description: fm.description || '',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'bundled',
          provider: 'dsh-science',
          rank: 100,
          locator: file,
          dir: join(dir, e.name),
        }
      })
  } catch (err) {
    log(`skills scan failed: ${err && err.message}`)
  }
  return {
    name: 'dsh-science',
    async list() {
      return entries
    },
    async get(candidate) {
      try {
        let content = readFileSync(candidate.locator, 'utf8')
        const extras = listResourceFiles(candidate.dir || join(candidate.locator, '..'))
        if (extras.length > 0) {
          const listing = extras.map((x) => `- ${x}`).join('\n')
          content += `\n\n## 本 skill 附带资源文件（需要时用读文件工具按绝对路径读取）\n${listing}\n`
        }
        return {
          path: candidate.path,
          name: candidate.name,
          description: candidate.description,
          invocation: candidate.invocation,
          source: candidate.source,
          provider: 'dsh-science',
          content,
        }
      } catch {
        return undefined
      }
    },
  }
}

function listResourceFiles(skillDir) {
    const out = []
    const walk = (d, rel) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'SKILL.md') continue
        const abs = join(d, e.name)
        const r = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) walk(abs, r)
        else out.push(`${abs} (${r})`)
      }
    }
    try {
      walk(skillDir, '')
    } catch {
      /* ignore */
    }
    return out
  }

// ---- tools -----------------------------------------------------------------
function registerPingTool(ctx) {
  ctx.tools.register({
    name: 'sci_ping',
    description:
      'dsh-science 连通性测试工具。返回插件版本与服务器时间戳，用于确认科研插件已加载。',
    parameters: {},
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute() {
      return { ok: true, plugin: 'dsh-science', version: VERSION, ts: new Date().toISOString() }
    },
  })
  log('tool sci_ping registered')
}

// ---- commands --------------------------------------------------------------
function registerCommands(ctx) {
  ctx.commands.register({
    name: 'sci-status',
    description: '查看 dsh-science 实时状态（团队/文章蓝图/审查/图表/数据库/SSH/配置）与下一步建议',
    handler: async () => {
      try {
        const names = ['team.json', 'reviews.json', 'figures.json', 'figure-plans.json', 'db-profiles.json', 'ssh-profiles.json', 'ssh-jobs.json']
        const loaded = {}
        const stateErrors = []
        for (const name of names) {
          const r = readStateJson(name)
          loaded[name] = r.value
          if (!r.ok) stateErrors.push(name)
        }
        const report = statusReportOf({
          version: VERSION,
          dataDir: dataDirOf(),
          workspaceRoot: (() => { try { return process.cwd() } catch { return '' } })(),
          blueprint: loadBlueprint(),
          blueprintError: blueprintErrorOf() || null,
          team: sanitizeTeamState(loaded['team.json']),
          reviews: loaded['reviews.json'],
          figures: loaded['figures.json'],
          dbProfiles: loaded['db-profiles.json'],
          sshProfiles: loaded['ssh-profiles.json'],
          sshJobs: loaded['ssh-jobs.json'],
          config: { blockedGate: blockedGateOf(), falsificationThreshold: falsificationThresholdOf() },
          stateErrors,
        })
        return { kind: 'success', text: report.lines.join('\n') }
      } catch (err) {
        return { kind: 'error', text: `状态读取失败：${(err && err.message) || String(err)}` }
      }
    },
  })
  log('commands sci-status registered')
}

// 会话工作区镜像：把插件状态 JSON 同步写一份到 <cwd>/.dsh-science/，
// 供工作台前端经内建 file 资源协议读取（客户端内容读取方案见 DEVLOG）。
function makeMirror(ctx) {
  return (name, text, exec) => {
    try {
      const agent = exec && exec.agent
      const session = agent && agent.session
      if (!session || !ctx.workingDirectory) {
        log(`mirror skipped (${name}): no session or workingDirectory service`)
        return
      }
      let cwd = null
      try {
        cwd = ctx.workingDirectory.get(session)
      } catch (err) {
        log(`mirror get(session) failed (${name}): ${err && err.message}`)
      }
      if (!cwd) {
        log(`mirror skipped (${name}): session ${session.id} has no working directory`)
        return
      }
      const dir = join(cwd, '.dsh-science')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, name), text, 'utf8')
    } catch (err) {
      /* 镜像失败不影响主流程 */
      log(`mirror write failed (${name}): ${err && err.message}`)
    }
  }
}

// 科研工作流一键命令：经 agent.followup 启动对应 skill 工作流
function registerWorkflowCommands(ctx) {
  const WORKFLOWS = [
    ['sci-write', 'sci-writing', '学术论文写作', '请加载并遵循 sci-writing skill，开始论文写作流程。先与我确认目标期刊与文章类型，然后给出大纲供确认。'],
    ['sci-polish', 'sci-polish', '学术润色', '请加载并遵循 sci-polish skill。我将提供需要润色的文本；先向我确认需要哪一级润色（语言/表达/结构）。'],
    ['sci-hypothesis', 'sci-hypothesis', '课题与假设', '请加载并遵循 sci-hypothesis skill，开始课题/假设构思。先向我确认领域、已有数据与算力、时间预算。'],
    ['sci-simulate', 'sci-simulation', '计算模拟', '请加载并遵循 sci-simulation skill。先与我确认模拟任务、软件与参数，再试跑。'],
    ['sci-research', 'sci-autoresearch', 'Autoresearch 全流程', '请加载并遵循 sci-autoresearch skill，启动端到端科研流程。先与我确认研究主题与约束，再从 S1 文献综述开始，每个检查点停下等确认。'],
  ]
  for (const [cmd, skill, label, prompt] of WORKFLOWS) {
    ctx.commands.register({
      name: cmd,
      description: `${label}（启动 ${skill} 工作流）`,
      input: { hint: '[可选] 补充要求' },
      handler: async (invocation) => {
        const extra = String(invocation.rawInput || '').trim()
        try {
          const message = createUserMessage({
            content: [{
              type: 'text',
              text: `/${skill}\n\n${prompt}${extra ? `\n\n补充要求：${extra}` : ''}`,
            }],
            source: { kind: 'user' },
          })
          invocation.agent.followup(message)
          return { kind: 'success', text: `${label} 工作流已提交到当前会话（skill: ${skill}）。` }
        } catch (err) {
          return { kind: 'error', text: `启动失败：${err && err.message}` }
        }
      },
    })
  }
  log('workflow commands registered (/sci-write /sci-polish /sci-hypothesis /sci-simulate /sci-research)')
}

export function apply(ctx) {

  // Router（队长）约束：科研执行分派给成员，队长只做交互/分派/汇总/审查决策。
  // v0.6.0 fix1：队长协议单一来源化——全局（order 118）section 已删除（它会把"你是队长"
  // 注入到包括成员子代理在内的所有 agent，且与 lead scoped section 双重注入）。
  // 全部协议内容（分工/审查/汇报纪律 + 文章蓝图规则全套）合并进 lib/router.js routerText()，
  // 仅在 lead agent 的 scoped context 注入一次（agent/created 补挂 + 建队/派单工具懒注册）。

  try {
    registerPingTool(ctx)
  } catch (err) {
    log(`tools register failed: ${err && err.message}`)
  }
  const mirror = makeMirror(ctx)
  try {
    registerTeamTools(ctx, { mirror })
  } catch (err) {
    log(`team tools register failed: ${err && err.message}`)
  }
  try {
    registerBlueprintTools(ctx, { mirror })
  } catch (err) {
    log(`blueprint tools register failed: ${err && err.message}`)
  }
  try {
    registerLitTools(ctx)
  } catch (err) {
    log(`lit tools register failed: ${err && err.message}`)
  }
  // v0.9.0 角色级 skill 菜单（sci_skill_menu/install/remove/installed）——安装走互斥队列，
  // 技能不进全局 skills registry，只经 spawnMember 提示词索引对成员生效。
  try {
    registerSkillMenuTools(ctx, { mirror })
  } catch (err) {
    log(`skillmenu tools register failed: ${err && err.message}`)
  }
  try {
    registerStateRoute(ctx)
  } catch (err) {
    log(`state route register failed: ${err && err.message}`)
  }
  try {
    registerDbTools(ctx, { mirror })
  } catch (err) {
    log(`db tools register failed: ${err && err.message}`)
  }
  try {
    registerSshTools(ctx, { mirror })
  } catch (err) {
    log(`ssh tools register failed: ${err && err.message}`)
  }
  try {
    registerFigureTools(ctx, { mirror })
  } catch (err) {
    log(`figure tools register failed: ${err && err.message}`)
  }
  try {
    registerReviewer(ctx, { mirror })
  } catch (err) {
    log(`reviewer register failed: ${err && err.message}`)
  }
  // 队长协议 section 生命周期（agent/disposed 清理 + 恢复会话补注册）
  try {
    installRouterLifecycle(ctx)
  } catch (err) {
    log(`router lifecycle register failed: ${err && err.message}`)
  }
  try {
    registerWorkflowCommands(ctx)
  } catch (err) {
    log(`workflow commands register failed: ${err && err.message}`)
  }
  // 测试专用：DSH_SCIENCE_AUTO_APPROVE=1 时自动批准本插件的远程操作审批卡。
  // 仅用于 headless 自动化测试；生产环境不要设置。
  if (process.env.DSH_SCIENCE_AUTO_APPROVE === '1') {
    try {
      ctx.on('approval/request', async (req, next) => {
        if (req && typeof req.toolName === 'string' && req.toolName.startsWith('sci_')) {
          return 'allowed-once'
        }
        return next()
      })
      log('TEST-ONLY auto-approve enabled via DSH_SCIENCE_AUTO_APPROVE=1')
    } catch (err) {
      log(`auto-approve listener failed: ${err && err.message}`)
    }
  }
  try {
    registerCommands(ctx)
  } catch (err) {
    log(`commands register failed: ${err && err.message}`)
  }
  try {
    ctx.skills.registerProvider(createSkillsProvider)
    log('skills provider registered')
  } catch (err) {
    log(`skills register failed: ${err && err.message}`)
  }
  log('apply() done')
}
