#!/usr/bin/env python3
"""dsh-science sci-slides — 科研汇报 PPT 最小模板脚本（python-pptx）。

骨架函数（封面/背景与缺口/方法概览/每 result 一页/结论与展望/Q&A 备份页），
版面纪律落在常量与断言里：16:9、Results 页图占右 55% 版面、要点 ≤5 条/页
（超限抛错，不静默截断）、层级字号、红灰学术配色、来源角标可溯源。

用法（CLI，会话工作区内跑）:
    python make_deck.py --out slides/demo_deck.pptx --spec spec.json
    python make_deck.py --out slides/deck.pptx --title "..." --claim "..." \
        --figure figures/fig1.png --figure figures/fig2.png   # 无 spec 时的极简路径

spec.json 见 SKILL.md（字段全部可缺省）。也可以 import 本文件逐页拼装：
    from make_deck import new_deck, add_cover, add_result, ...
依赖: pip install python-pptx（缺依赖时报错并给安装提示，不静默换库）。
字体: python-pptx 无法直接嵌入字体——本脚本统一 Arial（拉丁）+ 微软雅黑（东亚），
保证 Windows/LibreOffice 兼容；需要真嵌入时用 PowerPoint 另存（嵌入字体）。

方法论出处见 SKILL.md 头注（PPTAgent / academic-ppt-skill / open-kimi-ppt，机制吸收、原创实现）。
"""

import argparse
import json
import os
import sys

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt, Emu
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
except ImportError:
    sys.stderr.write("缺少依赖 python-pptx：请先运行 pip install python-pptx\n")
    sys.exit(2)

# ---- 版面常量（母版复用：所有页共用同一套坐标/字号/色板，不要逐页手调） ----
SLIDE_W_IN, SLIDE_H_IN = 13.333, 7.5           # 16:9
MARGIN_IN = 0.6                                 # 四周外边距
PIC_RATIO = 0.55                                # Results 页图区宽度占比（≥50% 纪律）
MAX_BULLETS = 5                                 # 每页要点上限（超限抛错）
MAX_BODY_CHARS = 40                             # 每页正文字数上限（导读句）

INK = RGBColor(0x2C, 0x3E, 0x50)                # 深灰（正文/标题）
ACCENT = RGBColor(0xC0, 0x39, 0x2B)             # 学术红（强调/角标）
MUTED = RGBColor(0x7F, 0x8C, 0x8D)              # 中灰（图注/来源）
LINE = RGBColor(0xBD, 0xC3, 0xC7)               # 边框灰
FILL = RGBColor(0xFD, 0xED, 0xEC)               # 浅红填充（主张框）
FONT_LATIN, FONT_EA = "Arial", "微软雅黑"

TITLE_PT, BODY_PT, NOTE_PT = 30, 19, 13         # 层级字号：页标题/要点/图注


def _set_font(run, size, bold=False, color=INK):
    """统一设置拉丁 + 东亚字体（python-pptx 的 font.name 只管拉丁，东亚要写 rPr.ea）。"""
    f = run.font
    f.name = FONT_LATIN
    f.size = Pt(size)
    f.bold = bold
    f.color.rgb = color
    try:
        rPr = run._r.get_or_add_rPr()
        ea = rPr.find("{http://schemas.openxmlformats.org/drawingml/2006/main}ea")
        if ea is None:
            ea = rPr.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}ea", {})
            rPr.append(ea)
        ea.set("typeface", FONT_EA)
    except Exception:
        pass


def _check_bullets(items, where):
    if len(items) > MAX_BULLETS:
        raise ValueError(f"{where} 要点 {len(items)} 条 > 上限 {MAX_BULLETS}：拆页或挪备份页（密度纪律）")
    return list(items)


def _textbox(slide, left, top, width, height):
    box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = True
    return tf


def _title(slide, text, color=INK):
    """页标题（结论句）+ 标题下强调短线，全页共用坐标。"""
    tf = _textbox(slide, MARGIN_IN, 0.35, SLIDE_W_IN - 2 * MARGIN_IN, 0.9)
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = text
    _set_font(run, TITLE_PT, bold=True, color=color)
    bar = slide.shapes.add_shape(1, Inches(MARGIN_IN), Inches(1.28), Inches(1.6), Pt(3))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background()


def _source_tag(slide, text):
    """右下角来源角标（res-N / fig-*），可溯源。"""
    if not text:
        return
    tf = _textbox(slide, SLIDE_W_IN - MARGIN_IN - 3.2, SLIDE_H_IN - 0.5, 3.2, 0.35)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    run = p.add_run()
    run.text = str(text)
    _set_font(run, NOTE_PT, color=MUTED)


def _bullets(slide, items, left, top, width, height, size=BODY_PT):
    items = _check_bullets(items, "本页")
    tf = _textbox(slide, left, top, width, height)
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        run = p.add_run()
        run.text = f"• {item}"
        _set_font(run, size)
        p.space_after = Pt(10)
    return tf


