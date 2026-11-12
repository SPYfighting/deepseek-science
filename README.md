# 🧪 dsh-science — DeepSeek Harness 科研工作台插件

`dsh-science` 把 DeepSeek Harness 会话扩展为可追踪的科研团队工作台。9 个专业角色由队长统一调度，以“科学主张—证据—文章呈现”为主干推进文献、分析、模拟、绘图、写作、审查与汇报工作。

[![许可证：MIT](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-MIT-yellow.svg)](LICENSE)
[![DSH 插件](https://img.shields.io/badge/DSH-%E6%8F%92%E4%BB%B6-1B6EC2)](https://github.com/topics/dsh-plugin)
[![版本：0.14.0](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-0.14.0-blue)](package.json)

## 功能概览

| 模块 | 作用 |
|---|---|
| 科研团队 | 文献调研、课题设计、数据分析、计算模拟、模型训练、科研绘图、文章撰写、科研审查和汇报制作 9 个角色 |
| 论文证据主干 | 用“核心贡献 → Result → Claim → Evidence”组织研究；确认凭据绑定具体修订，未确认不能进入正式执行 |
| 团队任务图 | 用任务依赖图（DAG）展示小队状态、当前工作、任务依赖与阻塞原因，并可按 Result 聚焦 |
| 论文驾驶舱 | 展示探索到审计冻结的阶段、关键决策，以及每个 Result 的科学、文稿、投稿三类就绪状态 |
| 科研图件 | 支持绘图计划、版本登记、PDF/SVG/位图、期刊尺寸与有效分辨率前检、源数据追踪和人工终审 |
| 数据与计算 | SQLite、PostgreSQL、MySQL 只读优先查询，以及 SSH 远程作业提交、监控、诊断和结果收割 |
| 自动审查 | 核对数字溯源、主张与执行一致性、图文一致性、引用卫生、内容真实性和计划完成度 |
| 角色技能库 | 每个角色最多展示 3 个精选开源技能仓库；按角色隔离默认发现范围 |

## 安装

需要 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `>=0.2.0 <0.3.0`。当前版本已在 `0.2.2-rc.1` 网页版和桌面版上验证。

```bash
# 网页版或命令行使用 web 配置安装
dsh plugin --profile web add SPYfighting/deepseek-science

# 也可以使用 GitHub 地址
dsh plugin --profile web add github:SPYfighting/deepseek-science
```

也可在应用的插件页面选择“添加插件”，填写 `SPYfighting/deepseek-science`。安装后重启 Harness，右侧栏会出现“科研工作台”入口，会话内可使用 `/sci-*` 命令。

桌面版使用同一套团队、论文框架和产物界面。桌面环境没有网页服务时，依赖 HTTP 轮询的数据面板会显示平台限制提示，但团队工具与任务板仍可使用。

## 快速开始

1. 打开“科研工作台”，默认进入“论文驾驶舱”。先说明科研问题和已有材料；探索阶段不要求提前写死结论。
2. 队长用 `sci_blueprint_set` 建立核心贡献，用 `sci_result_add` 建立 3–6 个叙事单元，再用 `sci_claim_add` 拆成可独立核验的 Claim。
3. 用户通过审批卡确认核心与 Result 当前修订后，队长才可进入 `execute` 并派发任务；共享质控或公共方法可以同时绑定多个 Result。
4. 实际证据用 `sci_evidence_add` 记录来源定位、方向、条件、不确定性、允许解释和禁止外推；支持、反驳和不确定结果都保留。
5. 每个 Result 明确选择图、表、正文、补充材料或不展示；只有选择图时才进入 `sci_figure_plan → sci_figure_register → sci_figure_audit → 研究者人工终审`。
6. 在驾驶舱查看科学、文稿、投稿三类就绪状态；使用 `/sci-review` 审查，解析失败会自动重试一次，仍失败则按失败关闭处理。

## 科研图件质量边界

图件前检会检查目标期刊尺寸、有效分辨率、文件格式、矢量文字、绘图代码、源数据、统计说明和模板许可。登记后的文件若发生变化，旧前检结论会失效，必须重新登记为新版本。

自动前检只能验证插件可观察到的属性。科学正确性、图像完整性、最终尺寸下的可读性和期刊是否接收，仍需研究者与目标期刊确认。

Scientific Figure Library 以独立可选插件提供，不会混入角色技能目录，也不会自动执行第三方模板代码。选型依据见[科研绘图开源方案调研](docs/research/2026-11-12-科研绘图开源方案调研.md)和[学术绘图技能评估](docs/research/2026-11-12-academic-figure-skill-评估.md)。

## 配置

可选配置文件为 `$DSH_HOME/dsh-science/config.json`。修改后立即生效，无需重启。

```json
{
  "falsificationThreshold": 2,
  "blockedGate": "warn"
}
```

| 配置项 | 默认值 | 含义 |
|---|---:|---|
| `falsificationThreshold` | `2` | 当支持性结果为 0 时，触发证伪风险警告所需的负面结果数量；必须是正整数 |
| `blockedGate` | `"warn"` | 任务依赖闸门；`warn` 表示允许派发但报告未完成依赖，`hard` 表示依赖完成前拒绝派发 |

配置文件缺失或损坏时，插件使用默认值继续运行。

## 安全设计

- 数据库查询默认只读，写操作需要审批。
- SSH 密码和私钥口令只通过凭据引用或环境变量读取，不写入科研工作区。
- 文件接口限制在允许的工作区内，并阻止路径穿越和凭据状态文件下发。
- 角色技能隔离指默认发现范围隔离，不等同于操作系统级文件权限隔离。

## 项目文档

- [功能规格说明](docs/SPEC.md)
- [开发日志](docs/DEVLOG.md)
- [科研团队协作示例](docs/recipes/agent-teams-science.md)

## 设计参考

- [dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（MIT）：团队协作页面模式与鲸鱼吉祥物形式
- [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)（MIT）：路由与执行角色的双层架构
- [AcademicForge](https://github.com/HughYau/AcademicForge)（MIT）：计算技能的验证阶梯与诊断表
- [K-Dense scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)（MIT）：工具档案模式
- [PaperSpine](https://github.com/WUBING2023/PaperSpine)、[ARS academic-research-skills](https://github.com/Imbad0202/academic-research-skills) 和 [nature-skills](https://github.com/Yuan1z0825/nature-skills)：论文证据组织、学术写作与科研技能设计参考。DSH 论文证据主干 v2 是本插件的自主实现，不是 PaperSpine 的分支、后续版本或运行依赖

## 许可证

本项目使用 [MIT 许可证](LICENSE)。第三方仓库、模板和技能仍受各自许可证约束；插件只在明确的许可与版本边界内提供引用或可选安装入口。
