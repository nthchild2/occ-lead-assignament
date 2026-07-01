# Implementation Report · be-jobs

- **Feature id:** `be-jobs`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `docs/MAP.md`
- **Implementer:** implementer subagent
- **Date:** 2026-07-01

## Changes made

| File (`path`)                                                   | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | R-ids                  | Plan step |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------- |
| `backend/src/domains/jobs/jobs.schema.ts` (new)                 | Re-exports shared `Job`/`JobFilters`/`Pagination`/`JobListResponse`/`JobDetailResponse`; defines `SortMode` from the shared filter enum; defines backend-only `JobQuerySchema` (`q`/`city` optional strings, `salary_min`/`salary_max`/`page`/`limit` via `z.coerce.number()`, 5-value `sort` enum default `date_desc`, `page` default 1, `limit` default 20) and `JobParamsSchema` (`{ id: z.string() }`). `@occ/shared` untouched.                                                              | R7                     | 1         |
| `backend/src/domains/jobs/jobs.seed.ts` (new)                   | Exports `const jobs: Job[]` with 96 deterministic `JobSchema`-shaped rows (stable ids `job-01`..`job-96`); 16 rows (~17%) with `salary: null`; 96 distinct ISO `publishedAt` values; 10 MX cities (CDMX, Guadalajara, Monterrey, Puebla, Querétaro, Tijuana, Mérida, León, Cancún, Remoto) and realistic tag sets. 5 pages at limit=20.                                                                                                                                                           | R1                     | 2         |
| `backend/src/domains/jobs/jobs.service.ts` (new)                | Express-free `list(filters)` = filter (`q` case-insensitive substring over title OR company; `city` case-insensitive exact; salary range excluding `salary === null` when either bound present) → sort (typed `Record<SortMode, comparator>`; `relevance` = title>company score, `publishedAt` desc tiebreak, `date_desc` fallback when `q` absent; nulls sort last for salary) → offset paginate (`total`/`hasNext`/`hasPrev`). `getById(id)` returns the job or throws `AppError('NOT_FOUND')`. | R2, R3, R4, R5, R6, R8 | 3         |
| `backend/src/domains/jobs/jobs.router.ts` (new)                 | Only Express-touching file. `GET /` with `validate({ query: JobQuerySchema })` → `success(res, jobsService.list(filters))`; `GET /:id` with `validate({ params: JobParamsSchema })` → `success(res, jobsService.getById(id))`. Public — no `authMiddleware`.                                                                                                                                                                                                                                      | R2, R7, R8, R9         | 4         |
| `backend/src/app.ts`                                            | Imported `jobsRouter` and replaced the `// app.use('/jobs', jobsRouter)` placeholder with the real mount `app.use('/jobs', jobsRouter)`, kept before `errorMiddleware`; no `authMiddleware` added.                                                                                                                                                                                                                                                                                                | R9                     | 5         |
| `backend/src/domains/jobs/__tests__/jobs.service.test.ts` (new) | Unit-tests the service: `q` title/company case-insensitive, `city` exact match, salary range + null-salary exclusion (min/max/both), all 5 sorts (incl. `relevance` title>company, tiebreak, and `q`-absent fallback), pagination boundaries (first/middle/last/beyond), and `getById` 404. Plus seed-integrity assertions (≥90 rows, ≥4 pages, some null + some priced).                                                                                                                         | R10                    | 6         |
| `backend/src/domains/jobs/__tests__/jobs.router.test.ts` (new)  | Supertest against `{ app }`: `GET /jobs` 200 parsed through `JobListResponseSchema` (+ coerced `page`/`limit` numbers), 422 `VALIDATION_ERROR` for `page=abc` and out-of-enum `sort`; `GET /jobs/:id` 200 parsed through `JobDetailResponseSchema`, 404 `NOT_FOUND` for unknown id.                                                                                                                                                                                                               | R2, R7, R8, R10        | 7         |

## Traceability

