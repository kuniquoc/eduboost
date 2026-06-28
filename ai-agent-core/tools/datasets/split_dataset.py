"""
Split dataset: chia raw data thành Gold Dataset + Train-Val set.

- Gold Dataset: lưu ở RAW format (dễ review tay), stratified theo level
  + Quiz: stratified thêm theo difficulty bins
  + Explanation: stratified theo level
- Train-Val: lưu ở CHAT format (sẵn sàng cho training pipeline)
  Train/Val sẽ được tách lúc train bởi utils_trainer.py (80/20)

Usage:
    python scripts/split_dataset.py
    python scripts/split_dataset.py --gold-ratio 0.15
    python scripts/split_dataset.py --gold-ratio 0.10 --seed 123
"""

import json
import random
import argparse
from pathlib import Path
from collections import defaultdict

from data_utils import BASE_DIR, RAW_DIR, load_json_file, extract_level_from_filename

GOLD_DIR = BASE_DIR / "data" / "gold_dataset"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
TEST_DIR = BASE_DIR / "data" / "test"

# System prompts (from training configs)
QUIZ_SYSTEM_PROMPT = "You are an expert English quiz generator. Always output in valid JSON format."
EXPLANATION_SYSTEM_PROMPT = (
    "You are a Socratic English tutor. "
    "Guide students to find errors themselves instead of giving answers immediately."
)


def parse_args():
    parser = argparse.ArgumentParser(description="Split raw dataset into Gold + Train-Val")
    parser.add_argument("--gold-ratio", type=float, default=0.10,
                        help="Tỷ lệ gold dataset per stratum (default: 0.10)")
    parser.add_argument("--gold-min", type=int, default=3,
                        help="Số record tối thiểu mỗi stratum cho gold (default: 3)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed (default: 42)")
    return parser.parse_args()


def load_all_records(folder: Path) -> list[dict]:
    """Load tất cả records từ folder, thêm metadata __level và __source_file. Deduplicate."""
    all_records = []
    seen = set()
    dupes = 0
    for f in sorted(folder.glob("*.jsonl")):
        data = load_json_file(f)
        level = extract_level_from_filename(f.stem)
        for record in data:
            key = json.dumps(record, sort_keys=True, ensure_ascii=False)
            if key in seen:
                dupes += 1
                continue
            seen.add(key)
            record["__level"] = level
            record["__source_file"] = f.name
            all_records.append(record)
    if dupes:
        print(f"  [INFO] Removed {dupes} duplicate records from {folder.name}/")
    return all_records


def get_difficulty_bin(difficulty: float) -> str:
    if difficulty < -2.0:
        return "very_easy"
    elif difficulty < -0.5:
        return "easy"
    elif difficulty < 0.5:
        return "medium"
    elif difficulty < 2.0:
        return "hard"
    else:
        return "very_hard"


def stratified_split(records: list[dict], key_fn, gold_ratio: float, gold_min: int) -> tuple[list, list]:
    """
    Chia records thành (gold, remaining) theo stratified sampling.
    key_fn: function(record) -> stratum key
    """
    strata = defaultdict(list)
    for r in records:
        strata[key_fn(r)].append(r)

    gold = []
    remaining = []

    for key, items in sorted(strata.items()):
        random.shuffle(items)
        n_gold = max(gold_min, int(len(items) * gold_ratio))
        # Đảm bảo không lấy hết
        n_gold = min(n_gold, len(items) - 1) if len(items) > 1 else 0
        gold.extend(items[:n_gold])
        remaining.extend(items[n_gold:])

    return gold, remaining


def clean_metadata(record: dict) -> dict:
    """Xoá các field metadata tạm (__level, __source_file)."""
    return {k: v for k, v in record.items() if not k.startswith("__")}


# --- Chat format conversion ---

