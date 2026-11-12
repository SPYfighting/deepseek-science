# 期刊图件要求与前检边界

> 核对日期：2026-11-12。投稿前一律以目标期刊**当前** Author Guidelines 为准；插件自动前检只覆盖可观察属性，不替代科学审查或编辑接收判断。

| 配置 | 当前自动检查 | 来源与边界 |
|---|---|---|
| `nature` | 最终宽度默认 89 mm（单栏）或人工指定 183 mm（双栏）；最高 170 mm；最终尺寸文字 5–7 pt；位图最低 300 dpi；PDF/SVG 视为矢量容器 | [Nature Preparing Figures](https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/) 与 [Building and Exporting Figure Panels](https://research-figure-guide.nature.com/figures/building-and-exporting-figure-panels/)。不同图型、稿件阶段和 Nature Portfolio 期刊可能有更高或不同要求，投稿前必须重查。 |
| `generic` | 89/183 mm 作为明确的工作尺寸基线；5–8 pt；位图最低 300 dpi | 不是任何特定期刊的合规声明。用于期刊尚未配置时暴露缺项并推动人工核对。 |

PLOS 等其他期刊暂不提供自动 profile。可参考 [PLOS ONE Figures](https://journals.plos.org/plosone/s/figures)，但应在核对当前规则并补测试后再加入代码，不能仅把网页数字抄进配置。

通用规则（几乎所有期刊）：

1. 以最终物理尺寸审查；位图至少达到目标 profile 的有效 dpi，不能用修改元数据替代真实像素。
2. 数据图优先保留矢量线条和可编辑文字；Matplotlib 设置 `pdf.fonttype=42`、`svg.fonttype='none'`。
3. 色盲安全 + 灰度可辨。
4. 图注自足：n、统计检验、误差棒含义、显著性记号定义都写在图注里，不写进图内。
5. 单位用 SI；轴标签"物理量 (单位)"格式。

## 自动与人工检查的分界

`sci_figure_audit` 自动检查格式、最终尺寸、有效 dpi/矢量容器、生成代码、源数据路径、统计说明和模板许可。字号只在 SVG 可可靠读出时自动判断；PDF 字体、面板布局、裁切、颜色、标尺、数据真实性和图注一致性必须由研究者按最终尺寸人工检查，并在 `review_note` 中记录依据。
