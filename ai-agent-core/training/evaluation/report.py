"""
Report: Các hàm in kết quả evaluation ra console.
"""


def bar(value, width=20):
    """Vẽ progress bar text: █░"""
    filled = int(value / 100 * width)
    return f"{'█' * filled}{'░' * (width - filled)}"


def print_header(title):
    print(f"\n{'━'*60}")
    print(f"  {title}")
    print(f"{'━'*60}")


def print_judge_results(results):
    """In kết quả judge (quiz hoặc explanation)."""
    la = results["label_a"]
    lb = results["label_b"]
    task = results["task_type"]

    print(f"\n🔍 {la} vs {lb}  (task: {task})")

    # Quiz: bảng JSON/Schema
    if task == "quiz":
        print(f"  ┌─────────────────────┬──────────────────────────────┬──────────────────────────────┐")
        print(f"  │                     │  JSON Pass Rate              │  Schema Pass Rate            │")
        print(f"  ├─────────────────────┼──────────────────────────────┼──────────────────────────────┤")
        for label in [la, lb]:
            jr = results.get(f"{label}_json_rate", 0)
            sr = results.get(f"{label}_schema_rate", 0)
            name = f"{label[:17]:17s}"
            print(f"  │  {name}  │  {bar(jr)} {jr:5.1f}%   │  {bar(sr)} {sr:5.1f}%   │")
        print(f"  └─────────────────────┴──────────────────────────────┴──────────────────────────────┘")

    # Judge results
    j = results["judge"]
    wa, wb, ti = j['wins_a'], j['wins_b'], j['ties']
    total, wr = j['total'], j['win_rate_a']

    print(f"\n  🤖 LLM-as-a-Judge (GPT-4o Pairwise)")
    print(f"  ┌────────────────────────┬───────┬────────────────────────┐")
    print(f"  │  {la[:20]:20s}  wins │  {wa:>3}  │  {bar(wr)} {wr:5.1f}%   │")
    print(f"  │  {lb[:20]:20s}  wins │  {wb:>3}  │                        │")
    print(f"  │  Ties                  │  {ti:>3}  │                        │")
    print(f"  │  Total                 │  {total:>3}  │                        │")
    print(f"  └────────────────────────┴───────┴────────────────────────┘")


def print_status(evaluations, default_base_url, responses_dir, results_dir, config_path):
    """In trạng thái tất cả evaluations."""
    print(f"\n{'━'*60}")
    print(f"  EVALUATION STATUS")
    print(f"{'━'*60}\n")

    for idx, ev in enumerate(evaluations):
        name = ev["name"]
        resp_a = responses_dir / f"{name}_a.json"
        resp_b = responses_dir / f"{name}_b.json"
        result = results_dir / f"{name}_results.json"

        sa = "✅" if resp_a.exists() else "❌"
        sb = "✅" if resp_b.exists() else "❌"
        sj = "✅" if result.exists() else "❌"

        print(f"  [{idx}] {name}  ({ev['task_type']})")
        print(f"      {ev['label_a']:25s} responses: {sa}")
        print(f"      {ev['label_b']:25s} responses: {sb}")
        print(f"      Judge result:                    {sj}")
        print()

    print(f"  Hướng dẫn:")
    print(f"    1. Khởi động server với model A (vLLM/Ollama)")
    print(f"    2. generate --eval <idx> --side a   → Sinh responses model A")
    print(f"    3. Tắt server A, khởi động server với model B")
    print(f"    4. generate --eval <idx> --side b   → Sinh responses model B")
    print(f"    5. judge    --eval <idx>            → GPT-4o judge (cần cả a và b)")
    print(f"    6. report   [--eval <idx>]          → Xem kết quả")
    print(f"\n  Server mặc định: {default_base_url}")
    print(f"  Config file:     {config_path}")
