"""Scoring step: deterministic metrics + GPT-4o LLM-as-a-judge."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .client import JUDGE_MODEL, create_judge_client, load_jsonl
from .generate import get_user_prompt

QUIZ_REQUIRED_KEYS = ("question", "options", "correct_answer", "explanation")
QUIZ_CRITERIA = (
    "json_format",
    "question_clarity",
    "distractor_quality",
    "correct_answer_accuracy",
    "explanation_quality",
)
EXPLANATION_CRITERIA = (
    "content_accuracy",
    "socratic_pedagogy",
    "completeness",
    "focus",
)


def _extract_quiz_output(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    output = payload.get("output")
    if isinstance(output, dict):
        return output
    return payload


def _extract_response_text(record: Any) -> str:
    if isinstance(record, dict):
        if isinstance(record.get("response_text"), str):
            return record["response_text"]
        if record.get("parsed_json") is not None:
            return json.dumps(record["parsed_json"], ensure_ascii=False)
        return json.dumps(record, ensure_ascii=False)
    if isinstance(record, str):
        return record
    return str(record)


def _extract_response_json(record: Any) -> Any:
    if isinstance(record, dict):
        if record.get("parsed_json") is not None:
            return record["parsed_json"]
        if all(key in record for key in QUIZ_REQUIRED_KEYS) or "output" in record:
            return record
        if isinstance(record.get("response_text"), str):
            try:
                return json.loads(record["response_text"])
            except json.JSONDecodeError:
                return None
        return None
    if isinstance(record, str):
        try:
            return json.loads(record)
        except json.JSONDecodeError:
            return None
    return None


def _is_recoverable_json(raw: str) -> bool:
    stripped = raw.strip()
    if not stripped:
        return False
    if ("{" in stripped and "}" in stripped) or stripped.count("{") != stripped.count("}"):
        return True
    return False


def score_quiz_json_format(raw_response: str, parsed_payload: Any) -> dict[str, Any]:
    """Script-based scoring for quiz JSON-format criterion."""
    strict_parse = False
    stripped = raw_response.strip()
    try:
        parsed_strict = json.loads(stripped)
        strict_parse = True
    except json.JSONDecodeError:
        parsed_strict = None

    parsed = parsed_payload if parsed_payload is not None else parsed_strict
    quiz_obj = _extract_quiz_output(parsed)

    meta = {
        "strict_parse": strict_parse,
        "recoverable_json": _is_recoverable_json(raw_response),
        "required_keys_present": False,
        "types_valid": False,
        "missing_keys": [],
    }

    if not isinstance(quiz_obj, dict):
        score = 3 if meta["recoverable_json"] else 1
        reason = "Output không phải JSON object hợp lệ để hệ thống xử lý."
        return {"score": score, "reason": reason, "meta": meta}

    missing = [key for key in QUIZ_REQUIRED_KEYS if key not in quiz_obj]
    meta["missing_keys"] = missing
    meta["required_keys_present"] = len(missing) == 0

    types_ok = (
        isinstance(quiz_obj.get("question"), str)
        and isinstance(quiz_obj.get("options"), list)
        and isinstance(quiz_obj.get("correct_answer"), str)
        and isinstance(quiz_obj.get("explanation"), str)
    )
    meta["types_valid"] = types_ok

    if strict_parse and meta["required_keys_present"] and types_ok:
        extra_keys = [k for k in quiz_obj.keys() if k not in QUIZ_REQUIRED_KEYS]
        if extra_keys:
            return {
                "score": 8,
                "reason": "JSON hợp lệ và đầy đủ, nhưng có trường dư ngoài schema chính.",
                "meta": meta,
            }
        return {
            "score": 10,
            "reason": "JSON hợp lệ hoàn toàn, đủ 4 trường bắt buộc, đúng kiểu dữ liệu.",
            "meta": meta,
        }

    if (strict_parse or parsed is not None) and (meta["required_keys_present"] or types_ok):
        if not meta["required_keys_present"] or not types_ok:
            return {
                "score": 6,
                "reason": "JSON parse được nhưng thiếu trường bắt buộc hoặc sai kiểu dữ liệu.",
                "meta": meta,
            }
        return {
            "score": 7,
            "reason": "JSON hợp lệ cú pháp nhưng chưa tuân thủ hoàn toàn quy ước schema.",
            "meta": meta,
        }

    if meta["recoverable_json"]:
        return {
            "score": 4,
            "reason": "JSON có lỗi cú pháp nhẹ, có thể khôi phục bằng xử lý tự động.",
            "meta": meta,
        }
    return {"score": 2, "reason": "Đầu ra không phải JSON hợp lệ.", "meta": meta}


def compute_quiz_metrics(responses: list[Any], label: str) -> dict[str, float]:
    """Compute JSON and schema pass rates for quiz outputs."""
    json_pass = 0
    schema_pass = 0

    for item in responses:
        parsed = _extract_response_json(item)
        if parsed is None:
            continue
        json_pass += 1
        quiz_obj = _extract_quiz_output(parsed)
        if not isinstance(quiz_obj, dict):
            continue
        if all(key in quiz_obj for key in QUIZ_REQUIRED_KEYS):
            schema_pass += 1

    total = max(1, len(responses))
    return {
        f"{label}_json_rate": (json_pass / total) * 100,
        f"{label}_schema_rate": (schema_pass / total) * 100,
    }


def _get_gold_reference(item: dict[str, Any], task_type: str) -> str:
    if task_type == "quiz":
        output = item.get("output")
        if isinstance(output, dict):
            return json.dumps(output, ensure_ascii=False)
        return "N/A"
    return item.get("explanation", "N/A")


def _quiz_rubric_text() -> str:
    return """
