# Profile

> Trạng thái: 🔧 | Route: `/teacher|student/profile` | Role: all

## Mục đích

Trang/feature `Profile` trong EduBoost web app.

## File nguồn

[`web/src/features/shared/profile-page.tsx`](../../../web/src/features/shared/profile-page.tsx)

## Routes

- `/teacher|student/profile`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

Name edit chưa khả dụng

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
