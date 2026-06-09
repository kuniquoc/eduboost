# Luồng: Practice Session

> Trạng thái: ✅

## Trigger

Review page, dashboard ("Ôn ngay"), `/student/practice-session`, **Quiz Pool** (mode `fixed`)

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Web as practice-session-page
    participant API as server
    participant DB as PostgreSQL
    User->>Web: Bắt đầu (standard, review, hoặc fixed)
    Web->>API: POST start hoặc start-review
    API->>DB: practice_active_sessions
    loop Mỗi câu
        User->>Web: Trả lời
        Web->>API: POST answer + responseTimeSeconds
        API->>DB: BKT + SpacedRepetitionItem
        API-->>Web: spacedRepetition milestone
    end
    Web->>API: POST end
    API->>DB: learning_sessions + streak
    Web->>Web: invalidate review-schedule, learning-states, roadmap, student-stats, user-profile
```

## Modes

| Mode | API | Chọn câu | Feedback khi trả lời |
|------|-----|----------|----------------------|
| `standard` | POST `/start` | Random theo BKT difficulty | Inline: đúng/sai + giải thích + LLM |
| `review` | POST `/start-review` | Đúng questionIds due | Inline |
| `fixed` | POST `/start` mode=`fixed` | Đúng questionIds (Quiz Pool) | Inline |
| `practice` + `quizId` | POST `/start` | Câu quiz lớp đã publish | Inline (giống pool cá nhân) |
| `test` + `quizId` | POST `/start` | Câu quiz lớp đã publish | Ẩn — xem lại sau `end` qua `reviewItems` |

## Bảng bước

| Step | Layer | File | Ghi chú |
|------|-------|------|---------|
| 1 | web | `practiceSession.service.ts` | `start`, `startReview`, `startFixed`, `endSession` |
| 2 | server | `PracticeSessionsRepository` | DB-persisted sessions (TTL 2h) |
| 3 | server | `LearningStatesRepository` | Mỗi answer → BKT + SR (topic per question) |

## Trạng thái

- Sessions lưu `practice_active_sessions` (không còn purely in-memory)
- Review mode truyền đúng câu due từ schedule
- Fixed mode: `topicId` optional (revision set resolve từ `SourceTopicId`)
- Sau `endSession`: invalidate đủ cache cho Ôn tập, Tổng quan, Hồ sơ

## Liên kết

- [11-bkt-review-schedule.md](11-bkt-review-schedule.md)
- [05-quiz-pool-student.md](05-quiz-pool-student.md)
- [practicesessions.md](../../02-server/features/practicesessions.md)
