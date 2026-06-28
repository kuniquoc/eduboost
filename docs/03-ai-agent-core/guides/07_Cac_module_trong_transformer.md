Trong các mô hình ngôn ngữ lớn hiện đại như Llama 3, Qwen2 hay Gemma, dữ liệu đầu vào sẽ đi qua nhiều khối xử lý (Transformer blocks). Mỗi khối này có nhiệm vụ giúp mô hình “đọc”, “hiểu”, “liên kết ngữ cảnh” và cuối cùng tạo ra phản hồi phù hợp.

Bên trong mỗi Transformer block thường tồn tại hai thành phần chính:

1. Cơ chế Attention — giúp mô hình xác định thông tin nào cần chú ý.
2. Mạng Feed Forward (MLP) — giúp mô hình biến đổi và xử lý sâu hơn các thông tin đã được attention chọn lọc.

Các module như `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj` và `down_proj` chính là những lớp biến đổi tuyến tính (linear projection layers) nằm bên trong hai thành phần này. Khi sử dụng kỹ thuật LoRA để fine-tune mô hình, các lớp này thường được chọn làm nơi gắn adapter vì chúng ảnh hưởng trực tiếp đến khả năng suy luận và biểu diễn tri thức của mô hình.

---

# 1. Nhóm Attention: q_proj, k_proj, v_proj, o_proj

Cơ chế Attention có thể được hiểu như quá trình “đọc hiểu có chọn lọc”. Khi con người đọc một câu văn, chúng ta không chú ý đồng đều đến mọi từ; thay vào đó, não bộ sẽ tự động tập trung vào những từ quan trọng nhất để hiểu ngữ nghĩa. Transformer hoạt động theo cách tương tự.

Để thực hiện điều này, mô hình cần tạo ra ba dạng biểu diễn khác nhau cho mỗi token: Query, Key và Value.

## q_proj — Query Projection

`q_proj` là lớp dùng để tạo ra Query vectors.

Q = XW_Q

Có thể hiểu Query như một “câu hỏi” mà token hiện tại đang đặt ra cho toàn bộ câu.

Ví dụ, trong câu:

```text id="d8s9op"
"The cat sat on the mat"
```

khi mô hình xử lý từ “sat”, nó cần biết:

* ai đang ngồi,
* ngồi ở đâu.

Khi đó Query sẽ đóng vai trò như tín hiệu tìm kiếm thông tin liên quan trong các token còn lại.

Do đó, `q_proj` quyết định cách mô hình “đặt câu hỏi” đối với ngữ cảnh.

---

## k_proj — Key Projection

`k_proj` tạo ra Key vectors.

K = XW_K

Nếu Query được xem là “câu hỏi”, thì Key có thể được hiểu là “nhãn mô tả thông tin mà mỗi token đang sở hữu”.

Attention sẽ so sánh Query với Key để xác định token nào có liên quan nhất.

Nói cách khác:

* Query hỏi: “Tôi cần thông tin gì?”
* Key trả lời: “Tôi có phù hợp với yêu cầu đó không?”

Vì vậy, `k_proj` ảnh hưởng trực tiếp đến cách mô hình xác định mối liên hệ giữa các từ trong câu.

---

## v_proj — Value Projection

`v_proj` tạo ra Value vectors.

V = XW_V

Value chính là phần thông tin thực sự được truyền đi sau khi attention xác định token nào quan trọng.

Nếu Key giống “mục lục” hoặc “thẻ phân loại”, thì Value chính là “nội dung bên trong”.

Do đó:

* Query và Key dùng để tính mức độ liên quan,
* còn Value mới là dữ liệu được mô hình sử dụng để tạo hiểu biết ngữ cảnh.

---

## Attention tổng quát

Sau khi có Query, Key và Value, mô hình tính attention bằng công thức:

