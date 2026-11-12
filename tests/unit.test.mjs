// dsh-science 单元测试（node --test tests/）
// 覆盖：F-A startActivation 调用形状 / F-B parseFindings 健壮化 / SVG 可执行内容检测
//       / 证伪阈值可配置 / blocked_by 闸门（warn|hard）/ configOf 容错
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const home = mkdtempSync(join(tmpdir(), 'dsh-science-test-'))
process.env.DSH_HOME = home

const { parseFindings, runReview, awaitActivationResult } = await import('../lib/reviewer.js')
const { coverageOf, loadBlueprint, alignTaskToResult, linkFigureToResult, paperProgressOf } = await import('../lib/blueprint.js')
const { registerBlueprintTools } = await import('../lib/blueprint.js')
const { validateImageFile, svgActiveContentReason, decodeSvgText, registerFigureTools } = await import('../lib/figures.js')
const { inspectFigureBuffer, auditFigureRecord, JOURNAL_PROFILES } = await import('../lib/figureqa.js')
const { configOf, falsificationThresholdOf, blockedGateOf, dataDirOf } = await import('../lib/store.js')
const { registerTeamTools, wakeRoleMembers, sanitizeTeamState } = await import('../lib/team.js')
const { DEFAULT_TEAM } = await import('../lib/roles.js')
const { parseGitProgress, formatCloneProgress, formatSkillWakeText, installSkill, removeSkill, validateRepoUrl, setMemberWakeHook, roleSkillSectionText, skillMenuSnapshot, registerSkillMenuTools } = await import('../lib/skillmenu.js')
const { reviewCoverageOf } = await import('../lib/reviewcov.js')
const { dependencyClosure, normalizedBlockedBy, normalizeTaskBoard } = await import('../lib/dag.js')
const { reviewSummariesOf, reviewRunOf } = await import('../lib/reviewruns.js')
const { statusReportOf } = await import('../lib/status.js')
const { apply } = await import('../lib/index.js')
const { registerStateRoute } = await import('../lib/httpdata.js')
const { registerDbTools } = await import('../lib/db.js')
const { registerSshTools, sshProfilePoolKey } = await import('../lib/ssh.js')
const {
  normalizePaperSpine,
  confirmEntityRevision,
  isConfirmationCurrent,
  reviseEntity,
  paperSpineViewOf,
} = await import('../lib/paperspine.js')

const dataDir = dataDirOf()
const stateFiles = ['config.json', 'team.json', 'blueprint.json', 'figures.json', 'figure-plans.json', 'reviews.json', 'db-profiles.json', 'ssh-profiles.json', 'ssh-jobs.json', 'role-skills.json']
const roleSkillsDir = join(dataDir, 'role-skills')

function resetState() {
  for (const f of stateFiles) {
    const p = join(dataDir, f)
    if (existsSync(p)) rmSync(p)
  }
  rmSync(roleSkillsDir, { recursive: true, force: true })
}

function writeConfig(obj) {
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify(obj), 'utf8')
}

// ---------------------------------------------------------------------------
describe('DSH 论文证据主干 v2', () => {
  test('旧蓝图迁移后区分证据方向与文章角色，阴性结果不再自动退出支撑链', () => {
    const bp = normalizePaperSpine({
      core: { claim: '核心主张', confirmed: true },
      results: [
        { id: 'res-1', claim: '阴性对照未观察到效应', status: 'negative' },
        { id: 'res-2', claim: '弃用结果', status: 'dropped' },
      ],
      resultSeq: 2,
    })
    assert.equal(bp.schemaVersion, 2)
    assert.equal(bp.results[0].direction, 'contradicts')
    assert.equal(bp.results[0].manuscriptRole, 'boundary')
    assert.equal(bp.results[1].manuscriptRole, 'excluded')
    const view = paperSpineViewOf(bp, { tasks: [] }, {}, { results: [] })
    assert.equal(view.results[0].excluded, false)
    assert.equal(view.results[1].excluded, true)
    assert.ok(view.results[0].readiness.scientific.blockers.includes('尚无可核验证据'))
  })

  test('确认凭据绑定语义修订与内容摘要，语义修改后旧确认立即失效', () => {
    const bp = normalizePaperSpine({ core: { title: 'T', claim: 'C' }, results: [], resultSeq: 0 })
    const receipt = confirmEntityRevision(bp.core, 'core', { source: 'conversation', confirmedAt: 123 })
    assert.equal(receipt.revisionId, 'core-r1')
    assert.equal(isConfirmationCurrent(bp.core, 'core'), true)
    bp.core.claim = 'C2'
    reviseEntity(bp.core)
    assert.equal(bp.core.confirmed, false)
    assert.equal(isConfirmationCurrent(bp.core, 'core'), false)
    assert.equal(bp.core.revision, 2)
  })

  test('就绪状态按科学、文稿、投稿分层；正文呈现不强制每个 Result 配图', () => {
    const bp = normalizePaperSpine({
      core: { claim: 'C', confirmed: true },
      results: [{
        id: 'res-1', claim: 'R', confirmed: true, status: 'supported',
        presentation: { mode: 'prose', rationale: '用一句结果描述即可' },
        evidence: [{ id: 'ev-1', claimIds: ['res-1-claim-1'], direction: 'supports', state: 'verified', sourceLocator: 'results.csv#row=2', allowedInterpretation: 'R' }],
        references: [], tasks: ['task-1'], figures: [],
      }],
      resultSeq: 1,
      submission: {
        dataCode: { status: 'complete' }, ethics: { status: 'not_applicable' },
        reporting: { status: 'complete' }, limitations: { status: 'complete' },
      },
    })
    const review = { results: [{ id: 'res-1', severity: 'pass' }] }
    const view = paperSpineViewOf(bp, { tasks: [{ id: 'task-1', status: 'completed', resultIds: ['res-1'] }] }, {}, review)
    const readiness = view.results[0].readiness
    assert.equal(readiness.scientific.state, 'ready')
    assert.equal(readiness.manuscript.state, 'ready')
    assert.equal(readiness.submission.state, 'ready')
    assert.equal(readiness.manuscript.blockers.includes('尚无批准图件'), false)
  })

  test('工具层可记录 Claim、证据包、呈现决策、研究阶段和投稿检查', async () => {
    resetState()
    const tools = {}
    registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    await tools.sci_blueprint_set.execute({ core_title: 'T', claim: 'C' }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'core', confirmation_source: 'conversation' }, {})
    const added = await tools.sci_result_add.execute({ result_title: 'R1', claim: '主 Claim', purpose: '验证主要效应' }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'result', result_id: added.resultId }, {})
    const claim = await tools.sci_claim_add.execute({ result_id: added.resultId, claim: '边界 Claim' }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'result', result_id: added.resultId }, {})
    const evidence = await tools.sci_evidence_add.execute({
      result_id: added.resultId, claim_ids: [claim.claimId], direction: 'supports', state: 'verified',
      source_locator: 'analysis/output.csv#L2', allowed_interpretation: '该效应在所测条件下成立',
      prohibited_interpretation: '不能外推到未测试物种', conditions: 'n=6 biological replicates', uncertainty: '95% CI 1.2–2.1',
    }, {})
    assert.match(evidence.evidenceId, /^res-1-ev-/)
    await assert.rejects(
      tools.sci_result_update.execute({ result_id: added.resultId, presentation_mode: 'omit' }, {}),
      /presentation_rationale|呈现理由/,
    )
    await tools.sci_result_update.execute({
      result_id: added.resultId, direction: 'supports', evidence_state: 'verified',
      manuscript_role: 'main', presentation_mode: 'prose', presentation_rationale: '无需单独成图',
    }, {})
    await tools.sci_submission_check.execute({ item: 'ethics', status: 'not_applicable', note: '不涉及人或动物' }, {})
    await tools.sci_blueprint_stage.execute({ stage: 'execute' }, {})
    const overview = await tools.sci_blueprint_overview.execute({}, {})
    assert.equal(overview.paperSpine.stage, 'execute')
    assert.equal(overview.results[0].claims.length, 2)
    assert.equal(overview.results[0].evidence.length, 1)
    assert.equal(overview.results[0].presentation.mode, 'prose')
    assert.equal(overview.submission.ethics.status, 'not_applicable')
  })

  test('确认工具经宿主审批卡向用户显示，不能只靠模型自行置位', async () => {
    const gates = []
    registerBlueprintTools({
      tools: { register() {} },
      on: (event, handler) => { if (event === 'tools/pre-execute') gates.push(handler) },
    }, {})
    assert.equal(gates.length, 1)
    const next = async () => 'next'
    const decision = await gates[0]({ name: 'sci_blueprint_confirm', arguments: { kind: 'core' } }, next)
    assert.equal(decision.kind, 'ask')
    assert.match(decision.reason, /requires user approval/)
    assert.match(decision.displayReason.zh, /确认|文章承诺/)
    assert.equal(await gates[0]({ name: 'sci_blueprint_overview', arguments: {} }, next), 'next')
  })

  test('进入最终 audit 前要求所有纳入正文的 Result 文稿就绪', async () => {
    resetState()
    const tools = {}
    registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    await tools.sci_blueprint_set.execute({ core_title: 'T', claim: 'C' }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'core' }, {})
    const ready = await tools.sci_result_add.execute({ result_title: 'R1', claim: '已就绪主张' }, {})
    const blocked = await tools.sci_result_add.execute({ result_title: 'R2', claim: '未就绪主张' }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'result', result_id: ready.resultId }, {})
    await tools.sci_blueprint_confirm.execute({ kind: 'result', result_id: blocked.resultId }, {})
    const claimId = loadBlueprint().results.find((r) => r.id === ready.resultId).claims[0].id
    await tools.sci_evidence_add.execute({
      result_id: ready.resultId, claim_ids: [claimId], direction: 'supports', state: 'verified',
      source_locator: 'analysis/ready.csv#row=2', allowed_interpretation: '仅支持已就绪主张',
    }, {})
    await tools.sci_result_update.execute({
      result_id: ready.resultId, presentation_mode: 'prose', presentation_rationale: '正文一句话足够',
    }, {})
    writeFileSync(join(dataDir, 'reviews.json'), JSON.stringify({
      review1: { id: 'review1', finishedAt: Date.now(), findings: [{ check: 'blueprint-claim', claim: `${ready.resultId}@r1`, severity: 'pass', message: '通过' }] },
    }), 'utf8')
    await assert.rejects(
      tools.sci_blueprint_stage.execute({ stage: 'audit' }, {}),
      /所有纳入正文的 Result|R2|res-2/,
    )
  })
})

const FINDING = { severity: 'pass', check: 'number-traceability', claim: 'c', evidence: 'e', message: 'ok' }
const COMPLETE_FINDINGS = [
  FINDING,
  ...['claim-execution', 'figure-consistency', 'citation-hygiene', 'fabrication', 'plan-completion']
    .map((check) => ({ ...FINDING, check })),
]
const findingsJson = (arr = [FINDING]) => JSON.stringify({ findings: arr })
const completeFindingsJson = () => findingsJson(COMPLETE_FINDINGS)

// ---------------------------------------------------------------------------
describe('F-B: parseFindings 健壮化', () => {
  test('纯 JSON', () => {
    assert.deepEqual(parseFindings(findingsJson()), [FINDING])
  })
  test('```json 围栏', () => {
    assert.deepEqual(parseFindings('```json\n' + findingsJson() + '\n```'), [FINDING])
  })
  test('裸 ``` 围栏 + 前后缀文本', () => {
    assert.deepEqual(parseFindings('审查结论如下：\n```\n' + findingsJson() + '\n```\n以上。'), [FINDING])
  })
  test('前缀 prose + JSON（无围栏）', () => {
    assert.deepEqual(parseFindings('好的，这是结果：' + findingsJson()), [FINDING])
  })
  test('JSON + 含花括号的后缀 prose（贪婪正则会失败的场景）', () => {
    assert.deepEqual(parseFindings(findingsJson() + '\n希望有帮助 {注: 以上}'), [FINDING])
  })
  test('前后都有含花括号 prose', () => {
    assert.deepEqual(parseFindings('开头 {x} ' + findingsJson() + ' 结尾 {y}'), [FINDING])
  })
  test('多个 JSON 对象取第一个合法的', () => {
    assert.deepEqual(parseFindings(findingsJson() + '\n' + JSON.stringify({ other: 1 })), [FINDING])
  })
  test('第一个对象不是 findings、第二个才是', () => {
    assert.deepEqual(parseFindings(JSON.stringify({ meta: 'x' }) + '\n' + findingsJson()), [FINDING])
  })
  test('evidence 内嵌花括号与转义引号', () => {
    const f = { ...FINDING, evidence: '工具返回 {"a": "说\\"你好\\""} 嵌套' }
    assert.deepEqual(parseFindings(findingsJson([f])), [f])
  })
  test('容忍裸 findings 数组', () => {
    assert.deepEqual(parseFindings(JSON.stringify([FINDING])), [FINDING])
  })
  test('围栏内裸数组', () => {
    assert.deepEqual(parseFindings('```json\n' + JSON.stringify([FINDING]) + '\n```'), [FINDING])
  })
  test('垃圾文本 → null', () => {
    assert.equal(parseFindings('完全不是 JSON 的一段话'), null)
  })
  test('空/空白 → null', () => {
    assert.equal(parseFindings(''), null)
    assert.equal(parseFindings('   \n '), null)
    assert.equal(parseFindings(null), null)
    assert.equal(parseFindings(undefined), null)
  })
  test('findings 不是数组 → null', () => {
    assert.equal(parseFindings('{"findings": "oops"}'), null)
  })
  test('截断的 JSON → null', () => {
    assert.equal(parseFindings('{"findings": [{"severity": "pass"'), null)
  })
  test('条目归一化：severity 大小写/非法值、非对象条目剔除、无 undefined 键', () => {
    const raw = [
      { severity: 'FAIL', check: 'fabrication', message: 'm1' },
      { severity: 'bogus', check: 'x', message: 'm2' },
      'not-an-object',
      null,
      { severity: 'warn', check: 'c', message: 42, claim: null },
    ]
    const out = parseFindings(findingsJson(raw))
    assert.equal(out.length, 3)
    assert.equal(out[0].severity, 'fail')
    assert.equal(out[1].severity, 'fail')
    assert.equal(out[2].message, '42')
    for (const f of out) {
      for (const v of Object.values(f)) assert.notEqual(v, undefined)
      assert.equal(typeof f.check, 'string')
      assert.equal(typeof f.message, 'string')
    }
    assert.ok(!('claim' in out[2]) || out[2].claim === null || typeof out[2].claim === 'string')
  })
  test('全部条目非法 → null（宁缺毋滥，触发重试）', () => {
    assert.equal(parseFindings(findingsJson(['a', 1, null])), null)
  })
})

// ---------------------------------------------------------------------------
function mockSession(events) {
  return { id: 'session-test', snapshotEvents: () => events }
}
const reviewEvents = [
  { type: 'turn/start', data: { turn: 1 } },
  { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '分析完成：表达量上调 2.5 倍' }] } } },
  { type: 'turn/end', data: { turn: 1 } },
]

function mockCtxWithSubagent(impl) {
  const calls = []
  return {
    calls,
    ctx: {
      subagents: {
        startActivation: async (spec) => {
          calls.push(spec)
          return impl(spec, calls.length)
        },
      },
    },
  }
}

describe('F-A: runReview 的 startActivation 调用形状（对照官方 dsh-tool-subagent 契约）', () => {
  beforeEach(resetState)

  test('spec 形状符合 SubagentActivationSpec：request 必有、signal 只在 spec 层', async () => {
    const { ctx, calls } = mockCtxWithSubagent(async () => ({
      childId: 'child-1',
      result: Promise.resolve({ output: [{ type: 'text', text: completeFindingsJson() }] }),
      dispose: async () => {},
    }))
    const agent = { id: 'lead-1', session: mockSession(reviewEvents) }
    const r = await runReview(ctx, agent, 'session-test', 1, {})
    assert.equal(r.ok, true)
    assert.equal(calls.length, 1)
    const spec = calls[0]
    assert.equal(spec.provider, 'spawn')
    assert.equal(spec.delivery, 'caller')
    assert.ok(spec.request && typeof spec.request === 'object', 'spec.request 必须定义（maxDepth 崩溃根因）')
    assert.ok(Array.isArray(spec.request.prompt))
    assert.equal(spec.request.parent, agent)
    assert.ok(!('signal' in spec.request), '契约 request = Omit<SubagentStartRequest, label|signal>')
    assert.ok(spec.signal instanceof AbortSignal)
    assert.equal(typeof spec.label, 'string')
    for (const v of Object.values(spec.request)) assert.notEqual(v, undefined)
  })

  test('解析失败自动重试一次，重试 prompt 强调只输出 JSON', async () => {
    const { ctx, calls } = mockCtxWithSubagent(async (_spec, n) => ({
      childId: `child-${n}`,
      result: Promise.resolve({
        output: [{ type: 'text', text: n === 1 ? '这不是 JSON' : completeFindingsJson() }],
      }),
      dispose: async () => {},
    }))
    const agent = { id: 'lead-1', session: mockSession(reviewEvents) }
    const r = await runReview(ctx, agent, 'session-test', 1, {})
    assert.equal(r.ok, true)
    assert.equal(calls.length, 2)
    const retryPrompt = calls[1].request.prompt[0].text
    assert.ok(retryPrompt.includes('只输出 JSON'))
    const reviews = JSON.parse(readFileSync(join(dataDir, 'reviews.json'), 'utf8'))
    const rec = Object.values(reviews)[0]
    assert.equal(rec.status, 'done')
    assert.equal(rec.retried, true)
  })

  test('两次都解析失败 → parse-failed 落盘且 ok:false', async () => {
    const { ctx } = mockCtxWithSubagent(async () => ({
      childId: 'child-x',
      result: Promise.resolve({ output: [{ type: 'text', text: '依旧不是 JSON' }] }),
      dispose: async () => {},
    }))
    const agent = { id: 'lead-1', session: mockSession(reviewEvents) }
    const r = await runReview(ctx, agent, 'session-test', 1, {})
    assert.equal(r.ok, false)
    assert.equal(r.parseFailed, true)
    const reviews = JSON.parse(readFileSync(join(dataDir, 'reviews.json'), 'utf8'))
    assert.equal(Object.values(reviews)[0].status, 'parse-failed')
  })

  test('合法 JSON 缺少六项检查也会重试并 fail-closed', async () => {
    const { ctx, calls } = mockCtxWithSubagent(async () => ({
      childId: 'child-incomplete', result: Promise.resolve({ output: [{ type: 'text', text: findingsJson() }] }), dispose: async () => {},
    }))
    const r = await runReview(ctx, { id: 'lead-1', session: mockSession(reviewEvents) }, 'session-test', 1, {})
    assert.equal(calls.length, 2)
    assert.equal(r.ok, false)
    assert.equal(r.parseFailed, true)
  })

  test('目标 turn 不存在时明确失败，不拿最后事件替代', async () => {
    const { ctx, calls } = mockCtxWithSubagent(async () => { throw new Error('不应启动') })
    const r = await runReview(ctx, { id: 'lead-1', session: mockSession(reviewEvents) }, 'session-test', 99, {})
    assert.equal(r.ok, false)
    assert.match(r.reason, /找不到 turn 99/)
    assert.equal(calls.length, 0)
  })

  test('startActivation 抛错 → failed 落盘，不重试', async () => {
    const { ctx, calls } = mockCtxWithSubagent(async () => {
      throw new Error('provider missing')
    })
    const agent = { id: 'lead-1', session: mockSession(reviewEvents) }
    const r = await runReview(ctx, agent, 'session-test', 1, {})
    assert.equal(r.ok, false)
    assert.equal(calls.length, 1)
    const reviews = JSON.parse(readFileSync(join(dataDir, 'reviews.json'), 'utf8'))
    assert.equal(Object.values(reviews)[0].status, 'failed')
  })
})

