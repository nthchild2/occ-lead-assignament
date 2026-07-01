# Research · be-auth

- **Feature id:** `be-auth`
- **Inputs read:** `docs/work/be-auth/00-spec.md`, `docs/MAP.md`, `docs/A1 · Monorepo Architecture.md` (Decisions 3/4/5/6), `.eslintrc.js`, `backend/package.json`, be-core source under `backend/src/`, `packages/shared/src/schemas/auth.schema.ts`
- **Researcher:** researcher subagent (read-only)
- **Date:** 2026-07-01

## Relevant files

### be-core deliverables the auth module reuses (all committed, do not modify)

| File (`path:line`)                                      | Why it matters to this feature                                                                                                                                                     | R-ids          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `backend/src/lib/errors.ts:12-20`                       | `ERROR_STATUS` taxonomy already defines every code auth needs: `AUTH_REQUIRED`→401, `INVALID_CREDENTIALS`→401, `TOKEN_EXPIRED`→401, `VALIDATION_ERROR`→422. No new codes required. | R2, R3, R4, R5 |
| `backend/src/lib/errors.ts:22`                          | `ErrorCode` is the closed union derived from `ERROR_STATUS` keys — auth throws only these strings, typed.                                                                          | R2, R4         |
| `backend/src/lib/errors.ts:30-40`                       | `AppError(code, message)` — service/middleware throw this; status is auto-derived. Express-free, safe to throw from `auth.service.ts`.                                             | R2, R4         |
| `backend/src/middleware/validation.middleware.ts:24-41` | `validate({ body })` factory — mount on `POST /auth/login` with `LoginRequestSchema` to get 422 `VALIDATION_ERROR` for free (R3). Writes parsed data back onto `req`.              | R3             |
| `backend/src/config/env.ts:16-18`                       | `JWT_SECRET` (required, min 1) and `JWT_EXPIRES_IN` (default `'1h'`) — the sign/verify inputs. `env.JWT_SECRET` / `env.JWT_EXPIRES_IN` are the resolved values to pass to `jwt`.   | R1, R4         |
| `backend/src/config/env.ts:23`                          | `env` is parsed at import time (fail-fast). Import `{ env }` into the service/middleware; never read `process.env` directly.                                                       | R1, R4         |
| `backend/src/lib/response.ts:3-5`                       | `success(res, data, status?)` emits `{ data }` at 200 by default — use for login (`{ token, user }`), me (`user`), logout.                                                         | R1, R5, R6     |
| `backend/src/lib/response.ts:7-14`                      | `fail(res, status, code, message)` emits `{ error: { code, message } }` — but routers normally throw `AppError` and let the error middleware render; `fail` is used only there.    | R2             |
| `backend/src/middleware/error.middleware.ts:14-27`      | Global handler renders any thrown `AppError` via `fail()`; unknown → 500 `INTERNAL_ERROR`. Auth routers/middleware should `throw AppError`, not format responses themselves.       | R2, R4, R5     |
| `backend/src/lib/logger.ts:3`                           | Pino `logger` — use instead of `console.*` (guardrail). Optional in auth code.                                                                                                     | —              |

### Mount point and shared contracts

| File (`path:line`)                                        | Why it matters to this feature                                                                                                                                                    | R-ids       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `backend/src/app.ts:19-26`                                | Domain mount zone with commented `// app.use('/auth', authRouter)` placeholder (line 20) already present; error middleware is registered last at line 26 and must stay last (R7). | R7          |
| `packages/shared/src/schemas/auth.schema.ts:3-6`          | `UserSchema` = `{ id: string, email: string(email) }` — the user shape returned by login and `/auth/me`.                                                                          | R1, R5      |
| `packages/shared/src/schemas/auth.schema.ts:8-11`         | `LoginRequestSchema` = `{ email: email, password: min(1) }` — feed to `validate({ body })` for R3.                                                                                | R3          |
| `packages/shared/src/schemas/auth.schema.ts:13-18`        | `LoginResponseSchema` = `{ data: { token, user } }` — the full 200 envelope for login; tests parse the whole response body against this.                                          | R1, R8      |
| `packages/shared/src/schemas/auth.schema.ts:20-22`        | `MeResponseSchema` = `{ data: user }` — the 200 envelope for `/auth/me`.                                                                                                          | R5, R8      |
| `packages/shared/src/schemas/index.ts:1`                  | `auth.schema` is re-exported through the schemas barrel.                                                                                                                          | R1,R3,R5    |
| `packages/shared/src/index.ts:1`                          | Barrel re-exports `./schemas`, so all four schemas import as `@occ/shared` (mapped in backend jest at `backend/package.json:30`).                                                 | R1,R3,R5,R8 |
| `packages/shared/src/schemas/application.schema.ts:22-27` | `ApiErrorSchema` = `{ error: { code, message } }` — reuse in integration tests to assert the 401/422 error envelopes.                                                             | R8          |

