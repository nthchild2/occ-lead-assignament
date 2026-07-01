# Plan · be-jobs

- **Feature id:** `be-jobs`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner subagent
- **Date:** 2026-07-01

## Approach

Mirror the committed `be-auth` domain shape under `backend/src/domains/jobs/`: a router-only Express file, a pure Express-free service that owns all filter/sort/paginate/getById logic, a domain-internal `jobs.schema.ts`, and an in-memory `jobs.seed.ts`. The wire contract stays in `@occ/shared` untouched (`job.schema.ts:3-50`); the only new schema is a **backend-only** `JobQuerySchema` using `z.coerce.number()` (precedent `env.ts:15`) so `validate({ query })` (`validation.middleware.ts:24-41`) coerces string query params to numbers and reassigns `req.query` (line 36, safe on the installed Express 4.22.2). Sort dispatch uses a typed `Record<SortMode, comparator>` rather than nested branches to stay under complexity ≤ 10 (`.eslintrc.js:26`) and avoid the `security/detect-object-injection` warn (`.eslintrc.js:63`). **Rejected alternative:** re-validating the query against the shared `JobFiltersSchema` — its plain `z.number()` fields reject raw string query values before coercion, so it cannot serve as the request parser; keeping coercion backend-only also avoids editing `@occ/shared` (`00-spec.md:32,38`).

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | File(s) (`path:line`)                                           | R-ids                  | Type   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------- | ------ |
| 1   | Create `jobs.schema.ts`: re-export shared `Job`/`JobFilters`/`Pagination`/`JobListResponse`/`JobDetailResponse` from `@occ/shared`; define a local `SortMode` type from the enum; define backend-only `JobQuerySchema` (`q`/`city` optional strings, `salary_min`/`salary_max`/`page`/`limit` via `z.coerce.number()`, `sort` enum `.default('date_desc')`, `page` `.default(1)`, `limit` `.default(20)` — mirroring `job.schema.ts:22-33`) and a `JobParamsSchema` (`{ id: z.string() }`). No `@occ/shared` edit.                                                                                                                                                       | `backend/src/domains/jobs/jobs.schema.ts` (new)                 | R7                     | create |
| 2   | Create `jobs.seed.ts`: exported `const jobs: Job[]` of ≥90 rows satisfying `JobSchema` (`job.schema.ts:3-12`); ~15–20% with `salary: null`; varied ISO `publishedAt` across distinct dates; MX city set (`Ciudad de México, Guadalajara, Monterrey, Puebla, Querétaro, Tijuana, Mérida, León, Cancún, Remoto`) and realistic tag set. ≥90 rows → 5 pages at `limit=20` (≥4). No `!` non-null, no `any`.                                                                                                                                                                                                                                                                  | `backend/src/domains/jobs/jobs.seed.ts` (new)                   | R1                     | create |
| 3   | Create `jobs.service.ts` (Express-free): `list(filters: JobFilters)` = filter → sort → paginate; small filter helpers — `q` case-insensitive substring over title OR company, `city` case-insensitive exact match, salary range that excludes `salary === null` when `salary_min` or `salary_max` is present; sort via typed `Record<SortMode, comparator>` (`relevance` = title-match > company-match, `publishedAt` desc tiebreak when `q` present, `date_desc` when `q` absent); offset pagination computing `total`/`hasNext`/`hasPrev`. `getById(id)` returns the job or throws `AppError('NOT_FOUND')` (`errors.ts:12-40`). Reads `jobs.seed.ts`. Complexity ≤ 10. | `backend/src/domains/jobs/jobs.service.ts` (new)                | R2, R3, R4, R5, R6, R8 | create |
| 4   | Create `jobs.router.ts` (only Express-touching file, mirrors `auth.router.ts:14-24`): `Router()`; `GET /` with `validate({ query: JobQuerySchema })`, thin handler casts `req.query` to `JobFilters`, calls `jobsService.list`, `success(res, ...)` (`response.ts:3`); `GET /:id` with `validate({ params: JobParamsSchema })`, calls `jobsService.getById`, `success`. **No `authMiddleware`** (public).                                                                                                                                                                                                                                                                | `backend/src/domains/jobs/jobs.router.ts` (new)                 | R2, R7, R8, R9         | create |
| 5   | Edit `app.ts`: replace the commented placeholder `// app.use('/jobs', jobsRouter)` with the real mount `app.use('/jobs', jobsRouter)` and import `jobsRouter`. Keep `errorMiddleware` last; add no `authMiddleware`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `backend/src/app.ts:7,22,27`                                    | R9                     | edit   |
| 6   | Create `jobs.service.test.ts`: unit-test the service directly — `q` (title/company, case-insensitive), `city` exact match, `salary_min`/`salary_max` range + null-salary exclusion, all five sort modes (incl. `relevance` title>company + tiebreak, and `q`-absent fallback), pagination boundaries (`total`/`hasNext`/`hasPrev` on first/middle/last page), and `getById` 404.                                                                                                                                                                                                                                                                                         | `backend/src/domains/jobs/__tests__/jobs.service.test.ts` (new) | R10                    | test   |
| 7   | Create `jobs.router.test.ts`: supertest against `import { app }` (`app.ts:31-44`) mirroring `auth.router.test.ts:1-101` — `GET /jobs` 200 parsed through `JobListResponseSchema`; malformed query (`page=abc`, out-of-enum `sort`) → 422 with `ApiErrorSchema` `error.code === 'VALIDATION_ERROR'`; `GET /jobs/:id` 200 parsed through `JobDetailResponseSchema` and unknown id → 404 `NOT_FOUND`.                                                                                                                                                                                                                                                                       | `backend/src/domains/jobs/__tests__/jobs.router.test.ts` (new)  | R2, R7, R8, R10        | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 2                    |
| R2   | must     | 3, 4, 7              |
| R3   | must     | 3                    |
| R4   | must     | 3                    |
| R5   | must     | 3                    |
| R6   | must     | 3                    |
| R7   | must     | 1, 4, 7              |
| R8   | must     | 3, 4, 7              |
| R9   | must     | 4, 5                 |
| R10  | must     | 6, 7                 |

