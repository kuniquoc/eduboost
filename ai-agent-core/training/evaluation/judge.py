"""
Step Judge: Đọc 2 file responses → tính metrics + GPT-4o pairwise judge.
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
# LLM-AS-A-JUDGE
# ==============================================================================
QUIZ_JUDGE_TEMPLATE = """You are evaluating two quiz outputs for an English learning app.

Input prompt: {prompt}

Response A ({label_a}):
{response_a}

Response B ({label_b}):
{response_b}

Evaluate based on:
1. Valid JSON format and complete schema
2. Question clarity and relevance to the topic
3. Distractor quality (plausible but incorrect options)
4. Correct answer accuracy
5. Explanation helpfulness

Which response produces a better quiz? Answer only 'A', 'B', or 'Tie'."""

EXPLANATION_JUDGE_TEMPLATE = """Question: {prompt}

Response A ({label_a}): {response_a}

Response B ({label_b}): {response_b}

Which one is better for a student in terms of pedagogy and accuracy? Answer only 'A', 'B' or 'Tie'."""


def _judge_pairwise(client, prompt, response_a, response_b, label_a, label_b, task_type):
    """Gọi GPT-4o judge cho 1 cặp response. Trả về 'A', 'B', hoặc 'Tie'."""
    if task_type == "quiz":
        content = QUIZ_JUDGE_TEMPLATE.format(
            prompt=prompt, response_a=response_a, response_b=response_b,
            label_a=label_a, label_b=label_b,
        )
    else:
        content = EXPLANATION_JUDGE_TEMPLATE.format(
            prompt=prompt, response_a=response_a, response_b=response_b,
            label_a=label_a, label_b=label_b,
        )

    res = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
    )
    verdict = res.choices[0].message.content.strip().upper()

    if 'A' in verdict:
        return 'A'
    elif 'B' in verdict:
        return 'B'
    return 'Tie'


# ==============================================================================
# MAIN STEP
# ==============================================================================
def step_judge(test_file, responses_a_path, responses_b_path,
               task_type="quiz", label_a="Model A", label_b="Model B"):
    """
    Đọc 2 file responses → tính metrics (quiz) + GPT-4o pairwise judge.

    Args:
        test_file:         Đường dẫn file test (.jsonl)
        responses_a_path:  File JSON chứa responses model A
        responses_b_path:  File JSON chứa responses model B
        task_type:         "quiz" hoặc "explanation"
        label_a/label_b:   Tên hiển thị

    Returns:
        dict với keys: label_a, label_b, task_type, judge, và metrics (nếu quiz)
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    responses_a = load_json(responses_a_path)
    responses_b = load_json(responses_b_path)

    assert len(responses_a) == len(test_data), \
        f"responses_a ({len(responses_a)}) != test_data ({len(test_data)})"
    assert len(responses_b) == len(test_data), \
        f"responses_b ({len(responses_b)}) != test_data ({len(test_data)})"

    results = {"label_a": label_a, "label_b": label_b, "task_type": task_type}

    # Quiz: tính JSON/Schema metrics
    if task_type == "quiz":
        results.update(compute_quiz_metrics(responses_a, label_a))
        results.update(compute_quiz_metrics(responses_b, label_b))

    # LLM Judge
    print(f"  Judging with GPT-4o: {label_a} vs {label_b} ({task_type})...")
    client = create_judge_client()
    wins_a, wins_b, ties = 0, 0, 0
    total = len(test_data)

    for i in range(total):
        prompt = test_data[i]["messages"][1]["content"]
        verdict = _judge_pairwise(
            client, prompt, responses_a[i], responses_b[i],
            label_a, label_b, task_type,
        )
        if verdict == 'A':
            wins_a += 1
        elif verdict == 'B':
            wins_b += 1
        else:
            ties += 1

        if (i + 1) % 10 == 0:
            print(f"    Judged: {i+1}/{total}")

    results["judge"] = {
        "wins_a": wins_a,
        "wins_b": wins_b,
        "ties": ties,
        "total": total,
        "label_a": label_a,
        "label_b": label_b,
        "win_rate_a": (wins_a / total) * 100,
    }
    print(f"  Done! {label_a} wins {wins_a}, {label_b} wins {wins_b}, Ties {ties}")
    return results
