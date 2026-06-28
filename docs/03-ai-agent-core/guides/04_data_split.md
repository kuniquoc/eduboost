# Phần 4: Chiến lược chia dữ liệu: Train, Validation, và Gold Dataset
### 1. Vai trò của từng tập dữ liệu (The 3-Way Split)

Khi bạn có một Gold Dataset riêng, thực chất bạn đang chia dữ liệu thành 3 phần: **Train $\rightarrow$ Val $\rightarrow$ Test (Gold)**.

| Tập dữ liệu | Tỷ lệ | Mục đích sử dụng | Tương đương trong học tập |
| :--- | :---: | :--- | :--- |
| **Train Set** | 80% | Cập nhật trọng số mô hình (Weights). | Bài tập về nhà, sách giáo khoa. |
| **Validation Set** | 20% | Theo dõi `eval_loss`, điều chỉnh Hyperparameters, quyết định điểm dừng (Early Stopping). | Bài kiểm tra 15 phút, kiểm tra giữa kỳ. |
| **Gold Dataset** | Riêng biệt | Đánh giá cuối cùng để báo cáo kết quả. Mô hình **không bao giờ** được nhìn thấy tập này trong suốt quá trình train. | **Kỳ thi cuối kỳ (Final Exam).** |

---

### 2. Tại sao không nên dùng tập Validation để báo cáo kết quả cuối cùng?

Nhiều người mắc sai lầm khi dùng tập Validation để tính điểm cuối cùng. Điều này dẫn đến hiện tượng **"Overfitting to the Validation Set"**:

1.  Bạn train mô hình $\rightarrow$ Xem kết quả trên tập Val.
2.  Bạn thấy kết quả chưa tốt $\rightarrow$ Bạn thay đổi Learning Rate, thay đổi LoRA Rank, hoặc thay đổi Epoch.
3.  Bạn lại train $\rightarrow$ Lại xem kết quả trên tập Val.
4.  **Kết quả:** Bạn vô tình "tinh chỉnh" mô hình sao cho nó đạt điểm cao nhất trên tập Val đó. Lúc này, tập Val không còn khách quan nữa vì nó đã gián tiếp tham gia vào quá trình ra quyết định của bạn.

$\rightarrow$ **Gold Dataset** giải quyết vấn đề này. Vì nó hoàn toàn độc lập, kết quả trên Gold Dataset là con số **trung thực nhất** về khả năng thực tế của AI.

---

### 3. Đặc điểm của một "Gold Dataset" chuẩn

Để gọi là "Gold", tập dữ liệu này không chỉ là chia ngẫu nhiên, mà nên có các đặc điểm sau:

*   **Chất lượng cực cao (High Fidelity):** Các câu trả lời trong Gold Dataset phải được con người (hoặc chuyên gia tiếng Anh) kiểm duyệt kỹ lưỡng, không có sai sót.
*   **Độ bao phủ (Coverage):** Phải chứa đầy đủ các trường hợp: câu dễ, câu khó, các lỗi sai phổ biến của học sinh.
*   **Kích thước vừa đủ:** Không cần quá lớn (ví dụ 100-200 mẫu chất lượng cao là đủ), nhưng phải đại diện cho thực tế.

---

### 4. Quy trình vận hành chuẩn cho đề tài của bạn

Bạn nên trình bày quy trình này trong báo cáo để ghi điểm về tư duy khoa học:

1.  **Bước 1 (Preprocessing):** Tách riêng **Gold Dataset** ra khỏi toàn bộ dữ liệu thô. Cất nó vào một "chiếc hộp kín".
2.  **Bước 2 (Training):** Chia phần dữ liệu còn lại thành **80% Train** và **20% Val**.
3.  **Bước 3 (Tuning):** Huấn luyện mô hình, theo dõi `eval_loss` trên tập Val để chọn ra Checkpoint tốt nhất.
4.  **Bước 4 (Final Eval):** Lấy Checkpoint tốt nhất đó, chạy thử trên **Gold Dataset**.
5.  **Bước 5 (Reporting):** Dùng kết quả từ Gold Dataset (JSON Pass Rate, Win-rate) để đưa vào bảng kết quả cuối cùng trong luận văn.

### Tóm tắt mô hình chia dữ liệu của bạn:

$$\text{Total Data} \xrightarrow{\text{Tách}} \begin{cases} \text{Gold Dataset (Test)} \rightarrow \text{Đánh giá cuối cùng} \\ \text{Remaining Data} \xrightarrow{\text{Chia 8/2}} \begin{cases} \text{Train Set} \rightarrow \text{Học} \\ \text{Val Set} \rightarrow \text{Theo dõi/Tinh chỉnh} \end{cases} \end{cases}$$

### 4. Bảng đề xuất số lượng mẫu (Samples)

