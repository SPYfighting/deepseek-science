"""Publication style presets for dsh-science figures.

Usage:
    from style_presets import apply_publication_style
    apply_publication_style('nature')       # or 'generic'

Only depends on matplotlib. Values follow common journal author guidelines;
verify against the target journal's current instructions before submission.
"""


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
        "savefig.bbox": "tight",
        "savefig.dpi": 300,
        "figure.constrained_layout.use": True,
        "axes.prop_cycle": "cycler('color', ["
        "'#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442', '#000000'])",
    }
    if kind == "nature":
        base.update({"figure.figsize": (3.5, 2.4)})  # single column ~89mm
    elif kind == "generic":
        base.update({"figure.figsize": (3.5, 2.6)})
    return base


def apply_publication_style(kind: str = "generic") -> None:
    import matplotlib as mpl

    mpl.rcParams.update(_preset(kind))


def okabe_ito() -> "list[str]":
    return [
        "#E69F00", "#56B4E9", "#009E73", "#F0E442",
        "#0072B2", "#D55E00", "#CC79A7", "#000000",
    ]
