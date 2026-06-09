# Cross-Layer Inconsistencies

Mâu thuẫn giữa web, server, và ai-agent-core.

## 1. Entry Test — ✅ Web/server thống nhất placement test

| Layer | Implementation | Status |
|-------|----------------|--------|
| server | `PlacementTestsRepository` — adaptive, PostgreSQL | ✅ |
| web | `PlacementTestPage` tại `/student/placement-test/:classId` | ✅ |
| mobile | `entry-test/[classId].tsx` → legacy API | 🔧 Migrate |
| server legacy | `GET/POST /api/quizzes/entry-test/*` | ⚠️ `[Obsolete]` — giữ cho mobile |

## 2. Roadmap vs Learning Path — ✅ Đã thống nhất

Chỉ còn **Roadmap theo lớp** (`/api/roadmap/{classId}`).

## 3. BKT State — single source of truth ✅

PostgreSQL `bkt_states`. Agent không còn `/tutor/update-state` từ .NET.

## 4. Tutor next-action — ✅ Server-side

`GET /api/quizzes/tutor/next-action` → `TutorDecisionService` (không gọi agent).

## 5. Spaced Repetition ✅

Server `SpacedRepetitionService` + web review/practice-session.

## 6. RAG ingest — ✅ Fixed queue worker

| Step | Behavior | Status |
|------|----------|--------|
| confirm upload | → `ingesting` + enqueue | ✅ |
| background ingest | `DocumentIngestBackgroundService` (channel queue) | ✅ |
| ingest fail | → `ingest_failed` + web retry | ✅ |
| shutdown | Hosted service stops gracefully | ✅ |

## 7. Quiz Pool RBAC — ✅ Fixed 2026-06-10

`PoolAuthorization` enforce topic/quiz access.

## 8. Docs vs code — ✅ Largely synced

`api-reference.md` có Pool, Tutor, student delete. `learningPath.service.md` deprecated.

## 9. Student dashboard/profile stats — ✅ Fixed 2026-06-10

| Issue | Before | After |
|-------|--------|-------|
| `weeklyProgress` | Hardcoded `0` | Weighted % correct trong tuần UTC (quiz + sessions) |
| `overallMasteryScore` | DB field never updated | Computed `AVG(bkt_states.mastery_probability)` |
| `topicsStudiedCount` | N/A (UI showed favorite count) | `COUNT(DISTINCT bkt_states.topic_id)` |
| `totalQuizzesTaken` / `avgQuizScore` | Quiz only | Quiz + `learning_sessions` |
| `dayStreak` vs `learningStreak` | Two algorithms on dashboard vs profile | Profile uses `dayStreak` from stats API |
| `enrollment.progress` | Stale DB field (always 0) | Derived from roadmap completion % |

Mobile UI labels chưa đồng bộ (ngoài phạm vi web fix).

## Khuyến nghị tiếp theo

1. Migrate mobile off legacy entry-test
2. Deprecate agent `/tutor/next-action`, `/tutor/update-state` HTTP (orphan)

## Liên kết

- [index.md](index.md)
- [web-gaps.md](web-gaps.md)
- [server-gaps.md](server-gaps.md)
- [agent-gaps.md](agent-gaps.md)
