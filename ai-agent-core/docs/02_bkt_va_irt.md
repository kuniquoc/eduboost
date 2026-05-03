# PHẦN 2: THIẾT LẬP THÔNG SỐ MÔ HÌNH THEO DÕI NGƯỜI HỌC (BKT & IRT)

## 1. Mô hình Bayesian Knowledge Tracing (BKT)

### 1.1. Định nghĩa và Mục tiêu
BKT được sử dụng để ước lượng xác suất một học sinh đã nắm vững một kỹ năng cụ thể (Skill Mastery) tại một thời điểm $n$. Đây là một mô hình Hidden Markov Model (HMM) với trạng thái ẩn là "Biết" hoặc "Không biết".

### 1.2. Bảng thông số thiết lập (Parameter Configuration)
Hệ thống sử dụng phương pháp **Fixed Parameter BKT** với các giá trị tham chiếu từ các nghiên cứu về Hệ thống Gia sư Thông minh (ITS).

| Tham số | Ký hiệu | Giá trị lựa chọn | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| **Initial Knowledge** | $P(L_0)$ | $0.3$ | Xác suất học sinh biết kỹ năng ngay từ khi bắt đầu. |
| **Transition Prob.** | $P(T)$ | $0.1$ | Xác suất học sinh chuyển từ "Không biết" $\rightarrow$ "Biết" sau một tương tác. |
| **Slip Probability** | $P(S)$ | $0.1$ | Xác suất trả lời **Sai** dù học sinh **đã biết** kỹ năng. |
| **Guess Probability** | $P(G)$ | $0.25$ | Xác suất trả lời **Đúng** dù học sinh **chưa biết** kỹ năng. |

### 1.3. Lý luận và Căn cứ lựa chọn
*   **$P(L_0) = 0.3$**: Được thiết lập ở mức trung bình thấp, giả định học sinh có một lượng kiến thức nền cơ bản nhưng chưa thành thạo. Giá trị này sẽ được cập nhật động nếu có bài test đầu vào (Placement Test).
*   **$P(T) = 0.1$**: Dựa trên nghiên cứu của **Koedly et al. (2005)**, việc tiếp thu kiến thức là một quá trình tích lũy. Giá trị $0.1$ đảm bảo mô hình không thay đổi trạng thái quá đột ngột, phản ánh đúng thực tế học tập.
*   **$P(S) = 0.1$**: Phản ánh tỷ lệ sai sót do bất cẩn. Trong các hệ thống ITS, tỷ lệ Slip thường thấp hơn tỷ lệ Guess vì khi đã biết, xác suất sai thường chỉ do lỗi trình bày hoặc nhầm lẫn nhỏ.
*   **$P(G) = 0.25$**: Được tính toán dựa trên logic của câu hỏi trắc nghiệm 4 lựa chọn ($1/4 = 0.25$). Đây là xác suất lý thuyết khi học sinh chọn ngẫu nhiên một đáp án.

### 1.4. Công thức cập nhật trạng thái
Sau mỗi câu trả lời, xác suất nắm vững $P(L_{n+1})$ được tính qua 2 bước:

**Bước 1: Cập nhật dựa trên quan sát (Observation Update)**
*   Nếu trả lời **Đúng**: $P(L_{n+1} | \text{Correct}) = \frac{P(L_n)(1-P(S))}{P(L_n)(1-P(S)) + (1-P(L_n))P(G)}$
*   Nếu trả lời **Sai**: $P(L_{n+1} | \text{Wrong}) = \frac{P(L_n)P(S)}{P(L_n)P(S) + (1-P(L_n))(1-P(G))}$

**Bước 2: Cập nhật khả năng chuyển đổi (Transition Update)**
$$P(L_{n+1}) = P(L_{n+1} | \text{Result}) + (1 - P(L_{n+1} | \text{Result})) \cdot P(T)$$

---

## 2. Lý thuyết Đáp ứng Câu hỏi (Item Response Theory - IRT)

### 2.1. Định nghĩa và Mục tiêu
Trong khi BKT theo dõi "tiến độ", IRT được dùng để đo lường "mức độ". IRT giúp hệ thống xác định năng lực thực tế của học sinh ($\theta$) và độ khó của câu hỏi ($\beta$) trên cùng một thang đo.

