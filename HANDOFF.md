# HANDOFF — dsh-science 科研工作台插件

> 交接文档 · 2026-11-08 · 版本 v0.10.0
> 仓库：https://github.com/SPYfighting/deepseek-science

---

## 一、这个东西是什么

**dsh-science** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的一个科研工作台插件。

核心主张：**把 DSH 从"聊天工具"变成"科研团队协作平台"**。一个会话 = 一个科研小队：

- 会话主 agent 是**队长（lead）**，唯一的人机接口
- 队长不亲自做科研执行工作，全部**派给 9 个专业角色成员**（鲸鱼娘吉祥物）
- 全部工作围绕**文章蓝图**（核心主张 → 3-5 个 Results → Tasks → 图表证据）组织
- 每个执行任务完成后默认派 **reviewer 审查**（数字溯源/图文一致/伪造检测）
- 负面结果触发蓝图重评，甚至证伪核心主张

**一句话**：让 AI 按照"写一篇能发表的论文"的路径来组织整个科研工作，而不是零散地回答问题。

---

## 二、你提出过的所有要求 · 逐条对照

### 1. 调研 Claude Science 功能与机制 ✅

| 要求 | 状态 | 怎么实现的 |
|---|---|---|
| 调研 Claude Science 功能 | ✅ | 抓取官方公告 + 42 页官方文档（claude.com/docs/claude-science）+ changelog + 社区评测 |
| 理解实现机制 | ✅ | 本机逆向：`~/.claude-science/runtime/`（agents/reviewer 提示词、compute/wrapper.sh.tmpl、drizzle schema）+ 用 REA 静态分析 web-dist bundle |
| 关键发现 | — | 20 个内建 MCP 连接器（各跑 micromamba env）；reviewer 是禁工具的只读 agent（"trace, don't recompute"）；SSH 作业 = 作业目录 + setsid 看门狗 + out/ 收割 + .phase 标记 |

**落地产物**：`docs/SPEC.md` §12「已核对的机制设计事实」+ 实现中的对照说明。

### 2. 借鉴开源 open science 项目 ✅

