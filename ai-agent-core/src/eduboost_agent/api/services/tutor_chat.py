"""Hỏi đáp RAG cho màn hình chat của học sinh."""

import logging
import time
from typing import Any

from eduboost_agent.learning.config import CHAT_MAX_HISTORY, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K_DOCS
from eduboost_agent.rag.retriever import log_retrieved_chunks_success


def _retrieve_context(runtime_state: Any, logger: logging.Logger, request: Any) -> tuple[str, list[dict]]:
    if not runtime_state.retriever or not runtime_state.vector_db:
        return "", []
    try:
        query = f"{request.topic_id} {request.question}" if request.topic_id else request.question
        hits = runtime_state.vector_db.search(
            query,
            k=RAG_TOP_K_DOCS,
            return_scores=True,
            allowed_document_ids=request.allowed_document_ids,
            allowed_scopes=request.allowed_scopes,
            min_score=RAG_SIMILARITY_THRESHOLD,
        )
        log_retrieved_chunks_success(logger, "[CHAT]", hits, query=query)
        context = "\n\n".join(chunk["text"] for _score, chunk in hits)
        sources = [
            {
                "document_id": str(chunk.get("metadata", {}).get("document_id", "")),
                "file_name": chunk.get("metadata", {}).get("source_file", "unknown"),
                "snippet": chunk["text"][:200],
            }
            for _score, chunk in hits
        ]
        return context, sources
    except Exception as error:
        logger.error("[CHAT] RAG retrieval error: %s", error)
        return "", []


def _unique_sources(candidates: list[dict]) -> list[dict]:
    sources: list[dict] = []
    seen: set[str] = set()
    for source in candidates:
        document_id = str(source.get("document_id", "") or "").strip()
        file_name = str(source.get("file_name", "") or "").strip()
        key = f"doc:{document_id}" if document_id else f"file:{file_name.lower()}"
        if key not in seen:
            seen.add(key)
            sources.append(source)
    return sources


def _build_prompt(request: Any, context: str) -> str:
    recent_history = request.history[-CHAT_MAX_HISTORY:] if request.history else []
    conversation = "\n".join(
        f"{message.get('role', 'user').capitalize()}: {message.get('content', '')}"
        for message in recent_history
    )
    level_instruction = {
        "beginner": "Dùng câu ngắn, từ đơn giản, ví dụ gần gũi. Tránh thuật ngữ khó nếu không giải thích ngay.",
        "intermediate": "Giải thích rõ ràng, có ví dụ minh hoạ và thuật ngữ cơ bản khi cần.",
        "advanced": "Giải thích sâu hơn, có so sánh, lưu ý ngoại lệ hoặc lỗi dễ nhầm khi phù hợp.",
    }.get(request.level, "Giải thích rõ ràng, dùng tiếng Việt tự nhiên.")
    history_section = f"## Lịch sử hội thoại gần đây:\n{conversation}" if conversation else ""
    return f"""Bạn là gia sư AI hỗ trợ học tiếng Anh cho học sinh Việt Nam. {level_instruction}

## Tài liệu tham khảo:
{context if context else "Không có tài liệu cụ thể."}

{history_section}

## Câu hỏi của học sinh:
{request.question}

## Yêu cầu trả lời:
- Luôn trả lời bằng tiếng Việt tự nhiên, dễ đọc.
- Ưu tiên dựa trên tài liệu tham khảo. Nếu tài liệu không đủ thông tin, nói rõ "Trong tài liệu chưa thấy phần này" rồi bổ sung kiến thức chung chuẩn.
- Không viết thành một đoạn dài. Chia thành các phần ngắn theo mẫu bên dưới.
- Không dùng markdown đậm, không dùng bảng, không dùng tiêu đề tiếng Anh.
- Mỗi gạch đầu dòng chỉ nêu một ý; tránh câu quá dài.

## Định dạng mong muốn:
Tóm tắt:
- Trả lời trực tiếp câu hỏi trong 1-2 ý.

Giải thích:
- Nêu quy tắc hoặc lý do chính.
- Nếu có thuật ngữ tiếng Anh, giải thích nghĩa tiếng Việt ngay sau đó.

Ví dụ:
- Đưa 1 ví dụ tiếng Anh ngắn.
- Giải thích ví dụ bằng tiếng Việt.

Ghi nhớ:
- Chốt lại bằng 1 mẹo học hoặc lỗi cần tránh."""


async def answer(runtime_state: Any, logger: logging.Logger, request: Any) -> dict:
    started_at = time.time()
    if not runtime_state.llm_available(runtime_state.llm_chat):
        runtime_state.raise_ai_unavailable()
    context, candidates = _retrieve_context(runtime_state, logger, request)
    sources = _unique_sources(candidates)
    response = runtime_state.llm_chat.generate(_build_prompt(request, context))
    if not response:
        return {"answer": "AI server không khả dụng. Vui lòng thử lại sau.", "sources": sources}
    logger.info("[CHAT] Response generated in %.3fs", time.time() - started_at)
    return {"answer": response, "sources": sources}