Bạn là giám khảo học thuật nghiêm khắc cho tác vụ sinh câu hỏi trắc nghiệm tiếng Anh.
Chấm theo thang 1-10 cho từng tiêu chí:

1) json_format
- 9-10: JSON hợp lệ hoàn toàn, đủ 4 trường bắt buộc (question, options, correct_answer, explanation), đúng kiểu.
- 7-8: JSON hợp lệ cú pháp, có lỗi nhỏ (quy ước tên trường/field dư/thứ tự khác).
- 5-6: JSON parse được nhưng thiếu trường bắt buộc hoặc sai kiểu dữ liệu.
- 3-4: Lỗi cú pháp nhẹ có thể khôi phục tự động, hoặc chỉ có 1-2 trường.
- 1-2: Không phải JSON parse được.

2) question_clarity
- 9-10: Câu tự nhiên, chỗ trống đặt đúng, phù hợp CEFR mục tiêu, không mơ hồ.
- 7-8: Rõ nghĩa nhưng hơi gượng hoặc lệch nhẹ độ khó.
- 5-6: Hiểu được nhưng có lỗi nhỏ hoặc mơ hồ cục bộ.
- 3-4: Mơ hồ, thiếu ngữ cảnh, lệch trọng tâm kiểm tra.
- 1-2: Không hiểu được hoặc không liên quan.

3) distractor_quality
- 9-10: 3 nhiễu hấp dẫn, phân biệt nghĩa rõ, chỉ 1 đáp án đúng.
- 7-8: Đa phần ổn, 1 phương án hơi lộ.
- 5-6: 1 nhiễu quá dễ loại hoặc có tình huống 2 đáp án có thể đúng.
- 3-4: Nhiễu lộ liễu/trùng nghĩa hoặc có 2 đáp án cùng đúng.
- 1-2: Nhiễu không liên quan hoặc không có đáp án đúng duy nhất.

4) correct_answer_accuracy
- 9-10: Đáp án đúng chính xác tuyệt đối, khớp 1 phương án duy nhất, không tranh cãi.
- 7-8: Đáp án đúng nhưng có điểm trình bày chưa tối ưu.
- 5-6: Đáp án còn tranh cãi theo ngữ cảnh.
- 3-4: Có dấu hiệu sai hoặc nhiều hơn 1 đáp án đúng.
- 1-2: Đáp án sai rõ ràng hoặc không khớp options.

5) explanation_quality
- 9-10: 1-2 câu tiếng Việt, ngắn gọn, giải thích đúng quy tắc cốt lõi.
- 7-8: Đúng nhưng hơi dài hoặc có nội dung thừa nhẹ.
- 5-6: Đúng một phần, thiếu trọng tâm hoặc quá phức tạp.
- 3-4: Sai quy tắc hoặc chủ yếu không phải tiếng Việt.
- 1-2: Không có giải thích hoặc giải thích không liên quan.
""".strip()


def _explanation_rubric_text() -> str:
    return """
Bạn là giám khảo học thuật nghiêm khắc cho tác vụ phản hồi gia sư Socratic.
Chấm theo thang 1-10 cho từng tiêu chí:

1) content_accuracy
- 9-10: Nội dung chính xác, giải thích đúng quy tắc.
- 7-8: Đa phần đúng, sai sót rất nhỏ.
- 5-6: Đúng một phần, thiếu hoặc sai nhẹ trọng tâm.
- 3-4: Sai quy tắc đáng kể.
- 1-2: Sai nghiêm trọng hoặc không liên quan.