| R-id | Satisfied by (file)                                                                                             | Notes                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| R1   | `backend/src/domains/jobs/jobs.seed.ts` + `__tests__/jobs.service.test.ts`                                      | 96 jobs, 16 null-salary (~17%), 96 distinct ISO dates, 10 MX cities; 5 pages at limit=20 (≥4).          |
| R2   | `backend/src/domains/jobs/jobs.service.ts` (`list`/`paginate`), `jobs.router.ts`, both test files               | Offset paging; `page`/`limit` default 20; `total`/`hasNext`/`hasPrev` computed; envelope via `success`. |
| R3   | `backend/src/domains/jobs/jobs.service.ts` (`matchesQuery`)                                                     | Case-insensitive substring over title OR company.                                                       |
| R4   | `backend/src/domains/jobs/jobs.service.ts` (`matchesCity`)                                                      | Case-insensitive exact match.                                                                           |
| R5   | `backend/src/domains/jobs/jobs.service.ts` (`matchesSalary`)                                                    | `salary === null` excluded when `salary_min` or `salary_max` present; range applied otherwise.          |
| R6   | `backend/src/domains/jobs/jobs.service.ts` (`comparatorFor`/`relevanceScore`)                                   | 5 modes; `relevance` title>company + `publishedAt` desc tiebreak; `date_desc` fallback when no `q`.     |
| R7   | `backend/src/domains/jobs/jobs.schema.ts` (`JobQuerySchema`), `jobs.router.ts`, `__tests__/jobs.router.test.ts` | `z.coerce.number()` coerces string params; `validate` returns 422 for malformed query.                  |
| R8   | `backend/src/domains/jobs/jobs.service.ts` (`getById`), `jobs.router.ts`, both test files                       | Existing id → 200 `JobDetailResponseSchema`; unknown id → `AppError('NOT_FOUND')` → 404.                |
| R9   | `backend/src/domains/jobs/jobs.router.ts` + `backend/src/app.ts`                                                | Mounted at `/jobs` before `errorMiddleware`; public (no `authMiddleware`).                              |
| R10  | `backend/src/domains/jobs/__tests__/jobs.service.test.ts` + `__tests__/jobs.router.test.ts`                     | Filters (incl. null-exclusion), all 5 sorts, pagination boundaries, 404, 200/422 wire shapes.           |

## Deviations from the plan

- **Step 1 → `JobQuerySchema` numeric fields add `.int().positive()` to `page`/`limit`.** The plan specified `z.coerce.number()` with defaults 1/20. I kept the coercion and defaults but added `.int().positive()` on `page`/`limit` so a garbage value like `page=abc` (which coerces to `NaN`) reliably fails validation → 422, satisfying R7's acceptance criterion. `salary_min`/`salary_max` stay plain `z.coerce.number().optional()` per the plan. This is a tightening within the same schema, not a design change; no `@occ/shared` edit.

## Anything left for a follow-up

- **apply / favorites endpoints** — explicitly out of scope (`be-apply-fav` ticket); not built.
- **Persisting/mutating jobs** — read-only seed by design; no create/update/delete.
- The `security/detect-object-injection` warnings on `comparators[sort]` (`jobs.service.ts`) and on `items[i]` array reads in the service test are `warn`-level only and match the established codebase pattern (e.g. `errors.ts:38` `ERROR_STATUS[code]`, which the plan cited as precedent). Left as-is to stay consistent with the plan's typed-`Record` approach — not an error, does not fail the gate.

## Handoff to VERIFY

- **Workspaces touched (for `tsc`):** `backend` (plus a type-only re-export from `packages/shared`; shared source unchanged).
- **New/changed tests to run:**
  - `backend/src/domains/jobs/__tests__/jobs.service.test.ts`
  - `backend/src/domains/jobs/__tests__/jobs.router.test.ts`
- **Self-checks run (not a verification claim):**
  - `pnpm --filter '@occ/backend' run typecheck` → clean.
  - `env -u JWT_SECRET pnpm --filter '@occ/backend' run test` → 7 suites / 52 tests pass (jobs suites plus pre-existing auth/middleware/lib suites, no regressions). The `AppError: Expected number, received nan` line in the log is the error-middleware log for the intentional `page=abc` 422 test.
  - `pnpm lint` → 0 errors, 12 warnings (all `security/detect-object-injection`, warn-level, consistent with existing code).
- **Pay special attention to:** the backend-only `JobQuerySchema` coercion (`@occ/shared` deliberately untouched — R7 resolution); the null-salary exclusion in `matchesSalary` and null-last ordering in `bySalary`; the `relevance` `q`-absent fallback to `date_desc`; and that `/jobs` is mounted public (no auth) before `errorMiddleware`.
