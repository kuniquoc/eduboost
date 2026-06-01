# Plan triển khai chi tiết - EduBoost

## Phân tích GAP: Hiện trạng vs Yêu cầu

### ✅ Đã có (không cần sửa)
| Yêu cầu | Hiện trạng |
|----------|-----------|
| Xác thực JWT đa vai trò (GV/HS) | Đã triển khai đầy đủ với token rotation |
| CRUD lớp học, enrollment | Đã triển khai |
| Upload tài liệu (MinIO) | Đã triển khai |
| Tạo quiz thủ công + AI sinh quiz | Đã triển khai |
| BKT + IRT algorithms | Đã triển khai trong AI Agent Core |
| Orchestrator (EXPLAIN/QUIZ/NEXT_SKILL) | Đã triển khai |
| RAG Pipeline (chunking, FAISS, retrieval) | Đã triển khai |
| LLM integration (giải thích, sinh câu hỏi) | Đã triển khai |
| Frontend React + TypeScript + Tailwind | Đã triển khai |
| Mobile Expo app | Đã triển khai |
| Analytics endpoints | Đã triển khai |

### ❌ Chưa có (cần bổ sung)
| Yêu cầu | Mức độ | Ảnh hưởng |
|----------|--------|-----------|
| Vai trò Admin (quản trị viên) | Trung bình | Server + Web |
| Bảng UserProfile (CurrentLevel, MasteryScore, LearningStreak) | Cao | Server DB |
| Bảng LearningSession (theo dõi phiên học) | Cao | Server DB + API |
| Bảng PlacementTestResult (kết quả kiểm tra đầu vào) | Trung bình | Server DB |
| Bảng PersonalizedLearningPath (lộ trình cá nhân hóa) | Cao | Server DB + API |
| Spaced Repetition (NextReviewDate, EaseFactor, ReviewInterval, RetentionScore) | Cao | Server + AI Agent |
| BKT state persistence vào PostgreSQL | Cao | Server DB + AI Agent API |
| Adaptive entry test (điều chỉnh độ khó theo response) | Cao | Server + AI Agent |
| Dạng bài "Điền vào chỗ trống" (fill-in-the-blank) | Trung bình | Server + Web + Mobile |
| SourceDocumentId trên Question | Thấp | Server Entity + Migration |
| WebSocket/Streaming cho AI chat | Trung bình | Server + Web |
| Redis caching | Thấp | Server Infrastructure |
| Lịch sử hội thoại AI (conversation history) | Trung bình | Server DB + AI Agent |

---

## PLAN CHI TIẾT

---

### Phase 1: Database Schema Changes (Server)

#### 1.1. Thêm Entity `UserProfile`
**File**: `server/Infrastructure/Entities/UserProfile.cs`

```csharp
public class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string CurrentLevel { get; set; } = "beginner"; // beginner|intermediate|advanced
    public double OverallMasteryScore { get; set; } = 0.0;
    public string? PreferredTopics { get; set; } // JSON array of topic IDs
    public int LearningStreak { get; set; } = 0;
    public DateTime? LastActiveDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
```

#### 1.2. Thêm Entity `LearningSession`
**File**: `server/Infrastructure/Entities/LearningSession.cs`

```csharp
public class LearningSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public int QuestionsAttempted { get; set; }
    public int CorrectAnswers { get; set; }
    public double Score { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
```

#### 1.3. Thêm Entity `PlacementTestResult`
**File**: `server/Infrastructure/Entities/PlacementTestResult.cs`

```csharp
public class PlacementTestResult
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string InitialLevel { get; set; } = "beginner";
    public double FinalScore { get; set; }
    public string? StrengthsJson { get; set; } // JSON: topic scores
    public string? WeaknessesJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
```

#### 1.4. Thêm Entity `PersonalizedLearningPath`
**File**: `server/Infrastructure/Entities/PersonalizedLearningPath.cs`

