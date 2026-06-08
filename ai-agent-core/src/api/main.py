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


def _validate_runtime_config() -> None:
    """Validate critical runtime configuration and fail fast on invalid setup."""
    faiss_index_path = os.getenv("FAISS_INDEX_PATH") or "models/vector_db/faiss_index"
    faiss_dir = os.path.dirname(faiss_index_path) or "."
    os.makedirs(faiss_dir, exist_ok=True)

    if not os.path.isdir(faiss_dir):
        raise RuntimeError(f"Invalid FAISS index directory: {faiss_dir}")

    quiz_endpoint = os.getenv("QUIZ_LLM_ENDPOINT")
    explain_endpoint = os.getenv("EXPLAIN_LLM_ENDPOINT")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    # If no custom endpoint is provided, OpenRouter key is mandatory.
    if not quiz_endpoint and not openrouter_key:
        raise RuntimeError(
            "Missing OPENROUTER_API_KEY for QUIZ LLM. "
            "Set QUIZ_LLM_ENDPOINT for custom server or provide OPENROUTER_API_KEY."
        )

    if not explain_endpoint and not openrouter_key:
        raise RuntimeError(
            "Missing OPENROUTER_API_KEY for EXPLAIN LLM. "
            "Set EXPLAIN_LLM_ENDPOINT for custom server or provide OPENROUTER_API_KEY."
        )


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_db, retriever, llm_quiz, llm_explain, ingestor

    logger.info("Starting EduBoost AI Agent...")

    # 0. Validate startup config
    _validate_runtime_config()

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
    document_id: str
    scope: str  # "class" | "student" | "system"
    text: Optional[str] = None
    file_url: Optional[str] = None
    class_id: Optional[str] = None
    owner_id: Optional[str] = None
    topic_id: Optional[str] = None


