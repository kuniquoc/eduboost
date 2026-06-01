# Đặc tả yêu cầu hệ thống EduBoost

## 3.1.1. Xác định đối tượng người dùng và kịch bản sử dụng

### a. Phân tích các nhóm người dùng chính

Hệ thống phục vụ ba nhóm người dùng với vai trò và quyền hạn khác nhau:

- **Nhóm 1 – Người học**: Đối tượng trung tâm. Cá nhân có nhu cầu học Tiếng Anh ở nhiều trình độ, từ mới bắt đầu đến nâng cao. Tương tác thông qua: làm bài kiểm tra đầu vào, luyện tập theo lộ trình cá nhân hóa, ôn tập định kỳ và đặt câu hỏi cho AI.

- **Nhóm 2 – Giáo viên**: Xây dựng và quản lý nội dung học tập. Hệ thống cung cấp giao diện đơn giản để tạo chủ đề, tải tài liệu, xây dựng ngân hàng câu hỏi. Theo dõi tiến trình học tập của người học.

- **Nhóm 3 – Quản trị viên**: Vận hành và duy trì hệ thống. Quản lý tài khoản, phân quyền truy cập, giám sát hiệu năng, xử lý sự cố kỹ thuật.

### b. Các kịch bản sử dụng điển hình (Use Case)

- **Kịch bản 1**: Người học đăng ký → kiểm tra đầu vào → xếp loại năng lực → khởi tạo lộ trình cá nhân hóa.
- **Kịch bản 2**: Người học luyện tập hàng ngày theo lộ trình → nhận phản hồi → cập nhật tiến trình.
- **Kịch bản 3**: Người học đặt câu hỏi cho AI → AI truy xuất tài liệu → cung cấp giải thích phù hợp.
- **Kịch bản 4**: Giáo viên tạo chủ đề → tải tài liệu → xây dựng ngân hàng câu hỏi hoặc sinh câu hỏi tự động.
- **Kịch bản 5**: Giáo viên theo dõi tiến trình học tập và xem báo cáo tổng hợp.

---

## 3.1.2. Yêu cầu chức năng

### Kiểm tra và đánh giá trình độ đầu vào
- Bài kiểm tra đầu vào thích ứng, tự động điều chỉnh độ khó dựa trên kết quả trả lời.
- Tự động xác định bậc năng lực ban đầu (Dễ / Trung bình / Khó) và khởi tạo hồ sơ BKT.
- Trình bày kết quả rõ ràng: điểm mạnh và điểm yếu.

### Cá nhân hóa lộ trình học tập
- Tự động đề xuất chủ đề và bài tập tiếp theo dựa trên hồ sơ năng lực hiện tại.
- Lộ trình cập nhật động sau mỗi phiên học.
- Hiển thị trực quan tiến trình học tập theo từng chủ đề.

### Hệ thống luyện tập và kiểm tra định kỳ
- Hỗ trợ nhiều dạng bài: trắc nghiệm một đáp án và điền vào chỗ trống.
- Câu hỏi từ ngân hàng, lọc theo chủ đề và bậc độ khó phù hợp.
- Cập nhật BKT và lịch ôn tập Spaced Repetition sau mỗi phiên.
- Phản hồi tức thì: đáp án đúng và giải thích ngắn gọn.

### Hỗ trợ học tập thông minh bằng AI (hỏi đáp, giải thích)
- Giao diện hội thoại cho phép đặt câu hỏi bằng ngôn ngữ tự nhiên.
- AI truy xuất đúng đoạn tài liệu liên quan (RAG), tránh bịa đặt.
- Câu trả lời điều chỉnh theo bậc năng lực hiện tại.
- Hiển thị nguồn tài liệu tham chiếu.

