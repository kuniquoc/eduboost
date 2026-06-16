"""Generation step for evaluation pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .client import create_inference_client


SYSTEM_PROMPTS = {
    "quiz": (
        "You are an expert English quiz generator for a language learning app.\n"
        "Generate one multiple-choice question.\n\n"
        "STRICT output contract:\n"
        "- Return only valid JSON.\n"
        "- Include keys: topic, difficulty, context, output.\n"
        "- output must include exactly: question, options, correct_answer, explanation.\n"
        "- options must contain exactly 4 strings.\n"
        "- explanation must be in Vietnamese (1-2 sentences)."
    ),
    "explanation": (
        "You are a Socratic English tutor for Vietnamese learners.\n"
        "Guide students to self-correct without giving the final answer directly.\n"
        "Respond in Vietnamese in 2-4 concise sentences."
    ),
}


def _build_messages(item: dict[str, Any], task_type: str) -> list[dict[str, str]]:
    """Build task-specific messages from a raw dataset item."""
    system = SYSTEM_PROMPTS[task_type]
    if task_type == "quiz":
        user_content = (
            f"Generate a multiple-choice question about {item['topic']}.\n"
            f"Target difficulty (IRT Beta): {item['difficulty']}\n"
            f"Context: {item.get('context', '')}\n"
            "Return only one JSON object."
        )
    else:
        user_content = (
            f"Topic: {item['topic']} (Level: {item['level']})\n"
            f"Student input: \"{item['student_input']}\"\n"
            f"Reference answer: \"{item['correct_answer']}\"\n"
            "Give Socratic feedback in Vietnamese."
        )
    return [{"role": "system", "content": system}, {"role": "user", "content": user_content}]


def get_user_prompt(item: dict[str, Any], task_type: str) -> str:
    """Return user prompt text from item for judge context."""
    messages = item.get("messages")
    if isinstance(messages, list) and len(messages) > 1:
        return messages[1]["content"]
    return _build_messages(item, task_type)[1]["content"]


def _try_parse_json(text: str) -> dict[str, Any] | list[Any] | None:
    """Try parsing model output as JSON."""
    try:
        return json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return None


def step_generate(
    base_url: str,
    model_name: str,
    test_file: str,
    output_file: str,
    label: str = "model",
    task_type: str = "quiz",
) -> None:
    """Generate model outputs and append them into a JSONL file with resume support."""
    with open(test_file, "r", encoding="utf-8") as handle:
        test_data = [json.loads(line) for line in handle]

    total = len(test_data)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    completed = 0
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as handle:
            completed = sum(1 for line in handle if line.strip())

    if completed >= total:
        print(f"  ✅ Responses already completed: {completed}/{total}.")
        return

    if completed:
        print(f"  ↩ Resume from {completed}/{total}")

    client = create_inference_client(base_url)
    print(f"  Generating {total - completed} responses from [{label}]")
    print(f"  Server: {base_url} | Model: {model_name}")

    with open(output_path, "a", encoding="utf-8") as out:
        for index in range(completed, total):
            item = test_data[index]
            messages = item.get("messages") or _build_messages(item, task_type)
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=512,
                temperature=0,
            )
            text = response.choices[0].message.content.strip()
            parsed = _try_parse_json(text)
            record = {
                "record_id": index,
                "task_type": task_type,
                "model": label,
                "response_text": text,
                "parsed_json": parsed,
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()

            if (index + 1) % 10 == 0 or index + 1 == total:
                print(f"    Progress: {index + 1}/{total}")

    print(f"  💾 Saved responses -> {output_path}")