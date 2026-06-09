# Module: learningState.service

> File nguồn: [`web/src/services/learningState.service.ts`](../../../web/src/services/learningState.service.ts)

## Hàm

| Hàm | Endpoint | Dùng trong UI |
|-----|----------|---------------|
| `getStates` | GET `/learning-states/me` | Review page |
| `getState` | GET `/learning-states/me/topic/:topicId` | — |
| `updateAfterAnswer` | POST `/learning-states/update` | — (server gọi nội bộ) |
| `getReviewSchedule` | GET `/learning-states/me/review-schedule` | Dashboard, Review |

## ReviewItemDto fields

`questionText`, `reviewInterval`, `easeFactor`, `lastReviewDate`, `overdueHours`, `repetitionCount`, `retentionScore`