def quiz_to_chat(record: dict) -> dict:
    """Convert quiz raw record sang chat format cho training."""
    topic = record.get("topic", "")
    difficulty = record.get("difficulty", 0)
    context = record.get("context", "")

    user_content = (
        f"Generate a multiple-choice question about {topic}.\n"
        f"Target Difficulty (IRT Beta): {difficulty}\n"
        f"Context: {context}"
    )

    # Assistant output = JSON của output field
    assistant_content = json.dumps(record.get("output", {}), ensure_ascii=False)

    return {
        "messages": [
            {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        ]
    }


def explanation_to_chat(record: dict) -> dict:
    """Convert explanation raw record sang chat format cho training."""
    topic = record.get("topic", "")
    level = record.get("level", "")
    student_input = record.get("student_input", "")
    correct_answer = record.get("correct_answer", "")

    user_content = (
        f"Topic: {topic} (Level: {level})\n"
        f"Student wrote: \"{student_input}\"\n"
        f"Correct answer: \"{correct_answer}\""
    )

    assistant_content = record.get("explanation", "")

    return {
        "messages": [
            {"role": "system", "content": EXPLANATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        ]
    }


def save_jsonl(records: list[dict], path: Path):
    """Lưu list of dicts ra file JSONL (mỗi dòng 1 JSON object)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fp:
        for r in records:
            fp.write(json.dumps(r, ensure_ascii=False) + "\n")


def print_split_summary(label: str, gold: list, train_val: list, strata_key_fn):
    """In summary phân phối sau khi split."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  Total: {len(gold) + len(train_val)}")
    print(f"  Gold:  {len(gold)}")
    print(f"  Train-Val: {len(train_val)}")

    # Phân phối gold theo strata
    gold_dist = defaultdict(int)
    for r in gold:
        gold_dist[strata_key_fn(r)] += 1

    tv_dist = defaultdict(int)
    for r in train_val:
        tv_dist[strata_key_fn(r)] += 1

    all_keys = sorted(set(list(gold_dist.keys()) + list(tv_dist.keys())))
    max_k = max(len(str(k)) for k in all_keys) if all_keys else 10

    print(f"\n  {'Stratum':<{max_k}}  {'Gold':>6}  {'Train-Val':>10}  {'Total':>6}")
    print(f"  {'-'*max_k}  {'-'*6}  {'-'*10}  {'-'*6}")
    for k in all_keys:
        g = gold_dist.get(k, 0)
        t = tv_dist.get(k, 0)
        print(f"  {str(k):<{max_k}}  {g:>6}  {t:>10}  {g+t:>6}")


def main():
    args = parse_args()
    random.seed(args.seed)

    print("=" * 60)
    print("  SPLIT DATASET")
    print(f"  Gold ratio: {args.gold_ratio}, Min per stratum: {args.gold_min}, Seed: {args.seed}")
    print("=" * 60)

    # --- QUIZ ---
    quiz_records = load_all_records(RAW_DIR / "quiz")
    print(f"\n  Loaded {len(quiz_records)} quiz records")

    # Stratify quiz theo level + difficulty bin
    def quiz_stratum(r):
        level = r["__level"]
        d_bin = get_difficulty_bin(r.get("difficulty", 0))
        return f"{level}_{d_bin}"

    quiz_gold, quiz_remaining = stratified_split(
        quiz_records, quiz_stratum, args.gold_ratio, args.gold_min
    )

    # Lưu gold (raw format, xoá metadata)
    save_jsonl([clean_metadata(r) for r in quiz_gold], GOLD_DIR / "quiz_gold.jsonl")

    # Lưu gold dạng chat format cho automated evaluation
    quiz_test_chat = [quiz_to_chat(clean_metadata(r)) for r in quiz_gold]
    save_jsonl(quiz_test_chat, TEST_DIR / "quiz_test.jsonl")

    # Lưu train-val (chat format)
    quiz_chat = [quiz_to_chat(clean_metadata(r)) for r in quiz_remaining]
    random.shuffle(quiz_chat)
    save_jsonl(quiz_chat, PROCESSED_DIR / "quiz_chat.jsonl")

    print_split_summary("QUIZ", quiz_gold, quiz_remaining, quiz_stratum)

    # --- EXPLANATION ---
    explanation_records = load_all_records(RAW_DIR / "explanation")
    print(f"\n  Loaded {len(explanation_records)} explanation records")

    # Stratify explanation theo level
    def explanation_stratum(r):
        return r["__level"]

    explanation_gold, explanation_remaining = stratified_split(
        explanation_records, explanation_stratum, args.gold_ratio, args.gold_min
    )

    # Lưu gold (raw format, xoá metadata)
    save_jsonl([clean_metadata(r) for r in explanation_gold], GOLD_DIR / "explanation_gold.jsonl")

    # Lưu gold dạng chat format cho automated evaluation
    explanation_test_chat = [explanation_to_chat(clean_metadata(r)) for r in explanation_gold]
    save_jsonl(explanation_test_chat, TEST_DIR / "explanation_test.jsonl")

    # Lưu train-val (chat format)
    explanation_chat = [explanation_to_chat(clean_metadata(r)) for r in explanation_remaining]
    random.shuffle(explanation_chat)
    save_jsonl(explanation_chat, PROCESSED_DIR / "explanation_chat.jsonl")

    print_split_summary("EXPLANATION", explanation_gold, explanation_remaining, explanation_stratum)

    # --- TỔNG HỢP ---
    total_gold = len(quiz_gold) + len(explanation_gold)
    total_tv = len(quiz_remaining) + len(explanation_remaining)
    total = total_gold + total_tv

    print(f"\n{'='*60}")
    print(f"  TỔNG HỢP")
    print(f"{'='*60}")
    print(f"  Gold:      {total_gold} ({total_gold/total*100:.1f}%)")
    print(f"  Train-Val: {total_tv} ({total_tv/total*100:.1f}%)")
    print(f"  Total:     {total}")
    print(f"\n  Output files:")
    print(f"    {GOLD_DIR / 'quiz_gold.jsonl'}")
    print(f"    {GOLD_DIR / 'explanation_gold.jsonl'}")
    print(f"    {TEST_DIR / 'quiz_test.jsonl'}")
    print(f"    {TEST_DIR / 'explanation_test.jsonl'}")
    print(f"    {PROCESSED_DIR / 'quiz_chat.jsonl'}")
    print(f"    {PROCESSED_DIR / 'explanation_chat.jsonl'}")

    # Verification: check no overlap
    gold_quiz_set = {json.dumps(clean_metadata(r), sort_keys=True) for r in quiz_gold}
    tv_quiz_set = {json.dumps(clean_metadata(r), sort_keys=True) for r in quiz_remaining}
    overlap_quiz = gold_quiz_set & tv_quiz_set
    if overlap_quiz:
        print(f"\n  [WARNING] Quiz overlap: {len(overlap_quiz)} records!")
    else:
        print(f"\n  [OK] No overlap between gold and train-val (quiz)")

    gold_exp_set = {json.dumps(clean_metadata(r), sort_keys=True) for r in explanation_gold}
    tv_exp_set = {json.dumps(clean_metadata(r), sort_keys=True) for r in explanation_remaining}
    overlap_exp = gold_exp_set & tv_exp_set
    if overlap_exp:
        print(f"  [WARNING] Explanation overlap: {len(overlap_exp)} records!")
    else:
        print(f"  [OK] No overlap between gold and train-val (explanation)")


if __name__ == "__main__":
    main()
