#!/usr/bin/env python3
"""Generate server feature documentation from Controllers and Repositories."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "server" / "Features"
OUT = ROOT / "docs" / "02-server" / "features"

ACTION_RE = re.compile(
    r"\[Http(Get|Post|Put|Patch|Delete)(?:\(\"([^\"]*)\"\))?\]\s*\n\s*public async Task<IActionResult>\s+(\w+)",
    re.MULTILINE,
)
ROUTE_CLASS_RE = re.compile(r'\[Route\("([^"]+)"\)\]')
METHOD_RE = re.compile(r"public async Task<[^>]+>\s+(\w+Async)\(")


def parse_controller(path: Path) -> tuple[str, list]:
    content = path.read_text(encoding="utf-8")
    route_prefix = ""
    m = ROUTE_CLASS_RE.search(content)
    if m:
        route_prefix = m.group(1)
    actions = []
    for m in ACTION_RE.finditer(content):
        verb, sub, name = m.groups()
        sub = sub or ""
        if route_prefix and not sub.startswith("api/"):
            path_str = f"{route_prefix.rstrip('/')}/{sub}".replace("//", "/") if sub else route_prefix
        else:
            path_str = sub or route_prefix
        actions.append((verb.upper(), path_str, name))
    return route_prefix, actions


def parse_repository(path: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    return METHOD_RE.findall(content)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for feature_dir in sorted(FEATURES.iterdir()):
        if not feature_dir.is_dir():
            continue
        name = feature_dir.name
        ctrl = list(feature_dir.glob("*Controller.cs"))
        repo = list(feature_dir.glob("*Repository.cs"))
        lines = [
            f"# Feature: {name}",
            "",
            f"> Thư mục: [`server/Features/{name}/`](../../../server/Features/{name}/)",
            "",
            "## Controller endpoints",
            "",
            "| Method | Path | Action |",
            "|--------|------|--------|",
        ]
        if ctrl:
            _, actions = parse_controller(ctrl[0])
            for verb, path, action in actions:
                lines.append(f"| {verb} | `{path}` | `{action}` |")
        else:
            lines.append("| — | — | — |")
        lines.extend(["", "## Repository methods", "", "| Method |", "|--------|"])
        if repo:
            for method in parse_repository(repo[0]):
                lines.append(f"| `{method}` |")
        else:
            lines.append("| — |")
        lines.extend([
            "",
            "## Known issues",
            "",
            "Xem [server-gaps.md](../../99-known-issues/server-gaps.md).",
            "",
            "## Liên kết",
            "",
            f"- [flows](../../04-integration/flows/)",
            f"- [api-reference](../../04-integration/api-reference.md)",
            "",
        ])
        (OUT / f"{name.lower()}.md").write_text("\n".join(lines), encoding="utf-8")
        print(f"Wrote {name}")

if __name__ == "__main__":
    main()
