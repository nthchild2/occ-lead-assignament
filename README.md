# occ-lead-ejercicio

Technical exercise for the Developer Lead Sr. — React Native position at OCC · Redarbor México.

_[Léelo en español](README.es.md)_

## What this repo is, and how it was built

The brief (`docs/ejercicio_tecnico_lead_rn_occ.pdf`) asks for a job-search app: login, search/filter/sort, job detail with swipe, apply/favorite, an activities screen, and local push notifications. Building those screens was never the hard part of this exercise. What a Lead is actually being evaluated on is the decisions _around_ the code: how the codebase is organized, what conventions a team of engineers would be expected to follow, and how those conventions survive contact with new features and new contributors — including AI contributors, since that's how a large part of this repo was actually written.

So the priority here was inverted from "ship the screens" to "make the architecture and the process legible first, then ship the screens against it." Concretely:

1. **Architecture before code.** `docs/A1`–`A5` (monorepo layout, state/data strategy, navigation, quality bar, performance) were written _before_ any feature code, not reverse-engineered afterwards. `CLAUDE.md` and `.github/copilot-instructions.md` tell any AI tool to read them before touching structure, so the docs are load-bearing, not decorative.
2. **A repeatable process for the rest of the build**, described below as AIDLC, so that every feature — whether implemented by me or by an agent — goes through the same spec → research → plan → implement → verify pipeline, leaving an auditable trail per feature under `docs/work/`.
3. **A design system**, described below, so the UI isn't ad-hoc styling per screen but pulls from one token source.

This project was built in cooperation with Claude Code, but every architectural and process decision was made by me, a human. The content of `docs/A1`–`A6` was arrived at through discussion with Claude — I made the calls, Claude helped surface tradeoffs and write them down — and the majority of the feature implementation, following that pre-agreed architecture, was done by AI agents under the process in `docs/A6`, with me reviewing every change.

### The design system

`app/core/theme/` is the single source of visual truth. `tokens.ts` holds raw values — a literal color palette, spacing scale, typography, radii, shadows, motion durations — for both light and dark schemes. `theme.ts` composes those raw tokens into a `Theme` interface that components consume via `useTheme()`. Components never hardcode a color, a spacing value, or a font size; they read `theme.colors.fg`, `theme.spacing[3]`, `theme.type.headingSm`, and so on. This is enforced, not just conventional — `.eslintrc.js` blocks inline style literals and `import/no-restricted-paths` stops a component from reaching into `tokens.ts` directly and bypassing the semantic layer.

The practical payoff: switching from light to dark mode, or re-skinning the whole app, is a change in one file (`tokens.ts`), not a grep-and-replace across every screen. `app/core/components/` (`Button`, `Card`, `Input`, `Select`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, …) is the resulting component library, each one theme-driven and reusable across screens.

### AIDLC — the process behind the code

AIDLC (AI-Assisted Development Lifecycle) is the framework this repo's features were actually built under — documented in full in [`docs/A6 · AI-Assisted Development Lifecycle.md`](<docs/A6 · AI-Assisted Development Lifecycle.md>). The short version:

- **The problem it solves:** a single AI agent given an entire feature and told "go" tends to lose track of scope, re-decide settled architecture, or produce code that "looks right" without anyone checking it against a requirement. That's the vibe-coding failure mode — fast, but unauditable.
- **The fix:** split the work into phases, each run by a fresh agent that only reads its own inputs and produces exactly one handoff document, then exits:

  ```
  0. SPEC      → requirements ledger (R1, R2, …), human-approved
  1. RESEARCH  → file map + constraints, every claim cited to path:line
  2. PLAN      → change list, each item citing an R-id          ◀ key human gate
  3. IMPLEMENT → code + a report tracing every change to an R-id
  4. VERIFY    → coverage matrix (every requirement met, nothing extra) + tsc/eslint/jest
  ```

- **Traceability is mechanical, not aspirational.** Every requirement must map to a change, and every change must map to a requirement — a requirement with no change is a gap, a change with no requirement is scope creep, and both fail the verification phase. Every one of the 15 feature tickets in `docs/work/ROADMAP.md` has its own `docs/work/<feature>/00-spec.md` through `04-verify.md`, forming a committed, auditable trail of what was built, why, and how it was checked.
- **The verification gate is non-negotiable.** No ticket is marked done without `tsc --noEmit`, `eslint`, and `jest` passing for every workspace it touched. This caught real bugs during the build (see A6, Decision 3, for the actual list) — including bugs that predated any AI-authored change.
- **One known gap, documented honestly:** that gate is `tsc`+`eslint`+`jest`, none of which actually launch the app. A couple of config-level bugs (a broken Expo plugin entry, a missing dev-only logging dependency) only surfaced when the app was run for real after all 15 tickets had independently passed. That's written up in [`docs/work/push-notifications/05-post-verify-fix.md`](docs/work/push-notifications/05-post-verify-fix.md) as a correction to the record, not swept under the rug.

