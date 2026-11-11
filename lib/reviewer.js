// dsh-science — 自动结果审查模块（P3-4 / P4-1）
// 设计原则：
//   · 只追因、不复算：只有"回复中的断言与执行记录/产物矛盾"才算 fail；无法溯源不算发现
//   · 证据必须来自审查窗口内读到的 transcript/工具结果，不得引入记忆
//   · 审查子 agent 只读，产出严格 JSON findings
// 证据源：session.snapshotEvents()（直接读会话日志，不依赖 session/event 总线，
//        规避 web 档案下第三方插件收不到事件的平台限制）。
// 触发：/sci-review 命令（手动，主路径）；DSH_SCIENCE_AUTO_REVIEW=1 时 agent 空闲后自动审查（节流 60s）。
// v0.10.0（B2）：输出解析失败自动重试一次（重试 prompt 强调「只输出 JSON 本体」）。
// v0.11.0（F-A/F-B）：
//   · startActivation 调用形状对齐官方契约（SubagentActivationSpec）——request 必含 prompt/parent，
//     signal 只在 spec 层（request = Omit<SubagentStartRequest,'label'|'signal'>）；历史 maxDepth
//     崩溃源于旧调用缺 request 包装，现以单测钉住形状防回归。
//   · parseFindings 健壮化：容忍 markdown 围栏/前后缀 prose/多 JSON 对象/裸数组；条目归一化
//     （severity 枚举校验、非对象剔除、无 undefined 键）；空 findings 数组合法（审查无发现）。
//   · 运行期有界等待：spec.signal 只取消发布前工作，子 agent 接受任务后 hang 住会让命令永久
//     阻塞——awaitActivationResult 超时后 dispose 子 agent 并按 failed 落盘。

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirOf } from './store.js'
import { loadBlueprint } from './blueprint.js'

function log(msg) {
  console.log(`[dsh-science review] ${msg}`)
}

const reviewsFile = () => join(dataDirOf(), 'reviews.json')

function loadReviews() {
  try {
    return JSON.parse(readFileSync(reviewsFile(), 'utf8'))
  } catch {
    return {}
  }
}

function saveReviews(reviews) {
  writeFileSync(reviewsFile(), JSON.stringify(reviews, null, 2), 'utf8')
}

const TEXT_SLICE = 1500
const MAX_WINDOW_EVENTS = 300
const REVIEW_TIMEOUT_MS = 180000

function textOfContent(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === 'string' ? b : b && b.text ? b.text : b && b.type ? `[${b.type}]` : ''))
      .join(' ')
  }
  return ''
}

// 从原始事件流抽取审查可读的证据行（无 turn 的用户消息挂在下一个 turn/start 前）
function extractEvidenceRows(events) {
  const rows = []
  let pendingUsers = []
  for (const ev of events) {
    const type = ev && ev.type
    const d = ev && (ev.data || ev)
    switch (type) {
      case 'user/message': {
        const text = String(textOfContent(d.content ?? d.message?.content)).trim()
        if (text) pendingUsers.push(text.slice(0, TEXT_SLICE))
        break
      }
      case 'turn/start':
        for (const t of pendingUsers) rows.push({ kind: 'user', turn: d.turn, text: t })
        pendingUsers = []
        rows.push({ kind: 'turn-marker', turn: d.turn })
        break
      case 'assistant/message': {
        const text = String(textOfContent(d.message?.content)).trim()
        if (text) rows.push({ kind: 'assistant', turn: d.turn, text: text.slice(0, TEXT_SLICE) })
        break
      }
      case 'tool/call':
        rows.push({ kind: 'tool/call', turn: d.turn, name: d.name, args: String(d.arguments || '').slice(0, 600) })
        break
      case 'tool/result': {
        const msg = d.message
        rows.push({
          kind: 'tool/result',
          turn: d.turn,
          name: d.name || (msg && msg.toolName) || '?',
          isError: !!(msg && msg.isError),
          text: String(textOfContent(msg && msg.content)).slice(0, TEXT_SLICE),
        })
        break
      }
      default:
        break
    }
  }
  return rows
}

