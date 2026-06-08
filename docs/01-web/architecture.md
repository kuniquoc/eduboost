# Web Architecture

> Trạng thái: ✅ (cấu trúc ổn định)

## Stack

React 19 + TypeScript + Vite 8 + TanStack Query + Zustand + Axios + Tailwind v4 + shadcn/ui.

## Bootstrap ([`App.tsx`](../../web/src/App.tsx))

```mermaid
flowchart TD
    main[main.tsx] --> App
    App --> QueryClientProvider
    App --> TooltipProvider
    App --> BrowserRouter
    App --> AppRoutes
    AppRoutes --> initialize auth-store
    AppRoutes --> Routes
```

**QueryClient defaults:** `retry: 1`, `staleTime: 30_000`, `refetchOnWindowFocus: false`.

## Auth flow

1. `AppRoutes` gọi `useAuthStore.initialize()` on mount
2. Có access token → `GET /auth/me`
3. Fail → `POST /auth/refresh`
4. `api.ts` interceptor: 401 → refresh queue → retry hoặc logout callback

## Layout pattern

| Layout | Dùng cho |
|--------|----------|
| `AuthLayout` | `/login`, `/register` |
| `AppLayout` | Teacher/Student/Admin có sidebar |
| None | Landing, entry-test, placement-test (full page) |

## Protected routes

[`protected-route.tsx`](../../web/src/components/layout/protected-route.tsx): check `isAuthenticated` + optional `role` → redirect `/login` hoặc dashboard đúng role.

## API layer

[`api.ts`](../../web/src/services/api.ts):
- `baseURL`: `VITE_API_URL` hoặc `/api`
- `timeout`: 120s (LLM calls)
- `tokenManager`: localStorage keys `eduboost_access_token`, `eduboost_refresh_token`

## Dev proxy

[`vite.config.ts`](../../web/vite.config.ts): `/api` → `http://localhost:5000`.

## Điểm chưa tối ưu

- Không có `hooks/` folder — logic `useQuery` inline trong pages
- Chỉ 1 Zustand store (auth)
- `lib/constants.ts` ROUTES không đầy đủ

## Liên kết

- [routing.md](routing.md)
- [store-and-types.md](store-and-types.md)
- [services/api.service.md](services/api.ts) — xem `api.ts` trực tiếp
