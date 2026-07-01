# Research · be-apply-fav

- **Feature id:** `be-apply-fav`
- **Inputs read:** `00-spec.md`, `docs/MAP.md`, `docs/A1 · Monorepo Architecture.md` (Decisions 3, 4), existing backend `auth`/`jobs` domains, `.eslintrc.js`, shared schemas
- **Researcher:** researcher subagent (read-only)
- **Date:** 2026-07-01

## Relevant files

| File (`path:line`)                                                         | Why it matters to this feature                                                                                                                | R-ids                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `packages/shared/src/schemas/application.schema.ts:4-8`                    | `ApplicationSchema` = `{ jobId, appliedAt (ISO datetime), job }`; each `GET /applications` item must match this exactly                       | R4                     |
| `packages/shared/src/schemas/application.schema.ts:10-14`                  | `ApplicationListResponseSchema` = `{ data: { items: Application[] } }`; the wire shape `GET /applications` returns                            | R4, R11                |
| `packages/shared/src/schemas/application.schema.ts:16-20`                  | `FavoriteListResponseSchema` = `{ data: { items: Job[] } }`; favorites list returns full `Job`s, not a favorite wrapper                       | R7, R11                |
| `packages/shared/src/schemas/application.schema.ts:22-27`                  | `ApiErrorSchema` = `{ error: { code, message } }`; error-envelope assertions in tests parse through this                                      | R11                    |
| `packages/shared/src/schemas/job.schema.ts:3-12`                           | `JobSchema` — the embedded/returned job shape; the injected lookup must return an object matching this                                        | R4, R7, R9             |
| `packages/shared/src/schemas/index.ts:1-3`                                 | Barrel; all four schemas are already re-exported as `@occ/shared` — no shared edits needed for this feature                                   | R4, R7                 |
| `backend/src/middleware/auth.middleware.ts:66-82`                          | `authMiddleware: RequestHandler` — the guard all six routes mount; attaches `req.user`/`req.token`, then `next()`                             | R8                     |
| `backend/src/middleware/auth.middleware.ts:14-22`                          | `declare global` Express `Request` augmentation exposing `user?: User` / `token?: string`; loaded via importing this module                   | R8, R9                 |
| `backend/src/lib/errors.ts:12-20`                                          | `ERROR_STATUS` maps `NOT_FOUND→404`, `ALREADY_APPLIED→409`, `ALREADY_FAVORITED→409`; all three codes this feature needs already exist         | R1, R2, R3, R5, R6     |
| `backend/src/lib/errors.ts:30-40`                                          | `AppError(code, message)` — the throwable services use; router/error-middleware do HTTP translation                                           | R1, R2, R3, R5, R6     |
| `backend/src/lib/response.ts:3-5`                                          | `success(res, data, status=200)` → `{ data }` envelope; used for all list + mutation success bodies                                           | R1, R3, R4, R5, R6, R7 |
| `backend/src/lib/response.ts:7-14`                                         | `fail(...)` — used only inside error middleware; services/routers never call it directly                                                      | —                      |
| `backend/src/domains/jobs/jobs.service.ts:116-123`                         | `getById(id): Job` — throws `AppError('NOT_FOUND')` when absent; this is the function INJECTED into the new services (not imported by them)   | R1, R5, R9             |
| `backend/src/domains/jobs/jobs.router.ts:1-32`                             | Domain router shape to mirror; note routes here are public (no `authMiddleware`) — the new routers add the guard                              | R1, R5, R10            |
| `backend/src/domains/auth/auth.router.ts:26-39`                            | Reference for a PROTECTED route: `authMiddleware` + `if (!req.user) throw AppError('AUTH_REQUIRED')` before reading `req.user`                | R8                     |
| `backend/src/domains/auth/auth.service.ts:22`                              | In-memory `Set` pattern (blacklist) — precedent for the per-user in-memory state the new services own (A1 tech debt)                          | R9                     |
| `backend/src/domains/auth/auth.schema.ts:11`                               | `export type { User }` re-export from `@occ/shared` — pattern for a domain `*.schema.ts` re-exporting wire types                              | R4, R7                 |
| `backend/src/domains/jobs/jobs.schema.ts:20-40`                            | Domain `*.schema.ts` re-exports `@occ/shared` types + adds backend-only param parsers (`JobParamsSchema`); mirror for `:id` params            | R1, R3, R5, R6         |
| `backend/src/middleware/validation.middleware.ts:24-41`                    | `validate({ params })` factory to parse `:id`; throws `VALIDATION_ERROR` (422) on failure, writes coerced data back                           | R1, R3, R5, R6         |
| `backend/src/middleware/error.middleware.ts:14-27`                         | Global handler renders `AppError` → its status + `{ code, message }`; MUST stay registered last in `app.ts`                                   | R10                    |
| `backend/src/app.ts:22-25`                                                 | Current mounts (`/auth`, `/jobs`) + commented placeholders for `/applications`, `/favorites`; composition point for injection + new mounts    | R9, R10                |
| `backend/src/app.ts:28`                                                    | `app.use(errorMiddleware)` — must remain last after the new mounts are added                                                                  | R10                    |
| `.eslintrc.js:70-86`                                                       | Backend `import/no-restricted-paths` zones — see "Constraints"; determines whether the new services may import `jobs` (they must NOT; inject) | R9                     |
| `backend/src/domains/jobs/__tests__/jobs.router.test.ts:1-67`              | Supertest integration pattern: parse responses through shared schemas, assert `ApiErrorSchema` for 404/422; `:id` path + not-found case       | R11                    |
| `backend/src/domains/auth/__tests__/auth.router.test.ts:11-16`             | `loginAndGetToken()` helper — obtain a real Bearer token for protected-route tests; reuse this pattern for the 401 / authed cases             | R11                    |
| `backend/src/domains/jobs/jobs.seed.ts:12-13`                              | Stable job ids (`job-01`..`job-96`); tests pin a real id for apply/favorite success and a bogus id for the 404 case                           | R11                    |
| `backend/jest.setup.ts:6`                                                  | Sets `JWT_SECRET` before any import so `config/env` parse + supertest `import { app }` don't throw; already covers the new suites             | R11                    |
| `backend/package.json` (jest block: `testMatch **/__tests__/**/*.test.ts`) | Backend jest only picks up tests under `__tests__/`; co-located backend tests are silently skipped — new tests go in `__tests__/`             | R11                    |

