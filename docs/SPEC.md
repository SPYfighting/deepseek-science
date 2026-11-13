# dsh-science 功能规格说明书

版本：v0.14.0 · 更新日期：2026-11-12 · 目标 DSH：`>=0.2.0 <0.3.0`（当前 0.2.2-rc.1）

对标基准：Anthropic Claude Science v0.1.47（本机逆向侦察 + 官方文档）；参考实现：aipoch/open-science（Apache-2.0）、OpenAI4S（MIT）、synthetic-sciences/openscience（Apache-2.0）、ai4s-research/open-science（MIT）。

---

## 0. 目标与非目标

**目标**：一个 DSH bundle（npm 包名 `dsh-science`），为 DSH 提供科研工作流四核心能力 + 工作台 UI：出版级绘图、数据库/科学数据源连接、结果自动 review、SSH 远程计算管理。网页版（`dsh --profile web`）与桌面版（Electron，desktop profile）均可安装运行，不与其他插件冲突。

**非目标（v1）**：不实现持久 Python/R 内核管理（复用 DSH 自身 shell/终端工具执行代码）；不做 Modal 云算力；不做文献 PDF 全文抓取代理；不做 GPU 模型端点管理。

**参考边界**：Claude Science 为闭源产品，本插件的对应实现均基于公开文档描述的机制独立编写（核对过的设计事实见 §12）。

---

## 1. 总体架构

```
dsh-science（单 npm bundle）
├── package.json          # dsh.bundle.patch + dsh.client + engines.dsh + exports["./client"]
├── cordis.patch.yml      # insert 1 行主插件（id: dsh-science）
├── lib/                  # host 侧编译产物（ESM）
│   ├── index.js          # 主插件 apply()：注册全部 host 能力
│   ├── db.js             # 连接池 + 工具实现
│   ├── ssh.js            # SSH 会话池 + 作业引擎
│   ├── reviewer.js       # turn/end 监听 + 审查执行器
│   └── skills.js         # ctx.skills 注册
├── client/               # 浏览器端 bundle（exports["./client"]）
│   └── index.js          # 工作台 tab + 卡片渲染 + 头部按钮
├── skills/               # SKILL.md 源文件（随包分发，经 provider 注册）
└── locale/zh.json,en.json
```

- 主插件 `inject: ['tools','commands','skills','sessions','subagents','credentials','schedule']`（按可用性降级：某服务缺失则跳过对应模块并 console.warn）。
- 依赖**全部纯 JS/WASM**（桌面版 allowBuilds 约束）：`ssh2`（SSH/SFTP）、`postgres.js`（Postgres）、`mysql2`（MySQL）、`sql.js`（SQLite WASM）。零生命周期脚本。
- **不使用 `ctx.webServer`**（桌面版不存在）。UI 全部走 `ctx.slots` / `ctx.resources` / `ctx.sidebarRightTabs`。

---

## 2. 工具规范（host 侧，经 `ctx.tools.register`）

命名前缀 `sci_`，避免与内建/其他插件冲突。所有工具返回单一 JSON（符合 output.schema）；基础设施错误抛异常（isError）；遵循 `exec.signal`。

### 2.1 数据库（通用 SQL）

| 工具 | 参数 | 行为 | 审批 |
|---|---|---|---|
| `sci_db_profiles` | `action: list\|add\|remove\|test`；add/remove 需 `name`；`profile?`（kind: sqlite\|postgres\|mysql，path(sqlite)、host/port/user/database/url、credentialsRef、password） | 管理连接配置；`test` 验证连通并列出 schema 概要 | add/remove 需 `tools/pre-execute` ask |
| `sci_db_tables` | `profile`, `table?` | 列出表/视图；给出 table 时返回该表列定义 | 只读，免审 |
| `sci_db_query` | `profile`, `sql`, `max_rows?=200` | **只读守卫**：语句级白名单解析（仅 SELECT/WITH/EXPLAIN/PRAGMA 只读项）；行数上限 | 免审；超限截断并提示 |
| `sci_db_execute` | `profile`, `sql` | 写操作（INSERT/UPDATE/DDL）。**必须先经审批卡**（pre-execute 返回 `ask`） | 每次审批 |

凭据：当前版本密码存本机 `$DSH_HOME/dsh-science/db-profiles.json`（不写日志、不回显）；`ctx.credentials` 接入为后续项。

### 2.2 科学数据源（REST，只读免审）

> 当前 v0.11.0 仅实现 `sci_doi_verify`。下表前三行是规划项（未注册工具）：现版本由宿主 `web_search` / `web_fetch` 直接访问公开接口完成检索，再交给 `sci_doi_verify` 核对 DOI。

| 工具 | 覆盖 | 要点 |
|---|---|---|
| `sci_lit_search`（规划） | PubMed(E-utilities)、OpenAlex、arXiv、Crossref | 统一返回 `{source, id, title, authors, year, doi, venue, citedBy, abstract?}`；限速 1 req/s（对齐 Claude Science 礼仪）；OpenAlex 需用户 mailto 配置 |
| `sci_protein_get`（规划） | UniProt、RCSB PDB | 按 accession 取序列/功能注释/PDB 文件路径 |
| `sci_chem_lookup`（规划） | ChEMBL、PubChem | 分名→结构/活性查询 |
| `sci_doi_verify` | Crossref | 输入 DOI/引用串 → 返回真实元数据（供 reviewer 与人工核对引用） |

### 2.3 SSH 远程计算

