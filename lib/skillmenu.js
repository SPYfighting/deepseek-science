// dsh-science — 角色级 skill 菜单（role-scoped skill menu, v0.10.0）
// 设计（与 DEVLOG 架构一致）：
//   存储：$DSH_HOME/dsh-science/role-skills/<role>/<name>/（git clone --depth 1，execFile 无 shell）。
//   隔离：绝不注册进 DSH 全局 skills registry、也不进 bundled skills provider——技能只经
//         spawnMember 的成员提示词末尾「扩展技能库」段（INDEX.md 路径清单）对成员生效；
//         成员用自带读文件工具按需读取。跨角色隔离 = 每角色独立目录 + 只有对应角色的
//         spawn 提示词携带该目录索引。
//   状态：$DSH_HOME/dsh-science/role-skills.json（+ 工作区 .dsh-science/ 镜像）。
//   目录（CATALOG）：每角色 ≤3 个精选开源 skill 仓库（presentation 例外为 4：第 1 条固定为用户本人的
//         user-scientific-ppt-drawing，v0.10.0；2026-11 逐个经 GitHub API/raw 验证可达、
//         结构含 SKILL.md、许可 MIT/Apache 为主；ARS 一条为 CC-BY-NC-4.0 已在 description 标明）。
//   安全：repo URL 白名单（https github/gitlab，仅 owner/repo 两段，禁 .. 与本地路径）；
//         安装/删除走模块级互斥队列防并发 clone；subdir 解析做前缀校验防穿越；
//         skill 内容安全由成员自行判断（本模块只做结构发现，不做内容执行）。
// 工具 schema 合同（DEVLOG 坑清单）：参数名避开注解关键字；properties 内不用 required；
// 输出对象不含 undefined 值键（一律 null 兜底）。

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, renameSync, lstatSync, realpathSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { join, resolve, sep, basename } from 'node:path'
import { dataDirOf, PKG_ROOT_OF } from './store.js'
import { ROLES } from './roles.js'

function log(msg) {
  console.log(`[dsh-science skillmenu] ${msg}`)
}

const VERSION = '0.14.0'
const INSTALL_TIMEOUT_MS = 120000

// 自动唤醒钩子（brief 待办 8）：team.js 注册「按 role 找已 spawn 成员并推送新技能路径」的实现，
// skillmenu 只负责在安装成功后调用，避免 skillmenu→team 的反向依赖（team 已 import 本模块）。
let memberWakeHook = null
export function setMemberWakeHook(fn) {
  memberWakeHook = typeof fn === 'function' ? fn : null
}

// 新装技能的通知文本：INDEX.md + 每个 SKILL.md 的绝对路径，成员可直接读取使用。
export function formatSkillWakeText(entry) {
  const paths = (Array.isArray(entry.skills) ? entry.skills : [])
    .map((s) => (s && s.relPath && s.relPath !== '.' ? join(entry.dir, s.relPath) : entry.dir))
    .filter(Boolean)
  return [
    `队长为本角色新安装了扩展技能「${entry.name}」（${entry.repo}${entry.subdir ? ` @ ${entry.subdir}` : ''}）。`,
    `技能索引：${join(entry.dir, '..', 'INDEX.md')}`,
    '可用 SKILL.md 路径：',
    ...(paths.length ? paths.map((p) => `- ${p}`) : [`- ${entry.dir}（未发现 SKILL.md，仅登记目录）`]),
    '需要时直接按路径读取使用（无需重启，也无需等待队长再通知）。',
  ].join('\n')
}

// ---- 精选目录（CATALOG）-----------------------------------------------------
// 2026-11-08 调研验证记录（GitHub API pushed_at / stars / license + raw SKILL.md 200）：
//   K-Dense-AI/scientific-agent-skills  MIT        pushed 2026-11-02  56.4k★
//   HughYau/AcademicForge               MIT        pushed 2026-11-01  2.6k★（默认分支 site-first）
//   SciMate-AI/HPC-Skills               MIT        pushed 2026-04-06（HPC 工作流技能集）
//   huggingface/skills                  Apache-2.0 pushed 2026-10-30  11.3k★
//   Orchestra-Research/AI-Research-SKILLs MIT      pushed 2026-10-11  14.3k★
//   O0000-code/paper-search-pro         Apache-2.0 pushed 2026-11-03
//   Master-cai/Research-Paper-Writing-Skills MIT    pushed 2026-06-23  8.2k★
//   jin-s13/ai-research-writing-skill   MIT        pushed 2026-10-18
//   Imbad0202/academic-research-skills  CC-BY-NC-4.0 pushed 2026-11-06 55.8k★（非商用，仅 reviewer 目录保留并标注）
//   shaowen-ye/manuscript-review-skill  MIT        pushed 2026-07-16
//   AlexWortega/ai-peer-review-skill    MIT        pushed 2026-05-08
//   PlutoLei/paperbanana-skill          MIT        pushed 2026-11-02
//   Dsadd4/AgentFigureGallery           MIT        pushed 2026-09-05
//   ngtiendong/Academic-Research-Agent-Skill MIT    pushed 2026-10-04
//   jinwyp/open-ppt-skill               MIT        pushed 2026-08-07
//   zouchenzhen/thesis-defense-pptx-skill Apache-2.0 pushed 2026-06-05
//   Faust-Donf/beamer-academic          MIT        pushed 2026-08-17
//   SPYfighting/my-academic-skills      MIT        用户本人的 skill 仓库（本地克隆 research/user-academic-skills，
//                                                  main 分支经 git ls-remote 核验可达；scientific-ppt-drawing
//                                                  子目录含 SKILL.md + scripts/figure_cli.py，CLI 需 CPython 3.11-3.13）
const KDENSE = 'https://github.com/K-Dense-AI/scientific-agent-skills'
const ACADEMICFORGE = 'https://github.com/HughYau/AcademicForge'
const ORCHESTRA = 'https://github.com/Orchestra-Research/AI-Research-SKILLs'

