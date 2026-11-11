// dsh-science — web 档案数据通道（工作台面板的 HTTP 数据源）
// 先例：research/agent-teams src/index.ts 经 ctx.webServer 注册 GET /plugins/dsh-agent-teams/state。
// 本文件注册两条路由：
//   1) GET /plugins/dsh-science/state → $DSH_HOME/dsh-science/*.json 汇总 JSON
//      （团队/任务/图表/审查/db profile/SSH 主机/SSH 作业/文章蓝图）+ 工作区文件树（files，
//      以 web 服务器进程 cwd 为根，限深采样）+ 成员实时状态（memberLive：running/idle/offline，
//      经 ctx.agents.get(childId).status 推断，同 agent-teams memberActivity 思路）。
//      v0.6.0：快照新增 blueprint 字段（core/results/narrative/coverage——覆盖分析与
//      sci_blueprint_overview 工具共用 lib/blueprint.js coverageOf 同一实现，口径一致）。
//   2) GET /plugins/dsh-science/file?path=<相对或绝对路径> → 仅服务工作区根（进程 cwd）
//      或 $DSH_HOME/dsh-science 之内的单个文件（防目录穿越：resolve 后做前缀校验；
//      按扩展名给 content-type，单文件上限 20MB），供客户端 <img> 图表预览。
//   3) GET /plugins/dsh-science/assets/<file>.svg → 科研鲸鱼娘吉祥物（assets/mascots/
//      白名单之内，content-type image/svg+xml，长缓存）。
//   4) GET /plugins/dsh-science/review?run=<id> → 单条审查 run 详情（含 findings，剔除 raw）；
//      /state 的 reviews 只含摘要，客户端展开审查行时才取详情，避免轮询载荷膨胀。
// web 档案才有 webServer 服务；桌面版没有 → 懒注册 + 探测失败即静默跳过（客户端会降级提示）。
// 鉴权：对齐 agent-teams 的 authenticatedWebRoutes 思路——经 ctx.get('connection').requestRejection(req)
// 复用浏览器会话的认证栅栏（同源 fetch 自带凭证）。

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { dataDirOf, PKG_ROOT_OF } from './store.js'
import { ROLES, LEAD_MASCOT } from './roles.js'
import { loadBlueprint, coverageOf, blueprintErrorOf } from './blueprint.js'
import { sanitizeTeamState } from './team.js'
import { reviewCoverageOf } from './reviewcov.js'
import { reviewSummariesOf, reviewRunOf } from './reviewruns.js'
import { decodeSvgText, svgActiveContentReason } from './figures.js'
// v0.9.0 角色技能库：/state 快照携带 catalog+installed（客户端勾选菜单）；POST /skill-manage
// 承接客户端勾选/自定义链接的安装与删除（鉴权与 state/file 同款会话栅栏）。
import { installSkill, removeSkill, skillMenuSnapshot } from './skillmenu.js'

function log(msg) {
  console.log(`[dsh-science httpdata] ${msg}`)
}

const WEB_SERVER_KEYS = ['webServer', 'httpServer']
const VERSION = '0.11.0'
const FILE_MAX_BYTES = 20 * 1024 * 1024
const FILE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}
// 工作区文件树跳过目录（依赖/版本库/本插件状态目录等噪音）
const TREE_SKIP = new Set([
  'node_modules', '.git', '.dsh-home', '.dsh', '.dsh-science', '.cache',
  '.pnpm-store', 'dist', 'build', '.venv', '__pycache__',
])
const TREE_MAX_ENTRIES = 400
const TREE_MAX_DEPTH = 3

// 科研鲸鱼娘 SVG（assets/mascots/）：显式白名单服务（同 agent-teams 资产路由思路，
// 比目录列举 + realpath 更强——名单外一律 404，天然免疫路径穿越）。
const MASCOT_DIR = join(PKG_ROOT_OF(), 'assets', 'mascots')
// v0.7.0：thinking.svg 入列（任务流 DAG 的「有待办任务在身」思考姿态叠加图）
const MASCOT_ALLOWLIST = new Set([LEAD_MASCOT, ...Object.values(ROLES).map((d) => d.mascot), 'working.svg', 'idle.svg', 'thinking.svg'])

function loadJson(name) {
  try {
    return JSON.parse(readFileSync(join(dataDirOf(), name), 'utf8'))
  } catch {
    return null
  }
}

// 递归剔除敏感键（密码类），避免状态接口泄密
function redact(value) {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (/pass(word|phrase)/i.test(k)) continue
      out[k] = redact(v)
    }
    return out
  }
  return value
}

