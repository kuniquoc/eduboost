# EduBoost Web

React 19 + TypeScript frontend for EduBoost.

## Stack

- Vite, React Router v7, TanStack Query, Zustand
- shadcn/ui + Tailwind CSS v4
- API base URL: `VITE_API_URL` (default `http://localhost:5000/api`)

## Development

```bash
npm install
npm run dev
```

App runs at http://localhost:5173

## Structure

- `src/app/` — router, providers and layouts
- `src/features/<domain>/` — API, hooks, types, components, pages and tests
- `src/shared/` — API client, UI primitives and cross-domain utilities

See [docs/01-web/](../docs/01-web/README.md) for routing and architecture.
