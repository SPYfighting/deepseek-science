---
name: sci-slides
description: 科研汇报 PPT 生成规范（python-pptx，蓝图驱动）。把已有研究结果转成汇报幻灯片时使用：结构模板/页面密度纪律/16:9 版式/图表复用（优先 sci_figure_list 登记图）。生成文件放工作区 slides/ 目录。
license: MIT
metadata:
  version: "1.0"
  design-reference: "机制吸收自 PPTAgent (icip-cas, MIT) 的大纲→页面映射与成稿回检、academic-ppt-skill (dream-rec, MIT) 的学术密度纪律与红灰风格、open-kimi-ppt (jinwyp, MIT) 的页数裁决与图片相关性规则；全部原创转写"
---

# 科研汇报 PPT（蓝图驱动）

## 何时用 / 不用于

用于：组会汇报、进展汇报、结题答辩准备、论文预讲——把**已有**团队结果（蓝图 + 登记图表 + 任务回报）转成幻灯片。
不用于：编造新结果、替代论文写作（那是 sci-writing）、交互式仪表盘。

## 快速开始

```bash
# 会话工作区内跑；依赖 python-pptx（缺则 pip install python-pptx，不要静默换别的库）
python <skill目录>/scripts/make_deck.py --out slides/demo_deck.pptx --spec spec.json
```

spec.json 字段（全部可缺省，蓝图驱动——先 `sci_blueprint_overview` + `sci_figure_list` 再填）：

```json
{
  "cover": { "title": "文章标题", "subtitle": "目标期刊/场合", "authors": "作者", "date": "2026-11-08" },
  "background": { "gap_points": ["已知…", "但…"], "claim": "核心主张口语版" },
  "method": { "one_liner": "一句话路线", "steps": ["数据", "系统", "验证"] },
  "results": [
    { "title": "结论式页标题", "bullets": ["图说明什么"], "figures": ["figures/fig1.png"], "source": "res-1 / fig-demo" }
  ],
  "conclusion": { "takeaways": ["…"], "outlook": "下一步" },
  "backup": { "title": "统计细节", "rows": [["n", "12"], ["检验", "Welch t"]] }
}
```

也可以 `import make_deck` 直接调 `new_deck()/add_cover()/add_result()/...` 逐页拼装（函数是骨架，页面规划按下面模板来）。

## 结构模板（从蓝图反推，不自造结构）

封面（标题/作者/日期）→ 背景与缺口 1-2 页（从 blueprint.claim 反推：领域→已知→缺口→主张）→ 方法概览 1 页（一句话路线，参数表挪备份页）→ Results 每 result 1-2 页（claim 改结论句作页标题；登记图为主文字为辅；negative 如实一页）→ 结论与展望 1 页（≤3 条）→ 备份页 1+（Q&A 弹药：统计细节/参数表/数据来源）。

页数裁决顺序：用户指定 > 蓝图 results 数决定的自然页数 > 与用户/队长商量后估计（open-kimi-ppt 机制）。

## 密度纪律（硬规则，make_deck.py 已内置强制）

1. **一页一论点**：页标题 = 该页结论句（陈述句，不是「结果一」）。
2. **要点 ≤5 条/页**（脚本超限直接报错，不是静默截断）；正文每页 ≤40 字；装不下拆页或挪备份页。
3. **图占 ≥50% 版面**：Results 页图片区固定占版面右侧 55% 宽；无图先派 figure-expert 补图登记，脚本会在图位放占位框标注「登记图路径」，**绝不拿装饰图冒充数据图**（图片必须服务页面结论）。
4. **图表复用**：优先嵌入 sci_figure_list 登记图（path 已在工作区内，直接嵌入，不重画）。
5. **风格统一**：16:9（13.333×7.5in）；层级字号（页标题 28-32 / 要点 18-20 / 图注 12-14pt）；红灰学术配色（主色 #C0392B + 深灰 #2C3E50，白底）；每页角标来源（res-N / fig-*）可溯源。

## python-pptx 要点

- **16:9**：`prs.slide_width = Inches(13.333)`、`prs.slide_height = Inches(7.5)`；页面一律用空白版式（`prs.slide_layouts[6]`）+ 自绘文本框，**母版复用**——位置/字号/色板在脚本常量里定义一次，所有页共用同一套坐标，不要每页手调。
- **字体**：python-pptx **不能直接嵌入字体**；用常见系统字体保证兼容（脚本用 Arial + 微软雅黑，拉丁与东亚字形分开设置）；需要真嵌入时用 PowerPoint「另存为→嵌入字体」或 LibreOffice 导出 PDF 兜底。
- **图片**：`add_picture` 传登记图 path；脚本按图区等比缩放居中，不拉伸变形。
- **表格（备份页）**：`shapes.add_table`；统计值逐格写，不截图。
- **校验**：生成后用 `python -c "from pptx import Presentation; print(len(Presentation('slides/x.pptx').slides._sldIdLst))"` 核对页数与规划一致。

## 自检清单（回报前逐项过）

- [ ] 页数与规划表一致；封面/背景/方法/Results/结论/备份齐全
- [ ] 每页要点 ≤5、正文 ≤40 字；页标题是结论句
- [ ] Results 页图占 ≥50% 版面；登记图路径有效（文件存在）
- [ ] 每个数字可溯源（res-N / fig-* / 任务回报）；无占位文本残留
- [ ] pptx 能重新打开、页数正确；文件在 slides/ 目录，路径已汇报队长（建议随后 sci_review_send scope=journal 模拟审稿）

## 参考

- [scripts/make_deck.py](scripts/make_deck.py)：python-pptx 最小模板脚本（封面/背景/方法/每 result 一页/结论/备份页骨架函数 + CLI）
