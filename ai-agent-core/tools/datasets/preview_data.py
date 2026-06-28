"""
Preview raw dataset: đọc vài record đầu từ mỗi file trong data/raw/
để kiểm tra schema và nội dung trước khi xử lý.

Usage:
    python scripts/preview_data.py
"""

import json
from pathlib import Path

from data_utils import RAW_DIR, load_json_file

PREVIEW_COUNT = 3  # Số record hiển thị mẫu


def preview_files(folder: Path, label: str):
    files = sorted(folder.glob("*.jsonl"))
    if not files:
        print(f"  [!] Không tìm thấy file nào trong {folder}")
        return

    print(f"\n{'='*70}")
    print(f"  {label}: {len(files)} files")
    print(f"{'='*70}")

    for f in files:
        data = load_json_file(f)

        total = len(data)
        sample = data[:PREVIEW_COUNT]

        # Lấy field names từ record đầu tiên
        fields = list(sample[0].keys()) if sample else []

        print(f"\n--- {f.name} ({total} records) ---")
        print(f"  Fields: {fields}")

        for i, record in enumerate(sample):
            print(f"\n  Record #{i+1}:")
            for key, val in record.items():
                val_str = json.dumps(val, ensure_ascii=False)
                if len(val_str) > 120:
                    val_str = val_str[:120] + "..."
                print(f"    {key}: {val_str}")


def main():
    print("=" * 70)
    print("  DATASET PREVIEW — Đọc vài record đầu từ data/raw/")
    print("=" * 70)

    quiz_dir = RAW_DIR / "quiz"
    explanation_dir = RAW_DIR / "explanation"

    preview_files(quiz_dir, "QUIZ")
    preview_files(explanation_dir, "EXPLANATION")


if __name__ == "__main__":
    main()
