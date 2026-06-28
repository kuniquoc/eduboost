# Web Frontend Documentation

React 19 SPA tại [`web/`](../../web/).

## Mục lục

| Doc | Nội dung |
|-----|----------|
| [architecture.md](architecture.md) | Router, QueryClient, auth, proxy |
| [routing.md](routing.md) | Toàn bộ routes từ App.tsx |
| [store-and-types.md](store-and-types.md) | Zustand + TypeScript DTOs |
| [services/](services/) | 14 API service modules |
| [hooks/](../../web/src/features/) | 23 shared React Query hooks |
| [features/](features/) | 25 trang/tính năng UI |
| [components/](components/) | Layout, shared, UI primitives |
| [flows/](../04-integration/flows/) | Luồng end-to-end |

## Cấu trúc source

```
web/src/
├── app/                  Router, providers và layouts
├── features/<domain>/    API, hooks, types, components, pages và tests
├── shared/
│   ├── api/              Axios client dùng chung
│   ├── ui/               shadcn primitives
│   ├── lib/              Tiện ích đa domain
│   └── types/            Contract thực sự dùng chung
├── main.tsx              Entry
└── index.css
```

## Known issues

[../99-known-issues/web-gaps.md](../99-known-issues/web-gaps.md)
