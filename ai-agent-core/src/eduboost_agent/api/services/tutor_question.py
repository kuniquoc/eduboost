"""Sinh một câu hỏi thích ứng cho luồng gia sư."""

import logging
import time
from typing import Any

from eduboost_agent.llm.prompt_templates import PromptTemplates
from eduboost_agent.api.services.quiz_parser import (
    QUIZ_RETRY_TEMPERATURES,
    build_avoid_texts,
    build_retry_hint,
    is_exact_duplicate,
    seed_seen_from_existing,
)
from eduboost_agent.rag.retriever import format_context_from_hits, log_retrieved_chunks_success


def _load_context(
    runtime_state: Any,
    logger: logging.Logger,
    topic_name: str,
    allowed_document_ids: list[str] | None,
    allowed_scopes: list[str] | None,
) -> str:
    if not runtime_state.retriever:
        logger.info("[QUIZ-GEN][STEP 2] RAG Retriever is not active. Continuing with empty context.")
        return "No specific textbook context available."
    try:
        hits = runtime_state.retriever.get_context_hits(
            topic_name,
            allowed_document_ids=allowed_document_ids,
            allowed_scopes=allowed_scopes,
        )
        logger.info("[QUIZ-GEN][STEP 2] RAG Retrieval complete. Found %d matching chunks.", len(hits))
        log_retrieved_chunks_success(logger, "[QUIZ-GEN][STEP 2]", hits, query=topic_name)
        return format_context_from_hits(hits)
    except Exception as error:
        # Mất RAG không được làm gián đoạn luồng sinh câu hỏi từ kiến thức chung.
        logger.error("[QUIZ-GEN][STEP 2] RAG Retrieval encountered an error: %s", error, exc_info=True)
        return "No specific textbook context available."


async def generate_question(
    runtime_state: Any,
    logger: logging.Logger,
    topic_name: str,
    difficulty: float,
    allowed_document_ids: list[str] | None = None,
    allowed_scopes: list[str] | None = None,
    existing_questions: list[str] | None = None,
) -> dict:
    started_at = time.time()
    logger.info("=" * 60)
    logger.info(
        "[QUIZ-GEN][STEP 1] Received generate-question request: Topic='%s', Target Difficulty (Beta)=%s",
        topic_name,
        difficulty,
    )
    if not runtime_state.llm_available(runtime_state.llm_quiz):
        logger.warning("[QUIZ-GEN] Quiz LLM unavailable")
        runtime_state.raise_ai_unavailable()

    retrieval_started_at = time.time()
    context = _load_context(
        runtime_state,
        logger,
        topic_name,
        allowed_document_ids,
        allowed_scopes,
    )
    logger.info("[QUIZ-GEN][STEP 2] Retrieval finished in %.3fs", time.time() - retrieval_started_at)

    seen, completed = seed_seen_from_existing(existing_questions or [])
    rejected: list[str] = []
    result: dict | None = None
    for attempt in range(1, 6):
        avoid_texts = build_avoid_texts(completed, rejected)
        avoid_block = ""
        if avoid_texts:
            avoid_block = (
                "\n\nDO NOT generate any of the following questions (already used):\n"
                + "\n".join(f"- {text}" for text in avoid_texts)
            )
        retry_suffix = build_retry_hint(attempt, avoid_texts)
        prompt_context = context
        if avoid_block or retry_suffix:
            prompt_context += f"\n\nADDITIONAL INSTRUCTIONS:\n{avoid_block}{retry_suffix}"

        prompt = PromptTemplates.QUIZ_TEMPLATE.format(
            topic=topic_name,
            difficulty=difficulty,
            context=prompt_context,
        )
        temperature = QUIZ_RETRY_TEMPERATURES[min(attempt - 1, len(QUIZ_RETRY_TEMPERATURES) - 1)]
        result = runtime_state.llm_quiz.generate_json(prompt, temperature=temperature)
        if not result or "error" in result:
            runtime_state.raise_ai_unavailable()

        question_text = str(result.get("question", "")).strip()
        if is_exact_duplicate(question_text, seen):
            rejected.append(question_text)
            logger.info(
                '[QUIZ-GEN][STEP 5] Attempt %d/5 returned duplicate question: "%s"',
                attempt,
                question_text[:80],
            )
            result = None
            continue
        if question_text:
            break

    if result is None:
        logger.warning("[QUIZ-GEN][STEP 5] Failed to generate a non-duplicate question after retries")
        runtime_state.raise_ai_unavailable()

    logger.info("[QUIZ-GEN][STEP 5] Question generated successfully in %.3fs!", time.time() - started_at)
    return {
        "question": result.get("question", ""),
        "options": result.get("options", {}),
        "correct_answer": result.get("correct_answer", ""),
        "explanation": result.get("explanation", ""),
        "difficulty_level": result.get("difficulty_level", difficulty),
    }
