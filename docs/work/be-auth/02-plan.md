# Plan · be-auth

- **Feature id:** `be-auth`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner subagent
- **Date:** 2026-07-01

## Approach

Build the auth domain as three Clean-Architecture files under `backend/src/domains/auth/` (schema / service / router) per A1 Decision 4, and place the reusable Bearer-JWT verifier at `backend/src/middleware/auth.middleware.ts` — outside every domain zone — so jobs/applications/favorites can import it later without tripping `.eslintrc.js:70-86`. The service is Express-free: it validates the fixed credentials, signs the JWT with `env.JWT_SECRET`/`env.JWT_EXPIRES_IN`, owns the module-level in-memory blacklist `Set`, and throws `AppError`; the router does the HTTP translation (`validate` + `success`) and mounts `authMiddleware` on the two protected routes. `req.user` typing is resolved once via an Express `Request` augmentation in the shared middleware file (no `any`, no `AuthedRequest` casting at every call site).

The one correctness trap is R4's error mapping: because `TokenExpiredError extends JsonWebTokenError` (per `jsonwebtoken`'s type definitions), the middleware must branch `TokenExpiredError` → `TOKEN_EXPIRED` **before** `JsonWebTokenError` → `AUTH_REQUIRED`, or expiry gets mislabelled. **Alternative rejected:** putting the verifier inside `domains/auth/` and re-exporting it — that would force other domains to import across a restricted zone (ESLint error) or duplicate the verifier, so the shared-middleware home is the only viable placement.

For the R8 supertest suites, `app.ts:28` currently calls `app.listen()` unconditionally at import and exports only `{ app }`, so importing it in tests leaks an open server handle. I resolve this by guarding the `listen()` call behind `env.NODE_ENV !== 'test'` (Jest sets `NODE_ENV=test`; `env.ts:18` already accepts `'test'`). **Alternative rejected:** exporting `server` and calling `server.close()` in each suite's `afterAll` — more test boilerplate and easy to forget, whereas the guard fixes it once at the source without reordering any middleware.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | File(s) (`path:line`)                                      | R-ids                  | Type   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | ------ |
| 1   | Create the auth entities file: JWT payload type (`{ sub: string; email: string }`) plus a typed re-export of `User` from `@occ/shared` (`z.infer<typeof UserSchema>`). No framework imports.                                                                                                                                                                                                                                                                                                                                                         | `backend/src/domains/auth/auth.schema.ts`                  | R1, R5                 | create |
| 2   | Create the Express-free service: `login(email,password)` checks fixed creds `test@occ.com.mx`/`Test1234` (else `throw new AppError('INVALID_CREDENTIALS', …)`), signs `jwt.sign({ sub:'1', email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })`, returns `{ token, user }`; `getUserFromPayload(payload)` maps the verified payload to `User`; owns module-level `blacklist = new Set<string>()` with `logout(token)` and `isBlacklisted(token)`. Reuses `AppError` (`errors.ts:30-40`), `env` (`env.ts:23`).                                | `backend/src/domains/auth/auth.service.ts`                 | R1, R2, R5, R6         | create |
| 3   | Create the reusable Bearer-JWT verifier middleware: read `Authorization` header (missing/non-Bearer → `AppError('AUTH_REQUIRED')`), `jwt.verify(token, env.JWT_SECRET)`, then check blacklist via `authService.isBlacklisted(token)` → `AUTH_REQUIRED`; on verify failure branch `err instanceof jwt.TokenExpiredError → TOKEN_EXPIRED` **before** `jwt.JsonWebTokenError → AUTH_REQUIRED`; attach the resolved user + raw token to `req` via an Express `Request` augmentation (`declare global` merge, no `any`, no `!`). Keeps branch count ≤ 10. | `backend/src/middleware/auth.middleware.ts`                | R4, R5, R6             | create |
| 4   | Create the HTTP router: `POST /login` with `validate({ body: LoginRequestSchema })` then `success(res, { token, user })`; `GET /me` behind `authMiddleware` → `success(res, req.user)`; `POST /logout` behind `authMiddleware` → `authService.logout(req.token)` then `success`. No business logic; uses `validate` (`validation.middleware.ts:24`), `success` (`response.ts:3`).                                                                                                                                                                    | `backend/src/domains/auth/auth.router.ts`                  | R1, R3, R5, R6         | create |
| 5   | Mount the router: uncomment/replace the placeholder at `app.ts:20` with `import { authRouter }` + `app.use('/auth', authRouter)` inside the domain zone (lines 19-24), strictly before `app.use(errorMiddleware)` (`app.ts:26`, stays last).                                                                                                                                                                                                                                                                                                         | `backend/src/app.ts:2,20`                                  | R7                     | edit   |
| 6   | Guard the server bootstrap so supertest can import `{ app }` without leaking an open handle: wrap `app.listen(...)` (`app.ts:28-30`) in `if (env.NODE_ENV !== 'test')`. No middleware reorder; `errorMiddleware` stays last; `export { app }` unchanged.                                                                                                                                                                                                                                                                                             | `backend/src/app.ts:28`                                    | R8                     | edit   |
| 7   | Unit-test the auth middleware: valid token → attaches user + calls `next`; missing/non-Bearer header → `AppError('AUTH_REQUIRED')` (401); malformed/invalid signature → `AUTH_REQUIRED`; **expired token → `TOKEN_EXPIRED`** (asserts the branch order); blacklisted token → `AUTH_REQUIRED`. Follows the `toBeInstanceOf(AppError)`/`.code`/`.status` style of `validation.middleware.test.ts:11-25`.                                                                                                                                               | `backend/src/middleware/__tests__/auth.middleware.test.ts` | R4, R6, R8             | test   |
| 8   | Integration-test the flows with supertest against `{ app }` from `app.ts:41`: login valid → 200, body parses against `LoginResponseSchema` and token verifies; login wrong creds → 401 `INVALID_CREDENTIALS` (parse `ApiErrorSchema`); login missing/malformed body → 422 `VALIDATION_ERROR`; `/me` with valid token → 200 parses `MeResponseSchema`; `/me` no token → 401 `AUTH_REQUIRED`; logout then reuse token on `/me` → 401.                                                                                                                  | `backend/src/domains/auth/__tests__/auth.router.test.ts`   | R1, R2, R3, R5, R6, R8 | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

