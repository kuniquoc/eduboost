# Login

> Trạng thái: ⚠️ | Route: `/login` | Role: Public

## Mục đích

Trang/feature `Login` trong EduBoost web app.

## File nguồn

[`web/src/features/auth/login-page.tsx`](../../../web/src/features/auth/pages/login-page.tsx)

## Routes

- `/login`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

Không có demo login; admin redirect

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
