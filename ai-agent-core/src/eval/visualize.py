"""Visualization utilities for eval score comparisons."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def _require_matplotlib():
    try:
        import matplotlib.pyplot as plt  # type: ignore
    except ImportError as error:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "matplotlib is required for visualization. Install with: pip install matplotlib"
        ) from error
    return plt


def _sanitize(name: str) -> str:
    return "".join(char if char.isalnum() or char in ("_", "-") else "_" for char in name)


def _extract_series(result: dict[str, Any]) -> dict[str, Any]:
    item_scores = result["scores"]["item_scores"]
    criteria_keys = list(result["scores"]["criteria"].keys())
    per_criterion = {key: [item["criteria"][key] for item in item_scores] for key in criteria_keys}
    return {
        "label": result["label"],
        "overall": [item["overall"] for item in item_scores],
        "criteria": per_criterion,
        "mean_overall": result["scores"]["overall"],
        "mean_criteria": result["scores"]["criteria"],
    }


def _plot_distribution(
    series_a: dict[str, Any],
    series_b: dict[str, Any],
    task_type: str,
    output_path: Path,
) -> None:
    plt = _require_matplotlib()
    bins = [0.5 + i for i in range(11)]
    plt.figure(figsize=(10, 5))
    plt.hist(series_a["overall"], bins=bins, alpha=0.5, label=series_a["label"], edgecolor="black")
    plt.hist(series_b["overall"], bins=bins, alpha=0.5, label=series_b["label"], edgecolor="black")
    plt.xticks(range(1, 11))
    plt.xlabel("Overall score")
    plt.ylabel("Count")
    plt.title(f"{task_type} - Overall score distribution")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=140)
    plt.close()


def _plot_mean_comparison(
    series_a: dict[str, Any],
    series_b: dict[str, Any],
    task_type: str,
    output_path: Path,
) -> None:
    plt = _require_matplotlib()
    keys = ["overall"] + list(series_a["mean_criteria"].keys())
    means_a = [series_a["mean_overall"]] + [series_a["mean_criteria"][key] for key in keys[1:]]
    means_b = [series_b["mean_overall"]] + [series_b["mean_criteria"][key] for key in keys[1:]]

    x_positions = list(range(len(keys)))
    width = 0.38

    plt.figure(figsize=(12, 5))
    plt.bar([x - width / 2 for x in x_positions], means_a, width=width, label=series_a["label"])
    plt.bar([x + width / 2 for x in x_positions], means_b, width=width, label=series_b["label"])
    plt.xticks(x_positions, keys, rotation=20, ha="right")
    plt.ylim(0, 10)
    plt.ylabel("Mean score")
    plt.title(f"{task_type} - Mean score comparison")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=140)
    plt.close()


def generate_pair_visualizations(
    result_a: dict[str, Any],
    result_b: dict[str, Any],
    task_type: str,
    output_dir: Path,
    pair_name: str,
) -> list[str]:
    """Generate distribution and mean charts for one model pair and one task."""
    output_dir.mkdir(parents=True, exist_ok=True)

    series_a = _extract_series(result_a)
    series_b = _extract_series(result_b)
    safe_pair = _sanitize(pair_name)
    safe_task = _sanitize(task_type)

    dist_path = output_dir / f"{safe_task}_{safe_pair}_distribution.png"
    mean_path = output_dir / f"{safe_task}_{safe_pair}_mean.png"
    _plot_distribution(series_a, series_b, task_type, dist_path)
    _plot_mean_comparison(series_a, series_b, task_type, mean_path)

    return [str(dist_path), str(mean_path)]
