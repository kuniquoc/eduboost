"""Pydantic request/response models for the AI Agent HTTP API."""

from typing import Optional

from pydantic import BaseModel


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
