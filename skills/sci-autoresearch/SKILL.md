---
name: sci-autoresearch
description: 端到端自主科研流程编排。用户明确要求 autoresearch/全自动跑一个完整研究时使用：文献→假设→实验→分析→图表→报告，带强制人工检查点。
---

# Autoresearch 流程编排（设计参考 ARIS/AI-Scientist 的循环思想，含强制人工检查点）

## 总原则

- **检查点强制**：每个阶段结束必须停下等用户批准（"继续"才算通过）。全自动只存在于阶段内部。
- **产物落盘**：每阶段的产出写成工作区文件（`research/<slug>/01-literature.md` 等），报告引用文件路径。
- **成本可视**：每阶段开始前预估要跑的远程作业数量与大致耗时。

## 阶段流水线

### S1 文献综述（产出 01-literature.md）
`sci_lit_search` 多源检索 → 按"已知/争议/缺口"三栏整理 → 每条断言附 DOI（`sci_doi_verify` 核对）。
**检查点 1**：用户确认缺口判断。

### S2 假设与实验设计（产出 02-hypothesis.md）
按 sci-hypothesis 模板生成 2-3 个假设，Top 1 展开成实验设计（数据源、分析方法、预期图表清单）。
**检查点 2**：用户选定假设与设计。

### S3 数据与实验（产出 03-data.md + 执行记录）
- 本地数据：`sci_db_*`（只读优先）。
- 远端计算：`sci_job_submit`，试跑先行（sci-simulation 规则）。
- 所有中间结果落盘；失败如实记录（Partial/Failed 状态，不粉饰）。

### S4 分析与图表（产出 04-analysis.md + figures/）
按 sci-figures 规范出图并 `sci_figure_register` 登记；统计检验方法与假设一一对应。

### S5 报告（产出 05-report.md）
按 sci-writing 结构撰写；引用全部经核对。
**检查点 3**：用户终审。

### S6 终审审查
建议 `/sci-review` 对报告轮跑一次全项审查；fail 项逐条处理后再交付。

## 中断恢复

所有阶段状态写入 `research/<slug>/state.json`（stage、通过与否、关键决策）。会话中断后凭 state.json 续跑，不重做已批准阶段。