```csharp
public class PersonalizedLearningPath
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public string RecommendedDifficulty { get; set; } = "medium";
    public double PriorityScore { get; set; }
    public DateTime? NextReviewDate { get; set; }
    public bool IsCompleted { get; set; }
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
```

#### 1.5. Thêm Entity `BktState` (BKT persistence)
**File**: `server/Infrastructure/Entities/BktState.cs`

```csharp
public class BktState
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public double MasteryProbability { get; set; } = 0.3;
    public double GuessProbability { get; set; } = 0.25;
    public double SlipProbability { get; set; } = 0.1;
    public double TransitionProbability { get; set; } = 0.1;
    public double IrtTheta { get; set; } = 0.0;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
```

#### 1.6. Thêm Entity `SpacedRepetitionItem`
**File**: `server/Infrastructure/Entities/SpacedRepetitionItem.cs`

```csharp
public class SpacedRepetitionItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid TopicId { get; set; }
    public DateTime LastReviewDate { get; set; }
    public DateTime NextReviewDate { get; set; }
    public double ReviewInterval { get; set; } = 1.0; // days
    public double EaseFactor { get; set; } = 2.5;
    public double RetentionScore { get; set; } = 0.0;
    public int RepetitionCount { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
```

#### 1.7. Thêm Entity `ConversationMessage` (lịch sử AI chat)
**File**: `server/Infrastructure/Entities/ConversationMessage.cs`

```csharp
public class ConversationMessage
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? TopicId { get; set; }
    public string Role { get; set; } = "user"; // "user" | "assistant"
    public string Content { get; set; } = "";
    public string? SourceReferencesJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Topic? Topic { get; set; }
}
```

#### 1.8. Sửa Entity `Question` - thêm SourceDocumentId & QuestionType mở rộng
**File**: `server/Infrastructure/Entities/Question.cs`

Thêm:
```csharp
public Guid? SourceDocumentId { get; set; }
public string QuestionType { get; set; } = "multiple_choice"; // "multiple_choice" | "fill_in_blank"
public string? Explanation { get; set; }
// Navigation
public Document? SourceDocument { get; set; }
```

#### 1.9. Sửa Entity `User` - thêm role "admin"
**File**: `server/Infrastructure/Entities/User.cs`

Thay comment: `// "teacher" | "student" | "admin"`

#### 1.10. Cập nhật `AppDbContext.cs`
- Đăng ký tất cả DbSet mới.
- Cấu hình relationships, indexes, table names.
- Tạo migration mới.

---

### Phase 2: Backend API Endpoints

#### 2.1. Feature `UserProfiles`
**File**: `server/Features/UserProfiles/`
- `GET /api/user-profiles/me` — Lấy profile người dùng hiện tại.
- `PUT /api/user-profiles/me` — Cập nhật profile (preferences).
- `GET /api/user-profiles/{userId}` — Admin/GV xem profile học sinh.

#### 2.2. Feature `LearningStates` (BKT + Spaced Repetition)
**File**: `server/Features/LearningStates/`
- `GET /api/learning-states/me` — Lấy toàn bộ BKT state của học sinh.
- `GET /api/learning-states/me/topic/{topicId}` — Lấy BKT state theo topic.
- `POST /api/learning-states/update` — Cập nhật BKT sau câu trả lời (gọi AI Agent rồi persist).
- `GET /api/learning-states/me/review-schedule` — Lấy danh sách nội dung cần ôn tập hôm nay.

#### 2.3. Feature `PlacementTests` (Entry test thích ứng)
**File**: `server/Features/PlacementTests/`
- `POST /api/placement-tests/start` — Bắt đầu bài kiểm tra (trả về câu hỏi đầu tiên ở mức medium).
- `POST /api/placement-tests/answer` — Gửi câu trả lời, nhận câu tiếp theo (adaptive: điều chỉnh độ khó).
- `POST /api/placement-tests/complete` — Kết thúc → tính toán level → khởi tạo BKT + learning path.
- `GET /api/placement-tests/result` — Xem kết quả kiểm tra đầu vào.