| 项目 | 借鉴了什么 | 落地位置 |
|---|---|---|
| [aipoch/open-science](https://github.com/aipoch/open-science)（5.5k★, Apache-2.0） | Review/Finding 数据模型（v2/v3）、ScopeBlock contentHash 防篡改、审查器动作流存档 | `lib/reviewer.js` |
| [synthetic-sciences/openscience](https://github.com/synthetic-sciences/openscience)（4.4k★） | 主 agent + 领域专家分层、RO-Crate 溯源思想 | 角色体系设计 |
| [ai4s-research/open-science](https://github.com/ai4s-research/open-science)（2.1k★, MIT） | review 技能包拆分（可追溯性/统计完整性/出版级图表） | `docs/ALIGNMENT-v09.md` |
| [PKU-YuanGroup/OpenAI4S](https://github.com/PKU-YuanGroup/OpenAI4S)（MIT） | no-fabrication policy、Guardian 审查边界 | reviewer 协议的 fabrication 检查项 |
| [AcademicForge](https://github.com/HughYau/AcademicForge)（MIT） | compute-env-setup 的作业形态分类学/验证阶梯（冒烟→见证→生产）/诊断表；scientific-visualization 三件套 | `skills/sci-simulation/`、`skills/sci-figures/` |
| [K-Dense scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)（MIT） | 工具档案模式（compatibility 元数据 / when-not-for / provenance / tested-example） | `skills/sci-simulation/references/tool-dossiers/`（5 个档案） |
| [PaperSpine](https://github.com/WUBING2023/PaperSpine) | 骨架先行、rationale matrix、结果权威原则 | 文章蓝图体系 |
| [ARS academic-research-skills](https://github.com/Imbad0202/academic-research-skills) | 8 阶段编排、Evidence Map、claim-evidence 链、review criteria pre-commitment | 蓝图 Results + 覆盖分析 |
| [nature-skills](https://github.com/Yuan1z0825/nature-skills)（52.4k★） | 技能覆盖全流程的组织方式 | skills 目录结构 |
| [dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（MIT） | **团队协作 UI 的像素级参照**：进度分段/花名册/任务卡/鲸鱼娘吉祥物/artwork.ts 角色映射/状态动作图 | `client-src/index.jsx`、`assets/mascots/` |
| [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)（MIT） | **Router/Worker 双层架构**（队长只分派不执行） | `lib/router.js` 队长协议 |
| [你的 my-academic-skills / scientific-ppt-drawing](https://github.com/SPYfighting/my-academic-skills/tree/main/scientific-ppt-drawing) | **SVG→原生可编辑 PPT 形状**管线（figure_cli validate/render/inspect/compatibility）、object plan 方法、视觉验收门 | `agents/presentation.md` + skill 菜单首项 |

### 3. 充分理解 DSH 插件规范 ✅

| 要求 | 状态 | 怎么实现的 |
|---|---|---|
| 符合插件规范 | ✅ | `package.json` 声明 `dsh.bundle.patch` + `dsh.client` + `engines.dsh`；`cordis.patch.yml` insert 行；纯 JS 依赖零生命周期脚本 |
| 兼容网页版 | ✅ | web profile 实测：三标签面板、HTTP 数据通道（`/plugins/dsh-science/state`）、吉祥物路由 |
| 兼容官方桌面版 | ✅ | 桌面版 runtime 同为 0.2.2-rc.1；无 webServer 时数据面板降级（README 已注明）；团队工具全可用 |
| 不与其他插件冲突 | ✅ | 全部命名空间隔离：`sci_*` 工具 / `sci-*` 命令 / `sci-data`+`sci-review` 资源协议 / `dsh-science/*` slot id / 唯一 patch row id |

### 4. 至少四大功能 ✅

| 功能 | 状态 | 实现要点 | 验证 |
|---|---|---|---|
| **绘图** | ✅ | 出版级规范 skill（Python matplotlib/seaborn + R ggplot2/patchwork，300dpi/色盲安全/双格式/期刊尺寸表）+ `sci_figure_register/list` 登记（magic bytes 校验、sha 版本链、幂等） | headless 真实登记 + 浏览器 img 加载实测 |
| **数据库连接** | ✅ | SQLite（node:sqlite）/PostgreSQL（postgres.js）/MySQL（mysql2）；只读守卫（语句白名单+多语句拒绝）；写操作走审批卡 | 真实 SQLite 端到端（web+headless） |
| **结果自动 review** | ✅ | 五项检查（数字溯源/断言-执行一致/图文一致/引用卫生/伪造）；证据源 `session.snapshotEvents()` 直读会话日志（绕过 web 事件总线限制）；子 agent 只读；fail 自动 followup 修正 | `/sci-review` 完整跑通（7 findings 落盘 + 面板同步） |
| **SSH 连接与管理** | ✅ | 纯 JS ssh2（esbuild 单文件捆绑）；profile 管理/probe（CPU/GPU/conda/调度器）/作业引擎（提交→等待→收割）/Slurm+直发/断连安全/诊断表 | **真实实验室主机**：os/cpu/mem/2×RTX3090 全字段探测成功 |

### 5. 科研工作台前端 ✅（经多轮重构）

| 阶段 | 结果 |
|---|---|
| v0.3 双模式五面板 | ❌ 被否决（"太垃圾"） |
| v0.4 双标签 | ❌ 被否决（"不如 agent team"） |
| v0.5 科研鲸鱼娘 + 花名册 | ⚠️ 部分通过 |
| **v0.7 任务流 DAG + 文章框架图** | ✅ 游戏化：吉祥物动作姿态（working/thinking/灰度离线）、状态四列、SVG 依赖箭头、点击详情、`+N 展开` |
| **v0.9 三标签定稿** | ✅ 团队（DAG）/ 文章框架（核心→Results→任务/图表 框架图）/ 产物（图表/文件树/远程/审查）|

**关键设计**：skill 完全不出现在 UI——由成员角色**自主使用**；唯一人机接口是队长。

### 6. 逆向 Claude Science ✅（部分）

| 要求 | 状态 | 说明 |
|---|---|---|
| 使用 REA | ✅ | `npx rea-agents analyze-javascript-application` 静态分析 web-dist bundle |
| 本机解剖 | ✅ | 直接读 runtime（reviewer 提示词机制、compute wrapper 模板、drizzle schema、29 个内置 skills 的组织方式） |
| 边界 | ⚠️ | 只做机制研究与行为对照，未复制任何闭源资产（原文、提示词、模板） |

### 7. Agent Team 模式（核心重构）✅

| 要求 | 状态 | 实现 |
|---|---|---|
| 全部模块做成专业 agent 角色 | ✅ | 9 角色：📚文献调研 / 💡课题设计 / 📈数据分析 / 🖥计算模拟 / 🧠模型训练 / 📊科研绘图 / 📝文章撰写 / 🔍科研审查 / 📽汇报PPT |
| 由主 agent 管理 | ✅ | 队长（Router）协议：只分派/只汇报，一条 SQL 也走 dispatch |
| reviewer 由主 agent 指派 | ✅ | `sci_review_send(scope)` 支持 turn/computation/evidence/journal 四类 |
| 不需要 review 时可自主判断 | ✅ | 协议：琐碎任务可免，但须说明理由 |
| 像素级学习 agent-teams | ✅ | 实测安装 agent-teams 插件对比；吸收进度分段/花名册/任务卡/吉祥物/状态动作；但用**科研鲸鱼娘**替代原鲸鱼 |
| 与 agent-teams 兼容 | ✅ | 零冲突；提供科研团队配置模板 `docs/recipes/agent-teams-science.md` |

### 8. 文章蓝图体系（最高优先级需求）✅

| 要求 | 状态 | 实现 |
|---|---|---|
| 核心主题/创新点/标题是核心 | ✅ | `sci_blueprint_set(title, claim, innovation, venue)` |
| 展开 3-5 个 Result | ✅ | `sci_result_add`（软上限 5/硬上限 6），五态：planned/in_progress/supported/negative/dropped |
| 每个 Result 有对应 Tasks | ✅ | `sci_team_dispatch(result_id)` 派单即对齐；双向回写（task.resultId + result.tasks） |
| 每个 Result 有对应图表结果 | ✅ | `sci_figure_register(result_id)` 登记即挂证据；框架图展示 |
| 负面结果→重评→证伪 | ✅ | `sci_result_update(status=negative)` 强制 notes；≥2 negative 且 0 supported → `falsificationRisk` 警告 |
| 队长按文章视角顶层设计 | ✅ | 队长协议全套规则（core 先行/派单带 result_id/回报更新/负面重评/文章视角汇报） |
| 文章框架 UI（流程图） | ✅ | 核心→Result→任务/图表 树状框架图 + 列表视图切换 |
| 主体和 Result 写入需用户确认 | ✅ | `confirmed` 字段 + `sci_blueprint_confirm`；未确认不能派单；修改已确认项须重新确认；UI 显示待确认/已确认徽章 |
| 每个 Result 有参考文献模块 | ✅ | `sci_result_reference_add(usedAs: method/concept/background/evidence)`；DOI 自动核对；UI 按 usedAs 分组 + 验证状态色 |

### 9. 计算模拟规范（Claude Science 借鉴）✅

| 要求 | 状态 | 实现 |
|---|---|---|
| 通用使用规范模板 | ✅ | `skills/sci-simulation/references/universal-tool-onboarding.md` 8 步（版本核验→手册章节→最小模板→冒烟→见证→生产→四层诊断→登记 dossier） |
| 高频工具内置 | ✅ | 5 个 dossier：GROMACS / Gaussian / Quantum ESPRESSO / LAMMPS / ASE（必查项 / 输入结构 / 已知坑 / 收敛判据 / 引用格式） |
| 新工具须查官方仓库/说明 | ✅ | 铁律：未完成 4 项核验就写输入文件 = 违规 |
| **可勾选 skill 菜单** | ✅ | 见下条 |

### 10. 角色级 Skill 菜单（勾选制，插件内隔离）✅

| 要求 | 状态 | 实现 |
|---|---|---|
| 每角色 ≤3 精选仓库 | ✅ | 27 项（9 角色 × 3），全部 GitHub API 核验可达+许可 |
| 用户可填自己仓库链接 | ✅ | 自定义 URL 输入（https 白名单、注入 7 组用例全拒）；你的 my-academic-skills 已作为 presentation 首项 |
| 不预先下载，勾选后下载 | ✅ | `sci_skill_install` → `git clone --depth 1` → `role-skills/<role>/<name>/` |
| **不全局生效、仅本插件** | ✅ | **不注册进 DSH 全局 skills registry**；只经成员 spawn 提示词的"扩展技能库"索引段生效 |
| 角色间隔离 | ✅ | 每角色独立目录 + 独立 INDEX.md；node 级验证零泄漏 |
| 可管理 | ✅ | `sci_skill_menu/installed/remove` + UI 勾选菜单 + 移除按钮 |

### 11. 汇报 PPT 角色 ✅

| 要求 | 状态 | 实现 |
|---|---|---|
| 汇报 agent 角色 | ✅ | 📽 presenter（`agents/presentation.md`） |
| 参考开源 PPT skill | ✅ | PPTAgent / academic-ppt-skill / open-ppt-skill 三仓库 |
| 参考**你的**科研 PPT skill | ✅ | scientific-ppt-drawing：SVG→原生可编辑 PPT 形状管线、figure_cli、object plan、视觉验收门 |
| 整理现有结果为汇报 PPT | ✅ | 输入 = blueprint overview + figure list + 任务回报；结构模板（封面→背景→方法→Results 图为主→结论→Q&A）；python-pptx 生成 | 
| 实测 | ✅ | `slides/demo_deck.pptx` 5 页实测生成（13.33×7.5in，Results 页嵌登记图） |

### 12. UI 与工程要求 ✅/⚠️

| 要求 | 状态 | 说明 |
|---|---|---|
| 侧栏只保留团队 + 产物（+文章框架） | ✅ | v0.9 定稿三标签 |
| 团队页游戏感（角色在干什么 / 流程图） | ✅ | 吉祥物动作姿态 + 依赖 DAG + 状态列 |
| 文章框架用流程图 | ✅ | 树状框架图 |
| 不显示 skill 调用 | ✅ | 全部移除，成员自主使用 |
| 不做防御性描述 | ✅ | 全仓清理（11 处），只保留简洁正向致谢 |
| 参考仓库全面对齐 | ✅ | `docs/ALIGNMENT-v09.md` 对齐矩阵 |
| 每轮至少 2 轮子智能体审核 | ✅ | 团队 UI 2 轮、蓝图 2 轮、DAG 2 轮（发现并修复 20+ 缺陷） |

---

## 三、未实现 / 未完成

| 项 | 原因 | 怎么补 |
|---|---|---|
| **npm publish** | 无 npm 账号 | 见 §五 操作指南 |
| **插件市场收录** | 需 GitHub PR / 手动提交 | `index.json` 已备好；向 `imsai-sh/awesome-deepseek-harness-plugins` 提 PR；`dsh-1024store` 提交 |
| presentation 角色第 2 轮对抗审核 | 子智能体额度用尽 | 按既定模式跑（模板见 DEVLOG） |
| 自动审查的 web 事件触发 | DSH 平台限制（第三方插件在 web profile 收不到 `session/event`） | 主路径 `/sci-review` 不受影响；可向 DSH 官方 Discussions 反馈 |
| 成员跨会话唤醒 | 平台边界（成员归属其 spawn 父会话） | 新会话 `sci_team_spawn_all` 重建 |
| Claude Science 完整逆向 | 只做机制研究 | REA 分析结果在 `research/rea-webdist-analysis.json` |

---

## 四、待办（按优先级）

### P0 — 发布收尾
1. **npm 发布**（需你操作，见 §五）
2. 插件市场收录 PR
3. presentation 角色第 2 轮对抗审核

### P1 — 功能增强
4. 证伪阈值可配置（现固定 ≥2 negative）
5. 任务 `blocked_by` 真正闸门（现仅记录）
6. 超大仓库 clone 进度反馈（现只有"处理中"）
7. spawn 后新安装 skill 的自动唤醒（现需 `sci_team_send`）
8. 审查 `evidence` scope 自动对照 blueprint claims 逐条核验

### P2 — 体验优化
9. 团队 DAG 窄栏适配（320px 下需横滚看末列）
10. 图表 lightbox 放大与大图对比
11. 蓝图导出 markdown 报告（`sci_blueprint_export`）
12. 工作区路径建议避免空格（DSH 沙箱 ACL 在含空格路径下有 Win32 5 报错）

---

## 五、npm 发布操作指南（给你的说明）

**你没有 npm 账号，按这个流程 5 分钟搞定：**

```bash
# 1. 注册账号（浏览器打开，用邮箱注册即可，免费）
#    https://www.npmjs.com/signup

# 2. 在本机登录（终端会打开浏览器，点授权即可）
npm login
#    输入用户名 / 密码 / 邮箱，或直接浏览器授权

# 3. 发布（包名已确认可用）
cd "D:/AI/task/DSH science/plugin/dsh-science"
npm publish --access public
```

**发布前检查**（我可以帮你做）：
- 包名 `dsh-science` 在 npm 上是否已被占用
- `package.json` 的 `files` 字段是否只含必要文件

**如果不想注册 npm**：GitHub 安装已经完全可用（已验证：`dsh plugin add github:SPYfighting/deepseek-science`），npm 只是让安装快一点、能被 npm 生态搜到。**不是必须项。**

---

## 六、怎么验证它还能用

```bash
# 1. 全新安装（模拟真实用户）
cd <任意测试目录>
export DSH_HOME=<隔离目录>
npx @deepseek-ai/dsh plugin --profile web add github:SPYfighting/deepseek-science

# 2. 启动
npx @deepseek-ai/dsh --profile web --no-open
# 从输出拿 token，浏览器打开 http://127.0.0.1:3080/?token=...

# 3. 界面验证
#    右栏 → 开始页 → 点「科研工作台」胶囊
#    团队 tab：成员花名册（鲸鱼娘吉祥物+状态点）+ 任务流 DAG
#    文章框架 tab：核心→Results→任务/图表 框架图
#    产物 tab：图表/文件树/远程主机/审查记录

# 4. 功能验证（会话内）
/sci-status                      # 模块状态
/sci_team_spawn_all              # 生成全队
"分析 demo.db 的差异表达基因"     # 队长自动建蓝图+派单
/sci-review                      # 审查最近一轮
```

**测试环境现状**（`D:/AI/task/DSH science/test-env`）：
- 隔离 DSH_HOME 在 `.dsh-home`，全局桌面版未受影响
- 已装：dsh 0.2.2-rc.1、dsh-science v0.10.0、dsh-agent-teams（对比用）
- 测试数据：demo.db（5 基因）、fig-demo.png、slides/demo_deck.pptx、团队 7 成员、蓝图 4 results

---

## 七、文件地图

```
D:/AI/task/DSH science/
├── docs/
│   ├── SPEC.md            # 功能规格说明书（含机制事实 §12）
│   ├── DEVLOG.md          # 开发日志（全部踩坑与教训，最新在最下）
│   ├── ALIGNMENT-v09.md   # 参考仓库对齐矩阵
│   └── recipes/agent-teams-science.md
├── plugin/dsh-science/     # ← 插件本体（已推 GitHub）
│   ├── lib/               # host 侧：index/team/blueprint/reviewer/ssh/db/figures/skillmenu/httpdata/router/roles
│   ├── client-src/        # UI 源码（三标签 + DAG + 框架图）
│   ├── agents/            # 9 个角色提示词
│   ├── skills/            # 8 个自主使用技能（含 5 个工具档案 + 通用规范）
│   ├── assets/mascots/    # 12 个科研鲸鱼娘 SVG
│   └── index.json         # 插件市场索引（format 1）
├── research/              # 参考仓库克隆（academicforge/kdense/ars/paperspine/agent-teams/superagent/你的仓库）
└── test-env/              # 隔离测试环境
```

---

## 八、最重要的教训（给接手的人）

1. **`git push` 后必须核对远端 HEAD 哈希** — orphan 重写会丢 upstream，`git push` 变空操作却打印误导信息
2. **嵌套 `node_modules` 永远不进 npm/pnpm pack** — vendored 依赖必须 esbuild 单文件捆绑
3. **DSH 工具参数名禁用注解关键字** — `title` / `description` / `default` / `enum` / `const` 会被编译器吞掉导致 DeepSeek 拒绝
4. **工具输出不能有值为 `undefined` 的键** — 无损 JSON 校验会拒绝
5. **同一文件超过 2 次字符串补丁必须整文件重写** — 否则结构会被 patch 弄坏
6. **web profile 下第三方插件收不到 `session/event`** — 证据源用 `session.snapshotEvents()` 直读
7. **headless 一次性进程会在异步任务完成前退出** — 异步验证要用常驻 web 会话
