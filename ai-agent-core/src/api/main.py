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
llm_quiz: Optional[LLMManager] = None
llm_explain: Optional[LLMManager] = None
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
    global vector_db, retriever, llm_quiz, llm_explain, ingestor

    logger.info("Starting EduBoost AI Agent...")

    # 1. NOTE: Temporarily disable RAG (VectorDB / Retriever / Ingestor)
    # Skipping initialization so the processing flow uses LLM-only fallbacks.
    vector_db = None
    retriever = None

    # 2. LLM Managers (separate instances for quiz and explanation)
    quiz_endpoint = os.getenv("QUIZ_LLM_ENDPOINT")
    quiz_model = os.getenv("QUIZ_LLM_MODEL")
    llm_quiz = LLMManager(endpoint_url=quiz_endpoint, model=quiz_model)
    logger.info("Quiz LLM initialized at: %s", quiz_endpoint or "default (OpenRouter)")
    
    explain_endpoint = os.getenv("EXPLAIN_LLM_ENDPOINT")
    explain_model = os.getenv("EXPLAIN_LLM_MODEL")
    llm_explain = LLMManager(endpoint_url=explain_endpoint, model=explain_model)
    logger.info("Explanation LLM initialized at: %s", explain_endpoint or "default (OpenRouter)")

    # 3. Ingestor + auto-ingest skipped while RAG is disabled
    ingestor = None

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
    if not llm_quiz:
        raise HTTPException(503, "LLM not initialized")

    # Retrieve relevant context if Retriever is available, otherwise use empty context
    context = ""
    if retriever:
        context = retriever.get_context(topic_name)

    # Build prompt
    prompt = PromptTemplates.QUIZ_TEMPLATE.format(
        topic=topic_name,
        difficulty=difficulty,
        context=context,
    )

    # Generate quiz question as JSON using QUIZ LLM
    result = llm_quiz.generate_json(prompt)

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
    """Generates a Socratic explanation using RAG context + LLM (Explanation LLM)."""
    if not llm_explain:
        raise HTTPException(503, "LLM not initialized")

    # Use retriever when available; otherwise proceed with empty context
    context = ""
    if retriever:
        context = retriever.get_context(topic_name)

    prompt = PromptTemplates.EXPLANATION_TEMPLATE.format(
        topic=topic_name,
        context=context,
        student_state=student_state,
    )

    explanation = llm_explain.generate(prompt)
    return {"explanation": explanation}


@app.post("/tutor/explain-error")
async def grade_answer(request: GraderRequest):
    """Analyzes a wrong answer and explains the knowledge gap (Explanation LLM)."""
    if not llm_explain:
        raise HTTPException(503, "LLM not initialized")

    prompt = PromptTemplates.GRADER_TEMPLATE.format(
        question=request.question,
        correct_answer=request.correct_answer,
        student_answer=request.student_answer,
    )

    explanation = llm_explain.generate(prompt)
    return {"explanation": explanation}


class GenerateQuizBatchRequest(BaseModel):
    topic_name: str
    user_prompt: Optional[str] = None
    doc_url: Optional[str] = None
    num_questions: int = 5
    difficulty: str = "medium"


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
                if ext == ".pdf":
                    from PyPDF2 import PdfReader
                    text = ""
                    reader = PdfReader(tmp_path)
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    context = text
                else:
                    try:
                        with open(tmp_path, "r", encoding="utf-8") as f:
                            context = f.read()
                    except UnicodeDecodeError:
                        with open(tmp_path, "r", encoding="latin-1") as f:
                            context = f.read()
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
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
