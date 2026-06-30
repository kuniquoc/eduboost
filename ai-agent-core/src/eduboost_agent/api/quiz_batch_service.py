"""Quiz batch generation helpers and orchestration."""
import asyncio
import logging

from eduboost_agent.llm.prompt_templates import PromptTemplates
from eduboost_agent.api.app_state import runtime
from eduboost_agent.api.models import GenerateQuizBatchRequest
from eduboost_agent.api.services.quiz_context import (
    build_quiz_retrieval_query as _build_quiz_retrieval_query,
    load_quiz_context_from_doc_url,
    load_quiz_context_from_rag,
    rank_document_chunks,
    split_context_blob as _split_context_blob,
)
from eduboost_agent.api.services.quiz_parser import (
    DIFFICULTY_TO_BETA as _DIFFICULTY_TO_BETA,
    QUIZ_RETRY_TEMPERATURES as _QUIZ_RETRY_TEMPERATURES,
    build_avoid_texts as _build_avoid_texts,
    build_retry_hint as _build_retry_hint,
    is_duplicate_question as _is_duplicate_question,
    is_exact_duplicate as _is_exact_duplicate,
    normalize_question_text as _normalize_question_text,
    parse_is_correct as _parse_is_correct,
    parse_single_question as _parse_single_question,
    resolve_correct_letter as _resolve_correct_letter,
    seed_seen_from_existing as _seed_seen_from_existing,
)
from eduboost_agent.learning.config import MAX_NUM_QUESTIONS, QUIZ_BATCH_MAX_CONCURRENT
from eduboost_agent.rag.retriever import chunk_preview, is_product_environment

logger = logging.getLogger(__name__)

def _load_quiz_context_from_rag(retrieval_query: str, document_id: str) -> list[str]:
    return load_quiz_context_from_rag(retrieval_query, document_id, runtime)


def _rank_document_chunks(full_text: str, source_file: str, retrieval_query: str) -> list[str]:
    return rank_document_chunks(full_text, source_file, retrieval_query, runtime)


def _load_quiz_context_from_doc_url(doc_url: str, retrieval_query: str) -> list[str]:
    return load_quiz_context_from_doc_url(doc_url, retrieval_query, runtime)


