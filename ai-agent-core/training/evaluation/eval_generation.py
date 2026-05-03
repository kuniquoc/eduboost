# training/evaluation/eval_generation.py

import json
import os
import time
from openai import OpenAI  # Sử dụng thư viện chính thức của OpenAI
from src.rag.vector_db import VectorDB
from src.rag.retriever import KnowledgeRetriever
from src.adapters.llm_manager import LLMManager

# ==============================================================================
# CẤU HÌNH GIÁM KHẢO (JUDGE LLM)
# ==============================================================================
JUDGE_API_KEY = "YOUR_OPENAI_API_KEY" 
JUDGE_MODEL = "gpt-4o"

# Khởi tạo OpenAI Client một lần duy nhất
client = OpenAI(api_key=JUDGE_API_KEY)

def call_judge_llm(prompt):
    """Hàm gọi API của LLM Giám khảo sử dụng thư viện openai"""
    try:
        response = client.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[
                {"role": "system", "content": "You are a strict academic evaluator. Always return response in JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}, # Ép kiểu trả về là JSON
            temperature=0
        )
        # Trả về nội dung đã parse thành dict
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"❌ OpenAI API Error: {e}")
        return None

# ==============================================================================
# LOGIC ĐÁNH GIÁ
# ==============================================================================

def evaluate_generation(gold_dataset_path, base_model_path, adapter_paths):
    # 1. Khởi tạo các thành phần của Agent
    db = VectorDB()
    retriever = KnowledgeRetriever(db)
    llm = LLMManager(base_model_path, adapter_paths)
    
    # 2. Load Gold Dataset
    if not os.path.exists(gold_dataset_path):
        print(f"❌ Gold dataset not found at {gold_dataset_path}")
        return

    with open(gold_dataset_path, 'r', encoding='utf-8') as f:
        gold_data = json.load(f)

    results = []
    total = len(gold_data)
    
    print("\n" + "="*60)
    print(f"🚀 STARTING GENERATION EVALUATION (LLM-as-a-Judge)")
    print(f"Dataset size: {total} samples | Judge Model: {JUDGE_MODEL}")
    print("="*60 + "\n")

    for i, item in enumerate(gold_data):
        question = item['question']
        
        # --- BƯỚC 1: Chạy luồng RAG thực tế ---
        context = retriever.get_context(topic="General", query=question)
        
        # Sinh câu trả lời bằng local LLM (Explanation Adapter)
        llm.set_adapter("explanation")
        prompt = f"Context: {context}\n\nQuestion: {question}\n\nAnswer:"
        ai_answer = llm.generate(prompt)
        
        # --- BƯỚC 2: Gửi cho Giám khảo chấm điểm ---
        judge_prompt = f"""
        Evaluate the AI Tutor's answer based on the provided context.
        
        [Question]: {question}
        [Context]: {context}
        [AI Answer]: {ai_answer}
        
        Score from 1-5 for:
        1. Faithfulness: Does the answer rely solely on the context? No hallucinations?
        2. Relevance: Does the answer directly and fully address the question?
        
        Return JSON: {{"faithfulness": score, "relevance": score, "reason": "short explanation"}}
        """
        
        print(f"Evaluating Sample {i+1}/{total}...", end=" ")
        score = call_judge_llm(judge_prompt)
        
        if score:
            results.append(score)
            print(f"✅ Faithfulness: {score['faithfulness']}, Relevance: {score['relevance']}")
        else:
            print(f"❌ Failed")
        
        time.sleep(0.5) # Tránh rate limit

    # 3. Tính toán điểm trung bình
    if not results:
        print("No results to calculate.")
        return

    avg_faith = sum(r['faithfulness'] for r in results) / len(results)
    avg_relev = sum(r['relevance'] for r in results) / len(results)

    print("\n" + "="*60)
    print(f"📊 FINAL GENERATION RESULTS")
    print(f"Average Faithfulness: {avg_faith:.2f}/5")
    print(f"Average Relevance: {avg_relev:.2f}/5")
    print("="*60 + "\n")

if __name__ == "__main__":
    # Cấu hình đường dẫn
    GOLD_PATH = "data/gold_dataset/rag_eval.json"
    BASE_MODEL = "unsloth/llama-3-8b-bnb-4bit" 
    ADAPTERS = {
        "explanation": "models/adapters/explanation_v1",
        "quiz": "models/adapters/quiz_v1"
    }
    
    evaluate_generation(GOLD_PATH, BASE_MODEL, ADAPTERS)