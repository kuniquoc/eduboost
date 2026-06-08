# Cross-Layer Inconsistencies

Mâu thuẫn giữa web, server, và ai-agent-core.

## 1. Entry Test — 3 implementations

| Layer | Implementation | Status |
|-------|----------------|--------|
| server | `GenerateEntryTestAsync` — stub `[AI]` placeholder | 🔧 |
| server | `PlacementTestsRepository` — adaptive in-memory | ⚠️ |
| web | `entry-test-page.tsx` — legacy per-class | 🔧 |
| web | `adaptive-placement-test-page.tsx` — no nav | 🔧 |
| agent | `/entry-test/*` — adaptive engine | ❌ Orphan, không .NET gọi |

**Hậu quả:** Dashboard redirect legacy entry-test; placement test khó discover; agent entry-test không dùng.

## 2. Roadmap vs Learning Path

| Concept | API | UI | Scope |
|---------|-----|-----|-------|
| Roadmap | `/api/roadmap/{classId}` | `roadmap-page.tsx` ✅ | Per-class |
| Learning path | `/api/learning-paths/*` | None 🔧 | Global cross-class |

Cùng entity `PersonalizedLearningPath` nhưng filter khác nhau.

## 3. BKT State — dual storage

| Location | Persistence | Used when |
|----------|-------------|-----------|
| PostgreSQL `bkt_states` | Permanent | Practice session, learning states API |
| Agent `agent_sessions` | In-memory | Tutor next-action during session |

Đồng bộ qua `POST /tutor/update-state` — **fire-and-forget** từ `QuizzesController` ⚠️. Tutor submit trả `mastery: null`.

## 4. Spaced Repetition

| Layer | Status |
|-------|--------|
| server | `SpacedRepetitionItem` entity + review schedule API ✅ |
| agent | `/spaced-repetition/update` SM-2 | ❌ Orphan |
| web | Review page + practice session ✅ |

Server tự tính SM-2 trong `LearningStatesRepository`, không gọi agent.

## 5. RAG ingest status

| Step | Behavior | Issue |
|------|----------|-------|
| confirm upload | Document → `ready` | ✅ |
| background ingest | `Task.Run` → agent | ⚠️ |
| ingest fail | Doc vẫn `ready` | ❌ |

## 6. Quiz generation UX

| Layer | Message | Reality |
|-------|---------|---------|
| server | "AI đang xử lý" | Mostly synchronous in repository |
| web | Poll/navigate after generate | Blocks until response |

## 7. Role registration

| Layer | Behavior |
|-------|----------|
| web | `register-page` gửi `role` user chọn |
| server | Lưu role trực tiếp — không validate |

❌ Self-register as teacher.

## 8. Docs vs code

| Doc | Issue |
|-----|-------|
| `implementation-plan.md` | Lists UserProfile, BKT DB as missing — **implemented** |
| `web-technical-spec.md` | hooks/, analytics pages — **don't exist** |
| `features.md` | Demo login — **don't exist** |
| `ai-agent-core/docs/06_ai_server.md` | vLLM orchestrator — **not implemented** |

## 9. API path conventions

| Pattern | Controllers |
|---------|-------------|
| `[Route("api/...")]` + relative | Auth, Classes, Quizzes, Pool… |
| Full path per action | Documents, Students |

## Khuyến nghị thống nhất

1. Chọn **một** entry/placement test flow — deprecate còn lại
2. Nối learning paths UI hoặc remove API
3. Persist agent sessions hoặc chỉ dùng PostgreSQL BKT
4. Track RAG ingest job status trên Document entity
5. Server-side role validation on register

## Liên kết

- [index.md](index.md)
- [web-gaps.md](web-gaps.md)
- [server-gaps.md](server-gaps.md)
- [agent-gaps.md](agent-gaps.md)
