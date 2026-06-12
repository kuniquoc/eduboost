"""Quiz batch generation helpers and orchestration."""
import asyncio
import logging
import os
import re
import tempfile

from src.adapters.prompt_templates import PromptTemplates
from src.api.app_state import runtime
from src.api.models import GenerateQuizBatchRequest
from src.core.config import MAX_NUM_QUESTIONS, QUIZ_BATCH_MAX_CONCURRENT
from src.rag.document_reader import DocumentReader
from src.rag.retriever import chunk_preview, is_product_environment, log_retrieved_chunks_success
from src.rag.text_splitters import SemanticTextSplitter, SlidingWindowTextSplitter

logger = logging.getLogger(__name__)

_DOC_CONTEXT_MAX_CHARS = 50_000


def _build_quiz_retrieval_query(topic_name: str, user_prompt: str | None) -> str:
    """Build the RAG retrieval query from topic + optional user input."""
    topic = (topic_name or "").strip()
    prompt = (user_prompt or "").strip()
    if not prompt:
        return topic
    if not topic:
        return prompt
    return f"{topic}\n{prompt}"


def _split_context_blob(context: str) -> list[str]:
    """Split a joined context string into chunks for per-question rotation."""
    if not context.strip():
        return []
    parts = [p.strip() for p in context.split("\n\n") if p.strip()]
    return parts if parts else [context.strip()]


