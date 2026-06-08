# Feature: Roadmap

> Thư mục: [`server/Features/Roadmap/`](../../../server/Features/Roadmap/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/roadmap/{classId:guid}` | `GetRoadmap` |
| POST | `api/roadmap/{classId:guid}/generate` | `GenerateRoadmap` |
| PATCH | `api/roadmap/{classId:guid}/steps/{stepId}` | `UpdateStep` |

## Repository methods

| Method |
|--------|
| `GetByClassIdAsync` |
| `GenerateAsync` |
| `UpdateStepAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
