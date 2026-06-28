### 🗺️ SƠ ĐỒ LUỒNG VẬN HÀNH MỚI
`.NET Backend` $\xrightarrow{HTTP}$ `Orchestrator (Python)` $\xrightarrow{OpenAI API}$ `vLLM Server (GPU)` $\xrightarrow{Multi-LoRA}$ `Base Model + Adapters`

---

### 📅 KẾ HOẠCH TRIỂN KHAI CHI TIẾT

#### Giai đoạn 1: Chuẩn bị Mô hình (Export)
vLLM không chạy trực tiếp file `.ipynb` hay code training. Bạn cần các file trọng số đã được lưu ra ổ đĩa.

1.  **Train bằng Unsloth:** Tiếp tục dùng Unsloth để fine-tune vì nó nhanh nhất.
2.  **Lưu Adapter:** Sử dụng `model.save_pretrained("models/adapters/explanation_v1")` để lưu adapter dưới dạng LoRA (không merge vào base model).
3.  **Yêu cầu:** Đảm bảo bạn có:
    *   Đường dẫn đến Base Model (ví dụ: `unsloth/llama-3-8b-bnb-4bit` hoặc bản full).
    *   Đường dẫn đến các thư mục Adapter (`explanation_v1`, `quiz_v1`).

#### Giai đoạn 2: Thiết lập vLLM Server (Infrastructure)
vLLM yêu cầu **Linux** (hoặc Windows thông qua **WSL2**) và GPU Nvidia.

**1. Cài đặt vLLM:**
```bash
pip install vllm
```

**2. Khởi chạy Server với tính năng Multi-LoRA:**
Đây là lệnh quan trọng nhất. Bạn sẽ khởi động server và "khai báo" trước các adapter mà server này sẽ quản lý.

```bash
python -m vllm.entrypoints.openai.api_server \
    --model unsloth/llama-3-8b-bnb-4bit \
    --enable-lora \
    --max-lora-rank 16 \
    --lora-modules explanation=models/adapters/explanation_v1 quiz=models/adapters/quiz_v1 \
    --port 8000
```
**Giải thích tham số:**
*   `--enable-lora`: Kích hoạt khả năng chạy nhiều adapter cùng lúc.
*   `--lora-modules`: Định nghĩa tên định danh và đường dẫn. 
    *   `explanation` $\rightarrow$ sẽ được gọi trong API.
    *   `models/adapters/explanation_v1` $\rightarrow$ đường dẫn file trên ổ đĩa.
*   `--max-lora-rank`: Phải khớp với `r` bạn dùng khi train (ví dụ $r=16$).

#### Giai đoạn 3: Cập nhật Orchestrator (Integration)
Bây giờ, bạn xóa bỏ hoàn toàn `LLMManager` cũ. Thay vào đó, bạn dùng thư viện `openai` để giao tiếp với vLLM Server.

**File: `src/eduboost_agent/learning/orchestrator.py` (Cập nhật)**

```python
from openai import OpenAI

class Orchestrator:
    def __init__(self):
        # Kết nối tới vLLM Server (giả lập OpenAI API)
        self.client = OpenAI(
            base_url="http://localhost:8000/v1", 
            api_key="token-tuy-y" # vLLM không yêu cầu key nhưng thư viện openai cần có giá trị
        )
        # ... khởi tạo BKT, IRT, Retriever ...

    def call_ai_server(self, prompt, adapter_name):
        """
        adapter_name: truyền vào "explanation" hoặc "quiz" 
        tương ứng với tên đã khai báo khi chạy vLLM server
        """
        try:
            response = self.client.chat.completions.create(
                model=adapter_name, # vLLM sẽ tự động switch sang adapter này
                messages=[
                    {"role": "system", "content": "You are a helpful AI Tutor."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=512
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"vLLM Error: {e}")
            return "Error connecting to AI Server."

    def run_agent_loop(self, student_id, topic):
        # 1. Logic BKT/IRT để quyết định hành động
        # 2. Lấy context từ RAG
        context = self.retriever.get_context(topic)
        
        # 3. Chọn adapter
        adapter = "explanation" if needs_teaching else "quiz"
        
        # 4. Tạo prompt
        prompt = f"Context: {context}\n\nQuestion: {topic}\n\nAnswer:"
        
        # 5. Gọi vLLM
        return self.call_ai_server(prompt, adapter)
```

---

### 📈 SO SÁNH TRƯỚC VÀ SAU KHI DÙNG vLLM

| Đặc điểm | Cách cũ (Custom LLMManager) | Cách mới (vLLM Server) |
| :--- | :--- | :--- |
| **Thời gian khởi động** | Load model mỗi khi chạy script | Load 1 lần, chạy 24/7 |
| **Tốc độ sinh token** | Trung bình | **Cực nhanh (PagedAttention)** |
| **Switch Adapter** | Gọi hàm `set_adapter` (tốn chút thời gian) | **Tức thời (Multi-LoRA)** |
| **Quản lý VRAM** | Dễ bị tràn VRAM nếu load nhiều | Tối ưu hóa bộ nhớ tự động |
| **Độ ổn định** | Dễ crash nếu xử lý async | Chuẩn công nghiệp, hỗ trợ nhiều request |
| **Code** | Phải viết nhiều logic quản lý model | Chỉ viết logic gọi API (rất ngắn) |

---

### 🛠️ LỘ TRÌNH THỰC HIỆN (CHECKLIST)

- [ ] **Bước 1:** Hoàn tất train adapter bằng Unsloth $\rightarrow$ Lưu ra thư mục `models/adapters/`.
- [ ] **Bước 2:** Cài đặt Linux/WSL2 và cài đặt `vllm`.
- [ ] **Bước 3:** Chạy lệnh khởi động vLLM Server với `--enable-lora` và khai báo các adapter.
- [ ] **Bước 4:** Cài đặt `pip install openai` cho Orchestrator.
- [ ] **Bước 5:** Sửa `orchestrator.py` để gọi API của vLLM thay vì gọi `LLMManager`.
- [ ] **Bước 6:** Test độc lập bằng Postman hoặc Curl để đảm bảo server phản hồi đúng adapter.
- [ ] **Bước 7:** Kết nối toàn bộ luồng: `.NET` $\rightarrow$ `Orchestrator` $\rightarrow$ `vLLM`.

**Lời khuyên cuối cùng:** Nếu bạn muốn đạt điểm tối đa về mặt kỹ thuật, hãy dùng **vLLM**. Nó chứng minh bạn không chỉ biết "dùng AI" mà còn biết "triển khai hệ thống AI" (AI Deployment) đúng chuẩn thực tế.