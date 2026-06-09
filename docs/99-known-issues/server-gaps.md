# Known Issues — Server (.NET)

## ❌ Chưa đúng / lỗi

_Không còn mục critical sau audit 2026-06-10._

## 🔧 Chưa hoàn thiện

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Legacy entry-test API | `QuizzesController` | `[Obsolete]` — mobile vẫn gọi; migrate sang placement-tests |
| Database seeder disabled | `Program.cs` | `// await DatabaseSeeder.SeedAsync` (dev only) |

## ⚠️ Chưa tối ưu

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Agent offline fallbacks | `QuizzesController`, `AiChatRepository` | Placeholder khi agent down |
| Sync quiz generation UX | `DocumentsRepository` | Message "AI đang xử lý" nhưng mostly synchronous |
| Controller integration tests | — | Repository tests only (43 tests) |

## ✅ Đã xử lý (2026-06-10 audit + follow-up)

| Vấn đề | Giải pháp |
|--------|-----------|
| Pool IDOR | `PoolAuthorization` + controller checks |
| Quiz question IDOR | `QuestionBelongsToQuizAsync` |
| Topic classId IDOR | `BelongsToClassAsync` trong TopicsController |
| Practice/LearningStates topic access | `CanStudentAccessTopicAsync` |
| AiChat topicId validation | Enrollment check trong controller |
| Student delete question | `DELETE /api/quizzes/my/{quizId}/questions/{qId}` |
| Dead AgentService methods | Gỡ `GetNextActionAsync`, `UpdateStateAsync` |
| Practice InvalidOperationException → 500 | try/catch → 400 trong controller |
| RAG ingest Task.Run | `DocumentIngestBackgroundService` + channel queue |

## Liên kết

- [../02-server/README.md](../02-server/README.md)
- [../02-server/infrastructure/agent-service.md](../02-server/infrastructure/agent-service.md)