export const CATALOG = {
  simulator: [
    {
      id: 'kdense-cantera',
      name: 'Cantera 化学反应/燃烧模拟',
      repo: KDENSE,
      subdir: 'skills/cantera',
      description: 'K-Dense Cantera 技能：反应器/燃烧/化学动力学模拟的参数设置、数值有效性检查与诊断。',
      license: 'MIT',
    },
    {
      id: 'academicforge-compute-env',
      name: '计算环境搭建与验证',
      repo: ACADEMICFORGE,
      subdir: 'skills/claude-science/compute-env-setup',
      description: 'AcademicForge claude-science 计算技能：新计算环境/新工具的分类学、验证阶梯与诊断表（与通用上手规范配套）。',
      license: 'MIT',
    },
    {
      id: 'scimate-hpc-openfoam',
      name: 'OpenFOAM CFD (HPC)',
      repo: 'https://github.com/SciMate-AI/HPC-Skills',
      subdir: 'skills/hpc-openfoam',
      description: 'SciMate HPC 技能集之 OpenFOAM：CFD 作业搭建、网格/求解器选择与 HPC 调度纪律。',
      license: 'MIT',
    },
  ],
  trainer: [
    {
      id: 'hf-llm-trainer',
      name: 'HF LLM Trainer',
      repo: 'https://github.com/huggingface/skills',
      subdir: 'skills/huggingface-llm-trainer',
      description: 'HuggingFace 官方技能：Transformers/TRL 训练与微调全流程（数据准备→训练→评估）。',
      license: 'Apache-2.0',
    },
    {
      id: 'orchestra-fine-tuning',
      name: '微调工具箱（axolotl/LLaMA-Factory/PEFT/unsloth）',
      repo: ORCHESTRA,
      subdir: '03-fine-tuning',
      description: 'Orchestra 研究技能集微调分册：4 个子技能（axolotl、llama-factory、peft、unsloth）聚合安装。',
      license: 'MIT',
    },
    {
      id: 'kdense-pytorch-lightning',
      name: 'PyTorch Lightning',
      repo: KDENSE,
      subdir: 'skills/pytorch-lightning',
      description: 'K-Dense PyTorch Lightning 技能：LightningModule/Trainer 结构化训练、回调与复现纪律。',
      license: 'MIT',
    },
  ],
  'literature-scout': [
    {
      id: 'kdense-bgpt-paper-search',
      name: 'bgpt 文献检索',
      repo: KDENSE,
      subdir: 'skills/bgpt-paper-search',
      description: 'K-Dense 文献检索技能：多源论文搜索与元数据整理。',
      license: 'MIT',
    },
    {
      id: 'kdense-exa-search',
      name: 'Exa 语义检索',
      repo: KDENSE,
      subdir: 'skills/exa-search',
      description: 'K-Dense Exa 检索技能：语义化网络/文献检索与结果筛选。',
      license: 'MIT',
    },
    {
      id: 'paper-search-pro',
      name: '五源文献搜索',
      repo: 'https://github.com/O0000-code/paper-search-pro',
      description: '五源论文搜索（含饱和曲线与 HTML 报告）——判断检索是否收敛的量化口径。',
      license: 'Apache-2.0',
    },
  ],
  writer: [
    {
      id: 'research-paper-writing',
      name: 'Research Paper Writing',
      repo: 'https://github.com/Master-cai/Research-Paper-Writing-Skills',
      subdir: 'research-paper-writing',
      description: '论文写作技能：摘要/引言/方法/结论的分节模板与大量正反例（references/examples）。',
      license: 'MIT',
    },
    {
      id: 'ai-research-writing',
      name: 'AI Research Writing',
      repo: 'https://github.com/jin-s13/ai-research-writing-skill',
      description: '研究写作技能：结构化写作流程 + 模板与脚本（SKILL.md 在仓库根）。',
      license: 'MIT',
    },
    {
      id: 'orchestra-paper-writing',
      name: 'ML 论文写作（Orchestra）',
      repo: ORCHESTRA,
      subdir: '20-ml-paper-writing',
      description: 'Orchestra 论文写作分册：ml-paper-writing / academic-plotting / 会议报告 4 个子技能。',
      license: 'MIT',
    },
  ],
  'figure-expert': [
    {
      id: 'academicforge-sci-viz',
      name: 'Scientific Visualization',
      repo: ACADEMICFORGE,
      subdir: 'skills/scientific-visualization',
      description: 'AcademicForge 科研可视化技能：图表类型选型与期刊级图形规范（本插件 figure-expert 角色设计参照）。',
      license: 'MIT',
    },
    {
      id: 'paperbanana',
      name: 'PaperBanana 图表流水线',
      repo: 'https://github.com/PlutoLei/paperbanana-skill',
      description: '多智能体学术图表流水线（Retriever→Planner→Stylist）：方法示意图与实验图。',
      license: 'MIT',
    },
    {
      id: 'agent-figure-gallery',
      name: '期刊图表美学图鉴',
      repo: 'https://github.com/Dsadd4/AgentFigureGallery',
      subdir: 'skills/agent-figure-gallery',
      description: '期刊图表美学参考图鉴：按期刊/风格组织的配图样式库。',
      license: 'MIT',
    },
  ],
  reviewer: [
    {
      id: 'ars-paper-reviewer',
      name: '多视角期刊审稿模拟',
      repo: 'https://github.com/Imbad0202/academic-research-skills',
      subdir: 'academic-paper-reviewer',
      description: 'ARS 审稿技能：主编+3 审稿人卡牌视角模拟期刊评审（注意：CC-BY-NC-4.0 非商用许可）。',
      license: 'CC-BY-NC-4.0',
    },
    {
      id: 'manuscript-review',
      name: '六角色稿件评审',
      repo: 'https://github.com/shaowen-ye/manuscript-review-skill',
      description: '六个角色分工的稿件评审技能：双语批注 .docx + 评分矩阵。',
      license: 'MIT',
    },
    {
      id: 'ai-peer-review',
      name: '结构化同行评审',
      repo: 'https://github.com/AlexWortega/ai-peer-review-skill',
      description: 'PDF 输入 → N 份结构化评审 + meta-review + 关切矩阵。',
      license: 'MIT',
    },
  ],
  analyst: [
    {
      id: 'kdense-eda',
      name: '探索性数据分析',
      repo: KDENSE,
      subdir: 'skills/exploratory-data-analysis',
      description: 'K-Dense EDA 技能：分布/缺失/相关性系统检查与假设生成纪律。',
      license: 'MIT',
    },
    {
      id: 'hf-datasets',
      name: 'HF Datasets 数据处理',
      repo: 'https://github.com/huggingface/skills',
      subdir: 'skills/huggingface-datasets',
      description: 'HuggingFace 官方技能：datasets 库加载/清洗/流式处理大规模数据。',
      license: 'Apache-2.0',
    },
    {
      id: 'kdense-dask',
      name: 'Dask 并行计算',
      repo: KDENSE,
      subdir: 'skills/dask',
      description: 'K-Dense Dask 技能：超出内存规模的数据并行处理与分区策略。',
      license: 'MIT',
    },
  ],
  'topic-designer': [
    {
      id: 'orchestra-ideation',
      name: '研究选题与头脑风暴',
      repo: ORCHESTRA,
      subdir: '21-research-ideation',
      description: 'Orchestra 选题分册：brainstorming-research-ideas + creative-thinking-for-research 两个子技能。',
      license: 'MIT',
    },
    {
      id: 'kdense-experimental-design',
      name: '实验设计',
      repo: KDENSE,
      subdir: 'skills/experimental-design',
      description: 'K-Dense 实验设计技能：因子/对照/功效分析与设计矩阵。',
      license: 'MIT',
    },
    {
      id: 'academic-research-agent',
      name: '研究问题收敛与新颖性闸门',
      repo: 'https://github.com/ngtiendong/Academic-Research-Agent-Skill',
      description: '研究问题界定 → novelty gate → 实验规划（SKILL.md 在仓库根）。',
      license: 'MIT',
    },
  ],
  presentation: [
    {
      id: 'user-scientific-ppt-drawing',
      name: '科研示意图绘制（可编辑 PPT 形状）',
      repo: 'https://github.com/SPYfighting/my-academic-skills',
      subdir: 'scientific-ppt-drawing',
      description:
        '用户本人的 scientific-ppt-drawing 技能：把科研示意图画成可编辑原生 PowerPoint 形状与活字' +
        '（描述/参考图/SVG 三条输入路由；object plan；SVG 可编辑源规范——连续线=单 freeform、真文本、语义分组；' +
        'figure_cli 工具链 validate/render/inspect/compatibility，CLI 需 CPython 3.11-3.13 + requirements.lock；' +
        '视觉验收门：结构可辨认/可编辑/禁静默栅格化）。presentation.md 的示意图章节即以此为本。',
      license: 'MIT',
    },
    {
      id: 'open-kimi-ppt',
      name: 'Open Kimi PPT',
      repo: 'https://github.com/jinwyp/open-ppt-skill',
      subdir: 'skills/open-kimi-ppt',
      description: 'Kimi slides 式创建/编辑/导出技能（本插件 presentation 角色方法论参照之一）。',
      license: 'MIT',
    },
    {
      id: 'thesis-defense-pptx',
      name: '答辩 PPT 生成',
      repo: 'https://github.com/zouchenzhen/thesis-defense-pptx-skill',
      subdir: 'skills/thesis-defense-pptx',
      description: '论文 PDF/LaTeX → 可编辑答辩 PPT（复用学校模板）。',
      license: 'Apache-2.0',
    },
    {
      id: 'beamer-academic',
      name: '学术 Beamer 幻灯',
      repo: 'https://github.com/Faust-Donf/beamer-academic',
      description: '论文/学位论文 → Beamer 演示（双语，SKILL.md 在仓库根）。',
      license: 'MIT',
    },
  ],
}

