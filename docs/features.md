> **DEPRECATED** — Thay bằng [01-web/features/](01-web/features/README.md). Một số mô tả (demo login, analytics) không khớp code.

# EduBoost — Feature Specifications

## Roles Overview

| Feature                | Teacher | Student |
| ---------------------- | :-----: | :-----: |
| Quản lý lớp học (CRUD) | ✅      |         |
| Tham gia lớp           |         | ✅      |
| Quản lý topics         | ✅      |         |
| AI đánh giá độ khó     | ✅      |         |
| Upload documents       | ✅      | ✅ (cá nhân) |
| Sinh quiz từ document  | ✅      | ✅ (cá nhân) |
| Kiểm duyệt quiz       | ✅      | ✅ (cá nhân) |
| Publish quiz           | ✅      |         |
| Làm entry test         |         | ✅      |
| Xem roadmap AI         |         | ✅      |
| Luyện tập (practice)   |         | ✅      |
| Xem analytics lớp      | ✅      |         |
| Xem analytics cá nhân  | ✅      | ✅      |
| Quản lý học sinh       | ✅      |         |

---

## 1. Authentication

### 1.1 Login

**Mô tả**: Đăng nhập bằng email + password, redirect theo role.

**User Flow**:
1. Nhập email, password
2. Nhấn "Đăng nhập"
3. Hệ thống xác thực → trả về tokens
4. Redirect: teacher → `/teacher/classes`, student → `/student/dashboard`

**Business Rules**:
- Email phải có format hợp lệ
- Hiển thị error nếu sai credentials
- Lưu accessToken + refreshToken vào localStorage

> **Lưu ý:** Không có demo login buttons trên UI — dùng tài khoản seed (`AdminBootstrap`) hoặc đăng ký student.

### 1.2 Register

**Mô tả**: Tạo tài khoản học sinh mới (self-register chỉ role `student`).

**User Flow**:
1. Nhập name, email, password
2. Nhấn "Đăng ký"
3. Hệ thống tạo tài khoản student → auto login → redirect `/student/dashboard`

**Validation**:
- Name: required
- Email: required, email format, unique
- Password: required, min 6 ký tự

> Teacher/admin được tạo qua `AdminBootstrap` hoặc admin dashboard — không self-register.

### 1.3 Token Management

**Auto-refresh**: Khi request trả về 401 → tự động gọi `/api/auth/refresh` → retry request.

**Logout**: Gọi `/api/auth/revoke` → xóa tokens → redirect `/login`.

---

## 2. Teacher Features

### 2.1 Classes Management

**Màn hình**: Danh sách lớp học dạng cards grid.

**Tính năng**:
- **Xem danh sách**: Cards hiển thị tên, mô tả, số học sinh, số topics, tiến độ trung bình
- **Tạo lớp**: Dialog/modal với name (min 3 chars), description, coverColor (color picker)
- **Xem chi tiết**: Navigate tới class detail page
- **Sửa lớp**: Inline edit hoặc dialog
- **Xóa lớp**: Confirm dialog → xóa cascade (topics, enrollments, docs, quizzes)
- **Copy class code**: Button copy mã lớp vào clipboard (để chia sẻ cho học sinh)

**Class Detail Page**: Tabs layout:
- Tab "Topics" → danh sách topics
- Tab "Documents" → danh sách tài liệu
- Tab "Students" → danh sách học sinh

---

### 2.2 Topics Management

**Ngữ cảnh**: Trong class detail page, tab "Topics".

**Tính năng**:
- **Xem danh sách**: Table/list với name, description, difficulty badge, AI evaluated status, question count, visibility toggle
- **Tạo topic**: Inline form hoặc dialog. Name (min 2 chars), description
- **Sửa topic**: Inline edit name, description
- **Xóa topic**: Confirm dialog
- **AI Evaluate Difficulty**: Button "AI đánh giá" → gọi API → tất cả topics được AI gán difficulty (easy/medium/hard) → hiển thị kết quả
- **Manual Set Difficulty**: Dropdown chọn difficulty cho từng topic (ghi đè AI)
- **Toggle Visibility**: Switch on/off hiển thị document cho học sinh

