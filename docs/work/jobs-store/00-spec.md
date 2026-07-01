# Spec · jobs-store

- **Feature id:** `jobs-store`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 1 · Job Search — filters, sort, pagination); `docs/work/ROADMAP.md` (Epic D, `jobs-store`); A2 Decision 2 (pagination), Decision 4 (swipe prefetch)
- **Depends on:** `app-api-client` (typed `get`), `@occ/shared` (`JobSchema`, `JobFiltersSchema`, `JobListResponseSchema`, `Pagination`)

## Summary

Build `app/store/jobs.store.ts` (list state: jobs, filters, pagination, active-job index — not persisted, per A2 Decision 1), `app/core/services/jobs.service.ts` (thin `GET /jobs` wrapper), `app/core/hooks/useJobs.ts` (fetch orchestration: `fetchPage`/`fetchNextPage`/`refetch`), and `app/core/hooks/useDebounce.ts` (generic 300ms debounce for the search input). This is state + data-fetching plumbing only — no screen UI. The spec explicitly requires a "hook de búsqueda" unit test.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                                 | Source              | Acceptance criterion                                                                                                                                                           | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| R1  | `jobs.service.ts` wraps `GET /jobs` via the api client, forwarding filters as query params                                     | PDF §3; A1          | One exported function calls `get('/jobs?...', JobListResponseSchema)` (unauthenticated) building the query string from `JobFilters`; no `fetch` in the service                 | must     |
| R2  | `jobs.store` holds `jobs: Job[]`, `filters`, `pagination`, `isLoading`, `error`, `activeJobId`/`activeJobIndex`, not persisted | PDF §3; A2 Dec. 1/2 | Store shape matches A2's `JobsStore` interface; no `persist` middleware applied                                                                                                | must     |
| R3  | `appendJobs(jobs, pagination)` accumulates results (does not replace) and updates pagination state                             | PDF §3 (pagination) | Calling `appendJobs` twice concatenates both batches into `jobs` and sets `pagination` to the latest value                                                                     | must     |
| R4  | `resetList()` clears accumulated jobs and pagination, for filter/sort changes and manual refetch                               | PDF §3              | After `resetList()`, `jobs` is empty and `pagination`/loading/error are reset to initial state                                                                                 | must     |
| R5  | `setFilters(partial)` merges into `filters` without side effects (fetching is the hook's job, not the store's)                 | A2                  | `setFilters({ city: 'X' })` updates only `city`, leaves other filter fields and `jobs` untouched                                                                               | must     |
| R6  | `useJobs()` hook exposes `fetchPage(page)`, `fetchNextPage()`, `refetch()`, driven by the store's filters/pagination           | PDF §3              | `fetchNextPage()` no-ops if `pagination.hasNext` is false or a fetch is already in flight; `refetch()` calls `resetList()` then `fetchPage(1)`                                 | must     |
| R7  | `useDebounce(value, delay)` generic hook debounces a changing value by the given delay (300ms for search)                      | PDF §3 (300ms)      | Rapid value changes within `delay` collapse to the last value only, after `delay` has elapsed with no further change                                                           | must     |
| R8  | Fetch failures set `error` and clear `isLoading` without clearing already-accumulated `jobs`                                   | PDF §3 (error UI)   | A rejected `get()` call sets `error` to a message, `isLoading` false, and does not touch existing `jobs`/`pagination`                                                          | must     |
| R9  | Unit tests for the search hook (spec-required) and the store                                                                   | PDF §3              | Tests assert: `useJobs` fetch/paginate/refetch behavior (mocking the service or `fetch`), `useDebounce` timing, and the store's `appendJobs`/`resetList`/`setFilters` reducers | must     |

## Explicitly out of scope

- **Screen UI** (search bar, filter inputs, FlashList, skeleton/error/empty rendering) — `job-search-screen` ticket.
- **Active-job swipe/prefetch-threshold logic** (the "3 jobs from end" trigger) — `job-detail-swipe` ticket; this ticket only provides `activeJobId`/`activeJobIndex` state and `setActiveJob`/`clearActiveJob` actions for that later ticket to drive.
- **`activity-stores` (applications/favorites)** — separate ticket.
- **Backend changes** — `be-jobs` already implements `GET /jobs`.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Query-string construction for filters → **resolution:** research confirms whether `app-api-client`'s `get()` accepts a query object or requires a pre-built path+querystring; plan picks the concrete approach (likely building the querystring in `jobs.service.ts` since `get(path, schema, auth?)` takes a path string per `api-client`'s signature).
- [x] "Fetch already in flight" guard for `fetchNextPage` → **resolution:** use the store's `isLoading` flag as the in-flight guard (already required by R2); no separate ref/lock needed.
- [x] Debounce hook's relationship to the store → **resolution:** `useDebounce` is a generic, store-agnostic hook in `core/hooks/`; wiring it to the search input + triggering `refetch()` is the screen ticket's job, not this one's. This ticket just delivers the reusable hook.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
