"""
=== EVALUATION RUNNER ===

Quy trình đánh giá model:
  B1. Sinh responses   — Mỗi model sinh file responses (streaming JSONL, có ngày trong tên)
  B2. Chấm điểm        — Gửi responses cho GPT-4.1 đánh giá, sinh file kết quả (có ngày)
  B3. So sánh           — Chọn N model indices, tổng hợp bảng so sánh điểm số

Cách chạy:
  cd ai-agent-core
  python -m training.evaluation.run_eval status
  python -m training.evaluation.run_eval generate --model 0 --task quiz     (B1)
  python -m training.evaluation.run_eval judge    --model 0 --task quiz     (B2)
  python -m training.evaluation.run_eval report   --model 0 1 --task quiz   (B3)

Cấu hình: training/evaluation/eval_config.json
"""
import sys
import argparse
from datetime import date
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT))

from training.evaluation.client import (
    get_config, load_json, save_results,
    RESPONSES_DIR, RESULTS_DIR, CONFIG_PATH, ROOT_DIR,
)
from training.evaluation.generate import step_generate
from training.evaluation.judge import step_judge_score, step_export_prompts
from training.evaluation.report import (
    print_header, print_score_table, print_status,
)

TODAY = date.today().strftime("%Y%m%d")


def _get_response_path(task_type, name):
    """B1: responses/{task}_{name}_responses_{YYYYMMDD}.jsonl"""
    return RESPONSES_DIR / f"{task_type}_{name}_responses_{TODAY}.jsonl"


def _get_scores_jsonl_path(task_type, name):
    """B2: results/{task}_{name}_item_scores_{YYYYMMDD}.jsonl (streaming per-item)"""
    return RESULTS_DIR / f"{task_type}_{name}_item_scores_{TODAY}.jsonl"


def _get_scores_path(task_type, name):
    """B2: results/{task}_{name}_scores_{YYYYMMDD}.json (final summary)"""
    return RESULTS_DIR / f"{task_type}_{name}_scores_{TODAY}.json"


def _find_latest(directory, task_type, name, kind):
    """Tìm file mới nhất: {task}_{name}_{kind}_{date}.*"""
    matches = sorted(directory.glob(f"{task_type}_{name}_{kind}_*"))
    return matches[-1] if matches else None


# ==============================================================================
# B1: SINH RESPONSES
# ==============================================================================
def cmd_generate(args):
    """B1: Sinh responses từ model server, streaming ra JSONL."""
    models, tasks, default_base_url = get_config()
    mi = args.model_index
    task_type = args.task

    if mi >= len(models):
        print(f"❌ Model index {mi} không hợp lệ (có {len(models)} models: 0..{len(models)-1})")
        return
    if task_type not in tasks:
        print(f"❌ Task '{task_type}' không hợp lệ (có: {', '.join(tasks.keys())})")
        return

    model = models[mi]
    model_id = model.get("adapter") or model["base_model"]
    name = model["name"]
    base_url = args.url or model.get("base_url") or default_base_url
    test_file = str(ROOT_DIR / tasks[task_type]["test_file"])
    output_file = str(_get_response_path(task_type, name))

    print_header(f"B1 — SINH RESPONSES: [{name}] ({task_type})")
    print(f"  Server:     {base_url}")
    print(f"  Model:      {model_id}")
    print(f"  Test file:  {tasks[task_type]['test_file']}")
    print(f"  Output:     {Path(output_file).relative_to(ROOT_DIR)}")
    print()

    step_generate(base_url, model_id, test_file, output_file, label=name, task_type=task_type)
    print(f"\n  ✅ B1 hoàn tất!")


# ==============================================================================
# B2: CHẤM ĐIỂM (GPT-4.1)
# ==============================================================================
def cmd_judge(args):
    """B2: Gửi responses cho GPT-4.1 chấm điểm, lưu file kết quả có ngày."""
    models, tasks, _ = get_config()
    mi = args.model_index
    task_type = args.task

    if mi >= len(models):
        print(f"❌ Model index {mi} không hợp lệ (có {len(models)} models: 0..{len(models)-1})")
        return
    if task_type not in tasks:
        print(f"❌ Task '{task_type}' không hợp lệ (có: {', '.join(tasks.keys())})")
        return

    model = models[mi]
    name = model["name"]

    resp_path = _find_latest(RESPONSES_DIR, task_type, name, "responses")
    if not resp_path:
        print(f"⚠️  Chưa có responses cho [{name}] ({task_type}), bỏ qua.")
        print(f"   Chạy: python -m training.evaluation.run_eval generate --model {mi} --task {task_type}")
        return

    scores_jsonl = _get_scores_jsonl_path(task_type, name)
    scores_path = _get_scores_path(task_type, name)

    print_header(f"B2 — CHẤM ĐIỂM: {name} ({task_type})")
    print(f"  Responses: {resp_path.name}")
    print(f"  Scores:    {scores_jsonl.name}")
    results = step_judge_score(
        test_file=str(ROOT_DIR / tasks[task_type]["test_file"]),
        responses_path=str(resp_path),
        scores_path=str(scores_jsonl),
        task_type=task_type,
        label=name,
    )
    save_results(results, scores_path)
    print(f"  Kết quả:   {scores_path.name}")