## Existing patterns to follow

- **Domain shape** → mirror `backend/src/domains/jobs/` and `backend/src/domains/auth/`: `*.router.ts` (Express, the only Express-touching file), `*.service.ts` (Express-free logic, throws `AppError`), `*.schema.ts` (re-export `@occ/shared` wire types + backend-only param parsers). See `jobs.service.ts:1-10` (Express-free doc) and `jobs.router.ts:8-17`.
- **Protected route** → follow `auth.router.ts:26-39`: mount `authMiddleware`, then guard `if (!req.user) throw new AppError('AUTH_REQUIRED', ...)` before reading `req.user` (`req.user` is optional per the augmentation, so the guard also satisfies `no-non-null-assertion`).
- **`:id` param parsing** → follow `jobs.router.ts:30-35` + `jobs.schema.ts:44-45` (`JobParamsSchema = z.object({ id: z.string() })`) via `validate({ params })` (`validation.middleware.ts:24-41`).
- **Not-found from a lookup** → `jobs.service.ts:119-125` already throws `AppError('NOT_FOUND')`; the injected `getById` carries that behavior, so a missing-job apply/favorite becomes 404 for free (R1/R5).
- **Success envelope** → `success(res, data)` (`response.ts:3-5`) for every 200; list payloads shaped `{ items: [...] }` so the outer `{ data }` matches `ApplicationListResponseSchema`/`FavoriteListResponseSchema`.
- **In-memory per-user state** → precedent `auth.service.ts:22` (`new Set<string>()`), non-persisted, cleared on restart (A1 Decision 5). Key applications/favorites state by user id (e.g. `Map<userId, Set<jobId>>`).
- **Integration test** → follow `jobs.router.test.ts:1-71` (parse through shared schemas, assert `ApiErrorSchema` on error) + `auth.router.test.ts:11-16` (`loginAndGetToken` for the authed and 401 cases). Files under `backend/src/domains/<domain>/__tests__/*.test.ts`.

