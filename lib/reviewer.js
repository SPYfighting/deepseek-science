// dsh-science — 自动结果审查模块（P3-4 / P4-1）
// 设计原则：
//   · 只追因、不复算：只有"回复中的断言与执行记录/产物矛盾"才算 fail；无法溯源不算发现
//   · 证据必须来自审查窗口内读到的 transcript/工具结果，不得引入记忆
//   · 审查子 agent 只读，产出严格 JSON findings
// 证据源：session.snapshotEvents()（直接读会话日志，不依赖 session/event 总线，
//        规避 web 档案下第三方插件收不到事件的平台限制）。
// 触发：/sci-review 命令（手动，主路径）；DSH_SCIENCE_AUTO_REVIEW=1 时 agent 空闲后自动审查（节流 60s）。
// v0.10.0（B2，v0.9 验收遗留）：输出解析失败（findings===null）自动重试一次——重试 prompt
//        末尾追加「只输出 JSON 本体」指令；两次都失败才落盘 parse-failed（子 agent 调用本身
//        抛错仍按 failed 处理，不重试）。

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

function parseFindings(text) {
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0])
    if (parsed && Array.isArray(parsed.findings)) return parsed.findings
  } catch {
    /* fallthrough */
  }
  return null
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

// opts: registerReviewer 透传（opts.mirror = 工作区镜像写回，与 saveReviews 双通道持久化）
async function runReview(ctx, agent, sessionId, turn, opts = {}) {
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
      const activation = await ctx.subagents.startActivation({
        provider: 'spawn',
        delivery: 'caller',
        label: attempt === 1 ? `sci-review ${runId}` : `sci-review ${runId} retry`,
        request: {
          prompt: [{ type: 'text', text: attempt === 1 ? basePrompt : `${basePrompt}\n\n${RETRY_JSON_ONLY_NOTE}` }],
          parent: agent,
          signal: AbortSignal.timeout(180000),
        },
        signal: AbortSignal.timeout(180000),
      })
      const result = await activation.result
      text = subagentOutputText(result)
    } catch (err) {
      log(`subagent review failed (attempt ${attempt}): ${err && err.message}`)
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