# ==============================================================================
# EXPORT PROMPTS (dùng thủ công)
# ==============================================================================
def cmd_export_prompts(args):
    """Xuất prompt đánh giá ra từng file .txt để dùng trên GPT/Claude web."""
    models, tasks, _ = get_config()
    mi = args.model_index
    task_type = args.task

    if mi >= len(models):
        print(f"❌ Model index {mi} không hợp lệ (có {len(models)} models: 0..{len(models)-1})")
        return
    if task_type not in tasks:
        print(f"❌ Task '{task_type}' không hợp lệ (có: {', '.join(tasks.keys())})")
        return

    model = models[mi]
    name = model["name"]

    resp_path = _find_latest(RESPONSES_DIR, task_type, name, "responses")
    if not resp_path:
        print(f"⚠️  Chưa có responses cho [{name}] ({task_type}), bỏ qua.")
        print(f"   Chạy: python -m training.evaluation.run_eval generate --model {mi} --task {task_type}")
        return

    output_dir = RESULTS_DIR / f"{task_type}_{name}_prompts_{TODAY}"

    print_header(f"EXPORT PROMPTS: {name} ({task_type})")
    print(f"  Responses: {resp_path.name}")
    print(f"  Output:    {output_dir.relative_to(ROOT_DIR)}")
    step_export_prompts(
        test_file=str(ROOT_DIR / tasks[task_type]["test_file"]),
        responses_path=str(resp_path),
        output_dir=str(output_dir),
        task_type=task_type,
        label=name,
    )


# ==============================================================================
# B3: TỔNG HỢP SO SÁNH
# ==============================================================================
def cmd_report(args):
    """B3: Tổng hợp các file kết quả từ N models và đưa ra bảng so sánh."""
    models, tasks, _ = get_config()
    task_type = args.task
    model_indices = args.model_indices

    if task_type not in tasks:
        print(f"❌ Task '{task_type}' không hợp lệ (có: {', '.join(tasks.keys())})")
        return

    all_results = []
    for mi in model_indices:
        if mi >= len(models):
            print(f"⚠️  Model index {mi} không hợp lệ, bỏ qua.")
            continue
        name = models[mi]["name"]
        scores_path = _find_latest(RESULTS_DIR, task_type, name, "scores")
        if scores_path:
            all_results.append(load_json(scores_path))
        else:
            print(f"⚠️  [{mi}] {name} — chưa có scores cho {task_type}")

    if not all_results:
        print(f"\n⚠️  Không có kết quả nào để so sánh.")
        return

    print_header(f"B3 — SO SÁNH: {task_type} (models: {model_indices})")
    print_score_table(all_results)


def cmd_status(args):
    models, tasks, default_base_url = get_config()
    print_status(models, tasks, default_base_url, RESPONSES_DIR, RESULTS_DIR,
                 CONFIG_PATH.relative_to(ROOT_DIR))


# ==============================================================================
# MAIN
# ==============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluation Runner",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command")

    p_gen = sub.add_parser("generate", help="B1: Sinh responses từ model server")
    p_gen.add_argument("--model", type=int, required=True, dest="model_index",
                       help="Index của model trong config (0, 1, ...)")
    p_gen.add_argument("--task", type=str, required=True,
                       help="Task type: quiz, explanation")
    p_gen.add_argument("--url", type=str, default=None, help="Override server URL")

    p_judge = sub.add_parser("judge", help="B2: GPT-4.1 chấm điểm")
    p_judge.add_argument("--model", type=int, required=True, dest="model_index",
                         help="Index của model trong config")
    p_judge.add_argument("--task", type=str, required=True,
                         help="Task type: quiz, explanation")

    p_report = sub.add_parser("report", help="B3: Tổng hợp bảng so sánh điểm số")
    p_report.add_argument("--model", type=int, nargs="+", required=True, dest="model_indices",
                          help="Indices của các models cần so sánh (vd: --model 0 1 2)")
    p_report.add_argument("--task", type=str, required=True,
                          help="Task type: quiz, explanation")

    p_export = sub.add_parser("export-prompts", help="Xuất prompt đánh giá ra file .txt")
    p_export.add_argument("--model", type=int, required=True, dest="model_index",
                          help="Index của model trong config")
    p_export.add_argument("--task", type=str, required=True,
                          help="Task type: quiz, explanation")

    sub.add_parser("status", help="Xem trạng thái evaluations")

    args = parser.parse_args()
    commands = {
        "generate": cmd_generate,
        "judge": cmd_judge,
        "export-prompts": cmd_export_prompts,
        "report": cmd_report,
        "status": cmd_status,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()