| 工具 | 参数 | 行为 | 审批 |
|---|---|---|---|
| `sci_ssh_profiles` | `action: list\|add\|remove\|import`；add/remove 需 `name`；`profile`（host, username, port?, auth: agent\|key\|password, keyPath?, password?, scratch?） | 管理主机档案；import 只读解析 `~/.ssh/config` 的 Host 列表 | add/remove/import ask |
| `sci_ssh_probe` | `profile` | 一次性连接收集：CPU/内存/GPU(nvidia-smi)/conda|micromamba/模块命令/调度器(sbatch|qsub)/scratch 目录/磁盘余量 → 存为 profile.details（对齐 Claude Science 探测字段集，原创实现） | 免审（只读命令） |
| `sci_ssh_exec` | `profile`, `command`, `timeout_s?=120` | 短命令执行（探测/状态类）。pre-execute ask；审批策略可按 profile 记忆 | ask |
| `sci_job_submit` | `profile`, `name`, `script`, `mode: auto\|slurm\|direct`, `walltime_s?=1800`, `inputs?[]`, `env?` | **作业引擎**（§5）。返回 job id；作业目录 `<scratch>/dsh-sci-jobs/<name>-<ts>/` | ask（卡片显示完整脚本+主机+资源） |
| `sci_job_status` | `profile`, `job?` | 列出/查询作业状态（只读远端 `.phase` 标记） | 免审 |
| `sci_job_logs` | `profile`, `job`, `lines?=100` | 回传 stdout.log/stderr.log 尾部 | 免审 |
| `sci_job_harvest` | `profile`, `job` | 拉回 `out/`（tar.gz）到 `$DSH_HOME/dsh-science/jobs/<job>/out/`；>100MB 的文件留在远端仅记录路径（对齐 Claude Science 策略） | 免审 |
| `sci_file_push` / `sci_file_fetch` | `profile`, `local`, `remote` | SFTP 传输 | ask |

### 2.4 绘图辅助

| 工具 | 行为 |
|---|---|
| `sci_figure_plan` | 绘图前声明 title/result/claim/target journal/最终宽度/统计说明/源数据路径/模板来源、版本与许可；返回 plan id |
| `sci_figure_register` | 绑定 `plan_id` 登记 PNG/JPEG/SVG/GIF/WebP/TIFF/PDF，校验扩展名与 magic bytes，静态 SVG 拦截可执行内容；记录代码、源数据、sha 与版本链 |
| `sci_figure_audit` | 自动检查格式、最终尺寸、有效 dpi/矢量容器、代码/源数据、统计说明、模板许可；人工终审需显式 decision 与依据，且自动 fail/warn 未清除时不能批准 |
| `sci_figure_list` | 当前会话图库清单（路径+元数据） |

---

## 3. 审查器规范（结果自动 review）

**数据模型**（借鉴 aipoch v2/v3 与 Claude Science REVIEWER 机制，原创实现）：

- `ReviewRun { id, sessionId, turn, trigger: manual|auto, status: running|done|error, startedAt }`
- `Finding { severity: pass|warn|fail, check: string, claim?, evidence?, message }` —— pass/warn/fail 全部为一等记录。
- 审查器自身动作流存档（ReviewerLog），便于"View reviewer transcript"。

**检查项**（v1 集合；用户可在配置中追加，不可削弱内建项）：

1. `number-traceability`：回复中的关键数字能否在 tool/result 或产物中找到出处（无法溯源≠问题，**矛盾才算 fail** —— "trace, don't recompute" 原则）
2. `figure-code-consistency`：`sci_figure_register` 登记的图与其生成代码/执行结果一致性
3. `citation-check`：抽查引用的 DOI 真实性（`sci_doi_verify`）
4. `plan-completion`：若本会话有计划，检查声明完成的步骤是否真的有对应执行记录
5. `fabrication-guard`：是否出现 np.random 伪造数据、无执行却声称已计算等（结合 tool/result 流判断）

**执行方式**：

- 触发：① 手动 `/sci-review [N]`（默认审查上一 turn）；② 工作台"审查"按钮；③ 可选自动模式（配置 `autoReview: false` 默认关；开启后监听 `session/event` + `event.type==='turn/end'`，节流：每会话至少间隔 60s、运行中不叠加）。
- 执行器：`ctx.subagents.startActivation({ provider: 'subagent-fork-in-process', delivery: 'caller', outputSchema, prompt })` 派生审查子 agent；子 agent 系统提示词包含：只读约束（不修改任何文件）、只引用审查窗口内读到的证据、按 severity 输出 JSON。
- 证据供给：审查 prompt 附带该 turn 的 `tool/call`+`tool/result` 事件摘要 + 产物路径清单（审查子 agent 可用只读文件工具与 `sci_doi_verify`）。
- 结果交付：`agent.inject()` 注入审查摘要消息（不唤醒 driver，用户下一条消息时模型可见）+ 工作台审查记录面板更新；`fail` 项同时以资源卡片 `dsh-resource://sci-review/<runId>` 内嵌展示。可选 `correctOnFail: true` 时改用 `agent.followup()` 要求主 agent 修正（默认关，省 token）。

---

## 4. 绘图规范（skills）

skills 经 `ctx.skills.registerProvider` 注册，随包内 `SKILL.md` 分发（kebab-case 名）：

| Skill | 内容要点（原创撰写） |
|---|---|
| `sci-figures` | `plan → generate → register → audit → manual review` 工作流；最终物理尺寸/有效 dpi、可编辑文字、色盲安全色板、PDF/SVG+PNG 导出、源数据与模板许可追溯 |
| `sci-figures-r` | ggplot2 同上（theme_classic 基线、ggsave 双格式） |
| `sci-db-analysis` | 数据库分析工作流：先 `sci_db_tables` 摸 schema → 只读查询 → 大结果落盘而非塞上下文 → `sci_db_execute` 前必须征得用户同意 |
| `sci-remote-jobs` | 远程作业工作流：probe → 写脚本 → `sci_job_submit` → 轮询 status → harvest；长任务用 nohup 模式；禁止交互式命令 |
| `sci-literature` | 文献检索工作流：`web_search` / `web_fetch` 多源交叉 → `sci_doi_verify` 核对 → 引用格式化；不得编造 DOI |

