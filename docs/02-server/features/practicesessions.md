# Feature: PracticeSessions

> Thư mục: [`server/Features/PracticeSessions/`](../../../server/Features/PracticeSessions/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/practice-sessions/start` | `StartSession` — mode `standard` (default) |
| POST | `api/practice-sessions/start-review` | `StartReviewSession` — due SR items |
| POST | `api/practice-sessions/answer` | `SubmitAnswer` — BKT + SR, trả `spacedRepetition` |
| POST | `api/practice-sessions/end` | `EndSession` — `LearningSession`, streak |

## Request / Response

**Start (standard):** `{ topicId, questionCount?, mode?: "standard" }`

**Start review:** `{ questionIds?: Guid[] }` — nếu null, lấy tất cả due

**Answer:** `{ sessionId, questionId, selectedOptionId?, responseTimeSeconds? }`

**Answer response:** `spacedRepetition` — `nextReviewDate`, `reviewInterval`, `repetitionCount`, `intervalChanged`

**Summary:** `masteryChange`, `itemsReviewed`, `nextReviewSummary` (review mode)

## Repository methods

| Method |
|--------|
| `StartSessionAsync` |
| `StartReviewSessionAsync` |
| `SubmitAnswerAsync` |
| `EndSessionAsync` |

## Persistence

Active session: `practice_active_sessions` (JSON state, TTL 2h). Completed: `learning_sessions`.

Review mode load đúng `questionIds` due — không random theo BKT difficulty.

## Liên kết

- [learningstates.md](learningstates.md)
- [flows/12-practice-session.md](../../04-integration/flows/12-practice-session.md)
