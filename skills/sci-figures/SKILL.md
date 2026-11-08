---
name: sci-figures
description: 出版级科研绘图规范（matplotlib/seaborn/ggplot2）。生成或修改论文图表时使用：期刊尺寸/字号/色盲安全色板/双格式导出/自检清单。绘图完成后必须调用 sci_figure_register 登记。
license: MIT
metadata:
  version: "2.0"
  design-reference: "结构借鉴 AcademicForge scientific-visualization (MIT) 的 assets/scripts/references 三件套与 nature-figure 的自查思想"
---

# 出版级科研绘图

## 何时用 / 不用于

用于：论文投稿图、多面板组合图、机制示意图的数据部分、演示用高清图。
不用于：探索性随手画（那不需要本规范）、交互式仪表盘。

## 快速开始（Python）

```python
import sys; sys.path.insert(0, '<skill目录>/scripts')
from style_presets import apply_publication_style
apply_publication_style('nature')          # 或 'generic'；见 assets/*.mplstyle

fig, ax = plt.subplots(figsize=(3.5, 2.4))  # 单栏 3.5in，双栏 7.2in
...
from figure_export import save_publication_figure
save_publication_figure(fig, 'figures/fig1', formats=['pdf', 'png'], dpi=300)
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

1. **尺寸**：单栏 8.5cm/3.35in、双栏 17.5cm/6.9in、高度 5-10cm；字号 7-8pt（缩放后可读）。
2. **导出双格式**：矢量（PDF/SVG，投稿用）+ 300dpi PNG（预览/Slides）。字体嵌入（matplotlib: `pdf.fonttype=42`）。
3. **色板**（色盲安全）：分类 Okabe-Ito（#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7）；连续 viridis/cividis；红绿不并列；灰度打印仍可辨（线型/标记点辅助区分）。
4. **元素**：轴标签带物理量单位；图例不压数据；误差棒注明含义（SD/SE/95%CI）；统计标记与检验一致；多面板 (a)(b)(c) 编号且风格统一。
5. **去装饰**：去顶右 spine、去网格或极浅网格、legend frameon=False。

## 自检清单（出图后逐项过）

- [ ] 缩放到目标尺寸后最小字号仍可读
- [ ] 黑白打印能区分所有数据系列
- [ ] 每个数字/误差棒能溯源到数据（配合 /sci-review）
- [ ] 图注所需信息齐备（n、检验、显著性定义）
- [ ] 登记完成：`sci_figure_register`（path/title/code_path/dpi）

## R 用户（ggplot2）

**先读 [references/r-figures.md](references/r-figures.md)**（R 侧完整模板：theme_classic 基线与
Python 同口径、patchwork 多面板、cairo 双格式导出、Okabe-Ito/brewer 色盲安全、字体嵌入
showtext/extrafont 与 UTF-8 Cairo 设备等 R 特有坑）。速记：theme_classic() 基线 + 同样尺寸/
字号规则；`ggsave(..., device = cairo_pdf)` + 300dpi PNG 双导出；色板用 Okabe-Ito 手动映射或
`scale_fill_brewer(palette="Dark2")`；图型选型用上方速查表，规则一致。

## 修改既有图

直接改生成代码重跑并重新登记（版本化），不要只改描述；版本历史由 `sci_figure_register` 的 sha256 追踪。

## 参考

- [references/r-figures.md](references/r-figures.md)：R（ggplot2/patchwork）出版模板与 R 特有坑
- [references/journal-requirements.md](references/journal-requirements.md)：主要期刊的图件要求速查
- [assets/](assets/)：matplotlib 样式文件
- [scripts/](scripts/)：样式与导出助手（只依赖 numpy/matplotlib；scripts/style_presets.py + scripts/figure_export.py）
