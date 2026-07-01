# Research · app-api-client

- **Feature id:** `app-api-client`
- **Inputs read:** `00-spec.md`, `docs/MAP.md`, `docs/A1 · Monorepo Architecture.md`, `docs/A2 · State & Data Strategy.md`, `docs/work/ROADMAP.md`
- **Researcher:** researcher subagent (read-only)
- **Date:** 2026-07-01

## Relevant files

Existing files use `path:line`. The client itself and its test do not yet exist — named as bare paths.

| File (`path:line`)                                        | Why it matters to this feature                                                                                                                                                | R-ids  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `app/core/services/api.ts` (new)                          | The module to build. `services/` dir does not exist yet under `app/core/` — must be created here per A1:31.                                                                   | R1–R6  |
| `app/core/services/api.test.ts` (new)                     | Co-located unit test using `msw`. App tests co-locate as `*.test.ts` next to the unit (see `theme.store.test.ts`).                                                            | R7     |
| `packages/shared/src/schemas/auth.schema.ts:13-22`        | `LoginResponseSchema` (`{ data: { token, user } }`) and `MeResponseSchema` (`{ data: User }`) — response schemas the client parses.                                           | R4     |
| `packages/shared/src/schemas/job.schema.ts:35-44`         | `JobListResponseSchema` (`{ data: { items, pagination } }`) and `JobDetailResponseSchema` (`{ data: Job }`).                                                                  | R4     |
| `packages/shared/src/schemas/application.schema.ts:10-20` | `ApplicationListResponseSchema` and `FavoriteListResponseSchema` (both `{ data: { items } }`).                                                                                | R4     |
| `packages/shared/src/schemas/application.schema.ts:22-27` | `ApiErrorSchema` = `{ error: { code, message } }` — the error envelope the client parses into a thrown typed error.                                                           | R5     |
| `packages/shared/src/schemas/application.schema.ts:32`    | `ApiError` type (`z.infer<typeof ApiErrorSchema>`) — the type callers catch. This is what `@occ/shared` exposes; the client must not hand-write it.                           | R5     |
| `packages/shared/src/index.ts:1`                          | Root barrel `export * from './schemas'` — the client imports every schema from `@occ/shared`, never from a deep path.                                                         | R4, R5 |
| `packages/shared/src/schemas/index.ts:1-3`                | Schema sub-barrel that the root index re-exports; confirms all seven schemas reach `@occ/shared`.                                                                             | R4, R5 |
| `app/package.json:37`                                     | `zod ^3.24.0` available in the app for `.parse()` at the boundary.                                                                                                            | R4     |
| `app/package.json:27`                                     | `expo-constants ~18.0.0` present as a dep (not yet used anywhere) — one candidate mechanism for R2 (extra config).                                                            | R2     |
| `app/package.json:58`                                     | `msw ^2.2.0` (devDep) — the mandated test double for the network layer.                                                                                                       | R7     |
| `app/package.json:40-48`                                  | App jest config: `preset: jest-expo`, `moduleNameMapper` maps `@occ/shared` → shared `src/index.ts`; **no `roots`/`testMatch`** so co-located `*.test.ts` is auto-picked.     | R7     |
| `app/package.json:51-52`                                  | `@testing-library/jest-native` + `@testing-library/react-native` available (setup extends jest-native matchers).                                                              | R7     |
| `app/app.json:2-28`                                       | Current Expo config: **no `extra` block, no `plugins` env entry**. Nothing wires a base URL today — R2 mechanism must be added here (or via `app.config` + EXPO_PUBLIC).      | R2     |
| `app/babel.config.js:4`                                   | `babel-preset-expo` is the preset — this is what inlines `EXPO_PUBLIC_*` vars into the bundle at build time (the SDK-54 idiom for R2).                                        | R2     |
| `.env.example:8-9`                                        | Already documents `API_BASE_URL=http://localhost:3000` "place in app/.env". **Name lacks the `EXPO_PUBLIC_` prefix** — see Risks; the doc target for R2 exists here.          | R2     |
| `app/tsconfig.json:10-12`                                 | Path alias `@occ/shared` → shared `src/index.ts`; the client's schema imports resolve through this.                                                                           | R4, R5 |
| `app/store/theme.store.ts:22-30`                          | Module-singleton pattern (`create(...)` at module scope, mutable via actions) — the shape to mirror for a `configureApi(...)` singleton holding `getToken`/`onUnauthorized`.  | R3, R6 |
| `app/store/theme.store.test.ts:1-15`                      | Co-located test example: imports the unit from `./`, drives it via exported API. Template for `api.test.ts` structure.                                                        | R7     |
| `docs/A2 · State & Data Strategy.md:140-172`              | Decision 3: describes the 401 interceptor clearing `auth.store` + redirect, and the token being read from `auth.store`. Spec inverts this via injection — see Risks.          | R3, R6 |
| `docs/A1 · Monorepo Architecture.md:211-234`              | Response envelope: `{ data }` on success, `{ error: { code, message } }` on failure, no `ok` field. Defines what the client parses and maps.                                  | R4, R5 |
| `docs/work/ROADMAP.md:42`                                 | Epic B ticket row: names `core/services/api.ts`, "base URL from env (`expo-constants`)", JWT injection, 401 handling, Zod parse, error → `ApiError`. Suggests expo-constants. | R1–R6  |