### Quản lý chủ đề, tài liệu và tạo quiz (giáo viên)
- CRUD chủ đề học tập qua giao diện trực quan.
- Hỗ trợ tải lên PDF, DOCX — tự động xử lý và vector hóa cho RAG.
- Tạo câu hỏi thủ công với đầy đủ thông tin.
- Sinh câu hỏi tự động từ tài liệu, giáo viên xem xét và xác nhận trước khi đưa vào ngân hàng.

---

## 3.1.3. Yêu cầu phi chức năng

- **Hiệu năng**: API nghiệp vụ < 1 giây; chức năng AI < 5 giây.
- **Khả năng mở rộng**: Kiến trúc module hóa, mỗi thành phần có thể nâng cấp độc lập.
- **Bảo mật**: Xác thực trước truy cập, mã hóa dữ liệu nhạy cảm, phân quyền chặt chẽ.
- **UX**: Giao diện đơn giản, tương thích web và mobile.

---

## 3.2. Thiết kế kiến trúc tổng thể

### 3.2.1. Kiến trúc hệ thống

#### a. Mô hình kiến trúc ba tầng
- **Frontend**: Hiển thị giao diện, tiếp nhận thao tác người dùng.
- **Backend**: Xử lý nghiệp vụ, xác thực, quản lý dữ liệu, điều phối.
- **AI Services**: Hỏi đáp, RAG, sinh câu hỏi, cá nhân hóa.

#### b. Vai trò từng tầng

**Frontend**:
- Hiển thị giao diện học tập, luyện tập, hỏi đáp AI, quản trị nội dung.
- Gửi yêu cầu tới Backend qua API.
- Quản lý trạng thái giao diện và phiên đăng nhập.

**Backend**:
- Xác thực và phân quyền.
- Quản lý hồ sơ học tập, chủ đề, tài liệu, câu hỏi.
- Xử lý logic luyện tập, kiểm tra đầu vào, cập nhật BKT.
- Điều phối yêu cầu giữa Frontend và AI Services.
- Kết nối CSDL quan hệ và vector database.

**AI Services**:
- Explanation Adapter: hỏi đáp và giải thích nội dung.
- Question Generation Adapter: sinh câu hỏi từ tài liệu.
- Retrieval Service: semantic search trên vector database.
- AI Agent: điều phối luồng retrieval → prompt → LLM.

#### c. Giao thức giao tiếp
- REST API cho tác vụ nghiệp vụ thông thường.
- HTTP nội bộ giữa Backend và AI Services (đồng bộ cho hỏi đáp, bất đồng bộ cho sinh câu hỏi lớn).

#### d. Thành phần kiến trúc
- Client Web/Mobile
- Frontend Application
- Backend API Server
- Authentication Service
- AI Agent Service
- Retrieval Service
- Vector Database
- Relational Database
- Large Language Model (LLM)

**Luồng xử lý tổng quát**:
1. Người dùng thao tác trên Frontend.
2. Frontend gửi yêu cầu đến Backend API.
3. Backend xử lý nghiệp vụ hoặc chuyển tiếp yêu cầu AI.
4. AI Agent truy xuất dữ liệu từ Vector Database.
5. Context được đưa vào prompt gửi đến LLM.
6. Kết quả phản hồi trả về Frontend.

### 3.2.2. Thiết kế tầng Frontend

#### a. Công nghệ
- ReactJS (SPA), TypeScript, TailwindCSS, Axios/Fetch API.

#### b. Màn hình chính

**Người học**: Đăng nhập/Đăng ký, Kiểm tra đầu vào, Lộ trình cá nhân, Luyện tập/Ôn tập, Hỏi đáp AI, Thống kê tiến trình.

**Giáo viên**: Quản lý chủ đề, Tải tài liệu, Quản lý ngân hàng câu hỏi, Sinh quiz AI, Theo dõi tiến trình học viên.

#### c. State management & đồng bộ
- REST API cho dữ liệu thông thường.
- WebSocket/streaming cho AI chat realtime.
- Client cache để giảm request.
- Access token lưu qua HTTP-only cookie hoặc secure storage.

