# AI Chat

> Trạng thái: ✅ | Route: `/student/ai-chat` | Role: student

## Mục đích

Trang/feature `AI Chat` trong EduBoost web app.

## File nguồn

[`web/src/features/student/ai-chat/ai-chat-page.tsx`](../../../web/src/features/student/ai-chat/ai-chat-page.tsx)

## Routes

- `/student/ai-chat`

## API / Services

Xem [web-server-agent-map.md](../../04-integration/web-server-agent-map.md) và [services/](../services/).

## State management

- TanStack React Query (`useQuery` / `useMutation`)
- Zustand `auth-store` cho user/role

## Điểm chưa tối ưu / chưa hoàn thiện

No streaming

## Liên kết

- [routing.md](../routing.md)
- [flows](../../04-integration/flows/)
