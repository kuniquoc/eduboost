"""Chuẩn hóa, kiểm tra và chống trùng dữ liệu quiz do LLM trả về."""

import logging
import re
from typing import Any

logger = logging.getLogger("eduboost_agent.api.quiz_batch_service")

DIFFICULTY_TO_BETA = {"easy": -1.5, "medium": 0.0, "hard": 1.5}
QUIZ_RETRY_TEMPERATURES = [0.35, 0.45, 0.55, 0.60, 0.65]

_OPTION_LETTERS = ["A", "B", "C", "D"]
_PROHIBITED_EXAMPLES = {
    "thechildrenplayinginthegardenwhenitstartedtorain",
    "sheisanexpertinthefieldofartificialintelligence",
}
_AVOID_LIST_CAP = 21
_AVOID_COMPLETED_RECENT = 20
_EXISTING_QUESTIONS_CAP = 150


def parse_is_correct(value: Any) -> bool:
    # Không dùng bool(value), vì chuỗi "false" cũng được Python coi là True.
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value == 1
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return False


def normalize_answer_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def normalize_question_text(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "", text.strip().lower())


def is_exact_duplicate(question_text: str, seen: set[str]) -> bool:
    return normalize_question_text(question_text) in seen


def is_duplicate_question(question_text: str, seen: set[str]) -> bool:
    return is_exact_duplicate(question_text, seen)


def build_avoid_texts(completed: list[dict], rejected: list[str]) -> list[str]:
    all_texts = [question["question"] for question in completed] + rejected
    if len(all_texts) <= _AVOID_LIST_CAP:
        return all_texts

    # Ưu tiên câu vừa bị loại, sau đó mới bù bằng các câu đã sinh gần nhất.
    seen: set[str] = set()
    result: list[str] = []
    for text in rejected:
        if text not in seen:
            seen.add(text)
            result.append(text)

    if len(result) >= _AVOID_LIST_CAP:
        return result[:_AVOID_LIST_CAP]

    recent = [question["question"] for question in completed[-_AVOID_COMPLETED_RECENT:]]
    for text in reversed(recent):
        if text not in seen:
            seen.add(text)
            result.append(text)
            if len(result) >= _AVOID_LIST_CAP:
                break
    return result[:_AVOID_LIST_CAP]


def _extract_forbidden_prefixes(avoid_texts: list[str]) -> list[str]:
    prefixes: set[str] = set()
    for text in avoid_texts:
        lowered = text.strip().lower()
        for starter in ("the new ", "the company ", "the project ", "the law ", "the policy "):
            if lowered.startswith(starter):
                prefixes.add(starter.strip() + "...")
    return sorted(prefixes)


def build_retry_hint(attempt: int, avoid_texts: list[str]) -> str:
    if attempt <= 1:
        return ""
    if attempt == 2:
        return "\n\nRETRY: Use a DIFFERENT subject and verb pattern than every avoid-list sentence."
    if attempt == 3:
        hint = "\n\nRETRY: Generate a COMPLETELY DIFFERENT sentence."
        banned = _extract_forbidden_prefixes(avoid_texts)
        return hint + (f" Do NOT start with: {', '.join(banned)}" if banned else "")
    if attempt == 4:
        return (
            "\n\nRETRY: Pick vocabulary from a DIFFERENT part of the FOCUS EXCERPT. "
            "Test a different collocation or phrasal verb."
        )
    return "\n\nRETRY: Use a person/action scene (She/He/They...), NOT laws/policies/companies."


def seed_seen_from_existing(existing: list[str]) -> tuple[set[str], list[dict]]:
    seen: set[str] = set()
    placeholders: list[dict] = []
    for raw_text in existing[:_EXISTING_QUESTIONS_CAP]:
        text = (raw_text or "").strip()
        if not text:
            continue
        normalized = normalize_question_text(text)
        if normalized and normalized not in seen:
            seen.add(normalized)
            placeholders.append({"question": text})
    return seen, placeholders


def resolve_correct_letter(correct_answer: str, options_raw: dict) -> str | None:
    raw = str(correct_answer or "").strip()
    if not raw:
        return None
    upper = raw.upper()
    if upper in _OPTION_LETTERS:
        return upper

    letter_match = re.search(r"\b([A-D])\b", upper)
    if letter_match and len(raw) <= 12:
        return letter_match.group(1)

    normalized_answer = normalize_answer_text(raw)
    matches = [
        letter
        for letter in _OPTION_LETTERS
        if normalize_answer_text(options_raw.get(letter, "")) == normalized_answer
    ]
    return matches[0] if len(matches) == 1 else None


def parse_single_question(raw: dict, difficulty_label: str) -> dict | None:
    question_text = raw.get("question", "").strip()
    if not question_text:
        return None
    if normalize_question_text(question_text) in _PROHIBITED_EXAMPLES:
        logger.info("[QUIZ-BATCH] Skipped prohibited example question: %s", question_text)
        return None

    options_raw = raw.get("options", {})
    if isinstance(options_raw, dict) and len(options_raw) == 4:
        correct_letter = resolve_correct_letter(raw.get("correct_answer", ""), options_raw)
        if correct_letter is None:
            logger.warning("[QUIZ-BATCH] Invalid correct_answer '%s', skipping", raw.get("correct_answer", ""))
            return None
        options = [
            {"text": str(options_raw.get(letter, "")), "isCorrect": letter == correct_letter}
            for letter in _OPTION_LETTERS
        ]
    elif isinstance(options_raw, list) and len(options_raw) == 4:
        if not all(isinstance(option, dict) for option in options_raw):
            return None
        options = [
            {"text": str(option.get("text", "")), "isCorrect": parse_is_correct(option.get("isCorrect", False))}
            for option in options_raw
        ]
    else:
        logger.warning("[QUIZ-BATCH] Unexpected options format: %s", str(options_raw)[:100])
        return None

    correct_count = sum(1 for option in options if option["isCorrect"])
    if correct_count != 1:
        logger.warning("[QUIZ-BATCH] Expected exactly 1 correct option, got %d — skipping", correct_count)
        return None

    try:
        difficulty_index = float(raw.get("difficulty_index", raw.get("difficulty_level")))
    except (TypeError, ValueError):
        difficulty_index = DIFFICULTY_TO_BETA.get(difficulty_label, 0.0)

    return {
        "question": question_text,
        "type": "mcq",
        "difficulty": difficulty_label,
        "difficulty_index": max(-3.0, min(3.0, difficulty_index)),
        "options": options,
        "explanation": raw.get("explanation", ""),
    }
