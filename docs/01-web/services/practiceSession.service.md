# Module: practiceSession.service

> File nguồn: [`web/src/services/practiceSession.service.ts`](../../../web/src/services/practiceSession.service.ts)

## Hàm

| Hàm | Endpoint | Mô tả |
|-----|----------|--------|
| `start` | POST `/practice-sessions/start` | Standard mode |
| `startReview` | POST `/practice-sessions/start-review` | Due SR items |
| `startFixed` | POST `/practice-sessions/start` mode=`fixed` | Quiz Pool — danh sách câu cố định |
| `submitAnswer` | POST `/practice-sessions/answer` | + `responseTimeSeconds` |
| `endSession` | POST `/practice-sessions/end` | Summary + streak |

## Response types

- `SubmitPracticeAnswerResponse.spacedRepetition` — milestone feedback
- `PracticeSessionSummary.masteryChange`, `itemsReviewed`, `nextReviewSummary`
