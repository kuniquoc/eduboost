# Infrastructure: Program.cs

> File: [`server/Program.cs`](../../../server/Program.cs)

## Middleware pipeline

1. HttpLogging (exclude `/health`, `/swagger`)
2. Swagger / SwaggerUI
3. CORS
4. Authentication + Authorization
5. Controllers
6. `GET /` → redirect `/swagger`
7. `GET /health`

## DI registrations

| Interface | Implementation | Lifetime |
|-----------|----------------|----------|
| `IAuthRepository` | `AuthRepository` | Scoped |
| `IClassesRepository` | `ClassesRepository` | Scoped |
| `ITopicsRepository` | `TopicsRepository` | Scoped |
| `IDocumentsRepository` | `DocumentsRepository` | Scoped |
| `IQuizzesRepository` | `QuizzesRepository` | Scoped |
| `IStudentsRepository` | `StudentsRepository` | Scoped |
| `IRoadmapRepository` | `RoadmapRepository` | Scoped |
| `IPoolRepository` | `PoolRepository` | Scoped |
| `IUserProfilesRepository` | `UserProfilesRepository` | Scoped |
| `ILearningStatesRepository` | `LearningStatesRepository` | Scoped |
| `IPlacementTestsRepository` | `PlacementTestsRepository` | Scoped |
| `IPracticeSessionsRepository` | `PracticeSessionsRepository` | Scoped |
| `IAiChatRepository` | `AiChatRepository` | Scoped |
| `IAdminRepository` | `AdminRepository` | Scoped |
| `IAgentService` | `AgentService` | Typed HttpClient |
| `IStorageService` | `MinioStorageService` | Scoped |

## Startup

- `Database.Migrate()` on startup
- `DatabaseSeeder.SeedAsync` — **commented out** 🔧

## Known issues

- HTTPS redirection disabled (Docker)
- JWT secret placeholder in appsettings