## Constraints that apply

- **Cross-domain import boundary (the crux of R9).** `.eslintrc.js:70-86` defines only these backend zones:
  - `target: domains/jobs`, `from: domains/auth` (`.eslintrc.js:75-79`)
  - `target: domains/applications`, `from: domains/auth` (`.eslintrc.js:80-84`)

  Zone semantics: files _in_ `target` may not import _from_ `from`. **Consequence:** `domains/applications`/`domains/favorites` importing `domains/jobs` is **NOT currently eslint-blocked** — there is no `{ target: applications|favorites, from: jobs }` zone, and `favorites` has **no zone at all**. So an eslint pass does not by itself prove A1 Decision 3 compliance here. A1 Decision 3 (`docs/A1 · Monorepo Architecture.md:132`) still forbids the cross-domain internal import. **Recommendation:** honor the architecture doc, not just the linter — the new services must NOT import `jobs`; inject `getById` instead (R9). See "Risks & unknowns" for the eslint-zone gap the plan should flag/close.

- **Injection wiring (recommended).** Compose in `app.ts` (`backend/src/app.ts:22-25`): import `jobsService.getById` there and pass it into router factories, e.g. `createApplicationsRouter({ getJob: jobsService.getById })` / `createFavoritesRouter(...)`. The service functions then take the lookup as a parameter (closure/factory), never importing the jobs module. This keeps services decoupled AND makes eslint irrelevant to the boundary because the import lives only in the composition root (`app.ts`), which is not a domain. Mirrors A1 Decision 3's "replace direct import with a call" intent (`docs/A1 · Monorepo Architecture.md:134`).
- **Services must be Express-free** — A1 Decision 4 (`docs/A1 · Monorepo Architecture.md:159`); only `*.router.ts` imports Express (precedent `jobs.service.ts:1-10`).
- **Response envelope** — `{ data }` on success / `{ error: { code, message } }` on failure, no `ok` field (A1 Decision 6, via `response.ts` helpers).
- **No `any` / no non-null assertion** — `.eslintrc.js:13-14`; use `z.infer<>`/re-exported `@occ/shared` types and guard `req.user` rather than `req.user!`.
- **No `console.*`** — `.eslintrc.js:18`; use `backend/src/lib/logger.ts` if logging is needed (error middleware already logs).
- **Error middleware stays last** — `backend/src/app.ts:28`; new `app.use('/...')` mounts go above it (R10).
- **Backend tests under `__tests__/`** — jest `testMatch: **/__tests__/**/*.test.ts` (`backend/package.json`); co-located backend tests are silently skipped (MAP.md:59).

## Mounting recommendation (R10)

Routes span two path prefixes but belong to the applications/favorites domains. Cleanest mapping that matches the brief:

- Applications domain exposes two mounts from `app.ts`: an "action" router at `/jobs` handling `POST|DELETE /:id/apply`, and a "list" router at `/applications` handling `GET /`. Favorites likewise: action router at `/jobs` for `POST|DELETE /:id/favorite`, list router at `/favorites` for `GET /`.
- Express allows multiple routers mounted at the same base path (`/jobs`); the existing public `jobsRouter` at `backend/src/app.ts:23` coexists with the new authed apply/favorite routers at `/jobs`. Order the mounts so the more specific `:id/apply`/`:id/favorite` paths are reachable (they don't collide with `jobsRouter`'s `/` and `/:id` GETs since method+path differ).
- Alternative (simpler wiring): one router per domain that internally declares full paths and is mounted at `/` — but that diverges from the `app.use('/prefix', router)` precedent. Prefer the paired-mount approach above.

