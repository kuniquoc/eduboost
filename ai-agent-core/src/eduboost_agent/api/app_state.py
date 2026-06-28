"""Shared runtime singletons initialized at application startup."""

from typing import Optional

from fastapi import HTTPException

from eduboost_agent.llm.llm_manager import AI_UNAVAILABLE_MSG, LLMManager
from eduboost_agent.rag.ingest import RAGIngestor
from eduboost_agent.rag.retriever import KnowledgeRetriever
from eduboost_agent.rag.vector_db import VectorDB


class AgentRuntime:
    vector_db: Optional[VectorDB] = None
    retriever: Optional[KnowledgeRetriever] = None
    llm_quiz: Optional[LLMManager] = None
    llm_explain: Optional[LLMManager] = None
    llm_chat: Optional[LLMManager] = None
    ingestor: Optional[RAGIngestor] = None

    @staticmethod
    def llm_available(llm: Optional[LLMManager]) -> bool:
        return llm is not None and llm.is_available

    @staticmethod
    def raise_ai_unavailable() -> None:
        raise HTTPException(503, AI_UNAVAILABLE_MSG)


runtime = AgentRuntime()
