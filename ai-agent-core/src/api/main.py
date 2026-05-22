# src/api/main.py
#
# FastAPI application for the EduBoost AI Agent.
# Exposes endpoints for RAG, adaptive tutoring, quiz generation, and grading.

import os
import sys
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure project root is on sys.path so relative imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.rag.vector_db import VectorDB
from src.rag.retriever import KnowledgeRetriever
from src.rag.ingest import RAGIngestor
from src.rag.semantic_chunker import SemanticTextSplitter
from src.core.orchestrator import AgentOrchestrator
from src.adapters.llm_manager import LLMManager
from src.adapters.prompt_templates import PromptTemplates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global singletons (initialized at startup)
# ---------------------------------------------------------------------------
vector_db: Optional[VectorDB] = None
retriever: Optional[KnowledgeRetriever] = None
llm: Optional[LLMManager] = None
ingestor: Optional[RAGIngestor] = None

# In-memory agent sessions keyed by student_id
agent_sessions: dict[str, AgentOrchestrator] = {}


def get_or_create_agent(student_id: str) -> AgentOrchestrator:
    if student_id not in agent_sessions:
        agent_sessions[student_id] = AgentOrchestrator(student_id)
    return agent_sessions[student_id]


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global vector_db, retriever, llm, ingestor

    logger.info("Starting EduBoost AI Agent...")

    # 1. VectorDB + Retriever
    vector_db = VectorDB()
    retriever = KnowledgeRetriever(vector_db)

    # 2. LLM Manager (OpenRouter)
    llm = LLMManager()

    # 3. Ingestor (reuses VectorDB's embedding model)
    ingestor = RAGIngestor(vector_db)

    # 4. Auto-ingest data/raw/ if the FAISS index is empty
    if len(vector_db.metadata) == 0:
        raw_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
        if os.path.isdir(raw_dir):
            logger.info("FAISS index is empty — ingesting data/raw/ ...")
            ingestor.process_directory(raw_dir)
            logger.info("Ingestion complete. %d chunks stored.", len(vector_db.metadata))

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
    """Generates an adaptive quiz question using RAG context + LLM."""
    if not llm or not retriever:
        raise HTTPException(503, "LLM or Retriever not initialized")

    # Retrieve relevant context
    context = retriever.get_context(topic_name)

    # Build prompt
    prompt = PromptTemplates.QUIZ_TEMPLATE.format(
        topic=topic_name,
        difficulty=difficulty,
        context=context,
    )

    # Generate quiz question as JSON
    result = llm.generate_json(prompt)

    # Ensure required fields exist
    if "error" in result:
        raise HTTPException(500, f"LLM failed to generate quiz: {result.get('error')}")

    return {
        "question": result.get("question", ""),
        "options": result.get("options", {}),
        "correct_answer": result.get("correct_answer", ""),
        "explanation": result.get("explanation", ""),
        "difficulty_level": result.get("difficulty_level", difficulty),
    }


@app.get("/tutor/explain")
async def explain_topic(topic_name: str, student_state: str = "beginning"):
    """Generates a Socratic explanation using RAG context + LLM."""
    if not llm or not retriever:
        raise HTTPException(503, "LLM or Retriever not initialized")

    context = retriever.get_context(topic_name)

    prompt = PromptTemplates.EXPLANATION_TEMPLATE.format(
        topic=topic_name,
        context=context,
        student_state=student_state,
    )

    explanation = llm.generate(prompt)
    return {"explanation": explanation}


@app.post("/tutor/explain-error")
async def grade_answer(request: GraderRequest):
    """Analyzes a wrong answer and explains the knowledge gap."""
    if not llm:
        raise HTTPException(503, "LLM not initialized")

    prompt = PromptTemplates.GRADER_TEMPLATE.format(
        question=request.question,
        correct_answer=request.correct_answer,
        student_answer=request.student_answer,
    )

    explanation = llm.generate(prompt)
    return {"explanation": explanation}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