**AI Evaluate Flow**:
1. Teacher nhấn "AI đánh giá độ khó"
2. Loading spinner
3. API trả về → cập nhật difficulty badges
4. Teacher có thể chỉnh sửa thủ công nếu cần

---

### 2.3 Documents Management

**Ngữ cảnh**: Trong class detail page, tab "Documents" HOẶC trang riêng "Tài liệu".

**Tính năng**:
- **Xem danh sách**: Table với fileName, size, status badge, topic liên kết, uploadedAt
- **Upload document**:
  1. Chọn file (drag & drop hoặc file picker)
  2. Chọn topic liên kết (optional)
  3. Client gọi `request-upload` → nhận presigned URL
  4. Client upload file trực tiếp lên MinIO bằng PUT request
  5. Client gọi `confirm` → status "ready"
  6. Hiển thị progress bar trong quá trình upload
- **Download**: Nhấn download → lấy presigned URL → mở trong tab mới
- **Xóa**: Confirm dialog → xóa file khỏi MinIO + DB record
- **Generate Quiz**: Button "Tạo Quiz từ AI" trên mỗi document
  1. Chọn topic liên kết (optional)
  2. Gọi API generate-quiz
  3. Hiển thị status (processing → done)
  4. Navigate tới trang review quiz

**Upload Flow** (Presigned URL):
```
Client                    Server                    MinIO
  │─── request-upload ──────▶│                          │
  │◀── { uploadUrl, docId } ─│                          │
  │─── PUT file ─────────────┼─────────────────────────▶│
  │◀── 200 OK ───────────────┼─────────────────────────│
  │─── confirm(docId) ──────▶│                          │
  │◀── { status: "ready" } ──│                          │
```

---

### 2.4 Quiz Management (AI Studio)

**Mô tả**: Review, chỉnh sửa, kiểm duyệt và publish quiz do AI sinh ra.

**Tính năng**:
- **Xem danh sách câu hỏi**: Cards hoặc list, mỗi câu hiển thị:
  - Text câu hỏi
  - Type badge (MCQ / Multi-select / Fill-blank)
  - Options (với đánh dấu correct)
  - Difficulty
  - Explanation
  - Verified badge
- **Chỉnh sửa câu hỏi**: Inline edit hoặc dialog:
  - Sửa text
  - Sửa/thêm/xóa options
  - Đánh dấu đáp án đúng
  - Sửa explanation
  - Sửa correctAnswer (fill_blank)
- **Xóa câu hỏi**: Confirm → xóa
- **Verify**: Toggle button đánh dấu "đã kiểm duyệt"
- **Publish**: Button publish quiz → quiz available cho entry test / practice
  - Chỉ publish khi có ít nhất 1 câu hỏi

**Business Rules**:
- AI sinh quiz → mặc định `verifiedByTeacher = false`
- Teacher review từng câu → mark verified
- Publish quiz không bắt buộc tất cả câu đã verified (nhưng nên khuyến khích)

---

### 2.5 Student Management

**Ngữ cảnh**: Trong class detail page, tab "Students" HOẶC trang "Học sinh".

**Tính năng**:
- **Danh sách học sinh**: Table với name, email, avatar, joinedAt, entry test status, completion percent
- **Tìm kiếm**: Search bar filter theo name/email
- **Thêm học sinh**: Dialog nhập email → gọi API enroll
- **Xóa học sinh**: Confirm dialog → remove enrollment
- **Xem analytics cá nhân**: Click vào student → xem chi tiết:
  - Completion percent
  - Quizzes taken, average score
  - Weak skills (topics cần cải thiện)
  - Last active
  - Entry test completed status

### 2.6 Class Analytics (Dashboard)