### 3.2.3. Thiết kế tầng Backend

#### a. Công nghệ
- ASP.NET Core Web API
- Entity Framework Core
- PostgreSQL
- Redis (caching, queue)
- JWT Authentication

Kiến trúc phân lớp: Controller → Service → Repository → Infrastructure.

#### b. Module dịch vụ cốt lõi
- **Authentication Module**: Đăng nhập, đăng ký, JWT, phân quyền.
- **Learning Module**: Quản lý phiên học, lấy câu hỏi, cập nhật tiến trình.
- **Placement Test Module**: Bài kiểm tra đầu vào, tính năng lực ban đầu.
- **BKT & Recommendation Module**: Cập nhật xác suất thành thạo, đề xuất nội dung.
- **Document Management Module**: Quản lý tài liệu, pipeline vector hóa.
- **AI Gateway Module**: Điều phối request sang AI Services, timeout/retry.

### 3.2.4. Thiết kế tầng AI Services

#### a. AI Agent
1. Xác định loại tác vụ.
2. Truy xuất dữ liệu liên quan.
3. Tạo prompt phù hợp.
4. Gửi yêu cầu tới LLM.
5. Hậu xử lý và trả kết quả.

#### b. Adapter
- **Explanation Adapter**: Xử lý câu hỏi, truy xuất context, sinh giải thích phù hợp trình độ.
- **Question Generation Adapter**: Phân tích tài liệu, sinh câu hỏi theo chủ đề và độ khó.

#### c. RAG & Knowledge Base
Quy trình: Câu hỏi → Sinh embedding → Semantic search → Context vào prompt → LLM sinh câu trả lời.

---

## 3.3. Thiết kế cơ sở dữ liệu

### 3.3.1. Mô hình dữ liệu quan hệ

#### a. Bảng User & UserProfile

**User**: UserId, FullName, Email, PasswordHash, Role, CreatedAt.

**UserProfile**: ProfileId, UserId, CurrentLevel, OverallMasteryScore, PreferredTopics, LearningStreak.

#### b. Bảng lịch sử học tập

**LearningSession**: SessionId, UserId, TopicId, StartTime, EndTime, Score.

**QuizAttempt**: AttemptId, UserId, QuestionId, SelectedAnswer, IsCorrect, AnswerTime.

**PlacementTestResult**: ResultId, UserId, InitialLevel, FinalScore, CreatedAt.

#### c. Bảng chủ đề, tài liệu, câu hỏi

**Topic**: TopicId, TopicName, Description, DifficultyLevel.

**Document**: DocumentId, TopicId, FileName, FileType, UploadDate.

**Question**: QuestionId, TopicId, Content, QuestionType, DifficultyLevel, CorrectAnswer, Explanation, SourceDocumentId.

#### d. Bảng lộ trình cá nhân hóa

**PersonalizedLearningPath**: PathId, UserId, TopicId, RecommendedDifficulty, PriorityScore, NextReviewDate.

#### e. ERD
Quan hệ: User ↔ UserProfile, User ↔ LearningSession, User ↔ QuizAttempt, Topic ↔ Document ↔ Question, User ↔ PersonalizedLearningPath.

### 3.3.2. Vector Database

- Lưu trữ: Embedding vector, nội dung chunk, metadata (TopicId, DocumentId).
- Index: ANN (Approximate Nearest Neighbor) + metadata filtering.
- Tích hợp RAG: Sinh embedding → truy xuất top-k → gửi context cho AI Agent.

### 3.3.3. Cấu trúc lưu trữ trạng thái học tập

#### a. Tham số BKT
MasteryProbability, GuessProbability, SlipProbability, TransitionProbability — cập nhật liên tục sau mỗi lần luyện tập.

