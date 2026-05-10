"""
Shared utilities for loading raw JSON data.

Cung cấp các hàm dùng chung giữa split_dataset, dataset_stats, preview_data.
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"


def _fix_json_content(content: str) -> str:
    """Regex-based fixes cho các lỗi JSON phổ biến."""
    content = re.sub(r'\\(?!["\\bfnrtu/])', r'\\\\', content)
    content = re.sub(r'\],\s*\[', ',', content)
    content = re.sub(r',\s*,', ',', content)
    content = re.sub(r'\{\s*\{', '{', content)
    content = re.sub(r',\s*([\]\}])', r'\1', content)
    return content


def load_json_file(path: Path) -> list:
    """Load JSON file, xử lý các lỗi JSON phổ biến trong raw data."""
    with open(path, "r", encoding="utf-8") as fp:
        content = fp.read()
    content = _fix_json_content(content)
    for _ in range(10):
        try:
            return json.loads(content, strict=False)
        except json.JSONDecodeError as e:
            if 'Invalid \\escape' in str(e):
                content = content[:e.pos-1] + '\\\\' + content[e.pos:]
            elif 'Expecting property name' in str(e):
                content = content[:e.pos] + content[e.pos+1:]
            else:
                raise
    return json.loads(content, strict=False)


def extract_level_from_filename(filename: str) -> str:
    """Trích xuất level (A1, A2, B1, B2) từ tên file."""
    return filename.split("_")[0]
