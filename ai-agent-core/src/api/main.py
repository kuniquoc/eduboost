# src/api/main.py
#
# FastAPI application for the EduBoost AI Agent.
# Exposes endpoints for RAG, adaptive tutoring, quiz generation, and grading.

import os
import sys
import logging
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables FIRST
load_dotenv()

# Ensure project root is on sys.path so relative imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.rag.vector_db import VectorDB
from src.rag.retriever import KnowledgeRetriever
from src.rag.ingest import RAGIngestor
from src.rag.text_splitters import SemanticTextSplitter
from src.rag.document_reader import DocumentReader
from src.core.orchestrator import AgentOrchestrator
from src.adapters.llm_manager import LLMManager
from src.adapters.prompt_templates import PromptTemplates
from src.core.spaced_repetition import SpacedRepetitionEngine
from src.core.entry_test import AdaptiveEntryTest, EntryTestState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global singletons (initialized at startup)
# ---------------------------------------------------------------------------
vector_db: Optional[VectorDB] = None
retriever: Optional[KnowledgeRetriever] = None
llm_quiz: Optional[LLMManager] = None
llm_explain: Optional[LLMManager] = None
ingestor: Optional[RAGIngestor] = None

# In-memory agent sessions keyed by student_id
agent_sessions: dict[str, AgentOrchestrator] = {}

# In-memory entry test sessions
entry_test_sessions: dict[str, EntryTestState] = {}


def get_or_create_agent(student_id: str) -> AgentOrchestrator:
    if student_id not in agent_sessions:
        agent_sessions[student_id] = AgentOrchestrator(student_id)
    return agent_sessions[student_id]


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_db, retriever, llm_quiz, llm_explain, ingestor

    logger.info("Starting EduBoost AI Agent...")

    # 1. Initialize RAG components (VectorDB / Retriever / Ingestor)
    try:
        model_name = os.getenv("EMBEDDING_MODEL") or "sentence-transformers/all-MiniLM-L6-v2"
        index_path = os.getenv("FAISS_INDEX_PATH") or "models/vector_db/faiss_index"
        
        logger.info(f"[STARTUP] Initializing VectorDB using model '{model_name}' and index path '{index_path}'...")
        vector_db = VectorDB(model_name=model_name, index_path=index_path)
        logger.info(f"[STARTUP] VectorDB initialized successfully. Total chunks indexed: {len(vector_db.chunks)}")
        
        logger.info("[STARTUP] Initializing KnowledgeRetriever...")
        retriever = KnowledgeRetriever(vector_db)
        
        logger.info("[STARTUP] Initializing RAGIngestor...")
        ingestor = RAGIngestor(vector_db)
        
        # Auto-ingestion check: Ingest raw documents if VectorDB is empty
        total_chunks = len(vector_db.chunks)
        if total_chunks == 0:
            logger.info("[STARTUP] VectorDB is empty. Scanning 'data/raw/' for auto-ingestion...")
            raw_dir = "data/raw"
            if os.path.exists(raw_dir):
                ingestor.process_directory(raw_dir)
                logger.info(f"[STARTUP] Auto-ingestion complete. VectorDB total chunks: {len(vector_db.chunks)}")
            else:
                logger.warning(f"[STARTUP] Raw directory '{raw_dir}' does not exist. Skipping auto-ingestion.")
        else:
            logger.info(f"[STARTUP] VectorDB already has {total_chunks} chunks loaded. Skipping auto-ingestion.")
            
    except Exception as e:
        logger.error(f"[STARTUP] Critical error initializing RAG components: {e}", exc_info=True)
        vector_db = None
        retriever = None
        ingestor = None
        logger.warning("[STARTUP] Falling back to LLM-only mode (RAG disabled).")

    # 2. LLM Managers (separate instances for quiz and explanation)
    quiz_endpoint = os.getenv("QUIZ_LLM_ENDPOINT")
    quiz_model = os.getenv("QUIZ_LLM_MODEL")
    llm_quiz = LLMManager(endpoint_url=quiz_endpoint, model=quiz_model)
    logger.info("Quiz LLM initialized at: %s", quiz_endpoint or "default (OpenRouter)")
    
    explain_endpoint = os.getenv("EXPLAIN_LLM_ENDPOINT")
    explain_model = os.getenv("EXPLAIN_LLM_MODEL")
    llm_explain = LLMManager(endpoint_url=explain_endpoint, model=explain_model)
    logger.info("Explanation LLM initialized at: %s", explain_endpoint or "default (OpenRouter)")

    logger.info("EduBoost AI Agent ready.")
    yield
    logger.info("Shutting down EduBoost AI Agent.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EduBoost AI Agent",
    version="1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class IngestRequest(BaseModel):
    text: str
    source: str = "api"


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 5


class UpdateStateRequest(BaseModel):
    student_id: str
    topic_name: str
    difficulty: float
    is_correct: bool


class GenerateQuizRequest(BaseModel):
    topic_name: str
    difficulty: float = 0.0


class ExplainRequest(BaseModel):
    topic_name: str
    student_state: str = "beginning"


class GraderRequest(BaseModel):
    question: str
    correct_answer: str
    student_answer: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "healthy", "chunks": len(vector_db.metadata) if vector_db else 0}


