# Thuật ngữ (Glossary)

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **BKT** | Bayesian Knowledge Tracing — mô hình ước lượng mastery (P(L)) theo từng topic |
| **IRT** | Item Response Theory (1PL) — theta học sinh, beta độ khó câu hỏi |
| **RAG** | Retrieval-Augmented Generation — truy xuất chunk tài liệu trước khi gọi LLM |
| **FAISS** | Vector index lưu embedding chunks tài liệu |
| **Orchestrator** | `AgentOrchestrator` quyết định EXPLAIN / QUIZ / NEXT_SKILL |
| **Entry test** | Bài kiểm tra đầu vào theo lớp (type `entry_test`) |
| **Placement test** | Kiểm tra đầu vào adaptive toàn hệ thống (in-memory session) |
| **Roadmap** | Lộ trình học per-class (`PersonalizedLearningPath` filtered by class topics) |
| **Learning path** | Lộ trình global cross-class (`/api/learning-paths`) — 🔧 chưa có UI web |
| **Quiz Pool** | Ngân hàng câu hỏi AI (type `pool`), appendable, chưa publish |
| **Practice quiz** | Bài luyện tập đã publish (type `practice`) |
| **Private quiz** | Bộ ôn tập cá nhân học sinh (type `private`) |
| **AI Studio** | Trang giáo viên review/sửa quiz trước publish (`/teacher/ai-studio/:quizId`) |
| **AI Lab** | Không gian học sinh upload tài liệu riêng + sinh quiz |
| **Spaced Repetition** | SM-2 — lịch ôn theo `NextReviewDate`, `EaseFactor` |
| **Token rotation** | Refresh token mới mỗi lần refresh, token cũ revoke |
| **Presigned URL** | MinIO URL tạm để client upload/download trực tiếp |
| **Vertical slice** | Mỗi feature = Controller + Repository + Models trong một folder |

## Quiz types

| Type | Owner | Publish | Mục đích |
|------|-------|---------|----------|
| `entry_test` | Class | Có | Kiểm tra đầu vào lớp |
| `practice` | Class | Có | Bài luyện / test từ pool |
| `pool` | Class/Student topic | Không | Ngân hàng câu AI |
| `private` | Student | Không | Revision set cá nhân |

## Agent actions (tutor)

| Action | Ý nghĩa |
|--------|---------|
| `EXPLAIN` | Giải thích chủ đề (Socratic) |
| `QUIZ` | Ra câu hỏi trắc nghiệm |
| `NEXT_SKILL` | Chuyển skill/topic tiếp theo |
