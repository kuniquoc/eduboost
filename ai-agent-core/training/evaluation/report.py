"""
Report: Các hàm in kết quả evaluation ra console.
"""


def bar(value, width=20, max_val=100):
    """Vẽ progress bar text: █░"""
    ratio = value / max_val if max_val else 0
    filled = int(ratio * width)
    return f"{'█' * filled}{'░' * (width - filled)}"


def print_header(title):
    print(f"\n{'━'*60}")
    print(f"  {title}")
    print(f"{'━'*60}")


def print_score_table(all_results):
    """In bảng so sánh điểm số giữa nhiều models.

    Args:
        all_results: list of dicts, mỗi dict là kết quả step_judge_score() cho 1 model.
    """
    if not all_results:
        print("  Chưa có kết quả nào.")
        return

    task_type = all_results[0]["task_type"]

    # Sắp xếp theo overall score giảm dần
    all_results = sorted(all_results, key=lambda r: r["scores"]["overall"], reverse=True)

    # Lấy criteria keys từ result đầu tiên
    criteria_keys = list(all_results[0]["scores"]["criteria"].keys())

    # === Header ===
    is_quiz = task_type == "quiz"
    col_model = 20
    col_score = 8

    # Build header
    header_parts = [f"{'Model':<{col_model}}",  f"{'Overall':>{col_score}}"]
    for key in criteria_keys:
        header_parts.append(f"{key[:{col_score}]:>{col_score}}")
    if is_quiz:
        header_parts.append(f"{'JSON%':>{col_score}}")
        header_parts.append(f"{'Schema%':>{col_score}}")

    sep = "─" * col_model
    sep_parts = [sep] + ["─" * col_score] * (len(header_parts) - 1)

    print(f"\n  🤖 LLM-as-a-Judge Scores (GPT-4o, scale 1-10)")
    print(f"  ┌{'┬'.join(sep_parts)}┐")
    print(f"  │{'│'.join(header_parts)}│")
    print(f"  ├{'┼'.join(sep_parts)}┤")

    # === Rows ===
    for r in all_results:
        label = r["label"][:col_model].ljust(col_model)
        overall = r["scores"]["overall"]
        row_parts = [label, f"{overall:>{col_score}.1f}"]

        for key in criteria_keys:
            val = r["scores"]["criteria"].get(key, 0)
            row_parts.append(f"{val:>{col_score}.1f}")

        if is_quiz:
            jr = r.get(f"{r['label']}_json_rate", 0)
            sr = r.get(f"{r['label']}_schema_rate", 0)
            row_parts.append(f"{jr:>{col_score}.1f}")
            row_parts.append(f"{sr:>{col_score}.1f}")

        print(f"  │{'│'.join(row_parts)}│")

    print(f"  └{'┴'.join(sep_parts)}┘")

    # Số items đánh giá
    total = all_results[0]["scores"]["total"]
    print(f"  Evaluated on {total} items\n")


def print_status(evaluations, default_base_url, responses_dir, results_dir, config_path):
    """In trạng thái tất cả evaluations."""
    print(f"\n{'━'*60}")
    print(f"  EVALUATION STATUS")
    print(f"{'━'*60}\n")

    for idx, ev in enumerate(evaluations):
        name = ev["name"]
        models = ev["models"]

        print(f"  [{idx}] {name}  ({ev['task_type']})")
        for mi, model in enumerate(models):
            label = model["label"]
            task = ev["task_type"]
            resp_files = sorted(responses_dir.glob(f"{task}_{label}_responses_*.json"))
            score_files = sorted(results_dir.glob(f"{task}_{label}_scores_*.json"))
            sr = f"\u2705 {resp_files[-1].name}" if resp_files else "\u274c"
            ss = f"\u2705 {score_files[-1].name}" if score_files else "\u274c"
            print(f"      [{mi}] {label:25s}")
            print(f"           B1 responses: {sr}")
            print(f"           B2 scores:    {ss}")
        print()

    print(f"  Hướng dẫn:")
    print(f"    B1. generate --eval <idx> --model <model_idx>  → Sinh responses")
    print(f"    B2. judge    --eval <idx>                      → GPT-4.1 chấm điểm")
    print(f"    B3. report   [--eval <idx>]                    → Bảng so sánh")
    print(f"\n  Server mặc định: {default_base_url}")
    print(f"  Config file:     {config_path}")
