# src/eduboost_agent/rag/retriever.py

import logging
import os
from typing import Any

from eduboost_agent.rag.vector_db import VectorDB


logger = logging.getLogger(__name__)

_PRODUCT_ENV_VALUES = {"prod", "product", "production"}
_PRODUCT_ENV_VARS = (
    "APP_ENV",
    "ENVIRONMENT",
    "PYTHON_ENV",
    "ASPNETCORE_ENVIRONMENT",
    "NODE_ENV",
)


def is_product_environment() -> bool:
    """Return True when detailed RAG chunk tracing should be emitted."""
    return any(
        (os.getenv(var) or "").strip().lower() in _PRODUCT_ENV_VALUES
        for var in _PRODUCT_ENV_VARS
    )


def chunk_preview(text: str, limit: int = 100) -> str:
    """Normalize and format the leading chunk text for production logs."""
    normalized = " ".join(str(text or "").split())
    preview = normalized[:limit]
    suffix = " ..." if len(normalized) > limit else ""
    return f"[{preview}]{suffix}"


def format_context_from_hits(hits: list[tuple[float, dict[str, Any]]]) -> str:
    """Build the legacy prompt context from scored RAG hits."""
    if not hits:
        return "No specific textbook context available for this topic."
    return "\n\n".join(
        f"Source {i + 1}: {chunk.get('text', '')}"
        for i, (_score, chunk) in enumerate(hits)
    )


def log_retrieved_chunks_success(
    log: logging.Logger,
    prefix: str,
    hits: list[tuple[float, dict[str, Any]]],
    query: str | None = None,
) -> None:
    """Log production-safe previews for chunks that will be sent to the LLM."""
    if not is_product_environment():
        return

    if query is not None:
        log.info("%s RAG query=\"%s\"", prefix, chunk_preview(query, limit=200))

    if not hits:
        return

    log.info("%s RAG retrieval succeeded. Chunks sent to LLM: %d", prefix, len(hits))
    for rank, (score, chunk) in enumerate(hits, 1):
        meta = chunk.get("metadata", {})
        log.info(
            (
                "%s RAG chunk rank=%d score=%.4f document_id=%s scope=%s "
                "source_file=%s chunk_index=%s preview=\"%s\""
            ),
            prefix,
            rank,
            score,
            meta.get("document_id", ""),
            meta.get("scope", "system"),
            meta.get("source_file", "unknown"),
            meta.get("chunk_index", -1),
            chunk_preview(chunk.get("text", "")),
        )

class KnowledgeRetriever:
    def __init__(self, vector_db: VectorDB):
        self.db = vector_db

    def get_context_hits(
        self,
        topic,
        query=None,
        allowed_document_ids=None,
        allowed_scopes=None,
        k: int = 3,
        min_score: float | None = None,
    ):
        """
        Truy xuất kiến thức với cơ chế phân quyền (allowed_document_ids, allowed_scopes).
        Nếu có query (câu hỏi học sinh), dùng query để tìm. 
        Nếu không, dùng topic để tìm kiến thức tổng quát.
        """
        search_query = query if query else topic

        return self.db.search(
            search_query, 
            k=k, 
            return_scores=True,
            allowed_document_ids=allowed_document_ids,
            allowed_scopes=allowed_scopes,
            min_score=min_score,
        )

    def get_context(self, topic, query=None, allowed_document_ids=None, allowed_scopes=None):
        """Return the legacy prompt context string from the same hits used for logging."""
        hits = self.get_context_hits(
            topic,
            query=query,
            allowed_document_ids=allowed_document_ids,
            allowed_scopes=allowed_scopes,
            k=3,
        )
        return format_context_from_hits(hits)