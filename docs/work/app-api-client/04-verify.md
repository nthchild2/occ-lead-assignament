# Verification Report · app-api-client

- **Feature id:** `app-api-client`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `03-impl-report.md`, `01-research.md`
- **Verifier:** verifier subagent (Claude, fresh context)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

Cross-referenced the ledger (`00-spec.md`) against the impl-report changes, then read `app/core/services/api.ts` + `app/core/services/api.test.ts` to confirm each change is real (not just claimed).

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                 |
| ---- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `get`/`post`/`put`/`patch`/`del` exported (`api.ts:110-151`), each `<T extends ZodType>(path, schema, ...)` returning `Promise<z.infer<T>>`. Single module surface.                                   |
| R2   | must     | ✅          | `resolveBaseUrl()` reads `process.env.EXPO_PUBLIC_API_BASE_URL`, throws typed `ApiConfigError` if unset (`api.ts:55-61`); no literal URL in source. `.env.example:9` renamed to the prefixed var.     |
| R3   | must     | ✅          | `buildHeaders(auth)` injects `Authorization: Bearer <token>` only when `config.getToken()` yields a token (`api.ts:63-74`); token source injected via `configureApi` (`api.ts:17-20`).                |
| R4   | must     | ✅          | On 2xx, `schema.parse(await response.json())` returns `z.infer<T>` (`api.ts:103`); mismatch throws `ZodError`, never `any`.                                                                           |
| R5   | must     | ✅          | `mapError(status, body)` validates the envelope via shared `ApiErrorSchema` and returns a throwable `ApiError` class carrying `code`/`message` (`api.ts:28-51`); thrown on non-2xx (`api.ts:99-100`). |
| R6   | must     | ✅          | On HTTP 401, `config.onUnauthorized?.()` fires, then the mapped `ApiError` is thrown so the caller cannot proceed (`api.ts:94-97`); handler injected via `configureApi`.                              |
| R7   | must     | ✅          | `api.test.ts` — 6 tests, all green, asserting the four required behaviors (see §3 + Findings for the msw→fetch-mock deviation and the non-vacuity check).                                             |

- [x] **No gaps** — every `must` requirement (R1–R7) has ≥1 real change confirmed in source.
- [x] **No orphans** — every change in the impl-report traces to ≥1 R-id. The only symbol not named in the plan, the private `ApiConfigError` class (`api.ts:38-43`), is an in-scope implementation detail of R2 step 3 (typed "env unset" throw), not new scope.
- [x] **Out-of-scope items NOT implemented** — verified `api.ts` imports nothing from `store/`, `app/`, or navigation (only `@occ/shared` + `zod`). No `auth.store`/session state, no domain service modules (`jobs.service`/`auth.service`), no redirect/nav wiring. `onUnauthorized`/`getToken` are injection points only.

## 2 · Citation spot-check

Sampled citations from `01-research.md` / `02-plan.md`, opened each cited `path:line`, and confirmed relevance (not just existence).

| Cited claim                                                                                                  | `path:line`                                               | Holds up?                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ApiErrorSchema` = `{ error: { code, message } }` — the envelope the client parses into a thrown error       | `packages/shared/src/schemas/application.schema.ts:22-27` | ✅ Exact match.                                                                                  |
| `ApiError` type is `z.infer<typeof ApiErrorSchema>` — the plain (non-throwable) envelope type                | `packages/shared/src/schemas/application.schema.ts:32`    | ✅ Confirmed; grounds the plan's "define a throwable class" decision.                            |
| `MeResponseSchema` (`{ data: User }`) — a real `@occ/shared` schema the test parses                          | `packages/shared/src/schemas/auth.schema.ts:20-22`        | ✅ `MeResponseSchema = z.object({ data: UserSchema })`; used in `api.test.ts:1,45`.              |
| Root barrel re-exports all schemas; client imports from `@occ/shared`, never a deep path                     | `packages/shared/src/index.ts:1`                          | ✅ `export * from './schemas'`; `api.ts:1` imports `ApiErrorSchema` from `@occ/shared`.          |
| Module-singleton-with-setter pattern to mirror for `configureApi`                                            | `app/store/theme.store.ts:22-30`                          | ✅ `create(...)` at module scope, mutated via `setPreference`; `configureApi` mirrors the shape. |
| `babel-preset-expo` inlines `EXPO_PUBLIC_*` vars (SDK-54 idiom for R2)                                       | `app/babel.config.js:4`                                   | ✅ `presets: ['babel-preset-expo']`; justifies the `EXPO_PUBLIC_API_BASE_URL` choice.            |
| App jest config: `preset: jest-expo`, maps `@occ/shared`, no `roots`/`testMatch` (co-located auto-discovery) | `app/package.json:40-48`                                  | ✅ Confirmed; co-located `api.test.ts` was auto-discovered and ran.                              |
| `.env.example` documents the app base URL var to rename for R2                                               | `.env.example:8-9`                                        | ✅ Now `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` with the "place in app/.env" comment.    |

All sampled citations hold up on relevance, not just existence.

## 3 · Tooling gate

Only the `app` workspace holds code (per the impl-report handoff; `.env.example` is config-only). `backend` was not touched, so its typecheck is not part of this gate.

| Check           | Command                                   | Result                           |
| --------------- | ----------------------------------------- | -------------------------------- |
| Types (app)     | `pnpm --filter './app' run typecheck`     | ✅ PASS (exit 0, no diagnostics) |
| Types (backend) | `pnpm --filter './backend' run typecheck` | n/a — backend untouched          |
| Lint            | `pnpm lint`                               | ✅ PASS (exit 0, 0 errors)       |
| Tests           | `pnpm --filter './app' run test`          | ✅ PASS (8/8: 6 api + 2 theme)   |

Test output:

```
PASS store/theme.store.test.ts
PASS core/services/api.test.ts
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

