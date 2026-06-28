"""Các route HTTP của gia sư; nghiệp vụ nằm trong lớp service."""

import logging
from typing import Optional

from fastapi import APIRouter

from eduboost_agent.api.agent_session import get_or_create_agent, update_agent
from eduboost_agent.api.app_state import runtime
from eduboost_agent.api.models import ChatRequest, GenerateQuizBatchRequest, GenerateQuizRequest, GraderRequest, UpdateStateRequest
from eduboost_agent.api.quiz_batch_service import generate_quiz_batch
from eduboost_agent.api.services.tutor_chat import answer as answer_chat
from eduboost_agent.api.services.tutor_explanation import (
    clean_socratic_hint as _clean_socratic_hint,
    explain as explain_with_service,
    format_grader_options as _format_grader_options,
    grade as grade_with_service,
)
from eduboost_agent.api.services.tutor_question import generate_question
from eduboost_agent.learning.config import BKT_LEARNING_THRESHOLD, BKT_MASTERY_THRESHOLD

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tutor", tags=["tutor"])


@router.get("/next-action")
async def get_next_action(
    student_id: str,
    topic_name: str,
    mastery_probability: Optional[float] = None,
    irt_theta: Optional[float] = None,
):
    if mastery_probability is None:
        return get_or_create_agent(student_id).decide_next_action(topic_name)
    if mastery_probability < BKT_LEARNING_THRESHOLD:
        return {
            "action": "EXPLAIN",
            "adapter": "explanation_adapter",
            "reason": f"Mastery below threshold ({mastery_probability:.2f})",
            "params": {},
        }
    if mastery_probability < BKT_MASTERY_THRESHOLD:
        return {
            "action": "QUIZ",
            "adapter": "quiz_adapter",
            "reason": f"Mastery in learning band ({mastery_probability:.2f})",
            "params": {"beta": irt_theta if irt_theta is not None else 0.0},
        }
    return {
        "action": "NEXT_SKILL",
        "adapter": None,
        "reason": f"Mastery reached transfer threshold ({mastery_probability:.2f})",
        "params": {},
    }


@router.post("/update-state", deprecated=True)
async def update_student_state(request: UpdateStateRequest):
    agent = get_or_create_agent(request.student_id)
    result = agent.update_student_state(request.topic_name, request.difficulty, request.is_correct)
    update_agent(request.student_id, agent)
    return result


async def _generate_quiz_question_response(
    topic_name: str,
    difficulty: float,
    allowed_doc_ids_list: Optional[list[str]] = None,
    allowed_scopes_list: Optional[list[str]] = None,
    existing_questions: Optional[list[str]] = None,
):
    return await generate_question(
        runtime,
        logger,
        topic_name,
        difficulty,
        allowed_doc_ids_list,
        allowed_scopes_list,
        existing_questions,
    )


@router.get("/generate-question")
async def generate_quiz_question(
    topic_name: str,
    difficulty: float = 0.0,
    allowed_document_ids: Optional[str] = None,
    allowed_scopes: Optional[str] = None,
):
    return await _generate_quiz_question_response(
        topic_name,
        difficulty,
        allowed_document_ids.split(",") if allowed_document_ids else None,
        allowed_scopes.split(",") if allowed_scopes else None,
    )


@router.post("/generate-question")
async def generate_quiz_question_post(request: GenerateQuizRequest):
    return await _generate_quiz_question_response(
        request.topic_name,
        request.difficulty,
        request.allowed_document_ids,
        request.allowed_scopes,
        request.existing_questions,
    )


@router.get("/explain")
async def explain_topic(
    topic_name: str,
    student_state: str = "beginning",
    allowed_document_ids: Optional[str] = None,
    allowed_scopes: Optional[str] = None,
):
    return await explain_with_service(
        runtime,
        logger,
        topic_name,
        student_state,
        allowed_document_ids.split(",") if allowed_document_ids else None,
        allowed_scopes.split(",") if allowed_scopes else None,
    )


@router.post("/explain-error")
async def grade_answer(request: GraderRequest):
    return await grade_with_service(runtime, logger, request)


@router.post("/generate-quiz")
async def generate_quiz_endpoint(request: GenerateQuizBatchRequest):
    return await generate_quiz_batch(request)


@router.post("/chat")
async def chat(request: ChatRequest):
    return await answer_chat(runtime, logger, request)