describe('awaitActivationResult 有界等待（spec.signal 只管发布前，运行期需超时兜底）', () => {
  test('按时返回 → 原结果', async () => {
    const out = { output: [] }
    const r = await awaitActivationResult({ result: Promise.resolve(out), dispose: async () => {} }, 1000)
    assert.equal(r, out)
  })
  test('超时 → 抛错并 dispose 子 agent', async () => {
    let disposed = false
    await assert.rejects(
      awaitActivationResult(
        { result: new Promise(() => {}), dispose: async () => { disposed = true } },
        30,
      ),
      /超时/,
    )
    assert.equal(disposed, true)
  })
  test('result 拒绝 → 透传错误并 dispose', async () => {
    let disposed = false
    await assert.rejects(
      awaitActivationResult(
        { result: Promise.reject(new Error('capture failed')), dispose: async () => { disposed = true } },
        1000,
      ),
      /capture failed/,
    )
    assert.equal(disposed, true)
  })
})

// ---------------------------------------------------------------------------
describe('证伪阈值可配置（默认 ≥2 negative 且 0 supported）', () => {
  beforeEach(resetState)

  const bpWith = (statuses) => ({
    core: { title: 't', claim: 'c' },
    results: statuses.map((s, i) => ({ id: `res-${i + 1}`, claim: `claim ${i}`, status: s, tasks: [], figures: [] })),
  })

  test('默认阈值 2：1 negative 不触发', () => {
    const cov = coverageOf(bpWith(['negative', 'planned']), { tasks: [] }, {})
    assert.equal(cov.falsificationRisk, false)
    assert.equal(falsificationThresholdOf(), 2)
  })
  test('默认阈值 2：2 negative + 0 supported 触发', () => {
    const cov = coverageOf(bpWith(['negative', 'negative']), { tasks: [] }, {})
    assert.equal(cov.falsificationRisk, true)
  })
  test('有 supported 时不触发（阈值不变）', () => {
    const cov = coverageOf(bpWith(['negative', 'negative', 'supported']), { tasks: [] }, {})
    assert.equal(cov.falsificationRisk, false)
  })
  test('config 阈值 1：1 negative 即触发', () => {
    writeConfig({ falsificationThreshold: 1 })
    assert.equal(falsificationThresholdOf(), 1)
    const cov = coverageOf(bpWith(['negative']), { tasks: [] }, {})
    assert.equal(cov.falsificationRisk, true)
    assert.ok(cov.warnings.some((w) => w.includes('证伪')))
  })
  test('config 阈值 3：2 negative 不触发', () => {
    writeConfig({ falsificationThreshold: 3 })
    const cov = coverageOf(bpWith(['negative', 'negative']), { tasks: [] }, {})
    assert.equal(cov.falsificationRisk, false)
  })
  test('非法阈值回退默认 2', () => {
    for (const v of ['abc', 0, -1, 1.5, null]) {
      writeConfig({ falsificationThreshold: v })
      assert.equal(falsificationThresholdOf(), 2, `value=${JSON.stringify(v)}`)
    }
  })
  test('coverage 输出携带生效阈值（UI/工具可见）', () => {
    writeConfig({ falsificationThreshold: 4 })
    const cov = coverageOf(bpWith([]), { tasks: [] }, {})
    assert.equal(cov.falsificationThreshold, 4)
  })
})

// ---------------------------------------------------------------------------
describe('蓝图×审查：主张级审查覆盖（reviewcov）', () => {
  const bp = () => ({
    core: { claim: 'MYC drives tumor proliferation', confirmed: true },
    results: [
      { id: 'res-1', claim: 'MYC target gene set is significantly upregulated', confirmed: true, status: 'supported' },
      { id: 'res-2', claim: 'Knockdown of MYC suppresses proliferation in vitro', confirmed: false, status: 'planned' },
    ],
  })
  const run = (id, finishedAt, findings) => ({ id, status: 'done', finishedAt, findings })
  const f = (claim, severity, check = 'blueprint-claim') => ({ severity, check, claim, message: `${severity}-msg` })

  test('按 claim 文本匹配（忽略大小写与空白）', () => {
    const cov = reviewCoverageOf(bp(), { r1: run('r1', 100, [f('  myc TARGET gene set is significantly upregulated ', 'fail')]) })
    assert.equal(cov.results[0].severity, 'fail')
    assert.equal(cov.results[0].runId, 'r1')
    assert.equal(cov.results[0].reviewedAt, 100)
  })

  test('多个 run：按 finishedAt 取最新', () => {
    const cov = reviewCoverageOf(bp(), {
      old: run('old', 100, [f('MYC target gene set is significantly upregulated', 'pass')]),
      new: run('new', 200, [f('MYC target gene set is significantly upregulated', 'warn')]),
    })
    assert.equal(cov.results[0].severity, 'warn')
    assert.equal(cov.results[0].runId, 'new')
  })

  test('finding.claim 带 res-N/core 前缀时按 id 匹配（措辞不同也能命中）', () => {
    const cov = reviewCoverageOf(bp(), { r1: run('r1', 100, [f('res-2: 与蓝图原文完全不同的描述', 'fail'), f('core: 核心主张的另一说法', 'warn')]) })
    assert.equal(cov.results[1].severity, 'fail')
    assert.equal(cov.core.severity, 'warn')
  })

  test('截断/包含关系可匹配（≥12 字符）', () => {
    const cov = reviewCoverageOf(bp(), { r1: run('r1', 100, [f('Knockdown of MYC suppresses proliferation', 'pass')]) })
    assert.equal(cov.results[1].severity, 'pass')
  })

  test('非 blueprint-claim 检查项不参与匹配', () => {
    const cov = reviewCoverageOf(bp(), { r1: run('r1', 100, [f('MYC target gene set is significantly upregulated', 'fail', 'number-traceability')]) })
    assert.equal(cov.results[0].severity, null)
    assert.equal(cov.counts.reviewed, 0)
  })

  test('同一 run 内同 claim 多条：取最严重（fail > warn > pass）', () => {
    const cov = reviewCoverageOf(bp(), {
      r1: run('r1', 100, [
        f('MYC target gene set is significantly upregulated', 'pass'),
        f('MYC target gene set is significantly upregulated', 'fail'),
        f('MYC target gene set is significantly upregulated', 'warn'),
      ]),
    })
    assert.equal(cov.results[0].severity, 'fail')
  })

  test('已确认主张被审出 fail → warning 点名', () => {
    const cov = reviewCoverageOf(bp(), { r1: run('r1', 100, [f('MYC target gene set is significantly upregulated', 'fail')]) })
    assert.ok(cov.warnings.some((w) => w.includes('res-1') && w.includes('fail')))
    assert.equal(cov.counts.fail, 1)
    assert.equal(cov.counts.reviewed, 1)
    assert.equal(cov.counts.unreviewed, 2)
  })

  test('无审查记录：全部未审 + 一条汇总警告', () => {
    const cov = reviewCoverageOf(bp(), {})
    assert.equal(cov.counts.total, 3)
    assert.equal(cov.counts.unreviewed, 3)
    assert.equal(cov.warnings.filter((w) => w.includes('尚无审查记录')).length, 1)
  })

  test('reviews 结构损坏/为空不抛（null/字符串/数组）', () => {
    for (const bad of [null, undefined, 'x', {}, [], { a: { findings: 'bad' } }, { a: { findings: [null, 1, 'x'] } }]) {
      const cov = reviewCoverageOf(bp(), bad)
      assert.equal(cov.results.length, 2)
      assert.equal(cov.counts.reviewed, 0)
    }
  })

  test('reviews 为数组形态也能解析', () => {
    const cov = reviewCoverageOf(bp(), [run('r1', 100, [f('MYC drives tumor proliferation', 'pass')])])
    assert.equal(cov.core.severity, 'pass')
  })

  test('空 claim 的 result 不计入 total（无从核对）', () => {
    const b = bp()
    b.results.push({ id: 'res-3', claim: '   ', confirmed: false })
    const cov = reviewCoverageOf(b, {})
    assert.equal(cov.counts.total, 3)
    assert.equal(cov.results.find((r) => r.id === 'res-3').severity, null)
  })

  test('已确认但未审的主张在 warning 中点名', () => {
    const b = bp()
    b.results[1].confirmed = true
    const cov = reviewCoverageOf(b, { r1: run('r1', 100, [f('MYC target gene set is significantly upregulated', 'pass')]) })
    const joined = cov.warnings.join('\n')
    assert.ok(joined.includes('res-2') && joined.includes('尚未'), joined)
  })

  test('真实 reviews.json 形态：坏 run 的 runner fail 不污染覆盖', () => {
    const cov = reviewCoverageOf(bp(), {
      bad: { id: 'bad', status: 'failed', finishedAt: 300, findings: [{ severity: 'fail', check: 'runner', message: 'agent crashed' }] },
    })
    assert.equal(cov.counts.reviewed, 0)
    assert.equal(cov.counts.fail, 0)
  })

  test('文本精确匹配优先于 core 前缀（H1：claim 以 Core 开头不得劫持 core）', () => {
    const b = {
      core: { claim: 'Our method improves accuracy', confirmed: true },
      results: [{ id: 'res-1', claim: 'Core innovation: a new loss function', confirmed: false }],
    }
    const cov = reviewCoverageOf(b, { r1: run('r1', 100, [f('Core innovation: a new loss function', 'fail')]) })
    assert.equal(cov.results[0].severity, 'fail')
    assert.equal(cov.core.severity, null)
    assert.ok(!cov.warnings.some((w) => w.includes('core 的已确认')), cov.warnings.join('\n'))
  })

  test('文本歧义时仍可用 res-N 前缀消歧', () => {
    const b = {
      core: { claim: 'shared claim text over twelve chars', confirmed: false },
      results: [{ id: 'res-1', claim: 'shared claim text over twelve chars', confirmed: false }],
    }
    const cov = reviewCoverageOf(b, { r1: run('r1', 100, [f('res-1: shared claim text over twelve chars', 'warn')]) })
    assert.equal(cov.results[0].severity, 'warn')
    assert.equal(cov.core.severity, null)
  })

  test('全角字符经 NFKC 归一后可匹配', () => {
    const b = { core: { claim: 'ＭＹＣ drives tumor proliferation', confirmed: false }, results: [] }
    const cov = reviewCoverageOf(b, { r1: run('r1', 100, [f('myc drives tumor proliferation', 'pass')]) })
    assert.equal(cov.core.severity, 'pass')
  })

  test('稳定 Claim 修订标识符可直接对回 Result，避免文本改写后审查串线', () => {
    const b = {
      core: { claim: 'Core', confirmed: true, revision: 2 },
      results: [{
        id: 'res-1', claim: 'Primary', confirmed: true, revision: 3,
        claims: [{ id: 'res-1-claim-1', text: 'Primary', revision: 4, status: 'active' }],
      }],
    }
    const cov = reviewCoverageOf(b, { r1: run('r1', 100, [f('res-1-claim-1@r4', 'pass')]) })
    assert.equal(cov.results[0].severity, 'pass')
    assert.equal(cov.results[0].revisionId, 'res-1-r3')
  })

  test('finishedAt 为 ISO 字符串时按真实时间排序（最新覆盖最旧）', () => {
    const b = { core: { claim: 'MYC drives tumor proliferation', confirmed: false }, results: [] }
    const cov = reviewCoverageOf(b, {
      old: { id: 'old', finishedAt: '2026-11-01T00:00:00Z', findings: [f('MYC drives tumor proliferation', 'fail')] },
      new: { id: 'new', finishedAt: '2026-11-02T00:00:00Z', findings: [f('MYC drives tumor proliferation', 'pass')] },
    })
    assert.equal(cov.core.runId, 'new')
    assert.equal(cov.core.severity, 'pass')
  })
})

// ---------------------------------------------------------------------------
describe('SVG 可执行内容检测（安全）', () => {
  const cleanSvg = '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/><text x="10" y="50">Figure 1</text></svg>'

  test('干净 SVG（含 matplotlib 风格 DOCTYPE）通过', () => {
    assert.equal(svgActiveContentReason(cleanSvg), null)
    assert.equal(validateImageFile('fig.svg', Buffer.from(cleanSvg)).ok, true)
  })
  test('<script> 拒绝', () => {
    const svg = cleanSvg.replace('</svg>', '<script>alert(1)</script></svg>')
    assert.ok(svgActiveContentReason(svg))
    const r = validateImageFile('fig.svg', Buffer.from(svg))
    assert.equal(r.ok, false)
    assert.ok(r.error.includes('可执行'))
  })
  test('大小写变体 <SCRIPT> 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('</svg>', '<SCRIPT>x</SCRIPT></svg>')))
  })
  test('事件属性 onload 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<rect onload="alert(1)" ')))
  })
  test('事件属性大小写/空白变体拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<rect ONCLICK = "x()" ')))
  })
  test('javascript: URL 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<a href="javascript:alert(1)"><rect ')))
  })
  test('数字实体混淆 &#106;avascript: 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<a href="&#106;avascript:alert(1)"><rect ')))
  })
  test('十六进制实体 &#x6a; 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<a href="&#x6a;avascript:alert(1)"><rect ')))
  })
  test('命名实体 + 空白混淆 java&Tab;script&colon; 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<a href="java&Tab;script&colon;alert(1)"><rect ')))
  })
  test('data:text/html URL 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('<rect ', '<a href="data:text/html,<script>x</script>"><rect ')))
  })
  test('DOCTYPE 内嵌 ENTITY 声明拒绝', () => {
    const svg = cleanSvg.replace('<svg ', '<!DOCTYPE svg [<!ENTITY x "payload">]><svg ')
    assert.ok(svgActiveContentReason(svg))
  })
  test('SMIL set attributeName 指向 javascript: 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('</svg>', '<set attributeName="href" to="javascript:x"/></svg>')))
  })
  test('正文文本提到 javascript 不误伤', () => {
    const svg = cleanSvg.replace('Figure 1', 'JavaScript is a programming language')
    assert.equal(svgActiveContentReason(svg), null)
  })
  test('普通属性不误伤（font-size/stroke 等）', () => {
    const svg = cleanSvg.replace('<rect ', '<rect font-size="12" stroke-linejoin="round" data-onclick="note" ')
    assert.equal(svgActiveContentReason(svg), null)
  })
  test('非 SVG 扩展名仍拒绝', () => {
    const r = validateImageFile('fig.txt', Buffer.from(cleanSvg))
    assert.equal(r.ok, false)
    assert.ok(r.error.includes('扩展名'))
  })
  test('PNG magic 校验仍工作', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    assert.equal(validateImageFile('fig.png', png).ok, true)
    assert.equal(validateImageFile('fig.png', Buffer.from('not a png')).ok, false)
  })
})

// ---------------------------------------------------------------------------
function pngFixture(width, height) {
  const buf = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(width, 16)
  buf.writeUInt32BE(height, 20)
  return buf
}