`.claude/agents/` holds one subagent per phase (researcher, planner, implementer, verifier); `.claude/commands/` holds the orchestrator (`/aidlc-run`) and per-phase commands for manual takeover. The pipeline runs at a configurable "gate policy" — full-control (human approves every phase), balanced (checkpoint only at PLAN), or full-auto — but two hard stops apply regardless of mode: ambiguity always escalates to a human instead of being guessed, and a failed verification always loops back instead of being marked done.

## Architecture — the decisions, one doc at a time

Five documents (`docs/A1`–`A5`) hold the actual reasoning — context, decision, alternatives considered, code — behind everything below. This section is the throughline connecting them; treat it as a map of the _why_, not a replacement for reading the docs themselves when you need the detail.

### [A1 · Monorepo Architecture](<docs/A1 · Monorepo Architecture.md>)

Three pnpm workspaces — `app`, `backend`, `packages/shared` — with `@occ/shared`'s Zod schemas as the one intentional coupling point: a schema change breaks the build of any consumer that doesn't adapt, so the compiler is the contract, not a changelog. Inside the frontend, `core/` (navigation-agnostic, reusable) and `app/` (the Expo Router hierarchy) have a one-way dependency rule enforced by ESLint (`import/no-restricted-paths`), not just convention. The backend is a **Modular Monolith**: each domain (`auth`, `jobs`, `applications`) is self-contained, and inside each domain, Clean Architecture layers separate the HTTP contract (`*.router.ts`) from business logic (`*.service.ts`, which never imports Express) from types (`*.schema.ts`) — so migrating frameworks or extracting a domain into its own service later is a transport-layer change, not a rewrite. The server also picks up the zero-cost parts of 12-Factor (env config, a `/health` endpoint, structured `pino` logging, graceful `SIGTERM` shutdown) with one documented exception: the in-memory JWT blacklist isn't stateless-safe across multiple instances — flagged as conscious technical debt, not hidden. Finally, A1 is where the no-`ok` API envelope decision lives (see [below](#api-response-envelope-no-ok-field)).

### [A2 · State & Data Strategy](<docs/A2 · State & Data Strategy.md>)

One Zustand store per domain (`auth`, `jobs`, `applications`, `favorites`); only `auth.store` persists, via AsyncStorage — everything else resets on launch. Session validity isn't assumed from a stored token: on app start, `GET /auth/me` confirms it before any protected screen renders, and a 401 interceptor in `core/services/api.ts` handles mid-session expiry the same way, without every hook needing its own auth-failure branch. Pagination state and the debounced filters both live in `jobs.store`; any filter or sort change resets the list and refetches page 1. The one genuinely tricky piece is the **swipe prefetch**: reaching 3 jobs from the end of the loaded page silently triggers the next fetch in the background — no loading state, no interruption — and a failed fetch degrades to a quiet end-of-results indicator instead of an error screen.

### [A3 · Navigation & Deep Linking](<docs/A3 · Navigation & Deep Linking.md>)

The route tree is a straightforward Expo Router `(auth)`/`(protected)` split, each with its own guard-by-redirect layout. The one deliberately unconventional call: the Job Detail `BottomSheetModal` is **not** a route. It's owned by `(protected)/_layout.tsx` and opened imperatively — any part of the app (a card tap, a notification tap, a deep link) just sets `activeJobId` in `jobs.store`, and the layout reacts to that value. This keeps opening/closing the sheet from ever touching the route stack or the active tab, which matters for two concrete requirements: closing the sheet must not reset the list's scroll position, and a notification tap must open the sheet over _whatever_ tab is currently active, not force a tab switch. The other real subtlety is the **quit-state race**: if the app cold-starts from a killed state via a notification tap, the target job id is held in a module-level ref until session hydration (`GET /auth/me`) actually resolves — otherwise the sheet could open, and an Apply/Favorite action inside it could fire, before the session is confirmed valid.

### [A4 · Quality Strategy](<docs/A4 · Quality Strategy.md>)

Testing is layered on purpose — schemas, services, stores, hooks, components, and screens each get a different tool for a different failure mode (Jest for logic, `msw` for the network boundary, React Native Testing Library for interaction/a11y queries, `supertest` for backend routers). Snapshots are deliberately not automatic: they're added only when a screen is considered _done_, reviewed as part of that PR's diff, and a blind `--updateSnapshot` without reviewing what changed is a checklist violation. Branching follows Gitflow (`main`/`develop`/`feature`/`release`/`hotfix`) mapped onto three EAS build profiles (`development`/`preview`/`production`), with `main` merges gated behind both QA and lead sign-off via CODEOWNERS — the production build and store submission are always manual, never automatic on merge. Husky enforces the cheap stuff locally (lint, format, typecheck on commit; the full test suite on push) so CI is never the first place a mistake surfaces. Accessibility isn't a checklist item bolted on at the end — WCAG 2.1 AA is enforced structurally, since every color in the app comes from theme tokens chosen for contrast, `eslint-plugin-react-native-a11y` catches missing labels/roles at commit time, and RNTL's role/label-based queries make an inaccessible component fail its own test before it fails an audit.

