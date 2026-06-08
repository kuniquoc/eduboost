# Feature: PlacementTests

> Thư mục: [`server/Features/PlacementTests/`](../../../server/Features/PlacementTests/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/placement-tests/start` | `StartTest` |
| POST | `api/placement-tests/answer` | `SubmitAnswer` |
| POST | `api/placement-tests/complete` | `CompleteTest` |
| GET | `api/placement-tests/result` | `GetResult` |

## Repository methods

| Method |
|--------|
| `StartTestAsync` |
| `SubmitAnswerAsync` |
| `CompleteTestAsync` |
| `GetResultAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