// 键值对象 → 数组（带 name/id 字段，便于客户端渲染）
function toList(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([key, value]) => ({
    ...(redact(value) || {}),
    key,
  }))
}

function workspaceRoot() {
  try {
    return resolve(process.cwd())
  } catch {
    return ''
  }
}

// 文件服务允许的根集合：web 服务器进程工作区 + 插件数据目录（收割结果/下载件）
function workspaceRoots() {
  const roots = [workspaceRoot()]
  try {
    roots.push(resolve(dataDirOf()))
  } catch {
    /* ignore */
  }
  return roots.filter((r) => r && typeof r === 'string')
}

// 成员实时状态：agents 服务里能找到 childId 且 status==='running' → running；
// 找到但空闲 → idle；找不到（子代理会话未驻留/插件刚重启）→ 回退推断：
// 任务板上有该成员的 claimed/in_progress 任务 → 'claimed/working'，否则 offline。
function memberLiveOf(ctx, members, tasks) {
  const live = {}
  let agents = null
  try {
    agents = ctx.get('agents')
  } catch {
    agents = null
  }
  const board = Array.isArray(tasks) ? tasks : []
  for (const m of Array.isArray(members) ? members : []) {
    let status = 'offline'
    if (agents && m && m.childId && typeof agents.get === 'function') {
      try {
        const agent = agents.get(m.childId)
        if (agent) status = agent.status === 'running' ? 'running' : 'idle'
      } catch {
        status = 'offline'
      }
    }
    if (status === 'offline') {
      const hasOpenTask = board.some(
        (t) => t && t.assignee === m.name && (t.status === 'claimed' || t.status === 'in_progress'),
      )
      if (hasOpenTask) status = 'claimed/working'
    }
    live[m.name] = status
  }
  return live
}

// 工作区文件树（限深/限量采样，相对路径 posix 分隔；目录 size 记 0）
function listWorkspaceFiles() {
  const root = workspaceRoot()
  if (!root) return []
  const out = []
  const walk = (dir, rel, depth) => {
    if (depth > TREE_MAX_DEPTH || out.length >= TREE_MAX_ENTRIES) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= TREE_MAX_ENTRIES) return
      if (e.name.startsWith('.') || TREE_SKIP.has(e.name)) continue
      const relPath = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        out.push({ path: relPath, dir: true, size: 0 })
        walk(join(dir, e.name), relPath, depth + 1)
      } else if (e.isFile()) {
        let size = 0
        try {
          size = statSync(join(dir, e.name)).size
        } catch {
          /* ignore */
        }
        out.push({ path: relPath, dir: false, size })
      }
    }
  }
  walk(root, '', 0)
  return out
}

// 浏览器会话认证栅栏：connection 服务缺失时不拦（回环地址本就仅本机可达）
function requestRejectionOf(ctx, req) {
  try {
    const conn = ctx.get('connection')
    if (conn && typeof conn.requestRejection === 'function') return conn.requestRejection(req)
  } catch {
    /* ignore */
  }
  return undefined
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

// 读取请求体（POST JSON，上限 64KB——skill-manage 的 body 只有 action/role/repoId/repoUrl/name）
function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolveP) => {
    const chunks = []
    let size = 0
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      if (!ok) return resolveP(null)
      try {
        resolveP(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolveP(null)
      }
    }
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) {
        finish(false)
        return
      }
      chunks.push(c)
    })
    req.on('end', () => finish(true))
    req.on('error', () => finish(false))
  })
}

// /state 快照缓存（模块级 1s）：多标签/多请求并发轮询时避免重复读盘建树
const STATE_CACHE_MS = 1000
const stateCache = { ts: 0, payload: null }

// 敏感路径拒服务：凭据文件一律拒绝；工作区内 .dsh-home/.dsh 状态目录（会话/日志/profile）
// 不服务——插件自身数据目录（$DSH_HOME/dsh-science）内的登记产物（图表/收割件）除外。
function isSensitiveServedPath(realAbs, realWorkspaceRoot, realDataDir) {
  try {
    const base = String(realAbs).split(/[\\/]/).pop()
    if (/^\.credentials\./i.test(base)) return true
    if (!realWorkspaceRoot) return false
    const relWs = relative(realWorkspaceRoot, realAbs)
    if (!relWs || relWs.startsWith('..') || isAbsolute(relWs)) return false
    const firstSeg = relWs.split(/[\\/]/)[0]
    if (firstSeg !== '.dsh-home' && firstSeg !== '.dsh') return false
    // 在 dsh 状态目录内：仅插件数据目录之内放行
    if (!realDataDir) return true
    const relData = relative(realDataDir, realAbs)
    if (!relData || relData.startsWith('..') || isAbsolute(relData)) return true
    return false
  } catch {
    return true
  }
}

