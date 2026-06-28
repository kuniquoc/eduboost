### 📂 Cấu trúc thư mục (Tổng thể phần RAG)
Bạn hãy đảm bảo các file được đặt đúng vị trí này để các lệnh `import` hoạt động chính xác.

```text
ai-agent-core/
├── data/
│   ├── raw/                    # Bỏ tất cả file .pdf, .txt vào đây
│   └── gold_dataset/
│       └── rag_eval.json       # Tập dữ liệu chuẩn để đánh giá (Tự soạn)
├── models/
│   └── vector_db/              # Nơi lưu index FAISS (.bin và .pkl)
├── src/
│   ├── rag/
│   │   ├── vector_db.py        # Lớp lưu trữ và tìm kiếm Vector
│   │   ├── ingest.py           # Lớp xử lý file -> chia chunk -> nạp DB
│   │   └── retriever.py        # Lớp điều phối truy xuất cho Agent
├── training/
│   └── evaluation/
│       └── eval_rag.py         # Script đánh giá Hit Rate
└── requirements.txt            # Thêm: faiss-cpu, sentence-transformers, PyPDF2, langchain
```

### 🚀 HƯỚNG DẪN VẬN HÀNH (STEP-BY-STEP)

**Bước 1: Cài đặt thư viện**
```bash
pip install faiss-cpu sentence-transformers PyPDF2 langchain
pip install rapidfuzz
```

**Bước 2: Nạp dữ liệu (Ingestion)**
1. Bỏ tất cả file `.pdf` và `.txt` vào thư mục `data/raw/`.
2. Chạy lệnh:
   ```bash
   python src/eduboost_agent/rag/ingest.py
   ```
   $\rightarrow$ *Kết quả:* Hệ thống tạo ra file `faiss_index.bin` và `faiss_index.pkl` trong `resources/faiss-seed/`.

**Bước 3: Đánh giá (Evaluation)**
1. Soạn file `data/gold_dataset/rag_eval.json` với các câu hỏi và đoạn văn chuẩn.
2. Chạy lệnh:
   ```bash
   python training/evaluation/eval_rag.py
   ```
   $\rightarrow$ *Kết quả:* Bạn nhận được tỷ lệ **Hit Rate %** để ghi vào luận văn.

**Bước 4: Tích hợp vào Agent**
Trong file `orchestrator.py`, bạn chỉ cần gọi:
```python
from eduboost_agent.rag.vector_db import VectorDB
from eduboost_agent.rag.retriever import KnowledgeRetriever

db = VectorDB()
retriever = KnowledgeRetriever(db)
context = retriever.get_context(topic="Present Simple", query="Khi nào dùng thì hiện tại đơn?")
# Sau đó đưa 'context' này vào prompt của LLM
```

### 🌟 Tại sao bản triển khai này hoàn chỉnh?
1.  **Đa năng:** Xử lý được cả PDF và TXT, không lo lỗi encoding.
2.  **Thông minh:** Dùng `RecursiveCharacterTextSplitter` để chia chunk không bị mất ý nghĩa câu.
3.  **Hiệu quả:** Dùng FAISS để tìm kiếm vector với tốc độ miligiây.
4.  **Khoa học:** Có quy trình đánh giá Hit Rate rõ ràng, có Gold Dataset đối chứng, đáp ứng tiêu chuẩn của một đồ án/luận văn kỹ thuật.