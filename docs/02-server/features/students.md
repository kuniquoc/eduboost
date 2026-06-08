# Feature: Students

> Thư mục: [`server/Features/Students/`](../../../server/Features/Students/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/classes/{classId:guid}/analytics` | `GetClassAnalytics` |
| GET | `api/classes/{classId:guid}/students/{studentId:guid}/analytics` | `GetStudentAnalytics` |
| GET | `api/students/me/progress` | `GetMyProgress` |
| GET | `api/students/me/stats` | `GetMyStats` |

## Repository methods

| Method |
|--------|
| `GetClassAnalyticsAsync` |
| `GetStudentAnalyticsAsync` |
| `GetMyProgressAsync` |
| `GetMyStatsAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
