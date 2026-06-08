# Feature: Quizzes

> Thư mục: [`server/Features/Quizzes/`](../../../server/Features/Quizzes/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `api/quizzes/{quizId:guid}/questions` | `GetQuestions` |
| PUT | `api/quizzes/{quizId:guid}/questions/{qId:guid}` | `UpdateQuestion` |
| POST | `api/quizzes/{quizId:guid}/questions` | `AddQuestion` |
| DELETE | `api/quizzes/{quizId:guid}/questions/{qId:guid}` | `DeleteQuestion` |
| PATCH | `api/quizzes/{quizId:guid}/questions/{qId:guid}/verify` | `VerifyQuestion` |
| POST | `api/quizzes/{quizId:guid}/publish` | `PublishQuiz` |
| POST | `api/quizzes/create` | `CreateQuiz` |
| POST | `api/quizzes/generate-entry-test/{classId:guid}` | `GenerateEntryTest` |
| GET | `api/quizzes/class/{classId:guid}` | `GetClassQuizzes` |
| POST | `api/quizzes/my/create` | `CreateMyQuiz` |
| GET | `api/quizzes/entry-test/{classId:guid}` | `GetEntryTest` |
| POST | `api/quizzes/entry-test/{classId:guid}/submit` | `SubmitEntryTest` |
| GET | `api/quizzes/practice/{topicId:guid}` | `GetPracticeQuiz` |
| POST | `api/quizzes/practice/{topicId:guid}/submit` | `SubmitPracticeQuiz` |
| GET | `api/quizzes/my/{quizId:guid}/questions` | `GetMyQuizQuestions` |
| PUT | `api/quizzes/my/{quizId:guid}/questions/{qId:guid}` | `UpdateMyQuestion` |
| GET | `api/quizzes/tutor/next-action` | `GetTutorNextAction` |
| POST | `api/quizzes/tutor/submit-answer` | `SubmitTutorAnswer` |
| GET | `api/quizzes/tutor/explain` | `GetTutorExplanation` |
| POST | `api/quizzes/tutor/explain-error` | `GetErrorExplanation` |
| GET | `api/quizzes/tutor/generate-question` | `GenerateAdaptiveQuestion` |

## Repository methods

| Method |
|--------|
| `UpdateQuestionAsync` |
| `DeleteQuestionAsync` |
| `VerifyQuestionAsync` |
| `PublishQuizAsync` |
| `GetEntryTestAsync` |
| `SubmitEntryTestAsync` |
| `GetPracticeQuizAsync` |
| `SubmitPracticeQuizAsync` |
| `CreateQuizAsync` |
| `CreatePrivateQuizAsync` |
| `HasEntryTestAsync` |
| `GenerateEntryTestAsync` |
| `AddQuestionAsync` |
| `GetTopicNameAsync` |

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