**Mô tả**: Tổng quan analytics cho lớp học.

**Hiển thị**:
- Total students
- Average completion
- Average score
- Students cần chú ý (needAttentionCount)
- Biểu đồ/chart: distribution of completion, top weak skills across class

---

## 3. Student Features

### 3.1 Dashboard (Overview)

**Mô tả**: Trang chủ student — tổng quan tiến độ.

**Hiển thị**:
- **Stats cards**: Day streak, avg quiz score, total quizzes taken, weekly progress
- **Enrolled classes**: Cards với tên lớp, progress bar, entry test status
- **Active roadmap**: Nếu có roadmap → hiển thị steps với status (completed/in_progress/recommended/locked)

---

### 3.2 Classes

**Mô tả**: Danh sách lớp đã tham gia + tham gia lớp mới.

**Tính năng**:
- **Danh sách enrolled classes**: Cards với name, coverColor, progress, joinedAt
- **Join class**: Dialog/modal nhập class code → gọi API → thêm vào danh sách
- **Navigate**: Click card → class detail hoặc entry test (nếu chưa làm)

---

### 3.3 Entry Test

**Mô tả**: Bài test đầu vào khi tham gia lớp mới. Full-page quiz experience.

**User Flow**:
1. Student tham gia lớp → chưa làm entry test
2. Navigate tới entry test page
3. Hiển thị câu hỏi lần lượt (hoặc all-at-once)
4. Support 3 loại:
   - **MCQ**: Radio buttons, chọn 1 đáp án
   - **Multi-select**: Checkboxes, chọn nhiều đáp án
   - **Fill-blank**: Text input
5. Timer per question (hiển thị thời gian)
6. Submit → hiển thị kết quả

**Kết quả entry test**:
- Overall score, percentage, grade (A-F)
- Topic breakdown: score per topic
- Button "Tạo lộ trình học" → gọi API generate roadmap

**Business Rules**:
- Entry test chỉ làm 1 lần per class
- Câu hỏi lấy từ các quiz published của class (type entry_test)
- Sau submit → enrollment.entryTestCompleted = true

---

### 3.4 Roadmap

**Mô tả**: Lộ trình học tập cá nhân hóa do AI sinh ra.

**Hiển thị**: Visual learning path (stepper/timeline):
- Mỗi step = 1 topic
- Status badges: ✅ Completed, 🔵 In Progress, ⭐ Recommended, 🔒 Locked
- Progress bar per step
- Reason (AI giải thích tại sao đề xuất thứ tự này)

**User Flow**:
1. Sau entry test → nhấn "Tạo lộ trình"
2. AI phân tích kết quả → sinh roadmap
3. Hiển thị roadmap với steps
4. Student bắt đầu từ step "recommended"
5. Click step → navigate tới practice quiz

**Business Rules**:
- Roadmap sinh 1 lần per class (có thể regenerate)
- Steps unlock tuần tự hoặc theo AI recommendation
- Progress tự cập nhật khi hoàn thành practice

---

### 3.5 Practice

**Mô tả**: Luyện tập theo topic.

**User Flow**:
1. Chọn topic (từ roadmap hoặc classes)
2. Lấy practice questions (default 10 câu)
3. Làm bài (giống entry test UI)
4. Submit → xem kết quả
5. Kết quả cập nhật BKT/IRT state

**Hiển thị kết quả**:
- Score, percentage, grade
- Correct/wrong per question
- Explanation cho mỗi câu

---

### 3.6 AI Lab (Personal Learning)

**Mô tả**: Student tự upload tài liệu và sinh quiz cho riêng mình.

**Tính năng**:
- **Upload documents**: Giống teacher upload flow (presigned URL)
- **Danh sách documents**: Table với name, size, status, quiz generated status
- **Generate quiz**: Button tạo quiz từ document → AI sinh câu hỏi
- **Review quiz**: Xem/chỉnh sửa quiz cá nhân (giống teacher review nhưng cho student)
- **Download/Delete** documents

