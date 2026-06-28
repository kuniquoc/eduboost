#!/usr/bin/env python3
"""Extract web service methods and generate markdown docs."""
import re
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_SRC = ROOT / "web" / "src"
OUT_DIR = ROOT / "docs" / "01-web" / "services"

METHOD_RE = re.compile(
    r"^\s{2}(\w+):\s*async\s*\([^)]*\)(?:\s*:\s*Promise<[^>]+>)?\s*=>\s*\{?",
    re.MULTILINE,
)
ENDPOINT_RE = re.compile(r"apiClient\.(get|post|put|patch|delete)<[^>]*>\(['\"`]([^'\"`]+)")


def extract_methods(content: str) -> list[tuple[str, str]]:
    methods = []
    for m in METHOD_RE.finditer(content):
        name = m.group(1)
        # find endpoint near method
        start = m.start()
        chunk = content[start : start + 500]
        ep = ENDPOINT_RE.search(chunk)
        endpoint = ep.group(2) if ep else "—"
        methods.append((name, endpoint))
    return methods


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    service_files = sorted((WEB_SRC / "features").glob("*/api/*.service.ts"))
    for f in service_files:
        content = f.read_text(encoding="utf-8")
        methods = extract_methods(content)
        name = f.stem
        lines = [
            f"# Module: {name}",
            "",
            f"> File nguồn: [`{f.relative_to(ROOT).as_posix()}`](../../../{f.relative_to(ROOT).as_posix()})",
            "",
            "## Vai trò",
            f"API client wrapper cho `{name.replace('.service', '')}` endpoints.",
            "",
            "## Hàm",
            "",
            "| Hàm | Endpoint | Trạng thái |",
            "|-----|----------|------------|",
        ]
        for method, endpoint in methods:
            status = "✅"
            if name == "learningPath.service" and method in ("getMyPath", "regenerate", "markComplete"):
                status = "🔧 Không có UI consumer"
            lines.append(f"| `{method}` | `{endpoint}` | {status} |")
        if not methods:
            lines.append("| — | — | — |")
        lines.extend(["", "## Known issues", "", "Xem [web-gaps.md](../../99-known-issues/web-gaps.md).", ""])
        (OUT_DIR / f"{name}.md").write_text("\n".join(lines), encoding="utf-8")
        print(f"Wrote {name}.md ({len(methods)} methods)")


if __name__ == "__main__":
    main()
