"""
B2 — Chấm điểm: Đọc file responses → tính metrics + Gemini score-based judge.
"""
import json
import time
from pathlib import Path
from .client import create_judge_client, load_jsonl
from .generate import get_user_prompt

# ==============================================================================
# QUIZ METRICS (không cần LLM)
# ==============================================================================
QUIZ_REQUIRED_KEYS = {"question", "options", "correct_answer", "explanation"}


def compute_quiz_metrics(responses, label):
    """Tính JSON Pass Rate và Schema Pass Rate cho 1 danh sách responses."""
    json_pass = 0
    schema_pass = 0
    for r in responses:
        try:
            parsed = r if isinstance(r, dict) else json.loads(r)
            json_pass += 1
            if QUIZ_REQUIRED_KEYS.issubset(parsed.keys()):
                schema_pass += 1
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass
    total = len(responses)
    return {
        f"{label}_json_rate": (json_pass / total) * 100,
        f"{label}_schema_rate": (schema_pass / total) * 100,
    }


# ==============================================================================
# GOLD REFERENCE HELPERS
# ==============================================================================
def _get_gold_reference(item, task_type):
    """Trích reference answer từ gold dataset item."""
    if task_type == "quiz":
        output = item.get("output", {})
        return json.dumps(output, ensure_ascii=False) if output else None
    else:
        return item.get("explanation")


# ==============================================================================
# LLM-AS-A-JUDGE (Score-based)
# ==============================================================================
QUIZ_SCORE_TEMPLATE = """You are an expert evaluator for an English quiz generation system.
Your job is to rigorously score a model-generated quiz question against specific quality criteria.

## Input Prompt Given to the Model
{prompt}

## Gold Reference Answer
{reference}

## Model's Response
{response}

## Scoring Rubric (1-10 scale)

Score each criterion independently:

1. **json_format** — Valid JSON structure
   - 10: Perfect valid JSON with all required keys (question, options, correct_answer, explanation)
   - 7-9: Valid JSON but minor issues (extra keys, formatting)
   - 4-6: Partially valid JSON, missing some keys
   - 1-3: Invalid JSON, unparseable, or completely wrong structure

2. **question_clarity** — Question quality and relevance
   - 10: Clear, natural English sentence with blank (___), directly tests the specified topic, appropriate for the difficulty level
   - 7-9: Clear question, relevant to topic but slightly off-target difficulty
   - 4-6: Understandable but awkward phrasing or loosely related to topic
   - 1-3: Confusing, grammatically incorrect, or unrelated to topic

3. **distractor_quality** — Quality of wrong options
   - 10: All 3 distractors are plausible (could trick a student at the target level), distinct from each other, and clearly wrong
   - 7-9: Mostly plausible distractors with minor issues
   - 4-6: Some distractors are obviously wrong or too similar
   - 1-3: Distractors are nonsensical, identical, or include another correct answer

4. **correct_answer** — Answer accuracy
   - 10: Correct answer is unambiguously right, matches one option exactly, and aligns with the question
   - 7-9: Correct but minor stylistic issues
   - 4-6: Arguably correct but debatable
   - 1-3: Wrong answer, doesn't match options, or multiple correct options exist

5. **explanation** — Explanation quality
   - 10: Clear Vietnamese explanation, concise (1-2 sentences), correctly explains the grammar/vocabulary rule
   - 7-9: Mostly clear explanation with minor issues
   - 4-6: Partially correct or unclear explanation
   - 1-3: Wrong, missing, or in the wrong language

Then compute an **overall** score (1-10) as a holistic assessment, not a simple average.

## Output
Respond ONLY with JSON in this exact format:
{{"overall": <int>, "criteria": {{"json_format": <int>, "question_clarity": <int>, "distractor_quality": <int>, "correct_answer": <int>, "explanation": <int>}}, "justification": "<one sentence explaining your overall score>"}}"""

