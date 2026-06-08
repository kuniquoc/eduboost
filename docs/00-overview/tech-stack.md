# Tech Stack

## web/

| Thành phần | Phiên bản / Ghi chú |
|------------|---------------------|
| React | 19 |
| TypeScript | strict |
| Vite | 8 |
| React Router | v7 |
| TanStack React Query | Server state, staleTime 30s |
| Zustand | Chỉ `auth-store` |
| Axios | JWT interceptor + refresh queue |
| Tailwind CSS | v4 (Vite plugin, không có tailwind.config.ts) |
| shadcn/ui | 16 primitives trong `components/ui/` |
| Sonner | Toast notifications |

**Env:** `VITE_API_URL` (mặc định `/api` qua proxy).

## server/

| Thành phần | Ghi chú |
|------------|---------|
| .NET | 9.0 |
| ASP.NET Core | Controllers, JWT Bearer |
| EF Core | PostgreSQL (Npgsql) |
| BCrypt.Net-Next | Password hashing |
| Minio SDK | S3-compatible storage |
| Swagger | `/swagger` |
| xUnit | 2 test files hiện tại |

**Config keys:** `ConnectionStrings:Default`, `Jwt:*`, `MinIO:*`, `AIAgent:BaseUrl`.

## ai-agent-core/

| Thành phần | Ghi chú |
|------------|---------|
| Python | 3.12 |
| FastAPI + Uvicorn | Port 8000 |
| sentence-transformers | `all-MiniLM-L6-v2` |
| FAISS | IndexFlatIP, cosine similarity |
| OpenAI SDK | OpenAI-compatible endpoints |
| PyPDF2 / pymupdf / python-docx | Document reading |

**Env:** `FAISS_INDEX_PATH`, `EMBEDDING_MODEL`, `QUIZ_LLM_*`, `EXPLAIN_LLM_*`, `OPENAI_API_KEY`.

## Infrastructure

| Service | Mục đích |
|---------|----------|
| PostgreSQL | Primary database, auto-migrate on startup |
| MinIO | `eduboost-class-docs`, `eduboost-student-docs` |

## Liên kết

- [system-architecture.md](system-architecture.md)
- [../01-web/architecture.md](../01-web/architecture.md)
- [../02-server/architecture.md](../02-server/architecture.md)
- [../03-ai-agent-core/architecture.md](../03-ai-agent-core/architecture.md)
