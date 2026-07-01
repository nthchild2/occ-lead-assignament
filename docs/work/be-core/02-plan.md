# Plan · be-core

- **Feature id:** `be-core`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner subagent
- **Date:** 2026-07-01

## Approach

Build four small, single-responsibility backend modules under `backend/src/`, keeping the taxonomy, `AppError`, and config **Express-free** so domain services can throw `AppError` without importing Express (A1 Decision 4). Only the two middlewares import Express types. The error taxonomy is a single source of truth: a typed `const` lookup record `code -> status` from which both the union type (`keyof typeof`) and `AppError.status` are derived — one map, no drift, and no dynamic string indexing (satisfies the `security/detect-object-injection` guardrail by using a typed literal record with a narrowed key). The error middleware emits the envelope exclusively through the existing `fail()` helper so output conforms to `ApiErrorSchema`, and it is wired as the **last** `app.use`, replacing the current inline handler. `app.ts` changes in exactly two places (PORT source, error handler) — everything else there is out of scope.

Ordering is chosen so the tree stays type-checkable at every step: leaf modules (taxonomy → `AppError` → config → middlewares) land before `app.ts` is rewired to consume them, and tests land after the code they exercise.

**Rejected alternative:** placing the taxonomy/`AppError` in `packages/shared` (next to `ApiErrorSchema`). Rejected because these are backend-internal — thrown server-side, never a client type — and `packages/shared` changes require lead review (research "What NOT to touch"). Only the envelope _shape_ is shared, and it already exists. A second rejected alternative — deriving `status` inside `AppError` via a `switch` — was dropped in favor of the shared lookup record to avoid duplicating the taxonomy and to keep cyclomatic complexity low.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                   | File(s) (`path:line`)                                                  | R-ids | Type   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----- | ------ |
| 1   | Create the error-code taxonomy: a typed `const ERROR_STATUS` record mapping `AUTH_REQUIRED`→401, `INVALID_CREDENTIALS`→401, `TOKEN_EXPIRED`→401, `NOT_FOUND`→404, `ALREADY_APPLIED`→409, `ALREADY_FAVORITED`→409, `VALIDATION_ERROR`→422; export `type ErrorCode = keyof typeof ERROR_STATUS` (union, not `string`). Express-free.                                                                                                       | `backend/src/lib/errors.ts` (new)                                      | R1    | create |
| 2   | Add `AppError` class in the same module: constructor `(code: ErrorCode, message: string)`, deriving `readonly status` from `ERROR_STATUS[code]` (typed lookup, no dynamic string index). Express-free, no `any`, no `!`.                                                                                                                                                                                                                 | `backend/src/lib/errors.ts` (new)                                      | R2    | create |
| 3   | Create the validated config module: a Zod schema over `process.env` exposing typed `PORT` (coerced number, default 3000), `JWT_SECRET` (required — throws if missing), `JWT_EXPIRES_IN` (default `'1h'`), `NODE_ENV` (enum incl. `development`/`production`/`test`, default `development`). `.parse()` at import → fail-fast at boot. Express-free; relies on `dotenv/config` already loaded at `backend/src/app.ts:1`.                  | `backend/src/config/env.ts` (new)                                      | R5    | create |
| 4   | Create the error middleware: 4-arg Express handler `(err, _req, res, _next)`; if `err instanceof AppError` → `fail(res, err.status, err.code, err.message)`; else → `fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred')`. Both branches `logger.error({ err }, …)`. Imports `fail` (`../lib/response`), `logger` (`../lib/logger`), `AppError` (`../lib/errors`); `type`-only Express imports; `_`-prefixed unused params. | `backend/src/middleware/error.middleware.ts` (new)                     | R3    | create |
| 5   | Create the validation middleware: `validate({ body?, query?, params? })` factory returning an Express middleware that `safeParse`s each provided Zod schema; on failure throws `new AppError('VALIDATION_ERROR', …)` (→422 via middleware); on success assigns parsed values back to `req` and calls `next()`. Imports `AppError` (`../lib/errors`); `type`-only Express + Zod imports; complexity ≤ 10.                                 | `backend/src/middleware/validation.middleware.ts` (new)                | R4    | create |
| 6   | Rewire `app.ts` (edit 1): replace `const PORT = process.env.PORT ?? 3000` with the config value from `env.ts`. Add `import { env } from './config/env'`.                                                                                                                                                                                                                                                                                 | `backend/src/app.ts:7`                                                 | R5    | edit   |
| 7   | Rewire `app.ts` (edit 2): replace the inline global error handler at lines 24-29 with `app.use(errorMiddleware)`, kept **last** in the chain. Add `import { errorMiddleware } from './middleware/error.middleware'`.                                                                                                                                                                                                                     | `backend/src/app.ts:24-29`                                             | R3    | edit   |
| 8   | Verify `.env.example` already documents `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN` with placeholders (it does, lines 2/4/5). No new work; add a `# be-core` grouping comment only if a gap is found. Do **not** change file mode.                                                                                                                                                                                                            | `.env.example:1-6`                                                     | R6    | edit   |
| 9   | Add a dedicated README section expanding the one-line bullet at `README.md:80` into a full rationale for the no-`ok` envelope (transport vs domain errors), summarizing A1 Decision 6 (`docs/A1 · Monorepo Architecture.md:198-256`).                                                                                                                                                                                                    | `README.md:76-83`                                                      | R7    | edit   |
| 10  | Unit-test the error middleware: `AppError('NOT_FOUND',…)` → 404 + `{ error: { code:'NOT_FOUND', message } }` matching `ApiErrorSchema`; a `VALIDATION_ERROR` `AppError` → 422; a plain `Error` → 500 `INTERNAL_ERROR`. Assert envelope shape (optionally via `ApiErrorSchema.parse`).                                                                                                                                                    | `backend/src/middleware/__tests__/error.middleware.test.ts` (new)      | R8    | test   |
| 11  | Unit-test the validation middleware: invalid `body` → thrown `AppError('VALIDATION_ERROR')` (→422); valid input → `next()` called with no error and parsed/typed values present on `req`.                                                                                                                                                                                                                                                | `backend/src/middleware/__tests__/validation.middleware.test.ts` (new) | R8    | test   |
| 12  | Unit-test the taxonomy/`AppError`: `new AppError('NOT_FOUND', …).status === 404`, `ALREADY_APPLIED` → 409, `VALIDATION_ERROR` → 422; confirms status is derived from the R1 record.                                                                                                                                                                                                                                                      | `backend/src/lib/__tests__/errors.test.ts` (new)                       | R8    | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 1                    |
| R2   | must     | 2, 12                |
| R3   | must     | 4, 7, 10             |
| R4   | must     | 5, 11                |
| R5   | must     | 3, 6                 |
| R6   | must     | 8                    |
| R7   | must     | 9                    |
| R8   | should   | 10, 11, 12           |

