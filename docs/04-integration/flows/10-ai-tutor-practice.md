# Luồng: AI Tutor Practice

> Trạng thái: ✅

## Trigger

Practice page (`/student/practice/:topicId`), roadmap, learning path

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Web as practice-page
    participant API as server
    participant DB as PostgreSQL
    participant Agent as ai-agent-core
    User->>Web: Bắt đầu quiz
    Web->>API: GET tutor/next-action
    API->>DB: bkt_states
    API-->>Web: EXPLAIN / QUIZ / NEXT_SKILL
    Web->>API: GET tutor/generate-question
    API->>DB: mastery → difficulty
    API->>Agent: Generate question LLM
    Agent-->>API: Question JSON
    API->>DB: Persist tutor question
    User->>Web: Submit answer
    Web->>API: POST tutor/submit-answer
    API->>DB: BKT + SR update
    Web->>Web: invalidate learning queries
    User->>Web: Rời trang / NEXT_SKILL
    Web->>API: POST tutor/complete-practice
    API->>DB: learning_sessions + streak
    Web->>Web: invalidate learning queries
```

## BKT routing (server)

[`TutorDecisionService.cs`](../../../server/Infrastructure/Services/TutorDecisionService.cs) — ngưỡng giống agent orchestrator:

| Mastery P(L) | Action |
|--------------|--------|
| &lt; 0.5 | EXPLAIN |
| 0.5 – 0.8 | QUIZ |
| ≥ 0.8 | NEXT_SKILL |

Độ khó sinh câu hỏi: `MapMasteryToDifficulty` từ BKT (hoặc `IrtTheta` nếu có).

## Trạng thái

- PostgreSQL là nguồn sự thật duy nhất cho BKT/SR và tutor routing
- Sau mỗi câu trả lời: web invalidate `review-schedule`, `learning-states`, `student-stats`, `user-profile`, `roadmap`
- Khi kết thúc phiên: `POST /quizzes/tutor/complete-practice` ghi `learning_sessions` + streak (giống practice-session end)
- Agent **không** còn fire-and-forget `update-state` từ submit
- Agent endpoints `/tutor/next-action`, `/tutor/update-state` vẫn tồn tại nhưng .NET **không gọi** cho luồng sản phẩm

## Liên kết

- [learningstates.md](../../02-server/features/learningstates.md)
