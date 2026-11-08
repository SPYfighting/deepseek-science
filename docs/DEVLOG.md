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
