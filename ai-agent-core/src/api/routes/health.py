from fastapi import APIRouter

from src.api.app_state import runtime

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "chunks": len(runtime.vector_db.metadata) if runtime.vector_db else 0,
        "llm": {
            "quiz": runtime.llm_available(runtime.llm_quiz),
            "explain": runtime.llm_available(runtime.llm_explain),
            "chat": runtime.llm_available(runtime.llm_chat),
        },
    }