### [A5 · Performance](<docs/A5 · Performance.md>)

Sentry owns crash/error monitoring; Firebase Performance owns runtime metrics that matter in production but are invisible in development — cold start time, time-to-first-job-card, API P50/P90/P99. The job list (the highest-traffic screen) gets six concrete FlashList tunings: a measured `estimatedItemSize` instead of letting FlashList measure every item, memoized cards keyed by immutable job `id`, `getItemType` so variable-height cards (with/without salary) don't cause layout jumps on recycle, and a reduced `drawDistance` to cut initial render cost. The swipe prefetch from A2 gets its performance guarantee here: `InteractionManager.runAfterInteractions` defers the fetch until the UI-thread swipe animation (driven by Reanimated, never touching the JS thread) has actually settled, so a background network call can never compete with 60fps gesture handling for JS-thread time. Analytics infrastructure (Firebase Analytics) is provided but explicitly gated behind consent — collection is off by default and only enabled after opt-in, since retrofitting consent into an already-collecting SDK is expensive and this is meant to be correct from day one, not patched later.

Spanish translations of A1–A6 are available alongside the English originals (e.g. `docs/A1 · Arquitectura del Monorepo.md`).

## Setup

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+ — this repo uses **pnpm workspaces** (`workspace:*` protocol). `npm install` will fail with `EUNSUPPORTEDPROTOCOL`; use pnpm.
- Expo CLI is not a separate global install — it's invoked via `pnpm exec expo` from `app/`.

### Install

```bash
# From the repo root — installs all four workspaces (app, backend, packages/shared, root tooling)
pnpm install
```

### Environment variables

The root `.env.example` documents both the backend's and the app's variables, but it's reference-only — neither process actually loads a root-level `.env`. Each workspace needs its own file:

```bash
# Backend — reads backend/.env
cat > backend/.env <<'EOF'
PORT=3000
NODE_ENV=development
JWT_SECRET=local-dev-secret-change-me
JWT_EXPIRES_IN=1h
LOG_LEVEL=info
EOF

# App — reads app/.env (only EXPO_PUBLIC_-prefixed vars are exposed to the client)
cat > app/.env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EOF
```

Both files are gitignored; the values above are safe local-dev defaults, not secrets.

### Run the backend

```bash
cd backend
pnpm dev
# Server running at http://localhost:3000
```

### Run the app

```bash
cd app
pnpm exec expo start -c
```

The backend must be running first — the app resolves the API through `EXPO_PUBLIC_API_BASE_URL`, which points at `http://localhost:3000` above. `-c` clears Metro's cache; drop it for a faster subsequent start once things are stable.

**Must run from `app/`, not the repo root.** `expo` is only a dependency of the `app` workspace. Running `pnpm exec expo start` from the repo root fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL — Command "expo" not found`, because pnpm treats a root-level `exec` as recursive across every workspace and fails on the first one without `expo` installed. If you don't want to `cd`, run `pnpm --filter ./app exec expo start -c` from the root instead.

### Run tests

```bash
# From root — runs both app and backend workspaces
pnpm test
```

### Type check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

---

## Key decisions, at a glance

- **Monorepo**: pnpm workspaces with three packages — `app`, `backend`, `packages/shared`
- **Shared types**: Zod schemas in `packages/shared` consumed by both app and backend
- **API contract**: `{ data }` for success, `{ error: { code, message } }` for errors — no `ok` field, aligned with Google Cloud API Design Guide
- **State**: Zustand for all state, one store per domain
- **Backend**: Modular Monolith with Clean Architecture layers per domain
- **Frontend**: `core/` (reusable library) + `app/` (Expo Router hierarchy)

## API response envelope (no `ok` field)

The exercise brief proposes an `{ ok, data, error }` envelope. We deliberately
drop the `ok` field and use `{ data }` on success and `{ error: { code, message } }`
on failure. This is a reasoned decision, not an oversight.

The `ok` flag is redundant with the HTTP status code, which already communicates
success or failure at the transport level. Keeping both invites contradictions —
if `ok: true` arrives with a `500` status, which does the client trust? Following
the Google Cloud API Design Guide, we separate the two concerns:

- **Transport errors** (`404 Not Found`, `500 Internal Server Error`) → the HTTP
  status code is the right mechanism.
- **Domain errors** (`ALREADY_APPLIED`, `VALIDATION_ERROR`) → the status code alone
  is insufficient, so the `error.code` field carries the domain semantics. Clients
  branch on `error.code`, never on message strings (which can change).

Removing `ok` leaves one source of truth per concern and avoids subtle client bugs.
Full rationale and alternatives considered (RFC 9457 Problem Details, keeping `ok`)
are documented in `docs/A1 · Monorepo Architecture.md` Decision 6.

## Credentials (mock)

```
email: test@occ.com.mx
password: Test1234
```
