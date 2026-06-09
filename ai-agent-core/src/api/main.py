# src/api/main.py
#
# FastAPI application for the EduBoost AI Agent.
# Exposes endpoints for RAG, adaptive tutoring, quiz generation, and grading.

import os
import sys
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables FIRST
load_dotenv()

# Ensure project root is on sys.path so relative imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.rag.vector_db import VectorDB
from src.rag.retriever import KnowledgeRetriever
from src.rag.ingest import RAGIngestor
from src.adapters.llm_manager import LLMManager
from src.api.app_state import runtime
from src.api.routes import health as health_routes
from src.api.routes import rag as rag_routes
from src.api.routes import tutor as tutor_routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _validate_runtime_config() -> None:
    """Validate critical runtime configuration and fail fast on invalid setup."""
    faiss_index_path = os.getenv("FAISS_INDEX_PATH") or "models/vector_db/faiss_index"
    faiss_dir = os.path.dirname(faiss_index_path) or "."
    os.makedirs(faiss_dir, exist_ok=True)

    if not os.path.isdir(faiss_dir):
        raise RuntimeError(f"Invalid FAISS index directory: {faiss_dir}")


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("Starting EduBoost AI Agent...")

    # 0. Validate startup config
    _validate_runtime_config()

    # 1. Initialize RAG components (VectorDB / Retriever / Ingestor)
    try:
        model_name = os.getenv("EMBEDDING_MODEL") or "sentence-transformers/all-MiniLM-L6-v2"
        index_path = os.getenv("FAISS_INDEX_PATH") or "models/vector_db/faiss_index"

        logger.info(f"[STARTUP] Initializing VectorDB using model '{model_name}' and index path '{index_path}'...")
        runtime.vector_db = VectorDB(model_name=model_name, index_path=index_path)
        logger.info(f"[STARTUP] VectorDB initialized successfully. Total chunks indexed: {len(runtime.vector_db.chunks)}")

        logger.info("[STARTUP] Initializing KnowledgeRetriever...")
        runtime.retriever = KnowledgeRetriever(runtime.vector_db)

        logger.info("[STARTUP] Initializing RAGIngestor...")
        runtime.ingestor = RAGIngestor(runtime.vector_db)

        # Auto-ingestion check: Ingest raw documents if VectorDB is empty
        total_chunks = len(runtime.vector_db.chunks)
        if total_chunks == 0:
            logger.info("[STARTUP] VectorDB is empty. Scanning 'data/raw/' for auto-ingestion...")
            raw_dir = "data/raw"
            if os.path.exists(raw_dir):
                runtime.ingestor.process_directory(raw_dir)
                logger.info(f"[STARTUP] Auto-ingestion complete. VectorDB total chunks: {len(runtime.vector_db.chunks)}")
            else:
                logger.warning(f"[STARTUP] Raw directory '{raw_dir}' does not exist. Skipping auto-ingestion.")
        else:
            logger.info(f"[STARTUP] VectorDB already has {total_chunks} chunks loaded. Skipping auto-ingestion.")

    except Exception as e:
        logger.error(f"[STARTUP] Critical error initializing RAG components: {e}", exc_info=True)
        runtime.vector_db = None
        runtime.retriever = None
        runtime.ingestor = None
        logger.warning("[STARTUP] Falling back to LLM-only mode (RAG disabled).")

    # 2. LLM Managers (custom endpoint → OpenAI fallback → unavailable)
    runtime.llm_quiz = LLMManager.from_role("quiz")
    if runtime.llm_available(runtime.llm_quiz):
        logger.info("Quiz LLM available at: %s (model=%s)", runtime.llm_quiz.endpoint_url, runtime.llm_quiz.model)
    else:
        logger.warning("Quiz LLM unavailable — set QUIZ_LLM_ENDPOINT or OPENAI_API_KEY")

    runtime.llm_explain = LLMManager.from_role("explain")
    if runtime.llm_available(runtime.llm_explain):
        logger.info("Explain LLM available at: %s (model=%s)", runtime.llm_explain.endpoint_url, runtime.llm_explain.model)
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

app.include_router(health_routes.router)
app.include_router(rag_routes.router)
app.include_router(tutor_routes.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
