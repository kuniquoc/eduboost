# Feature: PracticeSessions

> Thư mục: [`server/Features/PracticeSessions/`](../../../server/Features/PracticeSessions/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/practice-sessions/start` | `StartSession` |
| POST | `api/practice-sessions/answer` | `SubmitAnswer` |
| POST | `api/practice-sessions/end` | `EndSession` |

## Repository methods

| Method |
|--------|
| `StartSessionAsync` |
| `SubmitAnswerAsync` |
| `EndSessionAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
