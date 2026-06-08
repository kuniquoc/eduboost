# Feature: QuizPool

> Thư mục: [`server/Features/QuizPool/`](../../../server/Features/QuizPool/)

## Controller endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `api/pool/generate` | `GeneratePoolQuiz` |
| GET | `api/pool/topics` | `GetTopicsInPool` |
| GET | `api/pool/topics/{topicId:guid}/quizzes` | `GetQuizzesInTopicPool` |
| DELETE | `api/pool/quizzes/{quizId:guid}` | `DeletePoolQuiz` |
| POST | `api/pool/create-test` | `CreateTestFromPool` |
| POST | `api/pool/create-revision-set` | `CreateRevisionSetFromPool` |
| GET | `api/pool/revision-sets` | `GetRevisionSets` |

## Repository methods

| Method |
|--------|

## Known issues

Xem [server-gaps.md](../../99-known-issues/server-gaps.md).

## Liên kết

- [flows](../../04-integration/flows/)
- [api-reference](../../04-integration/api-reference.md)
