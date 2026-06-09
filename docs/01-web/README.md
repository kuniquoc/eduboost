# Web Frontend Documentation

React 19 SPA tại [`web/`](../../web/).

## Mục lục

| Doc | Nội dung |
|-----|----------|
| [architecture.md](architecture.md) | Router, QueryClient, auth, proxy |
| [routing.md](routing.md) | Toàn bộ routes từ App.tsx |
| [store-and-types.md](store-and-types.md) | Zustand + TypeScript DTOs |
| [services/](services/) | 14 API service modules |
| [hooks/](../../web/src/hooks/) | 23 shared React Query hooks |
| [features/](features/) | 25 trang/tính năng UI |
| [components/](components/) | Layout, shared, UI primitives |
| [flows/](../04-integration/flows/) | Luồng end-to-end |

## Cấu trúc source

```
web/src/
├── App.tsx              Routes + providers
├── main.tsx             Entry
├── components/
│   ├── layout/          auth-layout, app-layout, protected-route
│   ├── shared/          quiz-generation-dialog, quiz-builder-dialog
│   └── ui/              16 shadcn primitives
├── features/            Role-based pages
├── hooks/             Shared React Query hooks
├── services/          Axios API clients
├── store/auth-store.ts  JWT auth state
├── types/index.ts       Shared DTOs
└── lib/                 utils, constants
```

## Known issues

[../99-known-issues/web-gaps.md](../99-known-issues/web-gaps.md)