#### 2.4. Feature `LearningPaths`
**File**: `server/Features/LearningPaths/`
- `GET /api/learning-paths/me` — Lấy lộ trình hiện tại.
- `POST /api/learning-paths/regenerate` — Tái sinh lộ trình (sau phiên học).
- `PUT /api/learning-paths/{id}/complete` — Đánh dấu hoàn thành topic.

#### 2.5. Feature `PracticeSessions`
**File**: `server/Features/PracticeSessions/`
- `POST /api/practice-sessions/start` — Bắt đầu phiên luyện tập (trả về câu hỏi phù hợp: weighted sampling).
- `POST /api/practice-sessions/answer` — Gửi câu trả lời → cập nhật BKT + SR → trả phản hồi + câu tiếp.
- `POST /api/practice-sessions/end` — Kết thúc phiên → cập nhật LearningSession + tiến trình.

#### 2.6. Feature `AiChat`
**File**: `server/Features/AiChat/`
- `POST /api/ai-chat/ask` — Gửi câu hỏi → AI trả lời (có RAG context + source references).
- `GET /api/ai-chat/history` — Lấy lịch sử hội thoại theo topic.

#### 2.7. Feature `Admin` (mới)
**File**: `server/Features/Admin/`
- `GET /api/admin/users` — Danh sách tài khoản.
- `PUT /api/admin/users/{id}/role` — Thay đổi role.
- `DELETE /api/admin/users/{id}` — Vô hiệu hóa tài khoản.
- `GET /api/admin/stats` — Thống kê hệ thống (số user, số phiên, tải AI...).

---

### Phase 3: AI Agent Core Changes

#### 3.1. Thêm Spaced Repetition module
**File**: `ai-agent-core/src/core/spaced_repetition.py`

Triển khai thuật toán SM-2:
- `update_after_review(quality, ease_factor, interval, repetitions)` → trả về (new_interval, new_ease_factor, next_review_date).
- Tích hợp vào orchestrator.

#### 3.2. Cập nhật Orchestrator
**File**: `ai-agent-core/src/core/orchestrator.py`

- Thêm logic xử lý Spaced Repetition scheduling vào `decide_next_action()`.
- Thêm endpoint để trả về review schedule.
- Cân bằng ôn tập vs học mới (70/30 hoặc theo trạng thái).

#### 3.3. Thêm Adaptive Entry Test logic
**File**: `ai-agent-core/src/core/entry_test.py`

- Thuật toán chọn câu hỏi adaptive (bắt đầu medium, tăng/giảm theo kết quả).
- Tính toán final level + khởi tạo BKT parameters theo kết quả.
- Xác định strengths/weaknesses per topic.

#### 3.4. API endpoints mới
**File**: `ai-agent-core/src/api/main.py`

- `POST /entry-test/next-question` — Chọn câu hỏi tiếp theo (adaptive).
- `POST /entry-test/evaluate` — Tính toán kết quả cuối cùng.
- `GET /spaced-repetition/schedule/{student_id}` — Lấy lịch ôn tập.
- `POST /spaced-repetition/update` — Cập nhật sau khi ôn.

#### 3.5. Persist state (thêm integration layer)
AI Agent Core hiện giữ state in-memory. Cần:
- Thêm endpoints để Backend đọc/ghi BKT state.
- Hoặc: Backend giữ state trong DB, gửi state xuống AI Agent mỗi request (stateless agent).

**Khuyến nghị**: Chọn **stateless agent** — Backend lưu BKT state trong PostgreSQL, mỗi request gửi kèm state parameters. AI Agent tính toán và trả về state mới, Backend persist.

---

### Phase 4: Frontend Changes (Web)

