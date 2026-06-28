# Class Detail

> Trạng thái: ✅ | Route: `/teacher/classes/:id` | Role: teacher

## Mục đích

Trang/feature `Class Detail` trong EduBoost web app.

## File nguồn

[`web/src/features/classes/class-detail-page.tsx`](../../../web/src/features/classes/pages/teacher/class-detail-page.tsx)

## Routes

- `/teacher/classes/:id`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

Tabs: topics, docs, students, quizzes

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
