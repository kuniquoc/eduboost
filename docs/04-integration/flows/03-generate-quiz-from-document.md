# Luồng: Generate Quiz từ Document

> Trạng thái: ✅

## Trigger

`QuizGenerationDialog` sau khi document `ready` — teacher (class doc) hoặc student (AI Lab).

## Sequence diagram

```mermaid
sequenceDiagram
    participant Web as quiz-generation-dialog
    participant API as DocumentsRepository
    participant Agent as /tutor/generate-quiz
    participant Val as AgentQuizValidation
    participant DB as PostgreSQL

    Web->>API: POST .../generate-quiz
    API->>DB: doc status=processing
    API->>Agent: GenerateQuizBatchAsync(docUrl, existingQuestions)
    Agent->>Agent: Per-question QUIZ_TEMPLATE sequential
    Agent-->>API: questions JSON
    API->>Val: FilterQuestionsWithSingleCorrectOption
    API->>DB: Create/append Quiz type pool
    API->>DB: doc status=ready, GeneratedQuizId
    API-->>Web: GenerateQuizJobDto + quizId
    Web->>Web: Navigate ai-studio / ai-lab quiz review
```

## Modes

| Mode | Behavior |
|------|----------|
| `create` | Quiz mới |
| `append` | Thêm vào pool quiz hiện có |
| advanced | Split easy/medium/hard counts |

## Hàm chính

| Hàm | Layer | Trạng thái |
|-----|-------|------------|
| `generateQuizFromDocument` | web | ✅ |
| `GenerateQuizFromDocumentAsync` | server | ✅ |
| `GenerateQuizBatchAsync` | AgentService | ✅ 600s timeout |
| `generate_quiz_batch` | agent | ⚠️ sequential, partial batch |

## Trạng thái & hạn chế

- Blocking synchronous call — UI chờ đến 10 phút có thể
- Agent có thể trả ít câu hơn requested ⚠️
- Dedup against `existing_questions` từ pool hiện có ✅

## Liên kết

- [../../03-ai-agent-core/api/quiz-parsers.md](../../03-ai-agent-core/api/quiz-parsers.md)
- [06-ai-studio-publish.md](06-ai-studio-publish.md)