// ---- 存储 ------------------------------------------------------------------
const roleSkillsRoot = () => join(dataDirOf(), 'role-skills')
const stateFile = () => join(dataDirOf(), 'role-skills.json')

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(stateFile(), 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.roles && typeof parsed.roles === 'object') {
      // 归一化：roles 必须是对象；条目必须是对象（数组/字符串/ null 一律丢弃，防止调用方 TypeError）
      if (Array.isArray(parsed.roles)) parsed.roles = {}
      for (const [role, entries] of Object.entries(parsed.roles)) {
        parsed.roles[role] = Array.isArray(entries) ? entries.filter((e) => e && typeof e === 'object' && !Array.isArray(e)) : []
      }
      return parsed
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') log(`role-skills.json read failed (treated as empty): ${err && err.message}`)
  }
  return { version: VERSION, updatedAt: 0, roles: {} }
}

function saveState(state) {
  state.version = VERSION
  state.updatedAt = Date.now()
  const text = JSON.stringify(state, null, 2)
  const tmp = `${stateFile()}.tmp`
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, stateFile())
  } catch (err) {
    log(`atomic persist fallback: ${err && err.message}`)
    writeFileSync(stateFile(), text, 'utf8')
  }
  return text
}

// ---- 安装/删除互斥队列（防并发 clone 写同一 INDEX/state）-----------------------
let queueTail = Promise.resolve()
function enqueue(task) {
  const run = queueTail.then(task, task)
  queueTail = run.then(() => undefined, () => undefined)
  return run
}