// path 参数 → 允许根之内绝对文件路径，否则 null
// 防目录穿越：resolve + realpathSync（穿透 symlink/大小写别名后）再做 relative 前缀校验
function resolveServedPath(raw) {
  if (!raw || typeof raw !== 'string' || raw.includes('\0')) return null
  const roots = workspaceRoots()
  const candidates = []
  if (isAbsolute(raw)) {
    candidates.push(resolve(raw))
  } else {
    for (const r of roots) candidates.push(resolve(r, raw))
  }
  // 根同样取真实路径，避免通过指向根外目录的 symlink 越界
  const realRoots = roots.map((r) => {
    try {
      return realpathSync(r)
    } catch {
      return resolve(r)
    }
  })
  let realWs = null
  try {
    realWs = workspaceRoot() ? realpathSync(workspaceRoot()) : null
  } catch {
    realWs = workspaceRoot() ? resolve(workspaceRoot()) : null
  }
  let realData = null
  try {
    realData = realpathSync(dataDirOf())
  } catch {
    try {
      realData = resolve(dataDirOf())
    } catch {
      realData = null
    }
  }
  for (const cand of candidates) {
    let real
    try {
      real = realpathSync(cand)
    } catch {
      continue
    }
    for (const root of realRoots) {
      const rel = relative(root, real)
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue
      if (!existsSync(real)) continue
      if (isSensitiveServedPath(real, realWs, realData)) continue
      let stat
      try {
        stat = statSync(real)
      } catch {
        continue
      }
      if (stat.isFile()) return real
    }
  }
  return null
}