def _load_quiz_context_from_rag(retrieval_query: str, document_id: str) -> list[str]:
    """Load document context chunks from FAISS when the document was already ingested."""
    if not runtime.retriever:
        return []
    try:
        hits = runtime.retriever.get_context_hits(
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
    except Exception as e:
        logger.warning("[QUIZ-BATCH] RAG context lookup failed for document_id=%s: %s", document_id, e)
    return []


def _rank_document_chunks(full_text: str, source_file: str, retrieval_query: str) -> list[str]:
    """Split document text and return top relevant chunk texts for quiz context."""
    if not full_text.strip():
        return []

    if len(full_text) > _DOC_CONTEXT_MAX_CHARS:
        full_text = full_text[:_DOC_CONTEXT_MAX_CHARS]
        logger.info("[QUIZ-BATCH] Truncated document to %d chars", _DOC_CONTEXT_MAX_CHARS)

    embed_model = runtime.vector_db.embed_model if runtime.vector_db else None
    doc_chunks: list[dict] = []

    try:
        splitter = SemanticTextSplitter(
            embed_model=embed_model,
            percentile_threshold=75,
            min_chunk_size=50,
            max_chunk_size=600,
        )
        doc_chunks = splitter.split_text(full_text, source_file=source_file)
        logger.info("[QUIZ-BATCH] Split document into %d semantic chunks", len(doc_chunks))
    except Exception as e:
        logger.warning("[QUIZ-BATCH] Semantic chunking failed, using sliding window fallback: %s", e)
        doc_chunks = SlidingWindowTextSplitter(chunk_size=200, chunk_overlap=30).split_text(
            full_text, source_file=source_file
        )

    if not doc_chunks:
        return []

    if embed_model:
        try:
            import torch
            from sentence_transformers import util as st_util

            topic_emb = embed_model.encode(retrieval_query, convert_to_tensor=True)
            chunk_texts = [c["text"] for c in doc_chunks]
            chunk_embs = embed_model.encode(chunk_texts, convert_to_tensor=True)
            scores = st_util.cos_sim(topic_emb, chunk_embs)[0]
            top_k = min(6, len(doc_chunks))
            top_indices = sorted(torch.topk(scores, top_k).indices.tolist())
            logger.info("[QUIZ-BATCH] Selected top-%d relevant chunks for query '%s'", top_k, retrieval_query)
            return [doc_chunks[i]["text"] for i in top_indices]
        except Exception as e:
            logger.warning("[QUIZ-BATCH] Chunk ranking failed, using first 6 chunks: %s", e)

    return [c["text"] for c in doc_chunks[: min(6, len(doc_chunks))]]


def _load_quiz_context_from_doc_url(doc_url: str, retrieval_query: str) -> list[str]:
    """Download and parse a document URL. Returns empty list on failure (non-fatal)."""
    import requests as _requests
    import tempfile

    try:
        logger.info("[QUIZ-BATCH] Downloading file from: %s", doc_url)
        response = _requests.get(doc_url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.warning("[QUIZ-BATCH] Document download failed (continuing without doc context): %s", e)
        return []

    parsed_url = doc_url.split("?")[0]
    ext = os.path.splitext(parsed_url)[1].lower() or ".txt"
    tmp_path = ""

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        reader = DocumentReader()
        full_text = reader.load_document(tmp_path)
        if not full_text.strip():
            logger.warning("[QUIZ-BATCH] Document parsed but contained no text")
            return []

        return _rank_document_chunks(full_text, parsed_url, retrieval_query)
    except Exception as e:
        logger.warning("[QUIZ-BATCH] Document parse/chunk failed (continuing without doc context): %s", e)
        return []
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception as cleanup_error:
                logger.warning("Failed to delete temporary file %s: %s", tmp_path, cleanup_error)


def _parse_is_correct(val) -> bool:
    """Robustly parse isCorrect field from LLM output.
    
    Handles: bool (True/False), int (1/0), str ("true"/"false"/"1"/"0"/"yes"/"no").
    Avoids the Python pitfall: bool("false") == True (non-empty string is truthy).
    """
    if isinstance(val, bool):
        return val
    if isinstance(val, int):
        return val == 1
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    return False


_QUIZ_OPTION_LETTERS = ["A", "B", "C", "D"]
_QUIZ_PROHIBITED_EXAMPLES = {
    "thechildrenplayinginthegardenwhenitstartedtorain",
    "sheisanexpertinthefieldofartificialintelligence",
}


def _normalize_answer_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _normalize_question_text(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "", text.strip().lower())


def _is_exact_duplicate(question_text: str, seen: set[str]) -> bool:
    return _normalize_question_text(question_text) in seen


def _is_duplicate_question(question_text: str, seen: set[str]) -> bool:
    return _is_exact_duplicate(question_text, seen)


_QUIZ_AVOID_LIST_CAP = 21
_QUIZ_AVOID_COMPLETED_RECENT = 20


def _build_avoid_texts(completed: list[dict], rejected: list[str]) -> list[str]:
    all_texts = [q["question"] for q in completed] + rejected
    if len(all_texts) <= _QUIZ_AVOID_LIST_CAP:
        return all_texts

    # Keep all rejected items first, then fill remaining slots with most recent completed
    # while respecting the hard cap.
    seen: set[str] = set()
    result: list[str] = []

    for text in rejected:
        if text not in seen:
            seen.add(text)
            result.append(text)

    remaining_slots = max(0, _QUIZ_AVOID_LIST_CAP - len(result))
    if remaining_slots == 0:
        return result[:_QUIZ_AVOID_LIST_CAP]

    recent_completed = [q["question"] for q in completed[-_QUIZ_AVOID_COMPLETED_RECENT:]]
    for text in reversed(recent_completed):
        if text not in seen:
            seen.add(text)
            result.append(text)
            if len(result) >= _QUIZ_AVOID_LIST_CAP:
                break

    return result[:_QUIZ_AVOID_LIST_CAP]


def _extract_forbidden_prefixes(avoid_texts: list[str]) -> list[str]:
    prefixes: set[str] = set()
    for text in avoid_texts:
        lower = text.strip().lower()
        for starter in ("the new ", "the company ", "the project ", "the law ", "the policy "):
            if lower.startswith(starter):
                prefixes.add(starter.strip() + "...")
    return sorted(prefixes)


def _build_retry_hint(attempt: int, avoid_texts: list[str]) -> str:
    if attempt <= 1:
        return ""
    if attempt == 2:
        return (
            "\n\nRETRY: Use a DIFFERENT subject and verb pattern "
            "than every avoid-list sentence."
        )
    if attempt == 3:
        hint = "\n\nRETRY: Generate a COMPLETELY DIFFERENT sentence."
        banned = _extract_forbidden_prefixes(avoid_texts)
        if banned:
            hint += f" Do NOT start with: {', '.join(banned)}"
        return hint
    if attempt == 4:
        return (
            "\n\nRETRY: Pick vocabulary from a DIFFERENT part of the FOCUS EXCERPT. "
            "Test a different collocation or phrasal verb."
        )
    return (
        "\n\nRETRY: Use a person/action scene (She/He/They...), "
        "NOT laws/policies/companies."
    )


_QUIZ_EXISTING_QUESTIONS_CAP = 150


def _seed_seen_from_existing(existing: list[str]) -> tuple[set[str], list[dict]]:
    seen: set[str] = set()
    placeholders: list[dict] = []
    for text in existing[:_QUIZ_EXISTING_QUESTIONS_CAP]:
        text = (text or "").strip()
        if not text:
            continue
        norm = _normalize_question_text(text)
        if norm and norm not in seen:
            seen.add(norm)
            placeholders.append({"question": text})
    return seen, placeholders


_QUIZ_RETRY_TEMPERATURES = [0.35, 0.45, 0.55, 0.60, 0.65]


def _resolve_correct_letter(correct_answer: str, options_raw: dict) -> str | None:
    """Map LLM correct_answer to A–D (letter or option text)."""
    raw = str(correct_answer or "").strip()
    if not raw:
        return None

    upper = raw.upper()
    if upper in _QUIZ_OPTION_LETTERS:
        return upper

    letter_match = re.search(r"\b([A-D])\b", upper)
    if letter_match and len(raw) <= 12:
        return letter_match.group(1)

    normalized_answer = _normalize_answer_text(raw)
    matches = [
        letter
        for letter in _QUIZ_OPTION_LETTERS
        if _normalize_answer_text(options_raw.get(letter, "")) == normalized_answer
    ]
    if len(matches) == 1:
        return matches[0]
    return None


def _parse_single_question(raw: dict, difficulty_label: str) -> dict | None:
    """Parse and validate a single QUIZ_TEMPLATE response into the standard format."""
    question_text = raw.get("question", "").strip()
    if not question_text:
        return None

    norm_text = _normalize_question_text(question_text)
    if norm_text in _QUIZ_PROHIBITED_EXAMPLES:
        logger.info("[QUIZ-BATCH] Skipped prohibited example question: %s", question_text)
        return None

    options_raw = raw.get("options", {})
    correct_answer_raw = raw.get("correct_answer", "")
    explanation = raw.get("explanation", "")

    if isinstance(options_raw, dict) and len(options_raw) == 4:
        correct_letter = _resolve_correct_letter(correct_answer_raw, options_raw)
        if correct_letter is None:
            logger.warning(
                "[QUIZ-BATCH] Invalid correct_answer '%s' (options preview: %s), skipping",
                correct_answer_raw,
                str(options_raw)[:100],
            )
            return None
        sanitized_options = [
            {"text": str(options_raw.get(letter, "")), "isCorrect": (letter == correct_letter)}
            for letter in _QUIZ_OPTION_LETTERS
        ]
    elif isinstance(options_raw, list) and len(options_raw) == 4:
        sanitized_options = []
        for opt in options_raw:
            if not isinstance(opt, dict):
                return None
            sanitized_options.append({
                "text": str(opt.get("text", "")),
                "isCorrect": _parse_is_correct(opt.get("isCorrect", False)),
            })
    else:
        logger.warning("[QUIZ-BATCH] Unexpected options format: %s", str(options_raw)[:100])
        return None

    correct_count = sum(1 for o in sanitized_options if o["isCorrect"])
    if correct_count != 1:
        logger.warning("[QUIZ-BATCH] Expected exactly 1 correct option, got %d — skipping", correct_count)
        return None

    difficulty_index_raw = raw.get("difficulty_index", raw.get("difficulty_level"))
    try:
        difficulty_index = float(difficulty_index_raw)
    except (TypeError, ValueError):
        difficulty_index = _DIFFICULTY_TO_BETA.get(difficulty_label, 0.0)
    difficulty_index = max(-3.0, min(3.0, difficulty_index))

    return {
        "question": question_text,
        "type": "mcq",
        "difficulty": difficulty_label,
        "difficulty_index": difficulty_index,
        "options": sanitized_options,
        "explanation": explanation,
    }


# Difficulty → IRT Beta mapping for single-question QUIZ_TEMPLATE
_DIFFICULTY_TO_BETA = {
    "easy": -1.5,
    "medium": 0.0,
    "hard": 1.5,
}


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

    easy_count = sum(1 for q in final_questions if q["difficulty"] == "easy")
    medium_count = sum(1 for q in final_questions if q["difficulty"] == "medium")
    hard_count = sum(1 for q in final_questions if q["difficulty"] == "hard")

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
