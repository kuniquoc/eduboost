# API Endpoints

> Routers: [`ai-agent-core/src/api/routes/`](../../../ai-agent-core/src/api/routes/) — mounted từ [`main.py`](../../../ai-agent-core/src/api/main.py)

**11 endpoints triển khai** + 4 documented-only (chưa có HTTP handler).

## Implemented (11)

| Method | Path | Handler | .NET gọi? |
|--------|------|---------|-----------|
| GET | `/health` | `health` | — (docker healthcheck) |
| POST | `/rag/ingest` | `ingest_document` | ✅ IngestDocumentAsync |
| POST | `/rag/delete` | `delete_document` | ✅ DeleteDocumentAsync |
| POST | `/rag/retrieve` | `retrieve_context` | ❌ |
| GET | `/tutor/next-action` | `get_next_action` | ❌ Orphan — server dùng `TutorDecisionService` |
| POST | `/tutor/update-state` | `update_student_state` | ❌ Deprecated — BKT trên PostgreSQL |
| GET | `/tutor/generate-question` | `generate_quiz_question` | ✅ |
| GET | `/tutor/explain` | `explain_topic` | ✅ |
| POST | `/tutor/explain-error` | `grade_answer` | ✅ |
| POST | `/tutor/generate-quiz` | `generate_quiz_batch` | ✅ |
| POST | `/tutor/chat` | `chat` | ✅ AskAsync |

## Documented but not implemented (4)

| Method | Path | Note |
|--------|------|------|
| POST | `/spaced-repetition/update` | SR trên server `SpacedRepetitionService.cs` |
| POST | `/entry-test/start` | Logic trong `core/entry_test.py` only |
| POST | `/entry-test/next-question` | — |
| POST | `/entry-test/evaluate` | — |

## Pydantic models (live)

`IngestRequest`, `DeleteRequest`, `RetrieveRequest`, `UpdateStateRequest`, `GenerateQuizBatchRequest`, `ChatRequest`, `GraderRequest`

## Parser helpers

Chi tiết: [quiz-parsers.md](quiz-parsers.md) — live trong `quiz_batch_service.py`
