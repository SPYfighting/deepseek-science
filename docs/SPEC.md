# dsh-science 功能规格说明书

版本：v0.1（P1 产出） · 日期：2026-11-07 · 目标 DSH：`>=0.2.0 <0.3.0`（当前 0.2.2-rc.1）

对标基准：Anthropic Claude Science v0.1.47（本机逆向侦察 + 官方文档）；参考实现：aipoch/open-science（Apache-2.0）、OpenAI4S（MIT）、synthetic-sciences/openscience（Apache-2.0）、ai4s-research/open-science（MIT）。

---

## 0. 目标与非目标

**目标**：一个 DSH bundle（npm 包名 `dsh-science`），为 DSH 提供科研工作流四核心能力 + 工作台 UI：出版级绘图、数据库/科学数据源连接、结果自动 review、SSH 远程计算管理。网页版（`dsh --profile web`）与桌面版（Electron，desktop profile）均可安装运行，不与其他插件冲突。

**非目标（v1）**：不实现持久 Python/R 内核管理（复用 DSH 自身 shell/终端工具执行代码）；不做 Modal 云算力；不做文献 PDF 全文抓取代理；不做 GPU 模型端点管理。

**合规红线**：Claude Science 的 skills 文本、reviewer 提示词、模板脚本**不复制原文**；只吸收机制设计（已核对的设计事实见 §12）。

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
| `sci_db_profiles` | `action: list\|add\|remove\|test`，`profile?`（name, kind: sqlite\|postgres\|mysql, host/port/database/user/FilePath, credentialsRef） | 管理连接配置；`test` 验证连通并列出 schema 概要 | add/remove 需 `tools/pre-execute` ask |
| `sci_db_tables` | `profile`, `schema?` | 列出表/视图 + 列名 + 行数估计 | 只读，免审 |
| `sci_db_query` | `profile`, `sql`, `max_rows?=200` | **只读守卫**：语句级白名单解析（仅 SELECT/WITH/EXPLAIN/PRAGMA 只读项）；超时 30s；行数上限 | 免审；超限截断并提示 |
| `sci_db_execute` | `profile`, `sql`, `confirm_token` | 写操作（INSERT/UPDATE/DDL）。**必须先经审批卡**（pre-execute 返回 `ask`）；确认令牌防重放 | 每次审批 |
| `sci_db_profile_close` | `profile` | 关闭连接池 | 免审 |

凭据：密码一律存 `ctx.credentials`（引用名 `DSH_SCI_DB_<PROFILE>_PASSWORD`），配置里只存引用；日志与错误信息一律脱敏。

### 2.2 科学数据源（REST，只读免审）

| 工具 | 覆盖 | 要点 |
|---|---|---|
| `sci_lit_search` | PubMed(E-utilities)、OpenAlex、arXiv、Crossref | 统一返回 `{source, id, title, authors, year, doi, venue, citedBy, abstract?}`；限速 1 req/s（对齐 Claude Science 礼仪）；OpenAlex 需用户 mailto 配置 |
| `sci_protein_get` | UniProt、RCSB PDB | 按 accession 取序列/功能注释/PDB 文件路径 |
| `sci_chem_lookup` | ChEMBL、PubChem | 分名→结构/活性查询 |
| `sci_doi_verify` | Crossref | 输入 DOI/引用串 → 返回真实元数据（供 reviewer 与人工核对引用） |

### 2.3 SSH 远程计算