describe('期刊图件计划与投稿前检', () => {
  beforeEach(resetState)

  test('Nature 配置可追溯，PNG 按最终物理宽度计算有效 dpi', () => {
    assert.equal(JOURNAL_PROFILES.nature.widthsMm.single, 89)
    assert.equal(JOURNAL_PROFILES.nature.fontPt.min, 5)
    assert.match(JOURNAL_PROFILES.nature.source, /^https:\/\//)
    const inspected = inspectFigureBuffer('figure.png', pngFixture(1200, 600))
    assert.deepEqual(inspected.pixelSize, { width: 1200, height: 600 })
    const audit = auditFigureRecord({
      path: 'figure.png',
      codePath: 'plot.py',
      sourceDataPaths: ['source.csv'],
      plan: {
        targetJournal: 'nature', targetWidthMm: 89, requiresStatistics: true,
        statisticsNote: 'mean ± s.e.m.; n=6 biological replicates',
      },
    }, inspected, { pathExists: () => true })
    assert.equal(audit.measurements.effectiveDpi > 342, true)
    assert.equal(audit.checks.find((x) => x.id === 'effective-dpi').status, 'pass')
    assert.equal(audit.automaticStatus, 'ready-for-manual-review')
    assert.equal(audit.overallStatus, 'ready-for-manual-review')
  })

  test('低有效 dpi 失败；缺代码与源数据给出可操作警告', () => {
    const inspected = inspectFigureBuffer('figure.png', pngFixture(400, 200))
    const audit = auditFigureRecord({
      path: 'figure.png',
      plan: { targetJournal: 'nature', targetWidthMm: 183, requiresStatistics: false },
    }, inspected, { pathExists: () => false })
    assert.equal(audit.checks.find((x) => x.id === 'effective-dpi').status, 'fail')
    assert.equal(audit.checks.find((x) => x.id === 'code-source').status, 'warn')
    assert.equal(audit.checks.find((x) => x.id === 'source-data').status, 'warn')
    assert.equal(audit.automaticStatus, 'failed')
  })

  test('最终版面超过期刊最大宽高时失败', () => {
    const inspected = inspectFigureBuffer('wide.png', pngFixture(4000, 4000))
    const audit = auditFigureRecord({
      codePath: 'plot.py', sourceDataPaths: ['source.csv'],
      plan: { targetJournal: 'nature', targetWidthMm: 190, requiresStatistics: false },
    }, inspected, { pathExists: () => true })
    const size = audit.checks.find((x) => x.id === 'target-size')
    assert.equal(size.status, 'fail')
    assert.match(size.requirement, /183 mm/)
  })

  test('PDF 作为投稿图件可登记，但可编辑文字保留为人工检查', () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type /Page /MediaBox [0 0 640.8 360]>>endobj')
    assert.equal(validateImageFile('figure.pdf', pdf).ok, true)
    const inspected = inspectFigureBuffer('figure.pdf', pdf)
    assert.equal(inspected.kind, 'vector')
    assert.equal(inspected.physicalSize.widthMm > 225, true)
  })

  test('plan → register → audit → 人工批准形成闭环并持久化', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-figure-qa-'))
    try {
      const figPath = join(dir, 'figure.png')
      const codePath = join(dir, 'plot.py')
      const dataPath = join(dir, 'source.csv')
      writeFileSync(figPath, pngFixture(1200, 600))
      writeFileSync(codePath, 'print("plot")', 'utf8')
      writeFileSync(dataPath, 'x,y\n1,2\n', 'utf8')
      const tools = {}
      registerFigureTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
      assert.ok(tools.sci_figure_plan)
      assert.ok(tools.sci_figure_audit)
      const plan = await tools.sci_figure_plan.execute({
        figure_title: '主要结果图', result_id: 'res-1', target_journal: 'nature',
        target_width_mm: 89, requires_statistics: true,
        statistics_note: 'mean ± s.e.m.; n=6 biological replicates',
        source_data_paths: [dataPath],
      }, {})
      assert.equal(plan.ok, true)
      const reg = await tools.sci_figure_register.execute({
        path: figPath, figure_title: '主要结果图', code_path: codePath, plan_id: plan.planId,
      }, {})
      assert.equal(reg.ok, true)
      assert.equal(reg.planId, plan.planId)
      const audited = await tools.sci_figure_audit.execute({ figure_id: reg.figureId }, {})
      assert.equal(audited.audit.overallStatus, 'ready-for-manual-review')
      const approved = await tools.sci_figure_audit.execute({
        figure_id: reg.figureId, manual_decision: 'approved', review_note: '按 89 mm 最终尺寸检查，文字与面板均可读。',
      }, {})
      assert.equal(approved.audit.overallStatus, 'approved')
      const list = await tools.sci_figure_list.execute({}, {})
      assert.equal(list.figures[0].audit.overallStatus, 'approved')
      assert.equal(list.figures[0].plan.targetJournal, 'nature')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('登记后的图件文件被改写时拒绝沿用旧版本前检', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-figure-integrity-'))
    try {
      const figPath = join(dir, 'figure.png')
      writeFileSync(figPath, pngFixture(1200, 600))
      const tools = {}
      registerFigureTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
      const reg = await tools.sci_figure_register.execute({ path: figPath, figure_title: '完整性检查图' }, {})

      writeFileSync(figPath, pngFixture(1300, 600))

      await assert.rejects(
        () => tools.sci_figure_audit.execute({ figure_id: reg.figureId }, {}),
        /登记后已改变.*重新调用 sci_figure_register/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('同一文件补绑新计划不刷版本，但会清除旧前检结论', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-figure-replan-'))
    try {
      const figPath = join(dir, 'figure.png')
      const codePath = join(dir, 'plot.py')
      const dataPath = join(dir, 'source.csv')
      writeFileSync(figPath, pngFixture(1200, 600))
      writeFileSync(codePath, 'print("plot")', 'utf8')
      writeFileSync(dataPath, 'x,y\n1,2\n', 'utf8')
      const tools = {}
      registerFigureTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
      const makePlan = () => tools.sci_figure_plan.execute({
        figure_title: '同一图', target_journal: 'nature', target_width_mm: 89,
        source_data_paths: [dataPath], requires_statistics: false,
      }, {})
      const plan1 = await makePlan()
      const first = await tools.sci_figure_register.execute({ path: figPath, code_path: codePath, plan_id: plan1.planId }, {})
      await tools.sci_figure_audit.execute({ figure_id: first.figureId, manual_decision: 'approved', review_note: '按最终尺寸核对，面板与文字均符合要求。' }, {})
      const plan2 = await makePlan()
      const rebound = await tools.sci_figure_register.execute({ path: figPath, code_path: codePath, plan_id: plan2.planId }, {})
      assert.equal(rebound.unchanged, true)
      assert.equal(rebound.metadataUpdated, true)
      assert.equal(rebound.version, 1)
      assert.equal(rebound.planId, plan2.planId)
      const list = await tools.sci_figure_list.execute({}, {})
      assert.equal(list.figures[0].audit, undefined)
      assert.equal(list.figures[0].planId, plan2.planId)
      const plans = JSON.parse(readFileSync(join(dataDir, 'figure-plans.json'), 'utf8'))
      assert.equal(plans[plan1.planId].status, 'superseded')
      assert.equal(plans[plan1.planId].supersededBy, plan2.planId)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('Result 驱动的论文推进视图', () => {
  test('按真实任务、文献、图件与审查计算进度和下一步', () => {
    const bp = {
      core: { claim: '核心', confirmed: true },
      results: [
        {
          id: 'res-1', title: '已形成证据链', claim: 'A', confirmed: true, status: 'supported',
          tasks: ['task-1', 'task-2'], figures: ['fig-1'],
          references: [{ doi: '10.1/a', verified: true }, { doi: '10.1/b', verified: false }],
        },
        { id: 'res-2', title: '待确认', claim: 'B', confirmed: false, status: 'planned', tasks: [], figures: [], references: [] },
      ],
    }
    const team = { tasks: [
      { id: 'task-1', resultId: 'res-1', status: 'completed', assignee: 'analyst' },
      { id: 'task-2', resultId: 'res-1', status: 'in_progress', assignee: 'figure' },
    ] }
    const figures = { 'fig-1': { id: 'fig-1', audit: { overallStatus: 'approved' } } }
    const review = {
      results: [
        { id: 'res-1', claim: 'A', severity: 'pass', runId: 'rev-1' },
        { id: 'res-2', claim: 'B', severity: 'none' },
      ],
    }
    const out = paperProgressOf(bp, team, figures, review)
    const r1 = out.results[0]
    assert.deepEqual(r1.tasks, { total: 2, completed: 1, active: 1, blocked: 0, failed: 0, cancelled: 0 })
    assert.deepEqual(r1.references, { total: 2, verified: 1 })
    assert.deepEqual(r1.figures, { total: 1, registered: 1, missing: 0, audited: 1, approved: 1 })
    assert.equal(r1.review.severity, 'pass')
    assert.match(r1.nextAction, /推进剩余 1 项任务/)
    assert.equal(r1.owner, 'figure')
    assert.match(out.results[1].nextAction, /确认/)
  })

  test('失败任务与失效图件引用给出可操作下一步，不伪报普通进行中', () => {
    const base = {
      core: { confirmed: true },
      results: [{ id: 'res-1', confirmed: true, status: 'planned', tasks: ['task-1'], figures: ['fig-missing'], references: [{ doi: '10.1/x', verified: true }] }],
    }
    const failed = paperProgressOf(base, { tasks: [{ id: 'task-1', status: 'failed' }] }, {}, null).results[0]
    assert.equal(failed.tasks.failed, 1)
    assert.match(failed.nextAction, /诊断并重跑/)
    const completed = paperProgressOf(base, { tasks: [{ id: 'task-1', status: 'completed' }] }, {}, null).results[0]
    assert.equal(completed.figures.missing, 1)
    assert.match(completed.nextAction, /失效图件引用/)
  })

  test('SFL 以独立 dsh 插件入口暴露，不混入角色 skill 克隆目录', () => {
    const snap = skillMenuSnapshot()
    const sfl = snap.integrations.find((x) => x.id === 'scientific-figure-library')
    assert.equal(sfl.kind, 'dsh-plugin')
    assert.match(sfl.installCommand, /dsh plugin --profile web add scientific-figure-library/)
    assert.equal((snap.catalog['figure-expert'] || []).some((x) => x.id === 'scientific-figure-library'), false)
  })
})

// ---------------------------------------------------------------------------
describe('configOf 容错', () => {
  beforeEach(resetState)
  test('无文件 → {}', () => {
    assert.deepEqual(configOf(), {})
  })
  test('合法 JSON → 对象', () => {
    writeConfig({ a: 1 })
    assert.deepEqual(configOf(), { a: 1 })
  })
  test('损坏 JSON → {} 不抛', () => {
    writeFileSync(join(dataDir, 'config.json'), '{bad', 'utf8')
    assert.deepEqual(configOf(), {})
  })
  test('数组/标量 → {}', () => {
    writeFileSync(join(dataDir, 'config.json'), '[1,2]', 'utf8')
    assert.deepEqual(configOf(), {})
  })
  test('blockedGateOf：默认 warn，仅 hard 生效', () => {
    assert.equal(blockedGateOf(), 'warn')
    writeConfig({ blockedGate: 'hard' })
    assert.equal(blockedGateOf(), 'hard')
    writeConfig({ blockedGate: 'bogus' })
    assert.equal(blockedGateOf(), 'warn')
  })
})

// ---------------------------------------------------------------------------
function teamCtx() {
  const tools = {}
  const sent = []
  const ctx = {
    tools: { register: (d) => { tools[d.name] = d } },
    subagents: {
      sendMessage: async (_agent, childId, content) => {
        sent.push({ childId, text: content.map((b) => b.text).join('') })
        return { messageId: 'msg-1' }
      },
    },
  }
  registerTeamTools(ctx, {})
  return { tools, sent, ctx }
}

function seedTeam(tasks = [], members = [{ name: 'analyst', role: 'analyst', childId: 'child-analyst' }]) {
  writeFileSync(join(dataDir, 'team.json'), JSON.stringify({ members, tasks, taskSeq: tasks.length }, null, 2), 'utf8')
  if (!existsSync(join(dataDir, 'blueprint.json'))) {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: { title: 't', claim: 'c', confirmed: true },
      results: [{ id: 'res-1', claim: 'x', confirmed: true, status: 'planned', tasks: [], figures: [] }],
      resultSeq: 1,
    }), 'utf8')
  }
}

const exec = { agent: { id: 'lead-1' } }

describe('blocked_by 闸门（默认软警告，config blockedGate=hard 硬闸门）', () => {
  beforeEach(resetState)

  test('默认 warn：依赖未完成仍派发，输出带未满足依赖清单', async () => {
    seedTeam([{ id: 'task-1', subject: 'dep', status: 'claimed', assignee: 'analyst', blockedBy: [] }])
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute(
      { subject: '后续分析', task_desc: '等 task-1', assignee: 'analyst', blocked_by: ['task-1'], result_id: 'res-1' },
      exec,
    )
    assert.equal(out.ok, true)
    assert.equal(out.dependencyGate.mode, 'warn')
    assert.deepEqual(out.dependencyGate.unresolved.map((u) => u.id), ['task-1'])
    assert.equal(out.dependencyGate.unresolved[0].status, 'claimed')
    const board = JSON.parse(readFileSync(join(dataDir, 'team.json'), 'utf8'))
    assert.equal(board.tasks.length, 2)
  })

  test('hard：依赖未完成拒绝派发，任务板不新增', async () => {
    writeConfig({ blockedGate: 'hard' })
    seedTeam([{ id: 'task-1', subject: 'dep', status: 'claimed', assignee: 'analyst', blockedBy: [] }])
    const { tools } = teamCtx()
    await assert.rejects(
      tools.sci_team_dispatch.execute(
        { subject: '后续分析', task_desc: 'x', assignee: 'analyst', blocked_by: ['task-1'], result_id: 'res-1' },
        exec,
      ),
      /依赖/,
    )
    const board = JSON.parse(readFileSync(join(dataDir, 'team.json'), 'utf8'))
    assert.equal(board.tasks.length, 1)
  })

  test('hard：依赖 completed 正常派发', async () => {
    writeConfig({ blockedGate: 'hard' })
    seedTeam([{ id: 'task-1', subject: 'dep', status: 'completed', assignee: 'analyst', blockedBy: [] }])
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute(
      { subject: '后续分析', task_desc: 'x', assignee: 'analyst', blocked_by: ['task-1'], result_id: 'res-1' },
      exec,
    )
    assert.equal(out.ok, true)
    assert.deepEqual(out.dependencyGate.unresolved, [])
  })

  test('hard：依赖 id 不存在拒绝；warn：记录 missing', async () => {
    seedTeam([])
    writeConfig({ blockedGate: 'hard' })
    const { tools } = teamCtx()
    await assert.rejects(
      tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', blocked_by: ['task-99'], result_id: 'res-1' }, exec),
      /task-99/,
    )
    writeConfig({ blockedGate: 'warn' })
    const out = await tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', blocked_by: ['task-99'], result_id: 'res-1' }, exec)
    assert.equal(out.dependencyGate.unresolved[0].status, 'missing')
  })

  test('无 blocked_by：输出不含 dependencyGate', async () => {
    seedTeam([])
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', result_id: 'res-1' }, exec)
    assert.equal(out.ok, true)
    assert.ok(!('dependencyGate' in out))
  })

  test('共享工作可一次绑定多个已确认 Result，并双向写入任务板与蓝图', async () => {
    seedTeam([])
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: { title: 't', claim: 'c', confirmed: true },
      results: [
        { id: 'res-1', claim: 'x', confirmed: true, status: 'planned', tasks: [], figures: [] },
        { id: 'res-2', claim: 'y', confirmed: true, status: 'planned', tasks: [], figures: [] },
      ],
      resultSeq: 2,
    }), 'utf8')
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute({
      subject: '统一质控', task_desc: '同一套质控服务两个 Result', result_ids: ['res-1', 'res-2'], task_role: 'shared',
    }, exec)
    assert.equal(out.ok, true)
    const team = JSON.parse(readFileSync(join(dataDir, 'team.json'), 'utf8'))
    assert.deepEqual(team.tasks[0].resultIds, ['res-1', 'res-2'])
    assert.equal(team.tasks[0].taskRole, 'shared')
    const bp = loadBlueprint()
    assert.ok(bp.results[0].tasks.includes(out.taskId))
    assert.ok(bp.results[1].tasks.includes(out.taskId))
  })
})

describe('r1-F1：蓝图确认是派单硬闸门', () => {
  beforeEach(resetState)

  const writeBlueprint = (coreConfirmed, resultConfirmed) => writeFileSync(
    join(dataDir, 'blueprint.json'),
    JSON.stringify({
      core: { title: 't', claim: 'core claim', confirmed: coreConfirmed },
      results: [{ id: 'res-1', claim: 'result claim', confirmed: resultConfirmed, status: 'planned', tasks: [], figures: [] }],
      resultSeq: 1,
    }),
    'utf8',
  )

  test('缺 result_id、core 未确认、result 未确认均在建任务前拒绝；完整确认才允许', async () => {
    seedTeam([])
    const { tools } = teamCtx()
    await assert.rejects(
      tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x' }, exec),
      /result_id.*必填|必须.*result/i,
    )
    writeBlueprint(false, true)
    await assert.rejects(
      tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', result_id: 'res-1' }, exec),
      /核心.*未确认|core.*confirmed/i,
    )
    writeBlueprint(true, false)
    await assert.rejects(
      tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', result_id: 'res-1' }, exec),
      /result res-1 尚未确认/,
    )
    writeBlueprint(true, true)
    await assert.rejects(
      tools.sci_team_dispatch.execute(
        { subject: 'x', task_desc: 'x', result_id: 'res-1' },
        { agent: { id: 'child-analyst' } },
      ),
      /只有队长.*派单/,
    )
    const out = await tools.sci_team_dispatch.execute({ subject: 'x', task_desc: 'x', result_id: 'res-1' }, exec)
    assert.equal(out.ok, true)
    assert.equal(JSON.parse(readFileSync(join(dataDir, 'team.json'), 'utf8')).tasks.length, 1)
  })
})

describe('r1-F7：per-result DOI 与 usedAs 工作流', () => {
  beforeEach(resetState)
  test('同 DOI 可分用途共存，规范标题优先，可复核并移除', async () => {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({ core: {}, results: [{ id: 'res-1', claim: 'c', references: [] }], resultSeq: 1 }), 'utf8')
    const tools = {}; registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    const oldFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ message: { title: ['Crossref canonical title'] } }) })
    try {
      await assert.rejects(tools.sci_result_reference_add.execute({ result_id: 'res-1', ref_doi: '10.1/x', used_as: 'wrong' }, {}), /used_as/)
      const method = await tools.sci_result_reference_add.execute({
        result_id: 'res-1', ref_doi: '10.1/X', ref_title: 'wrong title', used_as: 'method',
        claim_ids: ['res-1-claim-1'], relation: 'supports', source_locator: 'Methods, p.4',
      }, {})
      const evidence = await tools.sci_result_reference_add.execute({ result_id: 'res-1', ref_doi: 'https://doi.org/10.1/x', used_as: 'evidence' }, {})
      assert.equal(method.reference.title, 'Crossref canonical title')
      assert.equal(method.reference.providedTitle, 'wrong title')
      assert.deepEqual(method.reference.claimIds, ['res-1-claim-1'])
      assert.equal(method.reference.relation, 'supports')
      assert.equal(method.reference.sourceLocator, 'Methods, p.4')
      assert.equal(evidence.referencesCount, 2)
      const verified = await tools.sci_result_reference_verify.execute({ result_id: 'res-1', ref_doi: '10.1/x', used_as: 'method' }, {})
      assert.equal(verified.ok, true)
      const removed = await tools.sci_result_reference_remove.execute({ result_id: 'res-1', ref_doi: '10.1/x', used_as: 'method' }, {})
      assert.equal(removed.referencesCount, 1)
    } finally { globalThis.fetch = oldFetch }
  })
})