// 目标轮的证据窗口：该轮 turn-marker 起到日志末尾；若找不到标记则取尾部窗口
function evidenceTextForTurn(rows, turn) {
  const markerIdx = rows.findIndex((r) => r.kind === 'turn-marker' && r.turn === turn)
  const window = markerIdx >= 0 ? rows.slice(markerIdx) : rows.slice(-40)
  if (window.length === 0) return '(窗口内无事件记录)'
  return window
    .map((r) => {
      switch (r.kind) {
        case 'user': return `[用户] ${r.text}`
        case 'assistant': return `[助手] ${r.text}`
        case 'tool/call': return `[工具调用] ${r.name} 参数: ${r.args}`
        case 'tool/result': return `[工具结果] ${r.name} isError=${r.isError ? 'true' : 'false'} 结果: ${r.text}`
        case 'turn-marker': return `―― turn ${r.turn} 开始 ――`
        default: return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}

const REVIEW_SYSTEM_INSTRUCTIONS = `你是一个严格的科研结果审查器（transcript reviewer）。你只读审查，绝不复算、绝不修改任何东西。

核心原则：
- 只追因，不复算：对回复中的关键数字/断言，在证据窗口中找产生它的工具调用与结果。找到矛盾（数值对不上、声称已执行但无对应工具调用、声称存在的数据与工具结果矛盾）才算 fail；只是找不到出处（可能产生于窗口之前）不算发现，最多 warn。
- 证据只能引用证据窗口里的内容，不得补充你记忆中的任何事实。
- 检查项：
  1. number-traceability 数字可溯源性
  2. claim-execution 一致性（声称做了的事是否有对应工具调用/结果）
  3. figure-consistency 图表登记与描述是否一致
  4. citation-hygiene 引用卫生（只标 warn 除非证据矛盾）
  5. fabrication 伪造迹象（如用随机数冒充实验结果、无执行却声称完成、声称的数据与工具结果不符）
- 严格输出 JSON（不要输出任何其他文字）：
{"findings":[{"severity":"pass|warn|fail","check":"<检查项>","claim":"<被审查的断言，可空>","evidence":"<窗口内证据引用>","message":"<一句话结论>"}]}
没有问题的检查项也要输出 severity=pass 的记录。`

// B2（v0.10.0）：解析失败重试时在 prompt 末尾追加的纠正指令
const RETRY_JSON_ONLY_NOTE = '上一次输出不是合法 JSON。这次只输出 JSON 本体，不要任何其他文字。'

function buildReviewPrompt(evidence) {
  return `${REVIEW_SYSTEM_INSTRUCTIONS}\n\n=== 审查窗口（transcript 证据）===\n${evidence}\n=== 窗口结束 ===\n\n请输出 JSON。`
}

// 蓝图深度绑定（v0.9.0 Track 2 B3）：蓝图存在且有 result 时，把核心主张与各 result claim
// 附进审查提示词，要求逐条核对。语义（与"只追因不复算"一致）：证据窗口内能核对的一致→pass /
// 矛盾→fail；窗口内没有相关证据 → warn（说明未覆盖），不算 fail。
function blueprintClaimsSection() {
  try {
    const bp = loadBlueprint()
    const results = (bp.results || []).filter((r) => r && (r.claim || '').trim())
    const coreClaim = bp.core && bp.core.claim ? String(bp.core.claim).trim() : ''
    if (!coreClaim && results.length === 0) return ''
    const lines = []
    if (coreClaim) lines.push(`- core${bp.core.confirmed === true ? ' [已确认]' : ' [待确认]'}: ${coreClaim}`)
    for (const r of results) {
      lines.push(
        `- ${r.id}${r.confirmed === true ? ' [已确认]' : ' [待确认]'}（${r.status || 'planned'}）: ${r.claim}`,
      )
    }
    return [
      '',
      '=== 文章蓝图 claims 逐条核对 ===',
      '以下每条 claim 都要在 findings 里输出一条记录（check="blueprint-claim"，claim 字段填 claim 内容）：',
      '· 证据窗口内有对应执行/断言且一致 → severity=pass；矛盾（数字对不上/声称的结果与工具结果不符）→ fail；',
      '· 证据窗口内没有相关内容 → severity=warn，message 说明"证据窗口未覆盖该 claim"（不算 fail）。',
      ...lines,
      '=== claims 清单结束 ===',
    ].join('\n')
  } catch {
    return ''
  }
}

// 审核 #3：模型可能输出首尾空白或近似词（critical/error/fatal/high），一律先 trim 再归一，
// 否则 ' Fail ' / 'critical' 会静默降级为 warn，导致 failCount=0 误报通过。
const SEVERITY_ALIASES = {
  pass: 'pass', ok: 'pass', success: 'pass', passed: 'pass',
  warn: 'warn', warning: 'warn', medium: 'warn',
  fail: 'fail', error: 'fail', fatal: 'fail', critical: 'fail', high: 'fail',
}

function normalizeSeverity(raw) {
  const key = String(raw ?? '').trim().toLowerCase()
  // fail-closed：未知/缺失 severity 不能静默降级成 warn（否则 failCount=0 误报通过）
  return SEVERITY_ALIASES[key] || 'fail'
}

// 条目归一化：severity 收敛到枚举（未知按 fail），非对象条目剔除，字段统一为字符串，
// 不产生 undefined 键（DSH 无损 JSON 校验）。空数组合法（审查无发现）；非空但全部非法 → null。
// 「有效 finding」必须有 message 或 claim——只有 severity 的诱饵对象（如 {severity:'fail',note:'x'}）
// 不计入，避免垃圾数组压过真实 findings。
const MAX_FINDINGS = 200
function normalizeFindings(arr) {
  if (arr.length === 0) return []
  // fail 单独收集：截断只允许丢 pass/warn，绝不能让大量 pass 把 fail 挤出窗口（H2/M1）。
  const fails = []
  const others = []
  for (const f of arr) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) continue
    const message = String(f.message ?? '').trim()
    const claim = f.claim == null ? '' : String(f.claim).trim()
    if (!message && !claim) continue
    const entry = {
      severity: normalizeSeverity(f.severity),
      check: String(f.check ?? 'unspecified'),
      message: String(f.message ?? ''),
    }
    if (f.claim != null) entry.claim = String(f.claim)
    if (f.evidence != null) entry.evidence = String(f.evidence)
    if (entry.severity === 'fail') {
      if (fails.length < MAX_FINDINGS) fails.push(entry)
    } else if (others.length < MAX_FINDINGS) {
      others.push(entry)
    }
    if (fails.length >= MAX_FINDINGS) break
  }
  const out = [...fails, ...others].slice(0, MAX_FINDINGS)
  return out.length > 0 ? out : null
}

function findingsFromParsed(parsed) {
  if (Array.isArray(parsed)) return normalizeFindings(parsed)
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.findings)) return normalizeFindings(parsed.findings)
  return null
}

