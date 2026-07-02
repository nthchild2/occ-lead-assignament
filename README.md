# occ-lead-ejercicio

Technical exercise for the Developer Lead Sr. — React Native position at OCC · Redarbor México.

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
pnpm exec expo start
```

The backend must be running first — the app resolves the API through `EXPO_PUBLIC_API_BASE_URL`, which points at `http://localhost:3000` above.

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

## Architecture

See `docs/` for full architecture documentation:

- [A1 · Monorepo Architecture](<docs/A1 · Monorepo Architecture.md>)
- [A2 · State & Data Strategy](<docs/A2 · State & Data Strategy.md>)
- [A3 · Navigation & Deep Linking](<docs/A3 · Navigation & Deep Linking.md>)
- [A4 · Quality Strategy](<docs/A4 · Quality Strategy.md>)
- [A5 · Performance](<docs/A5 · Performance.md>)
- [A6 · AI-Assisted Development Lifecycle](<docs/A6 · AI-Assisted Development Lifecycle.md>)

Spanish translations of each are available alongside the English originals (e.g. `docs/A1 · Arquitectura del Monorepo.md`).

## Key decisions

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
