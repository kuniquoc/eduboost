"""
Thống kê chi tiết dataset từ data/raw/:
- Số records per file, per level
- Phân phối difficulty (quiz), phân phối topic
- Tổng hợp summary table

Usage:
    python scripts/dataset_stats.py
"""

import json
from pathlib import Path
from collections import defaultdict

from data_utils import RAW_DIR, load_json_file, extract_level_from_filename


def load_all_records(folder: Path) -> list[tuple[str, str, list]]:
    """Load tất cả records từ folder, trả về [(filename, level, records)]."""
    results = []
    for f in sorted(folder.glob("*.jsonl")):
        data = load_json_file(f)
        level = extract_level_from_filename(f.stem)
        results.append((f.name, level, data))
    return results


def quiz_stats(quiz_dir: Path) -> dict:
    """Thống kê quiz dataset."""
    files_data = load_all_records(quiz_dir)

    stats = {
        "total_files": len(files_data),
        "total_records": 0,
        "per_file": {},
        "per_level": defaultdict(int),
        "per_topic": defaultdict(int),
        "difficulty_bins": {
            "very_easy (β < -2.0)": 0,
            "easy (-2.0 ≤ β < -0.5)": 0,
            "medium (-0.5 ≤ β < 0.5)": 0,
            "hard (0.5 ≤ β < 2.0)": 0,
            "very_hard (β ≥ 2.0)": 0,
        },
        "difficulty_range": {"min": float("inf"), "max": float("-inf")},
    }

    for fname, level, records in files_data:
        count = len(records)
        stats["total_records"] += count
        stats["per_file"][fname] = count
        stats["per_level"][level] += count

        for r in records:
            topic = r.get("topic", "unknown")
            stats["per_topic"][topic] += 1

            d = r.get("difficulty", 0)
            stats["difficulty_range"]["min"] = min(stats["difficulty_range"]["min"], d)
            stats["difficulty_range"]["max"] = max(stats["difficulty_range"]["max"], d)

            if d < -2.0:
                stats["difficulty_bins"]["very_easy (β < -2.0)"] += 1
            elif d < -0.5:
                stats["difficulty_bins"]["easy (-2.0 ≤ β < -0.5)"] += 1
            elif d < 0.5:
                stats["difficulty_bins"]["medium (-0.5 ≤ β < 0.5)"] += 1
            elif d < 2.0:
                stats["difficulty_bins"]["hard (0.5 ≤ β < 2.0)"] += 1
            else:
                stats["difficulty_bins"]["very_hard (β ≥ 2.0)"] += 1

    stats["per_level"] = dict(stats["per_level"])
    stats["per_topic"] = dict(stats["per_topic"])
    return stats


def explanation_stats(explanation_dir: Path) -> dict:
    """Thống kê explanation dataset."""
    files_data = load_all_records(explanation_dir)

    stats = {
        "total_files": len(files_data),
        "total_records": 0,
        "per_file": {},
        "per_level": defaultdict(int),
        "per_topic": defaultdict(int),
    }

    for fname, level, records in files_data:
        count = len(records)
        stats["total_records"] += count
        stats["per_file"][fname] = count
        stats["per_level"][level] += count

        for r in records:
            topic = r.get("topic", "unknown")
            stats["per_topic"][topic] += 1

    stats["per_level"] = dict(stats["per_level"])
    stats["per_topic"] = dict(stats["per_topic"])
    return stats


def print_table(title: str, data: dict):
    """In bảng key-value đẹp ra console."""
    if not data:
        return
    max_key = max(len(str(k)) for k in data.keys())
    print(f"\n  {title}:")
    for k, v in sorted(data.items()):
        print(f"    {str(k):<{max_key}}  {v}")


def main():
    print("=" * 70)
    print("  DATASET STATISTICS")
    print("=" * 70)

    # --- QUIZ ---
    quiz_dir = RAW_DIR / "quiz"
    qs = quiz_stats(quiz_dir)

    print(f"\n{'='*70}")
    print(f"  QUIZ: {qs['total_files']} files, {qs['total_records']} records")
    print(f"  Difficulty range: β = [{qs['difficulty_range']['min']}, {qs['difficulty_range']['max']}]")
    print(f"{'='*70}")

    print_table("Per File", qs["per_file"])
    print_table("Per Level", qs["per_level"])
    print_table("Difficulty Bins", qs["difficulty_bins"])
    print_table("Per Topic", qs["per_topic"])

    # --- EXPLANATION ---
    explanation_dir = RAW_DIR / "explanation"
    es = explanation_stats(explanation_dir)

    print(f"\n{'='*70}")
    print(f"  EXPLANATION: {es['total_files']} files, {es['total_records']} records")
    print(f"{'='*70}")

    print_table("Per File", es["per_file"])
    print_table("Per Level", es["per_level"])
    print_table("Per Topic", es["per_topic"])

    # --- TỔNG HỢP ---
    print(f"\n{'='*70}")
    print(f"  TỔNG HỢP")
    print(f"{'='*70}")
    print(f"  Quiz:        {qs['total_records']} records ({qs['total_files']} files)")
    print(f"  Explanation:  {es['total_records']} records ({es['total_files']} files)")
    print(f"  TOTAL:        {qs['total_records'] + es['total_records']} records")


if __name__ == "__main__":
    main()
