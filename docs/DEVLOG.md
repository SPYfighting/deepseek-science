# dsh-science 开发日志

## 2026-11-07 P4-1b 进行中：/sci-review web 端验证的最后两个点

### 当前状态
- **审查器核心已重构为 session-log 证据源**（`lib/reviewer.js` 全量重写完成）：
  - 证据 = `session.snapshotEvents()` 直读会话日志 → `extractEvidenceRows` 抽取
    user/assistant/tool 行（user 消息挂 pending，turn/start 时归轮）
  - 窗口 = 目标轮 turn-marker 起至日志末尾
  - `/sci-review` 命令 + 自动模式（headless 已验证 agent/status global 监听可触发）
  - `runReview` → `ctx.subagents.startActivation({provider:'subagent-fork-in-process', delivery:'caller'})`
    → 严格 JSON findings → `$DSH_HOME/dsh-science/reviews.json`
- **index.js inject**：`['tools','commands','skills','sessions','agents','sessionPersistence','subagents']`

### 已确认的平台事实（勿重复排查）
1. **headless 档案**：`ctx.on('session/event', ..., {global:true})` 能收到全部事件
   （debug 实测 event#1-14，type/turn 正确）。`agent/status` 亦可。
2. **web 档案**：第三方 bundle 的插件无论是否 `{global:true}`、无论 inject 是否含
   `sessions/agents/sessionPersistence`，都**收不到** `session/event` 与 `agent/status`
   （内建 session-title 同款注册方式有效——差异疑似在 agent-preset standing composition
   的作用域链归属）。→ 自动审查的 web 触发待社区确认（P4-3）；
   `session.snapshotEvents()` 证据源不受此影响（审查主路径不受阻）。
3. **命令分发**：12:01 曾成功（UI 渲染了 CommandResult 文本"窗口内没有可审查的轮次"，
   证明 `ctx.commands.register` + dispatch + 渲染链路 OK）。复现时浏览器自动化抖动：
   输入 `/sci-review` 后出现候选下拉，Enter 被下拉拦截，Esc+点发送时好时坏。
   **人工操作只需在输入框输 `/sci-review` 回车即可**（无需自动化）。
4. **工具 schema 合同**：参数名不能叫 `title`/`description` 等注解关键字（编译器会
   把 `parameters.<key>` 当注解拷贝 → DeepSeek 拒绝）；工具输出对象里不能有
   值为 `undefined` 的键（无损 JSON 校验拒绝）。
5. **headless 一次性进程**会在异步审查完成前退出 → 自动审查验证要用常驻 web 或
   尝试 `agent.runMaintenance(task)` 包裹（未验证）。

### 下轮待办
1. web 下人工输 `/sci-review`（或修好自动化时序）验证完整审查流：
   预期产出 `reviews.json`（findings 数组）+ UI 显示结果文本。
2. 若 startActivation 在 web 下报错（subagents 服务/权限），按日志修。
3. P4-2 工作台 UI 完整版（client-src/index.jsx 扩展：图库/连接/审查三面板 +
   `sci-figure`/`sci-review` 资源协议卡片）。
4. P4-3 在 DSH GitHub Discussions 发帖问 web 档案第三方插件 session/event 挂载方式。
5. P5：桌面版静态核对清单（SPEC §7）+ PG/MySQL 可选实测 + 远端测试目录清理复查。

### 测试环境备忘
- 启动：`cd test-env && DSH_HOME="<项目>/test-env/.dsh-home" npx dsh --profile web --no-open`
- headless 测试需 `DEEPSEEK_API_KEY`（从隔离目录 `.credentials.yaml` 解出）+
  `DSH_SCIENCE_AUTO_APPROVE=1`（SSH 审批）+ `DSH_SCIENCE_AUTO_REVIEW=1`（自动审查）
- 测试服务器 token 见 `research/dsh-web-run*.log`
- 远端实验室主机（121.192.172.68:10000）测试目录已清理（`~/dsh-sci-jobs` 已删）

## 追加（同日晚）：科研模式实现轮

### 已落地（本轮新增）
- **5 个新 skills**：sci-writing / sci-polish / sci-hypothesis / sci-simulation / sci-autoresearch（原创撰写，设计参考 nature-skills/ARS/ARIS，流程思想已致谢）
- **5 个工作流命令**：/sci-write /sci-polish /sci-hypothesis /sci-simulate /sci-research（agent.followup 注入 skill 启动提示）——已注册成功
- **客户端 v0.2.0**：工作台双模式（工作台=总览工具箱/图库/连接/审查 四面板；科研模式=8 阶段流水线导航+会话快照+一键入口），模式存 localStorage，纯前端
- **agent-teams 兼容配方**：docs/recipes/agent-teams-science.md（5 成员科研团队模板 + toolPolicies 白名单建议；结论：零冲突，无需捆绑）
- 参考：dsh-media-skills（MJorgin，MIT）确认"skills+特化页面同 bundle"模式可行

### 遗留问题（下轮优先）
1. **面板数据通道**：host 侧没有 `resources` 服务（资源 provider 是浏览器端栈）。
   方案：工具执行时把 JSON 镜像到会话工作区 `<cwd>/.dsh-science/*.json`
   （用 workingDirectory 服务），客户端用内建 `dsh-resource://file/...` + workspaceFiles
   remote 读内容。resources.js 已写好但暂未启用（已从 inject 摘除）。
2. **/sci-review web 分发手势**：命令候选下拉会拦截 Enter；成功过一次（12:01）证明链路 OK。
   自动化建议：fill 后先等下拉出现→按 ArrowDown/Enter 选中→或直接点击 option 节点。
3. **headless 自动审查退出竞态**：尝试 agent.runMaintenance(task) 包裹 runReview。
4. 远端实验室主机测试目录已清理（~/dsh-sci-jobs 已删）。

## 追加（同日深夜）：skills 深度重构轮

### 已落地
- **sci-simulation v2.0**：总协议（作业形态分类表 / 强制查手册铁律 / 验证阶梯：冒烟→见证→生产 / 失败诊断表 / 报告要求）
  + references/tool-dossiers/ 五个工具档案（GROMACS/Gaussian/Quantum ESPRESSO/LAMMPS/ASE，每个含必查项、
  输入结构、已知坑、收敛判据、引用格式）+ _TEMPLATE.md。档案给结构与已知坑，数值强制以远端版本官方手册为准。
- **sci-figures v2.0**：scripts/style_presets.py + scripts/figure_export.py + references/journal-requirements.md
  （期刊尺寸速查表）+ SKILL.md 快速开始（引用 skill 内脚本路径）。
- **sci-remote-jobs v2.0**：主机知识持久化（research/hosts/<profile>.md）+ 首次接触协议 + 失败诊断表。
- **skills provider 增强**：get() 在技能正文末尾追加"附带资源文件绝对路径清单"——模型用读文件工具即可取
  references/ 下的档案（解决相对引用不可达问题）。
- **F1 host 侧镜像完成**：index.js 注入 workingDirectory；makeMirror(ctx) 把 figures/db-profiles/
  ssh-profiles/ssh-jobs/reviews JSON 同步写到 <cwd>/.dsh-science/；全部写状态工具已接
  （execute 签名补了 exec）。客户端内容读取方案二选一（下轮）：
  a) 找到 workspaceFiles 内容读 API（现只确认 stat/changes）；
  b) 自己起一个 host remote namespace（需查 Typert 插件定义方式）。

### 验证状态
- 全部 host 模块 load OK；服务器 run21 带全套启动成功（workflow commands + mirror + 工具）。
- 浏览器：新 client bundle 已上屏（guide 胶囊描述更新为"工作流工具箱 · 图库 · 连接 · 审查 · 科研模式"）。
  工作台 tab 体内截图与 /sci-review 执行因浏览器自动化手势未完成——**人工 10 秒可验**：
  打开右栏 → 开始页点"科研工作台"胶囊 → 看到模式切换与工具箱卡片；会话输入 /sci-review 回车。
- 浏览器自动化注意：轨迹视图会抢占 dom_cua 的元素引用；命令候选下拉会拦截 Enter。

### 参考仓库（已克隆到 research/）
- research/academicforge（MIT）：skills/claude-science = Claude Science 内置技能移植版；
  compute-env-setup 的分类学/验证阶梯/诊断表模式已吸收进 sci-simulation。
- research/kdense-skills（MIT）：工具档案模式（compatibility 元数据/when-not-for/provenance/
  tested-example/references-interpretation）已吸收进 tool-dossiers。

## 追加：工作台渲染 bug 修复 + 渲染验证通过

- **用户报告点击科研工作台无变化 → 根因确认**：v0.2 工作台 body 新增的 useSciData 调用链在
  useResource prop 缺失/异常时抛错，组件树崩溃 → 空白。我的验证只做到"注册成功"没做"渲染验证"，失职。
- **修复**：① useSciData 防御（useResource 非函数返回 null）② SafeBody 错误边界（错误自报到 DOM）
  ③ React 全量导入。重建 bundle、重启 run22。
- **渲染验证通过（DOM 快照为证）**：工作台模式（v0.2.0 + 工作台/科研模式切换 + 总览四子面板 +
  6 张工作流卡片 + 复制 chips）；科研模式（8 阶段流水线按钮 + 会话快照 + 一键开始）。
