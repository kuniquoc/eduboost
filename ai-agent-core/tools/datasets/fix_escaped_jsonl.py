"""
Script tạm: Sửa file JSONL có responses dạng escaped string (chứa \\n, \\")
thành JSON object thuần trên mỗi dòng, đồng nhất với các file khác.

Dùng:
  python scripts/fix_escaped_jsonl.py <file.jsonl>

File gốc sẽ được backup thành .bak trước khi ghi đè.
"""
import json
import sys
import shutil
from pathlib import Path


def fix_escaped_jsonl(file_path):
    path = Path(file_path)
    if not path.exists():
        print(f"❌ File không tồn tại: {path}")
        return

    lines = path.read_text(encoding="utf-8").splitlines()
    fixed = []
    fixed_count = 0

    for i, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue

        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            print(f"⚠️  Dòng {i}: không parse được, giữ nguyên")
            fixed.append(line)
            continue

        # Nếu parsed là string (escaped JSON) → parse lần nữa
        if isinstance(parsed, str):
            try:
                obj = json.loads(parsed)
                fixed.append(json.dumps(obj, ensure_ascii=False))
                fixed_count += 1
            except json.JSONDecodeError:
                # Không phải JSON string, giữ nguyên dạng string
                fixed.append(json.dumps(parsed, ensure_ascii=False))
        else:
            # Đã là object rồi, compact lại
            fixed.append(json.dumps(parsed, ensure_ascii=False))

    # Backup
    backup = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, backup)
    print(f"📁 Backup: {backup.name}")

    # Ghi đè
    path.write_text("\n".join(fixed) + "\n", encoding="utf-8")
    print(f"✅ Fixed {fixed_count}/{len(fixed)} dòng → {path.name}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/fix_escaped_jsonl.py <file.jsonl>")
        sys.exit(1)

    for f in sys.argv[1:]:
        fix_escaped_jsonl(f)
