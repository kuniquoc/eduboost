# Practice Session

> Trạng thái: ✅ | Route: `/student/practice-session` | Role: student

## Mục đích

Phiên luyện tập BKT + Spaced Repetition — standard hoặc review mode.

## File nguồn

[`web/src/features/student/practice-session/practice-session-page.tsx`](../../../web/src/features/student/practice-session/practice-session-page.tsx)

## Query params

| Param | Mô tả |
|-------|--------|
| `topicId`, `topicName` | Standard mode |
| `mode=review` | Auto-start review session |
| `questionIds` | Comma-separated IDs (review một câu) |

## Tính năng

- Đo `responseTimeSeconds` mỗi câu
- Badge milestone SM-2 sau feedback
- Summary: mastery change, next review summary
- Invalidate `review-schedule` + `learning-states` khi kết thúc

## API / Services

- `practiceSessionService.start`, `startReview`, `submitAnswer`, `endSession`

## Liên kết

- [flows/12-practice-session.md](../../04-integration/flows/12-practice-session.md)
