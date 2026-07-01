# Spec · activities-screen

- **Feature id:** `activities-screen`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 4 · Mis actividades)
- **Depends on:** `activity-stores` (`applications.store`, `favorites.store`, `isJobApplied`/`isJobFavorited`), `app-nav-shell` (`(protected)/(tabs)/activities/{applied,favorites}.tsx` placeholders, top-tab layout), `job-search-screen` (`JobCard` component to reuse)

## Summary

Replace the `applied.tsx`/`favorites.tsx` placeholders with real lists: applications and favorites, each fetched on mount from their respective stores, rendered with `JobCard` (or a close variant), with immediate optimistic feedback when the user cancels an application or removes a favorite directly from this screen (via `applications.store.remove`/`favorites.store.remove`, already built). Loading/error/empty states per A4/A5 conventions.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                      | Source                          | Acceptance criterion                                                                                                                | Priority |
| --- | ----------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `applied.tsx` fetches and lists the user's applications on mount                    | PDF §3                          | `applications.store.fetch()` is called on mount; the list renders each application's embedded job                                   | must     |
| R2  | `favorites.tsx` fetches and lists the user's favorites on mount                     | PDF §3                          | `favorites.store.fetch()` is called on mount; the list renders each favorited job                                                   | must     |
| R3  | Cancel an application from this screen with immediate feedback                      | PDF §3                          | Tapping a cancel action calls `applications.store.remove(jobId)`; the item disappears immediately (already optimistic in the store) | must     |
| R4  | Remove a favorite from this screen with immediate feedback                          | PDF §3                          | Tapping a remove action calls `favorites.store.remove(jobId)`; the item disappears immediately (already optimistic in the store)    | must     |
| R5  | Loading state while the initial fetch is in flight                                  | A4/A5                           | `isLoading && items.length === 0` shows a skeleton/loading indicator                                                                | must     |
| R6  | Error state with retry if the fetch fails                                           | A4                              | `error && items.length === 0` shows `ErrorState` with retry calling `fetch()` again                                                 | must     |
| R7  | Empty state when the user has no applications/favorites                             | PDF §3                          | `!isLoading && !error && items.length === 0` shows `EmptyState` with a relevant message                                             | must     |
| R8  | Tapping an item opens the Job Detail sheet (reuse existing `activeJobId` mechanism) | PDF §3 (implied consistent nav) | Tapping a card sets `activeJobId` on `jobs.store`, opening the already-built sheet                                                  | should   |

## Explicitly out of scope

- **Top-tab navigation itself** (Postuladas/Favoritos switcher) — already built in `app-nav-shell`.
- **`activity-stores` internals** — `fetch`/`add`/`remove`/`reset` already built; this ticket only consumes them.
- **Backend changes** — `be-apply-fav` already implements everything needed.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Reuse `JobCard` as-is or a variant with a cancel/remove action → **resolution:** research/plan decides — likely a thin wrapper or an added optional `onSecondaryAction`/`trailing` slot, keeping `JobCard` itself simple per its existing single-responsibility design; avoid modifying `JobCard`'s core contract if job-search-screen depends on the current shape.
- [x] R8's `activeJobId` interaction from `applications.store` items (which hold `Application`, not `Job`, directly) → **resolution:** research confirms `Application.job` is the embedded `Job` — use that for `setActiveJob(item.job.id, ...)`. Favorites items are already `Job[]` directly.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
