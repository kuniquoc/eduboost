"""CLI entrypoint for `src.eval` pipeline."""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
from typing import Any

from .client import CONFIG_PATH, RESPONSES_DIR, RESULTS_DIR, ROOT_DIR, get_config, load_json, save_results
from .generate import step_generate
from .judge import step_export_prompts, step_judge_score
from .migrate_responses import migrate_responses_file
from .report import print_header, print_score_table, print_status
from .visualize import generate_pair_visualizations

TODAY = date.today().strftime("%Y%m%d")
TASK_ALIASES = {"quiz_generation": "quiz", "explanation": "explanation", "quiz": "quiz"}


def _get_response_path(task_type: str, name: str) -> Path:
    return RESPONSES_DIR / f"{task_type}_{name}_responses_{TODAY}.jsonl"


def _get_scores_jsonl_path(task_type: str, name: str) -> Path:
    return RESULTS_DIR / f"{task_type}_{name}_item_scores_{TODAY}.jsonl"


def _get_scores_path(task_type: str, name: str) -> Path:
    return RESULTS_DIR / f"{task_type}_{name}_scores_{TODAY}.json"


def _find_latest(directory: Path, task_type: str, name: str, kind: str) -> Path | None:
    matches = sorted(directory.glob(f"{task_type}_{name}_{kind}_*"))
    return matches[-1] if matches else None


def _validate(model_index: int, task_type: str, models: list[dict[str, Any]], tasks: dict[str, Any]) -> None:
    if model_index >= len(models):
        raise ValueError(f"Invalid model index {model_index}. Range: 0..{len(models)-1}")
    if task_type not in tasks:
        raise ValueError(f"Invalid task '{task_type}'. Available: {', '.join(tasks.keys())}")


def _normalize_task(task_name: str) -> str:
    normalized = TASK_ALIASES.get(task_name, task_name)
    return normalized


def cmd_generate(args: argparse.Namespace) -> None:
    models, tasks, default_base_url = get_config()
    task_name = _normalize_task(args.task)
    _validate(args.model_index, task_name, models, tasks)

    model = models[args.model_index]
    model_id = model.get("adapter") or model["base_model"]
    model_name = model["name"]
    base_url = args.url or model.get("base_url") or default_base_url
    test_file = str(ROOT_DIR / tasks[task_name]["test_file"])
    output_file = str(_get_response_path(task_name, model_name))

    print_header(f"B1 GENERATE - {model_name} ({task_name})")
    print(f"  Server:    {base_url}")
    print(f"  Model ID:  {model_id}")
    print(f"  Test file: {tasks[task_name]['test_file']}")
    print(f"  Output:    {Path(output_file).relative_to(ROOT_DIR)}")
    step_generate(base_url, model_id, test_file, output_file, label=model_name, task_type=task_name)


def cmd_judge(args: argparse.Namespace) -> None:
    models, tasks, _ = get_config()
    task_name = _normalize_task(args.task)
    _validate(args.model_index, task_name, models, tasks)

    model = models[args.model_index]
    model_name = model["name"]
    response_path = _find_latest(RESPONSES_DIR, task_name, model_name, "responses")
    if not response_path:
        print(f"⚠ Missing response file for [{model_name}] ({task_name}).")
        return

    item_scores_path = _get_scores_jsonl_path(task_name, model_name)
    summary_path = _get_scores_path(task_name, model_name)
    print_header(f"B2 JUDGE - {model_name} ({task_name})")
    print(f"  Responses: {response_path.name}")
    print(f"  ItemScores:{item_scores_path.name}")

    results = step_judge_score(
        test_file=str(ROOT_DIR / tasks[task_name]["test_file"]),
        responses_path=str(response_path),
        scores_path=str(item_scores_path),
        task_type=task_name,
        label=model_name,
    )
    save_results(results, summary_path)
    print(f"  Summary:   {summary_path.name}")


def cmd_export_prompts(args: argparse.Namespace) -> None:
    models, tasks, _ = get_config()
    task_name = _normalize_task(args.task)
    _validate(args.model_index, task_name, models, tasks)

    model_name = models[args.model_index]["name"]
    response_path = _find_latest(RESPONSES_DIR, task_name, model_name, "responses")
    if not response_path:
        print(f"⚠ Missing response file for [{model_name}] ({task_name}).")
        return

    output_dir = RESULTS_DIR / f"{task_name}_{model_name}_prompts_{TODAY}"
    print_header(f"EXPORT PROMPTS - {model_name} ({task_name})")
    print(f"  Responses: {response_path.name}")
    print(f"  Output:    {output_dir.relative_to(ROOT_DIR)}")

    step_export_prompts(
        test_file=str(ROOT_DIR / tasks[task_name]["test_file"]),
        responses_path=str(response_path),
        output_dir=str(output_dir),
        task_type=task_name,
        label=model_name,
    )


