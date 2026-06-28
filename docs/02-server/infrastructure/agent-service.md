# Infrastructure: AgentService

> File: [`server/Infrastructure/Integrations/Agent/AgentService.cs`](../../../server/Infrastructure/Integrations/Agent/AgentService.cs)

## Vai trò

HTTP client gọi ai-agent-core FastAPI tại `AIAgent:BaseUrl`.

## Hàm (IAgentService)

| Method | Agent Endpoint | Timeout | Trạng thái |
|--------|----------------|---------|------------|
| `GetNextActionAsync` | `GET /tutor/next-action` | 120s | ✅ fallback null |
| `UpdateStateAsync` | `POST /tutor/update-state` | 120s | ✅ |
| `GenerateQuizQuestionAsync` | `GET /tutor/generate-question` | 120s | ✅ |
| `GetExplanationAsync` | `GET /tutor/explain` | 120s | ✅ |
| `GetGraderExplanationAsync` | `POST /tutor/explain-error` | 120s | ✅ |
| `GenerateQuizBatchAsync` | `POST /tutor/generate-quiz` | **600s** | ✅ |
| `AskAsync` | `POST /tutor/chat` | 120s | ✅ |
| `IngestDocumentAsync` | `POST /rag/ingest` | 120s | ⚠️ fire-and-forget caller |
| `DeleteDocumentAsync` | `POST /rag/delete` | 120s | ⚠️ fire-and-forget caller |

## HTTP clients

- Default `HttpClient` — 120s
- Named `AgentQuizBatch` — 600s cho batch quiz

## JSON serialization

- Serialize to agent: snake_case
- Deserialize from agent: camelCase insensitive

## Graceful degradation

Catch exceptions → log warning → return `null` hoặc fallback message. Tutor endpoints vẫn trả placeholder khi agent offline.

## Liên kết

- [AgentQuizValidation.cs](agent-quiz-validation.md)
- [../../03-ai-agent-core/api/endpoints.md](../../03-ai-agent-core/api/endpoints.md)