Tôi chia làm 2 kịch bản: **MVP (Làm cho chạy được)** và **Standard (Chuẩn luận văn/đồ án)**.

| Tập dữ liệu | Tỷ lệ | MVP (Tối thiểu) | Standard (Khuyên dùng) | Ghi chú |
| :--- | :---: | :---: | :---: | :--- |
| **Train Set** | $\approx 80\%$ | $400 - 800$ | $1,500 - 3,000$ | Dùng để cập nhật trọng số Adapter. |
| **Val Set** | $\approx 10\%$ | $50 - 100$ | $200 - 500$ | Dùng để theo dõi `eval_loss` và dừng train. |
| **Gold Dataset** | $\approx 10\%$ | $50 - 100$ | $200 - 500$ | Dùng để đánh giá cuối cùng (Test). |
| **Tổng cộng** | $100\%$ | **$500 - 1,000$** | **$2,000 - 4,000$** | Tổng số mẫu cho **mỗi** Adapter. |

---

### 5. Phân tích chi tiết cho từng Adapter

Số lượng trên là tổng quát, nhưng đặc thù của hai Adapter này khác nhau, nên bạn cần phân bổ dữ liệu như sau:

#### A. Đối với Explanation Adapter (Ưu tiên sự đa dạng)
Adapter này cần học **phong cách (style)**. Bạn không cần quá nhiều mẫu cho một chủ đề, nhưng cần nhiều **loại lỗi sai** khác nhau.
*   **Chiến lược:** Thay vì thu thập 1.000 câu về "Present Simple", hãy thu thập 100 câu cho 10 chủ đề ngữ pháp khác nhau.
*   **Yêu cầu:** Đảm bảo có đủ các kịch bản:
    *   Học sinh sai hoàn toàn $\rightarrow$ Gợi mở từ cơ bản.
    *   Học sinh sai một chút $\rightarrow$ Gợi mở chi tiết.
    *   Học sinh hỏi lý thuyết $\rightarrow$ Giải thích súc tích.

#### B. Đối với Quiz Adapter (Ưu tiên phân phối độ khó)
Adapter này cần học **định dạng (format)** và **mức độ (difficulty)**.
*   **Chiến lược:** Dữ liệu phải trải đều theo thang đo IRT ($\beta$).
*   **Ví dụ:** Nếu bạn chia độ khó thành 5 mức (Rất dễ $\rightarrow$ Rất khó), mỗi mức nên có ít nhất $50 - 100$ mẫu. Nếu một mức độ khó quá ít dữ liệu, mô hình sẽ không biết cách điều chỉnh từ vựng/cấu trúc để tạo ra độ khó đó.

---

### 6. Lưu ý đặc biệt về Gold Dataset (Tập Vàng)

Vì Gold Dataset là thước đo cuối cùng để bạn báo cáo với hội đồng, hãy áp dụng quy tắc: **"Ít nhưng chất"**.

*   **Số lượng:** $100 - 200$ mẫu là đủ để tính toán tỷ lệ % (Pass Rate) và Win-rate một cách có ý nghĩa thống kê.
*   **Chất lượng:** Bạn nên tự tay kiểm tra hoặc nhờ giáo viên tiếng Anh rà soát lại từng câu trong tập này. Nếu Gold Dataset có sai sót, kết quả đánh giá mô hình sẽ bị sai lệch hoàn toàn.

---

### 7. Giải pháp khi thiếu dữ liệu (Data Augmentation)

Nếu bạn không thể thu thập đủ $2,000$ mẫu, hãy sử dụng 2 cách sau (đã có trong code tham khảo của bạn):

1.  **Synthetic Data (Dữ liệu tổng hợp):** Dùng GPT-4o để sinh ra dữ liệu. 
    *   *Prompt:* "Tôi có 100 mẫu giải thích ngữ pháp chuẩn. Hãy dựa vào phong cách này để sinh thêm 500 mẫu tương tự cho các chủ đề khác."
2.  **Paraphrasing (Viết lại):** Với một câu hỏi, hãy tạo ra 3-5 biến thể khác nhau về cách đặt câu (như trong phần `AUGMENTATION` của code bạn cung cấp). Điều này giúp mô hình không bị học vẹt (overfitting) và tăng khả năng hiểu các cách hỏi khác nhau của học sinh.

### Tóm tắt lời khuyên cho bạn:
Nếu bạn đang làm đồ án tốt nghiệp/luận văn, hãy hướng tới con số **$\approx 2,000$ mẫu cho mỗi adapter**. Đây là con số "đẹp", đủ để chứng minh bạn có đầu tư vào dữ liệu và đủ để mô hình đạt được độ ổn định cao, khiến hội đồng tin tưởng vào kết quả đánh giá.