- [x] Every `must` requirement (R1–R7) is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans). Changes 1–12 each cite an R-id; taxonomy codes wider than this ticket's use (`ALREADY_FAVORITED`, `TOKEN_EXPIRED`, `AUTH_REQUIRED`, `INVALID_CREDENTIALS`) are mandated by R1's acceptance criterion, not scope creep.

## Tests to add or update

All backend tests MUST live under `backend/src/**/__tests__/*.test.ts` to match jest `testMatch: **/__tests__/**/*.test.ts` (`backend/package.json:26-27`); a co-located `*.test.ts` would be silently skipped.

- `backend/src/middleware/__tests__/error.middleware.test.ts` — asserts `AppError` → taxonomy status + `ApiErrorSchema`-shaped envelope, `VALIDATION_ERROR` → 422, unknown `Error` → 500 `INTERNAL_ERROR` (R8, exercising R3). May drive a tiny Express app via `supertest` (`backend/package.json:40`) or call the handler directly.
- `backend/src/middleware/__tests__/validation.middleware.test.ts` — asserts invalid input → `AppError('VALIDATION_ERROR')` (→422) and valid input passes through with parsed values on `req` (R8, exercising R4).
- `backend/src/lib/__tests__/errors.test.ts` — asserts `AppError.status` is derived from the taxonomy for representative codes (R8, exercising R1/R2).