- [x] Every `must` requirement is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans). Change 1→R7, 2→R1, 3→R2-R6/R8, 4→R2/R7/R8/R9, 5→R9, 6→R10, 7→R2/R7/R8/R10.

## Tests to add or update

- `backend/src/domains/jobs/__tests__/jobs.service.test.ts` — asserts service filtering (`q` title/company case-insensitive substring **R3**, `city` case-insensitive exact **R4**, `salary_min`/`salary_max` range with `salary === null` exclusion **R5**), all five sort modes incl. `relevance` scoring + tiebreak and `q`-absent fallback **R6**, offset pagination math `total`/`hasNext`/`hasPrev` at boundaries **R2**, and `getById` throwing `AppError('NOT_FOUND')` **R8** — over the ≥90-row seed **R1**. Covers **R10**.
- `backend/src/domains/jobs/__tests__/jobs.router.test.ts` — asserts `GET /jobs` 200 body parses through `JobListResponseSchema` **R2**, malformed query → 422 `VALIDATION_ERROR` via `ApiErrorSchema` **R7**, `GET /jobs/:id` 200 parses `JobDetailResponseSchema` and unknown id → 404 `NOT_FOUND` **R8**. Covers **R10**.

## Risks & rollback

- **R7 — `req.query` reassignment.** Depends on Express 4.x semantics; research confirmed installed **4.22.2** (`req.query` writable, `validation.middleware.ts:36` succeeds). If a future bump to Express 5 makes `req.query` a getter, this would throw at runtime. _Rollback:_ changes 1/4 are additive new files and change 5 is a one-line mount — revert change 5 (restore the comment) to fully unmount jobs; no other domain is affected.
- **R6 complexity / `detect-object-injection`.** A single branching sort function could exceed complexity ≤ 10 or trip the security warn. Mitigated by the typed `Record<SortMode, comparator>` keyed on the narrowed enum (mirrors `errors.ts:38` indexing `ERROR_STATUS`). _Rollback:_ isolated to `jobs.service.ts` (change 3); revert the file if lint fails.
- **R1 seed realism / volume.** ≥90 rows with the null/date spread is hand-authored; a miscount could drop below 4 pages or leave no null-salary rows. _Rollback:_ `jobs.seed.ts` (change 2) is a standalone data file — edit or revert in isolation; the service/router are data-agnostic.
- **Type-checkability between steps.** Order 1→2→3→4→5 keeps the tree compiling: schema and seed have no intra-domain deps; service imports both; router imports service+schema; the `app.ts` mount imports the router last. Tests (6, 7) come after their targets exist.
- **General:** every new file is self-contained under `backend/src/domains/jobs/`; the only edit to existing code is the single `app.ts` mount line. Reverting all changes leaves `be-core`, `@occ/shared`, and `be-auth` untouched.

## Handoff to IMPLEMENT

1. `jobs.schema.ts` — re-export shared types; define `JobQuerySchema` (`z.coerce.number()`, enum/defaults per `job.schema.ts:22-33`) + `JobParamsSchema`; export `SortMode`. (R7)
2. `jobs.seed.ts` — export `const jobs: Job[]`, ≥90 rows, ~15–20% `salary: null`, varied ISO `publishedAt`, MX cities/tags; no `!`/`any`. (R1)
3. `jobs.service.ts` — Express-free `list(filters)` (filter helpers → `Record<SortMode, comparator>` sort → offset paginate) and `getById(id)` throwing `AppError('NOT_FOUND')`; complexity ≤ 10. (R2–R6, R8)
4. `jobs.router.ts` — mirror `auth.router.ts:14-24`; `GET /` `validate({ query: JobQuerySchema })`, `GET /:id` `validate({ params })`, both `success(res, …)`; no `authMiddleware`. (R2, R7, R8, R9)
5. `app.ts:22` — replace the placeholder comment with `app.use('/jobs', jobsRouter)` + import; keep `errorMiddleware` last. (R9)
6. `__tests__/jobs.service.test.ts` — filters incl. null-exclusion, all five sorts, pagination boundaries, `getById` 404. (R10)
7. `__tests__/jobs.router.test.ts` — supertest 200 (`JobListResponseSchema`/`JobDetailResponseSchema`), 422 bad query, 404 unknown id. (R2, R7, R8, R10)

## Sign-off

- [x] Plan reviewed — full-auto mode 2026-07-01; every `must` covered, no orphan changes, no blocking ambiguity; proceeding to IMPLEMENT.
