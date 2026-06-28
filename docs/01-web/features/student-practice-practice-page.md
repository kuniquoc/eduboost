# AI Tutor Practice

> Trạng thái: ⚠️ | Route: `/student/practice/:topicId` | Role: student

## Mục đích

Trang/feature `AI Tutor Practice` trong EduBoost web app.

## File nguồn

[`web/src/features/practice/practice-page.tsx`](../../../web/src/features/practice/pages/practice-page.tsx)

## Routes

- `/student/practice/:topicId`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

BKT async

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
