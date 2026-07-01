# Verification Report · be-auth

- **Feature id:** `be-auth`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier subagent (fresh context, independent of implementer)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

Each R-id traced by reading the actual source files (not the report). All R1–R8 are `must`.

| R-id | Priority | Has change? | Notes (verified against files)                                                                                                                                                                                                                                                                                                                             |
| ---- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `auth.service.ts:37-47` `login` validates fixed creds and signs `jwt.sign(payload, env.JWT_SECRET, signOptions)` with `expiresIn: env.JWT_EXPIRES_IN` (`'1h'` default); `auth.router.ts:16-24` `POST /login` → `success(res, { token, user })`. Integration test verifies the returned token decodes with `sub:'1'` + email (`auth.router.test.ts:20-31`). |
| R2   | must     | ✅          | `auth.service.ts:38-40` throws `AppError('INVALID_CREDENTIALS')` on wrong email/password; test asserts 401 + `INVALID_CREDENTIALS` (`auth.router.test.ts:33-41`).                                                                                                                                                                                          |
| R3   | must     | ✅          | `auth.router.ts:18` mounts `validate({ body: LoginRequestSchema })`; test asserts 422 `VALIDATION_ERROR` for malformed body (`auth.router.test.ts:43-51`).                                                                                                                                                                                                 |
| R4   | must     | ✅          | `auth.middleware.ts:45-58` `verifyToken` branches `TokenExpiredError` (line 50) **before** `JsonWebTokenError` (line 53); missing/malformed header → `AUTH_REQUIRED` (`extractToken` lines 27-38). Mutation-checked (see Findings).                                                                                                                        |
| R5   | must     | ✅          | `auth.router.ts:26-31` `GET /me` behind `authMiddleware` → `success(res, req.user)`; `req.user` set in `auth.middleware.ts:78`. Tests: valid → 200 `MeResponseSchema` (`auth.router.test.ts:55-62`); no token → 401 `AUTH_REQUIRED` (lines 64-70).                                                                                                         |
| R6   | must     | ✅          | Module-level `blacklist = new Set<string>()` with `logout`/`isBlacklisted` (`auth.service.ts:22,53-58`); middleware checks blacklist before verify (`auth.middleware.ts:73-75`); `auth.router.ts:33-39` logout adds `req.token`. Test: logout then reuse `/me` → 401 (`auth.router.test.ts:86-100`).                                                       |
| R7   | must     | ✅          | `app.ts:7,21` imports `authRouter` and mounts `app.use('/auth', authRouter)`; `errorMiddleware` stays last at `app.ts:27`.                                                                                                                                                                                                                                 |
| R8   | must     | ✅          | Two suites present: `auth.middleware.test.ts` (6 unit tests) + `auth.router.test.ts` (7 integration tests). `app.listen()` guarded behind `if (env.NODE_ENV !== 'test')` (`app.ts:31-44`) — no open-handle leak.                                                                                                                                           |

- [x] **No gaps** — every `must` requirement (R1–R8) has ≥1 real change, confirmed by reading the files.
- [x] **No orphans** — every changed file traces to ≥1 R-id. The one non-obvious change (the `app.listen()` guard) exists solely to make R8's supertest import leak-free; it cites R8, not scope creep. The `jest.setup.ts` + `setupFiles` addition (Deviation) is test-config for R8 self-containment, not production code.
- [x] **Out-of-scope items NOT implemented** — `backend/src/domains/` contains only `auth/` (no `jobs`/`applications`/`favorites`). `packages/shared/` untouched (last commit is the bootstrap; no be-auth edit). `app.ts` changes are limited to the router mount + `listen()` guard; middleware order preserved (`errorMiddleware` last). No be-core file edited.

## 2 · Citation spot-check

Sampled from `01-research.md` / `02-plan.md`; opened each `path:line` and confirmed relevance (not just existence).

