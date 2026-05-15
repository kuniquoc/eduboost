"""
Step Generate: Gọi API server để sinh responses từ 1 model, lưu ra file.
"""
import json
from pathlib import Path
from .client import create_inference_client, RESPONSES_DIR

SYSTEM_PROMPTS = {
    "quiz": (
        "You are an expert English quiz generator for a language learning app.\n"
        "Your task is to create high-quality multiple-choice questions that test English grammar, vocabulary, or usage.\n\n"
        "Requirements:\n"
        "- Output MUST be valid JSON with exactly these keys: \"question\", \"options\", \"correct_answer\", \"explanation\"\n"
        "- \"question\": A clear, natural English sentence with a blank (___) where the answer goes\n"
        "- \"options\": Exactly 4 choices — 1 correct + 3 plausible distractors\n"
        "- \"correct_answer\": Must exactly match one of the options\n"
        "- \"explanation\": A brief explanation in Vietnamese (1-2 sentences) why the correct answer is right\n"
        "- Match the target difficulty level (IRT Beta scale from -3 to 3): -3 = very easy (beginner), 0 = medium, +3 = very hard (advanced)\n"
        "- Use the provided context/theme to shape the question scenario\n"
        "- Do NOT output anything outside the JSON object"
    ),
    "explanation": (
        "You are a Socratic English tutor for Vietnamese students learning English.\n"
        "Your role is to guide students to discover and correct their own mistakes, NOT to give the answer directly.\n\n"
        "Requirements:\n"
        "- Respond in Vietnamese\n"
        "- Use a warm, encouraging tone appropriate for the student's level\n"
        "- Point out the specific error area without stating the correction\n"
        "- Ask a guiding question that leads the student to the right answer\n"
        "- Reference the relevant grammar rule or pattern\n"
        "- Keep the response concise (2-4 sentences)\n"
        "- Do NOT reveal the correct answer directly — let the student figure it out"
    ),
}


def _build_messages(item, task_type):
    """Build chat messages from raw gold dataset item."""
    system = SYSTEM_PROMPTS[task_type]
    if task_type == "quiz":
        user_content = (
            f"Generate a multiple-choice question about {item['topic']}.\n"
            f"Target Difficulty (IRT Beta): {item['difficulty']}\n"
            f"Context: {item['context']}\n\n"
            f"Output format:\n"
            f'{{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "...", "explanation": "..."}}'
        )
    else:  # explanation
        user_content = (
            f"Topic: {item['topic']} (Level: {item['level']})\n"
            f"Student wrote: \"{item['student_input']}\"\n"
            f"Correct answer: \"{item['correct_answer']}\"\n\n"
            f"Guide the student to find and fix the error using the Socratic method."
        )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]


def get_user_prompt(item, task_type):
    """Trả về user prompt content từ raw gold item (dùng chung cho generate + judge)."""
    messages = item.get("messages")
    if messages:
        return messages[1]["content"]
    return _build_messages(item, task_type)[1]["content"]


def step_generate(base_url, model_name, test_file, output_file, label="model", task_type="quiz"):
    """
    Gọi model server sinh responses cho toàn bộ test data.
    Ghi streaming ra file JSONL — mỗi response ghi ngay 1 dòng.
    Hỗ trợ resume: nếu output file đã có N dòng, skip N items đầu.

    Args:
        base_url:    URL server (vd: "http://localhost:8000/v1")
        model_name:  Tên model trên server
        test_file:   Đường dẫn file test (.jsonl)
        output_file: Đường dẫn file output (.jsonl, mỗi dòng 1 response string)
        label:       Tên hiển thị khi in progress
        task_type:   "quiz" hoặc "explanation"
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    total = len(test_data)

    # Resume: đếm số dòng đã có trong output file
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    done = 0
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            done = sum(1 for line in f if line.strip())
    if done >= total:
        print(f"  ✅ Đã có đủ {total} responses, bỏ qua.")
        return
    if done > 0:
        print(f"  ↩️  Resume từ item {done}/{total} (đã có {done} responses)")

    client = create_inference_client(base_url)
    print(f"  Generating {total - done} responses from [{label}]...")
    print(f"  Server: {base_url}  |  Model: {model_name}")

    with open(output_path, "a", encoding="utf-8") as out:
        for i in range(done, total):
            item = test_data[i]
            messages = item.get("messages") or _build_messages(item, task_type)
            res = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=512,
                temperature=0,
            )
            response = res.choices[0].message.content.strip()
            # Ghi compact JSON nếu response là JSON hợp lệ, ngược lại ghi quoted string
            try:
                parsed = json.loads(response)
                line = json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, ValueError):
                line = json.dumps(response, ensure_ascii=False)
            out.write(line + "\n")
            out.flush()

            if (i + 1) % 10 == 0 or i + 1 == total:
                print(f"    Progress: {i+1}/{total}")

    print(f"  💾 Saved {total} responses → {output_file}")