export function registerStateRoute(ctx) {
  let registered = false
  const tryRegister = () => {
    if (registered) return
    let server
    try {
      server = ctx.get(WEB_SERVER_KEYS[0]) || ctx.get(WEB_SERVER_KEYS[1])
    } catch {
      return
    }
    if (!server || typeof server.register !== 'function') return
    try {
      ctx.effect(
        () =>
          server.register({
            kind: 'exact',
            path: '/plugins/dsh-science/state',
            handler: async (req, res) => {
              try {
                const rejection = requestRejectionOf(ctx, req)
                if (rejection !== undefined) {
                  sendJson(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
                  return
                }
                const now = Date.now()
                if (stateCache.payload && now - stateCache.ts < STATE_CACHE_MS) {
                  sendJson(res, 200, stateCache.payload)
                  return
                }
                const team = sanitizeTeamState(loadJson('team.json'))
                const members = team.members
                const sshProfiles = toList(loadJson('ssh-profiles.json'))
                // 文章蓝图（v0.6.0）：core/results/narrative + 覆盖分析（与工具同口径）
                // fix2：coverage 传入已登记图表（figures.json），覆盖分析可报"图表未挂接"；
                // fix4：blueprintError——blueprint.json 损坏被隔离时置位，客户端文章 tab 显示警示横幅
                const bp = loadBlueprint()
                const payload = {
                  ts: Date.now(),
                  version: VERSION,
                  blueprint: {
                    core: {
                      title: bp.core.title || '',
                      claim: bp.core.claim || '',
                      innovation: bp.core.innovation || '',
                      venue: bp.core.venue || '',
                      // 确认工作流（v0.9.0）：核心确认状态（客户端核心卡显示 🔒/待确认 徽章）
                      confirmed: bp.core.confirmed === true,
                    },
                    results: bp.results.map((r) => ({
                      id: r.id,
                      title: (r && r.title) || (r && r.id) || '',
                      claim: (r && r.claim) || '',
                      status: (r && r.status) || 'planned',
                      confirmed: (r && r.confirmed) === true,
                      tasks: Array.isArray(r && r.tasks) ? r.tasks : [],
                      figures: Array.isArray(r && r.figures) ? r.figures : [],
                      // v0.9.0：每Result参考文献 + 文献快筛（客户端 result 展开区渲染）
                      references: Array.isArray(r && r.references) ? r.references : [],
                      screening: (r && r.screening) || null,
                      notes: (r && r.notes) || '',
                    })),
                    narrative: bp.narrative || '',
                    updatedAt: bp.updatedAt || 0,
                    coverage: coverageOf(bp, team, loadJson('figures.json')),
                    reviewCoverage: reviewCoverageOf(bp, loadJson('reviews.json')),
                  },
                  blueprintError: blueprintErrorOf() || null,
                  team: {
                    // members 原样透传（redact 仅剔除密码类键）——v0.7.1 F5：spawnMember 记录的
                    // parentSessionId 随之到达客户端（openMemberSession 优先用它打开成员会话）
                    members,
                    tasks: Array.isArray(team.tasks) ? team.tasks : [],
                  },
                  figures: toList(loadJson('figures.json')).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0)),
                  reviews: reviewSummariesOf(loadJson('reviews.json')), // 摘要（无 findings/raw），详情走 /review
                  dbProfiles: toList(loadJson('db-profiles.json')),
                  sshProfiles,
                  sshHosts: sshProfiles.map((p) => ({
                    name: p.key,
                    host: p.host,
                    auth: p.auth,
                    probedAt: p.probedAt,
                    os: p.details && p.details.os,
                    gpu: p.details && p.details.gpu,
                  })),
                  sshJobs: toList(loadJson('ssh-jobs.json')).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)),
                  roles: Object.fromEntries(
                    Object.entries(ROLES).map(([id, d]) => [id, { member: d.member, label: d.label, icon: d.icon, mascot: d.mascot }]),
                  ),
                  // v0.9.0 角色技能库：精选目录（每角色 ≤3）+ 已安装状态（勾选菜单渲染用）
                  skillMenu: skillMenuSnapshot(),
                  mascotLead: LEAD_MASCOT,
                  memberLive: memberLiveOf(ctx, members, team.tasks),
                  files: listWorkspaceFiles(),
                  workspaceRoot: workspaceRoot(),
                  generatedAt: new Date().toISOString(),
                }
                stateCache.ts = now
                stateCache.payload = payload
                sendJson(res, 200, payload)
              } catch (err) {
                log(`state handler failed: ${err && err.message}`)
                sendJson(res, 500, { error: 'internal error' })
              }
            },
          }),
        'dsh-science: state route',
      )
      ctx.effect(
        () =>
          server.register({
            kind: 'exact',
            path: '/plugins/dsh-science/file',
            handler: async (req, res) => {
              try {
                const rejection = requestRejectionOf(ctx, req)
                if (rejection !== undefined) {
                  sendJson(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
                  return
                }
                let raw = null
                try {
                  raw = new URL(req.url, 'http://localhost').searchParams.get('path')
                } catch {
                  raw = null
                }
                const abs = resolveServedPath(raw)
                if (!abs) {
                  sendJson(res, 404, { error: 'file not found or outside workspace' })
                  return
                }
                let stat
                try {
                  stat = statSync(abs)
                } catch {
                  sendJson(res, 404, { error: 'file not found' })
                  return
                }
                if (stat.size > FILE_MAX_BYTES) {
                  sendJson(res, 413, { error: 'file too large (>20MB)' })
                  return
                }
                const ext = extname(abs).toLowerCase()
                const type = FILE_TYPES[ext] || 'application/octet-stream'
                const body = readFileSync(abs)
                const isSvg = ext === '.svg'
                if (isSvg) {
                  // 登记闸门管不到历史文件/手工放入工作区的 SVG：服务端再拦一次（直链打开即执行）
                  const reason = svgActiveContentReason(decodeSvgText(body))
                  if (reason) {
                    sendJson(res, 403, { error: `refused: SVG contains active content (${reason})` })
                    return
                  }
                }
                const headers = {
                  'content-type': type,
                  'cache-control': 'no-store',
                  'content-length': body.length,
                  'x-content-type-options': 'nosniff',
                }
                if (isSvg) headers['content-security-policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"
                res.writeHead(200, headers)
                res.end(body)
              } catch (err) {
                log(`file handler failed: ${err && err.message}`)
                sendJson(res, 500, { error: 'internal error' })
              }
            },
          }),
        'dsh-science: file route',
      )
      try {
        ctx.effect(
          () =>
            server.register({
              kind: 'exact',
              path: '/plugins/dsh-science/review',
              handler: async (req, res) => {
                try {
                  const rejection = requestRejectionOf(ctx, req)
                  if (rejection !== undefined) {
                    sendJson(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
                    return
                  }
                  let runId = null
                  try {
                    runId = new URL(req.url, 'http://localhost').searchParams.get('run')
                  } catch {
                    runId = null
                  }
                  if (!runId) {
                    sendJson(res, 400, { error: 'missing run id' })
                    return
                  }
                  const run = reviewRunOf(loadJson('reviews.json'), runId)
                  if (!run) {
                    sendJson(res, 404, { error: 'review run not found' })
                    return
                  }
                  sendJson(res, 200, { run })
                } catch (err) {
                  log(`review handler failed: ${err && err.message}`)
                  sendJson(res, 500, { error: 'internal error' })
                }
              },
            }),
          'dsh-science: review detail route',
        )
      } catch (err) {
        log(`review route register failed: ${err && err.message}`)
      }
      registered = true
      log('state route registered: GET /plugins/dsh-science/state')
      log('review route registered: GET /plugins/dsh-science/review?run=<id>')
      log('file route registered: GET /plugins/dsh-science/file?path=…（仅工作区/数据目录内文件）')
      // 科研鲸鱼娘吉祥物（assets/mascots/*.svg）：白名单 + 前缀路由（路径参数只取文件名段）
      try {
        ctx.effect(
          () =>
            server.register({
              kind: 'prefix',
              path: '/plugins/dsh-science/assets',
              handler: async (req, res) => {
                // 与 state/file 路由相同的浏览器会话认证栅栏（同源 <img> 自带凭证）
                const rejection = requestRejectionOf(ctx, req)
                if (rejection !== undefined) {
                  sendJson(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
                  return
                }
                let name = ''
                try {
                  name = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.split('/').pop() ?? '')
                } catch {
                  res.writeHead(404).end()
                  return
                }
                if (!MASCOT_ALLOWLIST.has(name) || !name.endsWith('.svg')) {
                  res.writeHead(404).end()
                  return
                }
                try {
                  const body = readFileSync(join(MASCOT_DIR, name))
                  res.writeHead(200, {
                    'content-type': 'image/svg+xml; charset=utf-8',
                    'cache-control': 'public, max-age=86400',
                    'content-length': body.length,
                    'x-content-type-options': 'nosniff',
                    // 直链打开 SVG 时禁止脚本（<img> 场景 CSP 不生效，不影响面板渲染）
                    'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
                  })
                  res.end(body)
                } catch (err) {
                  log(`mascot read failed for ${name}: ${err && err.message}`)
                  res.writeHead(404).end()
                }
              },
            }),
          'dsh-science: mascot assets route',
        )
        log('mascot assets route registered: GET /plugins/dsh-science/assets/<file>.svg')
      } catch (err) {
        log(`mascot route register failed: ${err && err.message}`)
      }
      // v0.9.0 角色技能库管理路由：客户端团队 tab「角色技能库」勾选/自定义链接 → POST。
      // body: { action:'install'|'remove', role, repoId?, repoUrl?, name? }
      // 鉴权与 state/file 同款浏览器会话栅栏；安装/删除复用 lib/skillmenu.js（互斥队列内执行）。
      try {
        ctx.effect(
          () =>
            server.register({
              kind: 'exact',
              path: '/plugins/dsh-science/skill-manage',
              handler: async (req, res) => {
                const rejection = requestRejectionOf(ctx, req)
                if (rejection !== undefined) {
                  sendJson(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
                  return
                }
                if ((req.method || '').toUpperCase() !== 'POST') {
                  sendJson(res, 405, { error: 'POST only' })
                  return
                }
                const body = await readJsonBody(req)
                if (!body || typeof body !== 'object') {
                  sendJson(res, 400, { error: 'invalid JSON body' })
                  return
                }
                const action = String(body.action || '')
                const role = String(body.role || '')
                try {
                  if (action === 'install') {
                    const result = await installSkill({
                      role,
                      catalogId: body.repoId ? String(body.repoId) : null,
                      repoUrl: body.repoUrl ? String(body.repoUrl) : null,
                      name: body.name ? String(body.name) : null,
                    })
                    sendJson(res, result.ok ? 200 : 400, result)
                  } else if (action === 'remove') {
                    const result = await removeSkill({ role, name: body.name ? String(body.name) : null })
                    sendJson(res, result.ok ? 200 : 400, result)
                  } else {
                    sendJson(res, 400, { error: 'action 必须是 install | remove' })
                  }
                } catch (err) {
                  log(`skill-manage handler failed: ${err && err.message}`)
                  sendJson(res, 500, { error: 'internal error' })
                }
              },
            }),
          'dsh-science: skill-manage route',
        )
        log('skill-manage route registered: POST /plugins/dsh-science/skill-manage')
      } catch (err) {
        log(`skill-manage route register failed: ${err && err.message}`)
      }
    } catch (err) {
      log(`route register failed: ${err && err.message}`)
    }
  }
  tryRegister()
  // webServer 可能在本插件挂载之后才绑定（并发激活），按服务绑定事件重试
  try {
    ctx.on('internal/service', (name) => {
      if (WEB_SERVER_KEYS.includes(name)) tryRegister()
    })
  } catch (err) {
    log(`service listener failed: ${err && err.message}`)
  }
}