| Cited claim                                                                                              | `path:line`                                               | Holds up?                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ERROR_STATUS` defines `AUTH_REQUIRED`/`INVALID_CREDENTIALS`/`TOKEN_EXPIRED`→401, `VALIDATION_ERROR`→422 | `backend/src/lib/errors.ts:12-20`                         | ✅ All four codes present with the stated statuses.                                                                                              |
| `AppError(code, message)` auto-derives status, Express-free                                              | `backend/src/lib/errors.ts:30-40`                         | ✅ Constructor reads `ERROR_STATUS[code]`; no Express import.                                                                                    |
| `env.JWT_SECRET` (required) + `env.JWT_EXPIRES_IN` (default `'1h'`); parsed at import, fail-fast         | `backend/src/config/env.ts:16-18,23`                      | ✅ `JWT_SECRET` `min(1)` required, `JWT_EXPIRES_IN` default `'1h'`, `NODE_ENV` enum accepts `'test'`; `envSchema.parse(process.env)` at line 23. |
| `TokenExpiredError extends JsonWebTokenError` (dictates R4 branch order)                                 | `backend/node_modules/@types/jsonwebtoken/index.d.ts:12`  | ✅ `class TokenExpiredError extends JsonWebTokenError`.                                                                                          |
| `validate({ body })` throws `AppError('VALIDATION_ERROR')` (422) on failure                              | `backend/src/middleware/validation.middleware.ts:24-41`   | ✅ `safeParse` per part, throws `VALIDATION_ERROR` on first failure.                                                                             |
| `success(res, data)` emits `{ data }` at 200, no `ok` field                                              | `backend/src/lib/response.ts:3-5`                         | ✅ Returns `res.status(status).json({ data })`, default 200.                                                                                     |
| Shared schemas: `UserSchema`, `LoginRequestSchema`, `LoginResponseSchema`, `MeResponseSchema` shapes     | `packages/shared/src/schemas/auth.schema.ts:3-22`         | ✅ All present as described (`user={id,email}`, login req `{email,password:min(1)}`, envelopes `{data:...}`).                                    |
| `ApiErrorSchema = { error: { code, message } }` for error-body assertions                                | `packages/shared/src/schemas/application.schema.ts:22-27` | ✅ Exact shape.                                                                                                                                  |
| Jest `testMatch` requires `__tests__/`; `@occ/shared` module-mapped                                      | `backend/package.json:26-33`                              | ✅ `testMatch: ["**/__tests__/**/*.test.ts"]`, `moduleNameMapper` maps `@occ/shared`.                                                            |

All sampled citations are accurate and relevant.

## 3 · Tooling gate

Run in a clean shell. Tests run with `env -u JWT_SECRET` to prove self-containment (the jest `setupFiles` at `backend/jest.setup.ts` supplies a test secret).

| Check           | Command                                                | Result                                                |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Types (backend) | `pnpm --filter './backend' run typecheck`              | ✅ `tsc --noEmit` clean, no output                    |
| Lint            | `pnpm lint`                                            | ✅ 0 errors (5 pre-existing warnings, see below)      |
| Tests (backend) | `env -u JWT_SECRET pnpm --filter './backend' run test` | ✅ 5 suites / 24 tests passed, no open-handle warning |

App workspace not touched (impl-report handoff: `backend` only) — `pnpm --filter './app' run typecheck` not applicable.

**Lint detail:** `5 problems (0 errors, 5 warnings)`. All 5 are `security/detect-object-injection` **warnings** in be-core files this ticket did not touch:

- `backend/src/lib/__tests__/errors.test.ts:28`
- `backend/src/lib/errors.ts:38`
- `backend/src/middleware/validation.middleware.ts:27,30,36`

Zero warnings/errors in any be-auth file. These match the pre-existing state documented in the impl-report; not a gate failure.

**Test summary (clean shell, no shell `JWT_SECRET`):**

```
Test Suites: 5 passed, 5 total
Tests:       24 passed, 24 total
Ran all test suites.
```

No "open handle" / "Jest did not exit" warning — the `env.NODE_ENV !== 'test'` guard on `app.listen()` works.

## Findings

- **R4 branch order is real, not vacuous (mutation-tested).** I temporarily reversed the two `instanceof` branches in `auth.middleware.ts` (checking `JsonWebTokenError` before `TokenExpiredError`) and re-ran the expired-token tests. Both failed as expected — `auth.middleware.test.ts:69` and `auth.router.test.ts:82` each received `AUTH_REQUIRED` instead of `TOKEN_EXPIRED`. This proves the tests actually pin the branch order. Mutation reverted; branch order restored (`TokenExpiredError` at line 50, before `JsonWebTokenError` at line 53) and the full suite re-run green.
- **Three strict-mode casts use no `any` / no `!`.** Verified by reading + a grep of all four be-auth source files (`NONE FOUND`):
  - `auth.service.ts:28` — `env.JWT_EXPIRES_IN as SignOptions['expiresIn']` (cast to the option's own template type, not `any`).
  - `auth.middleware.ts:48` — narrows the `string | JwtPayload` union via `String(decoded.sub)` and `(decoded as { email?: unknown }).email` (cast to `unknown`, then `String()`; not `any`, no `!`).
  - Test files use `as unknown as Request` / `as jwt.SignOptions` / `as jwt.JwtPayload` — type-level casts, no `any`/`!`.
- **`app.listen()` guard prevents open-handle leak.** `app.ts:31-44` wraps both `app.listen()` and the `SIGTERM` handler in `if (env.NODE_ENV !== 'test')`; supertest imports `{ app }` (line 46) without binding a port. Confirmed by absence of any open-handle warning in the test run.
- **R8 self-containment (orchestrator-applied fix) verified.** `backend/jest.setup.ts` sets `process.env.JWT_SECRET ||= 'test-secret-…'` and is wired via `setupFiles` (`package.json:29-31`). The suite passes with `env -u JWT_SECRET`, confirming no shell env var is needed. This is test config only; no production code affected.
- **Residual (sanctioned) tech debt, not a gate issue.** Blacklist is a single-instance in-memory `Set`, documented in-code (`auth.service.ts:18-22`) as A1 Decision 5 tech debt. Out of scope per the spec.

## Verdict

✅ **PASS** → ready for human PR review. Coverage is complete (R1–R8 all traced to real changes), no orphans, out-of-scope areas untouched, all sampled citations hold, and tsc/eslint/jest are green in a clean shell.

**Reviewer summary (on pass):** be-auth ships a self-contained auth domain (`login`/`me`/`logout`) plus a reusable Bearer-JWT middleware placed outside domain zones so jobs/apply/favorites can import it. Look first at `auth.middleware.ts:45-58` — the `TokenExpiredError`-before-`JsonWebTokenError` branch order is the one correctness trap for R4, and it's pinned by a mutation-verified test. The `app.ts` change is minimal (router mount + a `NODE_ENV !== 'test'` guard on `listen()`); the `jest.setup.ts`/`setupFiles` addition is test-only config that makes the supertest suite self-contained (no shell `JWT_SECRET` required).
