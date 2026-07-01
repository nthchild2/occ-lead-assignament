# Spec · job-detail-sheet

- **Feature id:** `job-detail-sheet`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 2 · Job Detail — Bottom Sheet); `docs/work/ROADMAP.md` resolved decision #4 (Job Detail split into `-sheet` then `-swipe`)
- **Depends on:** `app-nav-shell` (`BottomSheetModalProvider` mounted at root), `jobs-store` (`activeJobId`/`activeJobIndex`, `setActiveJob`/`clearActiveJob`), `activity-stores` (`applications.store`/`favorites.store`, `isJobApplied`/`isJobFavorited`), `job-search-screen` (sets `activeJobId` on card tap)

## Summary

Build the static Job Detail `BottomSheetModal`: mounted in `(protected)/_layout.tsx` (or a dedicated component it renders), opens when `jobs.store.activeJobId` is set (already wired by `job-search-screen`'s card tap), shows the job's full detail content, and provides Apply/Favorite actions wired to `activity-stores`. Two snap points (60%/100%). This ticket does NOT build swipe-between-jobs or the transparent-prefetch behavior — that's `job-detail-swipe`. Closing the sheet clears `activeJobId`/`activeJobIndex` via `clearActiveJob()`.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                                                                                          | Source                                     | Acceptance criterion                                                                                                                                                                                                                                 | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `BottomSheetModal` with two snap points (60%, 100%), using `@gorhom/bottom-sheet`                                                                                                       | PDF §3                                     | Sheet opens to the 60% snap point by default; user can expand to 100%                                                                                                                                                                                | must     |
| R2  | Sheet opens when `jobs.store.activeJobId` becomes non-null; closes/dismisses when it's cleared externally                                                                               | A3                                         | A `useEffect` watching `activeJobId` calls the sheet ref's `present()`/`dismiss()`                                                                                                                                                                   | must     |
| R3  | Sheet content uses `BottomSheetScrollView` and shows the job's full detail (title, company, city, salary, description, tags, publishedAt)                                               | PDF §3                                     | All `Job` fields are rendered; content scrolls when it overflows the snap point                                                                                                                                                                      | must     |
| R4  | On dismiss (user swipe-down/backdrop tap), `clearActiveJob()` is called                                                                                                                 | PDF §3 (list scroll must not reset)        | `onDismiss` handler calls `jobs.store.clearActiveJob()`                                                                                                                                                                                              | must     |
| R5  | Apply button: calls `applications.store.add(jobId, job)`; disabled/shows "Ya aplicaste" state if `isJobApplied(jobId)`                                                                  | PDF §3                                     | Tapping Apply when not yet applied triggers the optimistic add; if already applied, the button reflects that state without erroring                                                                                                                  | must     |
| R6  | Favorite button (toggle): calls `favorites.store.add(job)` or `.remove(jobId)` based on `isJobFavorited(jobId)`                                                                         | PDF §3                                     | Toggling calls the correct store action based on current state; icon/label reflects the current favorited state                                                                                                                                      | must     |
| R7  | On 401 during Apply/Favorite, the API client's existing `onUnauthorized` already clears the session — this screen does not need special handling beyond letting the rejection propagate | PDF §3 (redirect before executing)         | An `add`/`remove` rejection (already surfaced by `activity-stores`' `error` state or a thrown/caught promise) does not crash the sheet; a message may be shown                                                                                       | should   |
| R8  | On `ALREADY_APPLIED`/`ALREADY_FAVORITED` (409), show a message without closing the sheet                                                                                                | PDF §3                                     | A rejected `add()` due to a 409 surfaces an inline message; the sheet stays open                                                                                                                                                                     | must     |
| R9  | Loading/error states while `activeJobId` is set but the job data itself needs fetching (if not already in `jobs.store.jobs`)                                                            | A3 (deep-link entry has activeJobIndex -1) | If the job isn't found in `jobs.store.jobs` by id, fetch it individually (e.g. via a jobs service `getById`, if one exists, or research decides) — this ticket only needs this for robustness; full deep-link entry is `push-notifications`' concern | should   |

## Explicitly out of scope

- **Swipe-between-jobs, transparent prefetch, end-of-results indicator** — `job-detail-swipe` ticket.
- **Deep-link entry (`occ://vacante/:id`) and quit-state hydration** — `push-notifications` ticket; R9 only covers the case where a job isn't in the currently-loaded list (e.g. accessed directly), not the full deep-link flow.
- **Backend changes** — `be-jobs`/`be-apply-fav` already implement everything needed.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Where the sheet component lives → **resolution:** research/plan decides between `(protected)/_layout.tsx` directly or a dedicated `JobDetailSheet` component it renders — likely the latter for readability, given A3 requires it to "coexist" with routes without being a route itself.
- [x] Individual job fetch for R9 → **resolution:** research checks whether `jobs.service.ts` has a `getById`-equivalent (mirroring the backend's `GET /jobs/:id`) or whether one needs to be added; if adding, scope it minimally (this ticket, not a new store/hook ticket).
- [x] Apply/Favorite button placement/component → **resolution:** research/plan decides whether to reuse `core/components/Button` directly or need a small toggle wrapper; keep simple.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
