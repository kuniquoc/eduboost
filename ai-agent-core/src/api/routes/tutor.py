"""Tutor HTTP routes — quiz, explain, chat."""
import logging
import time
from typing import Optional

from fastapi import APIRouter

from src.adapters.prompt_templates import PromptTemplates
from src.api.agent_session import get_or_create_agent, update_agent
from src.api.app_state import runtime
from src.api.models import ChatRequest, GenerateQuizBatchRequest, GraderRequest, UpdateStateRequest
from src.api.quiz_batch_service import generate_quiz_batch
from src.core.config import CHAT_MAX_HISTORY, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K_DOCS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tutor", tags=["tutor"])

@router.get("/next-action")
async def get_next_action(student_id: str, topic_name: str):
    """Uses BKT to decide: EXPLAIN, QUIZ, or NEXT_SKILL."""
    agent = get_or_create_agent(student_id)
    result = agent.decide_next_action(topic_name)
    return result


@router.post("/update-state", deprecated=True)
async def update_student_state(request: UpdateStateRequest):
    """DEPRECATED: BKT state is persisted in PostgreSQL by the .NET server. Legacy in-memory session only."""
    agent = get_or_create_agent(request.student_id)
    result = agent.update_student_state(
        request.topic_name, request.difficulty, request.is_correct
    )
    update_agent(request.student_id, agent)
    return result


