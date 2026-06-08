# Infrastructure: AgentQuizValidation

> File: [`server/Infrastructure/Services/AgentQuizValidation.cs`](../../../server/Infrastructure/Services/AgentQuizValidation.cs)

## Vai trò

Static validation filter cho MCQ từ AI agent — chỉ giữ câu có đúng 1 đáp án đúng.

## Hàm

| Method | Mô tả | Tests |
|--------|-------|-------|
| `FilterQuestionsWithSingleCorrectOption` | Drop invalid MCQs | `AgentQuizValidationTests.cs` ✅ |

## Known issues

- Chỉ validate format, không validate nội dung semantic
