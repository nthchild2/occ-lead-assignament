# Verification Report · be-apply-fav

- **Feature id:** `be-apply-fav`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier subagent (fresh context, independent of implementer)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

Each row was confirmed by reading the actual source files directly (not the impl-report's claims).

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                                   |
| ---- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `applications.router.ts:26-42` — `POST /:id/apply`, `authMiddleware` + `validate({params})`; `applications.service.ts:43-58` `apply()` calls `getJob(jobId)` first (propagates 404 for a bogus job)                                                                                                                     |
| R2   | must     | ✅          | `applications.service.ts:47-49` — `if (applications.has(jobId)) throw new AppError('ALREADY_APPLIED', ...)`. Mutation-tested (see §Findings) — confirmed to actually fail a test when broken                                                                                                                            |
| R3   | must     | ✅          | `applications.router.ts:44-56` — `DELETE /:id/apply`; `applications.service.ts:61-67` `cancel()` throws `NOT_FOUND` if absent, else deletes                                                                                                                                                                             |
| R4   | must     | ✅          | `applications.router.ts:62-74` — `GET /` on the list router mounted at `/applications`; `applications.service.ts:70-72` returns `{ items }`, each item embeds `job` (set in `apply()` line 51-55)                                                                                                                       |
| R5   | must     | ✅          | `favorites.router.ts:26-42` — `POST /:id/favorite`; `favorites.service.ts:42-51` `favorite()` calls `getJob(jobId)` (404) then throws `ALREADY_FAVORITED` on dupe                                                                                                                                                       |
| R6   | must     | ✅          | `favorites.router.ts:44-56` — `DELETE /:id/favorite`; `favorites.service.ts:54-60` `unfavorite()` throws `NOT_FOUND` if absent                                                                                                                                                                                          |
| R7   | must     | ✅          | `favorites.router.ts:62-74` — `GET /` on the list router mounted at `/favorites`; `favorites.service.ts:63-65` maps stored job ids through `getJob` into full `Job[]`                                                                                                                                                   |
| R8   | must     | ✅          | All 6 routes (apply POST/DELETE, favorite POST/DELETE, both GET lists) mount `authMiddleware` + the `if (!req.user) throw AppError('AUTH_REQUIRED', ...)` guard, verified by direct read of both router files                                                                                                           |
| R9   | must     | ✅          | Verified independently by grep + full read — see §Injection boundary below. Zero real `domains/jobs` imports in applications/favorites service/router files; `Map`-keyed per-user state confirmed                                                                                                                       |
| R10  | must     | ✅          | `backend/src/app.ts:33-40` — `const getJob = jobsService.getById`; four routers mounted (`createApplicationsActionsRouter`, `createFavoritesActionsRouter` at `/jobs`; `createApplicationsListRouter` at `/applications`; `createFavoritesListRouter` at `/favorites`), all above `app.use(errorMiddleware)` at line 43 |
| R11  | must     | ✅          | `applications.router.test.ts` (5 tests) and `favorites.router.test.ts` (5 tests) — both exercise apply/favorite → dupe(409) → cancel/remove → re-cancel/re-remove(404), bogus-job 404, unauthenticated 401, and list-shape parsing. Ran green in a clean shell (9/9 suites, 62/62 tests)                                |

- [x] **No gaps** — every `must` requirement (R1–R11) has ≥1 confirmed change.
- [x] **No orphans** — every new file traces to the ledger: `applications.schema.ts`/`service.ts`/`router.ts` → R1–R4,R9; `favorites.schema.ts`/`service.ts`/`router.ts` → R5–R7,R9; both `__tests__` files → R11; `app.ts` edit → R9,R10. `git status --short` shows exactly `backend/src/app.ts` (modified) + the two new domain directories — nothing else changed for this feature.
- [x] Out-of-scope items from the ledger were **not** implemented: no `app/` (frontend) activity-stores/screens exist (`find app -iname "*activit*"` → empty); `packages/shared`, `backend/src/domains/jobs`, `backend/src/domains/auth` all show zero diff (`git status --short` on each → empty). No persistence layer was added (in-memory `Map`/`Set` only, as scoped).

## 2 · Citation spot-check

| Cited claim                                                                                                                                       | `path:line`                                              | Holds up?                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApplicationSchema` / `ApplicationListResponseSchema` / `FavoriteListResponseSchema` shapes                                                       | `packages/shared/src/schemas/application.schema.ts:4-20` | ✅ — read the file; exact shapes match (`{jobId, appliedAt, job}`, `{data:{items}}` twice)                                                                                        |
| `getById(id): Job` throws `AppError('NOT_FOUND')` when absent — the function injected as `getJob`                                                 | `backend/src/domains/jobs/jobs.service.ts:116-123`       | ✅ — confirmed: `if (!job) throw new AppError('NOT_FOUND', ...)` at line 120                                                                                                      |
| Reference pattern for a protected route: `authMiddleware` + `if (!req.user) throw AppError('AUTH_REQUIRED')`                                      | `backend/src/domains/auth/auth.router.ts:26-39`          | ✅ — confirmed present verbatim (`/me` and `/logout` handlers)                                                                                                                    |
| `.eslintrc.js` `import/no-restricted-paths` has **no** zone for `applications\|favorites → jobs`; only `→ auth` zones exist, `favorites` unlisted | `.eslintrc.js:70-86`                                     | ✅ — confirmed: exactly two zones, both `from: domains/auth`, targeting `domains/jobs` and `domains/applications` respectively. No `favorites` zone, no `jobs`-target zone at all |
| `backend/src/app.ts:22-25` composition point (mounts + injection wiring)                                                                          | `backend/src/app.ts` (current, post-implementation)      | ✅ — current file shows the described wiring at lines 33-40, matching the plan's intent (line numbers shifted post-edit as expected, since this cite predates the edit)           |

All sampled citations are accurate and relevant, not just path-exists.

## 3 · Tooling gate

Run in a clean shell (`env -i HOME="$HOME" PATH="$PATH" bash -lc '...'`), independent of any pre-loaded environment.

| Check           | Command                                                | Result                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (backend) | `pnpm --filter './backend' run typecheck`              | ✅ PASS — `tsc --noEmit`, zero output, zero errors                                                                                                                                                                                                                                                            |
| Lint            | `pnpm lint`                                            | ✅ PASS — `eslint . --ext .ts,.tsx` → `✖ 12 problems (0 errors, 12 warnings)`; all 12 warnings are pre-existing `security/detect-object-injection` in `jobs.service.ts`, `jobs.service.test.ts`, `errors.ts`, `errors.test.ts`, `validation.middleware.ts` — **none** in the new applications/favorites files |
| Tests           | `env -u JWT_SECRET pnpm --filter './backend' run test` | ✅ PASS — `Test Suites: 9 passed, 9 total`, `Tests: 62 passed, 62 total`, including `src/domains/applications/__tests__/applications.router.test.ts` and `src/domains/favorites/__tests__/favorites.router.test.ts`                                                                                           |

App workspace (`./app`) typecheck was not run — this ticket makes no changes under `app/`, consistent with the impl-report's handoff ("Workspaces touched: backend").

## Injection boundary (A1 Decision 3) — independently verified

This is the central risk this ticket flagged: eslint's `import/no-restricted-paths` (confirmed above) has **no zone** blocking `domains/applications`/`domains/favorites` from importing `domains/jobs`, so a green lint does not prove the boundary holds. Verified independently, not from the report:

```
grep -rn "domains/jobs" backend/src/domains/applications backend/src/domains/favorites --include='*.ts'
```

→ 4 hits, **all inside doc comments** explaining what is _not_ imported (e.g. `applications.service.ts:8`: `* importing 'domains/jobs' directly, so the applications domain stays decoupled`). Zero real `import` statements.

```
grep -rn "jobs.service|jobsService|jobsRouter" backend/src/domains/applications backend/src/domains/favorites --include='*.ts'
```

→ 0 hits for `jobs.service`; 2 hits for `jobsRouter`, both inside doc comments (`/** ... mounted at '/jobs' alongside the public 'jobsRouter'. */`).

Full listing of every `import` statement in `applications.schema.ts`, `applications.service.ts`, `applications.router.ts`, `favorites.schema.ts`, `favorites.service.ts`, `favorites.router.ts` (12 imports total): all from `express`, `zod`, `@occ/shared`, `../../lib/*`, `../../middleware/*`, or sibling files within the same domain. **Zero** import of anything under `domains/jobs`.

```
grep -rln "domains/jobs" backend/src --include='*.ts'
```

→ exactly 5 files: `app.ts` (the composition root — the only legitimate real import, `jobsService.getById`) plus the 4 domain files above (comment-only mentions). No other file in the codebase imports `domains/jobs` from applications/favorites.

Test files (`applications.router.test.ts`, `favorites.router.test.ts`) import `../../jobs/jobs.seed` for fixture data (a real `job-01`/`job-02` id) — this is test-only, mirrors the existing `jobs.router.test.ts` precedent, and is not a service/router-level coupling to the jobs domain's logic.

**Conclusion: the injection boundary holds.** `getJob` is threaded exclusively through router factory parameters (`createApplicationsActionsRouter({ getJob })` etc.) down into `createApplicationsService({ getJob })` / `createFavoritesService({ getJob })`; the only place `jobsService.getById` is referenced is `app.ts:33`.

## State isolation per user

`applications.service.ts` uses `Map<string, Map<string, Application>>` keyed by `userId` via `applicationsFor(userId)` (lazy-create-on-first-access, `applications.service.ts:23-30`); `favorites.service.ts` uses `Map<string, Set<string>>` keyed by `userId` via `favoritesFor(userId)` (`favorites.service.ts:24-31`). Every service method takes `userId` as its first parameter, sourced only from `req.user.id` (set by `authMiddleware` from the verified JWT). There is no code path where one user's map/set entry is read or written using another user's id — isolation is structural, not incidental. Not exercised by an explicit two-user integration test in this ticket, but the keying is provably correct by inspection and consistent with the `auth.service.ts:22` in-memory `Set` precedent cited in research.

## 409/404 semantics — mutation-tested

Performed a live mutation test to confirm the 409 `ALREADY_APPLIED` path is genuinely exercised, not vacuously green:

1. Edited `applications.service.ts` to replace `if (applications.has(jobId))` with `if (false)`, disabling the duplicate-application check.
2. Ran `applications.router.test.ts` — result: **1 failed, 4 passed**. The failure was exactly the duplicate-apply assertion:
   ```
   Expected: 409
   Received: 200
   at src/domains/applications/__tests__/applications.router.test.ts:42:30
   ```
3. Reverted the file from a pre-mutation backup; confirmed `git diff` / grep show the original `ALREADY_APPLIED` throw restored intact (`applications.service.ts:47-49`).

This confirms the test suite is not tautological — it fails when the guarded behavior is broken, and the file is back to its verified state.

## No `any` / no non-null assertions

`grep -n "\bany\b"` and a non-null-assertion pattern grep across all 6 new source files + 2 new test files returned zero hits in both cases.

## Findings

- Two commented `domains/jobs` mentions in `applications.router.ts`/`favorites.router.ts` doc comments and the `jobsRouter` doc-comment reference are prose only, not real imports — confirmed harmless, listed above for full transparency.
- Test files' import of `jobs.seed` (not `jobs.service`) for fixture ids is a reasonable, precedented pattern (`jobs.router.test.ts`) and does not weaken the R9 boundary, which concerns runtime service/router coupling, not test fixtures.
- No explicit two-user (`req.user.id` A vs B) integration test exists for state isolation; the guarantee currently rests on code inspection of the `Map`-keying rather than an executed assertion. Not a blocking gap given the structural simplicity, but worth flagging as a nice-to-have for a follow-up hardening pass.
- Success-body shapes for mutations (`success(res, application)` for apply; `{ message: ... }` for cancel/favorite/unfavorite) are consistent with the spec's resolved ambiguity (`00-spec.md:41`) — no shared schema constrains these, only status codes are contractual, and status codes were verified via the integration tests.

## Verdict

- ✅ **PASS** — ready for human PR review.

**Reviewer summary (on pass):** Two new backend domains (`applications`, `favorites`) implement all 6 required endpoints (apply/cancel, favorite/unfavorite, both list views) with per-user in-memory state, full auth coverage, and correct 404/409 error semantics — all independently confirmed by direct code read, a live mutation test, and a clean-shell tooling run (tsc/eslint/jest all green, 62/62 tests). The R9 cross-domain injection boundary (the main architectural risk on this ticket) was independently verified: zero real imports of `domains/jobs` anywhere in the applications/favorites service or router files — `getJob` is threaded through router-factory params from the sole composition point in `app.ts`. This completes the backend API surface for Epic A.