def _picture_zone(slide, paths, left, top, width, height):
    """图区：等比缩放居中放登记图（多图纵向均分）；无图放占位框标注登记图路径——绝不拿装饰图冒充。"""
    n = max(len(paths), 1)
    cell_h = height / n
    for i in range(n):
        cell_top = top + i * cell_h
        path = paths[i] if i < len(paths) else None
        if path and os.path.exists(path):
            ratio = 4 / 3  # 缺 Pillow 或读图失败时按 4:3 兜底
            try:
                from PIL import Image
                with Image.open(path) as im:
                    w, h = im.size
                if h:
                    ratio = w / h
            except Exception:
                pass
            draw_w, draw_h = width, width / ratio
            if draw_h > cell_h:
                draw_h, draw_w = cell_h, cell_h * ratio
            slide.shapes.add_picture(
                path,
                Inches(left + (width - draw_w) / 2),
                Inches(cell_top + (cell_h - draw_h) / 2),
                Inches(draw_w),
                Inches(draw_h),
            )
        else:
            ph = slide.shapes.add_shape(1, Inches(left + 0.2), Inches(cell_top + 0.2),
                                        Inches(width - 0.4), Inches(cell_h - 0.4))
            ph.fill.solid()
            ph.fill.fore_color.rgb = RGBColor(0xEC, 0xF0, 0xF1)
            ph.line.color.rgb = LINE
            tf = ph.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            run = p.add_run()
            run.text = "图位：登记图表路径\n（sci_figure_list 取图，≥50% 版面）" + (f"\n待嵌入：{path}" if path else "")
            _set_font(run, NOTE_PT, color=MUTED)


def new_deck():
    """16:9 空白演示文稿（页面一律用空白版式自绘，母版坐标由本模块常量统一）。"""
    prs = Presentation()
    prs.slide_width = Inches(SLIDE_W_IN)
    prs.slide_height = Inches(SLIDE_H_IN)
    return prs


def _blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def add_cover(prs, title, subtitle="", authors="", date=""):
    """封面：标题/副标题（场合或期刊）/作者/日期。缺省内容用占位符并注明。"""
    s = _blank(prs)
    tf = _textbox(s, 1.2, 2.3, SLIDE_W_IN - 2.4, 2.0)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = title or "（标题占位：blueprint.core.title）"
    _set_font(run, 40, bold=True, color=INK)
    tf2 = _textbox(s, 1.2, 4.3, SLIDE_W_IN - 2.4, 1.6)
    for i, line in enumerate(x for x in (subtitle, authors, date) if x):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        run = p.add_run()
        run.text = line
        _set_font(run, 18, color=MUTED if i else ACCENT)
    return s


def add_background(prs, gap_points, claim=""):
    """背景与缺口（1-2 页之一）：要点 ≤5 + 底部主张框（claim 口语版）。"""
    s = _blank(prs)
    _title(s, "背景与缺口")
    _bullets(s, gap_points, MARGIN_IN, 1.6, SLIDE_W_IN - 2 * MARGIN_IN, 3.4)
    if claim:
        body_len = sum(len(x) for x in gap_points)
        if body_len > MAX_BODY_CHARS:
            raise ValueError(f"背景页正文 {body_len} 字 > 上限 {MAX_BODY_CHARS}：精简或拆页")
        box = s.shapes.add_shape(1, Inches(MARGIN_IN), Inches(5.6), SLIDE_W_IN - 2 * MARGIN_IN, Inches(1.1))
        box.fill.solid()
        box.fill.fore_color.rgb = FILL
        box.line.color.rgb = ACCENT
        tf = box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        run = p.add_run()
        run.text = f"本工作主张：{claim}"
        _set_font(run, 20, bold=True, color=ACCENT)
    return s


def add_method(prs, one_liner, steps=()):
    """方法概览（1 页）：一句话路线 + 步骤要点（参数表进备份页，不进这里）。"""
    s = _blank(prs)
    _title(s, "方法概览")
    tf = _textbox(s, MARGIN_IN, 1.7, SLIDE_W_IN - 2 * MARGIN_IN, 1.4)
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = one_liner or "（一句话说清路线：数据/系统/怎么做的）"
    _set_font(run, 22, bold=True, color=INK)
    _bullets(s, list(steps), MARGIN_IN, 3.3, SLIDE_W_IN - 2 * MARGIN_IN, 3.0)
    return s