Lint: 5 warnings remain, all pre-existing and in `backend/` (`security/detect-object-injection` in `errors.ts`, `validation.middleware.ts`, and a backend test). Zero problems on the feature files `app/core/services/api.ts` and `app/core/services/api.test.ts`. Exit code 0.

### R7 non-vacuity check (mutation test)

Because R7 was delivered via a `global.fetch` mock rather than msw, I confirmed the test genuinely exercises the client rather than passing vacuously. Temporarily removed the `config.onUnauthorized?.()` call from the 401 branch (`api.ts:95`) and re-ran:

```
> expect(onUnauthorized).toHaveBeenCalledTimes(1)
                         ^
Test Suites: 1 failed, 1 passed
Tests:       1 failed, 7 passed
```

The R6 test failed exactly as it should, proving the assertion bites. Reverted the mutation immediately; `git diff` shows no change to `api.ts` and the suite is green again (8/8). No source code was left modified — working tree is clean.

The six tests assert all four R7 behaviors against real `@occ/shared` schemas:

- **JWT injected (R3)** — `Authorization: Bearer tok` captured from the mocked `fetch` init; plus a negative case asserting the header is absent when `getToken` returns `undefined`.
- **Success parsed/typed (R4)** — a valid `{ data: ... }` body is `MeResponseSchema.parse`d and returned; plus a malformed-body case rejecting with `ZodError`.
- **Error envelope → thrown `ApiError` (R5)** — a 404 `{ error: { code, message } }` rejects with an `ApiError` whose `code`/`message` match.
- **401 → `onUnauthorized` + reject (R6)** — the injected `jest.fn()` fires once **and** the promise still rejects with an `ApiError` instance.

## Findings

- **R7 tool substitution (msw → `global.fetch` mock) — accepted.** The spec's R7 wording and A4 name `msw`; the implementer escalated that msw v2's ESM-only transitive deps fail to transform under `jest-expo@54` + pnpm's nested `node_modules`, and the orchestrator resolved to mock `global.fetch` directly. For a thin `fetch` wrapper this is idiomatic and lighter, it keeps the shared `app/package.json` jest block untouched (a "do NOT touch" per research), and — critically — the mutation test above proves it exercises the client's real behavior, not a hollowed-out double. R7's acceptance criterion is stated as the four assertions, all of which hold. This satisfies R7; it does not fail for not using msw.
- **`msw` is now an unused devDependency** in `app/package.json:58`. Harmless; left in place for potential higher-level integration tests. A future chore could remove it. Not a gate concern.
- **App-side unit-test convention set:** "mock the `fetch`/service layer, not msw." Reviewers of downstream store/hook tickets should expect this pattern; it reads sensibly.
- **A2 Decision 3 divergence** (api.ts reading/clearing `auth.store` directly) is intentionally overridden by the spec via `configureApi` dependency inversion. The client correctly imports nothing from `store/`. Not a defect.

## Verdict

✅ **PASS** → ready for human PR review.

All three checks pass: coverage is complete (R1–R7 each have a confirmed real change, no orphans, out-of-scope items absent), all eight sampled citations hold up on relevance, and the tooling gate is green (`tsc` clean, `eslint` 0 errors, jest 8/8). The R7 fetch-mock substitution is documented and verified non-vacuous via mutation testing.

**Reviewer summary:** This ships `app/core/services/api.ts` — the single typed network boundary: env-sourced base URL, injected JWT + 401 handler via `configureApi` (dependency inversion, no `store/` import), Zod-parsed responses, and a throwable `ApiError` mapped from the shared envelope. Look first at the 401 branch (`api.ts:94-97` — fires `onUnauthorized` then rethrows) and the deliberate msw→`global.fetch` test substitution in `api.test.ts` (documented in `03-impl-report.md` Deviations; verified to genuinely exercise the client). `msw` remains an unused devDep — a candidate for a later cleanup chore.
