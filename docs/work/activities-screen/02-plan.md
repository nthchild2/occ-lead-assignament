# Plan · activities-screen

- **Feature id:** `activities-screen`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner subagent (full-auto)
- **Date:** 2026-07-01

## Approach

Build one shared, route-adjacent `ActivityList` component that owns the loading/error/empty/list branching (mirroring `index.tsx:121-175`'s `ListContent` extraction), parameterized over a normalized row shape `{ id: string; job: Job }` so it works identically for `Application[]` (via an `item.job` adapter) and `Job[]` (identity adapter). Each route file (`applied.tsx`, `favorites.tsx`) stays thin: fetch-on-mount from its own store, map its store's `items` to the normalized shape, wire `remove`/`setActiveJob` handlers, and delegate all rendering to `ActivityList`. Each row renders `JobCard` (unmodified, tap-to-open) with a sibling `Button` below it (cancel/remove) — never nested inside `JobCard`'s own `Card` `Pressable`, avoiding the nested-Pressable a11y issue research flagged. Lists use `FlatList` (not `FlashList`) since these are small, non-paginated, per-user lists outside A5's high-traffic scope, which also avoids the FlashList jest-mock machinery entirely.

**Rejected alternative:** giving `JobCard` an optional `onSecondaryAction`/`trailing` slot prop, and/or using `FlashList` for consistency with the search screen. Rejected because (a) `JobCard`'s prop contract and memo comparator are locked in by `JobCard.test.tsx` and `index.tsx:165`'s call site — no functional need to touch it since composition works; (b) `FlashList` is an explicit, scoped optimization for the search screen per A5, and adopting it here would require duplicating the `index.test.tsx:44-84` mock machinery for lists that don't need virtualization.

`ActivityList` lives at `app/app/(protected)/(tabs)/activities/ActivityList.tsx` (route-adjacent, not `core/components/`) because — per the corrected `job-detail-sheet` boundary understanding — it is tightly coupled to this route's two screens' store wiring and adapter shapes, not a generic reusable presentation component.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | File(s) (`path:line`)                                                                      | R-ids                  | Type   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- | ------ |
| 1   | Create shared `ActivityList` component: accepts `{ theme, rows: { id: string; job: Job }[], isLoading, error, onRetry, onPress, onSecondaryAction, secondaryLabel, emptyTitle, emptyDescription }`; implements the `isLoading && rows.length===0` → `JobCardSkeleton × 5` (`Skeleton.tsx:46`), `error && rows.length===0` → `ErrorState` (`ErrorState.tsx:11-23`), `!isLoading && !error && rows.length===0` → `EmptyState` (`EmptyState.tsx:14`), else → `FlatList` of row = `JobCard` (`JobCard.tsx:9-12,83`) + sibling `Button` (`Button.tsx:71`, `variant="danger"`, distinct `accessibilityLabel`/`label`) triage, mirroring `index.tsx:121-175`'s `ListContent` shape but with `FlatList` instead of `FlashList` and one extra per-row secondary action | `app/app/(protected)/(tabs)/activities/ActivityList.tsx` (new)                             | R1, R2, R5, R6, R7, R8 | create |
| 2   | Rewrite `applied.tsx`: on mount, `useEffect` → `useApplicationsStore.getState().fetch()`; read `items`/`isLoading`/`error` via hook-selector style (`useApplicationsStore((s) => s.items)`, mirrors `index.tsx:180-182`); map `items` → `rows = items.map((a) => ({ id: a.jobId, job: a.job }))`; `handlePress(row, index)` → `useJobsStore.getState().setActiveJob(row.job.id, index)`; `handleCancel(jobId)` → `try { await useApplicationsStore.getState().remove(jobId) } catch (err) { /* inline message, mirrors JobDetail.tsx:302-309 */ }`; render `<ActivityList ... secondaryLabel="Cancelar" .../>`                                                                                                                                                | `app/app/(protected)/(tabs)/activities/applied.tsx` (replaces placeholder at lines 1-32)   | R1, R3, R5, R6, R7, R8 | edit   |
| 3   | Rewrite `favorites.tsx`: identical shape to change #2 but against `useFavoritesStore` (`favorites.store.ts:11`); `items` is already `Job[]`, so `rows = items.map((job) => ({ id: job.id, job }))` (identity adapter); `handleRemove(jobId)` → `useFavoritesStore.getState().remove(jobId)`; `handlePress(row, index)` → `useJobsStore.getState().setActiveJob(row.id, index)`; render `<ActivityList ... secondaryLabel="Quitar" .../>`                                                                                                                                                                                                                                                                                                                      | `app/app/(protected)/(tabs)/activities/favorites.tsx` (replaces placeholder at lines 1-32) | R2, R4, R5, R6, R7, R8 | edit   |
| 4   | Unit test for the shared component: loading → skeletons render; error+empty rows → `ErrorState` with retry wired; empty (no error, no loading) → `EmptyState`; populated → one row per item, tapping the row calls `onPress`, tapping the secondary `Button` calls `onSecondaryAction` with that row's id and does _not_ also trigger `onPress` (guards the sibling-not-nested composition)                                                                                                                                                                                                                                                                                                                                                                   | `app/app/(protected)/(tabs)/activities/ActivityList.test.tsx` (new)                        | R5, R6, R7, R8         | test   |
| 5   | Screen test for `applied.tsx`: mocks `applications.store` and `jobs.store` at the module boundary (mirrors `index.test.tsx:15-20`); asserts `fetch()` is called once on mount (R1); asserts cancel button calls `remove(jobId)` (R3); asserts tapping a row calls `setActiveJob(application.job.id, index)` (R8); loading/error/empty branches delegated to change #4's coverage, only smoke-asserted here via store-state fixtures                                                                                                                                                                                                                                                                                                                           | `app/app/(protected)/(tabs)/activities/applied.test.tsx` (new)                             | R1, R3, R8             | test   |
| 6   | Screen test for `favorites.tsx`: same shape as change #5 against `favorites.store`/`jobs.store`; asserts `fetch()` on mount (R2); remove button calls `remove(jobId)` (R4); tapping a row calls `setActiveJob(job.id, index)` (R8) using the identity adapter (`row.id === job.id`, no `.job` unwrap)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `app/app/(protected)/(tabs)/activities/favorites.test.tsx` (new)                           | R2, R4, R8             | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

No changes to `app/store/applications.store.ts`, `app/store/favorites.store.ts`, `app/store/jobs.store.ts`, `app/core/components/JobCard.tsx`, `app/app/(protected)/JobDetail.tsx`, `app/app/(protected)/_layout.tsx`, `app/app/(protected)/(tabs)/activities/_layout.tsx`, `app/core/lib/activityStatus.ts`, or `packages/shared/*` — all confirmed sufficient as-is by research.

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 1, 2, 5              |
| R2   | must     | 1, 3, 6              |
| R3   | must     | 2, 5                 |
| R4   | must     | 3, 6                 |
| R5   | must     | 1, 2, 3, 4           |
| R6   | must     | 1, 2, 3, 4           |
| R7   | must     | 1, 2, 3, 4           |
| R8   | should   | 1, 2, 3, 4, 5, 6     |

- [x] Every `must` requirement (R1–R7) is covered by ≥1 change.
- [x] R8 (should) is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans) — changes 1–6 all cite at least one R-id above.

