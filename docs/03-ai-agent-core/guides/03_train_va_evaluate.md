
# PHẦN 3: CHI TIẾT HUẤN LUYỆN (FINE-TUNING) VÀ ĐÁNH GIÁ MÔ HÌNH LLM

## 1. Chiến lược huấn luyện (Training Strategy)

Hệ thống sử dụng kỹ thuật **PEFT (Parameter-Efficient Fine-Tuning)** với phương pháp **QLoRA (Quantized Low-Rank Adaptation)** thông qua thư viện **Unsloth**. Phương pháp này cho phép huấn luyện các Adapter nhỏ gắn vào mô hình gốc, giúp tối ưu tài nguyên VRAM và duy trì kiến thức tổng quát của mô hình.

Hệ thống huấn luyện **2 Adapter** riêng biệt trên cùng một Base Model:

| Adapter | Mục đích | System Prompt |
| :--- | :--- | :--- |
| **Explanation Adapter** | Giải thích lỗi tiếng Anh theo phương pháp Socratic | `"You are a Socratic English tutor. Guide students to find errors themselves instead of giving answers immediately."` |
| **Quiz Adapter** | Sinh câu hỏi trắc nghiệm tiếng Anh đúng định dạng JSON | `"You are an expert English quiz generator. Always output in valid JSON format."` |

---

## 2. Cấu hình chi tiết (Configurations)

### 2.1. Cấu hình chung (Áp dụng cho cả 2 Adapter)

Cả hai Adapter đều sử dụng **cùng một bộ hyperparameters**. File cấu hình nằm tại:
- `training/configs/explanation_config.yaml`
- `training/configs/quiz_config.yaml`

#### 2.1.1. Model Configuration

| Tham số | Giá trị | Mô tả |
| :--- | :---: | :--- |
| **Base Model** | `unsloth/Qwen2.5-7B-Instruct` | Mô hình nền tảng 7B parameters, hỗ trợ instruction-following, được tối ưu bởi Unsloth để tăng tốc training. |
| **Max Sequence Length** | $2048$ tokens | Độ dài tối đa của một chuỗi input + output. Đủ cho các conversation multi-turn trong giáo dục. |
| **Quantization** | 4-bit (`load_in_4bit: true`) | Nén mô hình từ FP16 xuống 4-bit để giảm VRAM từ ~14GB xuống ~5GB. |

#### 2.1.2. LoRA Configuration

