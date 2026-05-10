import os
import json
import torch
import openai
import gc
import yaml
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from unsloth import FastLanguageModel

# ==============================================================================
# 1. PATH & ENV SETUP
# ==============================================================================
# Xác định thư mục gốc của dự án (ai-agent-core)
# File này nằm ở: training/evaluation/eval_metrics.py -> Lên 3 cấp là gốc
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

# Load biến môi trường từ file .env
load_dotenv(dotenv_path=ENV_PATH)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def load_yaml_config(config_path):
    """Hàm tiện ích để load file cấu hình YAML"""
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

# ==============================================================================
# 2. MODEL EVALUATOR CLASS
# ==============================================================================
class ModelEvaluator:
    """
    Lớp hỗ trợ load mô hình và sinh phản hồi.
    Mỗi instance chỉ quản lý một mô hình duy nhất để tối ưu VRAM.
    """
    def __init__(self, model_path, max_seq_length=2048):
        print(f"Loading model: {model_path}")
        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name = model_path,
            max_seq_length = max_seq_length,
            load_in_4bit = True,
        )
        FastLanguageModel.for_inference(self.model)

    def generate_response(self, messages):
        """Hàm dùng chung để sinh câu trả lời từ mô hình"""
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer([prompt], return_tensors="pt").to("cuda")
        outputs = self.model.generate(**inputs, max_new_tokens=512)
        return self.tokenizer.batch_decode(outputs)[0].split("<|assistant|>")[-1].strip()

    def unload(self):
        """Giải phóng VRAM hoàn toàn để load mô hình khác"""
        del self.model
        del self.tokenizer
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

# ==============================================================================
# 3. EVALUATION FUNCTIONS
# ==============================================================================

def evaluate_quiz_adapter(config_path, test_file, base_model_path):
    """
    Đánh giá Quiz Adapter dựa trên JSON Pass Rate + Schema Validation.
    So sánh kết quả giữa Base Model và Fine-tuned Adapter.
    """
    REQUIRED_KEYS = {"question", "options", "correct_answer", "explanation"}

    # Load config từ YAML để lấy đường dẫn adapter
    cfg = load_yaml_config(config_path)
    adapter_path = cfg["training"]["output_dir"]
    
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    def _eval_json_responses(evaluator, label):
        """Sinh phản hồi và đo JSON Pass Rate + Schema Pass Rate."""
        json_pass = 0
        schema_pass = 0
        for item in test_data:
            response = evaluator.generate_response(item["messages"])
            try:
                parsed = json.loads(response)
                json_pass += 1
                # Kiểm tra schema: có đủ các key bắt buộc không
                if REQUIRED_KEYS.issubset(parsed.keys()):
                    schema_pass += 1
            except (json.JSONDecodeError, TypeError):
                pass
        total = len(test_data)
        json_rate = (json_pass / total) * 100
        schema_rate = (schema_pass / total) * 100
        print(f"  [{label}] JSON Pass: {json_pass}/{total} ({json_rate:.1f}%) | Schema Pass: {schema_pass}/{total} ({schema_rate:.1f}%)")
        return json_rate, schema_rate

    # --- Bước 1: Đánh giá Fine-tuned Adapter ---
    print("Evaluating Fine-tuned Quiz Adapter...")
    tuned_evaluator = ModelEvaluator(adapter_path)
    tuned_json_rate, tuned_schema_rate = _eval_json_responses(tuned_evaluator, "Tuned")
    tuned_evaluator.unload()

    # --- Bước 2: Đánh giá Base Model (so sánh trước/sau fine-tune) ---
    print("Evaluating Base Model (baseline)...")
    base_evaluator = ModelEvaluator(base_model_path)
    base_json_rate, base_schema_rate = _eval_json_responses(base_evaluator, "Base")
    base_evaluator.unload()

    return {
        "tuned_json_rate": tuned_json_rate,
        "tuned_schema_rate": tuned_schema_rate,
        "base_json_rate": base_json_rate,
        "base_schema_rate": base_schema_rate,
        "json_improvement": tuned_json_rate - base_json_rate,
        "schema_improvement": tuned_schema_rate - base_schema_rate,
    }