## Tests to add or update

- `app/app/(protected)/(tabs)/activities/ActivityList.test.tsx` (new) — asserts the four-state triage (loading skeletons, error+retry, empty state, populated list) and that the row's tap target and the secondary action `Button` are independent (tapping one doesn't fire the other) — covers R5, R6, R7, and the R8 tap-to-open contract at the shared-component level.
- `app/app/(protected)/(tabs)/activities/applied.test.tsx` (new) — asserts `applications.store.fetch()` fires on mount (R1), cancel calls `remove(jobId)` (R3), row press calls `setActiveJob(application.job.id, index)` (R8).
- `app/app/(protected)/(tabs)/activities/favorites.test.tsx` (new) — asserts `favorites.store.fetch()` fires on mount (R2), remove calls `remove(jobId)` (R4), row press calls `setActiveJob(job.id, index)` (R8).

**Explicit call on test scope:** all three test files are included, following the established precedent set by `login-screen`, `job-search-screen`, and `job-detail-sheet` (every prior feature ticket in this codebase shipped tests alongside its screens/components). The shared `ActivityList` is a core module with real branching logic (four render states) — A4 requires a test per core module regardless of its route-adjacent placement. The two thin route files still warrant their own (lighter) tests because they own the adapter-mapping logic (`Application → {id, job}` vs `Job → {id, job}` identity) and the `setActiveJob` argument wiring, which is feature-specific and not exercised by `ActivityList.test.tsx`'s generic-row fixtures — an adapter bug (e.g. swapping `row.id`/`row.job.id`) would not be caught by the shared component's tests alone.