**New-file justifications (all surfaced in research §"New files this feature creates"):**

- `auth.schema.ts`, `auth.service.ts`, `auth.router.ts` — the three A1-Decision-4 layers of the auth domain (research row set, `path` = `backend/src/domains/auth/*`).
- `auth.middleware.ts` — reusable verifier deliberately at `backend/src/middleware/` (shared, outside domain zones) so jobs/apply/favorites import it without hitting `.eslintrc.js:70-86` (research §Constraints).
- The two `__tests__/` files — required test placement per `package.json:26-27` (`testMatch` only picks up `__tests__/**/*.test.ts`).

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 1, 2, 4, 8           |
| R2   | must     | 2, 8                 |
| R3   | must     | 4, 8                 |
| R4   | must     | 3, 7                 |
| R5   | must     | 1, 2, 3, 4, 8        |
| R6   | must     | 2, 3, 4, 7, 8        |
| R7   | must     | 5                    |
| R8   | must     | 6, 7, 8              |

- [x] Every `must` requirement is covered by ≥1 change. (R1–R8 all `must`, all covered.)
- [x] Every planned change cites ≥1 requirement (no orphans). Change 6 exists solely to make R8's supertest import leak-free — it cites R8, not scope creep.

## Tests to add or update

- `backend/src/middleware/__tests__/auth.middleware.test.ts` — unit-asserts the verifier: valid → user attached + `next()`; missing/non-Bearer → `AUTH_REQUIRED`; invalid signature → `AUTH_REQUIRED`; **expired → `TOKEN_EXPIRED`** (guards the inheritance trap, R4); blacklisted → `AUTH_REQUIRED` (R6). Uses `AppError` instance/`.code`/`.status` assertions (R4, R6, R8).
- `backend/src/domains/auth/__tests__/auth.router.test.ts` — supertest end-to-end: login valid 200 + token verifies + `LoginResponseSchema.parse` (R1); login invalid 401 `INVALID_CREDENTIALS` (R2); body validation 422 `VALIDATION_ERROR` (R3); `/me` valid 200 + `MeResponseSchema.parse` (R5); `/me` no token 401 `AUTH_REQUIRED` (R5); logout → reuse `/me` 401 (R6). All error bodies parsed against `ApiErrorSchema` (R8).

