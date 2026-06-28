"""Sinh bài giải thích và gợi ý Socratic."""

import logging
import re
import time
from typing import Any

from eduboost_agent.llm.prompt_templates import PromptTemplates
from eduboost_agent.rag.retriever import format_context_from_hits, log_retrieved_chunks_success

_HEADING_RE = re.compile(
    r"^\s*(?:\d+[\.)]\s*)?(?:\*\*)?\s*"
    r"(?:Focus clue|Guiding prompt|Socratic question|Self-check tip|Dấu hiệu|Gợi ý|Tự kiểm tra)"
    r"\s*(?:\*\*)?\s*:?\s*",
    re.IGNORECASE,
)
_LABEL_RE = re.compile(
    r"^\s*(?:[-*]\s*)?(?:\d+[\.)]\s*)?(?:\*\*)?\s*"
    r"(Focus clue|Guiding prompt|Socratic question|Self-check tip|Dấu hiệu|Gợi ý|Tự kiểm tra)"
    r"\s*(?:\*\*)?\s*:?\s*(.*)$",
    re.IGNORECASE,
)
_DISCLOSURE_RE = re.compile(
    r"\b(correct answer|correct option|đáp án đúng|câu trả lời đúng|lựa chọn đúng|phương án đúng)\b",
    re.IGNORECASE,
)
_HEADINGS = ("Dấu hiệu", "Gợi ý", "Tự kiểm tra")


def _fallback_parts() -> list[str]:
    return [
        "Em hãy tìm dấu hiệu quanh chỗ trống trước: thời gian, chủ ngữ, từ đi kèm hoặc sắc thái nghĩa của câu.",
        "Từ dấu hiệu đó, xác định câu đang cần loại từ, thì hoặc cụm diễn đạt nào. Đừng chọn vội theo cảm giác quen mắt.",
        "Thử thay từng lựa chọn vào chỗ trống và đọc lại toàn câu. Lựa chọn nào vừa đúng quy tắc vừa hợp nghĩa nhất?",
    ]


def _format_hint(parts: list[str]) -> str:
    return "\n\n".join(
        f"{heading}:\n- {part.strip()}"
        for heading, part in zip(_HEADINGS, parts)
    )


def clean_socratic_hint(raw_hint: str, has_student_answer: bool = False) -> str:
    del has_student_answer  # Giữ tham số cũ để không làm gãy nơi đang gọi.
    hint = (raw_hint or "").strip()
    if not hint:
        return _format_hint(_fallback_parts())
    hint = re.sub(r"^```(?:\w+)?\s*|\s*```$", "", hint).strip().replace("**", "")

    sections: list[list[str]] = [[], [], []]
    loose_lines: list[str] = []
    current: int | None = None
    for raw_line in hint.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = _LABEL_RE.match(line)
        if match:
            label = match.group(1).lower()
            current = 0 if label in {"focus clue", "dấu hiệu"} else 1 if label in {"guiding prompt", "gợi ý"} else 2
            content = re.sub(r"^\s*[-*]\s*", "", match.group(2).strip())
            if content:
                sections[current].append(content)
            continue
        line = _HEADING_RE.sub("", line)
        line = re.sub(r"^\s*[-*]\s*|^\s*\d+[\.)]\s*", "", line)
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            (loose_lines if current is None else sections[current]).append(line)

    if loose_lines and not any(sections):
        for index, line in enumerate(loose_lines[:3]):
            sections[index].append(line)
    elif loose_lines:
        sections[0].extend(loose_lines)

    fallback = _fallback_parts()
    normalized = [" ".join(lines).strip() or fallback[index] for index, lines in enumerate(sections)]
    cleaned = _format_hint(normalized)
    return _format_hint(fallback) if _DISCLOSURE_RE.search(cleaned) else cleaned


def format_grader_options(options: list[Any]) -> str:
    formatted: list[str] = []
    for index, option in enumerate(options):
        option_id = str(getattr(option, "id", "") or "").strip()
        option_text = str(getattr(option, "text", "") or "").strip()
        if option_text:
            formatted.append(f"- {option_id or chr(ord('A') + index)}. {option_text}")
    return "\n".join(formatted) if formatted else "- Không có danh sách lựa chọn được cung cấp."


def _load_context(runtime_state: Any, logger: logging.Logger, query: str, document_ids, scopes, label: str) -> str:
    if not runtime_state.retriever:
        return "No specific textbook context available."
    try:
        hits = runtime_state.retriever.get_context_hits(
            query,
            allowed_document_ids=document_ids,
            allowed_scopes=scopes,
        )
        log_retrieved_chunks_success(logger, label, hits, query=query)
        return format_context_from_hits(hits)
    except Exception as error:
        logger.error("%s RAG Retrieval encountered an error: %s", label, error, exc_info=True)
        return "No specific textbook context available."


async def explain(runtime_state: Any, logger: logging.Logger, topic_name: str, student_state: str, document_ids, scopes) -> dict:
    started_at = time.time()
    if not runtime_state.llm_available(runtime_state.llm_explain):
        runtime_state.raise_ai_unavailable()
    context = _load_context(runtime_state, logger, topic_name, document_ids, scopes, "[EXPLAIN][STEP 2]")
    prompt = PromptTemplates.EXPLANATION_TEMPLATE.format(
        topic=topic_name,
        context=context,
        student_state=student_state,
    )
    explanation = runtime_state.llm_explain.generate(prompt)
    if not explanation:
        runtime_state.raise_ai_unavailable()
    logger.info("[EXPLAIN] Explanation generated in %.3fs", time.time() - started_at)
    return {"explanation": explanation}


async def grade(runtime_state: Any, logger: logging.Logger, request: Any) -> dict:
    started_at = time.time()
    if not runtime_state.llm_available(runtime_state.llm_explain):
        runtime_state.raise_ai_unavailable()
    context = _load_context(
        runtime_state,
        logger,
        request.question,
        request.allowed_document_ids,
        request.allowed_scopes,
        "[GRADER-RAG][STEP 2]",
    )
    prompt = PromptTemplates.GRADER_TEMPLATE.format(
        question=request.question,
        options=format_grader_options(request.options),
        correct_answer=request.correct_answer,
        context=context,
    )
    explanation = runtime_state.llm_explain.generate(prompt)
    if not explanation:
        runtime_state.raise_ai_unavailable()
    cleaned = clean_socratic_hint(explanation)
    logger.info("[GRADER-RAG] Hint generated in %.3fs", time.time() - started_at)
    return {"explanation": cleaned}
