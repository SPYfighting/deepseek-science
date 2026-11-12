"""Publication export helper: editable vector files plus a raster preview.

Usage:
    from figure_export import save_publication_figure
    save_publication_figure(fig, 'figures/fig1', formats=['pdf', 'png'], dpi=300)
"""

import os

SUPPORTED_FORMATS = frozenset(("pdf", "svg", "png", "tiff"))


def save_publication_figure(
    fig,
    basename: str,
    formats=("pdf", "svg", "png"),
    dpi: int = 300,
    transparent: bool = False,
) -> "list[str]":
    """Save one immutable export set and return the exact paths written.

    ``dpi`` affects raster formats and rasterized artists inside vector files;
    it does not rescue a low-resolution source image. Matplotlib style should
    set ``pdf.fonttype=42`` and ``svg.fonttype='none'`` before figure creation.
    """
    basename = str(basename)
    if not basename or basename.endswith(os.sep):
        raise ValueError("basename must include a file stem")
    normalized = tuple(str(fmt).lower().lstrip(".") for fmt in formats)
    unknown = [fmt for fmt in normalized if fmt not in SUPPORTED_FORMATS]
    if unknown:
        raise ValueError(f"unsupported format(s): {', '.join(unknown)}")
    if not normalized:
        raise ValueError("formats must not be empty")
    if int(dpi) < 72:
        raise ValueError("dpi must be at least 72")
    out_dir = os.path.dirname(basename)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    saved = []
    for fmt in normalized:
        path = f"{basename}.{fmt}"
        fig.savefig(path, format=fmt, dpi=int(dpi), transparent=transparent)
        saved.append(path)
    return saved
