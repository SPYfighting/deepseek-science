# academic-figure-skill 接入评估

核对日期：2026-11-12。范围：只读核对 `TingxiYu/academic-figure-skill` 的主技能说明、适配文件、绘图/QA 脚本、许可证和 Nature 当前官方图件规范；未安装或执行第三方代码。

## 结论

建议采用“**选择性吸收方法，整包作为实验性可选技能**”的方案。它比 ScientificFigureLibrary 更接近绘图执行层：提供问题驱动的图件规划、29 类生产脚本、Python/R 拼版、源码级 QA 和统计可复现报告。其问题驱动流程、逐面板计划、统计报告、QA 覆盖测试值得吸收进 `dsh-science` 的核心图件合同；生产脚本、预览资产和 Copy-First 执行链暂不应内置。

## 可吸收、可选与不采用

| 处理 | 内容 | 判断 |
| --- | --- | --- |
| 吸收并重新实现 | 从科学问题出发、每个面板写明回答的问题、用户确认图件计划、统计与数据溯源报告、源码级反模式检查、触发与 QA 覆盖基准 | 与本项目“Result—证据—Figure”架构互补，可成为内置投稿前检的前置层。[主工作流](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/SKILL.md) |
| 实验性可选 | 29 类生产脚本、`compose.py`、Python/R 运行时、资产目录和预览图 | 覆盖面有价值，但依赖多、缺少稳定 Release 和统一依赖锁定；安装后还会复制并执行仓库脚本。[README](https://github.com/TingxiYu/academic-figure-skill#readme) |
| 不直接采用 | 按显著基因数、相关系数、PCA 组间分离等结果阈值拒绝绘图 | 这些是展示启发式，不是科学有效性判据，会压制合法阴性结果或无效假设，不能成为核心门禁。[数据门禁](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/SKILL.md) |
| 不直接采用 | R 面板先转 PNG，再由 Python `imshow` 拼版 | 会把原可编辑矢量面板栅格化，与“矢量优先”和 Nature 对可编辑图层的要求冲突。[拼版规则](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/SKILL.md)、[compose.py](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/scripts/compose.py) |

## 关键质量与集成风险

1. QA 主要检查绘图源码中的字符串、参数与导出命令。`qa_validator.py` 明确说明自动检查覆盖 Pass 0/1，而视觉逻辑和渲染结果由 LLM 执行；`check_figure.py` 只编排颜色、字号、尺寸和导出四类检查。它没有最终 PDF 的碰撞检测、面板对齐测量、逐字形字体审计或最终尺寸人工复核，因此不能独立证明“投稿级”。[qa_validator.py](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/scripts/qa_validator.py)、[check_figure.py](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/scripts/check_figure.py)
2. `SKILL.md` 的 YAML frontmatter 因描述中的未加引号冒号而被 GitHub 报解析错误；Codex `manifest.yaml` 又把入口写为 `skill.md`，与仓库实际 `SKILL.md` 大小写不一致，在大小写敏感系统上可能失效。[SKILL.md](https://github.com/TingxiYu/academic-figure-skill/blob/main/SKILL.md)、[Codex manifest](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/install/codex/manifest.yaml)
3. 中文 README 的目录说明写“MIT”，实际根 `LICENSE` 与英文 README 为 Apache-2.0。根许可证应作为当前依据，但再分发前仍应修正文档并生成第三方声明；README 还说明预览图源自私有数据资产，预览/衍生图的权利边界需要作者进一步澄清。[LICENSE](https://github.com/TingxiYu/academic-figure-skill/blob/main/LICENSE)、[英文 README](https://github.com/TingxiYu/academic-figure-skill/blob/main/README_EN.md)
4. 其“Nature/Cell/Science 通用”规则过度归一。例如它把最大高度统一写为 247 mm，而 Nature 当前研究图指南给出的主图最大高度为 170 mm；目标期刊和投稿阶段必须分别配置。[仓库规格](https://raw.githubusercontent.com/TingxiYu/academic-figure-skill/main/references/journal-specs.md)、[Nature 官方尺寸](https://research-figure-guide.nature.com/figures/building-and-exporting-figure-panels/)
5. Copy-First 流程要求复制、修改并通过 `subprocess` 执行第三方 Python/R 脚本。未发现仓库自身要求联网或上传数据，但所有脚本仍应视为待审查代码；安装、依赖变更、文件写入和网络访问应由 `dsh-science` 的权限层控制。

## 推荐接入结构

1. `dsh-science` 内置并保持权威：图件合同、目标期刊配置、统计/溯源清单、最终 PDF/SVG/TIFF 审计和人工终审状态。
2. ScientificFigureLibrary 继续承担可选的模板检索、版本、来源和许可证管理。
3. `academic-figure-skill` 进入科研绘图专家的“实验性技能”目录，默认关闭；固定到已审查提交，修复入口和许可证提示后才能安装。
4. 第三方生产脚本只能复制到项目工作目录，经静态检查与用户批准后运行；其输出必须再次通过本项目的 `sci_figure_audit`，不能沿用第三方的“READY”作为投稿结论。

因此，它值得借鉴，也值得提供可选入口，但现阶段不适合整包内置或替代我们自己的期刊图件前检。