---

## 5. SSH 作业引擎设计（原创实现，机制对齐 Claude Science run/wrapper 模板）

- 作业目录：`<scratch>/dsh-sci-jobs/<name>-<ts>/`，内含 `run.sh`（用户脚本）、`wrapper.sh`、`.job_env`、`out/`。
- direct 模式：`setsid timeout --foreground` 后台执行，wrapper 带超时看门狗（TERM→grace→KILL），结束后 `tar -czf out.tar.gz out stdout.log stderr.log`，写 `.phase` 标记 `done:<rc>:<wall>` / `harvest_failed:<rc>:<wall>` / `job_timeout_fired`。
- slurm 模式：生成 sbatch 脚本（partition/walltime/mem/gpu 参数来自 probe 的 details），提交后轮询 squeue；作业完成经 `sacct` 状态确认后 harvest。
- 断连安全：作业目录状态全部落远端文件，重连后 `sci_job_status` 恢复视图（对齐"提交→等待→收割，作业不因连接丢失而失败"）。
- 并发：每 profile 默认并发作业上限 20（可配）；`sci_job_submit` 超限拒绝。

---

## 6. 工作台 UI 规范（client 侧）

- 右栏标签页：`ctx.sidebarRightTabs.register({ id: 'dsh-science/workbench', kind: 'workbench', title: '科研工作台' })` + `ctx.slots.inject('sidebar.right.pane.tab', ...)`。三个子面板（tab 内部切页，不占额外 slot）：
  1. **团队**：成员状态卡、当前任务、Result 筛选、任务 DAG/列表、依赖聚焦和队长收件箱。
  2. **文章框架**：核心→Results→任务/图件；每个 Result 显示确认、任务、文献核对、图件终审、主张审查与下一步。
  3. **产物**：图件计划、登记图件及前检明细、文件树、SSH 作业和审查历史。
- 头部按钮：`conversation.session.header.actions` 注册 `审查` 按钮（useSession 判断 idle 才可点）→ 等效 `/sci-review`。
- 输入区：`conversation.input.activity` 注册"审查此轮"快捷动作。
- 资源协议（每个协议唯一 provider，注册于主插件 client 模块）：`sci-figure`（图查看卡片）、`sci-review`（审查报告卡片）、`sci-job`（作业状态卡片）。会话中模型产出经 host 侧登记后以这些地址内嵌渲染。
- i18n：`locale/zh.json` + `en.json`（meta.title 等），中文优先。

---

## 7. 打包与兼容清单

- `package.json`：`type: module`；`main: lib/index.js`；`exports: { ".": …, "./client": … }`；`files: [lib, client, skills, cordis.patch.yml, locale, icon.svg]`；`dsh.bundle.patch: ./cordis.patch.yml`；`dsh.client: { platform: 'web' }`；`engines.dsh: ">=0.2.0 <0.3.0"`；peer+dev：`@deepseek-ai/cordis`、所需 `@deepseek-ai/dsh-*` 类型包。
- 客户端 bundle 用 DSH 同款 tsdown client preset（实现时对照 `packages/client/tsdown.client.ts` 校准输出格式）。
- 桌面版核对表：无 webServer 依赖 ✓；无 lifecycle 脚本 ✓（零原生构建）；`sidebar.right.pane.tab` 等插槽在桌面内嵌 Web UI 的可用性——**P2 首项验证**；credentials 引用不落明文 ✓。
- 冲突自查：唯一 tool 名（`sci_` 前缀）、唯一 slot id（`dsh-science/*`）、唯一资源协议（`sci-*`）、唯一命令名（`sci-review` 等）、唯一 MCP serverName（v1 无）；patch 行 id 唯一。

---

## 8. 测试与验收

| 项 | 验收标准 |
|---|---|
| 安装 | 隔离 `DSH_HOME` + `dsh plugin --profile scidev add ./dsh-science` 成功；`dsh --profile scidev web` 启动无错误日志 |
| UI | 右栏出现"科研工作台"；图库/审查/连接三面板可切换；会话内可内嵌渲染 figure/review 卡片 |
| DB | 对本地 SQLite 与（可用时）Postgres 完成建表→查询→审批写→回滚演示；只读守卫拦截 DROP |
| SSH | 对本机 sshd 或用户远端（121.192.172.68 已有先例）完成 probe→submit(sleep+写out)→status→harvest 全链路 |
| 绘图 | 让模型按 `sci-figures` 生成出版级图并登记，图库可见 |
| Review | 构造含"无出处数字/假 DOI"的 turn，`/sci-review` 能产出对应 fail finding；自动模式开启后 turn/end 触发一次且节流生效 |
| 兼容 | 与 `dsh-pet` 等现有插件共存加载无冲突；桌面 profile 安装校验通过（无 allowBuilds 拒绝） |

---

## 9. 开放问题（P2 优先验证）

1. **桌面版 client bundle 加载**：client-modules 文档称其 HTTP 组合路由属 web GUI 栈，Electron "installation is a separate flow"——需实测插件 client 在桌面 profile 是否渲染；若不可用，降级方案：桌面版保留 host 能力 + 会话内文本输出（UI 仍可用资源卡片？需实测），文档明示差异。
2. `ctx.credentials` 对第三方插件的可写性（SSH/DB 密码存储）；不可写则用本机加密文件（对齐 Claude Science hosts.json+hosts.key 模式，原创实现）。
3. `subagent-fork-in-process` provider 在 web/desktop profile 的默认可用性。
4. `ctx.remote`（Typert Remote）自定义 namespace 的注册方式（slots 之外 client↔host 通信的主通道）。

