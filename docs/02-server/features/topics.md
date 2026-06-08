# Feature: Topics

> Thư mục: [`server/Features/Topics/`](../../../server/Features/Topics/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/classes/{classId:guid}/topics` | `GetTopics` |
| POST | `api/classes/{classId:guid}/topics` | `CreateTopic` |
| PUT | `api/classes/{classId:guid}/topics/{id:guid}` | `UpdateTopic` |
| DELETE | `api/classes/{classId:guid}/topics/{id:guid}` | `DeleteTopic` |
| POST | `api/classes/{classId:guid}/topics/ai-evaluate` | `AiEvaluate` |
| PUT | `api/classes/{classId:guid}/topics/{id:guid}/difficulty` | `UpdateDifficulty` |
| PATCH | `api/classes/{classId:guid}/topics/{id:guid}/visibility` | `UpdateVisibility` |

## Repository methods

| Method |
|--------|
| `GetByIdAsync` |
| `CreateAsync` |
| `UpdateAsync` |
| `DeleteAsync` |
| `UpdateDifficultyAsync` |
| `UpdateVisibilityAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
