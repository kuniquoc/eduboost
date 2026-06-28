# Module: placementTest.service

> File nguồn: [`web/src/features/placementTest.service.ts`](../../../web/src/features/placement-test/api/placement-test.service.ts)

## Vai trò
API client wrapper cho `placementTest` endpoints.

## Hàm

| Hàm | Endpoint | Trạng thái |
|-----|----------|------------|
| `start` | `—` | ✅ |
| `submitAnswer` | `—` | ✅ |
| `complete` | POST `/placement-tests/complete` | ✅ — sau complete, `entry-test-page` invalidate learning queries |

## Cache invalidation

`PlacementTestPage` gọi `invalidateLearningQueries` sau `complete`: `student-progress`, `roadmap`, `learning-states`, `enrolled-classes`, `user-profile`, `student-stats`.

## Known issues

Xem [web-gaps.md](../../99-known-issues/web-gaps.md).