# ---------------------------------------------------------------------------
# RAG endpoints
# ---------------------------------------------------------------------------
@app.post("/rag/ingest")
async def ingest_document(request: IngestRequest):
    if not ingestor:
        raise HTTPException(503, "Ingestor not initialized")

    splitter = SemanticTextSplitter(embed_model=vector_db.embed_model)
    chunks = splitter.split_text(request.text)
    vector_db.add_documents(chunks)
    return {"status": "ok", "chunks_added": len(chunks)}


@app.post("/rag/retrieve")
async def retrieve_context(request: RetrieveRequest):
    if not vector_db:
        raise HTTPException(503, "VectorDB not initialized")
    results = vector_db.search(request.query, k=request.top_k)
    return {"results": results}


# ---------------------------------------------------------------------------
# Agent / Tutor endpoints
# ---------------------------------------------------------------------------
@app.get("/tutor/next-action")
async def get_next_action(student_id: str, topic_name: str):
    """Uses BKT to decide: EXPLAIN, QUIZ, or NEXT_SKILL."""
    agent = get_or_create_agent(student_id)
    result = agent.decide_next_action(topic_name)
    return result


@app.post("/tutor/update-state")
async def update_student_state(request: UpdateStateRequest):
    """Updates BKT + IRT after a student answers a question."""
    agent = get_or_create_agent(request.student_id)
    result = agent.update_student_state(
        request.topic_name, request.difficulty, request.is_correct
    )
    return result


