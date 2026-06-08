# Server Architecture

> Trạng thái: ✅ cấu trúc ổn; ⚠️ RBAC yếu

## Vertical Slice

```
Features/
├── Auth/           Controller + Repository + Models
├── Classes/
├── Documents/
├── Quizzes/
├── QuizPool/
├── ...
Infrastructure/
├── AppDbContext.cs
├── Entities/
├── Migrations/
├── Services/AgentService.cs
└── Storage/MinioStorageService.cs
```

## Bootstrap ([`Program.cs`](../../server/Program.cs))

| Section | Chi tiết |
|---------|----------|
| Controllers | camelCase JSON |
| HttpLogging | Không log body/headers |
| Swagger | JWT Bearer tại `/swagger` |
| EF Core | PostgreSQL, auto-migrate startup |
| JWT | Bearer, claims: sub, email, role, name, jti |
| CORS | AllowAnyOrigin ❌ |
| DI | 15 repositories scoped + IAgentService + IStorageService |
| Minimal APIs | `GET /`, `GET /health` |

## Response envelope

[`ApiResponse<T>`](../../server/Common/Models/ApiResponse.cs): `{ success, data, message, errors }`.

## External integrations

| Service | Config |
|---------|--------|
| PostgreSQL | `ConnectionStrings:Default` |
| MinIO | `MinIO:Endpoint`, `PublicEndpoint`, `AgentEndpoint` |
| AI Agent | `AIAgent:BaseUrl`, HttpClient 120s + QuizBatch 600s |

## Routing inconsistency ⚠️

- Hầu hết: `[Route("api/...")]` trên controller
- `DocumentsController`, `StudentsController`: full path per action

## Liên kết

- [infrastructure/](infrastructure/)
- [features/](features/)
