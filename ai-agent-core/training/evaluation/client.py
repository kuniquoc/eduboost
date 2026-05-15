"""
Shared configuration: paths, environment variables, API client factory.
"""
import os
import json
import openai
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# ==============================================================================
# PATHS
# ==============================================================================
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
EVAL_DIR = Path(__file__).resolve().parent
RESPONSES_DIR = EVAL_DIR / "responses"
RESULTS_DIR = EVAL_DIR / "results"
CONFIG_PATH = EVAL_DIR / "eval_config.json"

# ==============================================================================
# ENV
# ==============================================================================
load_dotenv(dotenv_path=ROOT_DIR / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "not-needed")

# ==============================================================================
# API CLIENTS
# ==============================================================================
def create_inference_client(base_url, api_key=None):
    """
    Tạo OpenAI-compatible client để gọi model server (vLLM, Ollama, TGI).

    Args:
        base_url: URL server (vd: "http://localhost:8000/v1", "https://cloud.server/v1")
        api_key:  Key xác thực, mặc định lấy từ INFERENCE_API_KEY trong .env
    """
    return openai.OpenAI(base_url=base_url, api_key=api_key or INFERENCE_API_KEY)


def create_judge_client():
    """Tạo Gemini client qua OpenAI-compatible endpoint."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not found in .env file!")
    return openai.OpenAI(
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )


# ==============================================================================
# CONFIG
# ==============================================================================
def load_config():
    """Đọc eval_config.json."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_config():
    """Trả về (models, tasks, default_base_url) từ config."""
    cfg = load_config()
    return (
        cfg["models"],
        cfg["tasks"],
        cfg.get("default_base_url", "http://localhost:8000/v1"),
    )


# ==============================================================================
# IO HELPERS
# ==============================================================================
def save_json(data, path):
    """Lưu dict/list ra file JSON."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path):
    """Đọc file JSON."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_jsonl(path):
    """Đọc file JSONL, trả về list of strings (mỗi dòng 1 response)."""
    lines = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                lines.append(json.loads(line))
    return lines


def save_results(results, output_path):
    """Lưu kết quả eval kèm timestamp."""
    results["timestamp"] = datetime.now().isoformat()
    save_json(results, output_path)
    print(f"💾 Results saved → {output_path}")
