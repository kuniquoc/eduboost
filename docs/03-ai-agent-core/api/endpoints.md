# API Endpoints (main.py)

> File: [`ai-agent-core/src/api/main.py`](../../../ai-agent-core/src/api/main.py)

## Endpoints

| Method | Path | Handler | .NET gọi? |
|--------|------|---------|-----------|
| GET | `/health` | `health` | — |
| POST | `/rag/ingest` | `ingest_document` | ✅ IngestDocumentAsync |
| POST | `/rag/delete` | `delete_document` | ✅ DeleteDocumentAsync |
| POST | `/rag/retrieve` | `retrieve_context` | ❌ Không |
| GET | `/tutor/next-action` | `get_next_action` | ✅ |
| POST | `/tutor/update-state` | `update_student_state` | ✅ |
| GET | `/tutor/generate-question` | `generate_quiz_question` | ✅ |
| GET | `/tutor/explain` | `explain_topic` | ✅ |
| POST | `/tutor/explain-error` | `grade_answer` | ✅ |
| POST | `/tutor/generate-quiz` | `generate_quiz_batch` | ✅ |
| POST | `/tutor/chat` | `chat` | ✅ AskAsync |
| POST | `/spaced-repetition/update` | `update_spaced_repetition` | ❌ Orphan |
| POST | `/entry-test/start` | `start_entry_test` | ❌ Orphan |
| POST | `/entry-test/next-question` | `entry_test_next_question` | ❌ Orphan |
| POST | `/entry-test/evaluate` | `evaluate_entry_test` | ❌ Orphan |

## Pydantic models

`IngestRequest`, `DeleteRequest`, `RetrieveRequest`, `UpdateStateRequest`, `GenerateQuizRequest`, `ExplainRequest`, `GraderRequest`, `GenerateQuizBatchRequest`, `ChatRequest`, `SpacedRepetitionUpdateRequest`, `EntryTestAnswerRequest`

## Parser helpers

Chi tiết: [quiz-parsers.md](quiz-parsers.md)