def add_result(prs, title, bullets=(), figures=(), source=""):
    """Results 页：结论句作页标题；图区占右侧 55% 宽（≥50% 纪律）；文字只给导读。"""
    s = _blank(prs)
    _title(s, title or "（结论式页标题：res-N 的 claim 改陈述句）")
    text_w = (SLIDE_W_IN - 2 * MARGIN_IN) * (1 - PIC_RATIO) - 0.3
    pic_left = MARGIN_IN + text_w + 0.3
    pic_w = (SLIDE_W_IN - 2 * MARGIN_IN) * PIC_RATIO
    _bullets(s, bullets, MARGIN_IN, 1.8, text_w, 4.6)
    body_chars = sum(len(x) for x in bullets)
    if body_chars > MAX_BODY_CHARS:
        raise ValueError(f"Results 页正文 {body_chars} 字 > 上限 {MAX_BODY_CHARS}：文字只写图说明什么")
    _picture_zone(s, list(figures), pic_left, 1.6, pic_w, SLIDE_H_IN - 2.4)
    _source_tag(s, source)
    return s


def add_conclusion(prs, takeaways, outlook=""):
    """结论与展望（1 页）：≤3 条结论 + 下一步。"""
    s = _blank(prs)
    _title(s, "结论与展望")
    _bullets(s, _check_bullets(takeaways[:3], "结论页"), MARGIN_IN, 1.8, SLIDE_W_IN - 2 * MARGIN_IN, 3.2, size=22)
    if outlook:
        tf = _textbox(s, MARGIN_IN, 5.4, SLIDE_W_IN - 2 * MARGIN_IN, 1.0)
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = f"下一步：{outlook}"
        _set_font(run, 18, color=ACCENT)
    return s


def add_backup(prs, title="统计细节（Q&A 备份）", rows=()):
    """备份页：统计细节/参数表（Q&A 弹药），表格逐格写不截图。"""
    s = _blank(prs)
    _title(s, title, color=ACCENT)
    rows = [list(map(str, r)) for r in rows]
    if rows:
        n_r, n_c = len(rows), max(len(r) for r in rows)
        tbl = s.shapes.add_table(n_r, n_c, Inches(MARGIN_IN), Inches(1.8),
                                 SLIDE_W_IN - 2 * MARGIN_IN, Inches(min(0.5 * n_r, 4.8))).table
        for i, row in enumerate(rows):
            for j in range(n_c):
                cell = tbl.cell(i, j)
                cell.text = row[j] if j < len(row) else ""
                for p in cell.text_frame.paragraphs:
                    for run in p.runs:
                        _set_font(run, 14, bold=(i == 0))
    else:
        _bullets(s, ["（无备份内容：统计细节/参数表/数据来源按需补）"], MARGIN_IN, 1.8,
                 SLIDE_W_IN - 2 * MARGIN_IN, 3.0)
    return s


def build_deck(spec):
    """按 spec（蓝图驱动的页面规划）拼装整副汇报。段→页模板见 SKILL.md。"""
    prs = new_deck()
    cover = spec.get("cover") or {}
    add_cover(prs, cover.get("title", ""), cover.get("subtitle", ""),
              cover.get("authors", ""), cover.get("date", ""))
    bg = spec.get("background") or {}
    add_background(prs, bg.get("gap_points") or [], bg.get("claim", ""))
    meth = spec.get("method") or {}
    add_method(prs, meth.get("one_liner", ""), meth.get("steps") or [])
    for r in spec.get("results") or []:
        add_result(prs, r.get("title", ""), r.get("bullets") or [],
                   r.get("figures") or [], r.get("source", ""))
    concl = spec.get("conclusion") or {}
    add_conclusion(prs, concl.get("takeaways") or [], concl.get("outlook", ""))
    backup = spec.get("backup") or {}
    add_backup(prs, backup.get("title", "统计细节（Q&A 备份）"), backup.get("rows") or [])
    return prs


def main(argv=None):
    ap = argparse.ArgumentParser(description="科研汇报 PPT 最小模板（python-pptx，蓝图驱动）")
    ap.add_argument("--out", required=True, help="输出 pptx 路径（建议 slides/ 目录）")
    ap.add_argument("--spec", help="页面规划 JSON 文件（字段见 SKILL.md；全部可缺省）")
    ap.add_argument("--title", help="封面标题（无 spec 时的极简路径）")
    ap.add_argument("--claim", help="核心主张（无 spec 时进背景页主张框）")
    ap.add_argument("--figure", action="append", default=[], help="登记图路径（可重复，进第 1 个 Results 页）")
    args = ap.parse_args(argv)

    if args.spec:
        with open(args.spec, "r", encoding="utf-8") as f:
            spec = json.load(f)
    else:
        spec = {
            "cover": {"title": args.title or ""},
            "background": {"gap_points": [], "claim": args.claim or ""},
            "method": {"one_liner": ""},
            "results": [{"title": "", "bullets": [], "figures": args.figure, "source": ""}] if args.figure else [],
        }
    prs = build_deck(spec)
    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    prs.save(args.out)
    # 自检：重新打开核对页数
    n = len(Presentation(args.out).slides._sldIdLst)
    print(f"OK: {args.out}（{n} 页）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