**Business Rules**:
- Documents scope = "student" (private, không liên kết class)
- Quiz type = "private"
- Student có thể sửa câu hỏi cá nhân (PUT `/api/quizzes/my/...`)

---

### 3.7 Profile

**Mô tả**: Thông tin cá nhân.

**Hiển thị**:
- Name, email, role
- Avatar (initials)
- Logout button

---

## 4. AI Integration Points

### 4.1 Quiz Generation

**Trigger**: Teacher/Student nhấn "Generate Quiz" trên document.

**Flow**:
1. `POST .../generate-quiz` → trả về `GenerateQuizJobDto` với status "processing"
2. Backend gửi document tới AI Agent Core
3. AI đọc document → sinh câu hỏi (MCQ, multi-select, fill-blank)
4. Lưu questions vào DB, link quiz ↔ document
5. Client poll hoặc nhận thông báo khi done

### 4.2 AI Topic Difficulty Evaluation

**Trigger**: Teacher nhấn "AI Evaluate" trên class.

**Flow**:
1. `POST .../topics/ai-evaluate`
2. AI phân tích tên + mô tả topics → gán difficulty (easy/medium/hard)
3. Topics updated với `aiEvaluated = true`

### 4.3 Roadmap Generation

**Trigger**: Student nhấn "Generate Roadmap" sau entry test.

**Flow**:
1. `POST /api/roadmap/{classId}/generate` với `entryTestResultId`
2. AI phân tích entry test results (topic scores) + topic difficulty
3. Sinh roadmap: sắp xếp topics từ yếu → mạnh, gán status (recommended/locked)
4. Trả về `RoadmapDto` với steps

### 4.4 Adaptive Learning Loop (Core Agent)

**Trigger**: Student hoàn thành practice quiz.

**Flow** (xử lý trong AI Agent Core):
1. Nhận kết quả quiz → update BKT P(L) per skill
2. Update IRT θ (student ability)
3. Orchestrator quyết định:
   - P(L) < 0.5 → EXPLAIN (cần học lại)
   - 0.5 ≤ P(L) < 0.8 → QUIZ (tiếp tục luyện)
   - P(L) ≥ 0.8 → NEXT_SKILL (chuyển bài mới)
4. Update roadmap step progress/status accordingly

---

## 5. Landing Page

**Mô tả**: Trang giới thiệu cho visitor chưa đăng nhập.

**Sections**:
1. **Hero**: Tagline "AI Gia sư cá nhân cho mọi học sinh" + CTA buttons (Đăng ký / Đăng nhập)
2. **Features**: 3-4 feature cards:
   - 🤖 AI Agent thông minh — tự ra quyết định dạy/kiểm tra/điều chỉnh
   - 📊 Theo dõi kiến thức — BKT/IRT đánh giá chính xác từng skill
   - 🎯 Cá nhân hóa — lộ trình học riêng cho từng học sinh
   - 📝 Sinh quiz tự động — AI tạo bài tập từ tài liệu
3. **How it works**: 4-step flow:
   - Tham gia lớp → Làm bài test → AI tạo lộ trình → Luyện tập thích ứng
4. **Footer**: Copyright, links

---

## 6. Common UI Patterns

### Notifications/Toast
- Success: green toast (tạo thành công, upload xong, ...)
- Error: red toast (lỗi mạng, validation, ...)
- Info: blue toast (thông báo chung)

### Loading States
- Skeleton loading cho danh sách
- Spinner cho actions (create, update, delete)
- Progress bar cho file upload

### Empty States
- "Chưa có lớp học nào" + CTA tạo lớp (teacher)
- "Chưa tham gia lớp nào" + CTA nhập mã (student)
- "Chưa có tài liệu" + CTA upload

### Responsive Design
- Desktop: Sidebar navigation (collapsible) + main content
- Tablet: Sidebar collapsed by default
- Mobile web: Bottom navigation hoặc hamburger menu
