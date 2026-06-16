# training/evaluation/eval_rag.py

import json
import os
from rapidfuzz import fuzz  # Thư viện tính toán độ tương đồng chuỗi (Fuzzy Matching)
from src.rag.vector_db import VectorDB
from src.rag.retriever import KnowledgeRetriever

def evaluate_rag(gold_dataset_path, threshold=80):
    """
    Hàm đánh giá hiệu năng truy xuất của RAG.
    
    Args:
        gold_dataset_path (str): Đường dẫn tới file rag_eval.json
        threshold (int): Ngưỡng tương đồng để coi là một cú HIT (mặc định 80%)
    """
    # 1. Kiểm tra sự tồn tại của file Gold Dataset
    if not os.path.exists(gold_dataset_path):
        print(f"❌ Error: Gold dataset not found at {gold_dataset_path}")
        return None

    # 2. Load Gold Dataset
    try:
        with open(gold_dataset_path, 'r', encoding='utf-8') as f:
            gold_data = json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON file: {e}")
        return None

    # 3. Khởi tạo VectorDB và Retriever
    # VectorDB sẽ tự động load index từ models/vector_db/faiss_index.bin
    db = VectorDB()
    retriever = KnowledgeRetriever(db)
    
    hits = 0
    total = len(gold_data)
    
    print("\n" + "="*60)
    print(f"🚀 STARTING RAG EVALUATION")
    print(f"Dataset size: {total} samples")
    print(f"Similarity Threshold: {threshold}%")
    print("="*60 + "\n")
    
    for i, item in enumerate(gold_data):
        question = item.get('question', '')
        expected_context = item.get('expected_context', '')
        
        if not question or not expected_context:
            print(f"⚠️ Sample {i+1}: Missing question or expected_context. Skipping.")
            continue

        # Bước 1: Truy xuất ngữ cảnh từ hệ thống RAG
        # Chúng ta dùng query là câu hỏi để tìm kiếm trong VectorDB
        retrieved_contexts = retriever.get_context(topic="General", query=question)
        
        # Bước 2: Tính toán độ tương đồng (Fuzzy Matching)
        # partial_ratio tìm kiếm đoạn khớp nhất của expected_context trong retrieved_contexts
        # Điều này giải quyết vấn đề sai lệch nhỏ về dấu câu, khoảng trắng hoặc ngắt dòng PDF
        similarity_score = fuzz.partial_ratio(expected_context.lower(), retrieved_contexts.lower())
        
        # Bước 3: Xác định HIT hay MISS dựa trên ngưỡng (threshold)
        if similarity_score >= threshold:
            hits += 1
            status = f"✅ HIT ({similarity_score:.1f}%)"
        else:
            status = f"❌ MISS ({similarity_score:.1f}%)"
            
        # In chi tiết từng mẫu để dễ dàng debug và kiểm tra
        print(f"Sample {i+1}: {status}")
        print(f"❓ Question: {question}")
        print(f"🎯 Expected: {expected_context[:120]}...")
        print(f"🔍 Retrieved: {retrieved_contexts[:120]}...")
        print("-" * 60)

    # 4. Tính toán kết quả cuối cùng
    hit_rate = (hits / total) * 100 if total > 0 else 0
    
    print("\n" + "="*60)
    print(f"📊 FINAL EVALUATION RESULT")
    print(f"Total Samples: {total}")
    print(f"Total Hits: {hits}")
    print(f"Hit Rate @ 3: {hit_rate:.2f}%")
    print("="*60 + "\n")
    
    return hit_rate

if __name__ == "__main__":
    # Đường dẫn tới file gold dataset của bạn
    GOLD_PATH = "data/gold_dataset/rag_eval.json"
    
    # Bạn có thể điều chỉnh threshold ở đây (ví dụ 70 hoặc 90)
    # 80% là mức tiêu chuẩn cho các hệ thống RAG thực tế
    evaluate_rag(GOLD_PATH, threshold=80)