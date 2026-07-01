# Implementation Report · be-core

- **Feature id:** `be-core`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `docs/MAP.md`
- **Implementer:** implementer subagent
- **Date:** 2026-07-01

## Changes made

| File (`path`)                                                          | What changed                                                                                                                                                                                                                                                                    | R-ids | Plan step |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- |
| `backend/src/lib/errors.ts` (new)                                      | Added `const ERROR_STATUS` typed record (`AUTH_REQUIRED`/`INVALID_CREDENTIALS`/`TOKEN_EXPIRED`→401, `NOT_FOUND`→404, `ALREADY_APPLIED`/`ALREADY_FAVORITED`→409, `VALIDATION_ERROR`→422) and `type ErrorCode = keyof typeof ERROR_STATUS`. Express-free.                         | R1    | 1         |
| `backend/src/lib/errors.ts` (new)                                      | Added `AppError extends Error`: constructor `(code: ErrorCode, message)`, `readonly status` derived via typed lookup `ERROR_STATUS[code]`. No `any`, no `!`.                                                                                                                    | R2    | 2         |
| `backend/src/config/env.ts` (new)                                      | Added Zod-validated `env`: `PORT` (coerced number, default 3000), `JWT_SECRET` (required, throws if missing), `JWT_EXPIRES_IN` (default `'1h'`), `NODE_ENV` (enum, default `development`). `.parse(process.env)` at import → fail-fast. Express-free.                           | R5    | 3         |
| `backend/src/middleware/error.middleware.ts` (new)                     | Added 4-arg handler: `AppError` → `fail(res, status, code, message)`; else 500 `INTERNAL_ERROR`; both branches `logger.error({ err }, …)`. `type`-only Express imports; `_`-prefixed unused params; envelope only via `fail()`.                                                 | R3    | 4         |
| `backend/src/middleware/validation.middleware.ts` (new)                | Added `validate({ body?, query?, params? })` factory: `safeParse`s each provided schema over a narrowed `PARTS` literal; on failure throws `AppError('VALIDATION_ERROR')`; on success writes parsed values back to `req` and calls `next()`. `type`-only Express + Zod imports. | R4    | 5         |
| `backend/src/app.ts:9`                                                 | Edit 1 — replaced `process.env.PORT ?? 3000` with `env.PORT`; added `import { env } from './config/env'`.                                                                                                                                                                       | R5    | 6         |
| `backend/src/app.ts:26`                                                | Edit 2 — replaced the inline 6-line error handler with `app.use(errorMiddleware)`, kept last before `app.listen`; added `import { errorMiddleware } from './middleware/error.middleware'`.                                                                                      | R3    | 7         |
| `.env.example`                                                         | Verify-only: `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN` already present with placeholders under a `# Backend` heading. No gap found → no edit, file mode untouched.                                                                                                                 | R6    | 8         |
| `README.md:82`                                                         | Added "API response envelope (no `ok` field)" section expanding the one-line bullet into a full transport-vs-domain-error rationale, citing A1 Decision 6.                                                                                                                      | R7    | 9         |
| `backend/src/middleware/__tests__/error.middleware.test.ts` (new)      | Asserts `AppError('NOT_FOUND')` → 404 + `ApiErrorSchema`-shaped envelope, `VALIDATION_ERROR` → 422, plain `Error` → 500 `INTERNAL_ERROR`; parses envelopes through `ApiErrorSchema`.                                                                                            | R8    | 10        |
| `backend/src/middleware/__tests__/validation.middleware.test.ts` (new) | Asserts invalid body → thrown `AppError('VALIDATION_ERROR')` (status 422); valid input → `next()` called with no error and coerced values on `req`; parts without a schema are skipped.                                                                                         | R8    | 11        |
| `backend/src/lib/__tests__/errors.test.ts` (new)                       | Asserts `AppError.status` is derived from the taxonomy: `NOT_FOUND`→404, `ALREADY_APPLIED`→409, `VALIDATION_ERROR`→422, `instanceof Error`, and every `ERROR_STATUS` key round-trips.                                                                                           | R8    | 12        |

## Traceability

| R-id | Satisfied by (file)                                                                         | Notes                                                                                      |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R1   | `backend/src/lib/errors.ts`                                                                 | `ERROR_STATUS` record + `ErrorCode` union (keyof), not loose strings.                      |
| R2   | `backend/src/lib/errors.ts` + `backend/src/lib/__tests__/errors.test.ts`                    | `status` derived from R1 taxonomy via typed lookup.                                        |
| R3   | `backend/src/middleware/error.middleware.ts` + `backend/src/app.ts` + error middleware test | Envelope via `fail()`; unknown → 500 `INTERNAL_ERROR`; wired last in chain.                |
| R4   | `backend/src/middleware/validation.middleware.ts` + validation middleware test              | Factory over body/query/params; invalid → 422 `AppError`, valid passes with parsed values. |
| R5   | `backend/src/config/env.ts` + `backend/src/app.ts`                                          | Fail-fast on missing `JWT_SECRET`; `app.ts` consumes `env.PORT`.                           |
| R6   | `.env.example`                                                                              | Already documents all three backend vars with placeholders; verified, no change needed.    |
| R7   | `README.md`                                                                                 | Dedicated no-`ok` envelope section, expanding line 80 from A1 Decision 6.                  |
| R8   | error/validation/errors test files under `backend/src/**/__tests__/`                        | 3 suites / 11 tests, all under jest `testMatch` `**/__tests__/**/*.test.ts`.               |

## Deviations from the plan

- **None.** All 12 steps executed as specified. Step 8 (`.env.example`) was verify-only per the plan; the three vars are present with placeholders and file mode was left unchanged, so no edit was made.

## Anything left for a follow-up

- **Auth middleware / JWT verification** (`be-auth`) will consume `env.JWT_SECRET` / `env.JWT_EXPIRES_IN` — out of scope here, not built.
- **Domain routers/services/seed** — later Epic-A tickets; the `validate()` and `AppError` primitives are ready for them.
- **App-side env (`API_BASE_URL`)** — belongs to `app-api-client`; `.env.example` already lists it but this ticket documents backend vars only.

## Handoff to VERIFY

- Workspaces touched (for `tsc`): `backend` (plus a docs edit to root `README.md`).
- New/changed tests to run: `backend/src/lib/__tests__/errors.test.ts`, `backend/src/middleware/__tests__/error.middleware.test.ts`, `backend/src/middleware/__tests__/validation.middleware.test.ts`. Run with `JWT_SECRET` set in the environment (or `.env` present) because `config/env.ts` is import-time fail-fast — although the leaf-module tests don't import `app.ts`/`env.ts` directly.
- Special attention:
  - `pnpm lint` reports **0 errors, 5 warnings**, all `security/detect-object-injection` (config rule = `warn`, not `error`). These are the exact warnings the plan anticipated and accepted (plan Risks: "key is the narrowed `ErrorCode` union … not an arbitrary string. Rollback: none needed"). The flagged accesses in `errors.ts` and `validation.middleware.ts` use narrowed union / literal-tuple keys, not dynamic strings.
  - `errorMiddleware` is registered as the last `app.use` at `backend/src/app.ts:26`, before `app.listen`.
  - Sanity self-check run locally (not a verification claim): `typecheck` clean, `test` 11/11 pass, `lint` 0 errors.