// ---- URL / 名称校验 ----------------------------------------------------------
// 仅接受 https://github.com/<owner>/<repo>[.git] 或 https://gitlab*。<owner>/<repo>[.git]；
// 禁本地路径、ssh 协议、路径穿越、超深路径。
export function validateRepoUrl(raw) {
  const text = String(raw || '').trim()
  if (!text) return { error: 'repo_url 不能为空' }
  if (text.includes('..') || text.includes('\\') || /\s/.test(text)) {
    return { error: 'repo_url 非法：禁止 ".."、反斜杠与空白字符' }
  }
  let url
  try {
    url = new URL(text)
  } catch {
    return { error: 'repo_url 不是合法 URL' }
  }
  if (url.protocol !== 'https:') return { error: 'repo_url 必须是 https:// （不接受本地路径/ssh/git 协议）' }
  const host = url.hostname.toLowerCase()
  const isGithub = host === 'github.com' || host === 'www.github.com'
  // gitlab.com 及其子域；自建 gitlab 形如 gitlab.<domain>，但排除仿冒的 gitlab.com.<attacker>
  const isGitlab =
    host === 'gitlab.com' ||
    host.endsWith('.gitlab.com') ||
    (/^gitlab[\w-]*\.[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) && !host.startsWith('gitlab.com'))
  if (!isGithub && !isGitlab) return { error: `仅支持 github.com / gitlab 系仓库（收到 ${host}）` }
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length !== 2) {
    return { error: 'repo_url 需形如 https://github.com/<owner>/<repo>（.git 后缀可选；不接受 /tree/ 子页面等深层路径）' }
  }
  const repo = segments[1].replace(/\.git$/i, '')
  if (!/^[\w.-]{1,100}$/.test(repo) || !/^[\w.-]{1,100}$/.test(segments[0])) {
    return { error: 'owner/repo 段含非法字符' }
  }
  return { owner: segments[0], repo: `${url.origin}/${segments[0]}/${repo}` }
}

function sanitizeName(raw) {
  const name = String(raw || '').trim().toLowerCase().replace(/\.git$/i, '')
  if (!name || name === '.' || name === '..') return { error: '名称非法' }
  if (!/^[\w][\w.-]{0,63}$/.test(name)) return { error: '名称只能含字母/数字/_/-/.（≤64 字符，字母开头）' }
  return { name }
}

// ---- 安装 -------------------------------------------------------------------
// git --progress 的 stderr 进度行（\r 分隔原地刷新），取最后一条有效进度。
const PROGRESS_RE = /^(?:remote:\s*)?(Receiving objects|Resolving deltas|Compressing objects|Counting objects|Enumerating objects|Updating files):\s*(\d{1,3})%\s*(.*)$/

export function parseGitProgress(text) {
  if (!text) return null
  const lines = String(text).split(/[\r\n]+/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = PROGRESS_RE.exec(lines[i].trim())
    if (m) return { phase: m[1], percent: Number(m[2]), detail: m[3].trim() }
  }
  return null
}

export function formatCloneProgress(p, elapsedMs) {
  if (!p) return '克隆中（尚无进度输出）'
  const parts = [`${p.phase} ${p.percent}%`]
  if (p.detail) parts.push(p.detail)
  if (typeof elapsedMs === 'number') parts.push(`已用 ${Math.round(elapsedMs / 1000)}s`)
  return parts.join('，')
}

function gitClone(url, dest) {
  const startedAt = Date.now()
  log(`clone 开始：${url}（--depth 1，超时上限 ${INSTALL_TIMEOUT_MS / 1000}s）`)
  return new Promise((resolveP, rejectP) => {
    let last = null
    let lastPhase = null
    let lastLogAt = 0
    const child = execFile(
      'git',
      ['clone', '--depth', '1', '--progress', url, dest],
      { timeout: INSTALL_TIMEOUT_MS, windowsHide: true },
      (err, _stdout, stderr) => {
        const elapsedMs = Date.now() - startedAt
        if (err) {
          if (err.killed) {
            rejectP(new Error(
              `git clone 超时（上限 ${INSTALL_TIMEOUT_MS / 1000}s）${last ? `，最后进度：${formatCloneProgress(last, elapsedMs)}` : '，无进度输出'}。` +
              '仓库可能过大或网络过慢：可重试一次；若持续超时，请换用更小的仓库。',
            ))
          } else {
            const msg = String(stderr || err.message || '').replace(/\r/g, '\n').trim().split(/\n/).filter(Boolean).slice(-3).join(' | ')
            rejectP(new Error(`git clone 失败：${msg || err.message}`))
          }
        } else {
          log(`clone 完成（${Math.round(elapsedMs / 1000)}s）`)
          resolveP({ cloneMs: elapsedMs })
        }
      },
    )
    // 进度节流：阶段切换立即打，同阶段 ≥5s 一条（避免 \r 刷屏）
    child.stderr.on('data', (chunk) => {
      const p = parseGitProgress(String(chunk))
      if (!p) return
      last = p
      const now = Date.now()
      if (p.phase !== lastPhase || now - lastLogAt >= 5000) {
        lastPhase = p.phase
        lastLogAt = now
        log(`clone 进度：${formatCloneProgress(p, now - startedAt)}`)
      }
    })
  })
}

function rmRf(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (err) {
    log(`rm ${dir} failed: ${err && err.message}`)
  }
}

// .staging 只作为临时克隆区：清空后把父目录也删掉，避免每次安装留一个空目录
function cleanupStagingRoot() {
  const root = join(roleSkillsRoot(), '.staging')
  try {
    if (existsSync(root) && readdirSync(root).length === 0) rmSync(root, { recursive: true, force: true })
  } catch (err) {
    log(`cleanup .staging failed: ${err && err.message}`)
  }
}

