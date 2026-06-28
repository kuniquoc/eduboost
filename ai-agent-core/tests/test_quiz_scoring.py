from tools.evaluation.quiz_scoring import compute_quiz_metrics, score_quiz_json_format


def test_score_quiz_json_format_accepts_exact_schema():
    raw = '{"question":"Q","options":[],"correct_answer":"A","explanation":"E"}'

    result = score_quiz_json_format(raw, None)

    assert result["score"] == 10
    assert result["meta"]["required_keys_present"] is True


def test_compute_quiz_metrics_counts_json_and_schema_separately():
    responses = [
        {"parsed_json": {"question": "Q", "options": [], "correct_answer": "A", "explanation": "E"}},
        {"response_text": '{"question":"Thiếu schema"}'},
        {"response_text": "not-json"},
    ]

    metrics = compute_quiz_metrics(responses, "model")

    assert metrics["model_json_rate"] == 2 / 3 * 100
    assert metrics["model_schema_rate"] == 1 / 3 * 100
