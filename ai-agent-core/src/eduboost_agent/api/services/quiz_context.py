"""Nạp và xếp hạng ngữ cảnh dùng để sinh quiz."""

import logging
import os
import tempfile
from typing import Any

from eduboost_agent.rag.document_reader import DocumentReader
from eduboost_agent.rag.retriever import log_retrieved_chunks_success
from eduboost_agent.rag.text_splitters import SemanticTextSplitter, SlidingWindowTextSplitter

logger = logging.getLogger("eduboost_agent.api.quiz_batch_service")

DOC_CONTEXT_MAX_CHARS = 50_000


def build_quiz_retrieval_query(topic_name: str, user_prompt: str | None) -> str:
    topic = (topic_name or "").strip()
    prompt = (user_prompt or "").strip()
    if not prompt:
        return topic
    if not topic:
        return prompt
    return f"{topic}\n{prompt}"


def split_context_blob(context: str) -> list[str]:
    if not context.strip():
        return []
    parts = [part.strip() for part in context.split("\n\n") if part.strip()]
    return parts if parts else [context.strip()]


def load_quiz_context_from_rag(
    retrieval_query: str,
    document_id: str,
    runtime_state: Any,
) -> list[str]:
    if not runtime_state.retriever:
        return []
    try:
        hits = runtime_state.retriever.get_context_hits(
            retrieval_query,
            allowed_document_ids=[document_id],
        )
        if hits:
            logger.info(
                "[QUIZ-BATCH] Loaded %d context chunks from RAG for document_id=%s",
                len(hits),
                document_id,
            )
            log_retrieved_chunks_success(logger, "[QUIZ-BATCH]", hits, query=retrieval_query)
            return [chunk.get("text", "") for _score, chunk in hits]
    except Exception as error:
        logger.warning(
            "[QUIZ-BATCH] RAG context lookup failed for document_id=%s: %s",
            document_id,
            error,
        )
    return []


def rank_document_chunks(
    full_text: str,
    source_file: str,
    retrieval_query: str,
    runtime_state: Any,
) -> list[str]:
    if not full_text.strip():
        return []

    if len(full_text) > DOC_CONTEXT_MAX_CHARS:
        full_text = full_text[:DOC_CONTEXT_MAX_CHARS]
        logger.info("[QUIZ-BATCH] Truncated document to %d chars", DOC_CONTEXT_MAX_CHARS)

    embed_model = runtime_state.vector_db.embed_model if runtime_state.vector_db else None
    try:
        chunks = SemanticTextSplitter(
            embed_model=embed_model,
            percentile_threshold=75,
            min_chunk_size=50,
            max_chunk_size=600,
        ).split_text(full_text, source_file=source_file)
        logger.info("[QUIZ-BATCH] Split document into %d semantic chunks", len(chunks))
    except Exception as error:
        # Semantic splitter phụ thuộc model; sliding window là đường lui ổn định.
        logger.warning("[QUIZ-BATCH] Semantic chunking failed, using sliding window fallback: %s", error)
        chunks = SlidingWindowTextSplitter(chunk_size=200, chunk_overlap=30).split_text(
            full_text,
            source_file=source_file,
        )

    if not chunks:
        return []
    if not embed_model:
        return [chunk["text"] for chunk in chunks[: min(6, len(chunks))]]

    try:
        import torch
        from sentence_transformers import util as st_util

        topic_embedding = embed_model.encode(retrieval_query, convert_to_tensor=True)
        chunk_embeddings = embed_model.encode(
            [chunk["text"] for chunk in chunks],
            convert_to_tensor=True,
        )
        scores = st_util.cos_sim(topic_embedding, chunk_embeddings)[0]
        top_k = min(6, len(chunks))
        top_indices = sorted(torch.topk(scores, top_k).indices.tolist())
        logger.info("[QUIZ-BATCH] Selected top-%d relevant chunks for query '%s'", top_k, retrieval_query)
        return [chunks[index]["text"] for index in top_indices]
    except Exception as error:
        logger.warning("[QUIZ-BATCH] Chunk ranking failed, using first 6 chunks: %s", error)
        return [chunk["text"] for chunk in chunks[: min(6, len(chunks))]]


def load_quiz_context_from_doc_url(
    doc_url: str,
    retrieval_query: str,
    runtime_state: Any,
) -> list[str]:
    import requests

    try:
        logger.info("[QUIZ-BATCH] Downloading file from: %s", doc_url)
        response = requests.get(doc_url, timeout=30)
        response.raise_for_status()
    except Exception as error:
        logger.warning("[QUIZ-BATCH] Document download failed (continuing without doc context): %s", error)
        return []

    parsed_url = doc_url.split("?")[0]
    extension = os.path.splitext(parsed_url)[1].lower() or ".txt"
    temporary_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary_file:
            temporary_file.write(response.content)
            temporary_path = temporary_file.name

        full_text = DocumentReader().load_document(temporary_path)
        if not full_text.strip():
            logger.warning("[QUIZ-BATCH] Document parsed but contained no text")
            return []
        return rank_document_chunks(full_text, parsed_url, retrieval_query, runtime_state)
    except Exception as error:
        logger.warning("[QUIZ-BATCH] Document parse/chunk failed (continuing without doc context): %s", error)
        return []
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except Exception as cleanup_error:
                logger.warning("Failed to delete temporary file %s: %s", temporary_path, cleanup_error)
