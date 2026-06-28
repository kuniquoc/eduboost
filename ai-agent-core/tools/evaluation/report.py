"""Console reporting helpers for evaluation pipeline."""

from __future__ import annotations


def print_header(title: str) -> None:
    print(f"\n{'━' * 72}")
    print(f"  {title}")
    print(f"{'━' * 72}")


def print_score_table(all_results: list[dict]) -> None:
    """Print model score comparison table for the same task."""
    if not all_results:
        print("  No results available.")
        return

    all_results = sorted(all_results, key=lambda row: row["scores"]["overall"], reverse=True)
    task_type = all_results[0]["task_type"]
    criteria_keys = list(all_results[0]["scores"]["criteria"].keys())
    is_quiz = task_type == "quiz"

    col_model = 24
    col_score = 9
    header_cells = [f"{'Model':<{col_model}}", f"{'Overall':>{col_score}}"]
    for key in criteria_keys:
        header_cells.append(f"{key[:col_score]:>{col_score}}")
    if is_quiz:
        header_cells.extend([f"{'JSON%':>{col_score}}", f"{'Schema%':>{col_score}}"])

    sep_cells = ["─" * col_model] + ["─" * col_score] * (len(header_cells) - 1)
    print("\n  🤖 LLM-as-a-Judge Scores (GPT-4o, scale 1-10)")
    print(f"  ┌{'┬'.join(sep_cells)}┐")
    print(f"  │{'│'.join(header_cells)}│")
    print(f"  ├{'┼'.join(sep_cells)}┤")

    for result in all_results:
        label = result["label"][:col_model].ljust(col_model)
        row_cells = [label, f"{result['scores']['overall']:>{col_score}.2f}"]
        for key in criteria_keys:
            row_cells.append(f"{result['scores']['criteria'].get(key, 0):>{col_score}.2f}")
        if is_quiz:
            json_key = f"{result['label']}_json_rate"
            schema_key = f"{result['label']}_schema_rate"
            row_cells.append(f"{result.get(json_key, 0):>{col_score}.1f}")
            row_cells.append(f"{result.get(schema_key, 0):>{col_score}.1f}")
        print(f"  │{'│'.join(row_cells)}│")

    print(f"  └{'┴'.join(sep_cells)}┘")
    print(f"  Evaluated items: {all_results[0]['scores']['total']}\n")


def print_status(models, tasks, default_base_url, responses_dir, results_dir, config_path) -> None:
    """Print generate/judge/report readiness for each model and task."""
    print(f"\n{'━' * 72}")
    print("  EVALUATION STATUS")
    print(f"{'━' * 72}\n")

    for index, model in enumerate(models):
        name = model["name"]
        adapter = model.get("adapter", "-")
        print(f"  [{index}] {name}")
        print(f"      base_model: {model['base_model']}")
        print(f"      adapter:    {adapter}")

        for task_name in tasks.keys():
            response_files = sorted(responses_dir.glob(f"{task_name}_{name}_responses_*"))
            score_files = sorted(results_dir.glob(f"{task_name}_{name}_scores_*"))
            response_status = f"✅ {response_files[-1].name}" if response_files else "❌"
            score_status = f"✅ {score_files[-1].name}" if score_files else "❌"
            print(f"      [{task_name}] generate: {response_status} | judge: {score_status}")
        print()

    print("  Commands:")
    print("    generate --model <idx> --task <task>")
    print("    judge --model <idx> --task <task>")
    print("    report --model <i> <j> ... --task <task>")
    print("    visualize --model <i> <j> --task <task|all>")
    print("    visualize-pairs")
    print(f"\n  Default server: {default_base_url}")
    print(f"  Config file:    {config_path}")