## Existing patterns to follow

- **Where the module lives** → `app/core/services/api.ts`. The `services/` dir is not yet created; A1 reserves it for "api.ts and domain services" (`docs/A1 · Monorepo Architecture.md:31`). `core/` is navigation-agnostic and must not import from `app/` (`.eslintrc.js:33`) — reinforces the spec's injection design (the client imports nothing from `store/`).
- **Module-singleton with injected config** → mirror the module-scope singleton of `app/store/theme.store.ts:22-30`: hold `getToken`/`onUnauthorized` in module state, mutate through an exported `configureApi(...)` (analogous to `setPreference`). No new store — this is a plain service module.
- **Typed data via `z.infer<>`, parsed at the boundary** → every response schema in `@occ/shared` already exports its type (e.g. `packages/shared/src/schemas/application.schema.ts:29-32`). Request helpers take a schema and return `z.infer<typeof schema>`; parse with `schema.parse(body)`. Never hand-write response interfaces (A1 Decision 1, via MAP `docs/MAP.md:50`).
- **Import schemas from the barrel** → `import { ApiErrorSchema, ... } from '@occ/shared'` (`packages/shared/src/index.ts:1`), never a deep `schemas/...` path.
- **Co-located test with msw** → put `api.test.ts` beside `api.ts` (pattern: `app/store/theme.store.test.ts:1`); the app jest preset auto-discovers it (`app/package.json:40-48`). Assert: JWT injected on authed request, success parsed/typed, error envelope → thrown `ApiError`, 401 → `onUnauthorized` fired (R7).
- **Env for the base URL (R2)** → the SDK-54 idiom with the current setup is an `EXPO_PUBLIC_`-prefixed var read via `process.env`, inlined by `babel-preset-expo` (`app/babel.config.js:4`). The alternative is `expo-constants` `extra` (dep at `app/package.json:27`, suggested by `docs/work/ROADMAP.md:42`), which requires adding an `extra` block to `app/app.json` (absent today, `app/app.json:2-28`) — typically via an `app.config.*` to read the env at build time. Either satisfies R2; see Risks for the concrete blocker with the current `.env.example` name.

## Constraints that apply

- `core/` must not import from `app/` — `.eslintrc.js:33` (rationale: navigation-agnostic core; A1 Decision 2). The client must not import `store/` or navigation — hence `configureApi` injection.
- No `fetch`/`axios` in components or stores; network belongs in `core/services/` — `docs/MAP.md:71`. This client IS that boundary.
- No `any`; API types via `z.infer<>` — `.eslintrc.js:13` and `docs/MAP.md:70`. Success returns typed data, never `any` (R4).
- No non-null assertions — `.eslintrc.js:14`. Guard `getToken()`/config being unset rather than `!`.
- Cyclomatic complexity ≤ 10 per function — `.eslintrc.js:26`. Extract per-method helpers (request/parse/error-map) rather than one branching function.
- No `console.*` in production code — `.eslintrc.js:18`. Surface failures as thrown `ApiError`/typed errors, not logs.
- `consistent-type-imports` (`type` imports) — `.eslintrc.js:15`. Import types (`ApiError`, response types) with `import type`.
- TypeScript strict repo-wide — `tsconfig.base.json` via `app/tsconfig.json:2`.
- Response envelope is fixed: `{ data }` success / `{ error: { code, message } }` failure, no `ok` field — `docs/A1 · Monorepo Architecture.md:211-234`. The client keys off HTTP status + this envelope.
- Do **not** add a custom `transformIgnorePatterns` to the app jest config — jest-expo's default handles pnpm — `docs/MAP.md:60`.

