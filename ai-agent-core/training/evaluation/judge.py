"""
B2 — Chấm điểm: Đọc file responses → tính metrics + GPT-4.1 score-based judge.
"""
import json
from .client import create_judge_client, load_json

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
            parsed = json.loads(r)
            json_pass += 1
            if QUIZ_REQUIRED_KEYS.issubset(parsed.keys()):
                schema_pass += 1
        except (json.JSONDecodeError, TypeError):
            pass
    total = len(responses)
    return {
        f"{label}_json_rate": (json_pass / total) * 100,
        f"{label}_schema_rate": (schema_pass / total) * 100,
    }


# ==============================================================================
# LLM-AS-A-JUDGE (Score-based)
# ==============================================================================
QUIZ_SCORE_TEMPLATE = """You are evaluating a quiz output for an English learning app.

Input prompt: {prompt}

Response:
{response}

Score the response on each criterion from 1 (worst) to 10 (best):
1. json_format: Valid JSON format and complete schema (question, options, correct_answer, explanation)
2. question_clarity: Question clarity and relevance to the topic
3. distractor_quality: Distractor quality (plausible but incorrect options)
4. correct_answer: Correct answer accuracy
5. explanation: Explanation helpfulness

Then give an overall score from 1-10.

Respond ONLY with JSON in this exact format:
{{"overall": <int>, "criteria": {{"json_format": <int>, "question_clarity": <int>, "distractor_quality": <int>, "correct_answer": <int>, "explanation": <int>}}, "justification": "<one sentence>"}}"""

EXPLANATION_SCORE_TEMPLATE = """You are evaluating an English grammar/vocabulary explanation for a student.

Question: {prompt}

Response:
{response}

Score the response on each criterion from 1 (worst) to 10 (best):
1. accuracy: Factual and grammatical correctness
2. pedagogy: Clear, student-friendly teaching approach
3. completeness: Covers the topic sufficiently
4. relevance: Stays on topic and addresses the question

Then give an overall score from 1-10.

Respond ONLY with JSON in this exact format:
{{"overall": <int>, "criteria": {{"accuracy": <int>, "pedagogy": <int>, "completeness": <int>, "relevance": <int>}}, "justification": "<one sentence>"}}"""

QUIZ_CRITERIA = ["json_format", "question_clarity", "distractor_quality", "correct_answer", "explanation"]
EXPLANATION_CRITERIA = ["accuracy", "pedagogy", "completeness", "relevance"]


def _judge_score(client, prompt, response, task_type):
    """Gọi GPT-4.1 judge chấm điểm 1 response. Trả về dict scores."""
    if task_type == "quiz":
        content = QUIZ_SCORE_TEMPLATE.format(prompt=prompt, response=response)
    else:
        content = EXPLANATION_SCORE_TEMPLATE.format(prompt=prompt, response=response)

    res = client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user", "content": content}],
    )
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
def step_judge_score(test_file, responses_path, task_type="quiz", label="Model"):
    """
    Đọc file responses → tính metrics (quiz) + GPT-4o score-based judge.

    Args:
        test_file:      Đường dẫn file test (.jsonl)
        responses_path: File JSON chứa responses của model
        task_type:      "quiz" hoặc "explanation"
        label:          Tên hiển thị

    Returns:
        dict với keys: label, task_type, scores (avg + per-item), metrics (nếu quiz)
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    responses = load_json(responses_path)

    assert len(responses) == len(test_data), \
        f"responses ({len(responses)}) != test_data ({len(test_data)})"

    results = {"label": label, "task_type": task_type}

    # Quiz: tính JSON/Schema metrics
    if task_type == "quiz":
        results.update(compute_quiz_metrics(responses, label))

    # LLM Judge
    print(f"  Scoring with GPT-4.1: {label} ({task_type})...")
    client = create_judge_client()
    total = len(test_data)
    item_scores = []

    criteria_keys = QUIZ_CRITERIA if task_type == "quiz" else EXPLANATION_CRITERIA

    for i in range(total):
        prompt = test_data[i]["messages"][1]["content"]
        score = _judge_score(client, prompt, responses[i], task_type)
        item_scores.append(score)

        if (i + 1) % 10 == 0:
            print(f"    Scored: {i+1}/{total}")

    # Tính trung bình
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
