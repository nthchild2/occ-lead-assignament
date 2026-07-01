# Spec · be-jobs

- **Feature id:** `be-jobs`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §2.2 (Jobs endpoints); `docs/work/ROADMAP.md` (Epic A, `be-jobs`); ROADMAP resolved decision #2 (`relevance`)
- **Depends on:** `be-core` (AppError, `validate` middleware, error codes), `@occ/shared` (`JobSchema`, `JobFiltersSchema`, `JobListResponseSchema`, `JobDetailResponseSchema`, `PaginationSchema`)

## Summary

Implement the jobs domain under `backend/src/domains/jobs/` (schema/service/router/seed, Clean-Architecture layered): an in-memory seed of ≥90 vacancies, a paginated + filtered + sorted `GET /jobs`, and `GET /jobs/:id` with a 404. Public endpoints (no auth). The service is Express-free and holds all the filter/sort/paginate logic so it is unit-testable in isolation.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                   | Source       | Acceptance criterion                                                                                                                                                           | Priority |
| --- | ------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| R1  | Seed ≥90 in-memory jobs with all `JobSchema` fields, initialized at startup from a seed module   | PDF §2.2     | `≥90` jobs exist; each has `id`, `title`, `company`, `city`, `salary` (nullable — some null), `description`, `publishedAt` (varied, ISO), `tags[]`; `limit=20` yields ≥4 pages | must     |
| R2  | `GET /jobs` returns an offset-paginated list matching `JobListResponseSchema`                    | PDF §2.2     | 200 `{ data: { items, pagination } }`; `page`+`limit` (default 20) offset paging; `pagination` has `page`,`limit`,`total`,`hasNext`,`hasPrev` computed correctly               | must     |
| R3  | `q` filters by title **and** company (case-insensitive substring)                                | PDF §2.2, §3 | `q=foo` returns only jobs whose title or company contains `foo` (case-insensitive)                                                                                             | must     |
| R4  | `city` filters by city                                                                           | PDF §2.2     | `city=X` returns only jobs in city X                                                                                                                                           | must     |
| R5  | `salary_min`/`salary_max` filter by range and exclude null-salary jobs when either is present    | PDF §2.2     | With either param set, jobs with `salary === null` are excluded and remaining jobs fall within the range                                                                       | must     |
| R6  | Five sort modes: `date_desc` (default), `date_asc`, `salary_desc`, `salary_asc`, `relevance`     | PDF §2.2; #2 | Each mode orders correctly; `relevance` = title-match > company-match with `publishedAt` desc tiebreak when `q` present, else falls back to `date_desc` (decision #2)          | must     |
| R7  | Query params are validated and coerced (numeric strings → numbers), invalid → 422                | PDF §2.3, §3 | Malformed query (e.g. `page=abc`, out-of-enum `sort`) → 422 `VALIDATION_ERROR`; numeric params arrive as numbers to the service                                                | must     |
| R8  | `GET /jobs/:id` returns the full job or 404                                                      | PDF §2.2     | Existing id → 200 `{ data: job }` (`JobDetailResponseSchema`); unknown id → 404 `NOT_FOUND`                                                                                    | must     |
| R9  | The jobs router is mounted (public, no auth) in `app.ts`                                         | PDF §2.2     | `app.ts` mounts the router at `/jobs` before the error middleware; no `authMiddleware` on these routes                                                                         | must     |
| R10 | Service unit tests for filtering, each sort, pagination math, null-salary exclusion, and the 404 | PDF §3, A4   | Tests (in `__tests__/`) cover: q/city/salary filters (incl. null-salary exclusion), all five sorts, pagination boundaries (`hasNext`/`hasPrev`/`total`), and `getById` 404     | must     |

## Explicitly out of scope

- **apply / favorites** — `be-apply-fav` ticket (these mutate per-user state and need auth).
- **Persisting or mutating jobs** — read-only seed; no create/update/delete.
- **Changing `@occ/shared` schemas** — reuse `JobSchema`/`JobFiltersSchema`/etc. as-is; if query coercion needs a backend-only parsing schema, define it in the backend, don't edit shared (requires lead review).

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Query-param coercion vs `JobFiltersSchema` (which types `salary_min`/`page` as `number`, but Express query values are strings) → **resolution:** define a backend-side query schema using `z.coerce.number()` (and the same `sort` enum / defaults) for `validate({ query })`; map to `JobFilters`. Do not modify the shared schema.
- [x] `relevance` scoring specifics → **resolution:** decision #2 — title match ranks above company match; `publishedAt` desc tiebreak; `q` absent → behaves as `date_desc`.
- [x] `city` match exactness → **resolution:** case-insensitive exact match on the seed's city values (research confirms the seed's city set).

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