## What NOT to touch

- `packages/shared/src/schemas/**` — the seven response schemas and `ApiError` are the source of truth and already correct; the client consumes them read-only. Editing them belongs to the schema/backend tickets.
- `app/store/**` (esp. a future `auth.store`) — out of scope per spec; the client only defines the injection points. Do not import from `store/`.
- Domain service modules (`jobs.service`, `auth.service`, etc.) — belong to their own tickets, built on top of this client (spec "Out of scope").
- Navigation / redirect implementation — `onUnauthorized` is injected; the nav shell wires the actual redirect (spec "Out of scope").
- `app/package.json` jest block — the mapper + preset already work; no changes needed for co-located tests.

## Risks & unknowns

- **R2 env name mismatch (needs a plan decision, non-blocking).** `.env.example:9` documents `API_BASE_URL` (no prefix) for `app/.env`. Under Expo SDK 54, only `EXPO_PUBLIC_*` vars are inlined into the bundle by `babel-preset-expo` (`app/babel.config.js:4`); a bare `API_BASE_URL` in `app/.env` will **not** be visible at runtime via `process.env`. ROADMAP (`docs/work/ROADMAP.md:42`) instead suggests `expo-constants` extra, but `app/app.json` has no `extra` block (`app/app.json:2-28`). The plan must pick one coherent path and align the docs:
  - (a) rename to `EXPO_PUBLIC_API_BASE_URL`, read `process.env.EXPO_PUBLIC_API_BASE_URL`, and update `.env.example`; or
  - (b) add an `extra` block (likely via `app.config.ts`) sourcing the env var and read it through `expo-constants`.
    Both satisfy R2 (no hardcoded URL, documented). Recommendation for the planner: option (a) is the lower-friction SDK-54 idiom given the current single flat `app.json` and unused-but-available `expo-constants`; either is acceptable. This is a design choice, **not** a blocking ambiguity — the spec (00-spec:35) pre-authorizes research to pick.
- **A2 vs spec divergence (already resolved by spec; note for the planner).** A2 Decision 3 (`docs/A2 · State & Data Strategy.md:89,170`) describes `api.ts` reading the token from and clearing `auth.store` directly. The spec (`00-spec.md:10,36`) overrides this with dependency inversion (`configureApi({ getToken, onUnauthorized })`) to avoid the circular dep. Follow the spec; A2's direct-import wording is stale for this concern.
- **msw / node_modules not installed in this sandbox.** Dependency availability is asserted from `app/package.json` (`msw`, `@testing-library/*`, `zod`, `expo-constants` all declared) rather than a resolved install. If tests fail to run, verify install before assuming a code defect.
- **msw environment under jest-expo.** msw v2 in a jsdom/react-native jest env may need a `fetch`/`Response` polyfill or the node request interceptor; the exact wiring is an implementation detail for the plan/test step, not a spec ambiguity.

## Handoff to PLAN

- Build **`app/core/services/api.ts`** (dir is new) as a plain service module — module-singleton config à la `app/store/theme.store.ts:22-30`, exported `configureApi({ getToken, onUnauthorized })`; imports nothing from `store/` or `app/` (`.eslintrc.js:33`).
- Request helpers (`get`/`post`/`delete`, optionally `put`/`patch`) take a response schema from `@occ/shared` (`packages/shared/src/index.ts:1`) and return `z.infer<>`-typed data; parse on success, no `any` (R1, R4).
- On non-2xx: parse body with `ApiErrorSchema` (`packages/shared/src/schemas/application.schema.ts:22`) and throw the typed `ApiError`; on 401 additionally fire the injected `onUnauthorized`, then still reject (R5, R6). Envelope shapes fixed by `docs/A1 · Monorepo Architecture.md:211-234`.
- **Resolve R2 base-URL mechanism first** (Risks item 1): pick `EXPO_PUBLIC_API_BASE_URL` via `process.env` (recommended, `app/babel.config.js:4`) or `expo-constants` extra via an `app.config` (`docs/work/ROADMAP.md:42`); update `.env.example:9` accordingly. No literal URL in source.
- Add co-located **`app/core/services/api.test.ts`** with `msw` (`app/package.json:58`), auto-discovered by the app preset (`app/package.json:40-48`); cover JWT injection, success parse/type, error-envelope→`ApiError`, 401→`onUnauthorized` (R7).
- Keep it a navigation document's worth of scope: touch only `services/` (+ the chosen env config/`.env.example`); do not edit schemas, stores, or add domain services.