### Test toolchain and existing test pattern

| File (`path:line`)                                                     | Why it matters to this feature                                                                                                                                                    | R-ids  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `backend/package.json:16-17`                                           | Runtime deps `jsonwebtoken ^9.0.0` present (installed 9.0.3). No new dependency to add for signing/verifying.                                                                     | R1, R4 |
| `backend/package.json:37`                                              | `@types/jsonwebtoken ^9.0.0` present — typed `sign`/`verify` and error classes available.                                                                                         | R1, R4 |
| `backend/package.json:40-41`                                           | `supertest ^6.3.0` + `@types/supertest ^6.0.0` present — the integration-test driver for R8.                                                                                      | R8     |
| `backend/package.json:26-27`                                           | Jest `testMatch: ["**/__tests__/**/*.test.ts"]` — backend tests MUST live under `__tests__/`; a co-located `*.test.ts` is silently skipped.                                       | R8     |
| `backend/package.json:29-31`                                           | `moduleNameMapper` maps `@occ/shared` → `packages/shared/src/index.ts`, so tests can import the auth schemas directly.                                                            | R8     |
| `backend/src/middleware/__tests__/error.middleware.test.ts:1-63`       | Existing unit-test pattern: `describe`/`it`, mock `Response`, parse the emitted body against a shared schema (`ApiErrorSchema.parse`). Copy this shape for middleware unit tests. | R8     |
| `backend/src/middleware/__tests__/validation.middleware.test.ts:11-38` | Existing pattern for asserting a thrown `AppError` (`toBeInstanceOf(AppError)`, `.code`, `.status`). Model for auth-middleware unit tests.                                        | R8     |
| `backend/node_modules/@types/jsonwebtoken/index.d.ts:6-16`             | `TokenExpiredError extends JsonWebTokenError` — the inheritance that dictates R4's branch order (see Risks).                                                                      | R4     |

### New files this feature creates (bare paths — do not exist yet)

| File (`path`)                                              | Layer / role (per A1 Decision 4)                                                                                              | R-ids              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `backend/src/domains/auth/auth.schema.ts`                  | Entities: JWT payload shape + any auth-local types. No framework imports; reuse `@occ/shared` `UserSchema` for the API shape. | R1, R5             |
| `backend/src/domains/auth/auth.service.ts`                 | Use case: credential check, `jwt.sign`, blacklist `Set`, resolve user from payload. No Express imports; throws `AppError`.    | R1, R2, R5, R6     |
| `backend/src/domains/auth/auth.router.ts`                  | Interface adapter: `/login`, `/me`, `/logout`; wires `validate` + auth middleware; calls `success`. No business logic.        | R1, R3, R5, R6, R7 |
| `backend/src/middleware/auth.middleware.ts`                | Reusable Bearer-JWT verifier; `jwt.verify`, blacklist check, attach user to `req`; throws `AUTH_REQUIRED` / `TOKEN_EXPIRED`.  | R4, R5, R6         |
| `backend/src/domains/auth/__tests__/auth.router.test.ts`   | Supertest integration flows for R8 (import `{ app }` from `app.ts`).                                                          | R8                 |
| `backend/src/middleware/__tests__/auth.middleware.test.ts` | Unit tests for the middleware (valid/missing/invalid/expired/blacklisted).                                                    | R4, R8             |

## Existing patterns to follow

