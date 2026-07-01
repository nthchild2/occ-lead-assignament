# Spec · be-auth

- **Feature id:** `be-auth`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §2.2 (Auth endpoints); `docs/work/ROADMAP.md` (Epic A); A1 Decision 3/4
- **Depends on:** `be-core` (AppError, error-code taxonomy, `validate` middleware, `env` config)

## Summary

Implement the auth domain as a self-contained module under `backend/src/domains/auth/` (router + service + schema, Clean-Architecture layered per A1 Decision 4): login against fixed mock credentials issuing a 1-hour JWT, an authenticated `GET /auth/me`, and logout that blacklists the token in memory. Add a reusable JWT-verifying auth middleware that other domains (jobs/apply/favorites) will consume. All endpoints use the shared `{ data }` / `{ error }` envelope via `be-core`.

Fixed credentials: `test@occ.com.mx` / `Test1234`.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                   | Source       | Acceptance criterion                                                                                                                 | Priority |
| --- | ------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| R1  | `POST /auth/login` validates credentials against the fixed mock user and issues a JWT on success | PDF §2.2     | Valid creds → 200 `{ data: { token, user } }` (matches `LoginResponseSchema`); the JWT verifies and expires in 1h                    | must     |
| R2  | `POST /auth/login` rejects invalid credentials                                                   | PDF §2.2/2.3 | Wrong email or password → 401 `{ error: { code: 'INVALID_CREDENTIALS', … } }`                                                        | must     |
| R3  | Login request body is validated                                                                  | PDF §2.3     | Missing/malformed `email`/`password` → 422 `VALIDATION_ERROR` (via `be-core` `validate` middleware + `LoginRequestSchema`)           | must     |
| R4  | An auth middleware verifies the Bearer JWT and attaches the authenticated user to the request    | PDF §2.2     | Valid token → handler runs with the user available; missing/invalid token → 401 `AUTH_REQUIRED`; expired token → 401 `TOKEN_EXPIRED` | must     |
| R5  | `GET /auth/me` (authenticated) returns the current user                                          | PDF §2.2     | With a valid token → 200 `{ data: user }` (matches `MeResponseSchema`); without → 401 `AUTH_REQUIRED`                                | must     |
| R6  | `POST /auth/logout` (authenticated) invalidates the token via an in-memory blacklist             | PDF §2.2     | After logout, reusing the same token on any authenticated endpoint → 401; blacklist is checked by the auth middleware                | must     |
| R7  | The auth router is mounted in `app.ts`                                                           | PDF §2.2     | `app.ts` mounts the router at `/auth` (before the error middleware, which stays last)                                                | must     |
| R8  | Integration tests (supertest) for the auth flows                                                 | PDF §3, A4   | Tests assert: login valid → 200 + token, login invalid → 401, me valid → 200, me missing/expired → 401, logout then reuse → 401      | must     |

## Explicitly out of scope

- **Jobs / applications / favorites** — their own tickets. This ticket only provides the auth middleware they will import.
- **Refresh tokens, real user store, password hashing** — the brief specifies fixed mock credentials; no DB.
- **Blacklist persistence across instances** — in-memory only (A1 documents this as conscious tech debt: Redis/DynamoDB in production).
- **App-side auth (`auth.store`, login screen)** — `app-auth-store` / `login-screen`.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] JWT payload shape → **resolution:** carry `sub` (user id) and `email`; `GET /auth/me` returns the user derived from the verified token. Fixed user id (e.g. `'1'`).
- [x] JWT expiry source → **resolution:** use `env.JWT_EXPIRES_IN` (default `'1h'` from `be-core`) and `env.JWT_SECRET`.
- [x] Blacklist scope → **resolution:** a module-level in-memory `Set` of tokens (or jti); documented as single-instance tech debt per A1.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