EXPLANATION_SCORE_TEMPLATE = """You are an expert evaluator for a Socratic English tutoring system designed for Vietnamese students.
Your job is to rigorously score a model-generated tutoring response against specific pedagogical criteria.

## Input Prompt Given to the Model
{prompt}

## Gold Reference Answer
{reference}

## Model's Response
{response}

## Scoring Rubric (1-10 scale)

Score each criterion independently:

1. **accuracy** — Factual and grammatical correctness
   - 10: All grammar rules and explanations are 100% correct, correctly identifies the error
   - 7-9: Mostly correct with very minor inaccuracies
   - 4-6: Some factual errors or misidentifies the core issue
   - 1-3: Major errors, wrong grammar rule, or misleading information

2. **pedagogy** — Socratic teaching approach
   - 10: Guides student to self-correct without revealing the answer; asks a focused guiding question; warm, encouraging tone in Vietnamese
   - 7-9: Uses Socratic method but question could be more focused, or gives too many hints
   - 4-6: Partially Socratic but reveals the answer or is too vague to be helpful
   - 1-3: Directly gives the answer, uses lecturing tone, or is in the wrong language

3. **completeness** — Coverage of the error
   - 10: Identifies the specific error, references the relevant grammar rule/pattern, and provides just enough context for the student's level
   - 7-9: Covers the main error but misses a nuance or provides slightly too much/too little info
   - 4-6: Only partially addresses the error or is too generic
   - 1-3: Misses the main error entirely or is irrelevant

4. **relevance** — Stays focused on the student's specific mistake
   - 10: Response directly addresses the exact error in the student's sentence, appropriate for their level (A1/A2/B1/B2)
   - 7-9: Mostly focused but includes some unnecessary tangents
   - 4-6: Addresses the topic broadly but not the specific error
   - 1-3: Off-topic, addresses a different grammar point, or ignores the student's input

Then compute an **overall** score (1-10) as a holistic assessment, not a simple average.

## Output
Respond ONLY with JSON in this exact format:
{{"overall": <int>, "criteria": {{"accuracy": <int>, "pedagogy": <int>, "completeness": <int>, "relevance": <int>}}, "justification": "<one sentence explaining your overall score>"}}"""

QUIZ_CRITERIA = ["json_format", "question_clarity", "distractor_quality", "correct_answer", "explanation"]
EXPLANATION_CRITERIA = ["accuracy", "pedagogy", "completeness", "relevance"]


def _judge_score(client, prompt, response, reference, task_type, max_retries=5):
    """Gọi Gemini judge chấm điểm 1 response. Retry khi bị rate limit."""
    if task_type == "quiz":
        content = QUIZ_SCORE_TEMPLATE.format(prompt=prompt, response=response, reference=reference)
    else:
        content = EXPLANATION_SCORE_TEMPLATE.format(prompt=prompt, response=response, reference=reference)

    for attempt in range(max_retries):
        try:
            res = client.chat.completions.create(
                model="gemini-3.1-flash-lite",
                messages=[{"role": "user", "content": content}],
            )
            break
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                wait = min(60, 2 ** attempt * 10)
                print(f"      ⏳ Rate limit, retry in {wait}s...")
                time.sleep(wait)
            else:
                raise
    else:
        return {"overall": 5, "criteria": {}, "justification": "Rate limit exceeded after retries"}

    raw = res.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
        overall = int(parsed["overall"])
        criteria = {k: int(v) for k, v in parsed["criteria"].items()}
        justification = parsed.get("justification", "")
        return {"overall": overall, "criteria": criteria, "justification": justification}
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return {"overall": 5, "criteria": {}, "justification": f"Parse error: {raw[:100]}"}