---

## 10. 里程碑对应

P2=§1 骨架+验证§9.1；P3=§2-§5；P4=§6；P5=§7-§8；P6=发布。

## 11. 依赖清单（全部纯 JS）

`ssh2`、`postgres`（postgres.js）、`mysql2`、`sql.js`、`tar-stream`（或内建 zlib 流）、dev: `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`、`typescript`、`tsdown`。

## 12. 已核对的机制设计事实（实现参照）

- Claude Science：20 个内建 MCP 连接器按领域拆分、跑在 micromamba env；REVIEWER 为禁工具只读 agent，"trace, don't recompute"，矛盾才算发现；SSH 作业 = 作业目录 + setsid/timeout 看门狗 + out/ 打包收割 + `.phase` 标记；凭据 hosts.json+hosts.key 本机加密；产物 5 页签溯源（消息/代码/执行日志/环境/审查）。
- aipoch：reviewer 独立会话 + 单一自有 MCP server + 权限锁死（非本 MCP 工具一律拒绝）；Review/Finding 表模型（v2/v3）；ScopeBlock contentHash 防篡改；审查器动作流全存档。
- DSH 官方 auto-review（experimental）：是工具调用风险分类 preset（low/medium/high → allow/ask/deny），与本项目"结果审查"互补；重逻辑：fail-closed、审查提示词不进会话日志（缓存友好）。

## 13. 用户配置 config.json（v0.11.0）

位置 `$DSH_HOME/dsh-science/config.json`（store.js `configOf`），手动编辑、改即生效（每次读取现解析，无缓存）。
文件缺失/解析失败/结构非法 → 按默认值运行（解析失败 console.error 报警，不隔离不改写用户文件）。

| 键 | 类型 | 默认 | 消费方 | 语义 |
|---|---|---|---|---|
| `falsificationThreshold` | 正整数 | 2 | blueprint.js `coverageOf` | negativeCount ≥ 阈值且 supportedCount=0 → falsificationRisk 警告；非法值（非整数/<1/NaN）回落默认 |
| `blockedGate` | `"warn"` \| `"hard"` | `"warn"` | team.js `sci_team_dispatch` | warn：依赖未达终态仍派发，输出 `dependencyGate:{mode,unresolved:[{id,status}]}`；hard：存在未达终态（含 missing）依赖即 throw 拒绝派发，任务板不新增。终态 = completed / failed / cancelled / deleted（失败/取消的依赖不再永久卡死下游） |

审查器契约（v0.11.0 钉死，回归测试覆盖）：`ctx.subagents.startActivation` 的 spec 为
`{provider:'spawn', delivery:'caller', label, request:{prompt,parent}, signal}`——signal 只在 spec 层
（request 内放 signal 属契约违规）；结果等待经 `awaitActivationResult`（有界超时 + 错误路径 dispose）。
`parseFindings`：fenced JSON 块优先 → 全文按每个 `{`/`[` opener 取平衡 span（单遍栈扫描 O(n)，
字符串/转义感知，含内层片段，解析上限 2000 span）→ `normalizeFindings`（空数组合法但**不遮蔽真实
findings**；候选按 fail 数优先、其次条目数打分取最优，非空 pass 诱饵无法压过真实 fail；全空才返回 []；
全垃圾=null 触发一次重试）。severity 归一 `trim().toLowerCase()` + 别名表（error/fatal/critical/high→fail，
warning/medium→warn，ok/success/passed→pass）；**缺失/未知 severity 一律按 fail 处理**（fail-closed，
不再静默降级为 warn）。条目必须含非空 `message` 或 `claim` 才保留（纯垃圾对象剔除）；超过 200 条时
**先保留全部 fail**，只截断 pass/warn（大量 pass 不能把 fail 挤出窗口）。单 span 上限 1MB——超大
嵌套片段不做 slice（避免 O(len) 阻塞主线程），无有效候选时返回 null。span 预算（2000）耗尽时返回
null 而非 []——截断结果可能漏掉真实 fail，宁可重试。
不平衡 prose 花括号（如 `if (x) {`）或包裹 JSON 的 prose 括号不再吞掉内层真实 JSON。结果等待
dispose 亦有 3s 宽限，挂起的 teardown 不阻塞。派生子 agent 唤醒只把 `throwIfAborted` 视为已送达；
其他 abort 报错按失败上报，不虚报 woken。

SVG 安全（v0.11.0，登记与下发双闸门）：登记时扩展名白名单 + magic bytes，SVG 文本经
`svgActiveContentReason` 检测 script 标签（含 `<svg:script>` 等命名空间前缀）/ on* 事件属性 /
javascript:·vbscript:·data:text/html·data:image/svg+xml URL / xml-stylesheet 处理指令 /
foreignObject·iframe·embed·object HTML 嵌入标签（iframe srcdoc 会把 `&lt;script&gt;` 解码执行）/
DOCTYPE ENTITY；字符引用解码（含省略分号的 `&#106` 形式）、XML 注释先剥离（防注释内诱饵干扰）、
标签抽取**单遍线性扫描 + 引号感知属性解析**（属性值里的合法 `>` 不截断标签；`a="b"onload=…`、
`<svg/onload=…>`、`/onload`、命名空间形式 `ev:onload` 均识别；`title="onload=x"`、`data-onclick`
不误伤）、`<style>` 体与 `style=` 属性内的 `javascript:`/`vbscript:`/`expression(` 一并拒绝
（CSS 十六进制转义 `\6a avascript:` 先还原再检测）；UTF-16LE/BE（BOM 或首字节 `3C 00`/`00 3C`
的无 BOM 形态，奇数尾字节先截齐）先解码再安检。命中拒绝登记。**下发闸门**：`/plugins/dsh-science/file` 在读盘后再次用同一
检测器扫描 SVG，命中返回 403 `refused: SVG contains active content (…)`；SVG 响应统一带
`Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:` 与
`X-Content-Type-Options: nosniff`（登记后文件被替换也挡住执行）。
已知取舍（fail-closed）：foreignObject / data:image/svg+xml 会误伤部分 draw.io、PowerPoint 导出的
正常 SVG——安全优先，需嵌入时改导出为 PNG/PDF。