#### 4.1. Thêm trang Entry Test cải tiến (Adaptive)
**File**: `web/src/features/student/entry-test/`
- Hiển thị câu hỏi từng câu một.
- Gửi từng câu trả lời → nhận câu tiếp (adaptive difficulty).
- Hiển thị kết quả cuối: level + strengths/weaknesses chart.
- Khởi tạo learning path sau khi hoàn thành.

#### 4.2. Cải tiến Roadmap / Learning Path
**File**: `web/src/features/student/roadmap/`
- Hiển thị lộ trình theo topics với trạng thái (weak/learning/mastered).
- Hiển thị NextReviewDate cho từng topic.
- Nút "Start Practice" cho topic tiếp theo được đề xuất.
- Progress visualization (chart/progress bar per topic).

#### 4.3. Thêm Practice Session (luyện tập thích ứng)
**File**: `web/src/features/student/practice/`
- Phiên luyện tập với câu hỏi phù hợp trình độ.
- Hỗ trợ cả multiple choice và fill-in-the-blank.
- Phản hồi tức thì sau mỗi câu (đúng/sai + giải thích).
- Summary sau phiên (điểm, tiến bộ, nội dung cần ôn).

#### 4.4. Thêm/Cải tiến AI Chat
**File**: `web/src/features/student/ai-chat/`
- Giao diện chat realtime (streaming response).
- Hiển thị source references (tài liệu tham khảo).
- Context-aware: gắn với topic hiện tại.
- Lịch sử hội thoại.

#### 4.5. Thêm Review/Ôn tập
**File**: `web/src/features/student/review/`
- Hiển thị danh sách nội dung cần ôn hôm nay.
- Bắt đầu phiên ôn tập.
- Cập nhật Spaced Repetition sau mỗi câu.

#### 4.6. Dashboard cải tiến
**File**: `web/src/features/student/dashboard/`
- Hiển thị learning streak.
- Số nội dung cần ôn hôm nay.
- Progress overview (mastery per topic).
- Quick action: "Tiếp tục học" / "Ôn tập ngay".

#### 4.7. Admin pages (mới)
**File**: `web/src/features/admin/`
- Quản lý users (danh sách, tìm kiếm, đổi role, vô hiệu hóa).
- System stats dashboard.

#### 4.8. Service layer updates
**File**: `web/src/services/`
- `learningState.service.ts` — BKT state, review schedule. ✅
- `placementTest.service.ts` — Adaptive entry test. ✅
- `learningPath.service.ts` — Learning path CRUD. ✅
- `practiceSession.service.ts` — Practice session flow. ✅
- `aiChat.service.ts` — AI Q&A with streaming. ✅
- `admin.service.ts` — Admin endpoints. ✅
- `userProfile.service.ts` — User profile management. ✅

---

### Phase 5: Mobile Changes

#### 5.1. Tương tự Web Phase 4 (áp dụng cho mobile)
- Entry test adaptive flow.
- Practice session (multiple choice + fill-in-blank).

---

## Tiến độ triển khai

| Phase | Mục | Trạng thái |
|-------|-----|-----------|
| 1 | Database Schema (7 entities mới) | ✅ |
| 2 | Backend APIs (7 feature modules) | ✅ |
| 3 | AI Agent Core (SM-2, Entry Test, Chat) | ✅ |
| 4.1 | Adaptive Placement Test page | ✅ |
| 4.2 | Roadmap / Learning Path cải tiến | ⬜ (chưa cần đổi) |
| 4.3 | Practice Session page (BKT + SR) | ✅ |
| 4.4 | AI Chat page | ✅ |
| 4.5 | Review / Ôn tập page | ✅ |
| 4.6 | Dashboard cải tiến (review reminder) | ✅ |
| 4.7 | Admin pages | ✅ |
| 4.8 | Service layer + Types | ✅ |
| 5 | Mobile Changes | ⬜ |
| 6 | Infrastructure (Redis, WebSocket) | ⬜ |
- AI chat (không cần streaming trên mobile, dùng loading state).
- Review/Ôn tập schedule.
- Dashboard cải tiến.

---

### Phase 6: Infrastructure