# ==============================================================================
# MAIN STEP
# ==============================================================================
def step_judge_score(test_file, responses_path, scores_path, task_type="quiz", label="Model"):
    """
    Đọc file responses → tính metrics (quiz) + Gemini score-based judge.
    Ghi từng score ra JSONL ngay khi có kết quả (hỗ trợ resume).

    Args:
        test_file:      Đường dẫn file test (.jsonl)
        responses_path: File JSONL chứa responses của model
        scores_path:    File JSONL output cho từng item score
        task_type:      "quiz" hoặc "explanation"
        label:          Tên hiển thị

    Returns:
        dict với keys: label, task_type, scores (avg + per-item), metrics (nếu quiz)
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    responses = load_jsonl(responses_path)

    assert len(responses) == len(test_data), \
        f"responses ({len(responses)}) != test_data ({len(test_data)})"

    results = {"label": label, "task_type": task_type}

    # Quiz: tính JSON/Schema metrics
    if task_type == "quiz":
        results.update(compute_quiz_metrics(responses, label))

    # Resume: đọc scores đã có
    scores_path = Path(scores_path)
    scores_path.parent.mkdir(parents=True, exist_ok=True)
    existing_scores = []
    if scores_path.exists():
        with open(scores_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    existing_scores.append(json.loads(line))

    done = len(existing_scores)
    total = len(test_data)

    if done >= total:
        print(f"  ✅ Đã có {done}/{total} scores, bỏ qua.")
        item_scores = existing_scores[:total]
    else:
        if done > 0:
            print(f"  ↩ Resume: đã có {done}/{total}, tiếp tục từ item {done}...")

        # LLM Judge
        print(f"  Scoring with Gemini: {label} ({task_type})...")
        client = create_judge_client()
        item_scores = list(existing_scores)

        criteria_keys = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA

        with open(scores_path, "a", encoding="utf-8") as out:
            for i in range(done, total):
                prompt = get_user_prompt(test_data[i], task_type)
                reference = _get_gold_reference(test_data[i], task_type) or "N/A"
                resp = responses[i]
                resp_str = json.dumps(resp, ensure_ascii=False) if isinstance(resp, dict) else resp
                score = _judge_score(client, prompt, resp_str, reference, task_type)
                item_scores.append(score)

                out.write(json.dumps(score, ensure_ascii=False) + "\n")
                out.flush()

                if (i + 1) % 10 == 0:
                    print(f"    Scored: {i+1}/{total}")

    # Tính trung bình
    criteria_keys = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA
    avg_overall = sum(s["overall"] for s in item_scores) / total
    avg_criteria = {}
    for key in criteria_keys:
        vals = [s["criteria"].get(key, 5) for s in item_scores]
        avg_criteria[key] = sum(vals) / len(vals)

    results["scores"] = {
        "overall": round(avg_overall, 2),
        "criteria": {k: round(v, 2) for k, v in avg_criteria.items()},
        "total": total,
        "item_scores": item_scores,
    }
    print(f"  Done! {label} — Overall: {avg_overall:.2f}/10")
    return results


# ==============================================================================
# EXPORT PROMPTS (dùng thủ công trên GPT/Claude web)
# ==============================================================================
def step_export_prompts(test_file, responses_path, output_dir, task_type="quiz", label="Model"):
    """
    Sinh file prompt đánh giá cho từng item, để dùng thủ công trên ChatGPT/Claude.

    Mỗi file chứa đầy đủ prompt (rubric + data) — chỉ cần copy-paste.
    Output JSON response từ LLM rồi lưu vào item_scores JSONL.

    Args:
        test_file:      Đường dẫn file test (.jsonl)
        responses_path: File JSONL chứa responses của model
        output_dir:     Thư mục output cho các file prompt
        task_type:      "quiz" hoặc "explanation"
        label:          Tên hiển thị
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    responses = load_jsonl(responses_path)

    assert len(responses) == len(test_data), \
        f"responses ({len(responses)}) != test_data ({len(test_data)})"

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total = len(test_data)
    for i in range(total):
        prompt = get_user_prompt(test_data[i], task_type)
        reference = _get_gold_reference(test_data[i], task_type) or "N/A"
        resp = responses[i]
        resp_str = json.dumps(resp, ensure_ascii=False) if isinstance(resp, dict) else resp

        if task_type == "quiz":
            content = QUIZ_SCORE_TEMPLATE.format(prompt=prompt, response=resp_str, reference=reference)
        else:
            content = EXPLANATION_SCORE_TEMPLATE.format(prompt=prompt, response=resp_str, reference=reference)

        file_path = output_dir / f"item_{i+1:03d}.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"  ✅ Exported {total} prompts → {output_dir}")
    return total
