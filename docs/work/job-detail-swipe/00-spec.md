# Spec · job-detail-swipe

- **Feature id:** `job-detail-swipe`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 2 · Job Detail — Swipe, transparent pagination); `docs/work/ROADMAP.md` resolved decision #4; `docs/A2 · State & Data Strategy.md` Decision 4 (swipe prefetch), `docs/A5 · Performance.md` Decision 3 (prefetch without impacting render)
- **Depends on:** `job-detail-sheet` (the static sheet + `JobDetail` content this ticket adds swipe to), `jobs-store` (`jobs`, `activeJobIndex`, `pagination`), `job-search-screen` (the FlashList this syncs scroll position with on close)

## Summary

Add horizontal swipe-between-jobs to the existing `JobDetail` sheet content, using `react-native-reanimated` + `react-native-gesture-handler` so the animation runs on the UI thread. When the user swipes to within 3 jobs of the end of the currently loaded page, silently trigger `fetchNextPage()` in the background (already built in `jobs-store`/`useJobs`) via `InteractionManager.runAfterInteractions` so it doesn't compete with the swipe animation. If the background fetch fails, the swipe stops at the last available job with a subtle end-of-results indicator — it must not crash or show a jarring error. When the sheet closes, the underlying FlashList scrolls to make the last-active job visible (index sync).

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                                                | Source                                                                    | Acceptance criterion                                                                                                                           | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Horizontal swipe left/right navigates between jobs in `jobs.store.jobs`, driven by `react-native-gesture-handler` + `react-native-reanimated` | PDF §3                                                                    | A left/right swipe gesture on the sheet content changes which job is displayed, animated on the UI thread                                      | must     |
| R2  | Swipe updates `activeJobId`/`activeJobIndex` on `jobs.store` to stay in sync with the list                                                    | A3                                                                        | After a swipe, `jobs.store.activeJobId`/`activeJobIndex` reflect the newly-visible job                                                         | must     |
| R3  | Swiping is disabled/no-ops when the active job was entered via `activeJobIndex === -1` (not-in-list / deep-link case)                         | A3 (research from job-detail-sheet: R9 fallback sets index -1 implicitly) | If the current job isn't part of the loaded list (fallback-fetched), swipe gestures do not attempt to navigate to a nonexistent adjacent index | must     |
| R4  | Transparent prefetch: reaching within 3 jobs of the end of the loaded page silently calls `fetchNextPage()`                                   | PDF §3; A2 Dec. 4                                                         | No loading indicator shown during this prefetch; the swipe continues smoothly once the new page's jobs are appended                            | must     |
| R5  | Prefetch runs via `InteractionManager.runAfterInteractions` so it doesn't block/compete with the swipe animation                              | A5 Dec. 3                                                                 | The fetch is deferred until the current gesture/animation settles, not fired synchronously mid-gesture                                         | must     |
| R6  | If the prefetch fails, swiping stops gracefully at the last available job with a subtle end-of-results indicator                              | PDF §3                                                                    | A failed `fetchNextPage()` does not crash the sheet; further swipe-past-the-end attempts show a small indicator instead of erroring or looping | must     |
| R7  | On sheet close, the underlying `FlashList` in `job-search-screen` scrolls to make the last-active job visible                                 | PDF §3; A3                                                                | `jobs.store.activeJobIndex` at close time is used to call `scrollToIndex` (or equivalent) on the list                                          | must     |

## Explicitly out of scope

- **The static sheet content, Apply/Favorite actions, snap points** — already built in `job-detail-sheet`.
- **Deep-link entry / quit-state hydration** — `push-notifications` ticket.
- **Backend changes** — `be-jobs` already implements pagination.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Swipe gesture implementation approach → **resolution:** research confirms the installed `react-native-gesture-handler`/`react-native-reanimated` versions' current recommended API (e.g. `Gesture.Pan()` + `useAnimatedGestureHandler` vs newer Gesture API) rather than assuming an older pattern — same version-drift check as prior tickets (FlashList, bottom-sheet).
- [x] How the FlashList ref is reached from the sheet (different component trees: `index.tsx` owns the list, `JobDetail.tsx`/`(protected)/_layout.tsx` owns the sheet) → **resolution:** research/plan decides the mechanism — likely a ref lifted to `(protected)/_layout.tsx` or a small shared ref-holder, since A3 flags this exact cross-component concern.
- [x] "3 jobs from the end" calculation → **resolution:** compare `activeJobIndex` against `jobs.store.jobs.length` and `pagination.hasNext`, mirroring the threshold already described in A2 Decision 4's spec (this ticket implements what `jobs-store` didn't — `jobs-store`'s ticket explicitly deferred this trigger to this ticket).

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