- **快照"…"占位** = sci-data 协议 provider 未注册（预期降级）。F1 客户端路径已探明：
  `WorkspaceFiles.read(scope, path, range, signal)` 存在于生成的 workspaceFiles remote
  （@deepseek-ai/dsh-api-workspace-files）——客户端 provider 可经它读 <工作区>/.dsh-science/*.json。
  需要的 scope（sessionId 等）从 useSession/useTabInfo 取。下轮实现。
- **用户侧操作提醒**：服务器重启后旧页面必须刷新并用新 token（每次重启 token 变化，
  见 research/dsh-web-runNN.log）。

## 追加（同日夜）：Super-agent 架构融合 + 团队核心闭环打通

### 官方 Super-agent 博客+原型（dsh-superagent-prototype，已克隆 research/superagent）要点吸收
- 双层架构：Router(队长，只分派/交互/汇报，不执行) + Worker(角色成员，上下文隔离)——"约束 Team 主会话只分派即等价双层架构" → 已实现为 index.js 的 `dsh-science:router` systemPrompt section（order 118）。
- 审查策略进队长协议：执行类任务完成后默认派 sci_review_send 给 reviewer（琐碎可免但要说明）。
- 后续可吸收（记录未实现）：事件驱动 Trigger 过滤、Inline&Spill 上下文注入、投机执行、Watchdog 外部控制回路。

### 团队核心实现（lib/roles.js + lib/team.js + agents/*.md ×8）
- 8 角色：literature-scout/topic-designer/simulator/trainer/figure-expert/writer/reviewer/analyst——
  角色提示词内化了此前全部 skills 专长（agents/*.md，spawn 时作为成员初始提示词）。
- 成员 = 命名子代理（ctx.subagents.startActivation, provider:'spawn', delivery:'parent', **预分配 childId**,
  request 只含 prompt+parent, signal 走 spec 级 AbortSignal.timeout）——官方 experimental service 同款调用形状。
- 任务板 = 自研文件状态（team.json + 工作区镜像）；sci_team_spawn/spawn_all/dispatch/status/review_send/send 六工具。
- 依赖说明：npm 的 experimental agent-team 包(0.1.5-alpha.2)与 dsh 0.2.2-rc.1 不兼容（启动即禁用）→
  自研实现建在稳定的 ctx.subagents 原语上（agent-teams 插件同款选择）。

### 闭环测试证据（headless）
- spawn 成员 ✓（team.json members 含 writer，childId 记录）
- dispatch 建任务+指派+唤醒 ✓（task-3 等）
- **成员自动执行并回信 ✓**（writer2 spawn 后无需人工唤醒完成任务并回信队长——测试报告原话：
  ""成员自动执行并回信这一核心能力已验证可用""）
- 已知边界：成员会话作用域（跨会话需 spawn_all 重建，旧任务需重派）；headless 退出竞态仍存在
  （web 常驻会话为目标形态）；pwsh 沙箱 ACL 问题为本工作区 DSH 沙箱自身问题（非插件）。

### 工具 schema 新坑（第 3 个注解关键字）
- 参数名 `description` 与 `title` 一样会被 DSH 编译器当注解吞掉 → DeepSeek 拒绝。
  已建规则：工具参数禁用注解关键字命名（title/description/default/enum/const）。
- required:true 在属性内会泄漏进输出 schema → 一律用 description 文本表达必填。

### 数据通道（web）
- GET /plugins/dsh-science/state（ctx.webServer 注册，鉴权由 DSH 会话层承担——curl 无凭证得
  unauthorized 属预期，浏览器同源会话可通过）→ 工作台团队面板 3s 轮询消费。
- 浏览器端最终渲染验证因自动化手势未完成（对话页快照干扰），**人工 10 秒可验**：
  打开测试页 → 右栏 → 科研工作台 → 团队子面板 → 应显示 writer2 等成员与任务板。

### 待办（下轮）
1. 浏览器人工/自动化验证团队面板数据渲染。
2. /sci-review 完整流（web）+ 自动审查接团队 reviewer。
3. 桌面版兼容核对（无 webServer 降级路径已内置）+ P5/P6 发布。

## 追加（同日深夜）：验收轮 + 修复

### 独立验收结果（子智能体执行）：6 PASS / 1 FAIL → 修复后复验
- PASS：HTTP 数据通道（鉴权正确）、工作台全面板渲染、团队面板实时数据（3s 轮询实测）、
  科研模式 8 阶段、headless 团队流、sci_ping 回归、插件页启用。
- 修复（验收发现）：① reviewer provider 名 'subagent-fork-in-process'→'spawn'；② 版本统一 0.3.1；
  ③ 失败审查也落盘 reviews.json（status=failed/parse-failed）；④ wake 的 throwIfAborted 误报
  （消息实际已送达）忽略；⑤ 新增 sci_team_update_task（任务状态回写 completed/failed）。
- 复验：R1 查询 PASS、R3 版本 v0.3.1 PASS、R4 回归 PASS；R2 /sci-review 出现新错
  "Cannot read properties of undefined (reading 'maxDepth')"（间歇性——同一代码有一次跑进了子 agent
  并返回，reviews.json 已写入 status=parse-failed）。

### 当前精确状态（/sci-review 链路）
- 机制已全通：命令分发 → 证据构建（session.snapshotEvents）→ 子 agent 启动（spawn provider，
  request 包装已修）→ 运行 → reviews.json 落盘 → UI 显示。
- 剩两个稳定性问题（下轮首先修）：
  1. 间歇性 maxDepth 崩溃：startActivation 在某路径读 spec.request.maxDepth 时 request undefined
     ——与 delivery:'caller' + spawn 的调用时序有关；需对照官方 dsh-tool-subagent 的完整调用形状
     （node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js L466-473）逐字段比对。
  2. 审查器输出解析健壮性：子 agent 偶尔不输出纯 JSON → parseFindings 已抓第一处 {...}，仍需
     容忍 markdown 围栏/前后缀 + 失败自动重试一次（重试时提示词强调"只输出 JSON"）。

### 面板渲染 bug 教训（本轮最大）
- 多轮 python 字符串补丁叠加导致 client-src 结构损坏（TeamPanel 体被删、内容分支被吃、stray st）。
  最终以"整文件一次性 Write 重写"修复。规则：同一文件超过 2 次字符串补丁后必须整文件重写。

## 2026-11-08：v0.5.0 科研鲸鱼娘 + 复审修复轮

### F1-F7 复审结论（round-1 findings 基线核查）
- F1-F6 已在上一轮修复到位（代码核实）：registerReviewer(ctx, opts={}) + index.js 传 { mirror }；
  成功/失败路径均写 reviews.json（saveReviews + mirror 双通道）；ReviewHeaderAction 已无残留；
  dispatch 唤醒成功即标 claimed；memberLive 任务板回退推断；任务行展开 + 成员行 openSession；
  persist 原子写 + sci_team_update_task 枚举校验；file 路由 realpathSync 包含 + /state 1s 缓存。
- F7 残留修复：lib/index.js sci-status 命令输出仍是 P3 阶段占位文本（"计划中/骨架"）→ 已改为
  实际模块状态（v0.5.0）。
- 设计决策：客户端 uiWorkspace 保持 `ctx.get('uiWorkspace')` 可选探测，**不加入 inject**——
  agent-teams 参考实现（MIT）同款做法（src/client/index.tsx openMember），加入 inject 会把
  可选服务变成硬依赖，宿主缺失时整个客户端加载失败。
- V3 发现并修复隐藏 bug：`Empty` 组件只读 `text` prop 而全部调用方传 children → v0.4.0 起所有
  空态文案从未渲染过。已修复（children 优先），空花名册/空任务板/空文件树文案全部上屏。

### 科研鲸鱼娘吉祥物（原创 SVG，科学风格致敬 agent-teams 鲸鱼娘模式）
- assets/mascots/ 11 个文件：lead（白大褂+指挥棒）+ 8 角色（scout 书+放大镜 / designer 灯泡 /
  analyst 图表板 / simulator 终端 / trainer 哑铃 / figure 调色板+画笔 / writer 羽毛笔+稿纸 /
  reviewer 放大镜+红章）+ working（加载弧）/ idle（Zzz）可选状态叠加图。
  200x200 viewBox、flat chibi 鲸鱼身体+发髻/呆毛/腮红、亮色填充随明暗主题自适应。
- 服务路由：GET /plugins/dsh-science/assets/<file>.svg（kind:'prefix' + 文件名白名单——比
  realpath 包含更强，白名单外一律 404；content-type image/svg+xml；max-age=86400）。
- lib/roles.js：每角色 mascot 字段 + LEAD_MASCOT 常量；/state payload 的 roles meta 增加
  mascot 字段 + mascotLead。
- 客户端：花名册行用鲸鱼娘头像（加载失败 onError 回退 emoji 图标）；running/offline 头像角标
  叠加 working/idle 图；进度总览头部 lead 徽章 + "科研小队"；空花名册 lead 吉祥物 +
  "唤醒你的科研团队：sci_team_spawn_all" 引导；客户端兜底角色→吉祥物映射（roles meta 缺失时）。

### 验证证据（V1-V5 全过）
- V1 esbuild bundle OK（36.0kb）；lib/index.js 与 roles.js import OK；白名单 11 文件全部存在。
- V2 重启 web（kill 3080 holder → npx dsh --profile web）：日志出现 [dsh-science 0.5.0] +
  mascot assets route registered；token 见 research/dsh-web-v05.log。
- V3 浏览器实测：吉祥物图 13/13 加载（img.complete && naturalWidth>0；writer/analyst/reviewer/
  scout/trainer 5 种角色 + lead + idle 叠加）；任务行点击展开详情且跨 3s 轮询保持；
  成员行点击 → uiWorkspace.openSession 成功打开成员会话（跨会话成员显示 subagent/unauthorized
  历史加载失败——已知平台边界，跳转链路本身工作）；产物 tab 图表（1）img 经 file 路由加载 +
  文件（26）+ 20 个 ⬇ 动作；图表卡点击 → window.open 新标签页（file 路由 URL 证实）；
  空花名册（临时移走 team.json 验证后恢复）显示 lead 吉祥物 + 引导文案；无 渲染出错。
- V4 headless（DEEPSEEK_API_KEY 从 .credentials.yaml 解出，未打印）：sci_team_spawn 生成
  trainer（新成员）→ team.json members 7 人；浏览器面板 ≤10s 出现 trainer 行且 trainer.svg
  加载（成员（7））。
- V5 代码级 + node 级：registerReviewer(ctx, opts={}) 签名 ✓、index.js registerReviewer(ctx,{mirror})
  ✓、成功路径 status:'done' → saveReviews + opts.mirror('reviews.json') ✓、失败路径也落盘 ✓、
  无 opts 冒烟调用 ✓；磁盘上已有 2 条 status:'done' 且含 findings 的成功审查记录（此前 web 运行
  产出）。人工 web /sci-review 验证法：会话输入框输 /sci-review 回车（避开候选下拉拦截），
  预期 UI 显示 findings 文本且 reviews.json 增加一条 status:'done' 记录。

### 工程备忘
- 工作台 3s 轮询全量重渲染与 Playwright locator 点击存在竞态（count 通过后节点被替换 → click
  超时甚至迟到双击）。自动化验证用"单次 evaluate 内 querySelector+click"最稳。
- package.json files 已加 "assets"（npm 发布含吉祥物）；版本三处同步 0.5.0（package.json /
  lib/index.js / client + httpdata VERSION）。

- SafeBody 错误边界 + 错误自报到 DOM 的设计被证明正确——用户看到的错误直接定位了问题。

## 追加（2026-11-08）：v0.5.0 科研 team 页交付（两轮审核循环完成）

### 交付内容
- **科研鲸鱼娘吉祥物集**：assets/mascots/ 11 张原创 SVG（9 角色按身体色相区分：scout 青/designer 琥珀/
  analyst 绿/simulator 紫/trainer 橙/figure 粉/writer 蓝/reviewer 绯红/lead 深蓝 + working 弧/idle Zzz），
  /plugins/dsh-science/assets/* 路由（白名单+鉴权+缓存失效参数）。
- **团队页 v0.5.0**：分段进度条（状态着色+阻塞/已取消图例）+ 成员花名册（吉祥物头像+实时状态点+
  在办任务徽标+点击 uiWorkspace.openSession 打开成员会话）+ 任务板（点击展开详情/阻塞 chip/超 20 截断提示）
  + 产物 tab（图表 img 经 file 路由/文件树 26 项/SSH 主机/作业/**审查（N）小节**——run 状态/fail 计数/展开 findings）。
- **队长协议强化**：成员自主使用专业技能、回报→先 update_task、wake 失败→重建成员重派、
  reviewer fail 先修再报、"一条 SQL 也走 dispatch"负例。

### 两轮子智能体审核循环（用户要求 ≥2 轮，已完成）
- R1 审核：6 发现（死按钮/任务滞留/原子写/图片交互/越权/缓存）→ 修复子智能体全修。
- R2 审核：6 发现（review_send claimed 缺失/parse-failed 语义/审查 UI 出口/吉祥物辨识度/
  协议去重补丁/mascot 鉴权）→ 修复子智能体全修。
- 最终状态：/sci-review web 全链路首次完整跑通（"审查完成 7 条记录"+reviews.json done 落盘+
  产物面板同步）；团队页 7 成员/8 任务实时；吉祥物 15/15 加载；路径穿越/鉴权全部验证。

### 遗留（下一版本）
1. 成员跨会话归属（平台边界）：新会话需 spawn_all 重建。
2. 自动审查 web 触发（session/event 平台限制）待社区确认；主路径不受影响。
3. 工作区路径含空格 + DSH 沙箱 ACL（Win32 5）为环境问题——建议测试/使用时把 DSH_HOME
   与工作区放在无空格路径。
4. parse-fail 真实触发路径需子代理输出非法 JSON 才能命中（代码路径已验证）。

## 2026-11-08：v0.6.0 文章蓝图（Paper Blueprint）交付轮

### 已落地
- **lib/blueprint.js（新）**：blueprint.json 状态（core 标题/主张/创新点/期刊 + results（res-N，
  status: planned|in_progress|supported|negative|dropped，tasks/figures 双向登记）+ narrative；
  原子写 + .dsh-science/blueprint.json 工作区镜像）。方法论出处写在文件头注（ARS academic-paper
  Phase 2 Evidence Map / Phase 3 claim-evidence 链、PaperSpine skeleton-first + rationale matrix +
  证据台账，均机制吸收原创实现）。
- **6 个新工具**：sci_blueprint_set（增量更新核心+narrative）/ sci_result_add（上限 6、超 5 警告）/
  sci_result_update（negative 强制 fresh notes 重新评估说明）/ sci_blueprint_align /
  sci_blueprint_link_figure / sci_blueprint_overview（coverage：无任务/无图表/任务未对齐/
  负面计数/证伪风险——失败与取消任务不要求对齐）。
- **既有工具升级**：sci_team_dispatch 加 result_id（派发即对齐，对齐失败不阻断）；sci_figure_register
  加 result_id（登记即挂证据）。coverageOf 由工具与 /state 快照共用（口径一致）。
- **队长协议（index.js section 'dsh-science:router' + router.js routerText）**：科研执行意图先确保
  blueprint core 存在；dispatch 带 result_id；回报后 sci_result_update 同步状态；负面 → 重新评估
  蓝图（多负面无 supported → 提证伪风险）；汇报按"文章视角"组织。
- **客户端 v0.6.0**：三标签 团队/文章/产物（默认仍团队）。文章 tab：核心卡（lead 吉祥物+大标题+
  主张/创新/期刊+sci_blueprint_set 芯片）、Results 列表（状态点 planned 灰/in_progress business/
  supported ok/negative err/dropped faint，行展开 claim/任务 chips（点击跳团队）/图表数/notes）、
  覆盖检查（⚠ 证伪警告 err 色加重）、底部命令芯片。新 CmdChip 组件（点击复制命令）。
- **角色升级**：trainer.md（数据先行/骨架+哑基线/基线对照/可复现/监控/评估与误差分析/常见坑 +
  sci_job_submit 纪律；出处：Google Rules of ML、Karpathy Recipe、K-Dense skills，头注引用）；
  figure-expert.md（图表类型选型 + 期刊预设用法，参照 AcademicForge scientific-visualization）；
  topic-designer.md（蓝图映射表：每 result 一句 claim + 所需证据 + 执行角色）；simulator.md（头注
  交叉引用工具档案 + AcademicForge claude-science 设计参考）。
- **版本**：package.json / lib/index.js / httpdata.js / client 全部 0.6.0；/state 快照加 blueprint 字段。

### 验证（V1-V5）
- V1 esbuild 55.1kb OK；全模块 import OK；mock ctx 工具冒烟（schema 无注解键/无 required 泄漏/无
  undefined 输出键）。
- V2 headless：sci_blueprint_set/res_add×2/dispatch(result_id=res-1)/overview 全链路 ✓；
  blueprint.json 结构正确、task-11+task-5 对齐进 res-1、工作区镜像落盘、coverage 警告输出。
  意外之喜：模型自己发现 demo.db 数据撑不起 claim，把 res-2 标 negative 并写重新评估说明。
- V4 headless：res-1 negative 无 notes → 报错（V4 发现旧 notes 会静默满足校验 → 收紧为每次
  negative 都必须 fresh notes，node 级 + headless 双重复验）；带 notes 成功；2 negative + 0 supported
  → falsificationRisk=true + ⚠ 警告出现（阈值边界 1 neg/2 neg 1 sup 均 node 级验证为 false）。
- V3 浏览器（重启 web，新 token 见 research/dsh-web-v06.log）：文章 tab 核心卡/Results（3）/覆盖
  检查（含红色证伪警告）全部渲染；res-1 展开（claim/任务 chips/notes）；任务芯片点击跳团队 tab
  （按钮 ACTIVE 验证）；团队/产物回归完好（吉祥物 5/5 加载、任务板 12、图表/文件/审查 6 条）；
  /state version=0.6.0；无 渲染出错。
- V5：reviewer.js 未改动（内容标记核对：registerReviewer(ctx,opts)/saveReviews/mirror 双通道/
  snapshotEvents 均原样）；/sci-review 注册正常（V2 日志）；reviews.json 6 条历史记录完好；
  人工 web 验证步骤：会话输入 /sci-review 回车（避开候选下拉），预期 UI 显示 findings 且
  reviews.json 增 status=done 记录（headless 一次性进程退出竞态已知，主路径不受影响）。

### 遗留/观察
1. 跨会话成员唤醒不可达（reviewer belongs to another parent session）——已知平台边界（v0.5 遗留），
   新会话需 sci_team_spawn_all 重建；spawn 重名"已存在"不重建，重名重建策略待下版本。
2. 模型建议证伪阈值降为 1 negative + 0 supported——v0.6.0 按规格保持 ≥2，可作配置项（下版本）。
3. 证伪警告文案与 coverage 口径被 /state 与工具双通道共享，改逻辑只需改 coverageOf 一处。

## 追加（2026-11-08）：文章蓝图体系 v0.6.0 + 两轮审核循环完成

### 文章蓝图体系（核心交付）
- 数据模型：blueprint.json（core: 标题/主张/创新点/期刊；results: res-N 五态
  planned|in_progress|supported|negative|dropped + tasks/figures 双向登记 + notes；narrative）
  原子写 + 工作区镜像 + 损坏隔离（backup + blueprintError 横幅）。
- 6 工具：sci_blueprint_set / sci_result_add（上限 6 警 5）/ sci_result_update（negative 强制新 notes）
  / sci_blueprint_align / sci_blueprint_link_figure / sci_blueprint_overview（coverageOf 覆盖分析+
  证伪风险）。dispatch/figure_register 支持 result_id 即登记即对齐；sci_review_send 也支持。
- 队长协议（lib/router.js 单一来源，per-lead scoped）：core 先行、dispatch 带 result_id、
  回报→update_task、负面→重评甚至证伪、只读抽查例外、"一条 SQL 也走 dispatch"负例。
- 客户端三标签：团队 / 文章（核心卡+Results 五色+覆盖警告+证伪风险红字）/ 产物。
- 方法论出处：ARS academic-paper（Evidence Map/claim-evidence/8 阶段）、PaperSpine
  （skeleton-first/rationale matrix/结果权威）、AcademicForge scientific-visualization。

### 两轮审核循环（本体系）
- 第 1 轮：5 修复（sci_team_ask 删除+协议单一来源合并——并挖出 scoped 协议从未注册成功的隐藏 bug、
  coverageOf 状态过滤、chip 焦点跳转、损坏护栏、双向对齐回写）。
- 第 2 轮：5 修复（coverage 口径 review/completed 豁免+补救提示、任务生命周期 cancelled/deleted+tombstone、
  原子化+损坏隔离推广到 figures/team、对齐回填存量+队长只读抽查例外、全链路回归）。
- 实测：C4 协议演练模型大体遵守（8 次 dispatch 全带 result_id、负面重评、自主叫停失真图表）；
  /sci-review 完整跑通（7 findings 落盘）；全面板无渲染错误。

### 遗留（v0.7 候选）
1. sci_figure_register 图片格式校验（任意文件可冒充图表）。
2. blocked_by 记录但不闸门（依赖未完成不阻止执行）。
3. 旧审查任务无 isReview 标记（口径残留）。
4. 工作台 reload 双份挂载怪癖（运行时 UI 疑似非插件问题）。
5. 成员跨会话重建、自动审查 web 触发（平台边界，见前）。
6. 证伪阈值（≥2 negative）可配置化。

## 最终回归（2026-11-08）：v0.7.1 DAG 全链验证通过
- DAG：18 节点 / 6 边 / task-31→32→33→34 全链同屏 / 四列准确（待办10·进行中5·已完成7·已结束12）/ 无渲染错误。
- 第 2 轮审核 3 项修复全部落地：R1 聚焦 pin、R2 末列滚动、R3 memberOpenAvailable 口径（teamRuntime 标记）。
- v0.7 两轮子智能体审核循环完成（R1: 6 发现→F1-F7 修复；R2: 3 发现→R1-R3 修复）。
- 交付状态：v0.7.1（团队 DAG + 文章框架图 + 产物 + 蓝图体系 + 8 角色团队 + 鲸鱼娘吉祥物）。

## 追加（2026-11-08）：汇报 PPT 专家角色 v0.8.0

### 交付（D1-D7 全部完成，V1-V4 验证通过）
- agents/presentation.md（汇报专家：输入三件套 sci_blueprint_overview+sci_figure_list+任务回报；
  结构模板 封面→背景缺口→方法→Results 图为主→结论展望→Q&A 备份页；密度纪律 一页一论点/
  要点≤5/图占≥50%；python-pptx 工具链；成稿后建议 sci_review_send scope=journal）
- lib/roles.js + presentation 角色（presenter，📽，mascot presentation.svg 青紫 #8B7FD6）
- assets/mascots/presentation.svg（原创 chibi 鲸鱼娘+演示屏+遥控笔）
- skills/sci-slides/SKILL.md + scripts/make_deck.py（骨架函数 MAX_BULLETS=5/16:9/Results 图区 55%）
- 队长协议 + presenter 派工规则；版本 0.8.0 五处同步
- **实测**：headless 全链路——presenter spawn→task-35 completed→slides/demo_deck.pptx 生成
  （5 页 13.33×7.5in，Results 页嵌登记图，页标题为结论句）；吉祥物浏览器加载 ✓；三 tab 无回归 ✓

### 方法论参考源
- icip-cas/PPTAgent（outline→slide 映射、edit-by-reference）
- dream-rec/academic-ppt-skill（学术工程风格、audience-aware）
- jinwyp/open-ppt-skill（Kimi slides 式创建/编辑/导出）
- **待用户提供其自己的科研 PPT skill 仓库链接**——D1/D5 头注已留注记，提供后替换参考源并 diff 升级

### 下轮审核循环待办（v0.8 审查清单）
1. presentation 角色第 1/2 轮审核（按既定对抗审查模式：role prompt 质量/pptx 产出正确性/
   blueprint 对齐/web 渲染回归）
2. 遗留 v0.7 项：parse-fail 真实触发、图表格式校验、blocked 闸门、双份挂载排查
3. P6 打包发布（npm + 插件 index JSON + README + 桌面版核对）

## 追加（2026-11-08）：角色级 skill 菜单系统 v0.9.0 交付

### 功能
- 每角色 ≤3 精选开源 skill 仓库（lib/skillmenu.js CATALOG 27 项，17 仓库逐个 GitHub API 核验可达+许可）+
  用户自定义仓库链接（https 校验、注入用例 7 组全拒、userinfo 剥离）。
- 勾选安装：git clone --depth 1 → role-skills/<role>/<name>/（staging→原子落位+互斥队列）→ INDEX.md 生成
  → 成员 spawn 提示词追加"扩展技能库"段（索引绝对路径）→ 成员用 read 工具按需读取。
- **隔离**：不进 DSH 全局 skills registry（天然隔离）；每角色独立目录+独立索引；跨角色零泄漏（node 级验证）。
- 管理：sci_skill_menu/installed 工具 + 团队 tab「角色技能库」勾选菜单（POST /skill-manage，鉴权同款）
  + 自定义 URL 输入 + 移除按钮 + 桌面降级 chips。
- 通用模拟规范：universal-tool-onboarding.md 8 步（版本核验→手册章节→最小模板→冒烟→见证→生产→四层诊断→登记 dossier）。

### 验证（V1-V5 全过）
安装落盘+INDEX 生成 ✓；成员 prompt 实证含索引段且成员可读 ✓；隔离证明（simulator 技能不在 writer 索引）✓；
浏览器勾选安装→≤10s 面板更新→取消勾选同步移除 ✓；自定义仓（octocat/Hello-World）降级标记 ✓；
安全注入用例全拒 ✓；sci_ping/三 tab 回归 ✓。

### 遗留
1. 超大仓库 clone 期间 UI 仅"处理中"无进度条。
2. spawn 后新安装需 sci_team_send 唤醒告知（或重 spawn）。
3. /state 1s 缓存短暂滞后（3s 轮询自愈）。

## 最终交付（2026-11-08）：GitHub 发布 + 全新用户安装验证通过

### GitHub 仓库
- https://github.com/SPYfighting/deepseek-science （公开，MIT，master 干净历史——push protection 曾拦截
  ssh2 测试夹具私钥，已用 orphan 重写清除）
- Topics: dsh-plugin / deepseek-harness / science / ai-agents / research-workflow
- 附插件 index.json（format 1）供自定义插件索引直接引用

### 全新用户安装验证（模拟真实用户）
- rm 旧安装 → `dsh plugin --profile headless add github:SPYfighting/deepseek-science` → 零摩擦成功
  （修复三连后：① esbuild devDep 移除（prepare 门槛）② package-lock 移除（陈旧 esbuild 条目）
  ③ **ssh2 改为 esbuild 单文件捆绑 lib/vendor/ssh2.bundle.cjs**（嵌套 node_modules 被 pack 剥离 +
  ssh2 install 脚本触发 allowBuilds 门槛——双重问题一次解决））
- SSH 真实探测 ✓：labtest 主机 probe 返回 os/cpu/mem/GPU/磁盘/python 全字段（Linux 5.15 / 20 CPU /
  125Gi / 2×RTX 3090 24GB）

### 教训（重要）
1. **push protection**：ssh2 测试夹具含 SSH 私钥样例（公开测试键）→ GitHub 拒收 → orphan 重写历史清除。
2. **git push 空操作陷阱**：orphan 重写删了旧 master 后本地 master 无 upstream，`git push` 只打印
   "set-upstream" 提示（被 tail 截断误读为失败/成功）——**每次 push 后必须核对远端 HEAD 哈希**。
3. **嵌套 node_modules 不可发布**：npm/pnpm pack 永远剥离 node_modules 目录——vendored 依赖必须
   单文件捆绑（esbuild --bundle --external:cpu-features）。
4. ssh2 的 `install.js` 只是可选的 cpu-features 原生加速；纯 JS 模式完整可用（已实测真机）。

### 发布状态
- GitHub：✅ 已发布（安装即用）
- npm：待用户 `npm login` 后 `npm publish`（发布前 README 已注明 git 安装为当前支持路径）
- 索引：index.json 已入库；可提交 PR 到 imsai-sh/awesome-deepseek-harness-plugins 与
  dsh-1024store（用户操作或下轮执行）

## 补记（2026-11-10）：v0.10.0 验收遗留修复（B1/B2，此前漏记）

- **B1 图片格式校验**（figures.js）：登记前扩展名白名单（png/jpg/jpeg/svg/gif/webp/tiff）+
  文件头 magic bytes 双重校验；任意文件（.txt 等）不再能冒充图表混进图库。
  报错统一以「文件不是有效图片」开头。回归证据：v010-tests/test-b1-figures.mjs。
- **B2 审查输出解析失败重试**（reviewer.js）：findings===null 时自动重试一次，重试 prompt
  末尾追加「只输出 JSON 本体」；两次都失败才落盘 parse-failed 且 runReview 返回
  ok:false+parseFailed（调用方显式知道无结论，宁缺毋滥）。子 agent 调用本身抛错仍按 failed 不重试。
- 版本链/幂等登记（v0.9.0 Track 3）与蓝图 claims 逐条核对（v0.9.0 Track 2 B3）同属此阶段交付。

## 2026-11-10：v0.11.0 健壮性与安全批（F-A/F-B/SVG/配置化）+ 全链实测

### 修复与新增
- **F-A 间歇性 maxDepth 崩溃**：根因是历史调用缺 `request` 包装（v0.3.1 日志），残留契约违规为
  `signal` 误放在 request 内。对照官方 dsh-tool-subagent/lib/index.js L466-473 逐字段修正：
  `request:{prompt,parent}`、`signal` 提到 spec 层、delivery:'caller'。新增
  `awaitActivationResult(activation,timeoutMs)`：Promise.race 有界等待（spec.signal 只覆盖
  发布前取消，发布后挂死靠它兜底），任何错误路径 dispose 清理。回归测试逐字段钉死 spec 形态。
- **F-B parseFindings 健壮化**：贪婪正则改为 ① fenced ```json 块优先 ② 全文 balanced-brace
  span 扫描（字符串/转义感知深度跟踪，yield 顶层 {...}/[...]）③ normalizeFindings 归一
  （空数组合法=[]；非对象条目丢弃；severity 小写归入 pass/warn/fail 否则 warn；全垃圾=null）。
- **SVG 内嵌脚本安全检测**（figures.js `svgActiveContentReason`）：script 标签、on* 事件属性、
  javascript:/vbscript:/data:text/html URL、DOCTYPE ENTITY；字符引用解码（&#106;/&#x6a;/&Tab;/&colon;）
  + 标签内去空白压缩防混淆。命中即拒绝登记并提示重新导出纯静态 SVG。
- **配置化**（store.js `configOf`，$DSH_HOME/dsh-science/config.json 改即生效）：
  `falsificationThreshold`（正整数默认 2，coverageOf 证伪风险阈值）；
  `blockedGate`（'warn' 默认软警告记录未满足依赖 / 'hard' 依赖未 completed 拒绝派发）。
- 单元测试：tests/unit.test.mjs 57 例 7 套件全绿（node --test tests/unit.test.mjs）。

### 部署与实测证据（隔离 test-env，未碰全局/桌面版）
- profile 副本刷新：pnpm 对 file: 目录依赖 install --force 仍报 Already up to date 不重拷——
  改为按 package.json files 白名单手动同步 web/headless/scidev 三 profile（fresh=true agents=true）。
- headless run1b（research/dsh-headless-v011-run1b.log）：sci_ping ok v0.11.0；恶意 SVG 拒绝
  （报错原文「SVG 含可执行内容（<script> 标签）…」）；静态 SVG 登记 fig-mwavxm1l-h2kl v1；
  软闸门 dependencyGate={mode:warn,unresolved:[{id:task-nonexistent-999,status:missing}]}；task-3 挂板。
- headless run2（dsh-headless-v011-run2.log，config blockedGate=hard+threshold=3）：硬闸门拒绝派发
  （报错原文引用）、任务板无新增；coverage.falsificationThreshold=3 生效。测毕删除 config 恢复默认。
- web 实测（research/dsh-web-v011b.log + v011-tests/web-0*.png）：/sci-review 端到端
  run rev-mwaw06pw turn 1 → 9 条 findings 0 fail（5 pass 带窗口证据引用 + 4 blueprint-claim warn
  「窗口未覆盖」语义正确），子 agent 正常 spawn/回收，无 maxDepth 崩溃、一次解析成功；
  工作台三 tab（团队 DAG 含 task-3 / 文章框架 / 产物含新 SVG 卡与版本链徽章）渲染截图齐全。

### 本轮新坑（教训）
1. **pnpm file: 目录依赖不重拷**：install/--force 均视为 up-to-date；改源码后必须手动同步或删副本重装。
2. **Windows cmd.exe shell:true 截断多行 argv**：v09 runner 的 spawn(npx,…,{shell:true}) 使 headless
   只收到 prompt 首行（run1 实测）。新 runner research/v011-headless-run.mjs 直接 spawn
   node + @deepseek-ai/dsh/lib/bin.js，不经 shell，多行 prompt 原样进 argv。
3. **双服务器共写一日志**：后台子 shell 与 run_in_background 先后启动同写一 log，后者 `>` 截断前者
   输出致 token 丢失；一进程一日志、启动前确认端口空闲。

### 已知残留（非代码 bug）
- 产物 tab 有一条 v0.10 B1 之前登记的「回归测试：非图片文件」坏图卡（fig-mw6rk3qw-tpka）——
  历史测试数据，B1 已阻止新增此类登记；留作回归对照，不清理。
- 发布状态：按任务书要求**不上传/不合并 GitHub**，全部本地待用户验收。

## 追加（2026-11-11）：v0.11.0 批 2——双挂载 guard 生命周期修复

### 问题（v0.10 B3 guard 的回归洞）
- v0.10 防双份挂载用永久 `window.__DSH_SCIENCE_CLIENT_MOUNTED` 标志：apply 重入直接 return。
- 宿主 client-modules 的 `replace()` 先 `tearDownEntryFiber(entry)`（跑 effect dispose、注销标签）
  再**同窗重执行 bundle**（lib/client.js 实测代码路径）——永久标志会挡住这次重新注册，
  工作台标签在插件更新/HMR 替换后永久消失，只能整页 reload 自愈。
- TDD 复现：research/v011-tests/entry-mount.mjs（mock 对齐宿主语义：effect 立即执行、收集 dispose、
  teardown 逐个调用）——修复前 4 pass / 3 fail（teardown 后再 apply 注册数归零不恢复）。

### 修复
- client-src/index.jsx：标志改为逐部件活性对象 `window.__DSH_SCIENCE_CLIENT_MOUNT__={tab,body}`；
  每个注册的 dispose 复位自己的标记；apply 只补注册已死部件，全活才拦截（guard 日志保留）。
  非浏览器环境无条件注册；`__DSH_SCIENCE_CLIENT_MOUNTED` 兼容标记保留。
- 修复后 entry-mount 8/8 pass（含两轮 teardown→apply 自愈）；57 单测不受影响；client 重捆 153.3kb。

### 实测与边界
- live：整页 reload 后工作台单份渲染；插件页 dsh-science 开关 off→on 两轮，标签始终单份、宿主工具恢复。
- **探针结论**：插件开关不重执行 client bundle（mount 对象同一、probe 标记存活）；
  向 profile client.js 追加注释触发 client-hmr 轮询（500ms）亦未产生 replace 重_fetch——
  该 web 档案下插件行无 artifactBaseline，HMR replace 路径不可达（环境限制，记录备查）。
  故 replace 语义以宿主源码 + stub 生命周期测试为准，live 仅做回归验证。
- 测毕探针注释已清除、profile 副本与源码重新同步。

## 追加（2026-11-11）：v0.11.0 批 3——对抗审核发现修复 + 超大仓 clone 进度

### 独立对抗审核结论（subagent，SHIP-WITH-FIXES）
0 critical / 1 major / 5 minor / 2 nit。核心主张（F-A 调用形状、重试、有界等待、硬闸门、
config 生效、证据日志无伪造）经攻击均成立；唯一 major 是 SVG 登记闸门可被命名空间前缀绕过。

### 修复（TDD：先加 18 条对抗测试，red → green，83/83 pass）
- **[MAJOR] figures.js**：`<svg:script>` / `<x:script>` 命名空间前缀绕过——script 正则加
  `(?:[\w.-]+:)?` 前缀；补 xml-stylesheet PI（XSLT 可输出脚本化 HTML）、
  foreignObject/iframe/embed/object HTML 嵌入标签（iframe srcdoc 会把 `&lt;script&gt;` 解码执行）、
  `data:image/svg+xml` URL 拒绝；UTF-16LE/BE（带 BOM）先解码再安检（可用性，解码后脚本仍拦截）。
  不误伤正文里的字面 `&lt;script&gt;`（无 HTML 嵌入上下文时为惰性文本）。
- **reviewer.js**：parseFindings 改为「逐个 opener 取平衡片段 + 优先非空 findings」——
  空数组诱饵 `{"findings":[]}` 不再遮蔽真实 fail；不平衡 prose 花括号（`if (x) {`）或包裹 JSON 的
  prose 括号不再吞掉内层真实 JSON。awaitActivationResult 的 dispose 加宽限上限（3s）——
  挂起的 dispose 不再击穿「有界等待」。
- **store.js**：blockedGate 大小写/空白不敏感（`HARD` 笔误不再静默 fail-open 回退 warn）；
  阈值为数字或纯十进制整数字符串才接受（拒绝 `true→1`、`'0x10'→16` 的 Number() 强转陷阱）。

### 超大仓 clone 进度（brief 待办 7）
- gitClone 由 `--quiet` 改为 `--progress`，解析 stderr 进度行（Counting/Compressing/Receiving/
  Resolving/Updating），阶段切换立即打日志、同阶段 ≥5s 节流；超时（120s）报错附「最后进度 + 已用时长」，
  失败信息统一 `\r→\n` 规整；安装结果新增 `cloneMs`。
- 真机实测（隔离 test-env，网络约 30 KiB/s）：119 objects / ~4 MiB 的仓库克隆耗时 **106s**——
  修复前全程静默，修复后可见 24 条阶段/节流进度（如 `Receiving objects 26%，(32/119), 4.07 MiB | 35.00 KiB/s，已用 101s`），
  证明「超大仓零反馈」问题已解决，且慢网下接近超时上限时能提前判断。

### 实测（research/dsh-headless-v011-run3.log，headless 0.11.0）
1. sci_ping → ok=true，version=0.11.0。
2. evil-ns-script.svg → 拒绝原样报错「SVG 含可执行内容（<script> 标签）…」（MAJOR 修复生效）。
3. evil-foreignobject.svg → 拒绝「SVG 含可执行内容（HTML 嵌入标签（foreignObject/iframe/embed/object））…」。
4. utf16-clean.svg（UTF-16LE BOM）→ 成功登记 fig-mwbhhla4-f5tp，version=1，bytes=380（可用性修复生效）。
5. 大写 `"blockedGate":"HARD"` 配置下 dispatch 未满足依赖 → 硬闸门拒绝（大小写修复生效）。
- 测试后 config.json 已删除、恢复默认；未读取凭证、未打印密钥、未 spawn 成员。

### 新增测试资产
- tests/unit.test.mjs：+18 条（SVG 命名空间/PI/嵌入标签/data-svg/UTF-16、空数组诱饵、
  不平衡 prose、dispose 挂起、大写闸门、阈值强转），合计 83/83。
- test-env/v011-fixtures/：evil-ns-script.svg、evil-foreignobject.svg、utf16-clean.svg。
- research/v011-tests/run3-review-fixes.txt（五组验证 prompt）。

## 追加（2026-11-11）：v0.11.0 批 4——spawn 后新装 skill 自动唤醒（brief 待办 8）

### 问题
- 成员 spawn 时提示词才注入 `roleSkillSectionText(role)`（INDEX.md 索引）。已 spawn 的成员在队长
  之后安装新 skill 时收不到任何通知，只能靠队长手动 `sci_team_send` 告知路径——易漏、易忘。

### 设计（无循环依赖）
- `skillmenu.js` 新增 `setMemberWakeHook(fn)` 与 `formatSkillWakeText(entry)`（纯函数：技能名/仓库/
  INDEX.md + 每个 SKILL.md 绝对路径）。`installSkill` 成功且 `exec.agent` 存在时调用 hook，把
  `{attempted,targets,woken,failed}` 并入输出 `wake`；唤醒成功则改写 `note`，不再提示手动 send。
  由 Web UI（无 agent）触发的安装自然跳过。
- `team.js` 把 `childIdOf`/`wake` 提到模块级 `wakeMember(ctx,…)`，新增导出
  `wakeRoleMembers(ctx, agent, role, entry)`：按 `role` 且 `childId` 过滤已 spawn 成员逐个发送；
  `registerTeamTools` 里 `setMemberWakeHook((agent,role,entry)=>wakeRoleMembers(ctx,…))` 注册。
  skillmenu 不反向 import team，依赖方向保持单向。

### 验证
- 单测 +6（formatSkillWakeText ×2、wakeRoleMembers ×4：同角色过滤/无成员不发送/sendMessage 失败
  不抛/post-delivery abort 视为送达），合计 **89/89 pass**。
- 真机集成（research/auto-wake-integration.log）：真实 registerTeamTools 设 hook + 真实 installSkill
  克隆 ai-peer-review-skill（cloneMs=2662，进度日志正常）→
  `skill auto-wake: role=reviewer targets=1 woken=1 failed=0`，成员 child-reviewer 收到含
  `role-skills/reviewer/INDEX.md` 与 `.../ai-peer-review/SKILL.md` 的通知；测试后 removeSkill 清理干净。

## 追加（2026-11-11）：批 3 复审（第二轮对抗，BLOCK）→ 全部修复

第二轮独立对抗审核对批 3 修复继续攻击，判 BLOCK：1 critical + 2 major + 2 minor + 1 nit。
逐条 TDD 修复（先加 9 条对抗测试，98/98 pass）：

- **[CRITICAL] figures.js 标签提取非引号感知**：XML 属性值里合法的 `>` 会截断 `/<[^>]*>/`，
  其后 `onload` / `javascript:` 漏检（`<rect fill="a>b" onload=…>` 实测绕过）。改为
  `/<(?:[^>"']|"[^"]*"|'[^']*')*>/g` 引号感知取标签。事件属性正则同时覆盖紧邻 `/` 的
  `<svg/onload=…>`（`(?:^|[\s/])(on[a-z]+)\s*=`），仍不误伤 `data-onclick`。
- **[MAJOR] reviewer.js 非空 pass 诱饵遮蔽真实 fail**：原「首个非空」只挡空数组诱饵。改为
  对全部候选/内层 span 打分（fail 数优先、其次条目数）取最优——pass 诱饵无法再压过 fail 集。
- **[MAJOR] severity 未 trim/未识别近义词**：`" Fail "` / `critical` 静默降级为 warn → failCount=0
  误报通过。改为 `trim().toLowerCase()` + 别名表（error/fatal/critical/high→fail，warning/medium→warn，
  ok/success/passed→pass）。
- **[MINOR] figures.js UTF-16BE 奇数尾字节**：`swap16` 抛 ERR_INVALID_BUFFER_SIZE 逃出
  `{ok:false}` 契约。先按偶数字节截齐再交换。
- **[MINOR] reviewer.js O(n²) span 扫描**：改为单遍栈扫描 O(n)，并只解析含 `findings`/裸数组的
  span（上限 2000）。实测 50k opener 从秒级降到 **2ms**。
- **[NIT]** 上述 `/onload` 变体已一并覆盖；foreignObject/data:image/svg+xml 对 draw.io/PowerPoint
  导出的误伤已在 SPEC 注明（fail-closed 取舍）。

### 直接探针（本地，同生产代码路径）
quoted-`>`+onload → 事件属性 onload；quoted-`>`+javascript: → 可执行 URL；`<svg/onload>` → 事件属性；
CDATA 内 script → 拒绝；干净 SVG → null；`data-onclick` → null（不误伤）；UTF-16BE 奇数尾 → `{ok:true}`；
pass 诱饵+真 fail → 选中 fail；`" Fail "`/`critical` → fail；50k opener → 2ms。

## 追加（2026-11-11）：第三轮对抗审核（SHIP-WITH-FIXES）→ 全部修复

第三轮独立审核对 v0.11.0 全量改动判 SHIP-WITH-FIXES：1 HIGH + 4 MEDIUM + 2 LOW。逐条 TDD：

- **[HIGH] `/plugins/dsh-science/file` 下发 SVG 未复检**：登记闸门只管登记时，登记后文件被替换
  仍会以 `image/svg+xml` 直接下发执行。修：读盘后用同一 `svgActiveContentReason` 复扫，命中 403
  `refused: SVG contains active content (…)`；SVG 响应加 CSP sandbox + `nosniff`（mascot 路由同）。
  真机验证：恶意 SVG → 403，干净 SVG → 200 + CSP + nosniff。
- **[MEDIUM] 属性解析非严格**：`<rect a="b"onload=…>`、属性值无分号字符引用（`&#106avascript:`）
  可绕过。改为单遍线性标签扫描 + 引号感知属性解析（`attrsOf`），事件属性只认 `^on[a-z]+$`，
  可执行 URL 在属性值内检查；字符引用正则分号可选。
- **[MEDIUM] XML 注释诱饵误报**：`<!-- <script> -->` 曾判危险。先剥离成对注释再扫描。
- **[MEDIUM] `<style>` 未扫描**：`<style>@import …; a{background:url(javascript:…)}</style>` 放行。
  增加 `<style>` 体与 `style=` 属性的 CSS 可执行内容检测（javascript:/vbscript:/expression(）。
- **[MEDIUM] parseFindings 两处 fail-open**：垃圾数组（`["a",1]`）参与打分可能压过真实 fail；
  缺失 severity 静默记为 warn；span 预算耗尽返回 []。修：条目必须有非空 message/claim 才保留；
  缺失/未知 severity → fail（fail-closed）；预算耗尽返回 null 触发重试；保留上限 200 条。
  直接探针：garbage+real → 选中真实 fail；无 severity → fail；span 超限 → null。
- **[LOW] 标签正则 O(n²)**：40k `<a` 从秒级降到 1.1ms（单遍扫描）。
- **[LOW] 通用 abort 误报送达**：`team.wakeMember` 原把所有含 `aborted` 的错误当已送达。改为只认
  `throwIfAborted`（harness 投递后抛出的已知形态），其余 abort 按失败上报。

### 验证
- 单测 129/129 pass（19 suites）：新增 18 条（属性解析/无分号引用/注释/style/线性扫描/decodeSvgText/
  garbage 数组/缺失 severity/blocker→fail/4001 截断→≤200/span 预算→null/通用 abort 不算送达），
  并把旧「bogus severity → warn」期望改为 fail。
- 同步 figures.js/reviewer.js/team.js/httpdata.js 到 web/headless/scidev 三个 profile，重启 web 实测
  403/200 + CSP/nosniff 通过。

## 追加（2026-11-11）：文章蓝图 × 审查深度整合——主张级审查覆盖

brief 优先清单完成后选的深化方向：此前后端只有会话级 ReviewRun，蓝图主张「有没有被审、结论
是什么」要靠人肉对照。新增 `lib/reviewcov.js`，把蓝图每条主张自动映射到 `blueprint-claim` 审查
finding，并贯通 /state、overview、export、工作台 UI（规格见 SPEC §15）。

- 匹配顺序：`core`/`res-N` 前缀 → 归一化精确文本 → 长度 ≥12 且唯一命中的包含匹配；歧义不匹配。
  同一 claim 取最近 run（`finishedAt` 升序覆盖），run 内取最重 severity。
- 警告三类：完全无审查；已确认主张最近判 fail（点名 runId+理由）；有审查但确认主张仍漏审（列 id）。
- UI：文章框架页新增「主张审查覆盖」面板（已审 X/Y + pass/warn/fail 计数 + 警告带），结果行加
  `审✓/审!/审✗/未审` 徽章；`sci_blueprint_export` 的 Markdown 也输出该节。

### 验证
- 单测 +13（reviewcov 全口径），合计 **129/129 pass**。
- 真机集成 `research/v011-tests/reviewcov-integration.mjs`：真实 blueprint 工具 + 临时 DSH_HOME，
  counts total3/reviewed3/fail1/warn1/pass1，export 含「主张审查覆盖」「已审 3/3」「res-1：fail」→ PASS。
- test-env 注入演示审查记录后 /state `reviewCoverage` 计数正确（4/4，fail1·warn2·pass1），
  headless Chrome 截图 `research/v011-tests/web-07-reviewcov.png` 可见徽章与面板；随后已还原
  reviews.json 原文件。

## 追加（2026-11-11）：团队 DAG 依赖聚焦（第四轮）

第四轮选 DAG 交互打磨（对齐 agent-teams DependencyMap 的「点 pin 详情 + Esc 关闭 + 关系高亮」）：

- 新增 `lib/dag.js` 纯函数：`normalizedBlockedBy`（去空/非字符串/重复/自环）+ `dependencyClosure`
  （BFS 上下游闭包，环安全，缺失依赖忽略，未知起点空集）。client 经 esbuild 直接引用，单测同源。
- 团队 tab：悬停或选中节点高亮上下游整条链（链边加粗，`data-dag-hot`），无关节点淡到 0.32
  （`data-dag-dimmed`）、无关边淡到 0.18；选中优先于悬停；Esc 收起详情；节点可键盘聚焦。
- 详情卡新增「解锁」下游任务 chips（`data-task-downstream`），与依赖 chip 一样可点击跳转；
  空态提示改为「悬停高亮依赖链 / 点击看详情 / Esc 收起」。

### 验证
- 闭包单测 +7（链/菱形/环/缺失依赖/未知起点/自环/归一），合计 **136/136 pass**。
- headless 实测 `research/v011-tests/web-dag-focus.mjs`（注入 6 任务链 + 1 个无关任务，测后还原
  team.json）：悬停 task-2 → `focused=[task-2]`、`dimmed=[task-6]`、5 条 hot 边；详情文本含
  「依赖 task-1」「解锁 task-3 task-4 task-5」；Esc 后 `detail` 元素消失；截图
  `research/v011-tests/web-09-dag-focus.png` 可见蓝色高亮链与淡化节点。
- 客户端重新构建（157.6kb）并同步 web/headless/scidev 三个 profile。

## 追加（2026-11-11）：第四轮对抗审核修复（H/M + LOW）

第四轮独立审核（3 HIGH / 3 MEDIUM / 6 LOW）确认上一轮安全补丁有效；本轮修复匹配顺序、脏数据防御、截断丢 fail 等问题：

- H1 主张匹配文本优先：审查器可能携带错误的 `res-N:` 前缀，旧逻辑前缀先命中会错误归因。现先做 NFKC 归一化精确匹配，再退化为 ≥12 字符唯一包含匹配，前缀仅作兜底。
- H2 状态文件脏数据防御：`team.json` 经 `sanitizeTeamState`（成员需对象 + name、任务需对象 + id、blockedBy 归一、taskSeq 兜底）；`blueprint.json` results 过滤非对象/无 id 条目；`/state` 使用清洗后的团队数据。
- H3 客户端同口径：`normalizeClientState` 在轮询快照入库前清洗 members/tasks，`TaskDag` 再经 `normalizeTaskBoard`，脏 blockedBy 不会进入渲染。
- M1 截断不丢 fail：parseFindings 超过 200 条时先保留全部 fail，再补 pass/warn，最终仍按 fail 优先排序。
- M2 SVG 事件/样式绕过：事件属性识别命名空间前缀（`ev:onload` 等）；CSS 十六进制转义先解码再折叠空白（`\6a avascript`），style 属性与 `<style>` 正文同规则。
- M3 无 BOM UTF-16：`decodeSvgText` 嗅探 `3C 00` / `00 3C` 并按 UTF-16 解码（偶数长度截断），`<script>` 不再绕过检测。
- LOW：悬停高亮滚动越界钳制、审查时间支持 ISO 字符串、依赖门改用终态集合（failed/cancelled/deleted 不再算阻塞）、单 span 上限 1MB 防大切片。

### 验证
- 单测 +14（共 **150/150 pass**，23 suites）。
- 真机路由探针 `research/v011-tests/web-fetch.mjs`：`ev:onload` → 403、无 BOM UTF-16 script → 403、干净 SVG → 200 且带 CSP sandbox + nosniff。
- DAG UI 复测截图 `research/v011-tests/web-10-dag-focus-round4.png`；客户端重建并同步三 profile；team.json / reviews.json 已还原。

## 追加（2026-11-11）：审查载荷瘦身与详情懒加载（第五轮）

轮询性能优化：实测 `/state` 208KB，其中 `reviews` 187KB（98 个 run 的全量 findings），而工作台每 3s 轮询一次。

- 新增 `lib/reviewruns.js`：`reviewSummariesOf` 只输出摘要（id/key/状态/turn/时间/counts），
  `reviewRunOf` 返回单 run 详情（保留 findings，剔除 raw 与 password 类键）。
- `/state` 的 reviews 改为摘要；新增 `GET /plugins/dsh-science/review?run=<id>`（鉴权同 state/file，
  缺参 400 / 未知 404 / 命中 200）。客户端展开审查行时才 fetch 详情并缓存，带 loading/error 态。
- 独立对抗审核（5 MEDIUM / 8 LOW）发现并已修复：严重度归一化与 `reviewcov` 分叉（现复用
  `normSeverity`，critical/high→fail 等）、重复/非字符串 id 在 React key 与详情缓存里串台（id
  唯一化 + 对象键兜底，详情接口两种 id 都接受）、数字字符串时间被判 0（先试 `Number`）、
  `/review` 注册未包 try/catch（失败会阻断后续路由与重注册）、测试缺口（补别名/重复 id/数字
  字符串/401 鉴权用例）。LOW 一并处理：快速双击重复 fetch（inflight set）、卸载后 setState
  （aliveRef）、旧服务器返回非 JSON 时的误导性报错、`mount-bundle.mjs` 重建。
- 保留未修（LOW）：详情缓存无 TTL（本地手改 reviews.json 后需重开工作台）；`sci-data://reviews`
  仍返回全量 run（含 raw）——为 agent 数据资源通道，后续批次统一评估。

### 验证
- 单测 157/157（24 suites）。
- `/state` 实测 45,206B（reviews 23,581B），较 208,371B / 186,746B 降约 78% / 87%。
- headless 实测 `research/v011-tests/web-review-lazy.mjs`：98 行摘要（fail/warn 计数来自摘要）
  → 展开首行后 findings 文本出现；截图 `web-12-review-lazy.png`；客户端重建并同步三 profile。

## 追加（2026-11-11）：/sci-status 实时体检与错误收口（第六轮）

- `/sci-status` 从静态模块名改为 `lib/status.js` 实时快照：团队/蓝图/审查/资产/配置计数 + 唯一「下一步」；首跑核心为空时给三步上手，不再输出静态功能清单。
- `sci_team_status` 修复 headless 实测暴露的真实 bug：`undefined` 字段导致 `invalid output: value is not lossless JSON`；成员/任务字段统一 String/null/[]（headless 复测返回合法 JSON）。
- 独立对抗审核（1 HIGH / 4 MEDIUM / 6 LOW）修复：审查时间越界使 `toISOString` 抛 RangeError、dispatch 依赖 `status` 仍可能 undefined、命令处理器缺 try/catch、失败审查 run 被显示成 0 问题、`sci_job_harvest` 的 `bigFilesRemote` undefined、状态文件解析失败静默当空、截断劈开代理对、配置归一与运行期分叉、测试缺口、帮助文案与 SPEC/HANDOFF 漂移。
- 保留：完成数仍只统计 `completed`（failed/cancelled/deleted 的「已结束」语义后续统一）；审查详情缓存无 TTL 等第五轮已记录项不变。
- 验证：单测 171/171（26 suites，本轮新增 9 条，含 `apply()` 接线、坏 `DSH_HOME` 容错、dispatch JSON 往返）；live 实测 `research/v011-tests/status-live.mjs`（真实 98 次审查 / 23 异常 / 图表 7 / DB 1 / SSH 3）；headless 实测 `sci_team_status` 合法 JSON；三 profile 已同步。
- 环境观察（非本轮代码）：headless 启动仍报 agent-team 0.1.5-alpha.2 与 dsh 0.2.2-rc.1 不兼容（profile 已自动禁用），以及 test-env 目录 `SetNamedSecurityInfoW grantWrite` 失败（Win32 5）；作为环境阻塞记录，不影响本轮功能。

## 追加（2026-11-11）：全新状态零摩擦审计（第七轮）

- 隔离 `research/v011-tests/fresh-home`（web/headless profile 副本，无科研数据）+ 空工作区：headless 6 个只读工具（ping/team_status/blueprint_overview/figure_list/db_profiles/skill_installed）全部合法 JSON；web 三 tab 正常渲染，`/state` 200 空快照、`/review` 未知 run 404、文件树 0。
- 发现并修复空态误导文案：无 result 时文章框架曾显示「覆盖完整」、导出报告曾写「覆盖完整，无警告」「已审 0/0」。现分别提示先 `sci_result_add` / 尚无带 claim 主张；`coverageOf` 增加 `total`，negative/dropped-only 显示「无可支撑的 result」；导出返回 `coverageStarted`。
- 独立对抗审核（0 HIGH / 5 MEDIUM / 5 LOW）后修复：export 在缺 `total` 时回退最后一个错误分支（改用 state.results 计数）、paperView 空摘要、导出审查 0/0、negative-only 仍称完整、客户端缺 `total` 时误报空态、夹具 cwd 未隔离、web-fresh 端口/清理/断言、测试 try/finally 与缺失用例、token 日志。保留：`sci_skill_installed` 在无安装时返回不存在的 `indexMd` 预期路径（LOW，仅为路径提示）。
- 夹具改进：`v011-headless-run.mjs` 支持 `V011_HOME`/`V011_WORKSPACE`；`web-fresh.mjs` 随机 CDP 端口、清理临时 profile、断言空态不含「覆盖完整」。
- 验证：单测 174/174（27 suites）；headless 实测空蓝图 `paperView.summary` 与导出 MD 均为未开始文案；截图 `web-13-fresh-empty.png` / `-article.png`；test-env 历史数据未改动（reviews 98 条）；三 profile 同步。

## 追加（2026-11-11）：全工具 headless 证据矩阵（第八轮）

- 在隔离 `fresh-home` + `fresh-workspace` 下为 39 个工具中的 37 个建立 headless 实测证据（batch A–F，日志 `research/v011-tests/run8-batch*.log`）：只读工具返回结构化数据；写/变更工具返回 `ok:true`；错误路径给出可行动提示而非 TypeError。
- TDD 先失败后修复四类真实缺陷：(1) 9 个写/变更工具缺 `ok` 字段 → `blueprint_align`/`blueprint_link_figure`、`db_profiles`/`db_tables`/`db_query`/`db_execute`、`ssh_profiles`/`probe`/`exec`/`job_submit` 统一补 `ok:true`；(2) 已删除任务仍计入实时统计 → `status`/`blueprint_overview` 排除 tombstone，新增 `deletedTasks`/`deletedTaskCount`，状态大小写不敏感；(3) agent/skill/recipe/SPEC 引用不存在的工具名（`sci_lit_search` 等）→ 改为 `web_search`/`web_fetch` + `sci_doi_verify`，SPEC 将未实现工具标为规划中；(4) SSH 未知 profile 触发 `getClient(undefined)` → `requireProfile` 明确报错，`job_logs`/`job_harvest` 校验记录 profile 与请求一致、旧记录缺 profile 时拒绝。
- 独立对抗审核（1 HIGH / 4 MEDIUM / 3 LOW）后修复：SPEC 声称 db/ssh profile add/remove 需确认但实现缺失（HIGH）→ 补 `tools/pre-execute` ask 门控并加测试；ssh `import`/`exec`/`job_submit` 缺 `ok`、`job_logs`/`harvest` 忽略 `args.profile`、SPEC 参数漂移（MEDIUM）→ 全修；大写 `DELETED` 未排除、`resetState` 卫生、HANDOFF/映射表陈旧（LOW）→ 全修并同步五 profile。
- 验证：单测 183/183（28 suites）；batch F 在 `DSH_SCIENCE_AUTO_APPROVE=1` 下确认 db/ssh profile add/list/remove 六个调用全部 `ok:true` 且测试 profile 已清理；五 profile 字节一致；SPEC 新增 §20（工具输出契约与删除任务口径）。未覆盖：真实远端成功路径、真实 skill clone 仅验证错误路径；`spawn_all`/`review_send` 本轮未单独实跑；agent-team 0.1.5-alpha.2 与 dsh 0.2.2-rc.1 不兼容（自动禁用，环境阻塞）。

## 追加（2026-11-11）：技能安装成功路径端到端（第九轮）

- 补齐 `sci_skill_install` 从未实测的成功路径：单测用本地仓库夹具 + `cloneImpl` 注入新增 22 个用例（自定义/精选安装、subdir、缺 subdir、无 SKILL.md、扫描深度/跳过噪音、描述截断、同名并发、clone 失败清理、URL 白名单、损坏状态、旧条目、排序、链接拒绝、唤醒成功/失败/不阻塞）；headless 用真实 GitHub 小仓库（AlexWortega/ai-peer-review-skill）实测安装→可见→重复安装被拒→菜单→卸载→归零，日志 `research/v011-tests/run9-skill.log` 与 `run9-skill2.log`，自动唤醒实测 `targets=1 woken=1`。
- TDD 发现并修复：`repo_id` 与 `repo_url` 同时提供时静默选目录 → 明确报错；`gitlab.com.<域>` 仿冒域名可通过白名单 → 收紧；`roles` 为数组、条目为 null/字符串、`skills` 含 null 时 `spawn` 提示词与 `/state` 快照抛 TypeError → `loadState` 统一归一化并在渲染/工具输出逐点判空；CATALOG subdir 为指向仓库外的链接时静默装出空目录 → `realpath` 前缀复核后拒绝；cpSync 会解引用 junction 而漏过过滤 → 安装拷贝显式跳过符号链接/联接；SKILL.md 枚举顺序随文件系统变化 → 排序保证 INDEX 可复现；`.staging` 每次留空目录 → 清空后连父目录删除；VERSION 仍为 0.10.0 → 0.11.0。
- 独立对抗审核（2 MEDIUM / 5 LOW）后全部闭环：状态归一化、条目级空值、subdir realpath、gitlab 前缀、排序测试有效性、staging 清理、唤醒移出安装互斥队列（慢 sendMessage 不再阻塞后续安装/删除）；二次审核确认 F1/F2 修复有效，并补掉 `skills` 元素级空值与 INDEX 渲染缺 `dir` 的兜底。未覆盖：精选目录的真实远端 subdir 仍未逐个实跑（夹具覆盖）；`spawn_all`/`review_send` 留待下轮。
- 验证：单测 205/205（29 suites）；五 profile 同步且 `skillmenu.js` 哈希一致；test-env 测试残留（空 `.staging`、无状态的旧 INDEX 目录）已清理；SPEC §14 更新状态容错、链接拒绝与唤醒时序。

## 第十一轮（2026-11-11）：HIGH-1/2/3 修复 + 角色提示词强化 + v0.10.1→v0.11.1

### 对抗审核修复（前一轮发现的 HIGH 级问题全部解决）
- **HIGH-1** wake 未传 signal：`sendMessage` 第 4 参补 `{signal: AbortSignal.timeout(15000)}`；删除 `throwIfAborted` 特判（该分支只覆盖假阳性路径——消息从未送达却返回 woken:true）
- **HIGH-2** 测试假阳性固化：mock 的 `sendMessage` 第 4 参补 `options` 并逐 case 断言 `signal instanceof AbortSignal`；TypeError/AbortError 用例断言任务保持 pending
- **HIGH-3** 跨会话成员 childId 不可达：wake 失败含 UNAUTHORIZED → 清除过期 childId + `staleMember:true` 标记；spawn 复用不再盲写 `parentSessionId`
- **MEDIUM**：spawn 复用校验 role 一致；spawn_all 返回统一三态；review_send result_id 需蓝图存在；scope 枚举单一定义；`team_send` desc 上限 4000

### 角色提示词全面强化（4 个偏薄角色 13-15 行 → 27-36 行）
- analyst：schema 优先 / 统计三件套 / 多重比较 / 质量警告
- reviewer：追因不复算 / 六项检查 / 严重度语义 / 表格程序化解析
- literature-scout：检索礼仪 / DOI 闸门 / 缺口卡 / 可复现记录
- writer：三级润色 / 事实红线 / IMRaD 逐节 / **衔接设计** / **蓝图对齐** / 自查清单合同

### 致命打包 bug 修复
- `package.json` 的 `files` 白名单漏了 `agents/`——角色提示词根本没进安装包。已在 v0.10.1 修复并全新安装验证。

### 最终状态
- 测试：**217 pass / 0 fail**（含 HIGH-1/2/3 修复回归 + HIGH-3 新测试）
- SSH 真机探测：labtest 主机 os/cpu/mem/GPU 全字段返回 ✓
- 插件市场 PR #860：已合并（Codex 两条 P1 意见修复后 static-review 通过）
- GitHub：SPYfighting/deepseek-science v0.11.0（所有修复已推送）

### 依赖打包方案（v0.10.0 最终定案）
- ssh2 → esbuild 单文件捆绑 `lib/vendor/ssh2.bundle.cjs`（嵌套 node_modules 永远不进 pack）
- postgres/mysql2 → 纯 JS 无生命周期脚本
- `package.json` 不含 ssh2（bundle 自包含）
- `package-lock.json` 不入库（stale 条目触发消费端 build 门槛）
