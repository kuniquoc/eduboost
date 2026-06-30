# Feature: LearningStates

> Thư mục: [`server/Features/LearningStates/`](../../../server/Features/LearningStates/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/learning-states/me` | `GetMyStates` |
| GET | `api/learning-states/me/topic/{topicId:guid}` | `GetStateByTopic` |
| POST | `api/learning-states/update` | `UpdateAfterAnswer` |
| GET | `api/learning-states/me/review-schedule` | `GetReviewSchedule` |

## Repository methods

| Method | Mô tả |
|--------|--------|
| `GetAllStatesAsync` | BKT states theo user |
| `GetStateByTopicAsync` | BKT một chủ đề |
| `UpdateAfterAnswerAsync` | Cập nhật BKT + SM-2 (`SpacedRepetitionItem`) |
| `GetReviewScheduleAsync` | Items due trong 12h (`SpacedRepetitionService.IsDueForReview`) |
| `GetDueQuestionIdsAsync` | ID câu due (dùng cho `start-review`) |

## SM-2 (Spaced Repetition)

- **Quality:** `ComputeQuality(isCorrect, responseTimeSeconds)` — port từ Python (5/4/3/1)
- **Mốc interval:** rep 0→1 ngày, rep 1→6 ngày, sau đó `interval × easeFactor`
- **Nguồn sự thật:** PostgreSQL `spaced_repetition_items` — không gọi agent `/spaced-repetition/update`

## DTO mở rộng

`ReviewItemDto`: `questionText`, `reviewInterval`, `easeFactor`, `lastReviewDate`, `overdueHours`

`UpdateBktResponse`: `spacedRepetition` (`SrUpdateDto`)

## Luồng ghi dữ liệu

Mọi luồng trả lời gọi `UpdateAfterAnswerAsync`:

- Practice session (`PracticeSessionsRepository`)
- Quiz submit (`QuizzesRepository.ScoreAndSaveAsync`)
- Placement test (`PlacementTestsRepository`)
- AI Tutor submit (`QuizzesController` — câu hỏi AI được persist vào quiz `type=tutor`)

## IRT ability và snapshot độ khó

- Mỗi câu trả lời lưu độ khó tại thời điểm trả lời vào `IrtResponse.BetaAtResponse`.
- Theta được tính bằng Rasch 1PL từ snapshot này, không đọc lại `IrtItem.Beta` hiện tại. Vì vậy việc giáo viên chỉnh độ khó không làm thay đổi theta lịch sử; chỉ phản hồi mới dùng beta mới.
- Mỗi chủ đề dùng tối đa 50 item khác nhau trong 180 ngày gần nhất và chỉ phản hồi mới nhất của mỗi item.
- `IrtAbilityState.EstimatorVersion` theo dõi phiên bản công thức. Startup backfill các state cũ trước khi nhận request; state legacy không có phản hồi được giữ nguyên.

## Liên kết

- [practicesessions.md](practicesessions.md)
- [flows/11-bkt-review-schedule.md](../../04-integration/flows/11-bkt-review-schedule.md)
