"""In-memory agent orchestrator session helpers."""
from src.core.orchestrator import AgentOrchestrator
from src.api.session_store import get_or_create_agent as load_or_create_agent, update_agent


def get_or_create_agent(student_id: str) -> AgentOrchestrator:
    return load_or_create_agent(student_id, lambda: AgentOrchestrator(student_id))


__all__ = ["get_or_create_agent", "update_agent"]
