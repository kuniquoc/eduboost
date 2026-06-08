# src/api/main.py
#
# FastAPI application for the EduBoost AI Agent.
# Exposes endpoints for RAG, adaptive tutoring, quiz generation, and grading.

import os
import re
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
from src.rag.text_splitters import SemanticTextSplitter, SlidingWindowTextSplitter
from src.rag.document_reader import DocumentReader
from src.core.orchestrator import AgentOrchestrator
from src.core.config import CHAT_MAX_HISTORY, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K_DOCS
from src.adapters.llm_manager import LLMManager, AI_UNAVAILABLE_MSG
from src.adapters.prompt_templates import PromptTemplates
from src.api.session_store import get_or_create_agent as load_or_create_agent, update_agent

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

def get_or_create_agent(student_id: str) -> AgentOrchestrator:
    return load_or_create_agent(student_id, lambda: AgentOrchestrator(student_id))


def _validate_runtime_config() -> None:
    """Validate critical runtime configuration and fail fast on invalid setup."""
    faiss_index_path = os.getenv("FAISS_INDEX_PATH") or "models/vector_db/faiss_index"
    faiss_dir = os.path.dirname(faiss_index_path) or "."
    os.makedirs(faiss_dir, exist_ok=True)

    if not os.path.isdir(faiss_dir):
        raise RuntimeError(f"Invalid FAISS index directory: {faiss_dir}")


def _llm_available(llm: Optional[LLMManager]) -> bool:
    return llm is not None and llm.is_available


def _raise_ai_unavailable() -> None:
    raise HTTPException(503, AI_UNAVAILABLE_MSG)


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

    # 2. LLM Managers (custom endpoint → OpenAI fallback → unavailable)
    llm_quiz = LLMManager.from_role("quiz")
    if _llm_available(llm_quiz):
        logger.info("Quiz LLM available at: %s (model=%s)", llm_quiz.endpoint_url, llm_quiz.model)
    else:
        logger.warning("Quiz LLM unavailable — set QUIZ_LLM_ENDPOINT or OPENAI_API_KEY")

    llm_explain = LLMManager.from_role("explain")
    if _llm_available(llm_explain):
        logger.info("Explain LLM available at: %s (model=%s)", llm_explain.endpoint_url, llm_explain.model)
    else:
        logger.warning("Explain LLM unavailable — set EXPLAIN_LLM_ENDPOINT or OPENAI_API_KEY")

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

def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
    if raw.strip() == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


_cors_origins = _parse_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
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
    return {
        "status": "healthy",
        "chunks": len(vector_db.metadata) if vector_db else 0,
        "llm": {
            "quiz": _llm_available(llm_quiz),
            "explain": _llm_available(llm_explain),
        },
    }


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
    update_agent(request.student_id, agent)
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

    if not _llm_available(llm_quiz):
        logger.warning("[QUIZ-GEN] Quiz LLM unavailable")
        _raise_ai_unavailable()

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
    result = llm_quiz.generate_json(prompt)

    llm_duration = time.time() - llm_start
    logger.info(f"[QUIZ-GEN][STEP 4] Quiz LLM responded in {llm_duration:.3f}s")

    # Step 5: Process and Log Output
    if not result or "error" in result:
        logger.warning(f"[QUIZ-GEN][STEP 5] LLM unavailable or invalid response: {result.get('error') if result else 'empty'}")
        _raise_ai_unavailable()

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

    if not _llm_available(llm_explain):
        logger.warning("[EXPLAIN] Explanation LLM unavailable")
        _raise_ai_unavailable()

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
    explanation = llm_explain.generate(prompt)
    if not explanation:
        logger.warning("[EXPLAIN][STEP 4] LLM call returned no content")
        _raise_ai_unavailable()

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

    if not _llm_available(llm_explain):
        logger.warning("[GRADER-RAG] Explanation LLM unavailable")
        _raise_ai_unavailable()

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
    explanation = llm_explain.generate(prompt)
    if not explanation:
        logger.warning("[GRADER-RAG][STEP 4] LLM call returned no content")
        _raise_ai_unavailable()

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
    document_id: Optional[str] = None
    num_questions: int = 5
    difficulty: str = "medium"
    num_easy: int = 0
    num_medium: int = 0
    num_hard: int = 0
    existing_questions: list[str] = []


_DOC_CONTEXT_MAX_CHARS = 50_000


def _split_context_blob(context: str) -> list[str]:
    """Split a joined context string into chunks for per-question rotation."""
    if not context.strip():
        return []
    parts = [p.strip() for p in context.split("\n\n") if p.strip()]
    return parts if parts else [context.strip()]


def _load_quiz_context_from_rag(topic_name: str, document_id: str) -> list[str]:
    """Load document context chunks from FAISS when the document was already ingested."""
    if not retriever:
        return []
    try:
        context = retriever.get_context(
            topic_name,
            allowed_document_ids=[document_id],
        )
        if context and "No specific textbook context available" not in context:
            logger.info("[QUIZ-BATCH] Loaded context from RAG for document_id=%s", document_id)
            return _split_context_blob(context)
    except Exception as e:
        logger.warning("[QUIZ-BATCH] RAG context lookup failed for document_id=%s: %s", document_id, e)
    return []