| Tham số | Giá trị | Mô tả |
| :--- | :---: | :--- |
| **LoRA Rank ($r$)** | $16$ | Kích thước ma trận low-rank. $r=16$ cân bằng giữa khả năng học và kích thước adapter. |
| **LoRA Alpha ($\alpha$)** | $32$ | Hệ số scaling. Tỷ lệ $\alpha / r = 2$ giúp adapter có ảnh hưởng đủ mạnh lên mô hình gốc. |
| **LoRA Dropout** | $0$ | Không dùng dropout trong adapter (Unsloth khuyến nghị $0$ để tối ưu tốc độ). |
| **Bias** | `"none"` | Không train bias, chỉ train LoRA weights. |
| **Target Modules** | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` | **7 modules** được áp dụng LoRA. Bao gồm toàn bộ Attention layers (Q/K/V/O) và MLP layers (gate/up/down) để adapter học được cả ngữ cảnh lẫn cách biến đổi thông tin. |

#### 2.1.3. Training Hyperparameters

| Tham số | Giá trị | Mô tả |
| :--- | :---: | :--- |
| **Epochs** | $3$ | Số lần lặp toàn bộ tập dữ liệu. Kết hợp Early Stopping nên không cần quá nhiều epoch. |
| **Batch Size** | $2$ (per device) | Số mẫu trong một forward pass. Giá trị nhỏ phù hợp với GPU T4/P100 (16GB VRAM). |
| **Gradient Accumulation** | $4$ steps | Tích lũy gradient qua 4 steps trước khi cập nhật weights. Effective batch size = $2 \times 4 = 8$. |
| **Learning Rate** | $2 \times 10^{-4}$ ($0.0002$) | Tốc độ học tiêu chuẩn cho QLoRA fine-tuning. |
| **Validation Split** | $20\%$ ($0.2$) | Tách 20% data làm Validation Set để theo dõi overfitting. |
| **Precision** | `bf16` (ưu tiên) / `fp16` (fallback) | Tự động chọn bf16 nếu GPU hỗ trợ, ngược lại dùng fp16. |
| **Packing** | `true` | Ghép nhiều mẫu ngắn vào cùng một sequence để tận dụng tối đa `max_seq_length`, tăng throughput. |

#### 2.1.4. Logging & Checkpointing

| Tham số | Giá trị | Mô tả |
| :--- | :---: | :--- |
| **Logging Steps** | $1$ | Ghi log training loss **mỗi step** để theo dõi chi tiết. |
| **Eval Steps** | $10$ | Đánh giá trên Validation Set mỗi 10 steps. |
| **Save Steps** | $10$ | Lưu checkpoint mỗi 10 steps. |
| **Save Total Limit** | $2$ | Chỉ giữ tối đa 2 checkpoint gần nhất để tiết kiệm dung lượng. |
| **Load Best Model At End** | `true` | Sau khi train xong, tự động load lại checkpoint có `eval_loss` thấp nhất. |
| **Metric For Best Model** | `eval_loss` | Tiêu chí chọn checkpoint tốt nhất dựa trên Validation Loss. |

#### 2.1.5. Early Stopping

| Tham số | Giá trị | Mô tả |
| :--- | :---: | :--- |
| **Patience** | $3$ | Dừng train nếu `eval_loss` không cải thiện sau **3 lần đánh giá liên tiếp** (tức 30 steps). |
| **Threshold** | $0.01$ | `eval_loss` phải giảm ít nhất $0.01$ mới được tính là "cải thiện". |

### 2.2. Cấu hình riêng cho từng Adapter

| Cấu hình | Explanation Adapter | Quiz Adapter |
| :--- | :--- | :--- |
| **Data File** | `data/processed/explanation_chat.jsonl` | `data/processed/quiz_chat.jsonl` |
| **Output Directory** | `models/adapters/explanation_v1` | `models/adapters/quiz_v1` |
| **Checkpoint Directory** | `outputs/checkpoints/explanation` | `outputs/checkpoints/quiz` |
| **System Prompt** | Socratic English tutor | Expert English quiz generator (JSON output) |

---

## 3. Dữ liệu huấn luyện (Training Data)

### 3.1. Định dạng dữ liệu

Cả 2 Adapter đều sử dụng định dạng **JSONL** (JSON Lines), mỗi dòng là một object chứa key `"messages"` theo chuẩn **Chat Template** của Qwen2.5. Dữ liệu raw được chuyển đổi thành format chat bằng `tokenizer.apply_chat_template()`.

#### A. Explanation Adapter — `explanation_chat.jsonl`

**Dữ liệu raw** (`data/sample/explanation_raw.jsonl`) có cấu trúc:

```json
{
  "topic": "Present Simple",
  "level": "A1",
  "student_input": "He go to school every day",
  "correct_answer": "He goes to school every day",
  "explanation": "Chào em, hãy nhìn vào chủ ngữ 'He'. Trong tiếng Anh, với He/She/It, động từ cần thêm 's' hoặc 'es'. Vậy câu này nên sửa lại là gì nhỉ?"
}
```

**Sau khi xử lý** thành chat format cho training:

```json
{
  "messages": [
    {"role": "system", "content": "You are a Socratic English tutor. Guide students to find errors themselves instead of giving answers immediately."},
    {"role": "user", "content": "Topic: Present Simple\nLevel: A1\nStudent wrote: \"He go to school every day\"\nCorrect answer: \"He goes to school every day\"\nExplain the error using Socratic method."},
    {"role": "assistant", "content": "Chào em, hãy nhìn vào chủ ngữ 'He'. Trong tiếng Anh, với He/She/It, động từ cần thêm 's' hoặc 'es'. Vậy câu này nên sửa lại là gì nhỉ?"}
  ]
}
```

**Các trường dữ liệu cần có:**

| Trường | Kiểu | Mô tả | Ví dụ |
| :--- | :---: | :--- | :--- |
| `topic` | string | Chủ đề ngữ pháp | `"Present Simple"`, `"Articles"`, `"Plural Nouns"` |
| `level` | string | Trình độ CEFR | `"A1"`, `"A2"`, `"B1"` |
| `student_input` | string | Câu sai của học sinh | `"He go to school every day"` |
| `correct_answer` | string | Câu đúng chuẩn | `"He goes to school every day"` |
| `explanation` | string | Lời giải thích Socratic (gợi mở, không cho đáp án trực tiếp) | `"Hãy nhìn vào chủ ngữ 'He'..."` |

**Yêu cầu về nội dung explanation:**
- Phải theo **phương pháp Socratic**: đặt câu hỏi gợi mở, không cho đáp án trực tiếp.
- Phải bao phủ nhiều **loại lỗi sai** khác nhau (ngữ pháp, từ vựng, cấu trúc câu).
- Nên có đủ các kịch bản: học sinh sai hoàn toàn, sai một chút, hỏi lý thuyết, và cả trường hợp đúng.

#### B. Quiz Adapter — `quiz_chat.jsonl`

**Dữ liệu raw** (`data/sample/quiz_raw.jsonl`) có cấu trúc:

```json
{
  "topic": "Present Simple",
  "difficulty": -1.2,
  "context": "Daily routines of a student",
  "output": {
    "question": "She ___ to the gym every day.",
    "options": ["go", "goes", "going", "gone"],
    "correct_answer": "goes",
    "explanation": "Vì chủ ngữ là 'She' nên động từ 'go' thêm 'es'."
  }
}
```

**Sau khi xử lý** thành chat format cho training:

```json
{
  "messages": [
    {"role": "system", "content": "You are an expert English quiz generator. Always output in valid JSON format."},
    {"role": "user", "content": "Generate a quiz question.\nTopic: Present Simple\nDifficulty (IRT β): -1.2\nContext: Daily routines of a student"},
    {"role": "assistant", "content": "{\"question\": \"She ___ to the gym every day.\", \"options\": [\"go\", \"goes\", \"going\", \"gone\"], \"correct_answer\": \"goes\", \"explanation\": \"Vì chủ ngữ là 'She' nên động từ 'go' thêm 'es'.\"}"}
  ]
}
```

**Các trường dữ liệu cần có:**

| Trường | Kiểu | Mô tả | Ví dụ |
| :--- | :---: | :--- | :--- |
| `topic` | string | Chủ đề ngữ pháp | `"Present Simple"`, `"Articles"` |
| `difficulty` | float | Độ khó theo thang IRT ($\beta$), thường trong khoảng $[-3.0, 3.0]$ | $-1.2$ (dễ), $0.5$ (trung bình), $2.0$ (khó) |
| `context` | string | Ngữ cảnh/chủ đề bài tập | `"Daily routines of a student"` |
| `output.question` | string | Câu hỏi trắc nghiệm (dạng fill-in-the-blank) | `"She ___ to the gym every day."` |
| `output.options` | array[4] | 4 đáp án lựa chọn | `["go", "goes", "going", "gone"]` |
| `output.correct_answer` | string | Đáp án đúng | `"goes"` |
| `output.explanation` | string | Giải thích tại sao đáp án đúng | `"Vì chủ ngữ là 'She'..."` |

**Yêu cầu về nội dung quiz:**
- Output của assistant **bắt buộc phải là JSON hợp lệ** (parseable bằng `json.loads()`).
- Dữ liệu phải phân phối đều theo thang `difficulty` ($\beta$): từ rất dễ ($\approx -3.0$) đến rất khó ($\approx 3.0$).
- Luôn có đúng **4 options**, 1 đáp án đúng và 3 distractor hợp lý.

### 3.2. Gold Dataset (Tập đánh giá cuối cùng)

Gold Dataset nằm tại `data/gold_dataset/` và **hoàn toàn tách biệt** khỏi dữ liệu training:

| File | Định dạng | Mô tả |
| :--- | :--- | :--- |
| `explanation_gold.jsonl` | Giống raw explanation | Dùng để đánh giá Win-Rate bằng LLM-as-a-Judge |
| `quiz_gold.jsonl` | Giống raw quiz | Dùng để đánh giá JSON Pass Rate cuối cùng |

**Quy tắc:** Mô hình **không bao giờ** được nhìn thấy Gold Dataset trong quá trình training.

### 3.3. Số lượng mẫu đề xuất

| Tập dữ liệu | Tỷ lệ | MVP (Tối thiểu) | Standard (Khuyên dùng) |
| :--- | :---: | :---: | :---: |
| **Train Set** | $80\%$ | $400 - 800$ | $1{,}500 - 3{,}000$ |
| **Validation Set** | $20\%$ | $50 - 100$ | $200 - 500$ |
| **Gold Dataset** | Riêng biệt | $50 - 100$ | $200 - 500$ |
| **Tổng cộng** | — | **$500 - 1{,}000$** | **$2{,}000 - 4{,}000$** |

> **Lưu ý:** Số lượng trên là cho **mỗi** Adapter. Tổng cộng cần $1{,}000 - 8{,}000$ mẫu cho cả 2.

### 3.4. Pipeline xử lý dữ liệu

```
data/sample/*_raw.jsonl          (Dữ liệu thô mẫu)
        │
        ▼  [tools/datasets/split_dataset.py]
data/processed/*_chat.jsonl      (Đã chuyển sang chat format + train/val split tự động)
        │
        ▼  [training/tools/datasets/train_*.py]
models/adapters/*_v1/            (Adapter weights đầu ra)
```

---

## 4. Môi trường chạy Training

### 4.1. Kaggle Notebook Setup

Cả 2 adapter được train trên **Kaggle** với cấu hình:

| Thành phần | Giá trị |
| :--- | :--- |
| **GPU** | T4 x2 hoặc P100 |
| **VRAM** | 16GB (đủ cho QLoRA 4-bit với 7B model) |
| **Framework** | Unsloth + TRL (`SFTTrainer`) + Transformers |
| **Dataset Upload** | Upload file `*_chat.jsonl` lên Kaggle Datasets |
| **Data Path (Kaggle)** | `/kaggle/input/eduboost-data/explanation_chat.jsonl` <br> `/kaggle/input/eduboost-data/quiz_chat.jsonl` |
| **Output Path (Kaggle)** | `/kaggle/working/explanation_adapter` <br> `/kaggle/working/quiz_adapter` |

### 4.2. Thư viện cần cài đặt

```bash
pip install unsloth
pip uninstall unsloth -y && pip install --upgrade --no-cache-dir --no-deps git+https://github.com/unslothai/unsloth.git
```

Các thư viện đi kèm (tự động cài qua Unsloth): `torch`, `transformers`, `trl`, `peft`, `datasets`, `bitsandbytes`.

---

## 5. Hệ thống đánh giá mô hình (Evaluation Metrics)

### 5.1. Chỉ số đánh giá chung: Validation Loss
Đây là chỉ số quan trọng nhất trong quá trình huấn luyện cho cả hai Adapter.
*   **Ý nghĩa:** Đo lường mức độ sai số của mô hình trên tập dữ liệu kiểm thử (không tham gia train).
*   **Mục tiêu:** Validation Loss càng thấp và ổn định, mô hình càng có khả năng tổng quát hóa tốt trên dữ liệu mới.

### 5.2. Chỉ số đặc thù cho Quiz Adapter: JSON Pass Rate
Vì Quiz Adapter yêu cầu đầu ra là dữ liệu cấu trúc để Backend có thể xử lý, tỷ lệ đúng định dạng là tiêu chí bắt buộc.
*   **Cách đo:** Chạy 100 prompt sinh quiz $\rightarrow$ Dùng hàm `json.loads()` để kiểm tra tính hợp lệ của chuỗi trả về.
*   **Công thức:** $\text{Pass Rate} = \frac{\text{Số JSON hợp lệ}}{\text{Tổng số mẫu}} \times 100\%$.
*   **Yêu cầu:** $\ge 95\%$.

### 5.3. Chỉ số đánh giá chất lượng: LLM-as-a-Judge (Cho Explanation Adapter)
Sử dụng mô hình mạnh hơn (GPT-4o) để đánh giá tính sư phạm của lời giải thích.
*   **Cách đo:** So sánh cặp (Pairwise Comparison) giữa Base Model và Fine-tuned Model.
*   **Tiêu chí:** Độ chính xác kiến thức và tính gợi mở (Socratic Method).
*   **Chỉ số:** **Win-Rate** (Tỷ lệ thắng của mô hình sau khi fine-tune).

---

## 6. Quy trình huấn luyện và Điều kiện dừng (Training Workflow)

### 6.1. Luồng thực hiện
1.  **Chia dữ liệu:** Tập huấn luyện (Training Set 80%) và Tập kiểm thử (Validation Set 20%) — chia tự động trong code với `seed=42`.
2.  **Format dữ liệu:** Áp dụng `tokenizer.apply_chat_template()` để chuyển messages thành text format phù hợp với Qwen2.5.
3.  **Theo dõi Loss:** Trong quá trình train, ghi log mỗi step và evaluate mỗi 10 steps. Vẽ biểu đồ đường cong Loss cho cả tập Train và Validation.
4.  **Early Stopping:** Tự động dừng nếu `eval_loss` không cải thiện $\ge 0.01$ sau 3 lần evaluate liên tiếp (30 steps).
5.  **Chọn Best Checkpoint:** Tự động load model có `eval_loss` thấp nhất (`load_best_model_at_end=True`).
6.  **Lưu Adapter:** Chỉ lưu LoRA weights (không lưu base model), kích thước adapter khoảng vài chục MB.

### 6.2. Điều kiện dừng (Stopping Criteria)

*   **Tín hiệu chính (Validation Loss + Early Stopping tự động):**
    *   Hệ thống tự dừng khi `eval_loss` không cải thiện sau `patience=3` lần evaluate.
    *   Nếu Training Loss tiếp tục giảm nhưng Validation Loss **tăng trở lại** $\rightarrow$ Early Stopping kích hoạt, chọn checkpoint tại điểm `eval_loss` thấp nhất.
*   **Tín hiệu bổ trợ (JSON Pass Rate - Chỉ dành cho Quiz Adapter):**
    *   Nếu Validation Loss ổn định nhưng JSON Pass Rate thấp ($< 90\%$), cần xem lại tập dữ liệu hoặc tăng nhẹ LoRA Rank ($r$).
    *   Khi JSON Pass Rate đạt $\approx 100\%$ và Validation Loss ổn định $\rightarrow$ **Kết thúc huấn luyện**.

### 6.3. Lựa chọn Checkpoint cuối cùng
Hệ thống tự động chọn Checkpoint thỏa mãn:
1.  Có **Validation Loss thấp nhất** (qua `load_best_model_at_end`).
2.  (Đối với Quiz) Đạt **JSON Pass Rate cao nhất** trên Gold Dataset.

---

**Bảng tóm tắt theo dõi cho báo cáo:**

| Adapter | Metric chính (Train) | Metric bổ trợ (Eval) | Điều kiện dừng |
| :--- | :--- | :--- | :--- |
| **Explanation** | Validation Loss | Win-Rate (GPT-4o) | Val Loss đạt cực tiểu |
| **Quiz** | Validation Loss | JSON Pass Rate | Val Loss cực tiểu $\text{ AND } \text{Pass Rate} \ge 95\%$ |

---

## 7. Tổng hợp cấu hình nhanh (Quick Reference)

```yaml
# === Chung cho cả 2 Adapter ===
model:
  base_model: "unsloth/Qwen2.5-7B-Instruct"
  max_seq_length: 2048
  load_in_4bit: true
  lora_r: 16
  lora_alpha: 32
  target_modules: [q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj]
  lora_dropout: 0
  bias: "none"

training:
  epochs: 3
  batch_size: 2              # per_device_train_batch_size
  grad_accum: 4              # effective_batch_size = 2 × 4 = 8
  learning_rate: 0.0002      # 2e-4
  val_split: 0.2             # 80/20 split
  logging_steps: 1
  eval_steps: 10
  save_steps: 10
  save_total_limit: 2
  early_stopping_patience: 3
  early_stopping_threshold: 0.01
  precision: bf16 (auto, fallback fp16)
  packing: true
  load_best_model_at_end: true
  metric_for_best_model: eval_loss
```

---

**Ghi chú cho bạn khi bảo vệ:**
Khi hội đồng hỏi về việc đánh giá độ khó của Quiz (IRT), bạn hãy trả lời: 
*"Vì việc đánh giá độ khó thực tế của một câu hỏi yêu cầu một tập mẫu học sinh lớn để tính toán tỷ lệ trả lời đúng, nên trong phạm vi đề tài này, em tập trung vào việc đảm bảo mô hình tuân thủ nghiêm ngặt định dạng JSON và tối ưu hóa Validation Loss để đảm bảo tính ổn định. Độ khó của câu hỏi được điều phối thông qua Prompting dựa trên giá trị $\beta$ từ mô hình IRT."*