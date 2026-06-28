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

## Liên kết

- [practicesessions.md](practicesessions.md)
- [flows/11-bkt-review-schedule.md](../../04-integration/flows/11-bkt-review-schedule.md)