// ---------------------------------------------------------------------------
describe('skillmenu: git clone 进度解析（大仓库克隆反馈）', () => {
  test('空/无进度文本 → null', () => {
    assert.equal(parseGitProgress(''), null)
    assert.equal(parseGitProgress('Cloning into dest...\n'), null)
    assert.equal(parseGitProgress(null), null)
  })

  test('Receiving objects 百分比 + 传输量/速度', () => {
    const p = parseGitProgress('Receiving objects:  45% (556/1234), 12.34 MiB | 2.50 MiB/s\r')
    assert.equal(p.phase, 'Receiving objects')
    assert.equal(p.percent, 45)
    assert.match(p.detail, /12\.34 MiB/)
    assert.match(p.detail, /2\.50 MiB\/s/)
  })

  test('Resolving deltas 100% done', () => {
    const p = parseGitProgress('Resolving deltas: 100% (89/89), done.\n')
    assert.equal(p.phase, 'Resolving deltas')
    assert.equal(p.percent, 100)
  })

  test('remote: 前缀被剥离', () => {
    const p = parseGitProgress('remote: Compressing objects: 100% (567/567), done.\r')
    assert.equal(p.phase, 'Compressing objects')
    assert.equal(p.percent, 100)
  })

  test('Updating files（checkout 阶段）', () => {
    const p = parseGitProgress('Updating files:  73% (803/1100)\r')
    assert.equal(p.phase, 'Updating files')
    assert.equal(p.percent, 73)
  })

  test('\\r 分隔的多段取最后一条进度', () => {
    const text =
      'Receiving objects:  10% (123/1234), 1.00 MiB | 1.00 MiB/s\r' +
      'Receiving objects:  60% (740/1234), 8.00 MiB | 3.00 MiB/s\r' +
      'Receiving objects:  99% (1222/1234), 15.00 MiB | 4.00 MiB/s\r'
    const p = parseGitProgress(text)
    assert.equal(p.percent, 99)
  })

  test('混合阶段取最后一条（Resolving 覆盖 Receiving）', () => {
    const text =
      'Receiving objects: 100% (1234/1234), 16.00 MiB | 4.00 MiB/s, done.\r' +
      'Resolving deltas:  50% (44/89)\r'
    const p = parseGitProgress(text)
    assert.equal(p.phase, 'Resolving deltas')
    assert.equal(p.percent, 50)
  })

  test('formatCloneProgress：null → 占位；有值 → 含阶段与百分比', () => {
    assert.equal(typeof formatCloneProgress(null), 'string')
    const s = formatCloneProgress({ phase: 'Receiving objects', percent: 45, detail: '(556/1234), 12.34 MiB | 2.50 MiB/s' })
    assert.match(s, /Receiving objects/)
    assert.match(s, /45%/)
  })
})

// ---------------------------------------------------------------------------
// 对抗审核 v0.11.0 复核（SHIP-WITH-FIXES）逐条回归
describe('SVG 安全加固（审核 #1/#2/#3/#9）', () => {
  const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/></svg>'

  test('#1 命名空间前缀 <svg:script> 拒绝（原闸门绕过）', () => {
    const svg = '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg:svg>'
    assert.ok(svgActiveContentReason(svg))
    assert.equal(validateImageFile('fig.svg', Buffer.from(svg)).ok, false)
  })
  test('#1 任意命名空间前缀 <x:script> 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('</svg>', '<x:script>alert(1)</x:script></svg>')))
  })
  test('#2 xml-stylesheet 处理指令（XSLT）拒绝', () => {
    const svg = cleanSvg.replace('<svg ', '<?xml-stylesheet type="text/xsl" href="evil.xsl"?><svg ')
    assert.ok(svgActiveContentReason(svg))
    assert.equal(validateImageFile('fig.svg', Buffer.from(svg)).ok, false)
  })
  test('#3 foreignObject+iframe srcdoc 经 &lt;/&gt; 编码仍拒绝', () => {
    const svg = cleanSvg.replace('</svg>', '<foreignObject><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe></foreignObject></svg>')
    assert.ok(svgActiveContentReason(svg))
  })
  test('#3 裸 iframe / embed / object 拒绝', () => {
    for (const tag of ['<iframe src="x"></iframe>', '<embed src="x">', '<object data="x"></object>']) {
      assert.ok(svgActiveContentReason(cleanSvg.replace('</svg>', tag + '</svg>')), tag)
    }
  })
  test('#9 use href data:image/svg+xml 拒绝', () => {
    assert.ok(svgActiveContentReason(cleanSvg.replace('</svg>', '<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/></svg>')))
  })
  test('#9 UTF-16LE 干净 SVG 可登记（可用性）', () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(cleanSvg, 'utf16le')])
    assert.equal(validateImageFile('fig.svg', utf16).ok, true)
  })
  test('#9 UTF-16LE 含 script 仍拒绝（解码后安检不失效）', () => {
    const evil = cleanSvg.replace('</svg>', '<script>alert(1)</script></svg>')
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(evil, 'utf16le')])
    assert.equal(validateImageFile('fig.svg', utf16).ok, false)
  })
  test('不误伤：正文文本含字面 &lt;script&gt;（无 HTML 嵌入上下文）通过', () => {
    const svg = cleanSvg.replace('</svg>', '<text x="0" y="0">&lt;script&gt; 是文本</text></svg>')
    assert.equal(svgActiveContentReason(svg), null)
  })
})

describe('parseFindings 对抗（审核 #4/#5）', () => {
  test('#4 空数组诱饵在前不遮蔽真实 findings', () => {
    assert.deepEqual(parseFindings('{"findings":[]}\n' + findingsJson()), [FINDING])
  })
  test('#4 仅空数组仍合法返回 []', () => {
    assert.deepEqual(parseFindings('{"findings":[]}'), [])
  })
  test('#5 不平衡 prose 花括号 if (x) { 不吞掉 JSON', () => {
    assert.deepEqual(parseFindings('if (x) {  some prose\n' + findingsJson()), [FINDING])
  })
  test('#5 prose 花括号包裹 JSON 仍取内层', () => {
    assert.deepEqual(parseFindings('wrapper { ' + findingsJson() + ' } end'), [FINDING])
  })
})

describe('awaitActivationResult dispose 有界（审核 #6）', () => {
  test('dispose 挂起不阻塞：超时后在宽限内返回', async () => {
    const started = Date.now()
    let disposeCalled = false
    await assert.rejects(
      awaitActivationResult(
        { result: new Promise(() => {}), dispose: () => { disposeCalled = true; return new Promise(() => {}) } },
        30,
        60,
      ),
      /超时/,
    )
    const elapsed = Date.now() - started
    assert.equal(disposeCalled, true)
    assert.ok(elapsed < 1000, `应有界返回，实际 ${elapsed}ms`)
  })
})

describe('config 健壮性（审核 #7/#8）', () => {
  beforeEach(resetState)
  test('#7 blockedGate 大小写/空白不敏感 → hard', () => {
    for (const v of ['HARD', 'Hard', ' hard ', 'hArD']) {
      writeConfig({ blockedGate: v })
      assert.equal(blockedGateOf(), 'hard', `value=${JSON.stringify(v)}`)
    }
  })
  test('#7 blockedGate 非 hard 值 → warn', () => {
    for (const v of ['warn', 'WARN', '', null, true, 1]) {
      writeConfig({ blockedGate: v })
      assert.equal(blockedGateOf(), 'warn', `value=${JSON.stringify(v)}`)
    }
  })
  test('#8 阈值拒绝布尔/十六进制字符串：true→2, 0x10→2', () => {
    writeConfig({ falsificationThreshold: true })
    assert.equal(falsificationThresholdOf(), 2)
    writeConfig({ falsificationThreshold: '0x10' })
    assert.equal(falsificationThresholdOf(), 2)
  })
  test('#8 阈值接受数字与十进制字符串：3→3, "3"→3', () => {
    writeConfig({ falsificationThreshold: 3 })
    assert.equal(falsificationThresholdOf(), 3)
    writeConfig({ falsificationThreshold: '3' })
    assert.equal(falsificationThresholdOf(), 3)
  })
})
// ---------------------------------------------------------------------------
describe('spawn 后新装 skill 自动唤醒（brief 待办 8）', () => {
  beforeEach(resetState)
  const entry = {
    name: 'kdense-eda',
    repo: 'https://github.com/K-Dense-AI/scientific-agent-skills',
    subdir: 'skills/exploratory-data-analysis',
    license: 'MIT',
    dir: join(dataDir, 'role-skills', 'analyst', 'kdense-eda'),
    skills: [{ name: 'eda', relPath: 'SKILL.md' }],
  }

  test('formatSkillWakeText 含技能名/仓库/INDEX/SKILL.md 路径', () => {
    const t = formatSkillWakeText(entry)
    assert.match(t, /kdense-eda/)
    assert.match(t, /K-Dense-AI/)
    assert.match(t, /INDEX\.md/)
    assert.ok(t.includes(join(entry.dir, 'SKILL.md')))
  })
  test('formatSkillWakeText：无 SKILL.md 时给登记目录路径', () => {
    const t = formatSkillWakeText({ ...entry, skills: [], dir: 'D:/x/role-skills/analyst/raw' })
    assert.match(t, /未发现 SKILL\.md/)
    assert.ok(t.includes('D:/x/role-skills/analyst/raw'))
  })

  test('只唤醒同 role 且有 childId 的成员', async () => {
    seedTeam([], [
      { name: 'analyst', role: 'analyst', childId: 'child-analyst' },
      { name: 'writer-1', role: 'writer', childId: 'child-writer' },
      { name: 'analyst-ghost', role: 'analyst' },
    ])
    const { ctx, sent } = teamCtx()
    const r = await wakeRoleMembers(ctx, { id: 'lead-1' }, 'analyst', entry)
    assert.equal(r.targets, 1)
    assert.deepEqual(r.woken, ['analyst'])
    assert.deepEqual(r.failed, [])
    assert.equal(sent.length, 1)
    assert.equal(sent[0].childId, 'child-analyst')
    assert.match(sent[0].text, /kdense-eda/)
  })

  test('无同角色成员 → 不发送，targets=0', async () => {
    seedTeam([], [{ name: 'writer-1', role: 'writer', childId: 'child-writer' }])
    const { ctx, sent } = teamCtx()
    const r = await wakeRoleMembers(ctx, { id: 'lead-1' }, 'analyst', entry)
    assert.equal(r.targets, 0)
    assert.deepEqual(r.woken, [])
    assert.equal(sent.length, 0)
  })

  test('sendMessage 抛错 → failed 记录但不抛', async () => {
    seedTeam([], [{ name: 'analyst', role: 'analyst', childId: 'child-analyst' }])
    const ctx = { tools: { register() {} }, subagents: { sendMessage: async () => { throw new Error('offline') } } }
    const r = await wakeRoleMembers(ctx, { id: 'lead-1' }, 'analyst', entry)
    assert.deepEqual(r.woken, [])
    assert.equal(r.failed.length, 1)
    assert.match(r.failed[0].error, /offline/)
  })

  test('HIGH-1 修复后：任何 sendMessage 异常均视为未送达', async () => {
    seedTeam([], [{ name: 'analyst', role: 'analyst', childId: 'child-analyst' }])
    const ctx = { tools: { register() {} }, subagents: { sendMessage: async () => { throw new Error('throwIfAborted') } } }
    const r = await wakeRoleMembers(ctx, { id: 'lead-1' }, 'analyst', entry)
    assert.deepEqual(r.woken, [])
    assert.equal(r.failed.length, 1)
    assert.match(r.failed[0].error, /throwIfAborted/)
  })
})

// ---------------------------------------------------------------------------
// 对抗审核 v0.11.0 第二轮（BLOCK）逐条回归
describe('SVG 安全加固 第二轮（#1 引号感知 / #4 UTF-16BE / #6 斜杠事件）', () => {
  test('#1 属性值含合法 ">" 时后续 onload 仍被检出', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="a>b" onload="alert(1)"/></svg>'
    assert.ok(svgActiveContentReason(svg))
    assert.equal(validateImageFile('fig.svg', Buffer.from(svg)).ok, false)
  })
  test('#1 属性值含 ">" 时后续 javascript: 仍被检出', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a data-y="a>b" href="javascript:alert(1)"></a></svg>'
    assert.ok(svgActiveContentReason(svg))
  })
  test('#6 /onload 紧邻斜杠仍拒绝', () => {
    assert.ok(svgActiveContentReason('<svg/onload="alert(1)"></svg>'))
  })
  test('#4 UTF-16BE 干净 SVG + 奇数尾字节：按契约返回 ok 且不抛', () => {
    const body = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', 'utf16le').swap16()
    const buf = Buffer.concat([Buffer.from([0xfe, 0xff]), body, Buffer.from([0x00])])
    const r = validateImageFile('fig.svg', buf)
    assert.equal(r.ok, true)
  })
  test('#4 UTF-16BE 含 script 仍拒绝', () => {
    const body = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>', 'utf16le').swap16()
    const buf = Buffer.concat([Buffer.from([0xfe, 0xff]), body])
    assert.equal(validateImageFile('fig.svg', buf).ok, false)
  })
})

describe('parseFindings 第二轮（#2 非空诱饵 / #3 severity 归一 / #5 复杂度）', () => {
  const decoyPass = JSON.stringify({ findings: [{ severity: 'pass', check: 'x', message: 'ok' }] })
  const realFail = JSON.stringify({ findings: [{ severity: 'fail', check: 'y', message: 'REAL' }] })

  test('#2 非空 pass 诱饵在前不遮蔽真实 fail', () => {
    const r = parseFindings(decoyPass + '\n' + realFail)
    assert.equal(r.length, 1)
    assert.equal(r[0].severity, 'fail')
    assert.equal(r[0].message, 'REAL')
  })
  test('#2 两个围栏时优先 fail 集合', () => {
    const r = parseFindings('```json\n' + decoyPass + '\n```\n```json\n' + realFail + '\n```')
    assert.equal(r[0].severity, 'fail')
  })
  test('#3 severity 首尾空白/别名归一', () => {
    const raw = [
      { severity: ' Fail ', message: 'a' },
      { severity: 'critical', message: 'b' },
      { severity: 'ERROR', message: 'c' },
      { severity: 'warning', message: 'd' },
    ]
    assert.deepEqual(parseFindings(findingsJson(raw)).map((x) => x.severity), ['fail', 'fail', 'fail', 'warn'])
  })
  test('#5 大量不平衡花括号不阻塞（O(n) 扫描）', () => {
    const started = Date.now()
    assert.equal(parseFindings('{'.repeat(50000)), null)
    assert.ok(Date.now() - started < 3000, `elapsed ${Date.now() - started}ms`)
  })
})