#### 6.1. Redis Setup
**File**: `docker-compose.yml`
- Thêm Redis service.
- Cấu hình trong `appsettings.json`.

**File**: `server/Program.cs`
- Đăng ký Redis distributed cache.

**Sử dụng cho**:
- Cache danh sách câu hỏi theo topic.
- Cache BKT state (hot path).
- Rate limiting AI requests.

#### 6.2. WebSocket/SSE cho AI Chat streaming
**File**: `server/Program.cs` + `server/Features/AiChat/`
- Dùng Server-Sent Events (SSE) cho AI response streaming.
- Frontend: EventSource API.

---

## Thứ tự triển khai đề xuất

| Bước | Nội dung | Ưu tiên | Phụ thuộc | Trạng thái |
|------|----------|---------|-----------|------------|
| 1 | Database entities + migration | P0 | — | ✅ Hoàn thành |
| 2 | BKT state persistence (stateless agent) | P0 | Bước 1 | ✅ Hoàn thành |
| 3 | Spaced Repetition module (AI Agent) | P0 | — | ✅ Hoàn thành |
| 4 | Adaptive Entry Test (AI Agent + Backend API) | P0 | Bước 1, 2 | ✅ Hoàn thành |
| 5 | Practice Session API (Backend) | P0 | Bước 1, 2, 3 | ✅ Hoàn thành |
| 6 | Learning Path API (Backend) | P1 | Bước 1, 4 | ✅ Hoàn thành |
| 7 | AI Chat API + conversation history | P1 | Bước 1 | ✅ Hoàn thành |
| 8 | Frontend Entry Test revamp | P0 | Bước 4 | ⬜ Chưa triển khai |
| 9 | Frontend Practice Session | P0 | Bước 5 | ⬜ Chưa triển khai |
| 10 | Frontend AI Chat + streaming | P1 | Bước 7 | ⬜ Chưa triển khai |
| 11 | Frontend Review/Ôn tập | P1 | Bước 5 | ⬜ Chưa triển khai |
| 12 | Admin role + pages | P2 | Bước 1 | ✅ Hoàn thành (Backend) |
| 13 | Redis caching | P2 | — | ⬜ Chưa triển khai |
| 14 | Fill-in-blank question type | P2 | Bước 1 | ✅ Hoàn thành (đã hỗ trợ) |
| 15 | Mobile updates | P2 | Bước 8-11 | ⬜ Chưa triển khai |
| 16 | UserProfile API + Dashboard | P1 | Bước 1 | ✅ Hoàn thành (Backend) |

---

## Ước lượng thay đổi code

| Thành phần | Files mới | Files sửa | Ghi chú |
|-----------|-----------|-----------|---------|
| Server Entities | 7 | 2 | User.cs, Question.cs cần sửa |
| Server AppDbContext | 0 | 1 | Thêm DbSets + config |
| Server Features (new) | ~20 | ~5 | 6 feature folders mới |
| AI Agent Core | 3 | 2 | spaced_rep.py, entry_test.py, orchestrator.py |
| Web Services | 6 | 0 | Service files mới |
| Web Features | ~15 | ~5 | Pages/components mới |
| Mobile | ~10 | ~3 | Mirror web features |
| Infrastructure | 1 | 2 | docker-compose, appsettings, Program.cs |
| **Tổng** | **~62** | **~20** | |

---

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|-----------|
| BKT state migration (in-memory → DB) | Thiết kế stateless agent, Backend quản lý state |
| Spaced Repetition phức tạp | Dùng SM-2 algorithm chuẩn, đã được kiểm chứng |
| Adaptive entry test accuracy | Bắt đầu medium, tối thiểu 10 câu, dùng IRT difficulty |
| WebSocket complexity | Dùng SSE (đơn giản hơn) cho AI streaming |
| Migration dữ liệu hiện tại | Migration chỉ thêm bảng mới, không thay đổi bảng cũ (trừ Question) |
