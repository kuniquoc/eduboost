import os
import json
import openai
import yaml
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# ==============================================================================
# 1. PATH & ENV SETUP
# ==============================================================================
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "not-needed")

# Thư mục lưu responses trung gian
RESPONSES_DIR = ROOT_DIR / "training" / "evaluation" / "responses"

def load_yaml_config(config_path):
    """Hàm tiện ích để load file cấu hình YAML"""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

# ==============================================================================
# 2. API CLIENT
# ==============================================================================
def _create_inference_client(base_url, api_key=None):
    """
    Tạo OpenAI-compatible client để gọi tới model server (vLLM, Ollama, TGI, ...).
    base_url: URL của server, ví dụ:
      - Cloud:  "https://your-server.cloud/v1"
      - vLLM:   "http://localhost:8000/v1"
      - Ollama: "http://localhost:11434/v1"
    api_key:  Key xác thực, mặc định lấy từ INFERENCE_API_KEY trong .env
    """
    key = api_key or INFERENCE_API_KEY
    return openai.OpenAI(base_url=base_url, api_key=key)

# ==============================================================================
# 3. STEP-BASED EVALUATION (tách riêng generate và judge)
# ==============================================================================

def _save_responses(responses, output_path):
    """Lưu danh sách responses ra file JSON."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(responses, f, ensure_ascii=False, indent=2)
    print(f"  💾 Saved {len(responses)} responses → {output_path}")

def _load_responses(path):
    """Đọc danh sách responses từ file JSON."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def step_generate(base_url, model_name, test_file, output_file, label="model"):
    """
    STEP 1 hoặc 2: Gọi API server để sinh responses cho toàn bộ test data, lưu ra file.
    Yêu cầu model server đang chạy sẵn (vLLM, Ollama, ...).

    base_url:   URL server, vd "http://localhost:8000/v1"
    model_name: Tên model trên server, vd "models/adapters/quiz_v1" hoặc "qwen2.5:7b"
    """
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    client = _create_inference_client(base_url)
    print(f"  Generating {len(test_data)} responses from [{label}]...")
    print(f"  Server: {base_url}  |  Model: {model_name}")

    responses = []
    for i, item in enumerate(test_data):
        res = client.chat.completions.create(
            model=model_name,
            messages=item["messages"],
            max_tokens=512,
            temperature=0,
        )
        response = res.choices[0].message.content.strip()
        responses.append(response)
        if (i + 1) % 10 == 0:
            print(f"    Progress: {i+1}/{len(test_data)}")

    _save_responses(responses, output_file)
    return responses


def step_judge(test_file, responses_a_path, responses_b_path,
               task_type="quiz", label_a="Model A", label_b="Model B"):
    """
    STEP 3: Đọc 2 file responses đã sinh → gửi GPT-4o judge → trả về kết quả.
    Không cần GPU, chỉ cần OPENAI_API_KEY.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in .env file!")

    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    responses_a = _load_responses(responses_a_path)
    responses_b = _load_responses(responses_b_path)

    assert len(responses_a) == len(test_data), f"responses_a ({len(responses_a)}) != test_data ({len(test_data)})"
    assert len(responses_b) == len(test_data), f"responses_b ({len(responses_b)}) != test_data ({len(test_data)})"

    results = {"label_a": label_a, "label_b": label_b, "task_type": task_type}

    # JSON/Schema metrics cho quiz
    if task_type == "quiz":
        REQUIRED_KEYS = {"question", "options", "correct_answer", "explanation"}
        for label, responses in [(label_a, responses_a), (label_b, responses_b)]:
            json_pass = 0
            schema_pass = 0
            for r in responses:
                try:
                    parsed = json.loads(r)
                    json_pass += 1
                    if REQUIRED_KEYS.issubset(parsed.keys()):
                        schema_pass += 1
                except (json.JSONDecodeError, TypeError):
                    pass
            total = len(responses)
            results[f"{label}_json_rate"] = (json_pass / total) * 100
            results[f"{label}_schema_rate"] = (schema_pass / total) * 100

    # LLM-as-a-Judge pairwise comparison
    print(f"  Judging with GPT-4o: {label_a} vs {label_b} ({task_type})...")
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    wins_a, wins_b, ties = 0, 0, 0

    for i in range(len(test_data)):
        prompt = test_data[i]["messages"][1]["content"]

        if task_type == "quiz":
            judge_prompt = (
                f"You are evaluating two quiz outputs for an English learning app.\n\n"
                f"Input prompt: {prompt}\n\n"
                f"Response A ({label_a}):\n{responses_a[i]}\n\n"
                f"Response B ({label_b}):\n{responses_b[i]}\n\n"
                f"Evaluate based on:\n"
                f"1. Valid JSON format and complete schema\n"
                f"2. Question clarity and relevance to the topic\n"
                f"3. Distractor quality (plausible but incorrect options)\n"
                f"4. Correct answer accuracy\n"
                f"5. Explanation helpfulness\n\n"
                f"Which response produces a better quiz? Answer only 'A', 'B', or 'Tie'."
            )
        else:
            judge_prompt = (
                f"Question: {prompt}\n\n"
                f"Response A ({label_a}): {responses_a[i]}\n\n"
                f"Response B ({label_b}): {responses_b[i]}\n\n"
                f"Which one is better for a student in terms of pedagogy and accuracy? "
                f"Answer only 'A', 'B' or 'Tie'."
            )

        res = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": judge_prompt}],
        )
        verdict = res.choices[0].message.content.strip().upper()

        if 'A' in verdict:
            wins_a += 1
        elif 'B' in verdict:
            wins_b += 1
        else:
            ties += 1

        if (i + 1) % 10 == 0:
            print(f"    Judged: {i+1}/{len(test_data)}")

    total = len(test_data)
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


# ==============================================================================
# 4. RESULT SAVING
# ==============================================================================
def save_results(results, output_path):
    """Lưu kết quả eval ra file JSON với timestamp."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    results["timestamp"] = datetime.now().isoformat()
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"💾 Results saved to {output_path}")