// 扫描安装目录内的 SKILL.md（深度 ≤3，跳过 .git/node_modules/dist 等噪音）
const SCAN_SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.github', '.vscode'])
function discoverSkills(installDir, maxDepth) {
  const found = []
  const walk = (dir, rel, depth) => {
    if (depth > maxDepth || found.length >= 24) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
      // 固定排序：不同文件系统的枚举顺序不一致，INDEX.md 需要可复现
      entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    } catch {
      return
    }
    for (const e of entries) {
      if (SCAN_SKIP.has(e.name)) continue
      const abs = join(dir, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isFile() && e.name === 'SKILL.md') {
        found.push(parseSkillMd(abs, r))
      } else if (e.isDirectory()) {
        walk(abs, r, depth + 1)
      }
    }
  }
  walk(installDir, '', 0)
  return found
}

function parseSkillMd(absPath, relPath) {
  let name = basename(join(relPath, '..'))
  let description = ''
  try {
    const text = readFileSync(absPath, 'utf8')
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    if (fm) {
      const nm = /^name:\s*(.+)$/m.exec(fm[1])
      if (nm) name = nm[1].trim()
      const dm = /^description:\s*(.+)$/m.exec(fm[1])
      if (dm) description = dm[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 读取失败保留目录名 */
  }
  if (description.length > 200) description = `${description.slice(0, 197)}...`
  return { name: name || relPath, description: description || '（SKILL.md 无 description）', relPath }
}

function renderIndexMd(role, entries) {
  const lines = [
    `# ${role} 角色扩展技能库索引`,
    '',
    `> 由 dsh-science v${VERSION} 自动生成（${new Date().toISOString()}）。`,
    '> 使用方式：用读文件工具按「路径」读取 SKILL.md，再按需读取其引用的同目录资源文件。',
    '> 本库只在 dsh-science 本插件内对本角色成员生效（不在 DSH 全局技能注册表）。',
    '',
  ]
  if (!entries.length) {
    lines.push('（该角色当前没有已安装技能。）')
  }
  for (const entry of entries) {
    const entryName = entry.name || '（未命名）'
    const entryDir = typeof entry.dir === 'string' && entry.dir ? entry.dir : join(roleSkillsRoot(), role, entryName)
    lines.push(`## ${entryName}`, '')
    if (entry.warn) {
      lines.push(`- ⚠ 状态：未发现 SKILL.md——该仓库不是标准 skill 结构，谨慎参考其内容。`)
    }
    for (const sk of Array.isArray(entry.skills) ? entry.skills : []) {
      if (!sk || typeof sk !== 'object') continue
      lines.push(`- **${sk.name}** — ${sk.description}`)
      const skillPath = typeof sk.relPath === 'string' && sk.relPath ? join(entryDir, sk.relPath) : entryDir
      lines.push(`  - SKILL.md: ${skillPath}`)
    }
    lines.push(`  - 来源: ${entry.repo || '（来源未知）'}${entry.subdir ? ` @ ${entry.subdir}` : ''}（${entry.license || 'license 未知'}）`)
    lines.push('')
  }
  return lines.join('\n')
}

function writeIndexForRole(role, state) {
  const entries = Array.isArray(state.roles[role]) ? state.roles[role] : []
  const dir = join(roleSkillsRoot(), role)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'INDEX.md'), renderIndexMd(role, entries), 'utf8')
}

