"""File-backed persistence for tutor agent sessions (survives process restart)."""

import os
import pickle
from pathlib import Path
from typing import Optional

from src.core.orchestrator import AgentOrchestrator

_SESSION_DIR = Path(os.getenv("AGENT_SESSION_DIR") or "data/agent_sessions")


def _path(student_id: str) -> Path:
    _SESSION_DIR.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in student_id)
    return _SESSION_DIR / f"{safe}.pkl"


def load_agent(student_id: str) -> Optional[AgentOrchestrator]:
    path = _path(student_id)
    if not path.exists():
        return None
    try:
        with path.open("rb") as f:
            return pickle.load(f)
    except Exception:
        return None


def save_agent(student_id: str, agent: AgentOrchestrator) -> None:
    path = _path(student_id)
    with path.open("wb") as f:
        pickle.dump(agent, f)


def delete_agent(student_id: str) -> None:
    path = _path(student_id)
    if path.exists():
        path.unlink()


def get_or_create_agent(student_id: str, factory) -> AgentOrchestrator:
    existing = load_agent(student_id)
    if existing is not None:
        return existing
    agent = factory()
    save_agent(student_id, agent)
    return agent


def update_agent(student_id: str, agent: AgentOrchestrator) -> None:
    save_agent(student_id, agent)
