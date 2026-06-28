Dưới đây là cấu trúc thư mục chuẩn cho phần **AI Core**:

```text
ai-agent-core/
├── data/                       # Dữ liệu phục vụ huấn luyện
│   ├── raw/                    # Dữ liệu có cấu trúc thô (chưa xử lý)
│   ├── processed/              # Dữ liệu đã làm sạch, định dạng JSONL cho SFT
│   └── gold_dataset/           # Tập dữ liệu chuẩn để đánh giá (Evaluation set)
│
├── training/                   # Toàn bộ quy trình Fine-tuning (Offline)
│   ├── configs/                # File cấu hình tham số (yaml/json)
│   │   ├── explanation_config.yaml
│   │   └── quiz_config.yaml
│   ├── tools/datasets/                # Script chạy huấn luyện
│   │   ├── train_explanation.py
│   │   ├── train_quiz.py
│   │   └── utils_trainer.py    # Các hàm bổ trợ cho training
│   └── evaluation/             # Script đánh giá sau khi train
│       ├── eval_metrics.py
│
├── models/                     # Lưu trữ trọng số mô hình (Weights)
│   ├── base_model/             # Mô hình gốc (Llama-3, Mistral...)
│   └── adapters/               # Các Adapter đã train xong (LoRA weights)
│       ├── explanation_v1/     # Phiên bản 1 của adapter giải thích
│       └── quiz_v1/            # Phiên bản 1 của adapter sinh quiz
│
├── src/                        # Mã nguồn vận hành Agent (Online/Inference)
│   ├── core/                   # Logic cốt lõi của Agent
│   │   ├── bkt.py              # Triển khai class BKTModel
│   │   ├── irt.py              # Triển khai class IRTModel
│   │   └── orchestrator.py     # Bộ điều phối (Agent Loop)
│   │
│   ├── adapters/               # Quản lý việc load/switch LLM
│   │   ├── llm_manager.py      # Load base model & switch adapters
│   │   └── prompt_templates.py # Quản lý các mẫu Prompt cho từng tác vụ
│   │
│   ├── rag/                    # Hệ thống truy xuất kiến thức
│   │   ├── retriever.py        # Logic tìm kiếm tài liệu
│   │   └── vector_db.py        # Kết nối FAISS/Pinecone
│   │
│   └── api/                    # Lớp giao tiếp với Backend .NET
│       └── main.py             # FastAPI/Flask wrapper để .NET gọi vào
│
├── tests/                      # Unit test cho các module
│   ├── test_bkt.py
│   ├── test_irt.py
│   └── test_json_parser.py
│
├── .env                        # Biến môi trường (API Key, Path)
├── requirements.txt            # Thư viện Python cần thiết
└── README.md                   # Hướng dẫn cài đặt và chạy
```

---

### Giải thích chi tiết các thư mục chính:

#### 1. `training/` (Vùng thí nghiệm)
Đây là nơi bạn làm việc trong giai đoạn phát triển. Khi bạn muốn thử thay đổi `Learning Rate` hoặc `LoRA Rank`, bạn chỉ thao tác trong thư mục này. Kết quả cuối cùng của thư mục này là các file trọng số được lưu vào `/models/adapters/`.

#### 2. `src/eduboost_agent/learning/` (Bộ não điều khiển)
Đây là nơi chứa code Python mà tôi đã viết cho bạn về **BKT** và **IRT**. 
*   `orchestrator.py` sẽ là file quan trọng nhất, nó sẽ gọi `bkt.py` để xem trạng thái $\rightarrow$ gọi `irt.py` để lấy độ khó $\rightarrow$ gọi `llm_manager.py` để sinh nội dung.

#### 3. `src/eduboost_agent/llm/` (Quản lý LLM)
Thay vì viết prompt rải rác trong code, bạn đưa hết vào `prompt_templates.py`. 
*   `llm_manager.py` sẽ chịu trách nhiệm lệnh `model.set_adapter("quiz")` hoặc `model.set_adapter("explanation")` để tiết kiệm VRAM.

#### 4. `src/eduboost_agent/api/` (Cầu nối với .NET)
Vì Backend của bạn là .NET, bạn không thể chạy trực tiếp code Python. Bạn cần một "lớp vỏ" API (thường dùng **FastAPI** vì nó cực nhanh và hỗ trợ async).
*   **.NET API** $\xrightarrow{HTTP Request}$ **FastAPI (Python)** $\xrightarrow{Call}$ **Agent Core** $\xrightarrow{Return}$ **JSON**.

#### 5. `models/` (Kho lưu trữ)
Tách biệt `base_model` và `adapters`. Điều này cho phép bạn nâng cấp mô hình gốc (ví dụ từ Llama-3 lên Llama-4) mà không làm mất các adapter đã train, hoặc thử nghiệm nhiều phiên bản adapter khác nhau (`v1`, `v2`, `v3`) để so sánh.

### Luồng hoạt động của dự án với cấu trúc này:
1.  **Train:** `training/tools/datasets/` $\rightarrow$ `models/adapters/`.
2.  **Run:** `.NET Backend` $\rightarrow$ `src/eduboost_agent/api/main.py` $\rightarrow$ `src/eduboost_agent/learning/orchestrator.py`.
3.  **Orchestrator:** `src/eduboost_agent/learning/bkt.py` $\rightarrow$ `src/eduboost_agent/learning/irt.py` $\rightarrow$ `src/eduboost_agent/llm/llm_manager.py` $\rightarrow$ `models/adapters/`.
4.  **Response:** Trả kết quả về cho `.NET` $\rightarrow$ Mobile App.