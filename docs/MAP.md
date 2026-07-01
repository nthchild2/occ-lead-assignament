# The Map · Codebase Navigation Index

This is the **static knowledge index** for the AIDLC framework (see [A6](<A6 · AI-Assisted Development Lifecycle.md>)). Its job is to keep agents on-rails: before building anything, an agent answers _"how is this done here?"_ from this file instead of guessing.

It is durable and hand-maintained — it changes when the architecture changes, not per feature. Per-feature navigation (which exact files a given change touches) is the job of the **research phase**, which _uses_ this map as its starting point.

> Conventions and the _why_ behind them live in `docs/A1`–`A6` and `.github/CLAUDE.md`. This map is the _where_. When they disagree, the architecture docs win and this map is stale — fix it.

---

## Entry points — where things live

| Area                     | Location                       | Notes                                                                                                               |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Shared API types/schemas | `packages/shared/src/schemas/` | Zod schemas, imported as `@occ/shared`. Single source of truth for API shapes — never duplicated in app or backend. |
| App reusable library     | `app/core/`                    | Components, hooks, theme, services, lib. Navigation-agnostic.                                                       |
| App screens / routing    | `app/app/`                     | Expo Router file-based hierarchy (not yet scaffolded).                                                              |
| App state                | `app/store/`                   | Zustand stores, one per domain.                                                                                     |
| Design tokens & theme    | `app/core/theme/`              | `tokens.ts` (raw values) → `theme.ts` (composed `Theme`).                                                           |
| Backend domains          | `backend/src/domains/`         | Self-contained modules (auth, jobs, applications) — not yet scaffolded.                                             |
| Backend shared libs      | `backend/src/lib/`             | `response.ts`, `logger.ts`.                                                                                         |
| Architecture docs        | `docs/A1`–`A6`                 | Read before structural changes.                                                                                     |

---

## "How do I…" — patterns to follow

Each entry names a concrete example to copy and the constraints that apply. Citations are `path:line` so they're verifiable.

### …build a UI component

- **Example to follow:** `app/core/components/Card.tsx` (simple), `app/core/components/Button.tsx` (stateful/animated).
- Consume design tokens via `useTheme()` — `app/core/hooks/useTheme.ts:5`. **No** inline color/size/spacing literals; pull from `theme.colors`, `theme.spacing`, `theme.type`, `theme.radii`, `theme.shadows`.
- One component per file. Export from `app/core/components/index.ts`.
- Keep cyclomatic complexity ≤ 10 (`.eslintrc.js`) — extract helpers/subcomponents rather than branching inline (see `Button.tsx` `variantColors` / `usePressAbsorb`).
- **`core/` importing `app/store/*` is allowed** (only `core/` → `app/app/` is eslint-restricted — see Guardrails). `core/lib/activityStatus.ts` does this cleanly. A component that's genuinely reusable belongs in `core/components/` even if it reads a store; only route-lifecycle-coupled components (e.g. a sheet driven by a layout's ref) belong route-adjacent under `app/app/`.
- Accessibility: interactive elements need `accessibilityRole` + label (A4 Decision 8).

### …add a design token

- Add the raw value in `app/core/theme/tokens.ts`, expose it through the `Theme` interface in `app/core/theme/theme.ts:13`. Consumers read it via `useTheme()` — never import `tokens.ts` directly from a component.

### …create a Zustand store

- **Example to follow:** `app/store/theme.store.ts`.
- One store per domain. Only `auth.store` is persisted (AsyncStorage); all others reset on launch (A2 Decision 1).
- Components call actions; they never read raw state-setters. No `fetch`/`axios` in stores — that belongs in `app/core/services/` (A2).

### …add or change an API type

- Edit the Zod schema in `packages/shared/src/schemas/`, re-export via `packages/shared/src/schemas/index.ts`. Both app and backend derive types with `z.infer<>` — no hand-written duplicate interfaces (A1 Decision 1). A breaking change here breaks both consumers' typecheck by design.

### …add a backend endpoint

- Lives under `backend/src/domains/<domain>/` as `*.router.ts` (HTTP), `*.service.ts` (logic), `*.schema.ts` (types). Services **must not** import Express — only routers do (A1 Decision 4). Domains **must not** import each other — use dependency injection (enforced by `.eslintrc.js` `import/no-restricted-paths`).
- Response envelope: `{ data }` on success, `{ error: { code, message } }` on failure. No `ok` field (A1 Decision 6). Use the helpers in `backend/src/lib/response.ts`.

### …write a test

- **App tests are co-located** (`*.test.ts(x)` next to the unit, e.g. `app/store/theme.store.test.ts`, `app/core/services/api.test.ts`). **Backend tests go under `backend/src/**/__tests__/*.test.ts`** — the backend jest config uses `testMatch: **/__tests__/**` and will _silently skip_ a co-located backend test.
- App uses `jest-expo`; backend uses `ts-jest`. `@occ/shared` is mapped in each package's jest config. Don't add a custom `transformIgnorePatterns` to the app — `jest-expo`'s default already handles pnpm (A6, learned the hard way).
- **For app-side unit tests, mock `global.fetch` or the service module — do NOT use msw.** msw v2's ESM-only deps fail to transform under `jest-expo` + pnpm's nested `node_modules`, and the only fix touches the shared jest config. Mocking `fetch`/services is lighter and idiomatic for unit tests anyway (see `app/core/services/api.test.ts`). msw stays available only if a genuine integration test needs network interception.

---

## Guardrails (the non-negotiables)

These are enforced by `.eslintrc.js` + `tsc` and will fail the verification gate:

- `core/` must not import from `app/` — `.eslintrc.js` `import/no-restricted-paths`.
- Backend domains must not import each other; services must not import Express.
- No `any` — use `z.infer<>` for API types (`.eslintrc.js`).
- No `fetch`/`axios` in components or stores — use `core/services/`.
- No inline styles — all styling through `core/theme/` tokens.
- No `console.*` in production code — use the backend `logger` (`backend/src/lib/logger.ts`).
- TypeScript strict mode, repo-wide (`tsconfig.base.json`).

---

## Maintenance

Update this map when: a new top-level area is added, a "how do I…" pattern changes, or a guardrail is added/removed. A map that's drifted from reality is worse than no map — it sends agents confidently to the wrong place. Keeping it current is part of the same change that alters the architecture (A6 Decision 4).