- **Add a backend endpoint** → domain lives under `backend/src/domains/auth/` as `auth.router.ts` (HTTP) / `auth.service.ts` (logic) / `auth.schema.ts` (types). Layer responsibilities per `docs/A1 · Monorepo Architecture.md:156-165`: service must not import Express; router holds no business logic.
- **Mount a router** → follow the placeholder at `backend/src/app.ts:20`; add `app.use('/auth', authRouter)` inside the domain zone (lines 19-24), strictly before `app.use(errorMiddleware)` at `backend/src/app.ts:26`.
- **Validate a request body** → mount `validate({ body: LoginRequestSchema })` on the login route; pattern is `backend/src/middleware/validation.middleware.ts:24`, exercised at `backend/src/middleware/__tests__/validation.middleware.test.ts:27`.
- **Signal a domain error** → `throw new AppError('INVALID_CREDENTIALS', msg)` from the service (`backend/src/lib/errors.ts:34`); the error middleware renders it (`backend/src/middleware/error.middleware.ts:20-22`). Do not build error envelopes in the router.
- **Emit a success envelope** → `success(res, { token, user })` / `success(res, user)` — `backend/src/lib/response.ts:3`. No `ok` field (A1 Decision 6, `docs/A1 · Monorepo Architecture.md:198`).
- **API shapes come from `@occ/shared`** → derive types with `z.infer<>` from `packages/shared/src/schemas/auth.schema.ts`; never hand-write duplicate interfaces (MAP.md:50).
- **Backend test placement** → under `__tests__/`, `describe`/`it`, parse response bodies against shared schemas — model `backend/src/middleware/__tests__/error.middleware.test.ts:31-41`. Integration tests import `{ app }` from `backend/src/app.ts:41` and drive it with supertest.
- **JWT sign (idiomatic v9)** → `jwt.sign({ sub, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })` yields a 1h token (`env.JWT_EXPIRES_IN` defaults to `'1h'`, `backend/src/config/env.ts:17`).
- **JWT verify + error mapping (R4)** → `jwt.verify(token, env.JWT_SECRET)` throws on failure. Branch **most-specific-first**: check `err instanceof jwt.TokenExpiredError` → `TOKEN_EXPIRED`, else `err instanceof jwt.JsonWebTokenError` → `AUTH_REQUIRED` (types at `backend/node_modules/@types/jsonwebtoken/index.d.ts:6-16`).

## Constraints that apply

- **Services must not import Express** — `docs/A1 · Monorepo Architecture.md:159,163`. `auth.service.ts` throws `AppError` and returns plain data; the router does the HTTP translation.
- **Router holds no business logic; schema has no framework imports** — `docs/A1 · Monorepo Architecture.md:158,160`.
- **Cross-domain imports forbidden** — `.eslintrc.js:70-86` restricts `domains/jobs` and `domains/applications` from importing `domains/auth`. The auth middleware is intentionally placed at `backend/src/middleware/` (shared, outside any domain zone) so other domains can consume it without tripping this rule. Note: the reverse zones (auth importing jobs/applications) are not declared — auth has no reason to.
- **No `any`; API types via `z.infer<>`** — `.eslintrc.js:13`. Payload/user types derive from Zod, including the `req.user` augmentation the middleware adds.
- **No non-null assertions** — `.eslintrc.js:14`. Header/token parsing must guard rather than `!`.
- **No `console.*` in backend** — `.eslintrc.js:18`; use `backend/src/lib/logger.ts:3` if logging.
- **Cyclomatic complexity ≤ 10** — `.eslintrc.js:26`. Keep the verify/branch logic factored.
- **`consistent-type-imports`** — `.eslintrc.js:15`; import Express `Request`/`Response`/`RequestHandler` as `import type` (see `validation.middleware.ts:1`).
- **Response envelope is `{ data }` / `{ error: { code, message } }`, no `ok`** — A1 Decision 6, `docs/A1 · Monorepo Architecture.md:198`; enforced by using `success`/`fail`.
- **In-memory blacklist is sanctioned tech debt** — A1 Decision 5, `docs/A1 · Monorepo Architecture.md:184,192-194`: a module-level `Set` is acceptable and must be documented as single-instance only (not persisted). No Redis/DynamoDB in scope.

## What NOT to touch

