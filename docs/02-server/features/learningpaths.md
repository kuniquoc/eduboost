# Feature: LearningPaths

> Thư mục: [`server/Features/LearningPaths/`](../../../server/Features/LearningPaths/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/learning-paths/me` | `GetMyPath` |
| POST | `api/learning-paths/regenerate` | `Regenerate` |
| PUT | `api/learning-paths/{id:guid}/complete` | `MarkComplete` |

## Repository methods

| Method |
|--------|
| `GetMyPathAsync` |
| `RegenerateAsync` |
| `MarkCompleteAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
