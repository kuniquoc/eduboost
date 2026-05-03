import os
import json
import torch
import openai
import gc
import yaml
from pathlib import Path
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

def evaluate_quiz_adapter(config_path, test_file):
    """
    Đánh giá Quiz Adapter dựa trên JSON Pass Rate.
    """
    # Load config từ YAML để lấy đường dẫn adapter
    cfg = load_yaml_config(config_path)
    adapter_path = cfg["training"]["output_dir"]
    
    evaluator = ModelEvaluator(adapter_path)
    
    with open(test_file, "r", encoding="utf-8") as f:
        test_data = [json.loads(line) for line in f]

    pass_count = 0
    print(f"Evaluating JSON Pass Rate for Quiz Adapter...")
    
    for item in test_data:
        response = evaluator.generate_response(item["messages"])
        try:
            json.loads(response)
            pass_count += 1
        except:
            pass
    
    pass_rate = (pass_count / len(test_data)) * 100
    evaluator.unload() # Giải phóng VRAM
    
    return pass_rate

def evaluate_explanation_adapter(config_path, test_file, base_model_path):
    """
    Đánh giá Explanation Adapter dựa trên Win-rate so với Base Model.
    """
    # Load config từ YAML để lấy đường dẫn adapter
    cfg = load_yaml_config(config_path)
    adapter_path = cfg["training"]["output_dir"]
    
    with open(test_//_file, "r", encoding="utf-8") as f:
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
    return win_rate, wins, ties, losses

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
if __name__ == "__main__":
    # 1. Đánh giá Quiz Adapter
    try:
        # Đường dẫn đến file config YAML
        quiz_cfg_path = ROOT_DIR / "training/configs/quiz_config.yaml"
        quiz_test_file = ROOT_DIR / "data/test/quiz_test.jsonl"
        
        quiz_rate = evaluate_quiz_adapter(str(quiz_cfg_path), str(quiz_test_file))
        print(f"📊 Final Quiz JSON Pass Rate: {quiz_rate:.2f}%")
    except Exception as e:
        print(f"Error evaluating Quiz: {e}")

    print("\n" + "="*50 + "\n")

    # 2. Đánh giá Explanation Adapter
    try:
        # Đường dẫn đến file config YAML
        exp_cfg_path = ROOT_DIR / "training/configs/explanation_config.yaml"
        exp_test_file = ROOT_DIR / "data/test/explanation_test.jsonl"
        
        win_rate, w, t, l = evaluate_explanation_adapter(
            config_path = str(exp_cfg_path),
            test_file = str(exp_test_file),
            base_model_path = "unsloth/Qwen2.5-7B-Instruct"
        )
        print(f"🏆 Final Explanation Win-rate: {win_rate:.2f}% (W:{w}, T:{t}, L:{l})")
    except Exception as e:
        print(f"Error evaluating Explanation: {e}")