2) socratic_pedagogy
- 9-10: Dẫn dắt bằng câu hỏi gợi mở, không lộ đáp án, giọng tích cực tiếng Việt.
- 7-8: Chủ yếu Socratic nhưng còn gợi ý hơi lộ.
- 5-6: Pha trộn giữa dẫn dắt và cho đáp án trực tiếp.
- 3-4: Chủ yếu giảng giải một chiều, ít dẫn dắt.
- 1-2: Trả đáp án trực tiếp, không có yếu tố Socratic.

3) completeness
- 9-10: Chỉ ra đúng lỗi cụ thể, đủ quy tắc liên quan, vừa đủ ngữ cảnh theo CEFR.
- 7-8: Xử lý đúng lỗi chính nhưng thiếu một phần quan trọng.
- 5-6: Chỉ xử lý một phần lỗi hoặc mô tả quá chung.
- 3-4: Quá ngắn/chung chung, khó giúp người học tự sửa.
- 1-2: Không đề cập lỗi cụ thể.

4) focus
- 9-10: Bám đúng lỗi trong câu học viên, không lan man.
- 7-8: Đúng trọng tâm nhưng có thêm chi tiết phụ gây nhiễu nhẹ.
- 5-6: Khoảng một nửa nội dung không bám lỗi cụ thể.
- 3-4: Chủ yếu lệch sang điểm ngữ pháp khác.
- 1-2: Hoàn toàn lạc đề.
""".strip()


def build_judge_prompt(
    task_type: str,
    prompt: str,
    reference: str,
    response: str,
    json_format_hint: dict[str, Any] | None = None,
) -> str:
    rubric = _quiz_rubric_text() if task_type == "quiz" else _explanation_rubric_text()
    criteria = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA
    json_hint_block = ""
    if json_format_hint and task_type == "quiz":
        json_hint_block = (
            "\n## Deterministic JSON-format signal (must respect this)\n"
            f"{json.dumps(json_format_hint, ensure_ascii=False)}\n"
            "Set criteria.json_format exactly equal to deterministic_json_format_score."
        )

    return f"""
{rubric}

## Input Prompt Given to Model
{prompt}

## Gold Reference
{reference}

## Model Response
{response}
{json_hint_block}

