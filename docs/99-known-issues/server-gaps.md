# Known Issues — Server (.NET)

## ❌ Chưa đúng / lỗi

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Open role registration | `AuthRepository.cs` | Client gửi `role` tự do → có thể đăng ký `teacher` |
| Weak RBAC | Hầu hết controllers | Chỉ `[Authorize]`, không check teacher/student |
| Class ownership | `ClassesRepository.cs` | Update/Delete không verify `TeacherId == caller` |
| JWT secret placeholder | `appsettings.json` | `CHANGE_ME_IN_PRODUCTION...` |
| CORS permissive | `Program.cs` | `AllowAnyOrigin/Method/Header` |
| Profile access | `UserProfilesRepository.cs` | `GetProfileByUserIdAsync` không check relationship |

## 🔧 Chưa hoàn thiện

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Entry test generator stub | `QuizzesRepository.GenerateEntryTestAsync` | Hardcoded `[AI]` placeholder, không gọi agent |
| Topic AI evaluate heuristic | `TopicsRepository.AiEvaluateAsync` | Độ khó theo số câu hỏi, không AI |
| Database seeder disabled | `Program.cs:179` | `// await DatabaseSeeder.SeedAsync` |
| No admin in seeder | `DatabaseSeeder.cs` | Chỉ teacher + students |
| Stale HTTP sample | `EduBoost.API.http` | References `/weatherforecast` |
| Test coverage | `tests/` | Chỉ 2 unit test files |

## ⚠️ Chưa tối ưu

| Vấn đề | File | Chi tiết |
|--------|------|----------|
| Placement sessions in-memory | `PlacementTestsRepository.cs` | `ConcurrentDictionary`, comment "use Redis" |
| Practice sessions in-memory | `PracticeSessionsRepository.cs` | Mất khi restart / multi-instance |
| RAG ingest fire-and-forget | `DocumentsRepository.cs` | `Task.Run`, doc vẫn `ready` khi ingest fail |
| RAG delete fire-and-forget | `DocumentsRepository.cs` | Không track completion |
| Tutor BKT update background | `QuizzesController.cs` | `Task.Run` + `Console.WriteLine`, mastery trả `null` |
| HTTPS disabled | `Program.cs` | Comment: Docker HTTP only |
| Routing inconsistency | `DocumentsController`, `StudentsController` | Per-action full path vs `[Route]` prefix |
| Agent offline fallbacks | `QuizzesController`, `AiChatRepository` | Placeholder content khi agent down |
| Sync quiz generation UX | `DocumentsRepository` | Message "AI đang xử lý" nhưng work mostly synchronous |

## Role gate duy nhất

Chỉ `PoolController.CreateTestFromPool` check `userRole != "teacher"`.

## Liên kết

- [../02-server/README.md](../02-server/README.md)
- [../02-server/infrastructure/agent-service.md](../02-server/infrastructure/agent-service.md)
