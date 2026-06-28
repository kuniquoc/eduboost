"""Các phép đo thuần cho định dạng đầu ra quiz."""

import json
from typing import Any

QUIZ_REQUIRED_KEYS = ("question", "options", "correct_answer", "explanation")


def extract_quiz_output(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    output = payload.get("output")
    return output if isinstance(output, dict) else payload


def extract_response_text(record: Any) -> str:
    if isinstance(record, dict):
        if isinstance(record.get("response_text"), str):
            return record["response_text"]
        if record.get("parsed_json") is not None:
            return json.dumps(record["parsed_json"], ensure_ascii=False)
        return json.dumps(record, ensure_ascii=False)
    return record if isinstance(record, str) else str(record)


def extract_response_json(record: Any) -> Any:
    if isinstance(record, dict):
        if record.get("parsed_json") is not None:
            return record["parsed_json"]
        if all(key in record for key in QUIZ_REQUIRED_KEYS) or "output" in record:
            return record
        raw = record.get("response_text")
        if not isinstance(raw, str):
            return None
    elif isinstance(record, str):
        raw = record
    else:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _is_recoverable_json(raw: str) -> bool:
    stripped = raw.strip()
    return bool(stripped) and (
        ("{" in stripped and "}" in stripped)
        or stripped.count("{") != stripped.count("}")
    )


def score_quiz_json_format(raw_response: str, parsed_payload: Any) -> dict[str, Any]:
    try:
        strict_payload = json.loads(raw_response.strip())
        strict_parse = True
    except json.JSONDecodeError:
        strict_payload = None
        strict_parse = False

    parsed = parsed_payload if parsed_payload is not None else strict_payload
    quiz = extract_quiz_output(parsed)
    meta = {
        "strict_parse": strict_parse,
        "recoverable_json": _is_recoverable_json(raw_response),
        "required_keys_present": False,
        "types_valid": False,
        "missing_keys": [],
    }
    if not isinstance(quiz, dict):
        score = 3 if meta["recoverable_json"] else 1
        return {"score": score, "reason": "Output không phải JSON object hợp lệ để hệ thống xử lý.", "meta": meta}

    missing = [key for key in QUIZ_REQUIRED_KEYS if key not in quiz]
    meta["missing_keys"] = missing
    meta["required_keys_present"] = not missing
    types_valid = (
        isinstance(quiz.get("question"), str)
        and isinstance(quiz.get("options"), list)
        and isinstance(quiz.get("correct_answer"), str)
        and isinstance(quiz.get("explanation"), str)
    )
    meta["types_valid"] = types_valid

    if strict_parse and not missing and types_valid:
        extra_keys = [key for key in quiz if key not in QUIZ_REQUIRED_KEYS]
        if extra_keys:
            return {"score": 8, "reason": "JSON hợp lệ và đầy đủ, nhưng có trường dư ngoài schema chính.", "meta": meta}
        return {"score": 10, "reason": "JSON hợp lệ hoàn toàn, đủ 4 trường bắt buộc, đúng kiểu dữ liệu.", "meta": meta}
    if (strict_parse or parsed is not None) and (not missing or types_valid):
        if missing or not types_valid:
            return {"score": 6, "reason": "JSON parse được nhưng thiếu trường bắt buộc hoặc sai kiểu dữ liệu.", "meta": meta}
        return {"score": 7, "reason": "JSON hợp lệ cú pháp nhưng chưa tuân thủ hoàn toàn quy ước schema.", "meta": meta}
    if meta["recoverable_json"]:
        return {"score": 4, "reason": "JSON có lỗi cú pháp nhẹ, có thể khôi phục bằng xử lý tự động.", "meta": meta}
    return {"score": 2, "reason": "Đầu ra không phải JSON hợp lệ.", "meta": meta}


def compute_quiz_metrics(responses: list[Any], label: str) -> dict[str, float]:
    json_pass = 0
    schema_pass = 0
    for item in responses:
        parsed = extract_response_json(item)
        if parsed is None:
            continue
        json_pass += 1
        quiz = extract_quiz_output(parsed)
        if isinstance(quiz, dict) and all(key in quiz for key in QUIZ_REQUIRED_KEYS):
            schema_pass += 1
    total = max(1, len(responses))
    return {
        f"{label}_json_rate": (json_pass / total) * 100,
        f"{label}_schema_rate": (schema_pass / total) * 100,
    }
