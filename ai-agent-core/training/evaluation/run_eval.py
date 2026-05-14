"""
=== EVALUATION RUNNER ===

Quy trình đánh giá model:
  B1. Sinh responses   — Mỗi model sinh file responses (có ngày trong tên file)
  B2. Chấm điểm        — Gửi responses cho GPT-4.1 đánh giá, sinh file kết quả (có ngày)
  B3. So sánh           — Tổng hợp các file kết quả thành bảng so sánh điểm số

Cách chạy:
  cd ai-agent-core
  python -m training.evaluation.run_eval status
  python -m training.evaluation.run_eval generate --eval 0 --model 0   (B1)
  python -m training.evaluation.run_eval generate --eval 0 --model 1   (B1)
  python -m training.evaluation.run_eval judge    --eval 0             (B2)
  python -m training.evaluation.run_eval report   [--eval 0]           (B3)

Cấu hình: training/evaluation/eval_config.json
"""
import sys
import argparse
from datetime import date
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT))

from training.evaluation.client import (
    get_evaluations, load_json, save_results,
    RESPONSES_DIR, RESULTS_DIR, CONFIG_PATH, ROOT_DIR,
)
from training.evaluation.generate import step_generate
from training.evaluation.judge import step_judge_score
from training.evaluation.report import (
    print_header, print_score_table, print_status,
)

TODAY = date.today().strftime("%Y%m%d")


def _get_response_path(task_type, label):
    """B1: responses/{task}_{label}_responses_{YYYYMMDD}.json"""
    return RESPONSES_DIR / f"{task_type}_{label}_responses_{TODAY}.json"


def _get_scores_path(task_type, label):
    """B2: results/{task}_{label}_scores_{YYYYMMDD}.json"""
    return RESULTS_DIR / f"{task_type}_{label}_scores_{TODAY}.json"


def _find_latest(directory, task_type, label, kind):
    """Tìm file mới nhất: {task}_{label}_{kind}_{date}.json"""
    matches = sorted(directory.glob(f"{task_type}_{label}_{kind}_*.json"))
    return matches[-1] if matches else None


# ==============================================================================
# B1: SINH RESPONSES
# ==============================================================================
def cmd_generate(args):
    """B1: Sinh responses từ model server, lưu file có ngày."""
    evaluations, default_base_url = get_evaluations()
    ev = evaluations[args.eval_index]
    mi = args.model_index
    models = ev["models"]

    if mi >= len(models):
        print(f"❌ Model index {mi} không hợp lệ (có {len(models)} models: 0..{len(models)-1})")
        return

    model = models[mi]
    model_name = model["name"]
    label = model["label"]
    base_url = args.url or model.get("base_url") or default_base_url
    test_file = str(ROOT_DIR / ev["test_file"])
    output_file = str(_get_response_path(ev["task_type"], label))

    print_header(f"B1 — SINH RESPONSES: [{label}] cho '{ev['name']}'")
    print(f"  Server:    {base_url}")
    print(f"  Model:     {model_name}")
    print(f"  Test file: {ev['test_file']}")
    print(f"  Output:    {Path(output_file).relative_to(ROOT_DIR)}")
    print()

    step_generate(base_url, model_name, test_file, output_file, label=label)
    print(f"\n  ✅ B1 hoàn tất! Chuyển sang model tiếp hoặc chạy judge.")


# ==============================================================================
# B2: CHẤM ĐIỂM (GPT-4.1)
# ==============================================================================
def cmd_judge(args):
    """B2: Gửi responses cho GPT-4.1 chấm điểm, lưu file kết quả có ngày."""
    evaluations, _ = get_evaluations()
    ev = evaluations[args.eval_index]
    name = ev["name"]
    models = ev["models"]

    judged_any = False
    for mi, model in enumerate(models):
        # Tìm file responses mới nhất cho model này
        resp_path = _find_latest(RESPONSES_DIR, ev["task_type"], model["label"], "responses")
        if not resp_path:
            print(f"\u26a0\ufe0f  Ch\u01b0a c\u00f3 responses cho [{model['label']}], b\u1ecf qua.")
            print(f"   Ch\u1ea1y: python -m training.evaluation.run_eval generate --eval {args.eval_index} --model {mi}")
            continue

        print_header(f"B2 \u2014 CH\u1ea4M \u0110I\u1ec2M: {model['label']} ({ev['task_type']})")
        print(f"  Responses: {resp_path.name}")
        results = step_judge_score(
            test_file=str(ROOT_DIR / ev["test_file"]),
            responses_path=str(resp_path),
            task_type=ev["task_type"],
            label=model["label"],
        )
        scores_path = _get_scores_path(ev["task_type"], model["label"])
        save_results(results, scores_path)
        print(f"  Kết quả:   {scores_path.name}")
        judged_any = True

    if judged_any:
        # B3: Hiển thị bảng tổng hợp
        cmd_report(args)


# ==============================================================================
# B3: TỔNG HỢP SO SÁNH
# ==============================================================================
def cmd_report(args):
    """B3: Tổng hợp các file kết quả và đưa ra bảng so sánh."""
    evaluations, _ = get_evaluations()

    indices = [args.eval_index] if args.eval_index is not None else range(len(evaluations))

    for idx in indices:
        ev = evaluations[idx]
        name = ev["name"]
        models = ev["models"]

        all_results = []
        for mi, model in enumerate(models):
            # Tìm file scores mới nhất cho model này
            scores_path = _find_latest(RESULTS_DIR, ev["task_type"], model["label"], "scores")
            if scores_path:
                all_results.append(load_json(scores_path))

        if not all_results:
            print(f"\n⚠️  [{idx}] '{name}' — chưa có kết quả (chạy judge trước)")
            continue

        print_header(f"B3 — SO SÁNH: [{idx}] {name} ({ev['task_type']})")
        print_score_table(all_results)


def cmd_status(args):
    evaluations, default_base_url = get_evaluations()
    print_status(evaluations, default_base_url, RESPONSES_DIR, RESULTS_DIR,
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
    p_gen.add_argument("--eval", type=int, required=True, dest="eval_index")
    p_gen.add_argument("--model", type=int, required=True, dest="model_index",
                       help="Index của model trong config (0, 1, ...)")
    p_gen.add_argument("--url", type=str, default=None, help="Override server URL")

    p_judge = sub.add_parser("judge", help="B2: GPT-4.1 chấm điểm từng model")
    p_judge.add_argument("--eval", type=int, required=True, dest="eval_index")

    p_report = sub.add_parser("report", help="B3: Tổng hợp bảng so sánh điểm số")
    p_report.add_argument("--eval", type=int, default=None, dest="eval_index")

    sub.add_parser("status", help="Xem trạng thái evaluations")

    args = parser.parse_args()
    commands = {
        "generate": cmd_generate,
        "judge": cmd_judge,
        "report": cmd_report,
        "status": cmd_status,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()