def _rank_document_chunks(full_text: str, source_file: str, topic_name: str) -> list[str]:
    """Split document text and return top relevant chunk texts for quiz context."""
    if not full_text.strip():
        return []

    if len(full_text) > _DOC_CONTEXT_MAX_CHARS:
        full_text = full_text[:_DOC_CONTEXT_MAX_CHARS]
        logger.info("[QUIZ-BATCH] Truncated document to %d chars", _DOC_CONTEXT_MAX_CHARS)

    embed_model = vector_db.embed_model if vector_db else None
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

            topic_emb = embed_model.encode(topic_name, convert_to_tensor=True)
            chunk_texts = [c["text"] for c in doc_chunks]
            chunk_embs = embed_model.encode(chunk_texts, convert_to_tensor=True)
            scores = st_util.cos_sim(topic_emb, chunk_embs)[0]
            top_k = min(6, len(doc_chunks))
            top_indices = sorted(torch.topk(scores, top_k).indices.tolist())
            logger.info("[QUIZ-BATCH] Selected top-%d relevant chunks for topic '%s'", top_k, topic_name)
            return [doc_chunks[i]["text"] for i in top_indices]
        except Exception as e:
            logger.warning("[QUIZ-BATCH] Chunk ranking failed, using first 6 chunks: %s", e)

    return [c["text"] for c in doc_chunks[: min(6, len(doc_chunks))]]


def _load_quiz_context_from_doc_url(doc_url: str, topic_name: str) -> list[str]:
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

        return _rank_document_chunks(full_text, parsed_url, topic_name)
    except Exception as e:
        logger.warning("[QUIZ-BATCH] Document parse/chunk failed (continuing without doc context): %s", e)
        return []
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception as cleanup_error:
                logger.warning("Failed to delete temporary file %s: %s", tmp_path, cleanup_error)


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


_QUIZ_AVOID_LIST_CAP = 40
_QUIZ_AVOID_COMPLETED_RECENT = 20


def _build_avoid_texts(completed: list[dict], rejected: list[str]) -> list[str]:
    all_texts = [q["question"] for q in completed] + rejected
    if len(all_texts) <= _QUIZ_AVOID_LIST_CAP:
        return all_texts
    recent_completed = [q["question"] for q in completed[-_QUIZ_AVOID_COMPLETED_RECENT:]]
    merged = recent_completed + rejected
    seen: set[str] = set()
    result: list[str] = []
    for text in merged:
        if text not in seen:
            seen.add(text)
            result.append(text)
    return result


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

    return {
        "question": question_text,
        "type": "mcq",
        "difficulty": difficulty_label,
        "options": sanitized_options,
        "explanation": explanation,
    }


# Difficulty → IRT Beta mapping for single-question QUIZ_TEMPLATE
_DIFFICULTY_TO_BETA = {
    "easy": -1.5,
    "medium": 0.0,
    "hard": 1.5,
}


@app.post("/tutor/generate-quiz")
async def generate_quiz_batch(request: GenerateQuizBatchRequest):
    """Generates multiple quiz questions — one LLM call per question, run in parallel."""
    if not _llm_available(llm_quiz):
        _raise_ai_unavailable()

    # ── Step 1: Load document context chunks (RAG first, then doc_url fallback) ─
    context_chunks: list[str] = []
    if request.document_id:
        context_chunks = _load_quiz_context_from_rag(request.topic_name, request.document_id)

    if not context_chunks and request.doc_url:
        context_chunks = _load_quiz_context_from_doc_url(request.doc_url, request.topic_name)

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
        user_hint = (request.user_prompt or "") + avoid_block + retry_suffix

        if context_chunks:
            chunk = context_chunks[slot_index % len(context_chunks)]
            ctx = f"FOCUS EXCERPT (generate question ONLY from this section):\n{chunk}"
        else:
            ctx = "No document context provided."
        if user_hint.strip():
            ctx += f"\n\nADDITIONAL INSTRUCTIONS:\n{user_hint}"

        prompt = PromptTemplates.QUIZ_TEMPLATE.format(
            topic=request.topic_name,
            difficulty=beta,
            context=ctx,
        )
        temp_idx = min(attempt - 1, len(_QUIZ_RETRY_TEMPERATURES) - 1)
        temperature = _QUIZ_RETRY_TEMPERATURES[temp_idx]
        result = llm_quiz.generate_json(prompt, max_tokens=1024, temperature=temperature)
        if "error" in result:
            logger.warning(
                "[QUIZ-BATCH] LLM error for difficulty=%s (attempt=%d, temp=%.2f): %s",
                difficulty_label, attempt, temperature, result.get("error"),
            )
            return None
        return result

    # ── Step 4: Generate all questions (semaphore-limited), with per-question retry ─
    final_questions: list[dict] = []

    # Run all question generations sequentially (single-GPU server cannot handle
    # concurrent inference — requests would collide on GPU and cause 500 errors).
    # asyncio.Semaphore(1) = one at a time, but written in a way that's easy to
    # increase if the backend is ever upgraded to a batching server (e.g. vLLM).
    MAX_CONCURRENT = 1
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
        _raise_ai_unavailable()

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

    if not _llm_available(llm_explain):
        return {
            "answer": "AI server không khả dụng. Vui lòng thử lại sau.",
            "sources": [],
        }

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

    answer = llm_explain.generate(prompt)
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


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