## 14. 角色级 skill 菜单（v0.10.0；v0.11.0 增强）

- 存储：`$DSH_HOME/dsh-science/role-skills/<role>/<name>/`（`git clone --depth 1`，`execFile` 无 shell）。
  URL 白名单：https github.com / gitlab.com（含子域）与自建 `gitlab.<域名>`，仅 owner/repo 两段，禁本地路径/ssh/`..`；`gitlab.com.<其他域>` 这类仿冒域名拒绝。角色索引隔离 = 每角色独立目录 +
  只有对应角色的 spawn 提示词携带该目录 INDEX.md 索引；不进 DSH 全局技能注册表。
- 安装/删除走模块级互斥队列防并发 clone；克隆到同分区 staging 再拷贝 subdir（不 rename 源目录），
  失败时清理 staging 与半成品安装目录；`repo_id` 与 `repo_url` 只能二选一，同时提供直接报错。
- 拷贝与发现规则：跳过 `.git` 与符号链接/目录联接（防止把仓库外本机路径带进技能目录）；精选 subdir 用
  `realpath` 复核，指向仓库外的链接直接拒绝；SKILL.md 扫描深度 ≤3、跳过 node_modules/dist/build/.github 等噪音、
  按名称排序保证 INDEX 可复现；未发现 SKILL.md 时仍登记并标 `warn:true`。
- 删除：删安装目录 + 从 `role-skills.json` 移除条目 + 重写 INDEX.md（无剩余技能时写「没有已安装技能」）。
- 状态容错（v0.11.0）：读取时归一化 `roles`（数组→对象），过滤条目数组里的 null/字符串/数组，避免损坏的
  `role-skills.json` 让 spawn 提示词或 `/state` 快照抛错；`.staging` 清空后连父目录一起删除。
- **clone 进度反馈（v0.11.0）**：`git clone --progress` 的 stderr 按阶段（Counting/Compressing/Receiving/
  Resolving/Updating）解析，阶段切换立即打日志、同阶段 ≥5s 节流；超时（120s）报错附最后进度与已用时长；
  安装结果含 `cloneMs`。
- **spawn 后自动唤醒（v0.11.0）**：`installSkill` 成功且由主会话触发（`exec.agent`）时，经
  `setMemberWakeHook` 回调 `team.wakeRoleMembers`，按 role 找到已 spawn 成员（有 childId）推送
  `formatSkillWakeText`（INDEX.md + SKILL.md 绝对路径）；输出 `wake:{attempted,targets,woken,failed}`。
  唤醒在安装互斥队列之外执行，sendMessage 慢时不阻塞其它安装/删除。
  Web UI（无 agent）安装跳过唤醒；skillmenu→team 无反向依赖。

## 15. 主张级审查覆盖（v0.11.0）

目的：把「文章蓝图」与「审查」打通——蓝图里每条已确认主张（core + `res-N`）自动对照审查记录，
回答「这条结论被审过吗、结论是什么」，而不是只看会话级 findings。

- 数据源：`$DSH_HOME/dsh-science/reviews.json` + 蓝图 `blueprint.json`（`lib/reviewcov.js`，
  只读、解析失败按空记录，不影响 blueprint 主流程）。
- 口径：只统计 `check === 'blueprint-claim'` 的 finding；runs 按 `finishedAt` 升序，同一 claim 以
  **最近一次** run 为准；一次 run 内同一 claim 多条 finding 取最重 severity（fail>warn>pass）。
- 匹配：finding 的 `claim` 先按归一化文本（NFKC 全半角折叠 + 空白折叠 + 小写）**精确匹配**，
  再退化为长度 ≥12 的包含匹配且命中必须唯一；文本无解或歧义时才用 `core` / `res-N` 前缀
  （大小写不敏感，接受 `:`/`：`/`-`/空格分隔）消歧。文本优先保证「Core …」开头的 result 主张
  不会被 core 槽劫持；前缀仍可作为审查器自报 id 的兜底。无法唯一确定 → 不匹配（宁可标「未审」）。
- 时间：`finishedAt` 接受毫秒数或 ISO 字符串（无效按最旧 0）。
- 输出 `reviewCoverage`：`{ core, results:[{id,claim,confirmed,status,severity,message,runId,reviewedAt}],
  counts:{total,reviewed,fail,warn,pass,unreviewed}, warnings:[…] }`。
- 警告：完全无审查记录 → 提示先补一次 `sci_review_send scope=evidence`；已确认主张最近被判 fail →
  点名 runId 与理由，要求先处理再对外声称；已有审查但某确认主张仍未审 → 列出 id。
