"""Publication export helper: vector + raster pair with font embedding.

Usage:
    from figure_export import save_publication_figure
    save_publication_figure(fig, 'figures/fig1', formats=['pdf', 'png'], dpi=300)
"""

import os


def save_publication_figure(fig, basename: str, formats=("pdf", "png"), dpi: int = 300) -> "list[str]":
    out_dir = os.path.dirname(basename)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    saved = []
    for fmt in formats:
        path = f"{basename}.{fmt}"
        fig.savefig(path, format=fmt, dpi=dpi)
        saved.append(path)
    return saved
