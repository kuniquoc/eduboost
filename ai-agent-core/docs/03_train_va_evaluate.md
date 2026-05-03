
# PHẦN 3: CHI TIẾT HUẤN LUYỆN (FINE-TUNING) VÀ ĐÁNH GIÁ MÔ HÌNH LLM (REVISED)

## 1. Chiến lược huấn luyện (Training Strategy)

Hệ thống sử dụng kỹ thuật **PEFT (Parameter-Efficient Fine-Tuning)** với phương pháp **QLoRA (Quantized Low-Rank Adaptation)**. Phương pháp này cho phép huấn luyện các Adapter nhỏ gắn vào mô hình gốc, giúp tối ưu tài nguyên VRAM và duy trì kiến thức tổng quát của mô hình.

### 1.1. Thông số tinh chỉnh (Hyperparameters)

Dưới đây là các tham số chi tiết được áp dụng cho cả **Explanation Adapter** và **Quiz Adapter**:

| Tham số | Giá trị gợi ý | Tác dụng chi tiết |
| :--- | :---: | :--- |
| **Base Model** | Llama-3-8B / Mistral-7B | Mô hình nền tảng cung cấp khả năng ngôn ngữ. |
| **LoRA Rank ($r$)** | $16$ | Kích thước ma trận cập nhật. $r=16$ đủ để học cấu trúc JSON và văn phong sư phạm. |
| **LoRA Alpha ($\alpha$)** | $32$ | Hệ số tỷ lệ điều khiển mức độ ảnh hưởng của Adapter lên mô hình gốc. |
| **Learning Rate** | $2 \times 10^{-4}$ | Tốc độ điều chỉnh trọng số, đảm bảo hội tụ mượt mà. |
| **Epochs** | $3 - 5$ | Số lần lặp lại tập dữ liệu. Dừng khi Validation Loss đạt mức tối ưu. |
| **Batch Size** | $4 - 8$ | Số mẫu xử lý trong một bước cập nhật (điều chỉnh theo VRAM). |
| **Weight Decay** | $0.01$ | Ngăn chặn overfitting bằng cách điều chuẩn trọng số. |
| **Target Modules** | `q_proj, v_proj, k_proj, o_proj` | Các lớp Attention được áp dụng LoRA để tối ưu hóa ngữ cảnh. |
| **Optimizer** | `paged_adamw_32bit` | Tối ưu hóa bộ nhớ GPU, tránh lỗi Out-of-Memory. |

---

## 2. Hệ thống đánh giá mô hình (Evaluation Metrics)

Vì không thể đo lường khách quan độ khó thực tế của từng câu hỏi sinh ra (IRT MAE), hệ thống tập trung vào hai chỉ số đo lường trực tiếp và chính xác: **Validation Loss** và **JSON Pass Rate**.

### 2.1. Chỉ số đánh giá chung: Validation Loss
Đây là chỉ số quan trọng nhất trong quá trình huấn luyện cho cả hai Adapter.
*   **Ý nghĩa:** Đo lường mức độ sai số của mô hình trên tập dữ liệu kiểm thử (không tham gia train).
*   **Mục tiêu:** Validation Loss càng thấp và ổn định, mô hình càng có khả năng tổng quát hóa tốt trên dữ liệu mới.

### 2.2. Chỉ số đặc thù cho Quiz Adapter: JSON Pass Rate
Vì Quiz Adapter yêu cầu đầu ra là dữ liệu cấu trúc để Backend có thể xử lý, tỷ lệ đúng định dạng là tiêu chí bắt buộc.
*   **Cách đo:** Chạy 100 prompt sinh quiz $\rightarrow$ Dùng hàm `json.loads()` để kiểm tra tính hợp lệ của chuỗi trả về.
*   **Công thức:** $\text{Pass Rate} = \frac{\text{Số JSON hợp lệ}}{\text{Tổng số mẫu}} \times 100\%$.
*   **Yêu cầu:** $\ge 95\%$.