@router.get("/generate-question")
async def generate_quiz_question(
    topic_name: str,
    difficulty: float = 0.0,
    allowed_document_ids: Optional[str] = None,
    allowed_scopes: Optional[str] = None
):
    """Generates an adaptive quiz question using RAG context + LLM (Quiz LLM)."""
    import time
    
    start_time = time.time()
    
    allowed_doc_ids_list = allowed_document_ids.split(",") if allowed_document_ids else None
    allowed_scopes_list = allowed_scopes.split(",") if allowed_scopes else None
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[QUIZ-GEN][STEP 1] Received generate-question request: Topic='{topic_name}', Target Difficulty (Beta)={difficulty}")

    if not runtime.llm_available(runtime.llm_quiz):
        logger.warning("[QUIZ-GEN] Quiz LLM unavailable")
        runtime.raise_ai_unavailable()

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if runtime.retriever:
        logger.info(f"[QUIZ-GEN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = runtime.retriever.get_context(
                topic_name,
                allowed_document_ids=allowed_doc_ids_list,
                allowed_scopes=allowed_scopes_list
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if runtime.vector_db:
                hits = runtime.vector_db.search(
                    topic_name,
                    k=3,
                    return_scores=True,
                    allowed_document_ids=allowed_doc_ids_list,
                    allowed_scopes=allowed_scopes_list
                )
                logger.info(f"[QUIZ-GEN][STEP 2] RAG Retrieval complete. Found {len(hits)} matching chunks:")
                for i, (score, chunk) in enumerate(hits, 1):
                    meta = chunk.get("metadata", {})
                    src = meta.get("source_file", "unknown")
                    idx = meta.get("chunk_index", -1)
                    preview = " ".join(chunk["text"].split())[:80] + "..."
                    logger.info(f"  -> Rank {i} | Score: {score:.4f} | Chunk #{idx} ({src}) | \"{preview}\"")
            else:
                logger.info("[QUIZ-GEN][STEP 2] RAG Retrieval complete (VectorDB metrics unavailable).")
                
        except Exception as e:
            logger.error(f"[QUIZ-GEN][STEP 2] RAG Retrieval encountered an error: {e}", exc_info=True)
            context = "No specific textbook context available."
    else:
        logger.info("[QUIZ-GEN][STEP 2] RAG Retriever is not active. Continuing with empty context.")
        context = "No specific textbook context available."
        
    retrieval_duration = time.time() - retrieval_start
    logger.info(f"[QUIZ-GEN][STEP 2] Retrieval finished in {retrieval_duration:.3f}s")

    # Step 3: Prepare Prompt
    logger.info("[QUIZ-GEN][STEP 3] Formatting prompt with topic and retrieved context...")
    prompt = PromptTemplates.QUIZ_TEMPLATE.format(
        topic=topic_name,
        difficulty=difficulty,
        context=context,
    )
    logger.info(f"[QUIZ-GEN][STEP 3] Prompt ready. Total characters: {len(prompt)}")

    # Step 4: Call LLM
    logger.info(f"[QUIZ-GEN][STEP 4] Dispatching request to Quiz LLM (Model: '{runtime.llm_quiz.model}', Endpoint: '{runtime.llm_quiz.endpoint_url}')...")
    llm_start = time.time()
    result = runtime.llm_quiz.generate_json(prompt)

    llm_duration = time.time() - llm_start
    logger.info(f"[QUIZ-GEN][STEP 4] Quiz LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    if not result or "error" in result:
        logger.warning(f"[QUIZ-GEN][STEP 5] LLM unavailable or invalid response: {result.get('error') if result else 'empty'}")
        runtime.raise_ai_unavailable()

    total_duration = time.time() - start_time
    logger.info(f"[QUIZ-GEN][STEP 5] Question generated successfully in {total_duration:.3f}s!")
    logger.info(f"  - Question: \"{result.get('question', '')}\"")
    logger.info(f"  - Options: {result.get('options', {})}")
    logger.info(f"  - Correct Answer: {result.get('correct_answer', '')}")
    logger.info(f"  - Explanation: \"{result.get('explanation', '')[:60]}...\"")
    logger.info("=" * 60)

    return {
        "question": result.get("question", ""),
        "options": result.get("options", {}),
        "correct_answer": result.get("correct_answer", ""),
        "explanation": result.get("explanation", ""),
        "difficulty_level": result.get("difficulty_level", difficulty),
    }


@router.get("/explain")
async def explain_topic(
    topic_name: str, 
    student_state: str = "beginning",
    allowed_document_ids: Optional[str] = None,
    allowed_scopes: Optional[str] = None
):
    """Generates a Socratic explanation using RAG context + LLM (Explanation LLM)."""
    import time
    
    start_time = time.time()
    
    allowed_doc_ids_list = allowed_document_ids.split(",") if allowed_document_ids else None
    allowed_scopes_list = allowed_scopes.split(",") if allowed_scopes else None
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[EXPLAIN][STEP 1] Received explain request: Topic='{topic_name}', Student State='{student_state}'")

    if not runtime.llm_available(runtime.llm_explain):
        logger.warning("[EXPLAIN] Explanation LLM unavailable")
        runtime.raise_ai_unavailable()

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if runtime.retriever:
        logger.info(f"[EXPLAIN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = runtime.retriever.get_context(
                topic_name,
                allowed_document_ids=allowed_doc_ids_list,
                allowed_scopes=allowed_scopes_list
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if runtime.vector_db:
                hits = runtime.vector_db.search(
                    topic_name,
                    k=3,
                    return_scores=True,
                    allowed_document_ids=allowed_doc_ids_list,
                    allowed_scopes=allowed_scopes_list
                )
                logger.info(f"[EXPLAIN][STEP 2] RAG Retrieval complete. Found {len(hits)} matching chunks:")
                for i, (score, chunk) in enumerate(hits, 1):
                    meta = chunk.get("metadata", {})
                    src = meta.get("source_file", "unknown")
                    idx = meta.get("chunk_index", -1)
                    preview = " ".join(chunk["text"].split())[:80] + "..."
                    logger.info(f"  -> Rank {i} | Score: {score:.4f} | Chunk #{idx} ({src}) | \"{preview}\"")
            else:
                logger.info("[EXPLAIN][STEP 2] RAG Retrieval complete (VectorDB metrics unavailable).")
                
        except Exception as e:
            logger.error(f"[EXPLAIN][STEP 2] RAG Retrieval encountered an error: {e}", exc_info=True)
            context = "No specific textbook context available."
    else:
        logger.info("[EXPLAIN][STEP 2] RAG Retriever is not active. Continuing with empty context.")
        context = "No specific textbook context available."
        
    retrieval_duration = time.time() - retrieval_start
    logger.info(f"[EXPLAIN][STEP 2] Retrieval finished in {retrieval_duration:.3f}s")

    # Step 3: Prepare Prompt
    logger.info("[EXPLAIN][STEP 3] Formatting prompt with topic, state, and retrieved context...")
    prompt = PromptTemplates.EXPLANATION_TEMPLATE.format(
        topic=topic_name,
        context=context,
        student_state=student_state,
    )
    logger.info(f"[EXPLAIN][STEP 3] Prompt ready. Total characters: {len(prompt)}")

    # Step 4: Call LLM
    logger.info(f"[EXPLAIN][STEP 4] Dispatching request to Explanation LLM (Model: '{runtime.llm_explain.model}', Endpoint: '{runtime.llm_explain.endpoint_url}')...")
    llm_start = time.time()
    explanation = runtime.llm_explain.generate(prompt)
    if not explanation:
        logger.warning("[EXPLAIN][STEP 4] LLM call returned no content")
        runtime.raise_ai_unavailable()

    llm_duration = time.time() - llm_start
    logger.info(f"[EXPLAIN][STEP 4] Explanation LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    total_duration = time.time() - start_time
    logger.info(f"[EXPLAIN][STEP 5] Socratic explanation generated successfully in {total_duration:.3f}s!")
    logger.info(f"  - Explanation: \"{explanation[:150]}...\"")
    logger.info("=" * 60)

    return {"explanation": explanation}


@router.post("/explain-error")
async def grade_answer(request: GraderRequest):
    """Analyzes a wrong answer and explains the knowledge gap (Explanation LLM)."""
    import time
    
    start_time = time.time()
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[GRADER-RAG][STEP 1] Received explain-error request: Question='{request.question[:80]}...', Correct='{request.correct_answer}', Student='{request.student_answer}'")

    if not runtime.llm_available(runtime.llm_explain):
        logger.warning("[GRADER-RAG] Explanation LLM unavailable")
        runtime.raise_ai_unavailable()

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if runtime.retriever:
        # We query the database using the question text to get relevant grammar concepts
        logger.info(f"[GRADER-RAG][STEP 2] Launching RAG context retrieval using question text as query...")
        try:
            context = runtime.retriever.get_context(
                request.question,
                allowed_document_ids=request.allowed_document_ids,
                allowed_scopes=request.allowed_scopes
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if runtime.vector_db:
                hits = runtime.vector_db.search(
                    request.question,
                    k=3,
                    return_scores=True,
                    allowed_document_ids=request.allowed_document_ids,
                    allowed_scopes=request.allowed_scopes
                )
                logger.info(f"[GRADER-RAG][STEP 2] RAG Retrieval complete. Found {len(hits)} matching chunks:")
                for i, (score, chunk) in enumerate(hits, 1):
                    meta = chunk.get("metadata", {})
                    src = meta.get("source_file", "unknown")
                    idx = meta.get("chunk_index", -1)
                    preview = " ".join(chunk["text"].split())[:80] + "..."
                    logger.info(f"  -> Rank {i} | Score: {score:.4f} | Chunk #{idx} ({src}) | \"{preview}\"")
            else:
                logger.info("[GRADER-RAG][STEP 2] RAG Retrieval complete (VectorDB metrics unavailable).")
                
        except Exception as e:
            logger.error(f"[GRADER-RAG][STEP 2] RAG Retrieval encountered an error: {e}", exc_info=True)
            context = "No specific textbook context available."
    else:
        logger.info("[GRADER-RAG][STEP 2] RAG Retriever is not active. Continuing with empty context.")
        context = "No specific textbook context available."
        
    retrieval_duration = time.time() - retrieval_start
    logger.info(f"[GRADER-RAG][STEP 2] Retrieval finished in {retrieval_duration:.3f}s")

    # Step 3: Prepare Prompt
    logger.info("[GRADER-RAG][STEP 3] Formatting grader prompt with question details and retrieved context...")
    prompt = PromptTemplates.GRADER_TEMPLATE.format(
        question=request.question,
        correct_answer=request.correct_answer,
        student_answer=request.student_answer,
        context=context,
    )
    logger.info(f"[GRADER-RAG][STEP 3] Grader prompt ready. Total characters: {len(prompt)}")

    # Step 4: Call LLM
    logger.info(f"[GRADER-RAG][STEP 4] Dispatching request to Explanation LLM (Model: '{runtime.llm_explain.model}', Endpoint: '{runtime.llm_explain.endpoint_url}')...")
    llm_start = time.time()
    explanation = runtime.llm_explain.generate(prompt)
    if not explanation:
        logger.warning("[GRADER-RAG][STEP 4] LLM call returned no content")
        runtime.raise_ai_unavailable()

    llm_duration = time.time() - llm_start
    logger.info(f"[GRADER-RAG][STEP 4] Grader LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    total_duration = time.time() - start_time
    logger.info(f"[GRADER-RAG][STEP 5] Grader explanation generated successfully in {total_duration:.3f}s!")
    logger.info(f"  - Explanation: \"{explanation[:150]}...\"")
    logger.info("=" * 60)

    return {"explanation": explanation}


@router.post("/generate-quiz")
async def generate_quiz_endpoint(request: GenerateQuizBatchRequest):
    """Generates multiple quiz questions — one LLM call per question, run in parallel."""
    return await generate_quiz_batch(request)


@router.post("/chat")
async def chat(request: ChatRequest):
    """AI Q&A: answers student questions using RAG context, adjusted for level."""
    import time

    start_time = time.time()
    logger.info(f"[CHAT] Received question: '{request.question[:100]}...', level={request.level}, topic_id={request.topic_id}")

    if not runtime.llm_available(runtime.llm_explain):
        runtime.raise_ai_unavailable()

    # RAG retrieval
    context = ""
    sources = []
    if runtime.retriever and runtime.vector_db:
        try:
            query = request.question
            if request.topic_id:
                query = f"{request.topic_id} {request.question}"

            hits = runtime.vector_db.search(
                query,
                k=RAG_TOP_K_DOCS,
                return_scores=True,
                allowed_document_ids=request.allowed_document_ids,
                allowed_scopes=request.allowed_scopes,
                min_score=RAG_SIMILARITY_THRESHOLD,
            )
            context_parts = []
            for score, chunk in hits:
                context_parts.append(chunk["text"])
                meta = chunk.get("metadata", {})
                sources.append({
                    "document_id": str(meta.get("document_id", "")),
                    "file_name": meta.get("source_file", "unknown"),
                    "snippet": chunk["text"][:200]
                })
            context = "\n\n".join(context_parts)
        except Exception as e:
            logger.error(f"[CHAT] RAG retrieval error: {e}")
            context = ""

    # Build conversation context from history
    conversation_context = ""
    if request.history:
        recent = request.history[-CHAT_MAX_HISTORY:]
        conversation_context = "\n".join(
            f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
            for msg in recent
        )

    # Build prompt
    level_instruction = {
        "beginner": "Giải thích bằng ngôn ngữ đơn giản, ngắn gọn, dùng ví dụ dễ hiểu. Dùng tiếng Việt.",
        "intermediate": "Giải thích rõ ràng với ví dụ minh hoạ. Có thể dùng thuật ngữ chuyên môn cơ bản. Dùng tiếng Việt.",
        "advanced": "Giải thích chi tiết, chuyên sâu, có ví dụ nâng cao và so sánh. Dùng tiếng Việt."
    }.get(request.level, "Giải thích rõ ràng, dùng tiếng Việt.")

    prompt = f"""Bạn là gia sư AI hỗ trợ học tiếng Anh. {level_instruction}

Tài liệu tham khảo:
{context if context else "Không có tài liệu cụ thể."}

{f"Lịch sử hội thoại gần đây:{chr(10)}{conversation_context}" if conversation_context else ""}

Câu hỏi của học sinh: {request.question}

Hãy trả lời chính xác dựa trên tài liệu tham khảo. Nếu không tìm thấy thông tin trong tài liệu, hãy nói rõ và cung cấp kiến thức chung."""

    answer = runtime.llm_explain.generate(prompt)
    if not answer:
        return {
            "answer": "AI server không khả dụng. Vui lòng thử lại sau.",
            "sources": sources[:3],
        }

    total_duration = time.time() - start_time
    logger.info(f"[CHAT] Response generated in {total_duration:.3f}s")

    return {
        "answer": answer,
        "sources": sources[:3]  # Return top 3 sources
    }