- 消费方：`/state` 蓝图 payload 附带 `reviewCoverage`；`sci_blueprint_overview` 返回同字段；
  `sci_blueprint_export` 的 Markdown 增加「## 主张审查覆盖」（已审 X/Y + 逐条 severity/runId/message
  + 警告）；工作台「文章框架」页新增「主张审查覆盖」面板，列表每行带 `审✓/审!/审✗/未审` 徽章。
- 验收证据：13 条单测（匹配/大小写/最近一次/前缀/包含歧义/check 过滤/run 内取最重/fail 警告/无记录/
  损坏 JSON/数组形态/空 claim/确认未审/runner-fail 忽略）；集成脚本 `research/v011-tests/
  reviewcov-integration.mjs`（真实 blueprint 工具 + 临时 DSH_HOME，counts 与 export 断言）；
  截图 `research/v011-tests/web-07-reviewcov.png`。

## 16. 团队 DAG 依赖聚焦（v0.11.0）

- 纯函数 `lib/dag.js`：`normalizedBlockedBy(task)` 归一 blockedBy（去空/非字符串/重复/自环）；
  `normalizeTaskBoard(tasks)` 剔除 null/标量任务并归一 blockedBy（client 入库前统一调用，手改
  team.json 不会让整个工作台崩溃）；`dependencyClosure(id, tasks)` BFS 返回
  `{upstream, downstream, related}`，环安全、缺失依赖忽略、未知起点返回空集。client 与单测共用同一实现（esbuild 随 bundle 打包）。
- 交互：DAG 节点悬停（无延迟）或点击选中 → 高亮该节点上下游整条依赖链：链上边
  加粗着色（`data-dag-hot`），无关节点透明度 0.32（`data-dag-dimmed`），无关边透明度 0.18；
  选中状态优先于悬停。`Esc` 收起选中详情；节点可键盘聚焦（tabIndex，focus/blur 等同悬停）。
- 详情卡：依赖（上游）chips 之外新增「解锁」下游任务 chips（`data-task-downstream`），两处 chip
  均可点击跳转并自动展开被 +N 折叠的节点。
- 验收：7 条闭包单测（链/菱形/环/缺失/未知起点/自环/归一），headless 实测
  `research/v011-tests/web-dag-focus.mjs`：悬停 task-2 → focused=[task-2]、dimmed=[task-6]、
  5 条 hot 边；详情含 依赖 task-1 / 解锁 task-3,4,5；Esc 后详情消失；截图
  `research/v011-tests/web-09-dag-focus.png`。

## 17. 审查载荷瘦身与详情懒加载（v0.11.0）

- 背景：`/state` 被工作台每 3s 轮询；`reviews` 曾内联全部 run 的 findings，真实测试库 98 个 run 时
  单次快照 208KB（其中 reviews 187KB）。
- `lib/reviewruns.js`：`reviewSummariesOf(raw)` 输出摘要 `{id,key,status,trigger,turn,sessionId,
  startedAt,finishedAt,counts:{fail,warn,pass,total}}`（无 findings/raw，按完成时间倒序，对象/数组
  形态皆可，脏条目忽略；时间接受毫秒数、数字字符串或 ISO，统一为毫秒；severity 归一化复用
  `reviewcov.normSeverity`，critical/high→fail、medium→warn、ok→pass，与主张覆盖面板同口径）。
  `reviewRunOf(raw,id)` 返回单 run 详情（保留 findings，剔除 `raw` 并递归剔除 password 类键）。
  id 只认非空字符串，缺失回退对象键；重复 id 追加 `~<key>` 后缀保证 React key/展开态/缓存不串台，
  详情接口同时接受唯一 id 与对象键。
- `/state` 的 `reviews` 只含摘要；新增 `GET /plugins/dsh-science/review?run=<id>`：缺参 400、
  未知 404、命中 200 `{run}`，鉴权与 state/file 同款会话栅栏。
- 客户端「产物→审查」：行内 fail/warn 计数直接读摘要；首次展开某行时才 fetch 详情并缓存，
  加载中显示「加载 findings…」，失败显示错误与重试提示（收起后重开重试）；轮询替换摘要不清详情缓存。
- 验收：7 条单测（摘要剥离/排序/ISO/数字字符串/脏条目、severity 别名、重复与非字符串 id、
  详情剔除敏感键、/state 不含 findings、/review 200/404/400、401 鉴权）；headless 实测
  `research/v011-tests/web-review-lazy.mjs`：98 行摘要 → 展开后 findings 文本出现；截图
  `web-12-review-lazy.png`。实测 /state 45,206B（reviews 23,581B，较 208,371B / 186,746B
  降约 78% / 87%）。

## 18. /sci-status 实时体检（v0.11.0）

- `lib/status.js` 纯函数 `statusReportOf(input)`：输出短行报告（版本/数据/工作区、团队、蓝图、审查、资产、配置、唯一「下一步」）。首跑（核心主张为空）给出三步上手引导；有数据时按 蓝图 → 任务 → 审查 → 确认 的优先级只给下一个动作。
- 鲁棒性：脏条目/数组/缺失字段忽略；审查失败 run（`parse-failed`/`failed`）单独计入「异常 N」，不再伪装成 0 问题；越界时间戳（|ms| > 8.64e15）显示「最近 时间异常」而不抛 `RangeError`；文本截断按 code point（不劈开代理对）；config 按运行期规则归一（gate 大小写不敏感、阈值仅接受正整数）。
- 接线（`lib/index.js`）：六个状态文件逐个读取；文件不存在视为首跑空状态，存在但读不出/解析失败计入「N 个状态文件无法解析」（不再静默显示 0）；整个处理器 try/catch，`dataDirOf` 无法建目录时返回 `kind:'error'` 而非抛异常。
- `sci_team_status` / `sci_team_dispatch` 输出字段全部 String/null/[] 归一，缺失 `status` 的遗留任务不再产生 `undefined`（headless 的 `value is not lossless JSON` 修复）。
- 验收：9 条新增单测（越界时间、异常 run 计数、配置归一、代理对截断、损坏文件计数、`apply()` 命令接线、坏 `DSH_HOME` 容错、dispatch JSON 往返）；live 实测 `research/v011-tests/status-live.mjs`（真实 98 次审查 / 23 异常 / 图表 7 / DB 1 / SSH 3）；headless 实测 `sci_team_status` 返回合法 JSON。全量单测 171/171（26 suites）。

