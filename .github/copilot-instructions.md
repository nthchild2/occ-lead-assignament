# GitHub Copilot Instructions

This is a React Native monorepo using Expo Router, Zustand, and TypeScript strict mode.

## Structure

- `packages/shared/` — Zod schemas shared between app and backend. Import types from `@occ/shared`.
- `app/core/` — reusable library: components, services, hooks, theme. Never imports from `app/app/`.
- `app/app/` — Expo Router file hierarchy. Mirrors screen nesting.
- `app/store/` — Zustand stores, one per domain.
- `backend/src/domains/` — self-contained domain modules (auth, jobs, applications).

## Rules

- No `any`. Use `z.infer<typeof Schema>` for API response types.
- No fetch or axios in components — use `core/services/`.
- No inline styles — use theme tokens from `core/theme/`.
- No cross-domain imports in the backend — services receive dependencies as parameters.
- Backend `*.service.ts` files must not import from Express.
- `core/` must not import from `app/`.
- Stores are in `store/` organized by domain. Only `auth.store` uses `persist`.

## API contract

```ts
// Success
{ data: T }

// Paginated success
{ data: { items: T[], pagination: { page, limit, total, hasNext, hasPrev } } }

// Error
{ error: { code: string, message: string } }
```

No `ok` field. HTTP status codes communicate transport-level success/failure.