## Risks & rollback

- **Row composition (`JobCard` + sibling `Button`) accessibility**: if RNTL/a11y linting flags the two-Pressable row unexpectedly, fall back to giving each `Button` a `testID`/explicit distinct `accessibilityLabel` (e.g. `"Cancelar aplicación a {title}"`) — no structural change needed, this is additive. Rollback: revert change #1 only; changes #2/#3 depend on its export shape but not its internals.
- **`FlatList` perf on larger favorite/application lists**: out of scope per research (A5 explicitly scopes virtualization concerns to the search screen); if a future ticket needs virtualization here, it's an isolated swap inside `ActivityList.tsx` (single file), not a route-file change.
- **Adapter mismatch risk** (`Application.job.id` vs `Job.id` in `setActiveJob`): mitigated by keeping the two adapters trivial one-line `.map()` calls in each route file (change #2/#3) and covering both argument shapes explicitly in changes #5/#6.
- **Complexity ceiling (`.eslintrc.js:26`, max 10)**: `ActivityList`'s four-branch triage plus row rendering could approach the limit if not extracted further; if `eslint` fails during verify, extract a `Row` subcomponent inside the same file (same pattern `index.tsx` doesn't need but is available) — contained to change #1, no ripple to #2/#3.
- **Rollback granularity**: each change is a single file: reverting #1 alone breaks #2/#3 (they import `ActivityList`), so if #1 fails verify, #2/#3 are blocked until it's fixed — this is why #1 is ordered first. #2 and #3 are independent of each other and can be reverted individually without affecting the other screen. #4/#5/#6 are pure test files — reverting any test never affects runtime behavior.

## Handoff to IMPLEMENT

1. Create `app/app/(protected)/(tabs)/activities/ActivityList.tsx` — shared four-state list component (loading/error/empty/list), row = `JobCard` + sibling `Button`, `FlatList`-based.
2. Rewrite `app/app/(protected)/(tabs)/activities/applied.tsx` — fetch-on-mount from `applications.store`, adapt `Application[] → {id, job}[]`, wire cancel/press handlers, render `ActivityList`.
3. Rewrite `app/app/(protected)/(tabs)/activities/favorites.tsx` — fetch-on-mount from `favorites.store`, adapt `Job[] → {id, job}[]` (identity), wire remove/press handlers, render `ActivityList`.
4. Add `app/app/(protected)/(tabs)/activities/ActivityList.test.tsx` — four-state triage + independent tap-targets test.
5. Add `app/app/(protected)/(tabs)/activities/applied.test.tsx` — fetch/cancel/press wiring against `applications.store`.
6. Add `app/app/(protected)/(tabs)/activities/favorites.test.tsx` — fetch/remove/press wiring against `favorites.store`.
7. Run `lint`, `typecheck`, and `test` (verify gate) before handing off.

## Sign-off

- [x] Plan reviewed — full-auto mode 2026-07-01; proceeding to IMPLEMENT.
      (In full-auto mode this is auto-checked; the two hard stops still apply.)