## 19. 全新状态零摩擦（v0.11.0）

- 隔离 `research/v011-tests/fresh-home`（复制 web/headless profile，无科研数据）+ 空工作区 `fresh-workspace`：headless 实测 `sci_ping` / `sci_team_status` / `sci_blueprint_overview` / `sci_figure_list` / `sci_db_profiles(list)` / `sci_skill_installed` 全部返回合法 JSON 与空集合；web 实测团队/文章框架/产物三 tab 正常渲染，`/state` 200 空快照，`/review?run=nope` 404，`文件（0）`。
- 空状态文案修正（独立审核后）：`coverageOf` 增加 `total`；文章框架「覆盖检查」在无 result 时提示「先 sci_result_add」而不是「覆盖完整」；仅有 negative/dropped 时显示「无可支撑的 result」；`sci_blueprint_export` 的论文视角摘要、主张审查覆盖（0/0）与覆盖警告分别给出未开始提示；导出返回值增加 `coverageStarted`。
- 客户端 `CoverageSection` 在 payload 缺 `total` 时回退到 `results.length`，避免旧 host 快照误报空状态。
- 测试夹具：`v011-headless-run.mjs` 支持 `V011_HOME` / `V011_WORKSPACE`；`web-fresh.mjs` 随机 CDP 端口、清理临时 profile、断言空态不出现「覆盖完整」，截图 `web-13-fresh-empty.png` / `-article.png`。
- 验收：单测 174/174（27 suites，新增空蓝图/negative-only 导出用例）；headless 实测空蓝图 `paperView.summary` 与导出报告均为未开始文案；test-env 历史数据未改动（reviews 98 条）。

## 20. 工具输出契约与删除任务口径（v0.11.0 第八轮）

- 输出契约：动作类工具（产生写入/副作用，如 align/link/confirm/dispatch、DB/SSH profile 增删、ssh_probe/exec/job_submit/file_push/file_fetch）成功时返回 `ok:true`；纯只读查询（figure_list、blueprint_overview、team_status、job_status/job_logs/job_harvest、doi_verify 的 `verified`）返回数据本体；失败一律抛异常，由 DSH 转为 isError。headless 矩阵发现 align/link 与 DB/SSH 的 list/query 缺 `ok` 导致模型误判，已统一。
- profile 变更审批：`sci_db_profiles` 的 add/remove 与 `sci_ssh_profiles` 的 add/remove/import 经 `tools/pre-execute` 返回 ask（含连接参数/凭据），list/test 与只读探测免审。
- 删除任务（墓碑）：`sci_team_delete_task` 保留 `status='deleted'` 供审计，但不计入 `/sci-status` 的「任务 N（完成 M）」与下一步提示，也不计入 `sci_blueprint_overview.taskCount`；两者分别提供 `counts.deletedTasks` / `deletedTaskCount`，团队行在有删除时追加「· 已删 N」。
- 远程工具前置校验：`requireProfile` 统一用于 probe/exec/job_submit/job_status/job_logs/job_harvest/file_push/file_fetch；profile 缺失时报 `SSH profile "<name>" 不存在...`，不再因 `getClient(undefined)` 抛 TypeError。job_logs/harvest 校验作业记录所属的 `meta.profile`。
- 文档一致性：agents/skills/recipes 不得引用未注册工具；`sci_lit_search` / `sci_protein_get` / `sci_chem_lookup` 在 SPEC §2.2 标为「规划」，现版本以宿主 `web_search` / `web_fetch` + `sci_doi_verify` 完成检索与核对。SPEC §2.1 移除不存在的 `sci_db_profile_close` 与无效参数（`schema?`、`confirm_token`），凭据描述改为当前实现（本机 profile 文件）。
- 验收：单测 181/181（28 suites，新增 ok 契约、删除计数、缺失 profile 错误用例）；headless 矩阵 `research/v011-tests/run8-batchA|B|C|D|B2|E|E2|E3.log` 覆盖 37/39 个工具（真实远端成功路径与 skill clone 仅错误路径）；live `/sci-status` 计数正常。

## 21. 期刊图件质量闭环与 Result 推进视图（v0.13.0）

- 图件数据：新增 `figure-plans.json`；登记记录保存计划快照、源数据路径、PDF/SVG/位图测量值、自动检查与人工终审。Nature profile 记录来源 URL 和核对日期；其他期刊使用 `generic`，不得把通用检查宣称为期刊合规。
- 状态机：`planned → registered → failed|needs-attention|ready-for-manual-review → approved|rejected`。自动检查只覆盖可观察属性；`approved` 必须有研究者至少 10 字的实际检查依据，且自动 fail/warn 为零。重绘产生新版本，必须重新审计。
- 前检内核：`lib/figureqa.js` 解析 PNG/JPEG/GIF/TIFF 像素、SVG viewBox/物理尺寸/字号与 PDF MediaBox；按最终宽度计算位图有效 dpi，并检查最大版面、代码、源数据、统计说明和模板许可。面板裁切、颜色/标尺、科学真实性与图注一致性保留为人工项。
- 论文进度：`paperProgressOf` 从任务板、per-result 参考文献、图件审计和主张审查实时推导，不存主观百分比。团队页可按 Result 过滤任务；文章框架节点显示任务/文献/图件计数和唯一下一步；产物页显示图件计划、前检明细与可操作修复建议。
- 第三方图库：Scientific Figure Library 作为独立 dsh 插件入口放在技能库，不进入角色 skill 克隆目录。插件只声明本地预览/确切版本/许可记录的兼容工作流，不声称内置第三方模板或自动执行其代码。