// ---------------------------------------------------------------------------
// 对抗审核 v0.11.0 第三轮（SHIP-WITH-FIXES）逐条回归
describe('SVG 安全第三轮（属性解析 / 无分号字符引用 / 注释 / style / 线性扫描）', () => {
  const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`

  test('引号紧邻属性：a="b"onload 仍检出', () => {
    assert.equal(svgActiveContentReason('<svg a="b"onload="alert(1)"/>'), '事件属性 onload')
  })
  test('无分号字符引用 &#106avascript: 仍检出', () => {
    const svg = wrap('<a href="&#106avascript:alert(1)">x</a>')
    assert.ok(/可执行 URL/.test(svgActiveContentReason(svg)))
  })
  test('无分号十六进制字符引用 &#x6a;avascript: 仍检出', () => {
    const svg = wrap('<a href="&#x6a;avascript:alert(1)">x</a>')
    assert.ok(/可执行 URL/.test(svgActiveContentReason(svg)))
  })
  test('XML 注释内的标签不误伤', () => {
    assert.equal(svgActiveContentReason(wrap('<!-- <script>alert(1)</script> --><rect width="1" height="1"/>')), null)
  })
  test('未闭合注释仍按可执行内容拒绝（fail-closed）', () => {
    assert.ok(svgActiveContentReason(wrap('<!-- <script>x</script>')))
  })
  test('style 内 javascript: 检出', () => {
    assert.ok(/样式表/.test(svgActiveContentReason(wrap('<style>.a{background:url(javascript:alert(1))}</style>'))))
  })
  test('普通 style（http 背景）不误伤', () => {
    assert.equal(svgActiveContentReason(wrap('<style>.a{fill:#fff}</style>')), null)
  })
  test('title="onload=x" 不误判为事件属性', () => {
    assert.equal(svgActiveContentReason(wrap('<rect title="onload=x" width="1" height="1"/>')), null)
  })
  test('data-onclick 不误判', () => {
    assert.equal(svgActiveContentReason(wrap('<rect data-onclick="x" width="1" height="1"/>')), null)
  })
  test('<svg/onload> 紧邻斜杠仍检出', () => {
    assert.equal(svgActiveContentReason('<svg/onload="alert(1)"/>'), '事件属性 onload')
  })
  test('大量 "<a" 无闭合：线性扫描不阻塞', () => {
    const started = Date.now()
    assert.equal(svgActiveContentReason('<a'.repeat(40000)), null)
    assert.ok(Date.now() - started < 1000, `elapsed ${Date.now() - started}ms`)
  })
  test('decodeSvgText：UTF-16LE/BE BOM 与 UTF-8', () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<svg>中文</svg>', 'utf16le')])
    assert.equal(decodeSvgText(le), '<svg>中文</svg>')
    const beBody = Buffer.from('<svg>中文</svg>', 'utf16le').swap16()
    const be = Buffer.concat([Buffer.from([0xfe, 0xff]), beBody])
    assert.equal(decodeSvgText(be), '<svg>中文</svg>')
    assert.equal(decodeSvgText(Buffer.from('<svg>utf8</svg>')), '<svg>utf8</svg>')
  })
})

describe('parseFindings 第三轮（垃圾数组 / 缺失 severity / span 上限）', () => {
  const real = { severity: 'fail', check: 'number-traceability', message: '数字无出处' }

  test('垃圾数组（无 message/claim）不遮蔽真实 findings', () => {
    const text = '样本: ' + JSON.stringify([
      { severity: 'fail', note: 'x' }, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 },
    ]) + '\n' + JSON.stringify({ findings: [real] })
    assert.deepEqual(parseFindings(text), [real])
  })
  test('缺失 severity → fail（fail-closed，不静默降级 warn）', () => {
    const r = parseFindings(findingsJson([{ check: 'fabrication', message: '伪造' }]))
    assert.equal(r[0].severity, 'fail')
  })
  test('未知 severity（blocker）→ fail', () => {
    const r = parseFindings(findingsJson([{ severity: 'blocker', check: 'x', message: 'm' }]))
    assert.equal(r[0].severity, 'fail')
  })
  test('超大 findings 数组截断到上限（防灌水）', () => {
    const huge = JSON.stringify({ findings: Array.from({ length: 4001 }, (_, i) => ({ severity: 'warn', check: 'x', message: `m${i}` })) })
    const r = parseFindings(huge)
    assert.ok(r.length <= 200, `length=${r.length}`)
  })
  test('span 上限耗尽且无其它候选 → null（不得以 [] 静默清白）', () => {
    const text = '{"findings":[]} '.repeat(1200) + JSON.stringify({ findings: [real] })
    assert.equal(parseFindings(text), null)
  })
})

describe('team 唤醒错误分类（第三轮）', () => {
  test('普通 aborted 错误不再视为送达', async () => {
    seedTeam([], [{ name: 'analyst', role: 'analyst', childId: 'child-analyst' }])
    const ctx = { tools: { register() {} }, subagents: { sendMessage: async () => { throw new Error('operation aborted') } } }
    const r = await wakeRoleMembers(ctx, { id: 'lead-1' }, 'analyst', { name: 'x', repo: 'r', skills: [], dir: 'd' })
    assert.deepEqual(r.woken, [])
    assert.equal(r.failed.length, 1)
  })
})

describe('DAG 依赖闭包（第四轮：依赖聚焦）', () => {
  const T = (id, deps = []) => ({ id, status: 'pending', blockedBy: deps })

  test('链式 A→B→C：中间节点同时看到上游与下游', () => {
    const tasks = [T('A'), T('B', ['A']), T('C', ['B'])]
    const c = dependencyClosure('B', tasks)
    assert.deepEqual(c.upstream, ['A'])
    assert.deepEqual(c.downstream, ['C'])
    assert.deepEqual([...c.related].sort(), ['A', 'B', 'C'])
  })
  test('菱形：D 看到全部上游，A 看到全部下游', () => {
    const tasks = [T('A'), T('B', ['A']), T('C', ['A']), T('D', ['B', 'C'])]
    assert.deepEqual([...dependencyClosure('D', tasks).upstream].sort(), ['A', 'B', 'C'])
    assert.deepEqual([...dependencyClosure('A', tasks).downstream].sort(), ['B', 'C', 'D'])
    assert.deepEqual([...dependencyClosure('D', tasks).related].sort(), ['A', 'B', 'C', 'D'])
  })
  test('环不挂死且去重', () => {
    const tasks = [T('A', ['B']), T('B', ['A'])]
    const c = dependencyClosure('A', tasks)
    assert.deepEqual([...c.related].sort(), ['A', 'B'])
  })
  test('缺失依赖忽略，不影响闭包', () => {
    const tasks = [T('A', ['ghost']), T('B', ['A'])]
    const c = dependencyClosure('A', tasks)
    assert.deepEqual(c.upstream, [])
    assert.deepEqual(c.downstream, ['B'])
  })
  test('未知起点返回空闭包', () => {
    const c = dependencyClosure('nope', [T('A')])
    assert.deepEqual([...c.related], [])
  })
  test('任务不存在时去掉自环，不把自身算作依赖/下游', () => {
    const tasks = [T('A', ['A'])]
    const c = dependencyClosure('A', tasks)
    assert.deepEqual(c.upstream, [])
    assert.deepEqual(c.downstream, [])
    assert.deepEqual([...c.related], ['A'])
  })
  test('blockedBy 归一：去空/非字符串/重复，保持顺序', () => {
    assert.deepEqual(normalizedBlockedBy({ blockedBy: ['b', '', null, 'a', 'b', 3, ' a '] }), ['b', 'a'])
    assert.deepEqual(normalizedBlockedBy({}), [])
    assert.deepEqual(normalizedBlockedBy(null), [])
  })
})

// ---------------------------------------------------------------------------
describe('第四轮审核修复：malformed 状态与客户端安全归一', () => {
  beforeEach(resetState)

  test('sanitizeTeamState：剔除 null/标量成员与任务，归一 blockedBy', () => {
    const s = sanitizeTeamState({
      members: [null, 'x', { name: 'a', role: 'analyst' }],
      tasks: [null, 'x', { id: 'task-1', blockedBy: 'task-2' }, { id: 'task-2', blockedBy: ['task-1', 'task-1', null] }],
      taskSeq: 'oops',
    })
    assert.equal(s.members.length, 1)
    assert.equal(s.tasks.length, 2)
    assert.deepEqual(s.tasks[0].blockedBy, [])
    assert.deepEqual(s.tasks[1].blockedBy, ['task-1'])
    assert.equal(s.taskSeq, 0)
    assert.deepEqual(sanitizeTeamState(null), { members: [], tasks: [], taskSeq: 0 })
  })

  test('loadBlueprint：results 中的 null/标量条目被剔除，不污染 /state 与导出', () => {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: { claim: 'c' },
      results: [null, 'x', { id: 'res-1', claim: 'ok', tasks: null }],
      resultSeq: 1,
    }), 'utf8')
    const bp = loadBlueprint()
    assert.deepEqual(bp.results.map((r) => r.id), ['res-1'])
    assert.deepEqual(coverageOf(bp, { tasks: [] }, {}).resultsWithoutTasks, ['res-1'])
  })

  test('normalizeTaskBoard：非数组 blockedBy / null 任务不崩溃，闭包仍可用', () => {
    const tasks = normalizeTaskBoard([
      null, 'x',
      { id: 'task-1', blockedBy: 'task-2' },
      { id: 'task-2', blockedBy: ['task-1', 'task-1'] },
    ])
    assert.deepEqual(tasks.map((t) => t.id), ['task-1', 'task-2'])
    assert.deepEqual(tasks[0].blockedBy, [])
    const c = dependencyClosure('task-1', tasks)
    assert.deepEqual([...c.related].sort(), ['task-1', 'task-2'])
  })

  test('hard 闸门：failed/cancelled 依赖视为终态，不再永久卡死下游', async () => {
    writeConfig({ blockedGate: 'hard' })
    seedTeam([
      { id: 'task-1', subject: 'dep', status: 'failed', assignee: 'analyst', blockedBy: [] },
      { id: 'task-2', subject: 'dep2', status: 'cancelled', assignee: 'analyst', blockedBy: [] },
    ])
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute(
      { subject: '后续', task_desc: 'x', assignee: 'analyst', blocked_by: ['task-1', 'task-2'], result_id: 'res-1' },
      exec,
    )
    assert.equal(out.ok, true)
    assert.deepEqual(out.dependencyGate.unresolved, [])
  })

  test('/state：team/blueprint 夹带 null 条目仍返回 200 且数据可用（H2）', async () => {
    writeFileSync(join(dataDir, 'team.json'), JSON.stringify({
      members: [null, { name: 'analyst', role: 'analyst', childId: null }],
      tasks: [null, 'x', { id: 'task-1', subject: 't', status: 'pending', blockedBy: null }],
    }), 'utf8')
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: { claim: 'c' },
      results: [null, { id: 'res-1', claim: 'ok', tasks: ['task-1'], figures: [] }],
    }), 'utf8')
    writeFileSync(join(dataDir, 'figure-plans.json'), JSON.stringify({
      'figplan-1': { id: 'figplan-1', title: '验证图', resultId: 'res-1', status: 'planned', updatedAt: 2 },
    }), 'utf8')
    let handler = null
    const server = { register: (def) => { if (def.path === '/plugins/dsh-science/state') handler = def.handler; return () => {} } }
    const ctx = { get: (k) => (k === 'webServer' ? server : undefined), effect: (fn) => fn(), tools: { register() {} } }
    registerStateRoute(ctx)
    assert.ok(handler, 'state handler registered')
    let status = 0
    let body = ''
    const res = { writeHead: (code) => { status = code }, end: (b) => { body = String(b) } }
    await handler({ url: '/plugins/dsh-science/state', headers: {} }, res)
    assert.equal(status, 200, body)
    const payload = JSON.parse(body)
    assert.deepEqual(payload.team.members.map((m) => m.name), ['analyst'])
    assert.deepEqual(payload.team.tasks.map((t) => t.id), ['task-1'])
    assert.deepEqual(payload.team.tasks[0].blockedBy, [])
    assert.deepEqual(payload.blueprint.results.map((r) => r.id), ['res-1'])
    assert.equal(payload.blueprint.paperProgress.results[0].tasks.total, 1)
    assert.equal(payload.blueprint.paperProgress.results[0].nextAction, '先向用户复述并确认该 Result，确认前不能派发执行任务。')
    assert.deepEqual(payload.figurePlans.map((p) => p.id), ['figplan-1'])
  })
})

describe('r1-F2：HTTP 状态与文件路由不泄漏凭据', () => {
  beforeEach(resetState)
  test('敏感 profile 文件返回 404，状态 URL 去除内嵌认证信息', async () => {
    writeFileSync(join(dataDir, 'db-profiles.json'), JSON.stringify({ pg: { kind: 'postgres', url: 'postgres://alice:secret@db.local/x', password: 'secret2' } }), 'utf8')
    writeFileSync(join(dataDir, 'ssh-profiles.json'), JSON.stringify({ h: { host: 'h', username: 'u', password: 'secret3' } }), 'utf8')
    const handlers = {}
    const server = { register: (def) => { handlers[def.path] = def.handler; return () => {} } }
    registerStateRoute({ get: (k) => (k === 'webServer' ? server : undefined), effect: (fn) => fn(), tools: { register() {} } })
    const call = async (path) => {
      let status = 0; let body = ''
      const res = { writeHead: (code) => { status = code }, end: (b) => { body = String(b || '') } }
      await handlers[path.split('?')[0]]({ url: path, headers: {} }, res)
      return { status, body }
    }
    const file = await call(`/plugins/dsh-science/file?path=${encodeURIComponent(join(dataDir, 'ssh-profiles.json'))}`)
    assert.equal(file.status, 404)
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const state = await call('/plugins/dsh-science/state')
    assert.equal(state.status, 200)
    assert.ok(!state.body.includes('secret'))
    assert.ok(!state.body.includes('alice'))
  })
})

describe('第四轮审核修复：parseFindings 保留 fail / span 长度上限', () => {
  test('205 条 pass 后的 fail 不被截断丢失', () => {
    const arr = Array.from({ length: 205 }, (_, i) => ({ severity: 'pass', check: 'x', message: `p${i}` }))
    arr.push({ severity: 'fail', check: 'fabrication', message: 'results were fabricated' })
    const r = parseFindings(JSON.stringify({ findings: arr }))
    assert.ok(r.some((f) => f.severity === 'fail'), 'fail 必须保留')
    assert.ok(r.length <= 200)
  })
  test('超大嵌套输入不做无意义切片（2MB 内完成且返回 null）', () => {
    const text = '['.repeat(2 * 1024 * 1024)
    const t0 = performance.now()
    const r = parseFindings(text)
    const ms = performance.now() - t0
    assert.equal(r, null)
    assert.ok(ms < 1000, `elapsed ${ms}ms`)
  })
})

describe('第四轮审核修复：SVG 命名空间事件 / CSS 转义 / 无 BOM UTF-16', () => {
  const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:ev="http://www.w3.org/2001/xml-events">${body}</svg>`
  test('ev:onload 命名空间事件属性拒绝', () => {
    const svg = '<svg xmlns:ev="http://www.w3.org/2001/xml-events" ev:onload="alert(1)"/>'
    assert.ok(svgActiveContentReason(svg), 'ev:onload 必须拒绝')
  })
  test('CSS 十六进制转义 javascript: 拒绝', () => {
    const svg = wrap('<style>a{background:url(\\6a avascript:alert(1))}</style>')
    assert.ok(svgActiveContentReason(svg), 'CSS 转义 URL 必须拒绝')
  })
  test('无 BOM UTF-16LE 的 script 被解码并拒绝', () => {
    const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf16le')
    assert.equal(buf[0], 0x3c)
    const r = validateImageFile('x.svg', buf)
    assert.equal(r.ok, false)
    assert.ok(svgActiveContentReason(decodeSvgText(buf)))
  })
})

