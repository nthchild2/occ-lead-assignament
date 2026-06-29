# CLAUDE.md

## Architecture

- Monorepo with pnpm workspaces: `app`, `backend`, `packages/shared`
- Frontend: `core/` (reusable internal library) + `app/` (Expo Router file-based hierarchy)
- Backend: Modular Monolith with Clean Architecture layers per domain
- Shared types: all API schemas live in `packages/shared` as Zod schemas — never duplicated

## Key conventions

- `core/` never imports from `app/` — enforced by ESLint
- Backend domain services never import Express — only routers do
- Backend domains never import from each other — use dependency injection
- Stores are organized by domain: `auth.store`, `jobs.store`, `applications.store`, `favorites.store`
- Only `auth.store` is persisted via AsyncStorage
- API response contract: `{ data }` for success, `{ error: { code, message } }` for errors — no `ok` field
- No `any` — use `z.infer<>` for all API response types
- No fetch or axios calls in components or stores — use `core/services/`
- No inline styles — all styles go through `core/theme/` tokens
- One component per file

## Commands

```bash
# Install all workspaces
pnpm install

# Start backend
cd backend && pnpm dev

# Start app
cd app && npx expo start

# Run all tests
pnpm test --recursive

# Type check all workspaces
pnpm typecheck --recursive

# Lint
pnpm lint

# Format
pnpm format
```

## Code ownership

Defined in `.github/CODEOWNERS`. Check it before modifying shared contracts, services, or auth. Changes to `packages/shared` and `app/core/services/` require lead review — they affect both app and backend.

## Branching

- New features: `feature/*` off `develop`
- Maintenance, deps, config: `chore/*` off `develop`
- Releases: `release/*` off `develop`
- Production patches: `hotfix/*` off `main`
- Never push directly to `main` or `develop`

## Docs

Architecture decisions are documented in `docs/`. Read them before making structural changes:

- `docs/A1 · Monorepo Architecture.md` — monorepo structure, backend architecture, API contract
- `docs/A2 · State & Data Strategy.md` — Zustand stores, pagination, swipe prefetch
- `docs/A3 · Navigation & Deep Linking.md` — Expo Router structure, deep linking, BottomSheetModal
- `docs/A4 · Quality Strategy.md` — testing strategy, branching, PR requirements, linting
- `docs/A5 · Performance.md` — FlashList optimizations, monitoring, analytics