class DeleteRequest(BaseModel):
    document_id: str


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 5
    allowed_document_ids: Optional[list[str]] = None
    allowed_scopes: Optional[list[str]] = None


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
    allowed_document_ids: Optional[list[str]] = None
    allowed_scopes: Optional[list[str]] = None


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
    if not ingestor or not vector_db:
        raise HTTPException(503, "Ingestor or VectorDB not initialized")

    # Clean up existing chunks for this document first to avoid duplication
    vector_db.delete_document_chunks(request.document_id)

    full_text = ""
    source_name = request.document_id

    # Extract text from url or use raw text
    if request.file_url:
        try:
            import requests
            import tempfile
            logger.info("Downloading file for RAG ingestion: %s", request.file_url)
            response = requests.get(request.file_url, timeout=30)
            response.raise_for_status()

            parsed_url = request.file_url.split('?')[0]
            ext = os.path.splitext(parsed_url)[1].lower() or ".txt"
            source_name = os.path.basename(parsed_url)

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name

            try:
                reader = DocumentReader()
                full_text = reader.load_document(tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception as cleanup_error:
                    logger.warning("Failed to delete temporary file %s: %s", tmp_path, cleanup_error)
        except Exception as e:
            logger.error("Error downloading or parsing document for RAG: %s", e)
            raise HTTPException(500, f"Failed to download or parse document: {str(e)}")
    elif request.text:
        full_text = request.text
    else:
        raise HTTPException(400, "Either text or file_url must be provided")

    if not full_text.strip():
        return {"status": "ok", "chunks_added": 0, "message": "Document has no content"}

    # Form metadata
    metadata = {
        "document_id": request.document_id,
        "scope": request.scope,
        "class_id": request.class_id,
        "owner_id": request.owner_id,
        "topic_id": request.topic_id,
    }

    # Chunk & Ingest
    chunks_added = ingestor.ingest_text_with_metadata(
        text=full_text,
        source_file=source_name,
        metadata=metadata
    )

    return {"status": "ok", "chunks_added": chunks_added}


@app.post("/rag/delete")
async def delete_document(request: DeleteRequest):
    if not vector_db:
        raise HTTPException(503, "VectorDB not initialized")
    vector_db.delete_document_chunks(request.document_id)
    return {"status": "ok", "message": f"Successfully deleted chunks for document {request.document_id}"}


@app.post("/rag/retrieve")
async def retrieve_context(request: RetrieveRequest):
    if not vector_db:
        raise HTTPException(503, "VectorDB not initialized")
    results = vector_db.search(
        request.query,
        k=request.top_k,
        allowed_document_ids=request.allowed_document_ids,
        allowed_scopes=request.allowed_scopes
    )
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

    if not llm_quiz:
        logger.error("[QUIZ-GEN] Error: Quiz LLM manager is not initialized!")
        raise HTTPException(503, "LLM not initialized")

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if retriever:
        logger.info(f"[QUIZ-GEN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = retriever.get_context(
                topic_name,
                allowed_document_ids=allowed_doc_ids_list,
                allowed_scopes=allowed_scopes_list
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(
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

    if not llm_explain:
        logger.error("[EXPLAIN] Error: Explanation LLM manager is not initialized!")
        raise HTTPException(503, "LLM not initialized")

    # Step 2: RAG Context Retrieval
    context = ""
    retrieval_start = time.time()
    if retriever:
        logger.info(f"[EXPLAIN][STEP 2] Launching RAG context retrieval for topic '{topic_name}'...")
        try:
            context = retriever.get_context(
                topic_name,
                allowed_document_ids=allowed_doc_ids_list,
                allowed_scopes=allowed_scopes_list
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(
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
            context = retriever.get_context(
                request.question,
                allowed_document_ids=request.allowed_document_ids,
                allowed_scopes=request.allowed_scopes
            )
            
            # Log specific retrieved document chunks details by executing a search behind the scenes for rich logs
            if vector_db:
                hits = vector_db.search(
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
    num_easy: int = 0
    num_medium: int = 0
    num_hard: int = 0


class ChatRequest(BaseModel):
    question: str
    topic_id: Optional[str] = None
    level: str = "intermediate"
    history: list = []
    allowed_document_ids: Optional[list[str]] = None
    allowed_scopes: Optional[list[str]] = None


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
                full_text = reader.load_document(tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception as cleanup_error:
                    logger.warning("Failed to delete temporary file %s: %s", tmp_path, cleanup_error)

            # Chunk document using SemanticTextSplitter (reuse embed_model from VectorDB if available)
            embed_model = vector_db.embed_model if vector_db else None
            splitter = SemanticTextSplitter(
                embed_model=embed_model,
                percentile_threshold=75,
                min_chunk_size=50,
                max_chunk_size=600,
            )
            doc_chunks = splitter.split_text(full_text, source_file=parsed_url)
            logger.info("Split document into %d semantic chunks", len(doc_chunks))

            # Select top-6 chunks most relevant to the topic via cosine similarity
            if doc_chunks and embed_model:
                import torch
                from sentence_transformers import util as st_util
                topic_emb = embed_model.encode(request.topic_name, convert_to_tensor=True)
                chunk_texts = [c["text"] for c in doc_chunks]
                chunk_embs = embed_model.encode(chunk_texts, convert_to_tensor=True)
                scores = st_util.cos_sim(topic_emb, chunk_embs)[0]
                top_k = min(6, len(doc_chunks))
                top_indices = sorted(torch.topk(scores, top_k).indices.tolist())
                context = "\n\n".join(doc_chunks[i]["text"] for i in top_indices)
                logger.info(
                    "Selected top-%d relevant chunks for topic '%s' (chunk indices: %s)",
                    top_k, request.topic_name, top_indices,
                )
            else:
                # Fallback: concatenate first 6 chunks when embed_model unavailable
                context = "\n\n".join(c["text"] for c in doc_chunks[:min(6, len(doc_chunks))])
                logger.info("Embed model unavailable — using first 6 chunks as context fallback")
        except Exception as e:
            logger.error("Error downloading or parsing document from URL: %s", e)
            raise HTTPException(500, f"Failed to download or parse document: {str(e)}")

    # Resolve difficulty counts
    num_easy = request.num_easy
    num_medium = request.num_medium
    num_hard = request.num_hard

    # Fallback to defaults if no specific counts are set
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

    import re
    unique_questions = []
    seen_questions = set()
    PROHIBITED_EXAMPLES = {
        "thechildrenplayinginthegardenwhenitstartedtorain",
        "sheisanexpertinthefieldofartificialintelligence"
    }
    
    max_attempts = 3
    attempt = 0
    
    while len(unique_questions) < total_questions and attempt < max_attempts:
        attempt += 1
        
        # Calculate how many questions of each difficulty we still need
        current_easy_count = sum(1 for q in unique_questions if q["difficulty"] == "easy")
        current_medium_count = sum(1 for q in unique_questions if q["difficulty"] == "medium")
        current_hard_count = sum(1 for q in unique_questions if q["difficulty"] == "hard")
        
        needed_easy = max(0, num_easy - current_easy_count)
        needed_medium = max(0, num_medium - current_medium_count)
        needed_hard = max(0, num_hard - current_hard_count)
        needed_total = needed_easy + needed_medium + needed_hard
        
        if needed_total == 0:
            break
            
        logger.info(
            "[QUIZ-BATCH] Attempt %d/%d: Generating %d questions (Easy: %d, Medium: %d, Hard: %d)",
            attempt, max_attempts, needed_total, needed_easy, needed_medium, needed_hard
        )
        
        # If we already have some questions, instruct the LLM to avoid them to prevent duplication
        avoid_instruction = ""
        if unique_questions:
            existing_texts = [q["question"] for q in unique_questions]
            avoid_instruction = (
                f"\nDO NOT generate any of the following questions that were already created:\n"
                + "\n".join(f"- {txt}" for txt in existing_texts)
            )
            
        # Format the prompt for this attempt
        prompt = PromptTemplates.BATCH_QUIZ_TEMPLATE.format(
            topic=request.topic_name,
            difficulty=request.difficulty,
            context=context or "No document context provided.",
            user_prompt=(request.user_prompt or "None.") + avoid_instruction,
            num_questions=needed_total,
            num_easy=needed_easy,
            num_medium=needed_medium,
            num_hard=needed_hard
        )
        
        # Call QUIZ LLM and extract parsed JSON
        result = llm_quiz.generate_json(prompt)
        
        if "error" in result:
            logger.warning("[QUIZ-BATCH] LLM JSON generation error in attempt %d: %s", attempt, result.get("error"))
            continue
            
        # Extract the 'questions' list from the root object
        questions_raw = result.get("questions")
        if not isinstance(questions_raw, list):
            if isinstance(result, list):
                questions_raw = result
            else:
                logger.warning("[QUIZ-BATCH] Unexpected JSON shape in attempt %d: %s", attempt, str(result)[:200])
                continue
                
        # Validate and sanitize each question from this batch
        for q in questions_raw:
            if not isinstance(q, dict):
                continue
                
            question_text = q.get("question", "")
            options = q.get("options", [])
            explanation = q.get("explanation", "")
            diff_level = str(q.get("difficulty", request.difficulty)).strip().lower()
            
            # Match/normalize difficulty level to easy/medium/hard
            if diff_level not in ["easy", "medium", "hard"]:
                # Default to whatever difficulty was targeted in prompt
                if needed_easy > 0:
                    diff_level = "easy"
                elif needed_medium > 0:
                    diff_level = "medium"
                else:
                    diff_level = "hard"
            
            if not question_text:
                continue
                
            # Skip example questions copied from the prompt
            norm_text_check = re.sub(r'[^a-zA-Z0-9]', '', question_text.lower())
            if norm_text_check in PROHIBITED_EXAMPLES:
                logger.info("[QUIZ-BATCH] Skipped example question copied from prompt: %s", question_text)
                continue
                
            if not isinstance(options, list) or len(options) != 4:
                continue
                
            sanitized_options = []
            for opt in options:
                if not isinstance(opt, dict):
                    continue
                sanitized_options.append({
                    "text": opt.get("text", ""),
                    "isCorrect": bool(opt.get("isCorrect", False))
                })
                
            correct_count = sum(1 for opt in sanitized_options if opt.get("isCorrect") is True)
            if correct_count != 1:
                continue
                
            # Deduplicate questions by normalized question text (lowercase, alphanumeric characters only)
            norm_q = re.sub(r'[^a-zA-Z0-9]', '', question_text.lower())
            if norm_q not in seen_questions:
                seen_questions.add(norm_q)
                unique_questions.append({
                    "question": question_text,
                    "type": q.get("type", "mcq"),
                    "difficulty": diff_level,
                    "options": sanitized_options,
                    "explanation": explanation,
                })
            else:
                logger.info("[QUIZ-BATCH] Attempt %d: Filtered duplicate question: %s", attempt, question_text)

    # Post-generation layout balancing/trimming: match the requested counts exactly
    final_questions = []
    easy_questions = [q for q in unique_questions if q["difficulty"] == "easy"]
    medium_questions = [q for q in unique_questions if q["difficulty"] == "medium"]
    hard_questions = [q for q in unique_questions if q["difficulty"] == "hard"]
    
    final_questions.extend(easy_questions[:num_easy])
    final_questions.extend(medium_questions[:num_medium])
    final_questions.extend(hard_questions[:num_hard])
    
    # If we are still short of total_questions (e.g. LLM mislabeled difficulties), fill in with any remaining unique questions
    if len(final_questions) < total_questions:
        used_ids = {id(q) for q in final_questions}
        for q in unique_questions:
            if id(q) not in used_ids and len(final_questions) < total_questions:
                final_questions.append(q)
                
    logger.info(
        "[QUIZ-BATCH] Final batch generated: %d questions (Requested total: %d, Easy: %d/%d, Medium: %d/%d, Hard: %d/%d)",
        len(final_questions),
        total_questions,
        sum(1 for q in final_questions if q["difficulty"] == "easy"), num_easy,
        sum(1 for q in final_questions if q["difficulty"] == "medium"), num_medium,
        sum(1 for q in final_questions if q["difficulty"] == "hard"), num_hard
    )
    
    if not final_questions:
        raise HTTPException(
            500,
            "LLM failed to generate any questions that passed schema validation. "
            "Please check context and prompt instructions."
        )

    return {"questions": final_questions}


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

            hits = vector_db.search(
                request.question,
                k=5,
                return_scores=True,
                allowed_document_ids=request.allowed_document_ids,
                allowed_scopes=request.allowed_scopes
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