| 工具 | 参数 | 行为 | 审批 |
|---|---|---|---|
| `sci_ssh_profiles` | `action: list\|add\|remove`，`profile?`（name, host, port, username, auth: agent\|key\|password, keyPath?, credentialsRef?） | 管理主机档案；可导入 `~/.ssh/config`（只读解析） | add/remove ask |
| `sci_ssh_probe` | `profile` | 一次性连接收集：CPU/内存/GPU(nvidia-smi)/conda|micromamba/模块命令/调度器(sbatch|qsub)/scratch 目录/磁盘余量 → 存为 profile.details（对齐 Claude Science 探测字段集，原创实现） | 免审（只读命令） |
| `sci_ssh_exec` | `profile`, `command`, `timeout_s?=120` | 短命令执行（探测/状态类）。pre-execute ask；审批策略可按 profile 记忆 | ask |
| `sci_job_submit` | `profile`, `name`, `script`, `mode: auto\|slurm\|direct`, `walltime_s?=1800`, `inputs?[]` | **作业引擎**（§5）。返回 job id；作业目录 `<scratch>/dsh-sci-jobs/<name>-<ts>/` | ask（卡片显示完整脚本+主机+资源） |
| `sci_job_status` | `profile`, `job?` | 列出/查询作业状态（读 `.phase` 标记 + squeue/ps） | 免审 |
| `sci_job_logs` | `profile`, `job`, `tail?=100` | 回传 stdout.log/stderr.log 尾部 | 免审 |
| `sci_job_harvest` | `profile`, `job` | 拉回 `out/`（tar.gz）到本地会话工作区 `sci-jobs/<job>/out/`；>100MB 的文件留在远端仅记录路径（对齐 Claude Science 策略） | 免审 |
| `sci_file_push` / `sci_file_fetch` | `profile`, `local`, `remote` | SFTP 传输 | ask |

### 2.4 绘图辅助

| 工具 | 行为 |
|---|---|
| `sci_figure_register` | 模型生成图后调用：登记 `{path, title, code_path?, dpi, size, palette_check}` → 供工作台图库与 reviewer 图文核对；返回 figure id |
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
| `sci-figures` | matplotlib/seaborn 出版级规范：300dpi、字号/线宽阈值、色板（colorblind-safe：Okabe-Ito/viridis）、PDF/SVG+PNG 双导出、坐标轴/图例清单、自检步骤（生成后 run `sci_figure_register`） |
| `sci-figures-r` | ggplot2 同上（theme_classic 基线、ggsave 双格式） |
| `sci-db-analysis` | 数据库分析工作流：先 `sci_db_tables` 摸 schema → 只读查询 → 大结果落盘而非塞上下文 → `sci_db_execute` 前必须征得用户同意 |
| `sci-remote-jobs` | 远程作业工作流：probe → 写脚本 → `sci_job_submit` → 轮询 status → harvest；长任务用 nohup 模式；禁止交互式命令 |
| `sci-literature` | 文献检索工作流：`sci_lit_search` 多源交叉 → `sci_doi_verify` 核对 → 引用格式化；不得编造 DOI |

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
  1. **连接**：DB profiles（状态灯、测试按钮）、SSH hosts（probe 摘要、作业列表）——经 `ctx.remote`（Typert Remote namespace，host/client 共享服务）读写 host 侧状态，不依赖 webServer。
  2. **图库**：本会话 `sci_figure_register` 登记的图，缩略网格 + 点击放大 + 版本。
  3. **审查**：ReviewRun 历史 + findings 列表（severity 过滤）。
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

## 12. 已核对的机制设计事实（供实现参照，均不复制文本）

- Claude Science：20 个内建 MCP 连接器按领域拆分、跑在 micromamba env；REVIEWER 为禁工具只读 agent，"trace, don't recompute"，矛盾才算发现；SSH 作业 = 作业目录 + setsid/timeout 看门狗 + out/ 打包收割 + `.phase` 标记；凭据 hosts.json+hosts.key 本机加密；产物 5 页签溯源（消息/代码/执行日志/环境/审查）。
- aipoch：reviewer 独立会话 + 单一自有 MCP server + 权限锁死（非本 MCP 工具一律拒绝）；Review/Finding 表模型（v2/v3）；ScopeBlock contentHash 防篡改；审查器动作流全存档。
- DSH 官方 auto-review（experimental）：是工具调用风险分类 preset（low/medium/high → allow/ask/deny），与本项目"结果审查"互补；重逻辑：fail-closed、审查提示词不进会话日志（缓存友好）。