async def generate_quiz_batch(request: GenerateQuizBatchRequest):
    """Generates multiple quiz questions — one LLM call per question, run in parallel."""
    if not runtime.llm_available(runtime.llm_quiz):
        runtime.raise_ai_unavailable()

    retrieval_query = _build_quiz_retrieval_query(request.topic_name, request.user_prompt)

    # ── Step 1: Load document context chunks (RAG first, then doc_url fallback) ─
    context_chunks: list[str] = []
    if request.document_id:
        context_chunks = _load_quiz_context_from_rag(retrieval_query, request.document_id)

    if not context_chunks and request.doc_url:
        context_chunks = _load_quiz_context_from_doc_url(request.doc_url, retrieval_query)

    if not context_chunks and (request.document_id or request.doc_url):
        logger.warning(
            "[QUIZ-BATCH] No document context available (document_id=%s) — generating from topic only",
            request.document_id,
        )

    # ── Step 2: Resolve difficulty counts ────────────────────────────────────
    num_easy = request.num_easy
    num_medium = request.num_medium
    num_hard = request.num_hard

    if num_easy == 0 and num_medium == 0 and num_hard == 0:
        if request.difficulty == "easy":
            num_easy = request.num_questions
        elif request.difficulty == "hard":
            num_hard = request.num_questions
        else:
            num_medium = request.num_questions

    total_questions = num_easy + num_medium + num_hard
    if total_questions == 0:
        total_questions = request.num_questions
        num_medium = total_questions

    if total_questions > MAX_NUM_QUESTIONS:
        logger.warning(
            "[QUIZ-BATCH] Requested %d questions; capping at MAX_NUM_QUESTIONS=%d",
            total_questions, MAX_NUM_QUESTIONS,
        )
        scale = MAX_NUM_QUESTIONS / total_questions
        num_easy = max(0, int(num_easy * scale))
        num_medium = max(0, int(num_medium * scale))
        num_hard = max(0, int(num_hard * scale))
        total_questions = num_easy + num_medium + num_hard
        if total_questions == 0:
            num_medium = MAX_NUM_QUESTIONS
            total_questions = MAX_NUM_QUESTIONS

    # Build the flat list of difficulty labels to generate
    difficulty_list = (["easy"] * num_easy) + (["medium"] * num_medium) + (["hard"] * num_hard)
    logger.info(
        "[QUIZ-BATCH] Starting per-question generation: total=%d (Easy=%d, Medium=%d, Hard=%d)",
        total_questions, num_easy, num_medium, num_hard
    )

    # ── Step 3: Per-question generator ───────────────────────────────────────
    import asyncio

    seen_questions, completed_questions = _seed_seen_from_existing(request.existing_questions)
    if completed_questions:
        logger.info(
            "[QUIZ-BATCH] Seeded %d existing questions into avoid-list",
            len(completed_questions),
        )
    rejected_duplicates_count = 0

    def _generate_one_sync(
        difficulty_label: str,
        avoid_texts: list[str],
        attempt: int,
        slot_index: int,
    ) -> dict | None:
        """Synchronous single-question generation (called via asyncio.to_thread)."""
        beta = _DIFFICULTY_TO_BETA.get(difficulty_label, 0.0)
        avoid_block = ""
        if avoid_texts:
            avoid_block = (
                "\n\nDO NOT generate any of the following questions (already used):\n"
                + "\n".join(f"- {t}" for t in avoid_texts)
            )
        retry_suffix = _build_retry_hint(attempt, avoid_texts)
        manual_requirements = (request.user_prompt or "").strip()
        runtime_constraints = (avoid_block + retry_suffix).strip()
        context_sections: list[str] = []
        if context_chunks:
            chunk_slot = slot_index % len(context_chunks)
            chunk = context_chunks[chunk_slot]
            if is_product_environment():
                logger.info(
                    (
                        "[QUIZ-BATCH] Context chunk sent to LLM slot=%d "
                        "attempt=%d difficulty=%s chunk_slot=%d query=\"%s\" preview=\"%s\""
                    ),
                    slot_index,
                    attempt,
                    difficulty_label,
                    chunk_slot,
                    chunk_preview(retrieval_query, limit=200),
                    chunk_preview(chunk),
                )
            context_sections.append(
                "DOCUMENT CONTEXT (generate question ONLY from this section):\n"
                f"{chunk}"
            )
        if manual_requirements:
            context_sections.append(
                "MANUAL REQUIREMENTS (must satisfy these constraints):\n"
                f"{manual_requirements}"
            )
        if runtime_constraints:
            context_sections.append(
                "GENERATION CONSTRAINTS:\n"
                f"{runtime_constraints}"
            )

        ctx = "\n\n".join(context_sections) if context_sections else "No document context or manual requirements provided."

        prompt = PromptTemplates.QUIZ_TEMPLATE.format(
            topic=request.topic_name,
            difficulty=beta,
            context=ctx,
        )
        temp_idx = min(attempt - 1, len(_QUIZ_RETRY_TEMPERATURES) - 1)
        temperature = _QUIZ_RETRY_TEMPERATURES[temp_idx]
        result = runtime.llm_quiz.generate_json(prompt, max_tokens=1024, temperature=temperature)
        if "error" in result:
            logger.warning(
                "[QUIZ-BATCH] LLM error for difficulty=%s (attempt=%d, temp=%.2f): %s",
                difficulty_label, attempt, temperature, result.get("error"),
            )
            return None
        return result

    # ── Step 4: Generate all questions (semaphore-limited), with per-question retry ─
    final_questions: list[dict] = []

    # Semaphore limits parallel LLM calls — configurable via QUIZ_BATCH_MAX_CONCURRENT env.
    MAX_CONCURRENT = QUIZ_BATCH_MAX_CONCURRENT
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def generate_one_with_retry(
        difficulty_label: str,
        slot_index: int,
        max_retries: int = 5,
    ) -> dict | None:
        nonlocal rejected_duplicates_count
        rejected_questions: list[str] = []

        async with semaphore:
            for attempt in range(1, max_retries + 1):
                avoid_texts = _build_avoid_texts(completed_questions, rejected_questions)
                raw = await asyncio.to_thread(
                    _generate_one_sync, difficulty_label, avoid_texts, attempt, slot_index
                )
                if raw is None:
                    logger.warning(
                        "[QUIZ-BATCH] Attempt %d/%d: LLM call failed for difficulty=%s",
                        attempt, max_retries, difficulty_label,
                    )
                    continue

                parsed = _parse_single_question(raw, difficulty_label)
                if parsed is None:
                    logger.warning(
                        "[QUIZ-BATCH] Attempt %d/%d: Parse/validation failed for difficulty=%s",
                        attempt, max_retries, difficulty_label,
                    )
                    continue

                norm_q = _normalize_question_text(parsed["question"])
                if _is_exact_duplicate(parsed["question"], seen_questions):
                    rejected_questions.append(parsed["question"])
                    rejected_duplicates_count += 1
                    logger.info(
                        "[QUIZ-BATCH] Attempt %d/%d: Duplicate (norm=%s..., rejected=\"%s\", seen_count=%d) for difficulty=%s",
                        attempt,
                        max_retries,
                        norm_q[:40],
                        parsed["question"][:80],
                        len(seen_questions),
                        difficulty_label,
                    )
                    continue

                seen_questions.add(norm_q)
                completed_questions.append(parsed)
                logger.info(
                    "[QUIZ-BATCH] ✓ Generated %s question: \"%s\"",
                    difficulty_label,
                    parsed["question"][:60],
                )
                return parsed

            logger.error(
                "[QUIZ-BATCH] Failed to generate valid %s question after %d attempts",
                difficulty_label,
                max_retries,
            )
            return None

    logger.info("[QUIZ-BATCH] Launching %d question generation tasks (max_concurrent=%d)...", total_questions, MAX_CONCURRENT)
    tasks = [
        generate_one_with_retry(diff, slot_index)
        for slot_index, diff in enumerate(difficulty_list)
    ]
    results = await asyncio.gather(*tasks)

    for res in results:
        if res is not None:
            final_questions.append(res)

    easy_count = sum(1 for q in final_questions if q["difficulty_band"] == "easy")
    medium_count = sum(1 for q in final_questions if q["difficulty_band"] == "medium")
    hard_count = sum(1 for q in final_questions if q["difficulty_band"] == "hard")

    logger.info(
        "[QUIZ-BATCH] Final batch generated: %d questions (Requested total: %d, Easy: %d/%d, Medium: %d/%d, Hard: %d/%d)",
        len(final_questions),
        total_questions,
        easy_count, num_easy,
        medium_count, num_medium,
        hard_count, num_hard,
    )

    if len(final_questions) < total_questions:
        logger.warning(
            "[QUIZ-BATCH] Shortfall: easy %d/%d, medium %d/%d, hard %d/%d — rejected_duplicates=%d",
            easy_count, num_easy,
            medium_count, num_medium,
            hard_count, num_hard,
            rejected_duplicates_count,
        )

    if not final_questions:
        runtime.raise_ai_unavailable()

    return {"questions": final_questions}