## Output contract
Return ONLY one JSON object:
{{
  "overall": <int 1-10>,
  "criteria": {{
    {", ".join(f'"{key}": <int 1-10>' for key in criteria)}
  }},
  "justification": "<one concise Vietnamese sentence>"
}}
""".strip()


def _fallback_score(task_type: str, reason: str) -> dict[str, Any]:
    criteria_keys = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA
    return {
        "overall": 5,
        "criteria": {key: 5 for key in criteria_keys},
        "justification": reason,
    }


def _judge_score(
    client: Any,
    prompt: str,
    response: str,
    reference: str,
    task_type: str,
    json_hint: dict[str, Any] | None = None,
    max_retries: int = 5,
) -> dict[str, Any]:
    """Call GPT-4o and parse strict JSON output."""
    content = build_judge_prompt(
        task_type=task_type,
        prompt=prompt,
        response=response,
        reference=reference,
        json_format_hint=json_hint,
    )

    for attempt in range(max_retries):
        try:
            completion = client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=[
                    {"role": "system", "content": "You are a strict evaluator. Output JSON only."},
                    {"role": "user", "content": content},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
            raw = completion.choices[0].message.content.strip()
            parsed = json.loads(raw)
            overall = int(parsed["overall"])
            criteria = {str(k): int(v) for k, v in parsed["criteria"].items()}
            justification = str(parsed.get("justification", "")).strip()
            return {"overall": overall, "criteria": criteria, "justification": justification}
        except Exception as error:  # noqa: BLE001
            if attempt == max_retries - 1:
                return _fallback_score(task_type, f"Judge error: {str(error)[:120]}")
            wait_seconds = min(60, 2 ** attempt * 5)
            print(f"      Retry in {wait_seconds}s ({attempt + 1}/{max_retries})")
            time.sleep(wait_seconds)

    return _fallback_score(task_type, "Judge retries exhausted")


def _apply_quiz_deterministic_override(score: dict[str, Any], json_score: int) -> dict[str, Any]:
    adjusted = dict(score)
    criteria = dict(adjusted.get("criteria", {}))
    criteria["json_format"] = int(json_score)
    adjusted["criteria"] = criteria
    vals = [int(v) for v in criteria.values()] or [json_score]
    adjusted["overall"] = max(1, min(10, round(sum(vals) / len(vals))))
    return adjusted


def step_judge_score(
    test_file: str,
    responses_path: str,
    scores_path: str,
    task_type: str = "quiz",
    label: str = "Model",
) -> dict[str, Any]:
    """Score all records and save per-item score entries with resume support."""
    with open(test_file, "r", encoding="utf-8") as handle:
        test_data = [json.loads(line) for line in handle]

    responses = load_jsonl(responses_path)
    if len(responses) != len(test_data):
        raise ValueError(f"responses ({len(responses)}) != test_data ({len(test_data)})")

    results: dict[str, Any] = {"label": label, "task_type": task_type, "judge_model": JUDGE_MODEL}
    if task_type == "quiz":
        results.update(compute_quiz_metrics(responses, label))

    out_path = Path(scores_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    existing: list[dict[str, Any]] = []

    if out_path.exists():
        with open(out_path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    existing.append(json.loads(line))

    total = len(test_data)
    done = len(existing)
    criteria_keys = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA

    if done >= total:
        print(f"  ✅ Scores already completed: {done}/{total}.")
        item_scores = existing[:total]
    else:
        if done:
            print(f"  ↩ Resume from {done}/{total}")
        print(f"  Scoring with {JUDGE_MODEL}: {label} ({task_type})")
        client = create_judge_client()
        item_scores = list(existing)

        with open(out_path, "a", encoding="utf-8") as out:
            for index in range(done, total):
                sample = test_data[index]
                raw_record = responses[index]
                prompt = get_user_prompt(sample, task_type)
                reference = _get_gold_reference(sample, task_type)
                response_text = _extract_response_text(raw_record)
                parsed_response = _extract_response_json(raw_record)

                json_format_signal = None
                if task_type == "quiz":
                    json_eval = score_quiz_json_format(response_text, parsed_response)
                    json_format_signal = {
                        "deterministic_json_format_score": json_eval["score"],
                        "deterministic_json_format_reason": json_eval["reason"],
                        "json_meta": json_eval["meta"],
                    }

                score = _judge_score(
                    client=client,
                    prompt=prompt,
                    response=response_text,
                    reference=reference,
                    task_type=task_type,
                    json_hint=json_format_signal,
                )

                if task_type == "quiz" and json_format_signal:
                    score = _apply_quiz_deterministic_override(
                        score,
                        json_format_signal["deterministic_json_format_score"],
                    )

                entry = {
                    "record_id": index,
                    "overall": int(score["overall"]),
                    "criteria": {key: int(score["criteria"].get(key, 5)) for key in criteria_keys},
                    "justification": score.get("justification", ""),
                    "meta": {
                        "task_type": task_type,
                        "model_label": label,
                        "judge_model": JUDGE_MODEL,
                        "response_excerpt": response_text[:240],
                        "json_format_signal": json_format_signal,
                    },
                }
                item_scores.append(entry)
                out.write(json.dumps(entry, ensure_ascii=False) + "\n")
                out.flush()

                if (index + 1) % 10 == 0 or index + 1 == total:
                    print(f"    Scored: {index + 1}/{total}")

    avg_overall = sum(item["overall"] for item in item_scores) / total
    avg_criteria = {}
    for key in criteria_keys:
        vals = [item["criteria"].get(key, 5) for item in item_scores]
        avg_criteria[key] = sum(vals) / len(vals)

    results["scores"] = {
        "overall": round(avg_overall, 2),
        "criteria": {key: round(value, 2) for key, value in avg_criteria.items()},
        "total": total,
        "item_scores": item_scores,
    }
    print(f"  Done! {label} - Overall: {avg_overall:.2f}/10")
    return results


def step_export_prompts(
    test_file: str,
    responses_path: str,
    output_dir: str,
    task_type: str = "quiz",
    label: str = "Model",
) -> int:
    """Export full judge prompts to text files for manual review."""
    with open(test_file, "r", encoding="utf-8") as handle:
        test_data = [json.loads(line) for line in handle]
    responses = load_jsonl(responses_path)

    if len(responses) != len(test_data):
        raise ValueError(f"responses ({len(responses)}) != test_data ({len(test_data)})")

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    total = len(test_data)
    for index in range(total):
        prompt = get_user_prompt(test_data[index], task_type)
        reference = _get_gold_reference(test_data[index], task_type)
        response_text = _extract_response_text(responses[index])
        json_hint = None
        if task_type == "quiz":
            parsed = _extract_response_json(responses[index])
            json_eval = score_quiz_json_format(response_text, parsed)
            json_hint = {
                "deterministic_json_format_score": json_eval["score"],
                "deterministic_json_format_reason": json_eval["reason"],
                "json_meta": json_eval["meta"],
            }

        content = build_judge_prompt(
            task_type=task_type,
            prompt=prompt,
            reference=reference,
            response=response_text,
            json_format_hint=json_hint,
        )
        file_path = out_dir / f"{label}_item_{index + 1:03d}.txt"
        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(content)

    print(f"  ✅ Exported {total} prompts -> {out_dir}")
    return total
