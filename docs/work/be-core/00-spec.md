# Spec · be-core

- **Feature id:** `be-core`
- **Date:** 2026-07-01
- **Author:** orchestrator, pending human sign-off
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §2.1–2.3; `docs/work/ROADMAP.md` (Epic A · `be-core`); A1 Decision 6

## Summary

Establish the shared backend primitives every domain will build on: a typed error-code taxonomy mapped to HTTP statuses, a global error-handling middleware that renders the `{ error: { code, message } }` envelope, a reusable Zod request-validation middleware, and a validated environment-config module. This is foundational plumbing — no domain endpoints. CORS, the health check, structured logging (`pino`), and graceful shutdown already exist in `backend/src/app.ts` and are **not** re-implemented here.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                 | Source              | Acceptance criterion                                                                                                                                                                                                                         | Priority |
| --- | ---------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Define a typed error-code taxonomy mapping each domain error code to its HTTP status           | PDF §2.3            | A typed module exposes `AUTH_REQUIRED`→401, `INVALID_CREDENTIALS`→401, `TOKEN_EXPIRED`→401, `NOT_FOUND`→404, `ALREADY_APPLIED`→409, `ALREADY_FAVORITED`→409, `VALIDATION_ERROR`→422; codes are a discriminated/union type, not loose strings | must     |
| R2  | Provide an `AppError` domain-error type carrying `code`, HTTP `status`, and `message`          | PDF §2.3            | Throwing `new AppError('NOT_FOUND', 'Vacante no encontrada')` produces an object whose `status` (404) is derived from the R1 taxonomy                                                                                                        | must     |
| R3  | Global error middleware renders thrown errors as the standard envelope with the correct status | PDF §2.3; A1 Dec. 6 | An `AppError` → HTTP status from taxonomy + `{ error: { code, message } }`; any non-`AppError` → 500 `{ error: { code: 'INTERNAL_ERROR', … } }`; both logged via `pino`. Lives in `backend/src/middleware/error.middleware.ts`               | must     |
| R4  | Reusable Zod validation middleware for request `body` / `query` / `params`                     | PDF §2.3, Req. téc. | A `validate({ body?, query?, params? })` factory parses with the given Zod schema; invalid input → thrown `AppError('VALIDATION_ERROR')` → 422; valid input passes through with typed/parsed values available to the handler                 | must     |
| R5  | Validated environment-config module, fail-fast at startup                                      | PDF §2.1, §5.2      | A config module validates and exposes typed `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`; a missing required var (`JWT_SECRET`) throws at boot; `app.ts` consumes it instead of reading `process.env` inline for `PORT`                | must     |
| R6  | `.env.example` documents the backend environment variables                                     | PDF §1.1, §5.2      | Root `.env.example` lists `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN` with placeholder values                                                                                                                                                     | must     |
| R7  | README section justifying the no-`ok` response envelope                                        | A1 Dec. 6; ROADMAP  | README contains a section explaining the deviation from the brief's `{ ok, … }` shape and its rationale, so it reads as a decision not an oversight                                                                                          | must     |
| R8  | Unit tests for the error middleware and the validation middleware                              | A4                  | Tests assert: `AppError` maps to the right status+envelope, unknown error → 500, invalid input → 422, valid input passes through                                                                                                             | should   |

## Explicitly out of scope

- **CORS, `express.json`, health check, graceful shutdown** — already implemented in `backend/src/app.ts`; not touched beyond wiring in the new error middleware and config module.
- **Auth middleware / JWT verification** — belongs to `be-auth`.
- **Any domain router, service, or seed** — later Epic-A tickets.
- **App-side env (`API_BASE_URL`)** — belongs to `app-api-client`; this ticket documents backend vars only.
- **The `success`/`fail` helpers in `backend/src/lib/response.ts`** — already exist; the error middleware uses `fail`, it doesn't replace it.

## Open questions / ambiguities

<!-- None blocking. Recorded for the planner's awareness; resolve if they escalate. -->

- [x] `JWT_EXPIRES_IN` default → **resolution:** default `'1h'` (brief §2.2 mandates a 1-hour login token). The env var lives here; `be-auth` consumes it.
- [x] Validation-middleware file naming → **resolution:** follow the `*.middleware.ts` convention from A1's backend tree (`error.middleware.ts`, `auth.middleware.ts`) → `validation.middleware.ts`. Research/plan may confirm exact path.

## Sign-off

- [x] Ledger reviewed by a human and approved to proceed to RESEARCH. _(approved 2026-07-01)_