## Risks & rollback

- **Test placement.** Placing a backend test co-located (not under `__tests__/`) makes jest silently skip it — the test would pass-vacuously and give false confidence. Mitigation: all three test files sit in `__tests__/` dirs (changes 10–12). Rollback: delete the test files (they touch nothing else).
- **Config fail-fast breaking `app.ts` boot in dev/CI without a `.env`.** `env.ts` throws when `JWT_SECRET` is absent (R5 intent). `.env.example:4` supplies a placeholder and `dotenv/config` is already loaded (`app.ts:1`); tests import leaf modules that don't require the env unless they import `app.ts`. Mitigation: keep `PORT`/`NODE_ENV`/`JWT_EXPIRES_IN` defaulted so only `JWT_SECRET` is hard-required. Rollback: change 6 reverts to `process.env.PORT ?? 3000`; the config module can be deleted independently.
- **Envelope drift.** If the middleware hand-rolled `res.json`, output could diverge from `ApiErrorSchema`. Mitigation: change 4 routes exclusively through `fail()` (`response.ts:7-14`); change 10 asserts against `ApiErrorSchema`. Rollback: revert change 7 to restore the inline handler at `app.ts:24-29`.
- **object-injection lint warning on `code→status`.** Dynamic `ERROR_STATUS[someString]` could trip `security/detect-object-injection` (`.eslintrc.js:63`, warn). Mitigation: key is the narrowed `ErrorCode` union derived from the same record (change 1), not an arbitrary string. Rollback: none needed; contained to change 1.
- **R6 turns out to have a gap.** Research and inspection show `.env.example` already lists all three vars (lines 2/4/5), so change 8 is verify-only. If a gap surfaces, it is a one-line addition to an existing file; rollback is trivial. File mode (`-rw-------`) is intentionally left unchanged.

## Handoff to IMPLEMENT

1. Create `backend/src/lib/errors.ts` — `ERROR_STATUS` record + `ErrorCode` union (R1) and `AppError` class deriving `status` from it (R2). Express-free.
2. Create `backend/src/config/env.ts` — Zod-validated, fail-fast `env` object: typed `PORT`/`JWT_SECRET`/`JWT_EXPIRES_IN`/`NODE_ENV` (R5). Express-free.
3. Create `backend/src/middleware/error.middleware.ts` — `AppError`→`fail(res, status, code, message)`, else 500 `INTERNAL_ERROR`; log both via `logger`; `type`-only Express imports, `_`-prefixed unused params (R3).
4. Create `backend/src/middleware/validation.middleware.ts` — `validate({body?,query?,params?})` factory; on parse failure throw `AppError('VALIDATION_ERROR')`, else assign parsed values and `next()` (R4).
5. Edit `backend/src/app.ts:7` — consume `env.PORT` from `./config/env` instead of `process.env.PORT` (R5).
6. Edit `backend/src/app.ts:24-29` — replace the inline handler with `app.use(errorMiddleware)`, kept last (R3).
7. Verify `.env.example` documents `PORT`/`JWT_SECRET`/`JWT_EXPIRES_IN` (already present); no-op or comment tweak only (R6).
8. Add the README no-`ok` rationale section, expanding `README.md:80` from A1 Decision 6 (R7).
9. Add tests under `backend/src/**/__tests__/`: `error.middleware.test.ts`, `validation.middleware.test.ts`, `lib/__tests__/errors.test.ts` (R8).
10. Run `pnpm --filter @occ/backend typecheck` and `pnpm --filter @occ/backend test`, then lint, to clear the verify gate.

## Sign-off

- [x] Plan reviewed by a human and approved to proceed to IMPLEMENT.
      (Full-auto mode authorized 2026-07-01 — gates skipped; verification hard stop still applies.)