def cmd_report(args: argparse.Namespace) -> None:
    models, tasks, _ = get_config()
    task_name = _normalize_task(args.task)
    if task_name not in tasks:
        raise ValueError(f"Invalid task '{task_name}'. Available: {', '.join(tasks.keys())}")

    results = []
    for model_index in args.model_indices:
        if model_index >= len(models):
            print(f"⚠ Invalid model index {model_index}, skipped.")
            continue
        model_name = models[model_index]["name"]
        score_path = _find_latest(RESULTS_DIR, task_name, model_name, "scores")
        if not score_path:
            print(f"⚠ [{model_index}] {model_name} has no scores for task {task_name}.")
            continue
        results.append(load_json(score_path))

    if not results:
        print("⚠ No score files found for report.")
        return

    print_header(f"B3 REPORT - {task_name} models={args.model_indices}")
    print_score_table(results)


def cmd_visualize(args: argparse.Namespace) -> None:
    models, tasks, _ = get_config()
    if len(args.model_indices) != 2:
        raise ValueError("visualize requires exactly two model indices.")
    a_idx, b_idx = args.model_indices
    if a_idx >= len(models) or b_idx >= len(models):
        raise ValueError("Invalid model indices for visualize.")

    selected_tasks = list(tasks.keys()) if args.task == "all" else [_normalize_task(args.task)]
    for task_name in selected_tasks:
        if task_name not in tasks:
            raise ValueError(f"Invalid task '{task_name}'.")

    model_a = models[a_idx]["name"]
    model_b = models[b_idx]["name"]
    pair_name = args.pair_name or f"{model_a}_vs_{model_b}"

    print_header(f"VISUALIZE - {pair_name}")
    generated_paths = []
    for task_name in selected_tasks:
        score_a = _find_latest(RESULTS_DIR, task_name, model_a, "scores")
        score_b = _find_latest(RESULTS_DIR, task_name, model_b, "scores")
        if not score_a or not score_b:
            print(f"  ⚠ Skip task={task_name}: missing score file for one/both models.")
            continue
        result_a = load_json(score_a)
        result_b = load_json(score_b)
        paths = generate_pair_visualizations(
            result_a=result_a,
            result_b=result_b,
            task_type=task_name,
            output_dir=RESULTS_DIR / "charts",
            pair_name=pair_name,
        )
        generated_paths.extend(paths)
        print(f"  ✅ {task_name}: generated {len(paths)} chart(s)")

    if generated_paths:
        print("  Chart files:")
        for path in generated_paths:
            print(f"    - {path}")
    else:
        print("  No charts generated.")


def cmd_visualize_pairs(_: argparse.Namespace) -> None:
    config = load_json(CONFIG_PATH)
    pairs = config.get("comparison_pairs", {})
    models = config.get("models", [])
    tasks = config.get("tasks", {})
    if not pairs:
        print("⚠ No comparison_pairs configured in eval_config.json.")
        return

    pair_specs = []
    for pair_name, indices in pairs.items():
        if not isinstance(indices, list) or len(indices) != 2:
            print(f"⚠ Skip invalid pair config: {pair_name}={indices}")
            continue
        left, right = indices
        if left >= len(models) or right >= len(models):
            print(f"⚠ Skip out-of-range pair: {pair_name}={indices}")
            continue
        pair_specs.append((pair_name, left, right))

    if not pair_specs:
        print("⚠ No valid pair specs found.")
        return

    print_header("VISUALIZE DEFAULT PAIRS")
    for pair_name, left, right in pair_specs:
        model_a = models[left]["name"]
        model_b = models[right]["name"]

        if "quiz" in pair_name:
            selected_tasks = ["quiz"]
        elif "explanation" in pair_name:
            selected_tasks = ["explanation"]
        else:
            selected_tasks = list(tasks.keys())

        print(f"  Pair: {pair_name} ({model_a} vs {model_b})")
        for task_name in selected_tasks:
            score_a = _find_latest(RESULTS_DIR, task_name, model_a, "scores")
            score_b = _find_latest(RESULTS_DIR, task_name, model_b, "scores")
            if not score_a or not score_b:
                print(f"    ⚠ Skip task={task_name}: missing score file")
                continue
            paths = generate_pair_visualizations(
                result_a=load_json(score_a),
                result_b=load_json(score_b),
                task_type=task_name,
                output_dir=RESULTS_DIR / "charts",
                pair_name=pair_name,
            )
            print(f"    ✅ {task_name}: {len(paths)} chart(s)")


