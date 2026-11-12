# 🧪 dsh-science — DeepSeek Harness 科研工作台插件

> **Science team workbench for DeepSeek Harness** — 一个把 DeepSeek Harness 变成科研团队协作平台的插件：9 个专业科研角色（鲸鱼娘吉祥物）由队长统一调度，围绕**文章蓝图**（核心主张 → Results → Tasks → 图表证据）自主推进科研工作。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1B6EC2)](https://github.com/topics/dsh-plugin)
[![Version](https://img.shields.io/badge/version-0.13.0-blue)](package.json)

English | [中文](#中文说明)

## What it does

Turn a DeepSeek Harness session into a **science team captain** backed by 9 specialist agents (literature scout, topic designer, data analyst, simulator, model trainer, figure expert, writer, reviewer, presentation expert). The captain dispatches all research work to members, tracks it on a shared task board, and defaults to dispatching a reviewer after every execution task. Everything revolves around a **Paper Blueprint**: a core claim supported by 3–5 Results, each backed by tasks and figures — negative results trigger blueprint reassessment (adjust or falsify).

- **任务流 DAG**（团队 tab）：成员科研小队卡展示在线状态、当前任务与角色；任务按状态分列、依赖相连，并可按 Result 聚焦
- **文章框架 tab**：核心 → Results → 任务/图表框架图 + 列表视图；每个 Result 显示真实任务、DOI 核对、图件终审、主张审查和下一步
- **产物 tab**：图件计划、PDF/SVG/位图登记、期刊投稿前检与人工终审状态，以及文件、SSH 作业和审查记录
- **工具链**：SQLite/PostgreSQL/MySQL 只读优先查询（写操作审批）、SSH 远程作业引擎（Slurm/直发、收割、诊断）、科学绘图规范（Python/R 出版级）、文献检索与 DOI 核验、通用模拟工具上手规范（8 步）与 5 个内置工具档案
- **角色技能库**：每角色 ≤3 个精选开源 skill 仓库，按角色提示词和独立索引控制发现范围；另提供 Scientific Figure Library 的独立可选插件入口，不混入角色技能克隆目录
- **安全**：文件路由防路径穿越、写操作与远程操作审批、凭据不进模型上下文

## Install

Requires [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **≥ 0.2.0 < 0.3.0**（在 0.2.2-rc.1 web 与官方桌面版 0.2.2-rc.1 上测试通过）。

```bash
# Web / CLI（web profile）
dsh plugin --profile web add SPYfighting/deepseek-science

# 或在应用插件页：添加插件 → 填入 SPYfighting/deepseek-science
```

然后重启 Harness。右栏「开始」页出现**科研工作台**胶囊，会话内 `/sci-*` 命令可用。

**桌面版说明**：
- 团队/文章框架/产物 三标签与全部团队工具均可用（桌面内嵌同一 Web UI）
- 依赖 `ssh2` 含可选原生构建脚本——桌面插件管理器会请求批准一次构建（标准社区插件流程），批准后 SSH 功能完整；不批准则 SSH 模块退化为纯 JS 实现
- 工作台数据面板（HTTP 轮询）在桌面版降级为提示文案（桌面无 webServer，属平台约束）；团队协作页、任务板与全部工具不受影响

> npm 包即将发布；当前 GitHub git 安装是完整支持的官方路径（支持 `dsh plugin add github:SPYfighting/deepseek-science`）。

## Quick start

1. 打开右栏 **科研工作台** → 团队 tab → 勾选生成你的团队（或让队长 `sci_team_spawn_all`）
2. 对队长说你的科研目标（如"分析 demo.db 的差异表达基因并写摘要"）——队长会建蓝图、拆 Results、派任务给成员
3. 队长先复述蓝图；核心与 Result 未经用户确认时，执行任务不能派发。**文章框架** tab 实时展示任务、文献、图件和审查的真实状态
4. 绘图按 `sci_figure_plan → sci_figure_register → sci_figure_audit → 研究者人工终审` 执行；自动通过不等于期刊保证接收
5. 任意时刻 `/sci-review` 审查最近一轮工作（数字溯源/图文一致/伪造检测）

## Configuration

Optional file `$DSH_HOME/dsh-science/config.json` (edit takes effect immediately, no restart):

```json
{ "falsificationThreshold": 2, "blockedGate": "warn" }
```

| Key | Default | Meaning |
|---|---|---|
| `falsificationThreshold` | `2` | Negative-result count that triggers the falsification-risk warning (with zero supported results). Positive integer. |
| `blockedGate` | `"warn"` | Dispatch dependency gate: `warn` = dispatch anyway and report unresolved deps; `hard` = refuse dispatch until every `blocked_by` task is completed. |

中文：可选配置 `$DSH_HOME/dsh-science/config.json`，改即生效。`falsificationThreshold` 为证伪风险触发的负面结果数阈值（正整数，默认 2）；`blockedGate` 为派单依赖闸门（`warn` 软警告默认 / `hard` 依赖未完成拒绝派发）。文件缺失或损坏时按默认值运行。

## Documentation

- [交接文档 HANDOFF](HANDOFF.md)（目的/需求对照/待办/验证方法）
- [功能规格说明书](docs/SPEC.md) · [开发日志](docs/DEVLOG.md) · [agent-teams 协作配方](docs/recipes/agent-teams-science.md)

## License

MIT — 见 [LICENSE](LICENSE)。吉祥物与 UI 模式向 [dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（MIT）与 [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)（MIT）致谢；绘图/写作/模拟技能设计参考 [AcademicForge](https://github.com/HughYau/AcademicForge)（MIT）、[K-Dense scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)（MIT）、[nature-skills](https://github.com/Yuan1z0825/nature-skills)、[PaperSpine](https://github.com/WUBING2023/PaperSpine)、[ARS academic-research-skills](https://github.com/Imbad0202/academic-research-skills)（CC-BY-NC 4.0）。

---

## 中文说明

**dsh-science** 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 科研工作台插件：9 个专业科研角色（文献调研、课题设计、数据分析、计算模拟、模型训练、科研绘图、文章撰写、科研审查、汇报PPT）组成团队，由队长统一调度，围绕**文章蓝图**（核心主张 → 3-5 个 Results → Tasks → 图表证据）推进科研工作。负面结果自动触发蓝图重评甚至证伪流程。

### 核心功能

| 模块 | 说明 |
|---|---|
| 团队 DAG | 小队状态卡 + 当前任务 + 状态列任务流 + 依赖箭头 + Result 聚焦 |
| 文章框架 | 核心→Results→任务/图表；真实任务/文献/图件/审查状态与下一步 |
| 产物 | 图件计划、版本链、投稿前检/人工终审、文件树、SSH 作业与审查记录 |
| 数据库 | SQLite/PostgreSQL/MySQL，只读守卫 + 写审批 |
| SSH 远程计算 | 探测/提交/监控/收割，Slurm 与直发双模式，断连安全 |
| 自动审查 | 数字溯源/断言-执行一致/图文一致/引用卫生/伪造检测，fail 自动要求修正 |
| 角色技能库 | 每角色 ≤3 精选开源 skill 仓库；按角色索引隔离“默认可发现性”，不宣称文件系统访问控制 |
| 可选绘图库 | Scientific Figure Library 独立插件入口；按确切版本预览/复制模板，不自动执行第三方代码 |
| 通用模拟规范 | 新工具 8 步上手协议（版本核验→手册→冒烟→见证→生产→诊断→dossier）|

### 设计参考（致谢）

- [agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（MIT）— 团队协作页面模式与鲸鱼娘吉祥物形式
- [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)（MIT）— Router/Worker 双层架构思想
- [AcademicForge](https://github.com/HughYau/AcademicForge)（MIT）— Claude Science 计算技能移植版的验证阶梯与诊断表
- [K-Dense scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)（MIT）— 工具档案模式
- [OpenAI4S / openscience / PaperSpine / ARS / nature-skills](docs/SPEC.md#_references) — 论文蓝图方法论