def evaluate_explanation_adapter(config_path, test_file, base_model_path):
    """
    Đánh giá Explanation Adapter dựa trên Win-rate so với Base Model.
    """
    # Load config từ YAML để lấy đường dẫn adapter
    cfg = load_yaml_config(config_path)
    adapter_path = cfg["training"]["output_dir"]
    
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    # --- Bước 1: Sinh câu trả lời từ Tuned Model ---
    print("Generating responses from Fine-tuned Model...")
    tuned_evaluator = ModelEvaluator(adapter_path)
    tuned_responses = [tuned_evaluator.generate_response(item["messages"]) for item in test_data]
    tuned_evaluator.unload()

    # --- Bước 2: Sinh câu trả lời từ Base Model ---
    print("Generating responses from Base Model...")
    base_evaluator = ModelEvaluator(base_model_path)
    base_responses = [base_evaluator.generate_response(item["messages"]) for item in test_data]
    base_evaluator.unload()

    # --- Bước 3: Dùng GPT-4o làm Judge ---
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in .env file!")

    print("Judging with GPT-4o...")
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    wins, ties, losses = 0, 0, 0

    for i in range(len(test_data)):
        prompt = test_data[i]["messages"][1]["content"]
        res_tuned = tuned_responses[i]
        res_base = base_responses[i]

        judge_prompt = (
            f"Question: {prompt}\n\n"
            f"Response A (Fine-tuned): {res_tuned}\n\n"
            f"Response B (Base): {res_base}\n\n"
            f"Which one is better for a student in terms of pedagogy and accuracy? "
            f"Answer only 'A', 'B' or 'Tie'."
        )
        
        res = client.chat.completions.create(
            model="gpt-4o", 
            messages=[{"role": "user", "content": judge_prompt}]
        )
        verdict = res.choices[0].message.content.strip().upper()

        if 'A' in verdict: wins += 1
        elif 'B' in verdict: losses += 1
        else: ties += 1

    win_rate = (wins / len(test_data)) * 100
    return {
        "win_rate": win_rate,
        "wins": wins,
        "ties": ties,
        "losses": losses,
        "total": len(test_data),
    }

# ==============================================================================
# RESULT SAVING
# ==============================================================================
def save_results(results, output_path):
    """Lưu kết quả eval ra file JSON với timestamp."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    results["timestamp"] = datetime.now().isoformat()
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"💾 Results saved to {output_path}")

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
if __name__ == "__main__":
    BASE_MODEL = "unsloth/Qwen2.5-7B-Instruct"
    RESULTS_DIR = ROOT_DIR / "training" / "evaluation" / "results"
    all_results = {}

    # 1. Đánh giá Quiz Adapter
    try:
        quiz_cfg_path = ROOT_DIR / "training/configs/quiz_config.yaml"
        quiz_test_file = ROOT_DIR / "data/test/quiz_test.jsonl"
        
        quiz_results = evaluate_quiz_adapter(
            config_path = str(quiz_cfg_path),
            test_file = str(quiz_test_file),
            base_model_path = BASE_MODEL,
        )
        all_results["quiz"] = quiz_results

        print(f"\n📊 Quiz Evaluation Results:")
        print(f"  Fine-tuned — JSON: {quiz_results['tuned_json_rate']:.1f}%, Schema: {quiz_results['tuned_schema_rate']:.1f}%")
        print(f"  Base Model — JSON: {quiz_results['base_json_rate']:.1f}%, Schema: {quiz_results['base_schema_rate']:.1f}%")
        print(f"  Improvement — JSON: {quiz_results['json_improvement']:+.1f}%, Schema: {quiz_results['schema_improvement']:+.1f}%")
    except Exception as e:
        print(f"Error evaluating Quiz: {e}")

    print("\n" + "="*50 + "\n")

    # 2. Đánh giá Explanation Adapter
    try:
        exp_cfg_path = ROOT_DIR / "training/configs/explanation_config.yaml"
        exp_test_file = ROOT_DIR / "data/test/explanation_test.jsonl"
        
        exp_results = evaluate_explanation_adapter(
            config_path = str(exp_cfg_path),
            test_file = str(exp_test_file),
            base_model_path = BASE_MODEL,
        )
        all_results["explanation"] = exp_results

        print(f"\n🏆 Explanation Evaluation Results:")
        print(f"  Win-rate: {exp_results['win_rate']:.1f}%")
        print(f"  Wins: {exp_results['wins']}, Ties: {exp_results['ties']}, Losses: {exp_results['losses']}")
    except Exception as e:
        print(f"Error evaluating Explanation: {e}")

    # 3. Lưu kết quả
    if all_results:
        save_results(all_results, RESULTS_DIR / "eval_results.json")