### 2.2. Mô hình triển khai: 1PL (One-Parameter Logistic Model)
Để tối ưu hóa hiệu năng và đơn giản hóa việc tính toán, hệ thống sử dụng mô hình **1PL (Rasch Model)**, chỉ tập trung vào tham số độ khó.

**Công thức xác suất trả lời đúng:**
$$P(\text{correct}) = \frac{1}{1 + e^{-(\theta - \beta)}}$$
Trong đó:
*   $\theta$ (Theta): Năng lực của học sinh.
*   $\beta$ (Beta): Độ khó của câu hỏi.

### 2.3. Thiết lập thang đo và Tham số
Hệ thống sử dụng thang đo chuẩn từ $-3.0$ đến $3.0$ (phân phối chuẩn):

| Thông số | Ký hiệu | Khoảng giá trị | Ý nghĩa |
| :--- | :---: | :---: | :--- |
| **Student Ability** | $\theta$ | $[-3.0, 3.0]$ | $-3$: Rất yếu $\rightarrow$ $0$: Trung bình $\rightarrow$ $3$: Rất giỏi. |
| **Item Difficulty** | $\beta$ | $[-3.0, 3.0]$ | $-3$: Rất dễ $\rightarrow$ $0$: Trung bình $\rightarrow$ $3$: Rất khó. |

### 2.4. Cơ chế Matching (Lựa chọn câu hỏi thích ứng)
Mục tiêu của Agent là chọn câu hỏi sao cho học sinh có xác suất trả lời đúng xấp xỉ $50\%$ ($P \approx 0.5$). Điều này xảy ra khi:
$$\theta \approx \beta$$
**Chiến lược chọn câu hỏi:**
1.  Lấy giá trị $\theta$ hiện tại của học sinh.
2.  Truy vấn trong ngân hàng câu hỏi (hoặc yêu cầu Quiz Adapter sinh) câu hỏi có $\beta$ nằm trong khoảng $[\theta - 0.5, \theta + 0.5]$.
3.  Nếu học sinh trả lời đúng $\rightarrow$ Tăng $\theta$. Nếu trả lời sai $\rightarrow$ Giảm $\theta$.

---

## 3. Sự phối hợp giữa BKT và IRT trong Agent Loop

Sự kết hợp này tạo nên cơ chế **Adaptive Learning** hoàn chỉnh:

| Bước | Thành phần điều khiển | Logic vận hành | Kết quả đầu ra |
| :--- | :--- | :--- | :--- |
| **1** | **BKT** | Kiểm tra $P(L)$ của kỹ năng hiện tại. | Quyết định: **Dạy** hay **Luyện tập**. |
| **2** | **IRT** | Nếu là Luyện tập, lấy $\theta$ để chọn $\beta$. | Xác định **Độ khó** của câu hỏi. |
| **3** | **LLM** | Nhận $\beta$ và Topic từ IRT. | Sinh câu hỏi cụ thể (Quiz Adapter). |
| **4** | **Feedback** | Kết quả Đúng/Sai $\rightarrow$ Cập nhật cả BKT và IRT. | Cập nhật $P(L)$ và $\theta$ cho lần sau. |

**Ví dụ thực tế:**
*   **BKT:** $P(\text{Present Simple}) = 0.6$ (Đang trong giai đoạn luyện tập).
*   **IRT:** $\theta = -1.2$ (Học sinh đang ở mức yếu).
*   **Agent:** Gọi Quiz Adapter sinh câu hỏi Present Simple với độ khó $\beta = -1.2$ (Câu hỏi dễ).
*   **Kết quả:** Học sinh trả lời đúng $\rightarrow$ BKT tăng $P(L)$ lên $0.65$, IRT tăng $\theta$ lên $-1.0$.

---

**Ghi chú cho bạn:**
*   Phần này đã cung cấp đầy đủ cơ sở toán học và lý luận. Khi bảo vệ, nếu hội đồng hỏi *"Tại sao chọn 1PL mà không phải 3PL (có thêm tham số đoán và sơ suất)?"*, bạn hãy trả lời: *"Để giảm độ phức tạp tính toán và tránh overfitting khi tập dữ liệu mẫu nhỏ, mô hình 1PL cung cấp sự cân bằng tốt nhất giữa độ chính xác và hiệu năng cho một AI Agent thời gian thực."*