function tryParseFindings(s) {
  try {
    return findingsFromParsed(JSON.parse(s))
  } catch {
    return null
  }
}

// 单遍栈扫描（O(n)）：每个 opener 一旦遇到 closer 就产出其平衡片段（含内层）。
// 不平衡 prose 花括号（如 `if (x) {`）留在栈上，不会吞掉其后的真实 JSON。
// 字符串感知：仅在已进入片段（栈非空）时识别引号，避免 prose 里的引号干扰。
function* balancedJsonSpans(s) {
  const stack = []
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      if (stack.length > 0) inStr = true
      continue
    }
    if (ch === '{' || ch === '[') stack.push(i)
    else if (ch === '}' || ch === ']') {
      if (stack.length) {
        const start = stack.pop()
        // 超大片段（恶意嵌套/巨量日志）不做 slice —— 切片成本 O(len)，会阻塞主线程；
        // 真实 findings JSON 远小于 1MB，直接跳过（无有效候选时上层返回 null 触发重试）。
        if (i + 1 - start <= MAX_SPAN_LEN) yield s.slice(start, i + 1)
      }
    }
  }
}

// 候选打分：fail 数优先、其次条目数——避免「非空 pass 诱饵在前」遮蔽真实 fail（审核 #2）。
function findingsScore(arr) {
  let fails = 0
  for (const f of arr) if (f && f.severity === 'fail') fails++
  return fails * 10000 + arr.length
}