// 安装入口（互斥队列内执行）。catalogId 与 repoUrl 二选一。
// cloneImpl 仅用于测试注入（签名同 gitClone：(url, dest) => Promise<{cloneMs}>）。
export async function installSkill({ role, catalogId, repoUrl, name, exec, cloneImpl }) {
  if (!ROLES[role]) {
    return { ok: false, error: `未知角色 ${role}（可用：${Object.keys(ROLES).join(' | ')}）` }
  }
  if (catalogId && repoUrl) {
    return { ok: false, error: 'repo_id 与 repo_url 只能二选一：精选目录用 repo_id，自定义仓库用 repo_url' }
  }
  let wakeCtx = null
  const out = await enqueue(async () => {
    const state = loadState()
    const roleEntries = Array.isArray(state.roles[role]) ? state.roles[role] : []
    let repo = null
    let subdir = ''
    let installName = null
    let license = null
    let description = ''
    if (catalogId) {
      const item = (CATALOG[role] || []).find((x) => x.id === String(catalogId))
      if (!item) {
        const ids = (CATALOG[role] || []).map((x) => x.id).join(' | ') || '（该角色目录为空）'
        return { ok: false, error: `目录中找不到 ${catalogId}（${role} 可选：${ids}）` }
      }
      const v = validateRepoUrl(item.repo)
      if (v.error) return { ok: false, error: v.error }
      repo = v.repo
      subdir = item.subdir || ''
      installName = item.id
      license = item.license
      description = item.description
      const exists = roleEntries.find((x) => x.name === installName)
      if (exists) {
        return { ok: false, error: `已安装：${installName}（${join(roleSkillsRoot(), role, installName)}）。无需重复安装。` }
      }
    } else if (repoUrl) {
      const v = validateRepoUrl(repoUrl)
      if (v.error) return { ok: false, error: v.error }
      repo = v.repo
      if (name) {
        const n = sanitizeName(name)
        if (n.error) return { ok: false, error: `name 非法：${n.error}` }
        installName = n.name
      } else {
        const n = sanitizeName(repo.split('/').pop())
        if (n.error) return { ok: false, error: `无法从 URL 推导目录名（${repo}），请提供 name 参数` }
        installName = n.name
      }
      license = null
      description = `自定义安装（${repo}）`
    } else {
      return { ok: false, error: '需要 repo_id（精选目录 id）或 repo_url（https github/gitlab 仓库）之一' }
    }
    const installDir = join(roleSkillsRoot(), role, installName)
    if (existsSync(installDir)) {
      return { ok: false, error: `已安装：${installName}（${installDir}）。无需重复安装。` }
    }
    // 克隆到同分区 staging（保证 rename 原子性），再拷贝 subdir 内容到安装目录
    const staging = join(roleSkillsRoot(), '.staging', `${installName}-${Date.now().toString(36)}`)
    mkdirSync(staging, { recursive: true })
    let cloneMs = null
    try {
      const r = await (typeof cloneImpl === 'function' ? cloneImpl : gitClone)(repo, staging)
      cloneMs = r && typeof r.cloneMs === 'number' ? r.cloneMs : null
      let srcDir = staging
      if (subdir) {
        srcDir = resolve(join(staging, subdir))
        const stagingReal = resolve(staging)
        if (srcDir !== stagingReal && !srcDir.startsWith(stagingReal + sep)) {
          return { ok: false, error: `subdir 非法（逃逸仓库根）：${subdir}` }
        }
        if (!existsSync(srcDir)) {
          return { ok: false, error: `仓库内不存在子目录 ${subdir}（请核对 ${repo} 的目录结构）` }
        }
        // 符号链接/目录联接可指向仓库外：realpath 后必须仍在 staging 内
        let srcReal
        try {
          srcReal = realpathSync(srcDir)
          const stagingCanon = realpathSync(staging)
          // Windows 路径大小写不敏感；其它平台按原样比较，避免放宽边界
          const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p)
          const rootReal = fold(stagingCanon)
          const targetReal = fold(srcReal)
          if (targetReal !== rootReal && !targetReal.startsWith(rootReal + sep)) {
            return { ok: false, error: `subdir 是符号链接且指向仓库外，拒绝安装：${subdir}` }
          }
        } catch (err) {
          return { ok: false, error: `无法解析子目录 ${subdir}：${err && err.message}` }
        }
      }
      mkdirSync(installDir, { recursive: true })
      cpSync(srcDir, installDir, {
        recursive: true,
        filter: (src) => {
          if (basename(src) === '.git' || src.includes(`${sep}.git${sep}`)) return false
          // 跳过符号链接：避免把仓库指向本机任意路径的链接带进技能目录
          try {
            return !lstatSync(src).isSymbolicLink()
          } catch {
            return false
          }
        },
      })
    } catch (err) {
      rmRf(staging)
      rmRf(installDir)
      return { ok: false, error: String(err && err.message) }
    } finally {
      rmRf(staging)
      cleanupStagingRoot()
    }
    // 结构发现：SKILL.md 扫描（子目录聚合仓库可发现多个技能）
    const skills = discoverSkills(installDir, 3)
    const entry = {
      name: installName,
      catalogId: catalogId ? String(catalogId) : null,
      repo,
      subdir: subdir || null,
      license,
      description,
      installedAt: Date.now(),
      dir: installDir,
      // warn：整仓未发现任何 SKILL.md（非标准 skill 仓库）
      warn: skills.length === 0,
      skills: skills.length > 0 ? skills : [{ name: installName, description: '（未发现 SKILL.md——非标准 skill 结构，INDEX 中仅登记路径）', relPath: '.' }],
    }
    state.roles[role] = [...roleEntries.filter((x) => x.name !== installName), entry]
    const stateText = saveState(state)
    try {
      writeIndexForRole(role, state)
    } catch (err) {
      log(`INDEX.md write failed: ${err && err.message}`)
    }
    mirrorState(exec, stateText)
    log(`skill installed: ${role}/${installName} (${repo}${subdir ? ` @ ${subdir}` : ''}, ${entry.skills.length} skill(s)${entry.warn ? ', WARN no SKILL.md' : ''})`)
    const out = {
      ok: true,
      role,
      name: installName,
      dir: installDir,
      cloneMs,
      indexMd: join(roleSkillsRoot(), role, 'INDEX.md'),
      skills: entry.skills.filter((s) => s && typeof s === 'object').map((s) => ({ name: s.name, description: s.description, path: s.relPath === '.' ? installDir : join(installDir, s.relPath) })),
      warn: entry.warn,
      note: entry.warn
        ? '该仓库未发现 SKILL.md（非标准 skill 结构），已登记但标记 warn。'
        : `已写入 INDEX.md。若相关成员已 spawn，用 sci_team_send 告知其新技能路径（成员提示词含新技能通知规则）。`,
    }
    wakeCtx = { role, entry }
    return out
  })
  // 自动唤醒（brief 待办 8）：放在互斥队列外，sendMessage 较慢时不阻塞其它安装/删除。
  if (out && out.ok && wakeCtx && typeof memberWakeHook === 'function' && exec && exec.agent) {
    try {
      const wr = await memberWakeHook(exec.agent, wakeCtx.role, wakeCtx.entry)
      out.wake = {
        attempted: true,
        targets: Number.isFinite(wr && wr.targets) ? wr.targets : 0,
        woken: Array.isArray(wr && wr.woken) ? wr.woken : [],
        failed: Array.isArray(wr && wr.failed) ? wr.failed : [],
      }
      if (out.wake.woken.length > 0) {
        out.note = `已写入 INDEX.md，并已自动通知 ${out.wake.woken.length} 名已 spawn 的 ${wakeCtx.role} 成员读取新技能（无需再手动 sci_team_send）。`
      }
    } catch (err) {
      log(`member auto-wake failed: ${err && err.message}`)
      out.wake = { attempted: true, targets: 0, woken: [], failed: [{ name: null, error: String(err && err.message) }] }
    }
  }
  return out
}

