"""
training.evaluation — Evaluation package cho EduBoost AI models.

Modules:
  - client:   Shared config, paths, API clients, IO helpers
  - generate: Sinh responses qua API server
  - judge:    GPT-4o pairwise judge + quiz metrics
  - report:   Print/formatting kết quả
"""
from .client import (
    create_inference_client,
    create_judge_client,
    load_config,
    get_evaluations,
    save_json,
    load_json,
    save_results,
    RESPONSES_DIR,
    RESULTS_DIR,
)
from .generate import step_generate, get_response_path
from .judge import step_judge, compute_quiz_metrics
from .report import print_header, print_judge_results, print_status