describe('第五轮：审查摘要与详情懒加载', () => {
  test('reviewSummariesOf：剥离 findings/raw，counts 正确，按完成时间倒序', () => {
    const raw = {
      'rev-a': {
        id: 'rev-a', status: 'done', turn: 3, trigger: 'review',
        findings: [{ severity: 'fail' }, { severity: 'warn' }, { severity: 'pass' }, { severity: 'pass' }],
        startedAt: 100, finishedAt: 2_000_000_000_000, raw: 'x'.repeat(100),
      },
      'rev-b': {
        status: 'parse-failed', findings: [null, { severity: 'warn' }],
        startedAt: '2026-01-01T00:00:00Z', finishedAt: '2026-01-01T00:00:01Z',
      },
    }
    const s = reviewSummariesOf(raw)
    assert.deepEqual(s.map((x) => x.id), ['rev-a', 'rev-b'])
    assert.ok(!('findings' in s[0]), '摘要不含 findings')
    assert.ok(!('raw' in s[0]), '摘要不含 raw')
    assert.deepEqual(s[0].counts, { fail: 1, warn: 1, pass: 2, total: 4 })
    assert.deepEqual(s[1].counts, { fail: 0, warn: 1, pass: 0, total: 1 })
    assert.equal(s[1].id, 'rev-b', '缺 id 时用对象键')
    assert.equal(s[1].finishedAt, Date.parse('2026-01-01T00:00:01Z'), 'ISO 时间归一为毫秒')
  })

  test('reviewSummariesOf：数组形态与脏条目', () => {
    const s = reviewSummariesOf([null, 5, { id: 'r1', findings: [], finishedAt: 1 }])
    assert.equal(s.length, 1)
    assert.deepEqual(s[0].counts, { fail: 0, warn: 0, pass: 0, total: 0 })
    assert.deepEqual(reviewSummariesOf(null), [])
  })

  test('严重度别名与 reviewcov 同口径；数字字符串时间按毫秒', () => {
    const s = reviewSummariesOf({
      r: {
        id: 'r', finishedAt: '1700000000000',
        findings: [{ severity: 'critical' }, { severity: 'FAIL' }, { severity: 'ok' }, { severity: 'medium' }],
      },
    })
    assert.deepEqual(s[0].counts, { fail: 2, warn: 1, pass: 1, total: 4 })
    assert.equal(s[0].finishedAt, 1700000000000)
  })

  test('重复 id / 非字符串 id：摘要 id 唯一，详情仍可取到对应 run', () => {
    const raw = {
      k1: { id: 'dup', findings: [{ severity: 'fail', message: 'one' }] },
      k2: { id: 'dup', findings: [{ severity: 'pass', message: 'two' }] },
      k3: { id: { nested: 1 }, findings: [] },
    }
    const s = reviewSummariesOf(raw)
    assert.equal(s.length, 3)
    assert.equal(new Set(s.map((x) => x.id)).size, 3, 'id 必须唯一')
    assert.equal(reviewRunOf(raw, s[1].id).findings[0].message, 'two')
    assert.equal(reviewRunOf(raw, 'k2').findings[0].message, 'two', '对象键仍可直接取详情')
    const nonString = s.find((x) => x.id !== 'dup' && !x.id.startsWith('dup~'))
    assert.equal(nonString.id, 'k3')
    assert.deepEqual(reviewRunOf(raw, 'k3').findings, [])
  })

  test('reviewRunOf：命中返回完整 findings，剔除 raw 与密码类键', () => {    const raw = {
      'rev-a': {
        id: 'rev-a',
        findings: [{ severity: 'fail', message: 'm' }],
        raw: 'SECRET',
        password: 'x',
        meta: { password: 'y', ok: 1 },
      },
    }
    const run = reviewRunOf(raw, 'rev-a')
    assert.equal(run.id, 'rev-a')
    assert.equal(run.raw, undefined)
    assert.equal(run.password, undefined)
    assert.equal(run.meta.password, undefined)
    assert.equal(run.meta.ok, 1)
    assert.equal(run.findings.length, 1)
    assert.equal(reviewRunOf(raw, 'nope'), null)
    assert.equal(reviewRunOf(raw, ''), null)
  })

  test('/state 的 reviews 只含摘要；/review 路由按需返回详情', async () => {
    resetState()
    writeFileSync(join(dataDir, 'reviews.json'), JSON.stringify({
      'rev-1': {
        id: 'rev-1', status: 'done', turn: 2, startedAt: 10, finishedAt: 20,
        findings: [{ severity: 'fail', check: 'x', message: 'bad' }],
        raw: 'RAW-TEXT',
      },
    }), 'utf8')
    const handlers = {}
    const server = {
      register: (def) => {
        if (def.path.startsWith('/plugins/dsh-science/')) handlers[def.path] = def.handler
        return () => {}
      },
    }
    const ctx = { get: (k) => (k === 'webServer' ? server : undefined), effect: (fn) => fn(), tools: { register() {} } }
    registerStateRoute(ctx)
    // /state 有 1s 模块级缓存（多标签轮询去重）；等过窗口避免读到上个用例的快照。
    await new Promise((r) => setTimeout(r, 1100))
    const call = async (path) => {
      let status = 0
      let body = ''
      const res = { writeHead: (code, headers) => { status = code; res.headers = headers }, end: (b) => { body = String(b) } }
      await handlers[path.split('?')[0]]({ url: path, headers: {} }, res)
      return { status, body, headers: res.headers }
    }
    const state = await call('/plugins/dsh-science/state')
    assert.equal(state.status, 200)
    const payload = JSON.parse(state.body)
    assert.equal(payload.reviews.length, 1)
    assert.equal(payload.reviews[0].counts.fail, 1)
    assert.ok(!('findings' in payload.reviews[0]))
    assert.ok(!('raw' in payload.reviews[0]))
    assert.ok(!state.body.includes('RAW-TEXT'))

    const ok = await call('/plugins/dsh-science/review?run=rev-1')
    assert.equal(ok.status, 200)
    const detail = JSON.parse(ok.body)
    assert.equal(detail.run.findings[0].message, 'bad')
    assert.ok(!('raw' in detail.run))

    assert.equal((await call('/plugins/dsh-science/review?run=missing')).status, 404)
    const missing = await call('/plugins/dsh-science/review')
    assert.equal(missing.status, 400)
  })

  test('/review 鉴权：会话栅栏拒绝时不返回详情', async () => {
    const handlers = {}
    const server = {
      register: (def) => {
        if (def.path === '/plugins/dsh-science/review') handlers.review = def.handler
        return () => {}
      },
    }
    const ctx = {
      get: (k) => (k === 'webServer' ? server : k === 'connection' ? { requestRejection: () => 401 } : undefined),
      effect: (fn) => fn(),
      tools: { register() {} },
    }
    registerStateRoute(ctx)
    let status = 0
    let body = ''
    const res = { writeHead: (code) => { status = code }, end: (b) => { body = String(b) } }
    await handlers.review({ url: '/plugins/dsh-science/review?run=rev-1', headers: {} }, res)
    assert.equal(status, 401)
    assert.ok(!body.includes('findings'))
  })
})

describe('第六轮：/sci-status 实时体检', () => {
  const base = (over = {}) => ({
    version: '0.11.0',
    dataDir: 'D:/data',
    workspaceRoot: 'D:/ws',
    blueprint: { core: {}, results: [] },
    blueprintError: null,
    team: { members: [], tasks: [] },
    reviews: {},
    figures: {},
    dbProfiles: {},
    sshProfiles: {},
    sshJobs: {},
    config: { blockedGate: 'warn', falsificationThreshold: 2 },
    ...over,
  })

  test('空状态：零计数 + 首次使用三步，不再输出静态功能清单', () => {
    const text = statusReportOf(base()).lines.join('\n')
    assert.match(text, /dsh-science 0\.11\.0 · 数据 D:\/data · 工作区 D:\/ws/)
    assert.match(text, /团队 {2}0 成员 · 任务 0（完成 0）/)
    assert.match(text, /蓝图 {2}未开始/)
    assert.match(text, /审查 {2}0 次/)
    assert.match(text, /资产 {2}图表 0 · DB 0 · SSH 0 \/ 作业 0/)
    assert.match(text, /首次使用：sci_blueprint_set/)
    assert.ok(!/已实现|✓/.test(text), '不再输出静态功能清单')
  })

  test('有数据：真实计数、审查 fail/warn 汇总、配置与下一步', () => {
    const text = statusReportOf(base({
      blueprint: {
        core: { claim: 'c', confirmed: true },
        results: [{ id: 'res-1', confirmed: true, status: 'supported' }, { id: 'res-2', confirmed: false, status: 'planned' }],
      },
      team: {
        members: [{ name: 'a' }, { name: 'b' }],
        tasks: [{ id: 'task-1', status: 'completed' }, { id: 'task-2', status: 'claimed' }, { id: 'task-3', status: 'pending' }],
      },
      reviews: {
        r1: { finishedAt: 1700000000000, findings: [{ severity: 'fail' }, { severity: 'critical' }, { severity: 'pass' }] },
        r2: { finishedAt: 1600000000000, findings: [{ severity: 'warn' }] },
      },
      figures: { f1: {}, f2: {} },
      dbProfiles: { d1: {} },
      sshProfiles: { s1: {} },
      sshJobs: { j1: {}, j2: {} },
      config: { blockedGate: 'hard', falsificationThreshold: 3 },
    })).lines.join('\n')
    assert.match(text, /团队 {2}2 成员 · 任务 3（完成 1）/)
    assert.match(text, /蓝图 {2}核心已定 · 2 结果（已确认 1）/)
    assert.match(text, /审查 {2}2 次 · fail 2 \/ warn 1 · 最近 2023-11-14 22:13/)
    assert.match(text, /资产 {2}图表 2 · DB 1 · SSH 1 \/ 作业 2/)
    assert.match(text, /配置 {2}依赖闸门 hard · 证伪阈值 3/)
    assert.match(text, /下一步：\/sci-polish 或 sci_blueprint_export/)
  })

  test('蓝图损坏：显示隔离提示但仍给出计数', () => {
    const text = statusReportOf(base({ blueprintError: 'blueprint.json 解析失败（已隔离）' })).lines.join('\n')
    assert.match(text, /蓝图 {2}未开始 · blueprint\.json 解析失败/)
  })

  test('sci_team_status 输出可 JSON 往返（缺字段不产生 undefined）', async () => {
    resetState()
    seedTeam([{ id: 'task-1' }], [{ name: 'm' }])
    const { tools } = teamCtx()
    const out = await tools.sci_team_status.execute({}, exec)
    assert.deepEqual(JSON.parse(JSON.stringify(out)), out)
    assert.equal(out.members[0].role, '')
    assert.equal(out.tasks[0].status, 'pending')
    assert.equal(out.tasks[0].assignee, null)
    assert.deepEqual(out.tasks[0].blockedBy, [])
  })

  test('脏条目与数组形态不抛错', () => {    const text = statusReportOf(base({
      team: { members: [null, 5, { name: 'ok' }], tasks: [null, 'x', { id: 'task-1', status: 'weird' }] },
      reviews: [null, { findings: 'nope' }, { findings: [{ severity: 7 }] }],
      figures: [null, {}],
      dbProfiles: [1, {}],
      sshProfiles: null,
      sshJobs: undefined,
    })).lines.join('\n')
    assert.match(text, /团队 {2}1 成员 · 任务 1（完成 0）/)
    assert.match(text, /审查 {2}2 次 · fail 0 \/ warn 1/)
  })

  test('越界时间戳不抛 RangeError，标记时间异常', () => {
    const text = statusReportOf(base({
      reviews: { r1: { status: 'done', finishedAt: 1e20, findings: [] } },
    })).lines.join('\n')
    assert.match(text, /审查 {2}1 次 · fail 0 \/ warn 0 · 最近 时间异常/)
  })

  test('解析失败的审查单独计数，不伪装成 0 问题', () => {
    const report = statusReportOf(base({
      reviews: {
        r1: { status: 'done', finishedAt: 1700000000000, findings: [{ severity: 'pass' }] },
        r2: { status: 'parse-failed', finishedAt: 1600000000000, findings: null },
      },
    }))
    assert.equal(report.counts.reviewAbnormal, 1)
    assert.match(report.lines.join('\n'), /审查 {2}2 次 · fail 0 \/ warn 0 · 异常 1/)
  })

  test('配置按运行期规则归一（大小写/数字字符串）', () => {
    const text = statusReportOf(base({ config: { blockedGate: 'HARD', falsificationThreshold: '3' } })).lines.join('\n')
    assert.match(text, /配置 {2}依赖闸门 hard · 证伪阈值 3/)
    const bad = statusReportOf(base({ config: { blockedGate: 'x', falsificationThreshold: 0 } })).lines.join('\n')
    assert.match(bad, /配置 {2}依赖闸门 warn · 证伪阈值 2/)
  })

  test('截断不劈开代理对', () => {
    const report = statusReportOf(base({ blueprintError: 'e'.repeat(79) + '😀😀' }))
    const line = report.lines.find((l) => l.startsWith('蓝图'))
    assert.ok(line.endsWith('…'))
    const lone = [...line].some((ch) => {
      const c = ch.codePointAt(0)
      return c >= 0xd800 && c <= 0xdfff
    })
    assert.equal(lone, false)
  })

  test('状态文件损坏数显示在配置行', () => {
    const text = statusReportOf(base({ stateErrors: ['team.json', 'figures.json'] })).lines.join('\n')
    assert.match(text, /配置 {2}依赖闸门 warn · 证伪阈值 2 · 2 个状态文件无法解析/)
  })
})

describe('第六轮补：/sci-status 命令接线与容错', () => {
  beforeEach(resetState)

  async function invokeStatus() {
    const commands = {}
    const ctx = {
      tools: { register() {} },
      commands: { register: (def) => { commands[def.name] = def } },
      skills: { registerProvider() {} },
      on() {},
      effect(fn) { try { fn() } catch {} },
      get() { return undefined },
      subagents: {},
      sessions: {},
      agents: {},
      workingDirectory: {},
    }
    apply(ctx)
    assert.ok(commands['sci-status'], 'sci-status 命令已注册')
    return commands['sci-status'].handler()
  }

  test('handler 读真实状态文件并返回 success', async () => {
    seedTeam([{ id: 'task-1', subject: 'x', status: 'completed' }], [])
    const out = await invokeStatus()
    assert.equal(out.kind, 'success')
    assert.match(out.text, /团队 {2}0 成员 · 任务 1（完成 1）/)
    assert.match(out.text, /配置 {2}依赖闸门/)
  })

  test('损坏的 team/figures 被计数而不是静默当成空', async () => {
    writeFileSync(join(dataDir, 'team.json'), '{oops', 'utf8')
    writeFileSync(join(dataDir, 'figures.json'), 'nope', 'utf8')
    const out = await invokeStatus()
    assert.equal(out.kind, 'success')
    assert.match(out.text, /2 个状态文件无法解析/)
  })

  test('状态目录不可用时返回 error 而非抛异常', async () => {
    const badRoot = mkdtempSync(join(tmpdir(), 'dsh-science-badhome-'))
    const badHome = join(badRoot, 'not-a-dir')
    writeFileSync(badHome, 'x', 'utf8')
    const old = process.env.DSH_HOME
    process.env.DSH_HOME = badHome
    try {
      const out = await invokeStatus()
      assert.equal(out.kind, 'error')
      assert.match(out.text, /状态读取失败/)
    } finally {
      process.env.DSH_HOME = old
      rmSync(badRoot, { recursive: true, force: true })
    }
  })

  test('派发时遗留任务缺 status 仍可 JSON 往返', async () => {
    resetState()
    seedTeam([{ id: 'task-1', subject: 'legacy', blockedBy: [] }], [])
    const { tools } = teamCtx()
    const out = await tools.sci_team_dispatch.execute(
      { subject: 'downstream', task_desc: 'needs task-1', blocked_by: ['task-1'], result_id: 'res-1' },
      exec,
    )
    assert.deepEqual(JSON.parse(JSON.stringify(out)), out)
    assert.equal(out.dependencyGate.unresolved[0].status, 'unknown')
  })
})

describe('第七轮：空白状态文案不虚报完整', () => {
  beforeEach(resetState)

  test('coverageOf 空蓝图 total=0 且无警告', () => {
    const cov = coverageOf(loadBlueprint(), { tasks: [] }, {})
    assert.equal(cov.total, 0)
    assert.deepEqual(cov.warnings, [])
  })

  test('空蓝图导出不写「覆盖完整」', async () => {
    const tools = {}
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-export-'))
    try {
      registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } }, workingDirectory: { get: () => cwd } }, {})
      const out = await tools.sci_blueprint_export.execute({}, { agent: { session: {} } })
      assert.equal(out.resultCount, 0)
      assert.equal(out.coverageStarted, false)
      const md = readFileSync(join(cwd, 'research', 'blueprint-report.md'), 'utf8')
      assert.match(md, /尚无 result/)
      assert.match(md, /论文视角摘要待建立/)
      assert.match(md, /尚无带 claim 的主张/)
      assert.ok(!md.includes('覆盖完整'))
      assert.ok(!md.includes('已审 0/0'))
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  test('negative 仍进入证据链，只有 excluded/dropped 才退出', async () => {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: { claim: 'c', confirmed: true },
      results: [{ id: 'res-1', status: 'negative', claim: 'x', tasks: [], figures: [] }],
    }), 'utf8')
    const cov = coverageOf(loadBlueprint(), { tasks: [] }, {})
    assert.equal(cov.total, 1)
    assert.equal(cov.supportedCount, 0)
    assert.ok(cov.warnings.some((w) => /res-1 无任务/.test(w)))
    assert.ok(cov.warnings.some((w) => /尚未决定呈现方式/.test(w)))
    const tools = {}
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-export-neg-'))
    try {
      registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } }, workingDirectory: { get: () => cwd } }, {})
      await tools.sci_blueprint_export.execute({}, { agent: { session: {} } })
      const md = readFileSync(join(cwd, 'research', 'blueprint-report.md'), 'utf8')
      assert.doesNotMatch(md, /negative.*已退出支撑链/)
      assert.ok(!md.includes('覆盖完整'))
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})