// 删除入口（互斥队列内执行）
export async function removeSkill({ role, name, exec }) {
  if (!ROLES[role]) {
    return { ok: false, error: `未知角色 ${role}` }
  }
  const n = sanitizeName(name)
  if (n.error) return { ok: false, error: `name 非法：${n.error}` }
  return enqueue(async () => {
    const state = loadState()
    const roleEntries = Array.isArray(state.roles[role]) ? state.roles[role] : []
    const entry = roleEntries.find((x) => x.name === n.name)
    if (!entry) {
      const names = roleEntries.map((x) => x.name).join(' | ') || '（无）'
      return { ok: false, error: `未安装：${n.name}（${role} 当前已安装：${names}）` }
    }
    rmRf(join(roleSkillsRoot(), role, n.name))
    state.roles[role] = roleEntries.filter((x) => x.name !== n.name)
    if (state.roles[role].length === 0) delete state.roles[role]
    const stateText = saveState(state)
    try {
      writeIndexForRole(role, state)
    } catch (err) {
      log(`INDEX.md rewrite after remove failed: ${err && err.message}`)
    }
    mirrorState(exec, stateText)
    log(`skill removed: ${role}/${n.name}`)
    return { ok: true, role, name: n.name, indexMd: join(roleSkillsRoot(), role, 'INDEX.md') }
  })
}

// 工作区镜像（与 team/blueprint 同款 makeMirror 通道）
function mirrorState(exec, text) {
  try {
    const fn = exec && exec.__sciSkillMirror
    if (typeof fn === 'function') fn('role-skills.json', text, exec)
  } catch {
    /* 镜像失败不影响主流程 */
  }
}

const OPTIONAL_INTEGRATIONS = Object.freeze([
  Object.freeze({
    id: 'scientific-figure-library',
    role: 'figure-expert',
    name: 'Scientific Figure Library（模板库）',
    kind: 'dsh-plugin',
    repo: 'https://github.com/xuzhougeng/ScientificFigureLibrary',
    installCommand: 'dsh plugin --profile web add scientific-figure-library',
    description: '本地优先的科研图件模板库：精确预览、版本/来源/许可记录与确认后复制；不执行绘图代码。安装后需重启 web profile。',
    license: '代码 MIT；FigureYa/Community/用户模板逐项核权',
  }),
])

// 供 httpdata /state 快照使用（客户端技能库面板数据）
export function skillMenuSnapshot() {
  const state = loadState()
  const catalog = Object.fromEntries(
    Object.entries(CATALOG).map(([role, items]) => [
      role,
      items.map((x) => ({ id: x.id, name: x.name, description: x.description, license: x.license, subdir: x.subdir || null })),
    ]),
  )
  const installed = Object.fromEntries(
    Object.entries(state.roles).map(([role, entries]) => [
      role,
      (Array.isArray(entries) ? entries : []).map((x) => ({
        name: x.name,
        catalogId: x.catalogId || null,
        warn: x.warn === true,
        skillNames: (Array.isArray(x.skills) ? x.skills : []).map((s) => s && s.name).filter(Boolean),
      })),
    ]),
  )
  return { catalog, installed, integrations: OPTIONAL_INTEGRATIONS.map((x) => ({ ...x })) }
}

// spawnMember 集成用：成员提示词的「扩展技能库」段（该角色已安装技能索引）。
// 无已安装技能时返回 ''（提示词保持精简）。隔离关键：只有对应角色拿到该目录索引。
export function roleSkillSectionText(role) {
  const state = loadState()
  const entries = Array.isArray(state.roles[role]) ? state.roles[role] : []
  const lines = [
    '## 扩展技能库（dsh-science 角色技能，仅你可用）',
    `用户为本角色安装了以下开源技能（位于 ${roleSkillsRoot()}/${role}/，不在 DSH 全局技能注册表——只属于本插件本角色）：`,
    `- 技能索引（含每个技能的一句话与 SKILL.md 绝对路径）：${join(roleSkillsRoot(), role, 'INDEX.md')}`,
    '- 使用方式：需要时先读索引，再按路径读取对应 SKILL.md 与其引用的资源文件；技能内容与你的角色铁律冲突时，以角色铁律为准。',
    '- 新技能通知：若队长消息告知某路径新增了技能（含 SKILL.md 路径），直接读取该 SKILL.md 后即可使用，无需等待重启。',
  ]
  if (entries.length > 0) {
    lines.push(
      '- 当前已安装：',
      ...entries.map((e) => `  - ${e.name}（${(Array.isArray(e.skills) ? e.skills : []).map((s) => s && s.name).filter(Boolean).join('、') || '无 SKILL.md'}）`),
    )
    return `\n\n${lines.join('\n')}`
  }
  return ''
}

// 通用计算模拟规范（simulator 专属）：新工具 8 步上手规范的绝对路径注入。
// 规范正文在插件 bundled skill（skills/sci-simulation/references/universal-tool-onboarding.md），
// spawn 时把绝对路径告诉成员（成员用读文件工具可达插件目录）。
export function universalOnboardingText(role) {
  if (role !== 'simulator') return ''
  const abs = join(PKG_ROOT_OF(), 'skills', 'sci-simulation', 'references', 'universal-tool-onboarding.md')
  return [
    '',
    '## 通用计算模拟规范（新工具上手铁律）',
    `遇到本角色未内置 dossier 的新工具/新模型时，必须先按「新工具上手 8 步规范」执行（版本核验→手册章节→最小模板→冒烟→见证→生产→诊断→登记 dossier），规范全文用读文件工具读取：`,
    abs,
    '（内置 5 个 dossier 见插件 skills/sci-simulation/references/tool-dossiers/；未内置的工具一律走 8 步规范，不许凭记忆直接写输入文件。）',
  ].join('\n')
}

// ---- 工具注册 ----------------------------------------------------------------
function toolRender() {
  return {
    schema: { type: 'object' },
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  }
}