@app.get("/tutor/generate-question")
async def generate_quiz_question(topic_name: str, difficulty: float = 0.0):
    """Generates an adaptive quiz question using RAG context + LLM (Quiz LLM)."""
    import time
    
    start_time = time.time()
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[QUIZ-GEN][STEP 1] Received generate-question request: Topic='{topic_name}', Target Difficulty (Beta)={difficulty}")

    if not llm_quiz:
        logger.error("[QUIZ-GEN] Error: Quiz LLM manager is not initialized!")
        raise HTTPException(503, "LLM not initialized")

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if retriever:
        logger.info(f"[QUIZ-GEN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = retriever.get_context(topic_name)
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(topic_name, k=3, return_scores=True)
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
    logger.info(f"[QUIZ-GEN][STEP 4] Dispatching request to Quiz LLM (Model: '{llm_quiz.model}', Endpoint: '{llm_quiz.endpoint_url}')...")
    llm_start = time.time()
    try:
        result = llm_quiz.generate_json(prompt)
    except Exception as e:
        logger.error(f"[QUIZ-GEN][STEP 4] LLM call failed with exception: {e}", exc_info=True)
        raise HTTPException(500, f"Quiz generation LLM error: {str(e)}")
        
    llm_duration = time.time() - llm_start
    logger.info(f"[QUIZ-GEN][STEP 4] Quiz LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    if "error" in result:
        logger.error(f"[QUIZ-GEN][STEP 5] Extraction error: LLM returned invalid JSON structure or error field: {result.get('error')}")
        raise HTTPException(500, f"LLM failed to generate quiz: {result.get('error')}")

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


@app.get("/tutor/explain")
async def explain_topic(topic_name: str, student_state: str = "beginning"):
    """Generates a Socratic explanation using RAG context + LLM (Explanation LLM)."""
    import time
    
    start_time = time.time()
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[EXPLAIN][STEP 1] Received explain request: Topic='{topic_name}', Student State='{student_state}'")

    if not llm_explain:
        logger.error("[EXPLAIN] Error: Explanation LLM manager is not initialized!")
        raise HTTPException(503, "LLM not initialized")

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if retriever:
        logger.info(f"[EXPLAIN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = retriever.get_context(topic_name)
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(topic_name, k=3, return_scores=True)
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
    logger.info(f"[EXPLAIN][STEP 4] Dispatching request to Explanation LLM (Model: '{llm_explain.model}', Endpoint: '{llm_explain.endpoint_url}')...")
    llm_start = time.time()
    try:
        explanation = llm_explain.generate(prompt)
    except Exception as e:
        logger.error(f"[EXPLAIN][STEP 4] LLM call failed with exception: {e}", exc_info=True)
        raise HTTPException(500, f"Explanation generation LLM error: {str(e)}")
        
    llm_duration = time.time() - llm_start
    logger.info(f"[EXPLAIN][STEP 4] Explanation LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    total_duration = time.time() - start_time
    logger.info(f"[EXPLAIN][STEP 5] Socratic explanation generated successfully in {total_duration:.3f}s!")
    logger.info(f"  - Explanation: \"{explanation[:150]}...\"")
    logger.info("=" * 60)

    return {"explanation": explanation}


@app.post("/tutor/explain-error")
async def grade_answer(request: GraderRequest):
    """Analyzes a wrong answer and explains the knowledge gap (Explanation LLM)."""
    import time
    
    start_time = time.time()
    
    # Step 1: Log receipt of request
    logger.info("=" * 60)
    logger.info(f"[GRADER-RAG][STEP 1] Received explain-error request: Question='{request.question[:80]}...', Correct='{request.correct_answer}', Student='{request.student_answer}'")

    if not llm_explain:
        logger.error("[GRADER-RAG] Error: Explanation LLM manager is not initialized!")
        raise HTTPException(503, "LLM not initialized")

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if retriever:
        # We query the database using the question text to get relevant grammar concepts
        logger.info(f"[GRADER-RAG][STEP 2] Launching RAG context retrieval using question text as query...")
        try:
            context = retriever.get_context(request.question)
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(request.question, k=3, return_scores=True)
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
    logger.info(f"[GRADER-RAG][STEP 4] Dispatching request to Explanation LLM (Model: '{llm_explain.model}', Endpoint: '{llm_explain.endpoint_url}')...")
    llm_start = time.time()
    try:
        explanation = llm_explain.generate(prompt)
    except Exception as e:
        logger.error(f"[GRADER-RAG][STEP 4] LLM call failed with exception: {e}", exc_info=True)
        raise HTTPException(500, f"Grader explanation generation LLM error: {str(e)}")
        
    llm_duration = time.time() - llm_start
    logger.info(f"[GRADER-RAG][STEP 4] Grader LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    total_duration = time.time() - start_time
    logger.info(f"[GRADER-RAG][STEP 5] Grader explanation generated successfully in {total_duration:.3f}s!")
    logger.info(f"  - Explanation: \"{explanation[:150]}...\"")
    logger.info("=" * 60)

    return {"explanation": explanation}


class GenerateQuizBatchRequest(BaseModel):
    topic_name: str
    user_prompt: Optional[str] = None
    doc_url: Optional[str] = None
    num_questions: int = 5
    difficulty: str = "medium"


class ChatRequest(BaseModel):
    question: str
    topic_id: Optional[str] = None
    level: str = "intermediate"
    history: list = []


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class SpacedRepetitionUpdateRequest(BaseModel):
    quality: int  # 0-5
    ease_factor: float = 2.5
    interval: float = 1.0
    repetitions: int = 0


class EntryTestAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    is_correct: bool
    difficulty: str = "medium"
    topic_id: Optional[str] = None


@app.post("/tutor/generate-quiz")
async def generate_quiz_batch(request: GenerateQuizBatchRequest):
    """Generates multiple quiz questions using LLM context or document or user suggestion."""
    if not llm_quiz:
        raise HTTPException(503, "LLM not initialized")

    context = ""
    if request.doc_url:
        try:
            import requests
            import tempfile
            logger.info("Downloading file from: %s", request.doc_url)
            response = requests.get(request.doc_url, timeout=30)
            response.raise_for_status()

            # Extract extension from URL path cleanly
            parsed_url = request.doc_url.split('?')[0]
            ext = os.path.splitext(parsed_url)[1].lower() or ".txt"

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name

            try:
                reader = DocumentReader()
                context = reader.load_document(tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

            # Truncate context to keep LLM calls fast and avoid limit overflow
            context = context[:10000]
            logger.info("Extracted %d characters of context from document", len(context))
        except Exception as e:
            logger.error("Error downloading or parsing document from URL: %s", e)
            raise HTTPException(500, f"Failed to download or parse document: {str(e)}")

    # Construct and format the LLM prompt
    prompt = PromptTemplates.BATCH_QUIZ_TEMPLATE.format(
        topic=request.topic_name,
        difficulty=request.difficulty,
        context=context or "No document context provided.",
        user_prompt=request.user_prompt or "None.",
        num_questions=request.num_questions
    )

    # Call QUIZ LLM and extract parsed JSON
    result = llm_quiz.generate_json(prompt)

    if "error" in result:
        raise HTTPException(500, f"LLM failed to generate quiz JSON: {result.get('error')}")

    # Extract the 'questions' list from the root object
    questions = result.get("questions")
    if not isinstance(questions, list):
        # Fallback in case LLM ignored root object structure and returned raw array or list directly
        if isinstance(result, list):
            return {"questions": result}
        raise HTTPException(500, f"LLM did not return a valid list under 'questions' key: {result}")

    return {"questions": questions}


# ---------------------------------------------------------------------------
# Chat endpoint (AI Q&A with RAG)
# ---------------------------------------------------------------------------
@app.post("/tutor/chat")
async def chat(request: ChatRequest):
    """AI Q&A: answers student questions using RAG context, adjusted for level."""
    import time

    start_time = time.time()
    logger.info(f"[CHAT] Received question: '{request.question[:100]}...', level={request.level}, topic_id={request.topic_id}")

    if not llm_explain:
        raise HTTPException(503, "LLM not initialized")

    # RAG retrieval
    context = ""
    sources = []
    if retriever and vector_db:
        try:
            query = request.question
            if request.topic_id:
                query = f"{request.topic_id} {request.question}"

            hits = vector_db.search(request.question, k=5, return_scores=True)
            context_parts = []
            for score, chunk in hits:
                context_parts.append(chunk["text"])
                meta = chunk.get("metadata", {})
                sources.append({
                    "document_id": meta.get("source_file", ""),
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
        recent = request.history[-5:]  # Last 5 messages
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

    # Call LLM
    try:
        answer = llm_explain.generate(prompt)
    except Exception as e:
        logger.error(f"[CHAT] LLM error: {e}")
        raise HTTPException(500, f"LLM error: {str(e)}")

    total_duration = time.time() - start_time
    logger.info(f"[CHAT] Response generated in {total_duration:.3f}s")

    return {
        "answer": answer,
        "sources": sources[:3]  # Return top 3 sources
    }


# ---------------------------------------------------------------------------
# Spaced Repetition endpoints
# ---------------------------------------------------------------------------
@app.post("/spaced-repetition/update")
async def update_spaced_repetition(request: SpacedRepetitionUpdateRequest):
    """Update spaced repetition parameters after a review."""
    result = SpacedRepetitionEngine.update_after_review(
        quality=request.quality,
        ease_factor=request.ease_factor,
        interval=request.interval,
        repetitions=request.repetitions
    )
    return result


# ---------------------------------------------------------------------------
# Entry Test endpoints
# ---------------------------------------------------------------------------
@app.post("/entry-test/start")
async def start_entry_test():
    """Start a new adaptive entry test session."""
    import uuid
    session_id = str(uuid.uuid4())
    state = AdaptiveEntryTest.get_initial_state()
    entry_test_sessions[session_id] = state
    return {
        "session_id": session_id,
        "current_difficulty": state.current_difficulty,
        "min_questions": AdaptiveEntryTest.MIN_QUESTIONS,
        "max_questions": AdaptiveEntryTest.MAX_QUESTIONS
    }


@app.post("/entry-test/next-question")
async def entry_test_next_question(request: EntryTestAnswerRequest):
    """Record answer and get next question difficulty recommendation."""
    if request.session_id not in entry_test_sessions:
        raise HTTPException(404, "Session not found")

    state = entry_test_sessions[request.session_id]

    # Record the answer
    state = AdaptiveEntryTest.record_answer(
        state=state,
        question_id=request.question_id,
        is_correct=request.is_correct,
        difficulty=request.difficulty,
        topic_id=request.topic_id
    )
    entry_test_sessions[request.session_id] = state

    # Check if test should end
    should_end = AdaptiveEntryTest.should_end_test(state)

    return {
        "should_end": should_end,
        "next_difficulty": state.current_difficulty,
        "questions_answered": state.questions_answered,
        "current_score": state.correct_count / state.questions_answered if state.questions_answered > 0 else 0
    }


@app.post("/entry-test/evaluate")
async def evaluate_entry_test(session_id: str):
    """Evaluate final entry test results."""
    if session_id not in entry_test_sessions:
        raise HTTPException(404, "Session not found")

    state = entry_test_sessions.pop(session_id)
    result = AdaptiveEntryTest.evaluate_result(state)
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
