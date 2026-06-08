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

| Method |
|--------|
| `GetStateByTopicAsync` |
| `UpdateAfterAnswerAsync` |
| `GetReviewScheduleAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