describe('第八轮：工具返回 ok 契约（headless 矩阵发现）', () => {
  beforeEach(resetState)

  test('alignTaskToResult 返回 ok=true', () => {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: {},
      results: [{ id: 'res-1', status: 'supported', tasks: [], figures: [] }],
    }), 'utf8')
    writeFileSync(join(dataDir, 'team.json'), JSON.stringify({
      members: [],
      tasks: [{ id: 'task-1', status: 'pending', resultId: null }],
    }), 'utf8')
    const out = alignTaskToResult('task-1', 'res-1', {})
    assert.equal(out.ok, true)
    assert.deepEqual(out.resultTasks, ['task-1'])
  })

  test('linkFigureToResult 返回 ok=true', () => {
    writeFileSync(join(dataDir, 'blueprint.json'), JSON.stringify({
      core: {},
      results: [{ id: 'res-1', status: 'supported', tasks: [], figures: [] }],
    }), 'utf8')
    writeFileSync(join(dataDir, 'figures.json'), JSON.stringify({
      'fig-1': { id: 'fig-1', path: 'x.png', title: 't' },
    }), 'utf8')
    const out = linkFigureToResult('fig-1', 'res-1', {})
    assert.equal(out.ok, true)
    assert.deepEqual(out.resultFigures, ['fig-1'])
  })

  test('sqlite 查询/表列表成功时带 ok=true', async () => {
    writeFileSync(join(dataDir, 'db-profiles.json'), JSON.stringify({
      demo: { kind: 'sqlite', path: join(dataDir, 'ok-contract.db') },
    }), 'utf8')
    const tools = {}
    registerDbTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    const tables = await tools.sci_db_tables.execute({ profile: 'demo' }, {})
    assert.equal(tables.ok, true)
    const q = await tools.sci_db_query.execute({ profile: 'demo', sql: 'select 1 as ok' }, {})
    assert.equal(q.ok, true)
    assert.equal(q.rows[0].ok, 1)
  })

  test('数据库只读入口拒绝有副作用 SELECT，profile 不落明文密码', async () => {
    const tools = {}
    registerDbTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    await assert.rejects(
      tools.sci_db_query.execute({ profile: 'missing', sql: "SELECT 1 INTO OUTFILE '/tmp/leak'" }, {}),
      /只读守卫/,
    )
    await assert.rejects(
      tools.sci_db_profiles.execute({ action: 'add', name: 'pg', profile: { kind: 'postgres', host: 'db', user: 'u', password: 'secret' } }, {}),
      /拒绝把数据库密码写入文件/,
    )
    assert.equal(existsSync(join(dataDir, 'db-profiles.json')), false)
  })

  test('ssh profile list 返回 ok=true', async () => {
    writeFileSync(join(dataDir, 'ssh-profiles.json'), '{}', 'utf8')
    const tools = {}
    registerSshTools({ tools: { register: (d) => { tools[d.name] = d } }, on: () => {} }, {})
    const out = await tools.sci_ssh_profiles.execute({ action: 'list' }, {})
    assert.equal(out.ok, true)
  })

  test('SSH profile 拒绝持久化明文密码，允许 credentialsRef', async () => {
    const tools = {}
    registerSshTools({ tools: { register: (d) => { tools[d.name] = d } }, on: () => {} }, {})
    await assert.rejects(
      tools.sci_ssh_profiles.execute({ action: 'add', name: 'h1', profile: { host: 'h', username: 'u', auth: 'password', password: 'secret' } }, {}),
      /拒绝把 SSH 密码/,
    )
    const out = await tools.sci_ssh_profiles.execute({ action: 'add', name: 'h1', profile: { host: 'h', username: 'u', auth: 'password', credentialsRef: 'SSH_H1_PASSWORD' } }, {})
    assert.equal(out.ok, true)
    const stored = JSON.parse(readFileSync(join(dataDir, 'ssh-profiles.json'), 'utf8')).h1
    assert.equal(stored.password, undefined)
    assert.equal(stored.credentialsRef, 'SSH_H1_PASSWORD')
  })

  test('SSH 连接池键显式取 profile 名，不同主机不会共用 undefined', () => {
    assert.equal(sshProfilePoolKey('lab-a'), 'lab-a')
    assert.equal(sshProfilePoolKey('lab-b'), 'lab-b')
    assert.notEqual(sshProfilePoolKey('lab-a'), sshProfilePoolKey('lab-b'))
    assert.throws(() => sshProfilePoolKey(undefined), /名称为空/)
  })

  test('已删除任务不计入 /sci-status 任务数与完成数', () => {
    const report = statusReportOf({
      version: '0.11.0',
      blueprint: { core: { claim: 'c', confirmed: true }, results: [{ id: 'res-1' }] },
      team: {
        members: [],
        tasks: [
          { id: 'task-1', status: 'completed' },
          { id: 'task-2', status: 'deleted' },
        ],
      },
      reviews: [],
    })
    assert.equal(report.counts.tasks, 1)
    assert.equal(report.counts.doneTasks, 1)
    assert.equal(report.counts.deletedTasks, 1)
    assert.match(report.lines[1], /任务 1（完成 1）/)
    assert.match(report.lines[1], /已删 1/)
  })

  test('蓝图总览 taskCount 只数在板任务', async () => {
    writeFileSync(join(dataDir, 'team.json'), JSON.stringify({
      members: [],
      tasks: [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'deleted' },
      ],
    }), 'utf8')
    const tools = {}
    registerBlueprintTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    const out = await tools.sci_blueprint_overview.execute({}, {})
    assert.equal(out.taskCount, 1)
    assert.equal(out.deletedTaskCount, 1)
  })

  test('远程工具对缺失 profile 报明确错误而不是 TypeError', async () => {
    writeFileSync(join(dataDir, 'ssh-profiles.json'), '{}', 'utf8')
    writeFileSync(join(dataDir, 'ssh-jobs.json'), JSON.stringify({
      'job-1': { profile: 'gone', remoteDir: '/tmp/x' },
      'job-2': { remoteDir: '/tmp/y' },
    }), 'utf8')
    const tools = {}
    registerSshTools({ tools: { register: (d) => { tools[d.name] = d } }, on: () => {} }, {})
    await assert.rejects(tools.sci_job_status.execute({ profile: 'missing' }, {}), /SSH profile "missing" 不存在/)
    await assert.rejects(tools.sci_job_logs.execute({ profile: 'missing', job: 'job-1' }, {}), /属于 profile "gone"/)
    await assert.rejects(tools.sci_job_harvest.execute({ profile: 'missing', job: 'job-1' }, {}), /属于 profile "gone"/)
    await assert.rejects(tools.sci_job_logs.execute({ profile: 'gone', job: 'job-2' }, {}), /缺少 profile 字段/)
    await assert.rejects(tools.sci_file_push.execute({ profile: 'missing', local: 'x', remote: '/tmp/x' }, {}), /SSH profile "missing" 不存在/)
    await assert.rejects(tools.sci_file_fetch.execute({ profile: 'missing', remote: '/tmp/x' }, {}), /SSH profile "missing" 不存在/)
  })

  test('profile 增删走审批卡，只读动作与查询不拦截', async () => {
    const gates = []
    const ctx = { tools: { register() {} }, on: (_event, handler) => gates.push(handler) }
    registerDbTools(ctx, {})
    registerSshTools(ctx, {})
    assert.equal(gates.length, 2)
    const next = async () => 'next'
    const [dbGate, sshGate] = gates
    assert.equal((await dbGate({ name: 'sci_db_profiles', arguments: { action: 'add' } }, next)).kind, 'ask')
    assert.equal((await dbGate({ name: 'sci_db_profiles', arguments: { action: 'remove' } }, next)).kind, 'ask')
    assert.equal(await dbGate({ name: 'sci_db_profiles', arguments: { action: 'list' } }, next), 'next')
    assert.equal((await dbGate({ name: 'sci_db_execute', arguments: {} }, next)).kind, 'ask')
    assert.equal((await sshGate({ name: 'sci_ssh_profiles', arguments: { action: 'remove' } }, next)).kind, 'ask')
    assert.equal((await sshGate({ name: 'sci_ssh_profiles', arguments: { action: 'import' } }, next)).kind, 'ask')
    assert.equal(await sshGate({ name: 'sci_ssh_profiles', arguments: { action: 'list' } }, next), 'next')
    assert.equal((await sshGate({ name: 'sci_ssh_exec', arguments: {} }, next)).kind, 'ask')
  })

  test('DELETED 大写状态同样不计入在板任务', () => {
    const report = statusReportOf({
      version: '0.11.0',
      blueprint: { core: { claim: 'c' }, results: [] },
      team: { members: [], tasks: [{ id: 'task-1', status: 'DELETED' }] },
      reviews: [],
    })
    assert.equal(report.counts.tasks, 0)
    assert.equal(report.counts.deletedTasks, 1)
  })
})

