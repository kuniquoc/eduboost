# Eval Rubric (Quiz Generation + Explanation)

Tài liệu này định nghĩa rubric chuẩn cho `src/eval/judge.py`.

## 1) Quiz Generation Rubric

### `json_format`
- **9-10**: JSON hợp lệ hoàn toàn, đủ 4 trường bắt buộc `question`, `options`, `correct_answer`, `explanation`; đúng kiểu dữ liệu; không có text ngoài JSON.
- **7-8**: JSON hợp lệ cú pháp nhưng có vấn đề nhỏ (field thừa, quy ước tên field chưa nhất quán, thứ tự field khác).
- **5-6**: JSON parse được nhưng thiếu trường bắt buộc hoặc sai kiểu dữ liệu.
- **3-4**: Lỗi cú pháp nhẹ nhưng vẫn có thể khôi phục tự động; hoặc chỉ có 1-2 trường.
- **1-2**: Không phải JSON parse được.

### `question_clarity`
- **9-10**: Câu tự nhiên, vị trí chỗ trống đúng trọng tâm kiểm tra, phù hợp CEFR mục tiêu, không mơ hồ.
- **7-8**: Câu rõ nghĩa nhưng văn phong hơi gượng hoặc độ khó lệch nhẹ.
- **5-6**: Truyền đạt được ý nhưng còn lỗi nhỏ hoặc có thể hiểu theo nhiều cách.
- **3-4**: Mơ hồ/thiếu ngữ cảnh hoặc sai trọng tâm bài học.
- **1-2**: Không thể hiểu được hoặc không liên quan nội dung cần kiểm tra.

### `distractor_quality`
- **9-10**: 3 đáp án nhiễu đều hợp lý, khai thác lỗi phổ biến, phân biệt rõ, chỉ có 1 đáp án đúng.
- **7-8**: Đa số nhiễu tốt nhưng có 1 phương án hơi lộ.
- **5-6**: Có ít nhất 1 nhiễu dễ loại hoặc bối cảnh khiến 2 đáp án có thể đúng.
- **3-4**: Nhiễu lộ liễu/trùng nghĩa hoặc có 2 đáp án cùng đúng.
- **1-2**: Nhiễu không liên quan hoặc không tồn tại đáp án đúng duy nhất.

### `correct_answer_accuracy`
- **9-10**: Đáp án đúng là phương án đúng duy nhất, chính xác tuyệt đối.
- **7-8**: Đáp án đúng, chỉ có nhược điểm trình bày nhẹ.
- **5-6**: Đáp án còn tranh cãi theo ngữ cảnh.
- **3-4**: Có dấu hiệu sai hoặc xuất hiện nhiều đáp án đúng.
- **1-2**: Đáp án sai rõ ràng hoặc không khớp options.

### `explanation_quality`
- **9-10**: Giải thích 1-2 câu, tiếng Việt, đúng quy tắc cốt lõi, trực tiếp giải thích vì sao đáp án đúng.
- **7-8**: Đúng nhưng dài dòng hoặc có câu không cần thiết.
- **5-6**: Đúng một phần nhưng thiếu ý cốt lõi hoặc quá phức tạp.
- **3-4**: Sai quy tắc hoặc chủ yếu bằng tiếng Anh.
- **1-2**: Không có giải thích hoặc giải thích không liên quan.

## 2) Explanation Rubric

### `content_accuracy`
- **9-10**: Nội dung chính xác, chỉ ra đúng lỗi và quy tắc.
- **7-8**: Hầu hết đúng, sai sót rất nhỏ.
- **5-6**: Đúng một phần, thiếu trọng tâm.
- **3-4**: Sai quy tắc đáng kể.
- **1-2**: Sai nghiêm trọng hoặc không liên quan.

### `socratic_pedagogy`
- **9-10**: Dẫn dắt bằng câu hỏi gợi mở, không lộ đáp án, giọng khích lệ tiếng Việt.
- **7-8**: Chủ yếu Socratic nhưng còn vài gợi ý hơi lộ.
- **5-6**: Kết hợp giữa dẫn dắt và cho thông tin trực tiếp.
- **3-4**: Chủ yếu giảng giải một chiều.
- **1-2**: Trả lời trực tiếp đáp án, không có yếu tố Socratic.

### `completeness`
- **9-10**: Chỉ ra đúng lỗi cụ thể, đủ quy tắc liên quan và đủ ngữ cảnh cho CEFR.
- **7-8**: Xử lý lỗi chính đúng nhưng còn thiếu ý phụ quan trọng.
- **5-6**: Chỉ xử lý một phần lỗi hoặc giải thích quá chung.
- **3-4**: Quá ngắn/chung chung, không giúp học viên tự sửa.
- **1-2**: Không đề cập lỗi cụ thể.

### `focus`
- **9-10**: Tập trung đúng lỗi trong câu hiện tại, không lạc đề.
- **7-8**: Đúng trọng tâm nhưng có thêm nội dung phụ gây phân tán nhẹ.
- **5-6**: Một phần đáng kể nội dung không gắn lỗi cụ thể.
- **3-4**: Chủ yếu bàn sang điểm ngữ pháp khác.
- **1-2**: Hoàn toàn không xử lý lỗi trong câu học viên.

## 3) Deterministic Rule for Quiz `json_format`

`json_format` được script chấm trước để tăng tính ổn định:
- Lấy điểm theo rule parser/schema của hệ thống.
- Judge GPT-4o bắt buộc dùng đúng điểm này cho `criteria.json_format`.
- Các tiêu chí còn lại vẫn do GPT-4o chấm.

## 4) Output Contract

Mỗi record phải có:
- `record_id`
- `overall` (1-10)
- `criteria` (đúng key theo task)
- `justification`
- `meta` (judge model, task type, tín hiệu json script nếu có)