def cmd_status(_: argparse.Namespace) -> None:
    models, tasks, default_base_url = get_config()
    print_status(
        models=models,
        tasks=tasks,
        default_base_url=default_base_url,
        responses_dir=RESPONSES_DIR,
        results_dir=RESULTS_DIR,
        config_path=CONFIG_PATH.relative_to(ROOT_DIR),
    )


def cmd_migrate_responses(args: argparse.Namespace) -> None:
    task_name = _normalize_task(args.task)
    if task_name not in {"quiz", "explanation"}:
        raise ValueError("migrate-responses only supports task types: quiz, explanation")

    print_header(f"MIGRATE RESPONSES - {task_name}")
    print(f"  Input:    {Path(args.input).resolve()}")
    if args.in_place:
        print("  Output:   in-place (overwrite input)")
    elif args.output:
        print(f"  Output:   {Path(args.output).resolve()}")
    else:
        print("  Output:   <input>_migrated.jsonl")
    print(f"  Model:    {args.model_label}")

    output_path = migrate_responses_file(
        input_file=args.input,
        output_file=args.output,
        task_type=task_name,
        model_label=args.model_label,
        in_place=args.in_place,
        overwrite=args.overwrite,
    )
    print(f"  ✅ Migrated -> {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval runner for src.eval")
    subparsers = parser.add_subparsers(dest="command")

    p_generate = subparsers.add_parser("generate", help="Step 1: generate responses")
    p_generate.add_argument("--model", type=int, required=True, dest="model_index")
    p_generate.add_argument("--task", type=str, required=True)
    p_generate.add_argument("--url", type=str, default=None)

    p_judge = subparsers.add_parser("judge", help="Step 2: judge with GPT-4o")
    p_judge.add_argument("--model", type=int, required=True, dest="model_index")
    p_judge.add_argument("--task", type=str, required=True)

    p_report = subparsers.add_parser("report", help="Step 3: report comparison table")
    p_report.add_argument("--model", type=int, nargs="+", required=True, dest="model_indices")
    p_report.add_argument("--task", type=str, required=True)

    p_export = subparsers.add_parser("export-prompts", help="Export judge prompts")
    p_export.add_argument("--model", type=int, required=True, dest="model_index")
    p_export.add_argument("--task", type=str, required=True)

    p_visual = subparsers.add_parser("visualize", help="Generate comparison charts")
    p_visual.add_argument("--model", type=int, nargs=2, required=True, dest="model_indices")
    p_visual.add_argument("--task", type=str, default="all", help="quiz|explanation|all")
    p_visual.add_argument("--pair-name", type=str, default=None)

    p_migrate = subparsers.add_parser("migrate-responses", help="Migrate legacy response JSONL")
    p_migrate.add_argument("--input", type=str, required=True, help="Legacy responses JSONL path")
    p_migrate.add_argument("--task", type=str, required=True, help="quiz|explanation")
    p_migrate.add_argument("--model-label", type=str, default="legacy_migrated")
    p_migrate.add_argument("--output", type=str, default=None)
    p_migrate.add_argument("--in-place", action="store_true", dest="in_place")
    p_migrate.add_argument("--overwrite", action="store_true")

    subparsers.add_parser("visualize-pairs", help="Generate charts for configured comparison_pairs")
    subparsers.add_parser("status", help="Print evaluation status")

    args = parser.parse_args()
    command_map = {
        "generate": cmd_generate,
        "judge": cmd_judge,
        "report": cmd_report,
        "export-prompts": cmd_export_prompts,
        "visualize": cmd_visualize,
        "visualize-pairs": cmd_visualize_pairs,
        "status": cmd_status,
        "migrate-responses": cmd_migrate_responses,
    }
    if args.command not in command_map:
        parser.print_help()
        return
    command_map[args.command](args)


if __name__ == "__main__":
    main()
