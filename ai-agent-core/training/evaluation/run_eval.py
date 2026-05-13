"""
=== EVALUATION RUNNER ===

Cách chạy:
  cd ai-agent-core
  python -m training.evaluation.run_eval status
  python -m training.evaluation.run_eval generate --eval 0 --side a
  python -m training.evaluation.run_eval generate --eval 0 --side b
  python -m training.evaluation.run_eval judge    --eval 0
  python -m training.evaluation.run_eval report   [--eval 0]

Cấu hình: training/evaluation/eval_config.json
"""
import sys
import argparse
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT))

from training.evaluation.client import (
    get_evaluations, load_json, save_results,
    RESPONSES_DIR, RESULTS_DIR, CONFIG_PATH, ROOT_DIR,
)
from training.evaluation.generate import step_generate, get_response_path
from training.evaluation.judge import step_judge
from training.evaluation.report import (
    print_header, print_judge_results, print_status,
)


# ==============================================================================
# COMMANDS
# ==============================================================================
def cmd_generate(args):
    evaluations, default_base_url = get_evaluations()
    ev = evaluations[args.eval_index]
    side = args.side

    model_name = ev[f"model_{side}"]
    label = ev[f"label_{side}"]
    base_url = args.url or ev.get(f"base_url_{side}") or default_base_url
    test_file = str(ROOT_DIR / ev["test_file"])
    output_file = str(get_response_path(ev["name"], side))

    print_header(f"GENERATE: [{label}] for '{ev['name']}'")
    print(f"  Server:    {base_url}")
    print(f"  Model:     {model_name}")
    print(f"  Test file: {ev['test_file']}")
    print(f"  Output:    {Path(output_file).relative_to(ROOT_DIR)}")
    print()

    step_generate(base_url, model_name, test_file, output_file, label=label)
    print(f"\n  ✅ Done! Bạn có thể tắt server và chuyển sang model tiếp.")


def cmd_judge(args):
    evaluations, _ = get_evaluations()
    ev = evaluations[args.eval_index]
    name = ev["name"]

    resp_a = get_response_path(name, "a")
    resp_b = get_response_path(name, "b")

    for p, side in [(resp_a, "a"), (resp_b, "b")]:
        if not p.exists():
            label = ev[f"label_{side}"]
            print(f"❌ Chưa có responses cho {label}!")
            print(f"   Chạy: python -m training.evaluation.run_eval generate --eval {args.eval_index} --side {side}")
            return

    print_header(f"JUDGE: {ev['label_a']} vs {ev['label_b']} ({ev['task_type']})")

    results = step_judge(
        test_file=str(ROOT_DIR / ev["test_file"]),
        responses_a_path=str(resp_a),
        responses_b_path=str(resp_b),
        task_type=ev["task_type"],
        label_a=ev["label_a"],
        label_b=ev["label_b"],
    )

    save_results(results, RESULTS_DIR / f"{name}_results.json")
    print_judge_results(results)


def cmd_report(args):
    evaluations, _ = get_evaluations()

    indices = [args.eval_index] if args.eval_index is not None else range(len(evaluations))

    for idx in indices:
        ev = evaluations[idx]
        result_file = RESULTS_DIR / f"{ev['name']}_results.json"

        if not result_file.exists():
            print(f"\n⚠️  [{idx}] '{ev['name']}' — chưa có kết quả (chạy judge trước)")
            continue

        print_header(f"[{idx}] {ev['name']}")
        print_judge_results(load_json(result_file))


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

    p_gen = sub.add_parser("generate", help="Sinh responses từ 1 model qua API server")
    p_gen.add_argument("--eval", type=int, required=True, dest="eval_index")
    p_gen.add_argument("--side", choices=["a", "b"], required=True)
    p_gen.add_argument("--url", type=str, default=None, help="Override server URL")

    p_judge = sub.add_parser("judge", help="GPT-4o judge 2 file responses")
    p_judge.add_argument("--eval", type=int, required=True, dest="eval_index")

    p_report = sub.add_parser("report", help="In báo cáo kết quả")
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