#### b. Cập nhật xác suất thành thạo
1. Xác định đúng/sai.
2. Module BKT cập nhật xác suất.
3. Ghi vào CSDL.
4. Recommendation Engine điều chỉnh lộ trình.

#### c. Lịch trình Spaced Repetition
LastReviewDate, NextReviewDate, ReviewInterval, EaseFactor, RetentionScore — xác định nội dung cần ôn, thời điểm ôn, tần suất tối ưu.

---

## 3.4. Thiết kế quản lý tài liệu và chủ đề

### 3.4.1. Quản lý chủ đề

#### a. Cấu trúc dữ liệu
TopicId, TopicName, Description, DifficultyLevel, CreatedBy, CreatedAt, UpdatedAt, Status + metadata bổ sung (kỹ năng liên quan, từ khóa, mức ưu tiên).

#### b. Quy trình quản lý
1. Truy cập giao diện quản lý.
2. Nhập thông tin cơ bản.
3. Thiết lập mức độ khó.
4. Lưu chủ đề.
5. Liên kết tài liệu và câu hỏi.

#### c. Vai trò trong AI Agent
TopicId dùng làm metadata filter trong vector database, ưu tiên truy xuất theo chủ đề hiện tại, giảm nhiễu retrieval.

### 3.4.2. Quản lý tài liệu

#### a. Metadata
DocumentId, TopicId, FileName, FileType, FileSize, UploadedBy, UploadDate, Language, ChunkCount, ProcessingStatus.

#### b. Luồng xử lý upload
1. **Tải file** → Kiểm tra định dạng, kích thước, quyền.
2. **Trích xuất văn bản** → Đọc PDF/DOCX, loại bỏ lỗi.
3. **Chunking** → Recursive/Sliding window/Semantic chunking.
4. **Sinh embedding** → Vector hóa mỗi chunk.
5. **Lưu vector database** → Kèm metadata.

#### c. Liên kết tài liệu – chủ đề
TopicId dùng lọc embedding trước semantic similarity, tăng độ chính xác, giảm thời gian truy vấn.

### 3.4.3. Tạo quiz

#### a. Cấu trúc câu hỏi
QuestionId, TopicId, SourceDocumentId, QuestionType, DifficultyLevel, QuestionContent, AnswerOptions, CorrectAnswer, Explanation, CreatedBy, CreatedAt.

Dạng bài: Trắc nghiệm một đáp án, Điền vào chỗ trống.

#### b. Quy trình tạo
1. Chọn chủ đề → 2. Chọn tài liệu nguồn → 3. Nhập câu hỏi → 4. Chọn dạng & độ khó → 5. Nhập đáp án + giải thích → 6. Lưu.

#### c. Liên kết câu hỏi – tài liệu nguồn
Khi giải thích: xác định SourceDocumentId → truy xuất chunks → đưa vào prompt → AI giải thích đúng ngữ cảnh.

---

## 3.5. Thiết kế các chức năng cốt lõi

### 3.5.1. Kiểm tra đầu vào & Xếp loại năng lực

#### a. Adaptive testing (3 bậc)
- Bắt đầu mức Trung bình.
- Đúng liên tiếp → tăng độ khó.
- Sai nhiều → giảm độ khó.
- Sau số lượng tối thiểu → xác định năng lực.

#### b. Thuật toán xếp loại
Tính: tỷ lệ đúng theo mức, thời gian phản hồi, mức ổn định → xác định Beginner/Intermediate/Advanced + điểm mạnh/yếu theo chủ đề.

#### c. Khởi tạo hồ sơ BKT
1. Tạo User Learning Profile.
2. Khởi tạo P(L) cho từng kỹ năng dựa trên kết quả.
3. Sinh lộ trình khởi tạo.
4. Thiết lập lịch ôn tập ban đầu.

### 3.5.2. Lộ trình học tập cá nhân hóa

#### a. AI Agent phân tích & đề xuất
Dùng: kết quả luyện tập, BKT, lịch sử, chủ đề yếu → xác định nội dung tiếp theo.

