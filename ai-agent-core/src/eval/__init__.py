"""
src.eval — Evaluation package for EduBoost AI models.

Modules:
  - client:   Shared config, paths, API clients, IO helpers
  - generate: Sinh responses qua API server
  - judge:    GPT-4o score-based judge + quiz metrics
  - report:   Console formatting
  - visualize: Score chart generation
"""
from .client import (
    JUDGE_MODEL,
    OPENAI_API_KEY,
    create_inference_client,
    create_judge_client,
    load_config,
    get_config,
    save_json,
    load_json,
    load_jsonl,
    save_results,
    RESPONSES_DIR,
    RESULTS_DIR,
)
from .generate import step_generate
from .judge import compute_quiz_metrics, score_quiz_json_format, step_judge_score
from .report import print_header, print_score_table, print_status
from .visualize import generate_pair_visualizations
