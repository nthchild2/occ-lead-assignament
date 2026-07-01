# Spec · job-search-screen

- **Feature id:** `job-search-screen`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 1 · Job Search)
- **Depends on:** `jobs-store` (`useJobsStore`, `useJobs`, `useDebounce`), `app-nav-shell` (`(protected)/(tabs)/index.tsx` placeholder to replace)

## Summary

Replace the `(protected)/(tabs)/index.tsx` placeholder with the real job search screen: a debounced search bar, inline filters (city, salary range), a sort selector, and a `FlashList` of job cards with pagination-on-scroll, skeleton loading, error+retry, and empty states. This screen is the primary consumer of `jobs-store`/`useJobs`/`useDebounce` built in an earlier ticket. Tapping a job card sets `activeJobId` on `jobs.store` (the mechanism `job-detail-sheet`, a later ticket, will read to open the detail sheet) — this ticket does not build the sheet itself.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                                                                | Source | Acceptance criterion                                                                                                                                                                        | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Search bar with 300ms debounce, filtering by `q`                                                                                                              | PDF §3 | Typing updates a local input value immediately; the debounced value (via `useDebounce`) drives `setFilters({ q })` + `refetch()` only after 300ms of no further typing                      | must     |
| R2  | City filter (inline selector) using `core/components/Select`                                                                                                  | PDF §3 | Selecting a city calls `setFilters({ city })` + `refetch()`                                                                                                                                 | must     |
| R3  | Salary range filter — two numeric inputs (`salary_min`/`salary_max`)                                                                                          | PDF §3 | Entering a value updates filters and triggers a refetch (debounced or on-blur — plan decides which, to avoid a request per keystroke)                                                       | must     |
| R4  | Sort selector with the 5 modes (`date_desc` default, `date_asc`, `salary_desc`, `salary_asc`, `relevance`)                                                    | PDF §3 | Selecting a sort mode calls `setFilters({ sort })` + `refetch()` (resets to page 1, per `jobs-store`'s `resetList`)                                                                         | must     |
| R5  | `FlashList` rendering job cards, `onEndReached` triggers `fetchNextPage()`                                                                                    | PDF §3 | Scrolling near the end of the list loads more jobs via the existing `useJobs` hook; no duplicate/overlapping fetches while one is in flight (already guarded by `jobs-store`'s `isLoading`) | must     |
| R6  | Skeleton loading state while the initial page (or a filter-triggered refetch) is in flight                                                                    | PDF §3 | `isLoading && jobs.length === 0` renders `core/components/Skeleton`'s `JobCardSkeleton` (already built) instead of the list                                                                 | must     |
| R7  | Error state with retry when a fetch fails and no jobs are loaded                                                                                              | PDF §3 | `error && jobs.length === 0` renders `core/components/ErrorState` with a retry action calling `refetch()`                                                                                   | must     |
| R8  | Empty state when a search/filter combination yields zero results                                                                                              | PDF §3 | `!isLoading && !error && jobs.length === 0` (post-fetch) renders `core/components/EmptyState`                                                                                               | must     |
| R9  | A `JobCard` component renders each job (title, company, city, salary if present, tags)                                                                        | PDF §3 | New component under `core/components/` (or screen-local, per plan) using `useTheme()`, no inline literals; tapping it sets `activeJobId`/`activeJobIndex` on `jobs.store`                   | must     |
| R10 | Filter/sort changes reset pagination to page 1 (already `jobs-store`'s `resetList` + `refetch` behavior — this ticket just wires the UI to call it correctly) | PDF §3 | Changing any filter or sort does not append to stale results — the list visibly restarts                                                                                                    | must     |

## Explicitly out of scope

- **Job Detail bottom sheet** (`job-detail-sheet`, `job-detail-swipe`) — separate tickets; this screen only sets `activeJobId` on tap.
- **Backend changes** — `be-jobs` already implements `GET /jobs`.
- **`jobs-store`/`useJobs`/`useDebounce` internals** — already built; this ticket only consumes them.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Salary-range input debounce/trigger mechanism → **resolution:** research/plan decides between a `useDebounce`-driven trigger (consistent with the search bar) or on-blur/on-submit — pick whichever avoids excessive requests without adding new components.
- [x] `JobCard` location → **resolution:** research checks whether it belongs in `core/components/` (reusable, matches the "one component per file" MAP convention) or is screen-local; likely `core/components/` since MAP's component conventions apply and it may be reused (e.g. inside the detail sheet later).
- [x] FlashList prop tuning (per A5: `estimatedItemSize`, `keyExtractor`, `getItemType`, memoization) → **resolution:** apply A5's documented optimizations since this is explicitly "the highest-traffic surface" per that doc — research confirms the exact API against the installed `@shopify/flash-list` version.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
