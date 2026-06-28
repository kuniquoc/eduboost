#!/usr/bin/env python3
"""Generate ai-agent-core documentation from Python source."""
import re
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "ai-agent-core" / "src" / "eduboost_agent"
OUT_API = ROOT / "docs" / "03-ai-agent-core" / "api"
OUT_CORE = ROOT / "docs" / "03-ai-agent-core" / "core"
OUT_RAG = ROOT / "docs" / "03-ai-agent-core" / "rag"
OUT_ADAPTERS = ROOT / "docs" / "03-ai-agent-core" / "adapters"

ENDPOINT_RE = re.compile(
    r'@app\.(get|post|put|delete|patch)\("([^"]+)"\)\s*\n(?:async )?def (\w+)',
    re.MULTILINE,
)


def doc_module(path: Path, out_dir: Path, title: str):
    out_dir.mkdir(parents=True, exist_ok=True)
    content = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return
    rows = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            rows.append(("class", node.name, ", ".join(methods[:8]) + ("..." if len(methods) > 8 else "")))
        elif isinstance(node, ast.FunctionDef) and node.col_offset == 0:
            args = [a.arg for a in node.args.args if a.arg != "self"]
            rows.append(("def", node.name, f"({', '.join(args)})"))
    lines = [
        f"# Module: {path.name}",
        "",
        f"> File: [`ai-agent-core/src/{path.relative_to(SRC.parent).as_posix()}`](../../../ai-agent-core/src/{path.relative_to(SRC.parent).as_posix()})",
        "",
        f"## {title}",
        "",
        "| Kind | Name | Signature / Methods |",
        "|------|------|---------------------|",
    ]
    for kind, name, sig in rows:
        lines.append(f"| `{kind}` | `{name}` | {sig} |")
    if not rows:
        lines.append("| — | — | — |")
    lines.extend(["", "## Known issues", "", "Xem [agent-gaps.md](../../99-known-issues/agent-gaps.md).", ""])
    (out_dir / f"{path.stem}.md").write_text("\n".join(lines), encoding="utf-8")


def doc_main_py():
    path = SRC / "api" / "main.py"
    content = path.read_text(encoding="utf-8")
    lines = [
        "# API Endpoints (main.py)",
        "",
        "> File: [`ai-agent-core/src/eduboost_agent/api/main.py`](../../../ai-agent-core/src/eduboost_agent/api/main.py)",
        "",
        "## Endpoints",
        "",
        "| Method | Path | Handler | .NET gọi? |",
        "|--------|------|---------|-----------|",
    ]
    dotnet_map = {
        "health": "—",
        "ingest_document": "✅ IngestDocumentAsync",
        "delete_document": "✅ DeleteDocumentAsync",
        "retrieve_context": "❌ Không",
        "get_next_action": "✅",
        "update_student_state": "✅",
        "generate_quiz_question": "✅",
        "explain_topic": "✅",
        "grade_answer": "✅",
        "generate_quiz_batch": "✅",
        "chat": "✅ AskAsync",
        "update_spaced_repetition": "❌ Orphan",
        "start_entry_test": "❌ Orphan",
        "entry_test_next_question": "❌ Orphan",
        "evaluate_entry_test": "❌ Orphan",
    }
    for m in ENDPOINT_RE.finditer(content):
        verb, route, handler = m.groups()
        dotnet = dotnet_map.get(handler, "—")
        lines.append(f"| {verb.upper()} | `{route}` | `{handler}` | {dotnet} |")
    lines.extend(["", "## Pydantic models", "", "`IngestRequest`, `DeleteRequest`, `RetrieveRequest`, `UpdateStateRequest`, `GenerateQuizRequest`, `ExplainRequest`, `GraderRequest`, `GenerateQuizBatchRequest`, `ChatRequest`, `SpacedRepetitionUpdateRequest`, `EntryTestAnswerRequest`", "", "## Parser helpers", "", "Chi tiết: [quiz-parsers.md](quiz-parsers.md)", ""])
    OUT_API.mkdir(parents=True, exist_ok=True)
    (OUT_API / "endpoints.md").write_text("\n".join(lines), encoding="utf-8")

    parser_funcs = re.findall(r"^def (_?\w+)\(", content, re.MULTILINE)
    plines = [
        "# Quiz Parsers & Helpers (main.py)",
        "",
        "## Hàm",
        "",
        "| Hàm | Mô tả |",
        "|-----|-------|",
        ("| `_parse_is_correct` | Parse isCorrect bool/int/str |"),
        ("| `_normalize_question_text` | Dedup key alphanumeric |"),
        ("| `_normalize_answer_text` | Option text compare |"),
        ("| `_resolve_correct_letter` | Map letter/text → A-D |"),
        ("| `_parse_single_question` | Validate one MCQ |"),
        ("| `_split_context_blob` | Rotate RAG context per question |"),
        ("| `_load_quiz_context_from_rag` | FAISS by document_id |"),
        ("| `_load_quiz_context_from_doc_url` | Download + rank chunks |"),
        ("| `_seed_seen_from_existing` | Dedup from prior questions |"),
        ("| `_is_duplicate_question` | Duplicate check |"),
    ]
    (OUT_API / "quiz-parsers.md").write_text("\n".join(plines), encoding="utf-8")


def main():
    doc_main_py()
    for p in (SRC / "learning").glob("*.py"):
        doc_module(p, OUT_CORE, "Core algorithms")
    for p in (SRC / "rag").glob("*.py"):
        if p.name == "test_pipeline.py":
            continue
        doc_module(p, OUT_RAG, "RAG stack")
    for p in (SRC / "llm").glob("*.py"):
        doc_module(p, OUT_ADAPTERS, "LLM adapters")
    print("Agent docs generated")

if __name__ == "__main__":
    main()