// ---------------------------------------------------------------------------
describe('第九轮：技能安装/删除成功路径（本地 git 夹具注入 clone）', () => {
  beforeEach(resetState)

  function fixtureRepo(files) {
    const root = mkdtempSync(join(tmpdir(), 'dsh-skill-repo-'))
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(root, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content, 'utf8')
    }
    return root
  }

  const cloneFrom = (root, opts = {}) => async (_url, dest) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
    if (opts.fail) throw opts.fail
    rmSync(dest, { recursive: true, force: true })
    cpSync(root, dest, { recursive: true })
    return { cloneMs: 1 }
  }

  const stagingEntries = () => {
    const p = join(roleSkillsDir, '.staging')
    return existsSync(p) ? readdirSync(p) : []
  }

  const install = (overrides = {}) =>
    installSkill({ role: 'analyst', exec: {}, ...overrides })

  test('自定义仓库安装成功：SKILL.md 发现、INDEX、状态与角色提示段', async () => {
    const root = fixtureRepo({
      'SKILL.md': '---\nname: demo-skill\ndescription: "Demo skill for tests"\n---\nbody',
      'references/notes.md': 'notes',
      '.git/config': 'should not copy',
    })
    const r = await install({ repoUrl: 'https://github.com/acme/demo-skill', name: 'demo', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    assert.equal(r.name, 'demo')
    const dir = join(roleSkillsDir, 'analyst', 'demo')
    assert.equal(r.dir, dir)
    assert.ok(existsSync(join(dir, 'SKILL.md')))
    assert.ok(existsSync(join(dir, 'references', 'notes.md')))
    assert.ok(!existsSync(join(dir, '.git')))
    assert.equal(r.skills.length, 1)
    assert.equal(r.skills[0].name, 'demo-skill')
    assert.equal(r.skills[0].description, 'Demo skill for tests')
    assert.equal(r.skills[0].path, join(dir, 'SKILL.md'))
    assert.equal(r.warn, false)
    assert.deepEqual(stagingEntries(), [])
    const idx = readFileSync(r.indexMd, 'utf8')
    assert.ok(idx.includes('demo-skill'))
    assert.ok(idx.includes(join(dir, 'SKILL.md')))
    assert.ok(idx.includes('https://github.com/acme/demo-skill'))
    const state = JSON.parse(readFileSync(join(dataDir, 'role-skills.json'), 'utf8'))
    assert.equal(state.roles.analyst[0].name, 'demo')
    assert.ok(roleSkillSectionText('analyst').includes('demo-skill'))
    assert.equal(roleSkillSectionText('writer'), '')
    const snap = skillMenuSnapshot()
    assert.equal(snap.installed.analyst[0].name, 'demo')
    assert.deepEqual(snap.installed.analyst[0].skillNames, ['demo-skill'])
  })

  test('安装后删除：目录、状态、INDEX 与角色提示段同步清除', async () => {
    const root = fixtureRepo({ 'SKILL.md': '---\nname: gone-skill\n---\n' })
    await install({ repoUrl: 'https://github.com/acme/gone', name: 'gone', cloneImpl: cloneFrom(root) })
    const rr = await removeSkill({ role: 'analyst', name: 'gone', exec: {} })
    assert.equal(rr.ok, true)
    assert.ok(!existsSync(join(roleSkillsDir, 'analyst', 'gone')))
    const idx = readFileSync(rr.indexMd, 'utf8')
    assert.ok(idx.includes('没有已安装'))
    const state = JSON.parse(readFileSync(join(dataDir, 'role-skills.json'), 'utf8'))
    assert.equal(state.roles.analyst, undefined)
    assert.equal(roleSkillSectionText('analyst'), '')
  })

  test('精选目录安装：只拷贝 subdir，记录 license/catalogId', async () => {
    const root = fixtureRepo({
      'skills/exploratory-data-analysis/SKILL.md': '---\nname: eda\n---\n',
      'skills/exploratory-data-analysis/scripts/run.py': 'print(1)',
      'skills/other/SKILL.md': 'nope',
      'README.md': 'root',
    })
    const r = await install({ catalogId: 'kdense-eda', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    assert.equal(r.name, 'kdense-eda')
    assert.ok(existsSync(join(r.dir, 'SKILL.md')))
    assert.ok(existsSync(join(r.dir, 'scripts', 'run.py')))
    assert.ok(!existsSync(join(r.dir, 'skills')))
    assert.ok(!existsSync(join(r.dir, 'README.md')))
    assert.equal(r.skills[0].path, join(r.dir, 'SKILL.md'))
    const idx = readFileSync(r.indexMd, 'utf8')
    assert.ok(idx.includes('MIT'))
    assert.ok(idx.includes('@ skills/exploratory-data-analysis'))
    const state = JSON.parse(readFileSync(join(dataDir, 'role-skills.json'), 'utf8'))
    assert.equal(state.roles.analyst[0].catalogId, 'kdense-eda')
  })

  test('精选目录 subdir 不存在时报错且不留下安装目录/暂存', async () => {
    const r = await install({ catalogId: 'kdense-eda', cloneImpl: cloneFrom(fixtureRepo({ 'README.md': 'x' })) })
    assert.equal(r.ok, false)
    assert.match(r.error, /不存在子目录/)
    assert.ok(!existsSync(join(roleSkillsDir, 'analyst', 'kdense-eda')))
    assert.deepEqual(stagingEntries(), [])
  })

  test('非标准仓库：无 SKILL.md 时 warn 登记并给出路径提示', async () => {
    const r = await install({ role: 'writer', repoUrl: 'https://github.com/acme/nostruct', name: 'raw', cloneImpl: cloneFrom(fixtureRepo({ 'README.md': 'x' })) })
    assert.equal(r.ok, true)
    assert.equal(r.warn, true)
    assert.equal(r.skills[0].path, r.dir)
    assert.match(r.note, /未发现 SKILL.md/)
    assert.ok(readFileSync(r.indexMd, 'utf8').includes('未发现 SKILL.md'))
  })

  test('SKILL.md 扫描：深度 ≤3 且跳过 node_modules/dist', async () => {
    const root = fixtureRepo({
      'skills/a/SKILL.md': 'body',
      'skills/a/b/SKILL.md': 'body',
      'skills/a/b/c/SKILL.md': 'body',
      'node_modules/x/SKILL.md': 'body',
      'dist/y/SKILL.md': 'body',
    })
    const r = await install({ repoUrl: 'https://github.com/acme/deep', name: 'deep', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    assert.deepEqual(r.skills.map((s) => s.name), ['a', 'b'])
    assert.ok(r.skills[0].path.endsWith(join('skills', 'a', 'SKILL.md')))
    assert.ok(r.skills[1].path.endsWith(join('skills', 'a', 'b', 'SKILL.md')))
  })

  test('description 超 200 字截断', async () => {
    const long = 'd'.repeat(250)
    const r = await install({ repoUrl: 'https://github.com/acme/long', name: 'long', cloneImpl: cloneFrom(fixtureRepo({ 'SKILL.md': `---\nname: long\ndescription: ${long}\n---\n` })) })
    assert.equal(r.ok, true)
    assert.equal(r.skills[0].description.length, 200)
    assert.ok(r.skills[0].description.endsWith('...'))
  })

  test('同名并发安装只成功一次（互斥队列）', async () => {
    const root = fixtureRepo({ 'SKILL.md': '---\nname: x\n---\n' })
    const run = () => install({ repoUrl: 'https://github.com/acme/x', name: 'x', cloneImpl: cloneFrom(root, { delayMs: 30 }) })
    const [a, b] = await Promise.all([run(), run()])
    assert.equal([a, b].filter((r) => r.ok).length, 1)
    const bad = [a, b].find((r) => !r.ok)
    assert.match(bad.error, /已安装/)
  })

  test('clone 失败：返回错误、清理安装目录与暂存、状态不变', async () => {
    const r = await install({ repoUrl: 'https://github.com/acme/boom', name: 'boom', cloneImpl: cloneFrom('', { fail: new Error('boom') }) })
    assert.equal(r.ok, false)
    assert.match(r.error, /boom/)
    assert.ok(!existsSync(join(roleSkillsDir, 'analyst', 'boom')))
    assert.deepEqual(stagingEntries(), [])
    assert.ok(!existsSync(join(dataDir, 'role-skills.json')))
  })

  test('repo_id 与 repo_url 同时提供时明确报错（不静默选一个）', async () => {
    const r = await install({ catalogId: 'kdense-eda', repoUrl: 'https://github.com/acme/x', cloneImpl: async () => { throw new Error('should not clone') } })
    assert.equal(r.ok, false)
    assert.match(r.error, /只能二选一/)
  })

  test('repo URL 白名单：拒绝 http/本地路径/深层路径/仿冒 gitlab.com 域名', () => {
    for (const bad of [
      'http://github.com/o/r',
      'https://example.com/o/r',
      'https://github.com/o/r/tree/main',
      'C:\\local\\repo',
      'https://github.com/o/../r',
      'https://gitlab.com.evil.com/o/r',
      'https://gitlab.comm.evil.com/o/r',
      'https://gitlab.comattacker.com/o/r',
    ]) {
      assert.ok(validateRepoUrl(bad).error, bad)
    }
    assert.equal(validateRepoUrl('https://github.com/o/r.git').repo, 'https://github.com/o/r')
    assert.equal(validateRepoUrl('https://gitlab.com/o/r').owner, 'o')
    assert.equal(validateRepoUrl('https://gitlab.example.org/o/r').owner, 'o')
  })

  test('损坏状态（roles.<role> 非数组）不崩溃，按空列表继续', async () => {
    writeFileSync(join(dataDir, 'role-skills.json'), JSON.stringify({ version: '0.10.0', roles: { analyst: null, writer: 'oops' } }), 'utf8')
    const root = fixtureRepo({ 'SKILL.md': '---\nname: ok\n---\n' })
    const r = await install({ repoUrl: 'https://github.com/acme/ok', name: 'ok', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    const state = JSON.parse(readFileSync(join(dataDir, 'role-skills.json'), 'utf8'))
    assert.ok(Array.isArray(state.roles.analyst))
    const rr = await removeSkill({ role: 'writer', name: 'none', exec: {} })
    assert.equal(rr.ok, false)
    assert.match(rr.error, /未安装/)
    assert.deepEqual(skillMenuSnapshot().installed.writer, [])
  })

  test('旧状态条目缺 skills 字段时 INDEX 仍可写入', async () => {
    const legacyDir = join(roleSkillsDir, 'analyst', 'legacy')
    writeFileSync(
      join(dataDir, 'role-skills.json'),
      JSON.stringify({ version: '0.10.0', roles: { analyst: [{ name: 'legacy', repo: 'https://github.com/a/b', dir: legacyDir }] } }),
      'utf8',
    )
    const root = fixtureRepo({ 'SKILL.md': '---\nname: fresh\n---\n' })
    const r = await install({ repoUrl: 'https://github.com/acme/fresh', name: 'fresh', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    const idx = readFileSync(r.indexMd, 'utf8')
    assert.ok(idx.includes('legacy'))
    assert.ok(idx.includes('fresh'))
    assert.equal(roleSkillSectionText('analyst').includes('legacy'), true)
  })

  test('跳过仓库内符号链接/目录联接（防把本机路径带进技能目录）', async (t) => {
    const outside = mkdtempSync(join(tmpdir(), 'dsh-skill-outside-'))
    writeFileSync(join(outside, 'SKILL.md'), 'leak')
    const root = fixtureRepo({ 'SKILL.md': '---\nname: safe\n---\n' })
    try {
      symlinkSync(outside, join(root, 'leak'), 'junction')
    } catch {
      t.skip('当前环境无法创建目录联接')
      return
    }
    // 模拟 git clone 保留符号链接：cpSync 会把 junction 解引用，这里手动在 staging 里重建链接
    const cloneImpl = async (_url, dest) => {
      rmSync(dest, { recursive: true, force: true })
      mkdirSync(dest, { recursive: true })
      cpSync(join(root, 'SKILL.md'), join(dest, 'SKILL.md'))
      symlinkSync(outside, join(dest, 'leak'), 'junction')
      return { cloneMs: 1 }
    }
    const r = await install({ repoUrl: 'https://github.com/acme/sym', name: 'sym', cloneImpl })
    assert.equal(r.ok, true)
    assert.ok(existsSync(join(r.dir, 'SKILL.md')))
    assert.ok(!existsSync(join(r.dir, 'leak')))
  })

  test('roles 为数组时归一化为对象，安装状态不丢失', async () => {
    writeFileSync(join(dataDir, 'role-skills.json'), JSON.stringify({ version: '0.10.0', roles: [] }), 'utf8')
    const root = fixtureRepo({ 'SKILL.md': '---\nname: fixed\n---\n' })
    const r = await install({ repoUrl: 'https://github.com/acme/fixed', name: 'fixed', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    const state = JSON.parse(readFileSync(join(dataDir, 'role-skills.json'), 'utf8'))
    assert.equal(Array.isArray(state.roles), false)
    assert.equal(state.roles.analyst[0].name, 'fixed')
  })

  test('条目数组含 null/字符串时被过滤，快照与角色提示段不崩溃', () => {
    writeFileSync(
      join(dataDir, 'role-skills.json'),
      JSON.stringify({ version: '0.10.0', roles: { analyst: [null, 'oops', { name: 'legit', repo: 'https://github.com/a/b' }] } }),
      'utf8',
    )
    const snap = skillMenuSnapshot()
    assert.deepEqual(snap.installed.analyst.map((x) => x.name), ['legit'])
    const text = roleSkillSectionText('analyst')
    assert.ok(text.includes('legit'))
    assert.ok(text.includes('无 SKILL.md'))
    assert.ok(!text.includes('（（无'))
  })

  test('条目内 skills 含 null/字符串时，INDEX 与 installed 工具输出不崩溃', async () => {
    writeFileSync(
      join(dataDir, 'role-skills.json'),
      JSON.stringify({
        version: '0.10.0',
        roles: { analyst: [{ name: 'legit', repo: 'https://github.com/a/b', skills: [null, 'oops', { name: 's1', description: 'd', relPath: 'SKILL.md' }] }] },
      }),
      'utf8',
    )
    const snap = skillMenuSnapshot()
    assert.deepEqual(snap.installed.analyst[0].skillNames, ['s1'])
    const tools = {}
    registerSkillMenuTools({ tools: { register: (d) => { tools[d.name] = d } } }, {})
    const listed = await tools.sci_skill_installed.execute({ role: 'analyst' })
    assert.deepEqual(listed.installed[0].skills.map((s) => s.name), ['s1'])
    const root = fixtureRepo({ 'SKILL.md': '---\nname: fresh2\n---\n' })
    const r = await install({ repoUrl: 'https://github.com/acme/fresh2', name: 'fresh2', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    assert.ok(readFileSync(r.indexMd, 'utf8').includes('s1'))
  })

  test('INDEX 扫描顺序按名称排序（大写在小写前），与文件系统枚举顺序无关', async () => {
    const root = fixtureRepo({ 'a/SKILL.md': 'x', 'B/SKILL.md': 'y' })
    const r = await install({ repoUrl: 'https://github.com/acme/sort', name: 'sort', cloneImpl: cloneFrom(root) })
    assert.equal(r.ok, true)
    assert.deepEqual(r.skills.map((s) => s.name), ['B', 'a'])
  })

  test('精选目录 subdir 是指向仓库外的链接时拒绝安装', async (t) => {
    const outside = mkdtempSync(join(tmpdir(), 'dsh-skill-sub-out-'))
    writeFileSync(join(outside, 'SKILL.md'), 'leak')
    const root = fixtureRepo({ 'README.md': 'x' })
    mkdirSync(join(root, 'skills'), { recursive: true })
    try {
      symlinkSync(outside, join(root, 'skills', 'exploratory-data-analysis'), 'junction')
    } catch {
      t.skip('当前环境无法创建目录联接')
      return
    }
    const cloneImpl = async (_url, dest) => {
      rmSync(dest, { recursive: true, force: true })
      mkdirSync(join(dest, 'skills'), { recursive: true })
      writeFileSync(join(dest, 'README.md'), 'x')
      symlinkSync(outside, join(dest, 'skills', 'exploratory-data-analysis'), 'junction')
      return { cloneMs: 1 }
    }
    const r = await install({ catalogId: 'kdense-eda', cloneImpl })
    assert.equal(r.ok, false)
    assert.match(r.error, /符号链接/)
    assert.ok(!existsSync(join(roleSkillsDir, 'analyst', 'kdense-eda')))
  })

  test('唤醒慢时不阻塞后续安装（唤醒在互斥区外）', async () => {
    let releaseWake
    const gate = new Promise((r) => { releaseWake = r })
    setMemberWakeHook(async () => { await gate; return { targets: 0, woken: [], failed: [] } })
    try {
      const root = fixtureRepo({ 'SKILL.md': 'body' })
      const slow = install({ repoUrl: 'https://github.com/acme/slow', name: 'slow', exec: { agent: {} }, cloneImpl: cloneFrom(root) })
      await new Promise((r) => setTimeout(r, 20))
      const fast = install({ repoUrl: 'https://github.com/acme/fast', name: 'fast', cloneImpl: cloneFrom(root) })
      const raced = await Promise.race([fast, new Promise((r) => setTimeout(() => r('timeout'), 300))])
      releaseWake()
      assert.notEqual(raced, 'timeout')
      assert.equal(raced.ok, true)
      const s = await slow
      assert.equal(s.ok, true)
      assert.equal(s.wake.attempted, true)
    } finally {
      setMemberWakeHook(null)
    }
  })

  test('安装成功后自动唤醒已 spawn 的本角色成员', async () => {
    const agent = { id: 'agent-1' }
    const calls = []
    setMemberWakeHook(async (a, role, entry) => {
      calls.push({ agent: a, role, name: entry.name })
      return { targets: 2, woken: [{ name: 'm1' }, { name: 'm2' }], failed: [] }
    })
    try {
      const root = fixtureRepo({ 'SKILL.md': '---\nname: wake\n---\n' })
      const r = await install({ repoUrl: 'https://github.com/acme/wake', name: 'wake', exec: { agent }, cloneImpl: cloneFrom(root) })
      assert.equal(r.ok, true)
      assert.equal(r.wake.attempted, true)
      assert.equal(r.wake.woken.length, 2)
      assert.match(r.note, /自动通知 2 名/)
      assert.equal(calls[0].agent, agent)
      assert.equal(calls[0].role, 'analyst')
    } finally {
      setMemberWakeHook(null)
    }
  })

  test('唤醒失败不影响安装结果，wake.failed 记录原因', async () => {
    setMemberWakeHook(async () => { throw new Error('wake down') })
    try {
      const root = fixtureRepo({ 'SKILL.md': 'body' })
      const r = await install({ repoUrl: 'https://github.com/acme/wake2', name: 'wake2', exec: { agent: {} }, cloneImpl: cloneFrom(root) })
      assert.equal(r.ok, true)
      assert.equal(r.wake.attempted, true)
      assert.equal(r.wake.failed[0].error, 'wake down')
      assert.match(r.note, /INDEX\.md/)
    } finally {
      setMemberWakeHook(null)
    }
  })
})

// ---------------------------------------------------------------------------
describe('第十轮：团队编排（spawn_all / review_send）', () => {
  beforeEach(resetState)

  const LEAD = { id: 'lead-1' }

  function setupTeam(overrides = {}) {
    const tools = {}
    const activations = []
    const messages = []
    const subagents = {
      async startActivation(opts) {
        activations.push(opts)
        if (overrides.startActivation) return overrides.startActivation(opts)
        return { childId: opts.childId }
      },
      async sendMessage(agent, childId, msgs, options) {
        messages.push({ agent, childId, text: msgs[0] && msgs[0].text, options })
        if (overrides.sendMessage) return overrides.sendMessage(agent, childId, msgs, options)
        return undefined
      },
    }
    registerTeamTools({ tools: { register: (d) => { tools[d.name] = d } }, subagents }, {})
    return { tools, activations, messages }
  }

  const teamState = () => JSON.parse(readFileSync(join(dataDir, 'team.json'), 'utf8'))
  const seedBlueprint = () =>
    writeFileSync(
      join(dataDir, 'blueprint.json'),
      JSON.stringify({
        version: '0.11.0',
        core: { title: 't', claim: 'c' },
        results: [{ id: 'res-1', claim: 'X increases Y', confirmed: true, status: 'planned', tasks: [], figures: [] }],
      }),
      'utf8',
    )

  test('spawn_all：首次生成默认编制，再次调用全部跳过', async () => {
    const { tools, activations } = setupTeam()
    const first = await tools.sci_team_spawn_all.execute({}, { agent: LEAD })
    assert.equal(first.ok, true)
    assert.equal(first.results.length, DEFAULT_TEAM.length)
    assert.equal(first.results.filter((r) => r.ok).length, DEFAULT_TEAM.length)
    assert.equal(activations.length, DEFAULT_TEAM.length)
    assert.equal(teamState().members.length, DEFAULT_TEAM.length)
    const second = await tools.sci_team_spawn_all.execute({}, { agent: LEAD })
    assert.equal(second.results.every((r) => r.skipped === true), true)
    assert.equal(activations.length, DEFAULT_TEAM.length)
  })

  test('spawn_all：单个角色失败不影响其余成员，错误带 role', async () => {
    const { tools } = setupTeam({
      startActivation: async (opts) => {
        if (String(opts.label).includes(':writer:')) throw new Error('boom')
        return { childId: opts.childId }
      },
    })
    const out = await tools.sci_team_spawn_all.execute({}, { agent: LEAD })
    assert.equal(out.ok, true)
    const failed = out.results.find((r) => r.error)
    assert.equal(failed.role, 'writer')
    assert.match(failed.error, /boom/)
    assert.equal(teamState().members.length, DEFAULT_TEAM.length - 1)
  })

  test('spawn：同名复用返回原 childId，未知角色/无调用者明确报错', async () => {
    const { tools, activations } = setupTeam()
    const a = await tools.sci_team_spawn.execute({ role: 'analyst' }, { agent: LEAD })
    const b = await tools.sci_team_spawn.execute({ role: 'analyst' }, { agent: LEAD })
    assert.equal(b.reused, true)
    assert.equal(b.childId, a.childId)
    assert.equal(activations.length, 1)
    await assert.rejects(tools.sci_team_spawn.execute({ role: 'nope' }, { agent: LEAD }), /未知角色/)
    await assert.rejects(tools.sci_team_spawn.execute({ role: 'analyst' }, {}), /无法确定调用者/)
  })

  test('review_send：已有 reviewer 时建任务、唤醒并标 claimed', async () => {
    const { tools, messages } = setupTeam()
    const spawned = await tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    messages.length = 0
    const out = await tools.sci_review_send.execute({ scope: 'computation', target: 'run 3' }, { agent: LEAD })
    assert.equal(out.ok, true)
    assert.equal(out.taskId, 'task-1')
    assert.equal(out.isReview, true)
    assert.equal(out.wake.woken, true)
    const t = teamState().tasks.find((x) => x.id === 'task-1')
    assert.equal(t.status, 'claimed')
    assert.equal(t.assignee, 'reviewer')
    assert.equal(t.isReview, true)
    assert.ok(t.claimedAt > 0)
    assert.ok(t.desc.includes('审查计算过程'))
    assert.equal(messages.length, 1)
    assert.equal(messages[0].childId, spawned.childId)
    assert.ok(messages[0].text.includes('task-1'))
  })

  test('review_send：无 reviewer 时自动生成再派发', async () => {
    const { tools, activations, messages } = setupTeam()
    const out = await tools.sci_review_send.execute({ scope: 'turn' }, { agent: LEAD })
    assert.equal(activations.length, 1)
    assert.ok(activations[0].label.includes(':reviewer:'))
    assert.equal(teamState().members[0].role, 'reviewer')
    assert.equal(out.wake.woken, true)
    assert.equal(messages.length, 1)
  })

  test('review_send：未知/空 scope 直接报错，不建任务', async () => {
    const { tools } = setupTeam()
    await assert.rejects(tools.sci_review_send.execute({ scope: 'bogus' }, { agent: LEAD }), /scope 非法/)
    await assert.rejects(tools.sci_review_send.execute({}, { agent: LEAD }), /scope 非法/)
    assert.ok(!existsSync(join(dataDir, 'team.json')))
  })

  test('review_send evidence：任务描述带蓝图 claims 逐条核对清单', async () => {
    seedBlueprint()
    const { tools } = setupTeam()
    await tools.sci_review_send.execute({ scope: 'evidence', target: 'manuscript' }, { agent: LEAD })
    const t = teamState().tasks[0]
    assert.ok(t.desc.includes('res-1'))
    assert.ok(t.desc.includes('X increases Y'))
    assert.ok(t.desc.includes('blueprint-claim'))
  })

  test('review_send result_id：对齐成功写回蓝图；未知 result 只回报错误', async () => {
    seedBlueprint()
    const { tools } = setupTeam()
    const ok = await tools.sci_review_send.execute({ scope: 'turn', result_id: 'res-1' }, { agent: LEAD })
    assert.equal(ok.blueprintAlign.ok, true)
    const bp = JSON.parse(readFileSync(join(dataDir, 'blueprint.json'), 'utf8'))
    assert.ok(bp.results[0].tasks.includes(ok.taskId))
    assert.equal(teamState().tasks.find((t) => t.id === ok.taskId).resultId, 'res-1')
    const bad = await tools.sci_review_send.execute({ scope: 'turn', result_id: 'res-9' }, { agent: LEAD })
    assert.equal(bad.ok, true)
    assert.match(bad.blueprintAlign.error, /不存在/)
    assert.equal(teamState().tasks.find((t) => t.id === bad.taskId).resultId, null)
  })

  test('review_send：唤醒失败任务保持 pending；无 agent 时也只挂板', async () => {
    const failing = setupTeam({ sendMessage: async () => { throw new Error('offline') } })
    await failing.tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    const out = await failing.tools.sci_review_send.execute({ scope: 'turn' }, { agent: LEAD })
    assert.equal(out.wake.woken, false)
    assert.match(out.wake.error, /offline/)
    assert.equal(teamState().tasks[0].status, 'pending')

    const web = setupTeam()
    await web.tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    const webOut = await web.tools.sci_review_send.execute({ scope: 'turn' }, {})
    assert.equal(webOut.ok, true)
    assert.equal(webOut.wake.woken, false)
    assert.equal(web.messages.length, 0)
  })

  test('review_send：HIGH-1 wake 未传 signal → TypeError → 任务保持 pending（不假 claimed）', async () => {
    const captured = []
    const { tools } = setupTeam({
      sendMessage: async (_agent, _childId, _msgs, options) => {
        captured.push(options)
        // 模拟 dispose 竞态：options.signal 缺失时 deliverFollowup 抛 TypeError
        if (!options || !options.signal) throw new TypeError("Cannot read properties of undefined (reading 'throwIfAborted')")
        return undefined
      },
    })
    await tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    const out = await tools.sci_review_send.execute({ scope: 'journal' }, { agent: LEAD })
    // HIGH-1 修复后：signal 必传 → mock 不再抛 TypeError → woken=true（消息确实送达）
    assert.equal(out.wake.woken, true)
    assert.equal(out.wake.error, undefined)
    assert.equal(teamState().tasks[0].status, 'claimed')
    // HIGH-2：sendMessage 第 4 参必须有 signal 且是 AbortSignal
    assert.ok(captured.length > 0, 'sendMessage was called')
    for (const opts of captured) {
      assert.ok(opts && opts.signal instanceof AbortSignal, 'sendMessage options.signal must be AbortSignal')
    }
  })

  test('review_send：wake 抛 AbortError（真取消）→ 任务保持 pending', async () => {
    const { tools } = setupTeam({
      sendMessage: async () => { throw new DOMException('This operation was aborted', 'AbortError') },
    })
    await tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    const out = await tools.sci_review_send.execute({ scope: 'journal' }, { agent: LEAD })
    assert.equal(out.wake.woken, false)
    assert.equal(teamState().tasks[0].status, 'pending')
    assert.equal(teamState().tasks[0].claimedAt, undefined)
  })

  test('HIGH-3：跨会话 UNAUTHORIZED → childId 清除 + staleMember 标记', async () => {
    const { tools } = setupTeam({
      sendMessage: async () => { throw new Error('subagent does not belong to the supplied parent session (subagent/unauthorized)') },
    })
    await tools.sci_team_spawn.execute({ role: 'reviewer' }, { agent: LEAD })
    const st1 = teamState()
    const oldChildId = st1.members.find((m) => m.name === 'reviewer').childId
    assert.ok(oldChildId, 'childId was recorded at spawn')
    const out = await tools.sci_review_send.execute({ scope: 'turn' }, { agent: LEAD })
    assert.equal(out.wake.woken, false)
    assert.match(out.wake.error, /重新 sci_team_spawn/)
    assert.equal(out.wake.staleMember, true)
    // childId 已清除
    const st2 = teamState()
    const reviewer2 = st2.members.find((m) => m.name === 'reviewer')
    assert.equal(reviewer2.childId, null, 'childId cleared after UNAUTHORIZED')
  })
})