## 22. DSH 论文证据主干 v2 与论文驾驶舱（v0.14.0）

- 领域层：新增 `lib/paperspine.js`，集中负责 v1 蓝图兼容迁移、稳定语义摘要、版本化确认及科学/文稿/投稿三类就绪状态。旧 `confirmed=true` 首次读取时转换为 `legacy-migration` 确认凭据；此后语义修改生成新修订并使旧凭据失效。
- 确认硬闸门：`sci_blueprint_confirm` 经 `tools/pre-execute` 显示宿主审批卡，凭据保存 `revisionId`、`contentHash`、`confirmedBy`、`confirmedAt` 和 `source`。`sci_team_dispatch` 在任务序号递增前检查核心及全部目标 Result 的当前凭据。
- 科学模型：Result 是文章叙事单元；其下 `claims[]` 保存稳定 ID 与修订，`evidence[]` 保存方向、核验状态、来源定位、条件、不确定性、允许解释和禁止外推。`state=verified` 必须有来源定位和允许解释。
- 阴性结果：`direction=supports|contradicts|inconclusive|not_applicable` 与 `manuscriptRole=main|validation|control|boundary|supplement|excluded` 分离。`negative` 兼容状态不再自动豁免任务、证据和呈现检查；只有 `excluded`/`dropped` 退出文章。
- 共享工作：`sci_team_dispatch` 支持 `result_ids` 和 `task_role=shared`；任务板保存 `resultIds[]`，每个目标 Result 双向登记同一任务。旧 `resultId` 保留为首个目标以兼容已有 UI 和状态文件。
- 呈现决策：`presentation.mode=figure|table|prose|supplement|omit|undecided`。不再强制每个 Result 都有图或至少一条参考文献；选择 figure 时才要求批准图件，已有参考文献则必须全部核验。
- 阶段：`explore → frame → execute → synthesize → draft → audit`。`execute` 及后续阶段要求有效确认；`draft` 至少一个 Result 科学就绪；`audit` 要求所有纳入正文的 Result 文稿就绪。投稿检查覆盖数据与代码、伦理、报告规范和局限性。
- 审查定位：审查提示使用 `claim-id@rN` 稳定标识符；`reviewCoverageOf` 同时兼容旧文本匹配，并把稳定标识对回所属 Result，避免 Claim 文本润色后审查结论串线。
- UI：默认首页改为“论文驾驶舱”，包含阶段轨、核心确认修订、关键决策、三类就绪计数、Result 证据卡和投稿检查。关系图新增 Claim/Evidence 叶节点及详情；团队任务可显示多个 Result 徽章，团队页作为执行层保留。
- 新增工具：`sci_claim_add`、`sci_evidence_add`、`sci_blueprint_stage`、`sci_submission_check`；`sci_result_add/update`、`sci_team_dispatch`、`sci_blueprint_overview/export` 扩展 v2 字段与输出。

## 23. 科研工作台全面重构复审修正（2026-11-13）

- 入口与注入：完整工作台通过 DSH 左侧栏 `sidebar.panellist` 入口打开，主页面注册到 `main` 插槽，右侧栏提供快捷卡。`client-src/index.jsx` 的 Cordis `inject` 使用 DSH 0.2.2 服务名 `slots`、`sessions`、`layout`、`sidebarRightTabs`、`uiWorkspace`；这些名称已与 `test-env` 中官方客户端类型和导出核对。npm 包名只用于插件元数据的包依赖声明。
- 页面职责：论文主线呈现阶段、核心结论、Result 与三类就绪状态；团队进展呈现成员状态和任务依赖；图表与成果呈现图件、文件、审查记录和上一条可核对记录；专家配置呈现角色能力、技能来源和运行边界。
- 状态口径：前端就绪指标直接读取后端 `paperSpine.results[].readiness.{scientific,manuscript,submission}`。任务进度与稿件/投稿就绪不混用。成员 `claimed`、`working`、`running`、`idle`、`offline` 分别显示；后端 `claimed/working` 回退态标注工作状态待确认。
- 核心确认闸门：前端表单动作和按钮都要求当前核心结论与目标 Result 同时确认；四种组合矩阵中仅 `core=true,result=true` 放行任务细化和正式绘图。
- 图件历史：后端 `prevId` 存在时按登记版本链比较。没有显式关系时，只在同一 Result 的同名文件具备真实时间戳时推测较早记录，并在 UI 标注“推测”；不补造版本号。图片可否内嵌显示由浏览器实际加载结果确认，失败时提供重试与打开原文件入口。
- 专家配置：精选目录每角色不超过 3 项；RDKit 归入数据分析角色。工作台卡片显示运行环境、来源仓库、许可证、`SKILL.md` 状态/路径、使用风险和安装状态。技能目录接口保留仓库与安装位置等字段。
- 诊断输出：技能安装与 Git 进度诊断写到 stderr，stdout 保留给工具返回值和机器可读结果。
- 验证状态：2026-11-13 源码单测为 268 项（266 通过、0 失败、2 跳过），客户端构建通过。真实 DSH Web 多尺寸和错误状态验收、发布包 dry-run 将在任务收尾时记录到开发日志与本地交接文件。
