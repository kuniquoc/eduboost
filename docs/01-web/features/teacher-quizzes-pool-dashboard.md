# Teacher Quiz Pool

> Trạng thái: ⚠️ | Route: `/teacher/quiz-pool` | Role: teacher

## Mục đích

Trang/feature `Teacher Quiz Pool` trong EduBoost web app.

## File nguồn

[`web/src/features/teacher/quizzes/pool-dashboard.tsx`](../../../web/src/features/teacher/quizzes/pool-dashboard.tsx)

## Routes

- `/teacher/quiz-pool`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

revision-sets inline API

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