## Risks & rollback

- **R4 branch order (correctness).** `TokenExpiredError extends JsonWebTokenError` (per `jsonwebtoken`'s types); a `JsonWebTokenError`-first check swallows expiry as `AUTH_REQUIRED` and fails R4. Mitigation: change 3 checks `TokenExpiredError` first; change 7 asserts an actually-expired token yields `TOKEN_EXPIRED`. If verify still mislabels, the fix is local to `auth.middleware.ts` — revert that one file, no cross-file blast radius. (`NotBeforeError` also extends `JsonWebTokenError` and correctly falls through to `AUTH_REQUIRED`.)
- **`req.user` typing without `any`.** The augmentation lives in `auth.middleware.ts` (`declare global` module merge). If the merge doesn't apply globally, the router's `req.user`/`req.token` access won't type-check. Mitigation: keep the augmentation in the middleware file the router already imports so the declaration is loaded; rollback is isolated to that file.
- **`app.listen()` open handle (R8).** Without change 6, importing `{ app }` in supertest boots a real server on `PORT` → Jest open-handle warning / port collision. Mitigation: the `env.NODE_ENV !== 'test'` guard (Jest sets `NODE_ENV=test`; `env.ts:18` accepts it). Rollback: remove the guard and add `server.close()` in each suite's `afterAll` (the rejected alternative) — behaviour-equivalent, no other file touched. The guard changes only the bootstrap; `errorMiddleware` stays last and no middleware is reordered.
- **Blacklist is single-instance in-memory (sanctioned tech debt, A1 Decision 5).** Not persisted, not shared across instances; must be documented as such in `auth.service.ts` (a comment), not "fixed." No rollback needed — it is the intended design.
- **Guardrail regressions.** Any `any`, non-null `!`, `console.*`, cross-domain import, or complexity > 10 fails the verify gate. Mitigation: service Express-free, header/token parsing guards instead of `!`, verifier branches factored to stay ≤ 10, verifier lives outside domain zones. Each new file is independently revertible.

## Handoff to IMPLEMENT

1. Create `backend/src/domains/auth/auth.schema.ts` — JWT payload type + `User` re-export from `@occ/shared` (R1, R5).
2. Create `backend/src/domains/auth/auth.service.ts` — fixed-cred check, `jwt.sign`, blacklist `Set`, `logout`/`isBlacklisted`, `getUserFromPayload`; throws `AppError`; Express-free (R1, R2, R5, R6).
3. Create `backend/src/middleware/auth.middleware.ts` — Bearer parse → `jwt.verify` → blacklist check; `TokenExpiredError`→`TOKEN_EXPIRED` before `JsonWebTokenError`→`AUTH_REQUIRED`; `Request` augmentation attaches `user`+`token` (R4, R5, R6).
4. Create `backend/src/domains/auth/auth.router.ts` — `/login` (`validate`+`success`), `/me` and `/logout` behind `authMiddleware` (R1, R3, R5, R6).
5. Edit `backend/src/app.ts:20` — import `authRouter`, `app.use('/auth', authRouter)` in the domain zone, `errorMiddleware` stays last (R7).
6. Edit `backend/src/app.ts:28` — wrap `app.listen(...)` in `if (env.NODE_ENV !== 'test')` (R8).
7. Add `backend/src/middleware/__tests__/auth.middleware.test.ts` — valid/missing/invalid/expired/blacklisted (R4, R6, R8).
8. Add `backend/src/domains/auth/__tests__/auth.router.test.ts` — supertest login/me/logout flows, parse against `@occ/shared` schemas (R1, R2, R3, R5, R6, R8).
9. Run typecheck + lint + `jest` — confirm no `any`/`!`/`console`/cross-domain/complexity violations and all suites green.

## Sign-off

- [x] Plan reviewed — full-auto mode 2026-07-01; every `must` (R1–R8) covered, no orphan changes, tests tied to R-ids. Proceeding to IMPLEMENT.
