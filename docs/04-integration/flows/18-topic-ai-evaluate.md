# Luồng: Topic AI Evaluate

> Trạng thái: ✅

## Trigger

Teacher bấm "AI đánh giá độ khó" trên tab Topics trong class detail.

## Sequence diagram

```mermaid
sequenceDiagram
    actor Teacher
    participant Web as web
    participant API as server
    participant Agent as ai-agent-core
    participant DB as PostgreSQL
    Teacher->>Web: AI evaluate topics
    Web->>API: POST /api/classes/{id}/topics/ai-evaluate
    API->>DB: Load topics + sample questions
    loop Each topic
        API->>Agent: AskAsync (difficulty prompt)
        Agent-->>API: easy | medium | hard
        opt Agent offline / bad response
            API->>API: Heuristic from question count
        end
    end
    API->>DB: Save difficulty + AiEvaluated
    API-->>Web: Updated topics
```

## Bảng bước

| Step | Layer | File / Module | API / Endpoint | Ghi chú |
|------|-------|---------------|----------------|---------|
| 1 | web | `topics.service.ts` | POST `topics/ai-evaluate` | Teacher only |
| 2 | server | `TopicsController.AiEvaluate` | RBAC teacher owns class | |
| 3 | server | `TopicsRepository.AiEvaluateAsync` | `AgentService.AskAsync` | Fallback heuristic |
| 4 | server | `TopicDifficultyParser` | — | Parse AI + heuristic bands |

## Error paths & fallback

- **Agent offline:** Heuristic theo số câu hỏi (≥10 hard, ≥6 medium, else easy)
- **Unparseable AI text:** Cùng heuristic
- **401/403:** JWT / teacher ownership

## Liên kết

- [web-server-agent-map.md](../web-server-agent-map.md)
- [../../99-known-issues/server-gaps.md](../../99-known-issues/server-gaps.md)
