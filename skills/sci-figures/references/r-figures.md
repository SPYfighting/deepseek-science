# R 出版级绘图实战（ggplot2 / patchwork）

Python 侧规范（尺寸/字号/色板/导出）在 SKILL.md「硬规范」一节，R 侧口径完全一致——本参考只给
ggplot2 的落地模板与 R 特有的坑。结构参考 AcademicForge scientific-visualization（MIT）的
references 思想（setup → 模板 → 导出 → 自检），并与本技能 scripts/figure_export.py 的双格式
导出语义对齐。

## 1. 一次性会话配置（与 Python side 的 style_presets 等价）

```r
library(ggplot2)

# 期刊基线：单栏 8.5cm/3.35in、双栏 17.5cm/6.9in；字号 7-8pt（缩放后可读）
base_size <- 8
theme_set(
  theme_classic(base_size = base_size, base_family = "sans") +
  theme(
    axis.line  = element_line(linewidth = 0.4),   # ggplot2 >= 3.4 用 linewidth，旧版写 size
    axis.ticks = element_line(linewidth = 0.4),
    axis.text  = element_text(size = base_size - 1),
    axis.title = element_text(size = base_size),
    legend.title = element_text(size = base_size - 1),
    legend.text  = element_text(size = base_size - 1),
    plot.title   = element_text(size = base_size, face = "plain"),
    legend.position = "top",
    legend.frame  = element_blank(),              # 对应 Python 侧 legend frameon=False
  )
)

# Okabe-Ito 色盲安全手动映射（与 SKILL.md 硬规范第 3 条同一色板）
okabe_ito <- c("#E69F00", "#56B4E9", "#009E73", "#F0E442",
               "#0072B2", "#D55E00", "#CC79A7", "#000000")
scale_fill_okabe <- function(...) scale_fill_manual(values = okabe_ito, ...)
scale_color_okabe <- function(...) scale_color_manual(values = okabe_ito, ...)
```

分类色板优先级：`scale_fill_okabe()`（自定义 Okabe-Ito）≥ `scale_fill_brewer(palette = "Dark2")`
≥ `scale_fill_viridis_d()`；连续色 `scale_fill_viridis_c(option = "viridis")`（或 "cividis"）。
红绿不并列；灰度打印可辨（线型 `linetype` + 标记点 `shape` 辅助区分）。

## 2. 单面板模板

```r
p <- ggplot(df, aes(x = group, y = value, fill = group)) +
  stat_summary(fun = mean, geom = "bar", width = 0.6, color = "black", linewidth = 0.4) +
  stat_summary(fun.data = mean_se, geom = "errorbar", width = 0.15, linewidth = 0.4) +
  scale_fill_okabe() +
  labs(x = "处理组（n = 5/组）", y = "表达量 log2(TPM+1)", fill = NULL,
       tag = "a") +          # 多面板编号 (a)(b)(c) 用 tag，风格统一
  theme(legend.position = "none")
```

统计标记与检验一致：比较线用 `ggsignif::geom_signif`（或 ggpubr），标注文字写清检验名与
显著性定义（如 `P.adj < 0.05, Wilcoxon`）。

## 3. 多面板组合（patchwork）

```r
library(patchwork)

fig1 <- (p1 | p2) / p3 +
  plot_annotation(tag_levels = "a") &      # 自动 (a)(b)(c)，替代手工 tag
  theme(plot.tag = element_text(size = base_size + 1, face = "bold"))
# 布局宽度不均：p1 + p2 + plot_layout(widths = c(2, 1))
# 共享图例：& theme(legend.position = "bottom") & guides(fill = "collect")
```

面板间距默认偏大，投稿版式可用 `plot_annotation(theme = theme(plot.margin = margin(2, 2, 2, 2, "pt")))`
收紧；拼接后整体导出，不要分别导出再拼（分辨率/字体不一致的风险）。

## 4. 双格式导出（矢量投稿 + 300dpi 预览，语义同 Python save_publication_figure）

```r
save_pub <- function(p, base, w_cm = 8.5, h_cm = 6, dpi = 300) {
  ggsave(paste0(base, ".pdf"), p, width = w_cm, height = h_cm, units = "cm",
         device = cairo_pdf)          # Cairo：UTF-8 中文/特殊字符不再变点
  ggsave(paste0(base, ".png"), p, width = w_cm, height = h_cm, units = "cm",
         dpi = dpi, type = "cairo")   # 预览/Slides
}
# 用法：save_pub(fig1, "figures/fig1")   # → fig1.pdf + fig1.png
```

- 矢量格式优先 PDF（`cairo_pdf`）；期刊要 SVG/EPS 时换 `svglite::ggsave` / `device = cairo_ps`。
- 尺寸单位显式 `units = "cm"`，别用默认英寸（和 Python 侧 3.35in/6.9in 口径换算易错）。
- `dpi` 只影响栅格格式；矢量图重设 dpi 无意义。

## 5. R 特有坑（出图后自检前先过一遍）

1. **字体嵌入**（PDF 最常见拒稿原因）：
   - `cairo_pdf` 设备把文本转曲线/嵌入 CFF，最省事；
   - 需要真字体内嵌时用 `extrafont::font_import()` + `loadfonts(device = "pdf")`（一次配置）；
   - 中文字符（图例/轴标题含中文）→ `showtext::showtext_auto()` + `showtext::showtext_opts(dpi = 300)`，
     并务必走 Cairo 设备导出；`windows`/默认 `pdf()` 设备对 UTF-8 中文会丢字或乱码。
2. **Cairo 设备**：Windows 下 `ggsave(..., device = cairo_pdf)` 与 `type = "cairo"`（PNG）是
   UTF-8 与半透明（alpha）安全的最短路径；Rscript 批处理里同样有效。
3. **linewidth vs size**：ggplot2 ≥ 3.4 线宽参数改名 `linewidth`，旧脚本会警告且未来失效。
4. **factor 顺序**：分组条形/箱线的类别顺序由 factor levels 决定，不要靠数据行序；
   `fct_reorder()` 按数值排序更可读。
5. **误差棒含义**：`mean_se`（SE）≠ 95%CI ≠ SD，图注必须写明（对应 SKILL.md 硬规范第 4 条）。
6. **ggpubr/ggsignif 的自动星号**：默认比较方法与多重校正未必与正文一致，显式传
   `method` / `p.adjust.method` 并在图注复述。

## 6. 自检（与 SKILL.md 清单同一份）

出图后逐项过 SKILL.md「自检清单」，R 侧额外确认：PDF 在别的机器打开字体不缺、中文不是方框、
面板编号 (a)(b)(c) 由 `tag_levels` 生成且加粗。登记：`sci_figure_register`（path/title/code_path/dpi）。