const MAX_SPANS = 2000
const MAX_SPAN_LEN = 1_000_000

// F-B（v0.11.0）：容忍 markdown 围栏 / 前后缀 prose / 多 JSON 对象 / 裸 findings 数组。
// 所有候选（含内层 span）打分取最优；空数组合法且仅在无任何非空结果时返回 []。
export function parseFindings(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  const candidates = []
  const fenceRe = /```[ \t]*(?:json)?[ \t]*\r?\n?([\s\S]*?)```/gi
  let m
  while ((m = fenceRe.exec(text))) candidates.push(m[1])
  candidates.push(text)
  let best = null
  let bestScore = -1
  let emptyResult = null
  let truncated = false
  const consider = (arr) => {
    if (!arr) return
    if (arr.length === 0) {
      if (emptyResult === null) emptyResult = arr
      return
    }
    const score = findingsScore(arr)
    if (score > bestScore) {
      bestScore = score
      best = arr
    }
  }
  for (const c of candidates) {
    consider(tryParseFindings(c.trim()))
    let parsed = 0
    for (const span of balancedJsonSpans(c)) {
      // 计数放在过滤前：恶意输出用海量无关花括号耗尽预算时，必须降级为 null（触发重试），
      // 不能返回 [] 让审查"静默清白"。
      if (++parsed > MAX_SPANS) {
        truncated = true
        break
      }
      // 只解析可能相关的片段（含 findings 或裸数组），避免无关 JSON 的解析开销
      if (!/findings/i.test(span) && !/^\s*\[/.test(span)) continue
      consider(tryParseFindings(span))
    }
  }
  return best || (truncated ? null : emptyResult)
}

// SubagentResult 形态：{ output: ContentBlock[], structured?, diagnostic?, stopReason }。
// 最终助手文本在 output 里 type==='text' 的块中；老字段 content/text 不存在，
// 直接 JSON.stringify 整包会在 2000 字符处截断、丢失 findings JSON → parse-failed。
function subagentOutputText(result) {
  try {
    const out = result && Array.isArray(result.output) ? result.output : []
    const texts = out
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string' && b.text.trim())
      .map((b) => b.text)
    if (texts.length > 0) return texts.join('\n')
    if (result && result.structured !== undefined && result.structured !== null) {
      return JSON.stringify(result.structured)
    }
  } catch {
    /* fallthrough */
  }
  return result ? JSON.stringify(result).slice(0, 2000) : ''
}

// spec.signal 只取消发布前工作；子 agent 接受任务后的运行期 cancellation 归 dispose 管。
// 有界等待：超时或 result 拒绝都 dispose 掉子 agent，避免 /sci-review 永久阻塞或孤儿子 agent。
// 审核 #6：dispose 本身也可能挂起——给它一个宽限上限，到点即放弃 teardown 继续抛原始错误，
// 否则「有界等待」会被一个不返回的 dispose 击穿。
const DISPOSE_GRACE_MS = 3000
export async function awaitActivationResult(activation, timeoutMs, disposeGraceMs = DISPOSE_GRACE_MS) {
  let timer
  try {
    return await Promise.race([
      activation.result,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`审查子 agent 超时（${timeoutMs}ms 未返回结果），已终止`)), timeoutMs)
      }),
    ])
  } catch (err) {
    let disposeTimer
    try {
      await Promise.race([
        Promise.resolve(activation.dispose()),
        new Promise((resolve) => {
          disposeTimer = setTimeout(resolve, disposeGraceMs)
        }),
      ])
    } catch {
      /* teardown 尽力而为，不掩盖原始错误 */
    } finally {
      clearTimeout(disposeTimer)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// opts: registerReviewer 透传（opts.mirror = 工作区镜像写回，与 saveReviews 双通道持久化）
export async function runReview(ctx, agent, sessionId, turn, opts = {}) {
  const session = agent && agent.session
  if (!session || typeof session.snapshotEvents !== 'function') {
    return { ok: false, reason: '无法访问会话日志（session.snapshotEvents 不可用）' }
  }
  const rawEvents = session.snapshotEvents()
  const rows = extractEvidenceRows(rawEvents.slice(-MAX_WINDOW_EVENTS))
  const evidence = evidenceTextForTurn(rows, turn)
  if (evidence === '(窗口内无事件记录)') {
    return { ok: false, reason: '窗口内没有可审查的事件' }
  }
  const claimsSection = blueprintClaimsSection()
  const runId = `rev-${Date.now().toString(36)}`
  const startedAt = Date.now()
  log(`run ${runId}: reviewing turn ${turn} of session ${sessionId} (${rows.length} rows)`)
  let resultText = ''
  let firstRawText = ''
  let retried = false
  let findings = null
  const basePrompt = buildReviewPrompt(evidence) + claimsSection
  // B2（v0.10.0）：最多两轮——第 1 轮解析失败（findings===null）时重试一次，重试 prompt 末尾
  // 追加「只输出 JSON 本体」；两次都失败才落盘 parse-failed。子 agent 调用本身抛错不重试。
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text = ''
    try {
      // F-A：形状对齐官方 dsh-tool-subagent 契约——request 只含 prompt/parent（signal 在 spec 层）。
      const activation = await ctx.subagents.startActivation({
        provider: 'spawn',
        delivery: 'caller',
        label: attempt === 1 ? `sci-review ${runId}` : `sci-review ${runId} retry`,
        request: {
          prompt: [{ type: 'text', text: attempt === 1 ? basePrompt : `${basePrompt}\n\n${RETRY_JSON_ONLY_NOTE}` }],
          parent: agent,
        },
        signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
      })
      const result = await awaitActivationResult(activation, REVIEW_TIMEOUT_MS)
      text = subagentOutputText(result)
    } catch (err) {
      log(`subagent review failed (attempt ${attempt}): ${(err && err.stack) || (err && err.message)}`)
      const reviews = loadReviews()
      reviews[runId] = { id: runId, sessionId, turn, trigger: 'review', status: 'failed', startedAt, finishedAt: Date.now(), findings: [{ severity: 'fail', check: 'runner', message: `审查子 agent 失败: ${err && err.message}` }] }
      saveReviews(reviews)
      return { ok: false, reason: `审查子 agent 失败: ${err && err.message}` }
    }
    resultText = text
    findings = parseFindings(text)
    if (findings) break
    if (attempt === 1) {
      firstRawText = text
      retried = true
      log(`run ${runId}: findings parse failed on attempt 1 (raw ${text.length} chars) — retrying once with JSON-only instruction`)
    }
  }
  const reviews = loadReviews()
  reviews[runId] = {
    id: runId,
    sessionId,
    turn,
    trigger: 'review',
    status: findings ? 'done' : 'parse-failed',
    startedAt,
    finishedAt: Date.now(),
    retried,
    findings: findings || [
      { severity: 'warn', check: 'parse', message: '审查器输出经一次重试后仍无法解析为 JSON', evidence: (firstRawText || resultText).slice(0, 800) },
    ],
    raw: resultText.slice(0, 4000),
  }
  saveReviews(reviews)
  if (opts.mirror) opts.mirror('reviews.json', JSON.stringify(reviews, null, 2), { agent })
  if (!findings) {
    // 回归修复：解析失败不再是 ok:true + 空 findings——调用方必须显式知道审查没有产出结论
    log(`run ${runId}: findings parse failed after retry (raw ${resultText.length} chars)`)
    return { ok: false, parseFailed: true, runId, raw: resultText.slice(0, 200) }
  }
  const fails = findings.filter((f) => f.severity === 'fail')
  return { ok: true, runId, findings, failCount: fails.length }
}

function lastCompletedTurnOf(session) {
  try {
    const events = session.snapshotEvents()
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev && ev.type === 'turn/end') {
        const d = ev.data || ev
        if (typeof d.turn === 'number') return d.turn
      }
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export function registerReviewer(ctx, opts = {}) {
  const autoEnabled = process.env.DSH_SCIENCE_AUTO_REVIEW === '1'
  const lastReviewedTurn = new Map()
  const lastReviewAt = new Map()

  // 手动路径：/sci-review
  try {
    ctx.commands.register({
      name: 'sci-review',
      description: '审查最近一轮回复（数字溯源/断言-执行一致性/图表一致/引用卫生/伪造迹象）',
      input: { hint: '[可选] 要审查的 turn 序号，默认最近一轮' },
      handler: async (invocation) => {
        try {
          const agent = invocation.agent
          const session = agent && agent.session
          if (!session || !session.id) return { kind: 'error', text: '无法确定当前会话' }
          const argTurn = Number(String(invocation.rawInput || '').trim())
          const turn = Number.isFinite(argTurn) && argTurn > 0 ? argTurn : lastCompletedTurnOf(session)
          if (typeof turn !== 'number') return { kind: 'success', text: '还没有已完成的轮次可审查。' }
          const r = await runReview(ctx, agent, session.id, turn, opts)
          if (!r.ok && r.parseFailed) {
            return {
              kind: 'error',
              text: [
                `输出解析失败（run ${r.runId}）：审查器没有返回合法的 findings JSON，本次审查不构成结论（宁缺毋滥）。`,
                `原始输出片段：${r.raw ? r.raw.slice(0, 200) : '(空)'}`,
              ].join('\n'),
            }
          }
          if (!r.ok) return { kind: 'error', text: `审查失败：${r.reason}` }
          const lines = r.findings.map(
            (f) => `- [${String(f.severity).toUpperCase()}] (${f.check}) ${f.message}${f.evidence ? ` | 证据: ${String(f.evidence).slice(0, 200)}` : ''}`,
          )
          return {
            kind: 'success',
            text: [
              `审查完成（run ${r.runId}，turn ${turn}）：${r.findings.length} 条记录，其中 fail ${r.failCount} 条`,
              '',
              ...lines,
            ].join('\n'),
          }
        } catch (err) {
          return { kind: 'error', text: `审查异常：${err && err.message}` }
        }
      },
    })
    log('command /sci-review registered (manual review, session-log evidence)')
  } catch (err) {
    log(`command register failed: ${err && err.message}`)
  }

  // 自动路径（可选）：agent 空闲且 turn 前进 → 审查。headless 档案可用；
  // web 档案下 agent/status 是否可达待平台确认（见 P4-3）。
  if (autoEnabled) {
    try {
      const prevStatus = new Map()
      ctx.on(
        'agent/status',
        async (payload) => {
          const agent = payload && payload.agent
          const status = payload && payload.status
          if (!agent) return
          const was = prevStatus.get(agent.id)
          prevStatus.set(agent.id, status)
          if (was !== 'running' || status !== 'idle') return
          const session = agent.session
          if (!session || !session.id) return
          const turn = lastCompletedTurnOf(session)
          if (typeof turn !== 'number') return
          const seen = lastReviewedTurn.get(agent.id) || -1
          if (turn <= seen) return
          const now = Date.now()
          if (now - (lastReviewAt.get(agent.id) || 0) < 60000) return
          lastReviewedTurn.set(agent.id, turn)
          lastReviewAt.set(agent.id, now)
          const r = await runReview(ctx, agent, session.id, turn, opts)
          if (r.ok && r.failCount > 0) {
            const fails = r.findings.filter((f) => f.severity === 'fail')
            const summary = [
              `[dsh-science 自动审查] 发现 ${fails.length} 个 fail 级问题（run ${r.runId}）：`,
              ...fails.map((f) => `- (${f.check}) ${f.message}${f.evidence ? ` | 证据: ${String(f.evidence).slice(0, 300)}` : ''}`),
              '请核对并修正你的上一轮回复，或解释为什么这些发现不适用。',
            ].join('\n')
            try {
              agent.followup(summary)
            } catch (err) {
              log(`followup failed: ${err && err.message}`)
            }
          } else if (r.ok) {
            log(`auto review ${r.runId}: ${r.findings.length} findings, 0 fail`)
          }
        },
        { global: true },
      )
      log('auto review enabled (DSH_SCIENCE_AUTO_REVIEW=1, idle-triggered, 60s throttle)')
    } catch (err) {
      log(`auto review listener failed: ${err && err.message}`)
    }
  }
}
