# Student Dashboard

> Trạng thái: ✅ | Route: `/student/dashboard` | Role: student

## Mục đích

Trang/feature `Student Dashboard` trong EduBoost web app.

## File nguồn

[`web/src/features/student/dashboard/dashboard-page.tsx`](../../../web/src/features/student/dashboard/dashboard-page.tsx)

## Routes

- `/student/dashboard`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

Entry test redirect logic

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