export function registerSkillMenuTools(ctx, opts = {}) {
  const mirror = opts.mirror
  // makeMirror 的签名是 (name, text, exec)；skillmenu 内部 mirrorState 约定读 exec.__sciSkillMirror。
  // 这里把 mirror 挂到全局单例（插件级唯一，与其它模块 opts.mirror 注入方式等价）。
  if (typeof mirror === 'function') {
    mirrorHook = mirror
  }
  ctx.tools.register({
    name: 'sci_skill_menu',
    description:
      '查看某角色的精选技能目录与已安装技能（role-scoped skill menu）。role 可选：' +
      Object.keys(ROLES).join(' | ') +
      '。返回目录项（id/名称/仓库/许可）与各自安装状态。',
    parameters: {
      role: { type: 'string', description: `角色 id（必填）：${Object.keys(ROLES).join(' | ')}` },
    },
    output: toolRender(),
    async execute(args) {
      const role = String(args.role || '')
      if (!ROLES[role]) {
        return { ok: false, error: `未知角色 ${role}（可用：${Object.keys(ROLES).join(' | ')}）` }
      }
      const state = loadState()
      const installedEntries = Array.isArray(state.roles[role]) ? state.roles[role] : []
      const items = (CATALOG[role] || []).map((x) => {
        const inst = installedEntries.find((e) => e.catalogId === x.id || e.name === x.id)
        return {
          id: x.id,
          name: x.name,
          repo: x.repo,
          subdir: x.subdir || null,
          license: x.license,
          summary: x.description,
          installed: !!inst,
          installName: inst ? inst.name : null,
        }
      })
      const custom = installedEntries.filter((e) => !e.catalogId).map((e) => ({ name: e.name, repo: e.repo, installedAt: e.installedAt || 0, warn: e.warn === true }))
      return {
        ok: true,
        role,
        roleLabel: ROLES[role].label,
        catalog: items,
        customInstalled: custom,
        installedCount: installedEntries.length,
        indexMd: join(roleSkillsRoot(), role, 'INDEX.md'),
        installHint: 'sci_skill_install(role, repo_id) 安装精选目录项；或 sci_skill_install(role, repo_url=..., name=...) 安装自定义仓库（https github/gitlab）。',
      }
    },
  })
  log('tool sci_skill_menu registered')

  ctx.tools.register({
    name: 'sci_skill_install',
    description:
      '为本角色安装一个开源 skill 仓库（git clone --depth 1 到 dsh-science/role-skills/<role>/<name>/，生成 INDEX.md，只在 dsh-science 内对该角色成员生效）。两种用法：① repo_id=精选目录 id（先 sci_skill_menu 查看）；② repo_url=https://github.com/<owner>/<repo>（可加 name 指定目录名）。已安装会报「已安装」。',
    parameters: {
      role: { type: 'string', description: `角色 id（必填）：${Object.keys(ROLES).join(' | ')}` },
      repo_id: { type: 'string', description: '精选目录项 id（见 sci_skill_menu；与 repo_url 二选一）' },
      repo_url: { type: 'string', description: '自定义仓库 URL（https github/gitlab，形如 https://github.com/owner/repo；与 repo_id 二选一）' },
      name: { type: 'string', description: '安装目录名（仅 repo_url 时可选；缺省用仓库名）' },
    },
    output: toolRender(),
    async execute(args, exec) {
      const result = await installSkill({
        role: String(args.role || ''),
        catalogId: args.repo_id ? String(args.repo_id) : null,
        repoUrl: args.repo_url ? String(args.repo_url) : null,
        name: args.name ? String(args.name) : null,
        exec: { ...exec, __sciSkillMirror: mirrorHook },
      })
      if (!result.ok) throw new Error(result.error || '安装失败')
      return result
    },
  })
  log('tool sci_skill_install registered')

  ctx.tools.register({
    name: 'sci_skill_remove',
    description: '删除本角色已安装的技能（删目录 + 更新 INDEX.md）。name 为安装目录名（见 sci_skill_installed）。',
    parameters: {
      role: { type: 'string', description: `角色 id（必填）：${Object.keys(ROLES).join(' | ')}` },
      name: { type: 'string', description: '已安装技能目录名（必填）' },
    },
    output: toolRender(),
    async execute(args, exec) {
      const result = await removeSkill({ role: String(args.role || ''), name: String(args.name || ''), exec: { ...exec, __sciSkillMirror: mirrorHook } })
      if (!result.ok) throw new Error(result.error || '删除失败')
      return result
    },
  })
  log('tool sci_skill_remove registered')

  ctx.tools.register({
    name: 'sci_skill_installed',
    description: '列出某角色已安装的扩展技能（目录名/来源/SKILL.md 清单）与 INDEX.md 路径。',
    parameters: {
      role: { type: 'string', description: `角色 id（必填）：${Object.keys(ROLES).join(' | ')}` },
    },
    output: toolRender(),
    async execute(args) {
      const role = String(args.role || '')
      if (!ROLES[role]) {
        return { ok: false, error: `未知角色 ${role}（可用：${Object.keys(ROLES).join(' | ')}）` }
      }
      const state = loadState()
      const entries = Array.isArray(state.roles[role]) ? state.roles[role] : []
      return {
        ok: true,
        role,
        indexMd: join(roleSkillsRoot(), role, 'INDEX.md'),
        count: entries.length,
        installed: entries.map((e) => ({
          name: e.name,
          repo: e.repo,
          subdir: e.subdir || null,
          catalogId: e.catalogId || null,
          license: e.license || null,
          installedAt: e.installedAt || 0,
          warn: e.warn === true,
          skills: (Array.isArray(e.skills) ? e.skills : []).filter((s) => s && typeof s === 'object').map((s) => ({ name: s.name, description: s.description, path: s.relPath === '.' ? join(roleSkillsRoot(), role, e.name) : join(roleSkillsRoot(), role, e.name, s.relPath) })),
        })),
      }
    },
  })
  log('tool sci_skill_installed registered')
}

// 模块级 mirror 单例（由 registerSkillMenuTools 注入；与 makeMirror 同签名）
let mirrorHook = null