#### b. Điều chỉnh lộ trình động
Sau mỗi phiên: cập nhật P(L) → xác định nguy cơ quên → tăng ưu tiên chủ đề yếu → điều chỉnh lịch ôn.

#### c. Cân bằng ôn tập – học mới
Mỗi phiên: phần ôn tập + phần kiến thức mới, tỷ lệ thay đổi theo trạng thái.

### 3.5.3. Hệ thống luyện tập & Ôn tập

#### a. Lấy mẫu câu hỏi
1. Phân tích trạng thái BKT + lịch sử.
2. Xác định mục tiêu phiên (ôn/củng cố/mới/kiểm tra duy trì).
3. Lọc câu hỏi theo chủ đề, độ khó, trạng thái.
4. Weighted sampling: tăng xác suất nội dung yếu, giảm lặp nội dung đã thành thạo.

#### b. Spaced Repetition
- Nội dung dễ quên → ôn sớm; đã thành thạo → giãn khoảng cách.
- Cập nhật: ReviewInterval, EaseFactor, RetentionScore, NextReviewDate.

#### c. Cập nhật BKT sau mỗi lượt
1. Ghi nhận đúng/sai + thời gian + độ khó.
2. Tính xác suất hậu nghiệm (Bayes).
3. Đồng bộ Recommendation Engine.

### 3.5.4. Hỗ trợ AI (Hỏi đáp & Giải thích)

#### a. Luồng hội thoại
1. Người học nhập câu hỏi → Frontend → Backend → AI Agent.
2. AI Agent phân tích ý định → Retrieval Service truy xuất tài liệu.
3. LLM sinh phản hồi → trả về giao diện.
4. Hỗ trợ hội thoại nhiều lượt.

#### b. Explanation Adapter
1. Phân loại yêu cầu (ngữ pháp/từ vựng/đáp án/ví dụ).
2. Truy xuất context.
3. Tạo prompt theo trình độ.
4. Sinh phản hồi + hậu xử lý + gắn tài liệu tham khảo.

#### c. Tích hợp RAG
1. Truy xuất đoạn tài liệu liên quan.
2. Đưa vào prompt.
3. Yêu cầu AI trả lời dựa trên context.
→ Giảm hallucination, đồng bộ tài liệu GV, hiển thị nguồn tham khảo.

---

## 3.6. Thiết kế RAG Pipeline

### 3.6.1. Pipeline tiền xử lý & vector hóa

#### a. Trích xuất văn bản
- Hỗ trợ: PDF, DOCX, TXT.
- Kiểm tra → Trích xuất → Tiền xử lý (chuẩn hóa encoding, loại bỏ lỗi) → Plain text.

#### b. Chunking & Embedding
- Chiến lược: Recursive / Sliding Window / Semantic Chunking.
- Sinh vector embedding cho mỗi chunk.
- Lưu kèm metadata: TopicId, DocumentId, ChunkIndex.

#### c. Cập nhật khi bổ sung tài liệu
- Phát hiện tài liệu mới/thay đổi → tái xử lý chunks → sinh embedding mới → đồng bộ vector DB.
- Xóa embedding cũ khi tài liệu bị xóa/thay thế.

### 3.6.2. Truy xuất tri thức

#### a. Chiến lược truy vấn
- Sinh embedding câu hỏi → semantic search → metadata filtering (chủ đề, trình độ, loại tài liệu).

#### b. Xếp hạng & lọc
- Cosine similarity + mức ưu tiên chủ đề.
- Loại bỏ trùng lặp, quá ngắn, không phù hợp.
- Reranker model tùy chọn.

#### c. Tích hợp vào prompt
- Context + câu hỏi + trình độ + hướng dẫn phản hồi → gửi LLM.
- Beginner: giải thích ngắn gọn; Advanced: chi tiết + ví dụ.
