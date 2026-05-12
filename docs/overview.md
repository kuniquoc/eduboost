# EduBoost — Tổng quan hệ thống

## 1. Bài toán (Problem Statement)

Hệ thống giáo dục truyền thống:

- Dạy cùng 1 lộ trình cho tất cả học sinh
- Không xác định được học sinh yếu ở đâu, học nhanh/chậm thế nào
- Không cá nhân hóa nội dung và tốc độ học

**Mục tiêu**: Xây dựng AI Agent có khả năng dạy học như gia sư thật — hiểu học sinh, tự lập kế hoạch, dạy + kiểm tra + điều chỉnh liên tục.

> "Hệ thống là một AI Agent có khả năng mô phỏng gia sư cá nhân, sử dụng mô hình BKT để theo dõi kiến thức học sinh và LLM để tự động tạo nội dung, từ đó thích ứng lộ trình học theo từng cá nhân."

---

## 2. Kiến trúc tổng thể

```
Frontend (Web SPA / Mobile App)
        ↓ HTTP REST
Backend (.NET 9 Web API)
        ↓ HTTP
AI Agent Core (Python FastAPI Orchestrator)
 ├── LLM (Qwen2.5-7B + LoRA adapters)
 ├── Student Model
 │     ├── BKT (Bayesian Knowledge Tracing)
 │     └── IRT (Item Response Theory)
 ├── Planner (Agent Decision Engine)
 ├── Tool Layer
 │     ├── Question Generator (quiz LoRA adapter)
 │     ├── Grader (rule-based + LLM)
 │     ├── Content Retriever (RAG — FAISS + SentenceTransformer)
 │     └── Progress Tracker
 └── Memory
       ├── Vector DB — FAISS (learning history, context)
       └── Relational DB — PostgreSQL (user data, progress)
```

### Hạ tầng

| Service    | Công nghệ            | Port  | Mô tả                      |
| ---------- | --------------------- | ----- | --------------------------- |
| Database   | PostgreSQL 16 Alpine  | 5432  | Dữ liệu chính              |
| Storage    | MinIO (S3-compatible) | 9000  | Lưu trữ documents           |
| Backend    | .NET 9 Web API        | 5000  | REST API server             |
| AI Core    | Python FastAPI        | 8000  | Orchestrator + LLM + RAG    |
| Web        | React (Vite) SPA      | 5173  | Web frontend                |
| Mobile     | React Native (Expo)   | —     | Mobile app (iOS/Android)    |

---

## 3. AI Agent Loop (Core)

```
1. Nhận trạng thái học sinh (BKT state per skill)
2. Phân tích (LLM + BKT + IRT)
3. Quyết định hành động:
   ├── P(L) < 0.5  → EXPLAIN (dạy lại, lấy context từ RAG)
   ├── 0.5 ≤ P(L) < 0.8 → QUIZ (luyện tập, difficulty = θ)
   └── P(L) ≥ 0.8  → NEXT_SKILL (chuyển bài mới)
4. Sinh nội dung (bài giảng hoặc bài tập qua LLM)
5. Học sinh làm bài
6. Chấm điểm (rule-based cho MCQ, LLM cho tự luận)
7. Update BKT P(L) + IRT θ
8. Lặp lại từ bước 1
```

### 3.1 BKT (Bayesian Knowledge Tracing)

Theo dõi xác suất học sinh biết 1 skill: `P(L)`

| Tham số | Giá trị | Ý nghĩa                           |
| ------- | ------- | ---------------------------------- |
| p_l0    | 0.3     | Xác suất hiểu ban đầu             |
| p_t     | 0.1     | Tốc độ học (transition)            |
| p_s     | 0.1     | Xác suất sai dù hiểu (slip)       |
| p_g     | 0.25    | Xác suất đoán đúng (guess)        |

Phân loại: **Weak** (<0.5) → **Learning** (0.5–0.8) → **Mastered** (≥0.8)

### 3.2 IRT (Item Response Theory — 1PL)

Đo năng lực học sinh θ (theta) trên thang [-3.0, 3.0] và độ khó câu hỏi β (beta).

```
P(correct) = 1 / (1 + e^(-(θ - β)))
```

Câu hỏi tối ưu khi θ ≈ β (50% xác suất đúng). Theta được cập nhật bằng gradient descent (lr=0.2).

### 3.3 LLM

- Base model: **Qwen2.5-7B-Instruct** (4-bit quantization)
- 2 LoRA adapters:
  - **Explanation adapter**: Giải thích theo phương pháp Socratic
  - **Quiz adapter**: Sinh câu hỏi trắc nghiệm JSON (MCQ)
- RAG context injection từ tài liệu giáo viên upload

---

## 4. User Roles & Permissions

### Teacher

- Tạo/quản lý lớp học
- Tạo danh sách kiến thức (topics) cho lớp
- Upload tài liệu (documents) → liên kết với topics
- Tạo quiz từ document (AI sinh) → kiểm duyệt/chỉnh sửa → publish
- AI đánh giá độ khó topics (có thể chỉnh sửa thủ công)
- Toggle hiển thị document cho học sinh
- Quản lý học sinh: thêm/xóa, xem analytics (bài đã làm, điểm, weak skills)

### Student

- Tham gia lớp học bằng mã code
- Làm bài test đầu vào (entry test) → kết quả xác định mức hiểu biết từng topic
- AI đề xuất lộ trình học (roadmap) dựa trên kết quả entry test
- Luyện tập theo roadmap (practice quizzes theo topic)
- Xem document của topic (nếu giáo viên cho phép)
- Xem tiến độ học tập, thống kê cá nhân (streak, điểm TB, quiz đã làm)
- Upload document cá nhân → AI sinh quiz riêng → chỉnh sửa

---

## 5. Tech Stack

### Backend (.NET 9)

- ASP.NET Core Web API + Entity Framework Core
- PostgreSQL 16 + MinIO (presigned URL upload/download)
- JWT Bearer authentication (access 60min + refresh 30 days, token rotation)
- Feature-folder architecture + Repository pattern
- Swagger/OpenAPI documentation

### AI Agent Core (Python)

- FastAPI + Uvicorn
- Qwen2.5-7B + Unsloth (4-bit) + LoRA (PEFT)
- FAISS vector DB + SentenceTransformer (`all-MiniLM-L6-v2`)
- BKT + IRT models (custom implementation)

### Web Frontend (React)

- React 19 + Vite (SPA)
- React Router v7 (client-side routing)
- shadcn/ui + Tailwind CSS (dark theme)
- Zustand (auth state) + TanStack React Query v5 (server state)
- Axios (HTTP client với token refresh interceptor)

### Mobile (React Native)

- Expo SDK 54 + React Native 0.81
- expo-router (file-based routing)
- React Native Paper + custom dark theme
- Zustand + TanStack React Query + Axios

### DevOps

- Docker Compose (PostgreSQL + MinIO + Server)
- Multi-stage Dockerfile (.NET)
- Health checks on all services

---

## 6. MVP Scope

- 1 môn: Tiếng Anh
- Đa skill: Grammar topics
- Loại bài tập: MCQ, multi-select, fill-in-the-blank
- Full Teacher flow: tạo lớp → topics → upload doc → generate quiz → review → publish
- Full Student flow: join lớp → entry test → roadmap → practice → progress tracking
