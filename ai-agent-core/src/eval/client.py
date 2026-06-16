"""Shared paths, config, clients, and lightweight IO helpers for eval."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent.parent
EVAL_DIR = Path(__file__).resolve().parent
RESPONSES_DIR = EVAL_DIR / "responses"
RESULTS_DIR = EVAL_DIR / "results"
CONFIG_PATH = EVAL_DIR / "eval_config.json"

load_dotenv(dotenv_path=ROOT_DIR / ".env")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "not-needed")
JUDGE_MODEL = "gpt-4o"


def create_inference_client(base_url: str, api_key: str | None = None) -> Any:
    """Create an OpenAI-compatible client for model inference servers."""
    import openai

    return openai.OpenAI(base_url=base_url, api_key=api_key or INFERENCE_API_KEY)


def create_judge_client() -> Any:
    """Create OpenAI client for judge scoring (GPT-4o)."""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in .env file.")
    import openai

    return openai.OpenAI(api_key=OPENAI_API_KEY)


def load_config() -> dict[str, Any]:
    """Load `eval_config.json`."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def get_config() -> tuple[list[dict[str, Any]], dict[str, Any], str]:
    """Return `(models, tasks, default_base_url)` from config."""
    config = load_config()
    return (
        config["models"],
        config["tasks"],
        config.get("default_base_url", "http://localhost:8000/v1"),
    )


def save_json(data: dict[str, Any] | list[Any], path: str | Path) -> None:
    """Write JSON with UTF-8 and indentation."""
    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def load_json(path: str | Path) -> Any:
    """Read JSON file."""
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_jsonl(path: str | Path) -> list[Any]:
    """Read JSONL file as list of parsed JSON objects."""
    rows: list[Any] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def save_results(results: dict[str, Any], output_path: str | Path) -> None:
    """Save result object and stamp timestamp."""
    payload = dict(results)
    payload["timestamp"] = datetime.now().isoformat()
    save_json(payload, output_path)
    print(f"💾 Results saved -> {output_path}")
