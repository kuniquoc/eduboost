# Luồng: Learning Paths API

> Trạng thái: 🔧

## Trigger

— no UI

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Web as web
    participant API as server
    participant Agent as ai-agent-core
    participant DB as PostgreSQL
    User->>Web: — no UI
    Web->>API: REST call
    API->>DB: Persist / query
    opt AI required
        API->>Agent: HTTP tutor/rag
        Agent-->>API: JSON response
    end
    API-->>Web: ApiResponse
    Web-->>User: UI update
```

## Bảng bước

| Step | Layer | File / Module | API / Endpoint | Ghi chú |
|------|-------|---------------|----------------|---------|
| 1 | web | See integration map | — | User action |
| 2 | web | Service layer | REST | JWT attached |
| 3 | server | LearningPathsRepository.cs | /api/learning-paths/* | Repository logic |
| 4 | server | AgentService (if any) | Agent HTTP | Graceful degradation |
| 5 | web | React Query invalidate | — | UI refresh |

## Error paths & fallback

- **401:** Axios refresh queue → retry hoặc logout
- **Agent offline:** Tutor/chat trả placeholder; quiz generation fail message
- **Upload fail:** Toast error, document status `pending` không confirm

## Trạng thái & hạn chế

learningPath.service không có consumer

## Liên kết

- [web-server-agent-map.md](../web-server-agent-map.md)
- [../../99-known-issues/index.md](../../99-known-issues/index.md)
