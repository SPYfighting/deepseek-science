"""Publication style presets for dsh-science figures.

Usage:
    from style_presets import apply_publication_style
    apply_publication_style('nature')       # or 'generic'

Only depends on matplotlib. The bundled Nature dimensions were checked against
the official figure guide on 2026-11-12; verify the current target-journal
instructions before submission.
"""

JOURNAL_DIMENSIONS_MM = {
    "generic": {"single": 89.0, "double": 183.0, "max_height": 170.0},
    "nature": {"single": 89.0, "double": 183.0, "max_height": 170.0},
}


def mm_to_inch(value_mm: float) -> float:
    """Convert an exact physical size in millimetres to inches."""
    return float(value_mm) / 25.4


def figure_size(kind: str = "generic", column: str = "single", height_mm: float = 65.0) -> "tuple[float, float]":
    """Return a Matplotlib figsize at the declared final publication size."""
    key = kind.lower()
    if key not in JOURNAL_DIMENSIONS_MM:
        raise ValueError(f"unknown preset: {kind}; choose nature or generic")
    if column not in ("single", "double"):
        raise ValueError("column must be 'single' or 'double'")
    spec = JOURNAL_DIMENSIONS_MM[key]
    if not 0 < float(height_mm) <= spec["max_height"]:
        raise ValueError(f"height_mm must be >0 and <= {spec['max_height']}")
    return mm_to_inch(spec[column]), mm_to_inch(height_mm)


def _preset(kind: str) -> dict:
    base = {
        "font.family": "sans-serif",
        "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
        "font.size": 7,
        "axes.labelsize": 8,
        "axes.titlesize": 8,
        "xtick.labelsize": 7,
        "ytick.labelsize": 7,
        "legend.fontsize": 7,
        "axes.linewidth": 0.6,
        "xtick.major.width": 0.6,
        "ytick.major.width": 0.6,
        "lines.linewidth": 1.0,
        "lines.markersize": 3.5,
        "legend.frameon": False,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "pdf.fonttype": 42,  # embed TrueType (editable text in PDF)
        "ps.fonttype": 42,
        "svg.fonttype": "none",  # preserve text elements for editing/search
        "savefig.bbox": "tight",
        "savefig.dpi": 300,
        "figure.constrained_layout.use": True,
        "axes.prop_cycle": "cycler('color', ["
        "'#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442', '#000000'])",
    }
    if kind == "nature":
        base.update({"figure.figsize": figure_size("nature", "single", 65)})
    elif kind == "generic":
        base.update({"figure.figsize": figure_size("generic", "single", 65)})
    else:
        raise ValueError(f"unknown preset: {kind}; choose nature or generic")
    return base


def apply_publication_style(kind: str = "generic") -> None:
    import matplotlib as mpl

    mpl.rcParams.update(_preset(kind))


def okabe_ito() -> "list[str]":
    return [
        "#E69F00", "#56B4E9", "#009E73", "#F0E442",
        "#0072B2", "#D55E00", "#CC79A7", "#000000",
    ]
