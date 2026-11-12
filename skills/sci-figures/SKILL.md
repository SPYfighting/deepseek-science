---
name: sci-figures
description: 出版级科研绘图规范（matplotlib/seaborn/ggplot2）。生成或修改论文图表时使用：期刊尺寸/字号/色盲安全色板/双格式导出/自检清单。绘图完成后必须调用 sci_figure_register 登记。
license: MIT
metadata:
  version: "3.0"
  design-reference: "结构借鉴 AcademicForge scientific-visualization (MIT) 的 assets/scripts/references 三件套与 nature-figure 的自查思想"
---

# 出版级科研绘图

## 何时用 / 不用于

用于：论文投稿图、多面板组合图、机制示意图的数据部分、演示用高清图。
不用于：探索性随手画（那不需要本规范）、交互式仪表盘。

## 强制工作流

1. 绘图前调用 `sci_figure_plan`，绑定 Result，并声明该图的一句话主张、目标期刊、最终宽度、源数据、统计说明和外部模板许可。
2. 从源数据和绘图代码生成图件。外部模板只能作为可选素材；记录仓库、精确版本/commit、选择器与许可，不允许把第三方服务描述成插件内置能力。
3. 调用 `sci_figure_register plan_id=...` 登记 PDF/SVG 投稿文件及 PNG 预览，保留代码与源数据路径。
4. 调用 `sci_figure_audit figure_id=...`。先处理所有 fail/warn；自动前检通过后，研究者按最终尺寸核对面板、文字与科学完整性，再提交 `manual_decision=approved` 和具体 `review_note`。

“已人工终审”只代表完成插件内前检，不代表目标期刊保证接收。

## 快速开始（Python）

```python
import sys; sys.path.insert(0, '<skill目录>/scripts')
from style_presets import apply_publication_style, figure_size
apply_publication_style('nature')

fig, ax = plt.subplots(figsize=figure_size('nature', 'single', height_mm=65))
...
from figure_export import save_publication_figure
save_publication_figure(fig, 'figures/fig1', formats=('pdf', 'svg', 'png'), dpi=300)
```

skill 目录路径可用 `sci_figure_register` 的说明或工作区 `skills/` 下查找；找不到时按下方规范手写样式（规则一致）。

## 图型选型速查（先选对图，再谈美观）

| 意图 | 首选 | 备选 / 说明 |
| --- | --- | --- |
| 分布（1 组） | 直方图 / 密度图 | 小样本（n<30）直接展示散点，别硬拟合分布 |
| 分布（多组） | violin + 内嵌 box | box 仅给分位数；n<10 用抖动散点替代 violin |
| 关系（两变量） | scatter（+回归线及 CI） | 曲线关系先 loess 目检再定参数形式 |
| 关系（多变量） | 分面 scatter / 热图 | 分面共享轴才可比；热图必须注明聚类与否 |
| 构成 | bar / stacked bar | 饼图仅 ≤3 类且差异悬殊时用；构成比堆叠注明总量 |
| 趋势 | line（时间/有序变量） | 少量点+误差用 point + errorbar；不要连散点线 |
| 比较（组间） | bar + 误差棒 / box | 显著性标记与所用检验一致（见硬规范 4） |

决策思想同 AcademicForge scientific-visualization 的 decision tree（数据意图 → 图型 → 变量映射）；
选完型后按「硬规范」执行尺寸/色板/导出。

## 硬规范

1. **最终尺寸**：按目标期刊当前指南设置，不能只看画布像素。Nature 内置前检采用 89/183 mm 栏宽、最高 170 mm；其他期刊默认走通用配置并要求人工核对。
2. **导出**：矢量 PDF/SVG（投稿与编辑）+ 300 dpi PNG（预览）。Matplotlib 使用 `pdf.fonttype=42`、`svg.fonttype='none'` 保留可编辑文字；位图有效 dpi 按最终物理宽度计算，不能靠改 dpi 元数据“放大”。
3. **色板**（色盲安全）：分类 Okabe-Ito（#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7）；连续 viridis/cividis；红绿不并列；灰度打印仍可辨（线型/标记点辅助区分）。
4. **元素**：轴标签带物理量单位；图例不压数据；误差棒注明含义（SD/SE/95%CI）；统计标记与检验一致；多面板 (a)(b)(c) 编号且风格统一。
5. **去装饰**：去顶右 spine、去网格或极浅网格、legend frameon=False。

## 自检清单（出图后逐项过）

- [ ] 图件计划已绑定 Result，图件主张与该 Result 一致
- [ ] 缩放到最终投稿尺寸后最小字号仍可读，面板无裁切/重叠
- [ ] 黑白打印能区分所有数据系列
- [ ] 每个数字/误差棒能追溯到已登记源数据和绘图代码
- [ ] 图注所需信息齐备（n、检验、显著性定义）
- [ ] 外部模板/素材记录了来源、精确版本和许可证
- [ ] `sci_figure_register` 已登记，`sci_figure_audit` 无 fail/warn，研究者已记录人工终审依据

## R 用户（ggplot2）

**先读 [references/r-figures.md](references/r-figures.md)**（R 侧完整模板：theme_classic 基线与
Python 同口径、patchwork 多面板、cairo 双格式导出、Okabe-Ito/brewer 色盲安全、字体嵌入
showtext/extrafont 与 UTF-8 Cairo 设备等 R 特有坑）。速记：theme_classic() 基线 + 同样尺寸/
字号规则；`ggsave(..., device = cairo_pdf)` + 300dpi PNG 双导出；色板用 Okabe-Ito 手动映射或
`scale_fill_brewer(palette="Dark2")`；图型选型用上方速查表，规则一致。

## 修改既有图

直接改生成代码重跑并重新登记（版本化），不要只改描述；版本历史由 `sci_figure_register` 的 sha256 追踪。重绘后必须重新运行 `sci_figure_audit`，旧版本的人工结论不能沿用。

## 参考

- [references/r-figures.md](references/r-figures.md)：R（ggplot2/patchwork）出版模板与 R 特有坑
- [references/journal-requirements.md](references/journal-requirements.md)：主要期刊的图件要求速查
- [assets/](assets/)：matplotlib 样式文件
- [scripts/](scripts/)：样式与导出助手（只依赖 numpy/matplotlib；scripts/style_presets.py + scripts/figure_export.py）