\mathrm{Attention}(Q,K,V)=\mathrm{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V

Quá trình này cho phép mô hình:

* xác định token quan trọng,
* gán mức độ chú ý,
* và tổng hợp thông tin phù hợp nhất cho từng vị trí trong câu.

Đây là cơ chế cốt lõi giúp các LLM có khả năng hiểu ngữ cảnh dài và suy luận liên kết.

---

## o_proj — Output Projection

Sau khi attention hoàn tất việc tổng hợp thông tin, kết quả sẽ đi qua `o_proj`.

O = HW_O

Vai trò của lớp này là:

* kết hợp thông tin từ nhiều attention heads,
* chuẩn hóa đầu ra,
* và đưa dữ liệu về đúng không gian biểu diễn cần thiết cho bước tiếp theo.

Nếu attention được xem là quá trình “thu thập thông tin”, thì `o_proj` chính là bước “tổ chức và đóng gói” thông tin đó trước khi chuyển tiếp.

---

# 2. Nhóm MLP: gate_proj, up_proj, down_proj

Sau khi attention xác định thông tin quan trọng, mô hình cần tiếp tục xử lý sâu hơn để:

* biến đổi ý nghĩa,
* ghi nhớ tri thức,
* và tạo biểu diễn ngữ nghĩa phức tạp hơn.

Nhiệm vụ này thuộc về Feed Forward Network (MLP).

Trong nhiều mô hình hiện đại, MLP thường sử dụng kiến trúc SwiGLU với ba module chính.

---

## up_proj — Mở rộng không gian biểu diễn

`up_proj` có nhiệm vụ tăng số chiều của vector đặc trưng.

H_{up}=XW_{up}

Có thể hình dung quá trình này như việc:

* mở rộng số lượng “neuron suy nghĩ”,
* tạo thêm không gian để mô hình biểu diễn các mẫu thông tin phức tạp hơn.

Ví dụ:

* hidden size ban đầu: 4096
* sau `up_proj`: 14336

Việc mở rộng này giúp mô hình có khả năng học được nhiều đặc trưng ngữ nghĩa tinh vi hơn.

---

## gate_proj — Cơ chế chọn lọc thông tin

`gate_proj` tạo ra một “cổng điều tiết” (gate).

H_{gate}=\mathrm{SiLU}(XW_{gate})

Vai trò của gate tương tự một hệ thống lọc:

* thông tin quan trọng được giữ lại,
* thông tin ít liên quan bị giảm ảnh hưởng.

Điều này giúp mô hình không chỉ mở rộng biểu diễn, mà còn biết cách chọn lọc đặc trưng nào thực sự hữu ích.

---

## SwiGLU — Cơ chế kết hợp

Trong các LLM hiện đại, `up_proj` và `gate_proj` thường được kết hợp theo cơ chế SwiGLU:

\mathrm{MLP}(x)=\mathrm{SiLU}(xW_{gate})\odot(xW_{up})

Quá trình này có thể hiểu đơn giản là:

* `up_proj` tạo ra nhiều đặc trưng,
* `gate_proj` quyết định đặc trưng nào nên được kích hoạt mạnh.

Nhờ đó mô hình vừa có khả năng biểu diễn lớn, vừa tránh việc mọi thông tin đều được xử lý ngang nhau.

---

## down_proj — Thu gọn biểu diễn

Sau khi xử lý ở không gian lớn, dữ liệu sẽ đi qua `down_proj`.

H_{down}=XW_{down}

Lớp này đưa vector trở về kích thước ban đầu để tiếp tục truyền qua các Transformer block tiếp theo.

Nếu `up_proj` là quá trình “mở rộng suy nghĩ”, thì `down_proj` là bước:

* cô đọng,
* nén,
* và giữ lại thông tin quan trọng nhất.

---

# 3. Ý nghĩa khi áp dụng LoRA vào các module này

Kỹ thuật LoRA không sửa trực tiếp toàn bộ mô hình, mà chỉ gắn thêm các adapter nhỏ vào một số module trọng yếu.

Việc chọn các module như:

* `q_proj`, `k_proj`, `v_proj`, `o_proj`
  giúp mô hình học lại:
* cách chú ý,
* cách liên kết ngữ cảnh,
* và cách suy luận.

Trong khi đó, việc thêm:

* `gate_proj`, `up_proj`, `down_proj`
  giúp mô hình học:
* kiến thức mới,
* phong cách ngôn ngữ mới,
* hoặc domain chuyên biệt.

Do đó:

* fine-tune attention chủ yếu thay đổi “cách mô hình nhìn thông tin”,
* còn fine-tune MLP thay đổi “cách mô hình xử lý và biểu diễn tri thức”.

Đây là lý do nhiều cấu hình LoRA hiện đại áp dụng adapter lên toàn bộ bảy module để đạt hiệu quả thích nghi mạnh hơn trong các bài toán instruction tuning, domain adaptation hoặc reasoning enhancement.