### 2.3. Chỉ số đánh giá chất lượng: LLM-as-a-Judge (Cho Explanation Adapter)
Sử dụng mô hình mạnh hơn (GPT-4o) để đánh giá tính sư phạm của lời giải thích.
*   **Cách đo:** So sánh cặp (Pairwise Comparison) giữa Base Model và Fine-tuned Model.
*   **Tiêu chí:** Độ chính xác kiến thức và tính gợi mở (Socratic Method).
*   **Chỉ số:** **Win-Rate** (Tỷ lệ thắng của mô hình sau khi fine-tune).

---

## 3. Quy trình huấn luyện và Điều kiện dừng (Training Workflow)

### 3.1. Luồng thực hiện
1.  **Chia dữ liệu:** Tập huấn luyện (Training Set 80%) và Tập kiểm thử (Validation Set 20%).
2.  **Theo dõi Loss:** Trong quá trình train, vẽ biểu đồ đường cong Loss cho cả tập Train và tập Validation.
3.  **Kiểm tra định dạng (Riêng cho Quiz):** Sau mỗi Epoch, chạy script kiểm tra **JSON Pass Rate** trên tập Validation.

### 3.2. Điều kiện dừng (Stopping Criteria)

Việc dừng huấn luyện được quyết định dựa trên các tín hiệu sau:

*   **Tín hiệu chính (Validation Loss):**
    *   **Dừng khi hội tụ:** Khi Validation Loss giảm dần và bắt đầu đi ngang (không giảm thêm đáng kể sau 1-2 epoch).
    *   **Dừng khi Overfitting:** Nếu Training Loss tiếp tục giảm nhưng Validation Loss bắt đầu **tăng trở lại**, dừng ngay lập tức và chọn Checkpoint tại điểm Validation Loss thấp nhất.
*   **Tín hiệu bổ trợ (JSON Pass Rate - Chỉ dành cho Quiz Adapter):**
    *   Nếu Validation Loss đã ổn định nhưng JSON Pass Rate vẫn thấp ($< 90\%$), cần xem lại tập dữ liệu hoặc tăng nhẹ LoRA Rank ($r$).
    *   Khi JSON Pass Rate đạt $\approx 100\%$ và Validation Loss ổn định $\rightarrow$ **Kết thúc huấn luyện**.

### 3.3. Lựa chọn Checkpoint cuối cùng
Không lấy mô hình ở Epoch cuối cùng một cách máy móc. Hệ thống sẽ chọn Checkpoint thỏa mãn:
1.  Có **Validation Loss thấp nhất**.
2.  (Đối với Quiz) Đạt **JSON Pass Rate cao nhất**.

---

**Bảng tóm tắt theo dõi cho báo cáo:**

| Adapter | Metric chính (Train) | Metric bổ trợ (Eval) | Điều kiện dừng |
| :--- | :--- | :--- | :--- |
| **Explanation** | Validation Loss | Win-Rate (GPT-4o) | Val Loss đạt cực tiểu |
| **Quiz** | Validation Loss | JSON Pass Rate | Val Loss cực tiểu $\text{ AND } \text{Pass Rate} \ge 95\%$ |

---

**Ghi chú cho bạn khi bảo vệ:**
Khi hội đồng hỏi về việc đánh giá độ khó của Quiz (IRT), bạn hãy trả lời: 
*"Vì việc đánh giá độ khó thực tế của một câu hỏi yêu cầu một tập mẫu học sinh lớn để tính toán tỷ lệ trả lời đúng, nên trong phạm vi đề tài này, em tập trung vào việc đảm bảo mô hình tuân thủ nghiêm ngặt định dạng JSON và tối ưu hóa Validation Loss để đảm bảo tính ổn định. Độ khó của câu hỏi được điều phối thông qua Prompting dựa trên giá trị $\beta$ từ mô hình IRT."*