- `backend/src/lib/errors.ts`, `.../response.ts`, `.../logger.ts`, `backend/src/config/env.ts`, `backend/src/middleware/validation.middleware.ts`, `backend/src/middleware/error.middleware.ts` — committed be-core; consume, do not edit. The taxonomy already contains every code auth needs; no new `ERROR_STATUS` entry is required.
- `packages/shared/src/schemas/auth.schema.ts` and the barrels (`schemas/index.ts`, `index.ts`) — the four schemas are already defined and exported; treat as read-only contract. Editing them is a shared breaking change touching both consumers.
- `backend/src/app.ts` **except** the two-line addition inside the domain zone (import + `app.use('/auth', authRouter)`). Do not move `app.use(errorMiddleware)` off the last position (`app.ts:26`); do not reorder `cors()`/`express.json()`.
- `.eslintrc.js`, `backend/package.json` — all needed deps (`jsonwebtoken`, `@types/jsonwebtoken`, `supertest`, `@types/supertest`) already present; no install and no config change needed.
- `backend/src/domains/jobs`, `.../applications`, `.../favorites` — other tickets; out of scope (spec "Explicitly out of scope").

## Risks & unknowns

- **JWT error branch order (R4).** `TokenExpiredError extends JsonWebTokenError` (`backend/node_modules/@types/jsonwebtoken/index.d.ts:12`). An `instanceof JsonWebTokenError` check placed first would swallow expiry and mislabel it `AUTH_REQUIRED`. The plan must check `TokenExpiredError` **before** `JsonWebTokenError`, or R4's `TOKEN_EXPIRED` acceptance criterion fails. Not blocking — resolvable in plan.
- **`req.user` typing.** The middleware attaches the authenticated user to the request; TS strict + no-`any` means this needs a typed augmentation (Express `Request` augmentation or a typed local `AuthedRequest`). No existing pattern in the repo yet — first consumer. Not blocking; a design choice for the plan.
- **`app.ts` starts the server on import.** `backend/src/app.ts:28-30` calls `app.listen()` at module load and exports `{ app }` (line 41). Supertest imports `app` and manages its own ephemeral port, but the listen() side-effect may need handling in tests (e.g. `server.close()` / `--forceExit`) to avoid an open-handle warning. Not blocking; a test-setup detail.
- **Blacklist granularity (token string vs `jti`).** Spec resolution (00-spec.md:41) allows either a `Set` of raw tokens or of `jti`. Raw-token `Set` is simplest and sufficient for single-instance; no ambiguity that blocks planning.

No blocking ambiguities. All three spec "Open questions" are already resolved in `00-spec.md:39-41` (payload = `sub`+`email`, fixed id `'1'`; expiry from `env`; module-level `Set`). Nothing to escalate.

## Handoff to PLAN

- Everything auth needs from be-core exists and is cited: taxonomy (`errors.ts:12-20`), `AppError` (`errors.ts:30-40`), `validate` (`validation.middleware.ts:24`), `env.JWT_SECRET`/`JWT_EXPIRES_IN` (`env.ts:16-17`), `success`/`fail` (`response.ts:3-14`). No be-core edits, no new deps, no new error codes.
- Build the domain as three files under `backend/src/domains/auth/` (schema/service/router) per A1 Decision 4 (`A1:156-165`): service is Express-free and throws `AppError`; router calls `validate`+`success`; put the reusable JWT verifier in `backend/src/middleware/auth.middleware.ts` (shared, outside domain zones, so jobs/apply/favorites can import it without hitting `.eslintrc.js:70-86`).
- Mount at `backend/src/app.ts:20` (existing placeholder) and keep `errorMiddleware` last (`app.ts:26`) — that satisfies R7.
- R4 is the one correctness trap: map `jwt.verify` errors with `TokenExpiredError`→`TOKEN_EXPIRED` checked **before** `JsonWebTokenError`→`AUTH_REQUIRED` (in `jsonwebtoken`'s types, `TokenExpiredError` extends `JsonWebTokenError`); also check the in-memory blacklist `Set` in the same middleware (R6).
- Tests (R8) go under `__tests__/` (`package.json:26-27`) using supertest against `{ app }` from `app.ts:41`; assert envelopes against `@occ/shared` `LoginResponseSchema`/`MeResponseSchema`/`ApiErrorSchema`. Follow the `describe`/`it`+schema-parse style of `error.middleware.test.ts:31-41`.
- Consume API shapes from `@occ/shared` (`auth.schema.ts:3-22`) via `z.infer<>`; resolve `req.user` typing and the `app.listen` open-handle test concern (both noted in Risks).
