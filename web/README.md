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

- `src/features/` — pages by role (student, teacher, admin)
- `src/services/` — API clients
- `src/hooks/` — shared React Query hooks
- `src/components/` — layout and UI primitives

See [docs/01-web/](../docs/01-web/README.md) for routing and architecture.