## What NOT to touch

- `packages/shared/src/schemas/*` — all needed schemas already exist and are exported (`application.schema.ts`, `job.schema.ts`, `index.ts`); editing shared breaks both consumers by design (A1 Decision 1). Read-only here.
- `backend/src/domains/jobs/*` and `backend/src/domains/auth/*` — reuse via injection (jobs) and middleware import (auth); do not modify their internals.
- `backend/src/lib/errors.ts` — the three codes already exist; no new codes needed.
- `backend/src/middleware/*` (`auth`, `validation`, `error`) — consume as-is.
- `backend/jest.setup.ts` — already provides `JWT_SECRET`; no change.
- App workspace (`app/`) — out of scope per spec ("Explicitly out of scope").

## Risks & unknowns

- **Eslint-zone gap (non-blocking, but the plan should decide).** The linter does NOT enforce A1 Decision 3 for `applications`/`favorites → jobs` (no such zone in `.eslintrc.js:70-86`; `favorites` unlisted entirely). Injection makes this moot for the services, but the plan may want to note/close the gap (e.g. add zones) so a future direct import is caught. Not blocking: the injection design keeps the jobs import out of the domains regardless.
- **`favorites` domain absent from A1's named list.** A1 Decision 3 (`docs/A1 · Monorepo Architecture.md:132`) enumerates `auth, jobs, applications` — `favorites` is a new sibling domain implied by the brief. Consistent with the "two domains" resolution in `00-spec.md:39`; no contradiction, just note the doc predates it.
- **Mutation success-body shape is under-specified** — resolved in `00-spec.md:41` (minimal `{ data }`, e.g. the created `Application` for apply or a `{ status }`). No shared schema constrains mutation responses, so the plan picks a minimal body; only the status codes are contractual.
- **`appliedAt` timestamp** — `ApplicationSchema` requires an ISO datetime string (`application.schema.ts:6`); the apply service must record `new Date().toISOString()` at apply time and preserve it in the list response.

No blocking ambiguities — the injection wiring, error codes, schemas, and mount points are all grounded in existing code.

## Handoff to PLAN

- Build two domains under `backend/src/domains/` (`applications/`, `favorites/`), each `*.router.ts`/`*.service.ts`/`*.schema.ts`, mirroring `jobs`/`auth`; services stay Express-free and throw `AppError`.
- Inject `jobsService.getById` (`backend/src/domains/jobs/jobs.service.ts:119`) from the composition root (`backend/src/app.ts:22-25`) via router factories — do NOT import `jobs` inside the new services (A1 Decision 3; eslint won't catch it, so this is on the plan).
- Reuse verbatim: `authMiddleware` (`auth.middleware.ts:66`) + the `if (!req.user)` guard pattern; `AppError` codes `NOT_FOUND`/`ALREADY_APPLIED`/`ALREADY_FAVORITED` (`errors.ts:12-20`); `success()` envelope; `validate({ params })` for `:id`.
- Wire shapes are fixed by `@occ/shared`: `GET /applications` → `ApplicationListResponseSchema` (`{ jobId, appliedAt, job }` items), `GET /favorites` → `FavoriteListResponseSchema` (full `Job` items). Record `appliedAt` as `new Date().toISOString()` at apply.
- Mount from `app.ts`: paired routers at `/jobs` (apply/favorite actions, authed) and at `/applications`/`/favorites` (lists); keep `errorMiddleware` last.
- Tests: supertest under each domain's `__tests__/`, parse through shared schemas + `ApiErrorSchema`, use `loginAndGetToken` for authed/401 cases, pin a real `job-01` id and a bogus id (R11 full matrix in `00-spec.md:27`).
