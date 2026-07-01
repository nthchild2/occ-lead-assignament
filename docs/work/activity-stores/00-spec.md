# Spec · activity-stores

- **Feature id:** `activity-stores`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 4 · Mis actividades); `docs/work/ROADMAP.md` (Epic D, `activity-stores`); ROADMAP resolved decision #3 (client-derived applied/favorited state)
- **Depends on:** `app-api-client` (typed `get`/`post`/`del`), `@occ/shared` (`Application`, `ApplicationListResponse`, `FavoriteListResponse`, `Job`), `be-apply-fav` (the real backend this will eventually call)

## Summary

Build `app/store/applications.store.ts` + `app/store/favorites.store.ts` (list state, not persisted, per A2 Decision 1) and their thin service wrappers `app/core/services/applications.service.ts` / `favorites.service.ts` over `be-apply-fav`'s six endpoints. Also provide the client-derived helper (ROADMAP decision #3): since `Job` carries no `applied`/`favorited` flag, a small utility cross-references these two stores by job id so screens can render toggle state without a backend field.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                    | Source                                       | Acceptance criterion                                                                                                                                                                                                                        | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `applications.service.ts` wraps `POST/DELETE /jobs/:id/apply` and `GET /applications`                             | PDF §3                                       | Three exported functions call `post`/`del`/`get` (authenticated) with the shared schemas; no `fetch` outside the service                                                                                                                    | must     |
| R2  | `favorites.service.ts` wraps `POST/DELETE /jobs/:id/favorite` and `GET /favorites`                                | PDF §3                                       | Three exported functions call `post`/`del`/`get` (authenticated); no `fetch` outside the service                                                                                                                                            | must     |
| R3  | `applications.store` holds `items: Application[]`, `isLoading`, `error`; not persisted                            | PDF §3; A2                                   | Matches A2's per-domain list-store shape; no `persist` middleware                                                                                                                                                                           | must     |
| R4  | `favorites.store` holds `items: Job[]`, `isLoading`, `error`; not persisted                                       | PDF §3; A2                                   | Same shape as applications, mirrored                                                                                                                                                                                                        | must     |
| R5  | Each store exposes `fetch()` (load the list), `add(job)`/`remove(jobId)` optimistic mutation actions              | PDF §3 (immediate feedback)                  | `fetch()` populates `items` from the service; `add`/`remove` update `items` immediately (optimistic), then call the service, rolling back on failure                                                                                        | must     |
| R6  | A `isJobApplied(jobId)` / `isJobFavorited(jobId)` helper derives toggle state by cross-referencing the two stores | ROADMAP #3                                   | Given a job id present in `applications.store`/`favorites.store`, the helper returns `true`; absent → `false`. No `applied`/`favorited` field read from `Job`                                                                               | must     |
| R7  | Both stores reset on logout (cleared, not just left stale)                                                        | A2 Decision 1 (implied by session lifecycle) | An exposed `reset()` (or equivalent) clears `items`/`error`/`isLoading` back to initial state; wiring the actual logout call is out of scope (nav-shell/auth-store already own logout — this ticket only provides the resettable primitive) | should   |
| R8  | Unit tests for both stores' optimistic add/remove + rollback and the derived-state helper                         | A4                                           | Tests assert: optimistic add appears immediately, rollback removes it on a failed service call; same for remove; `isJobApplied`/`isJobFavorited` correctness                                                                                | must     |

## Explicitly out of scope

- **Screen UI** (`activities-screen`) — separate ticket; this only provides stores/services.
- **`job-detail-sheet` wiring** (calling `add`/`remove` from the Apply/Favorite buttons) — separate ticket; this ticket delivers the actions those buttons will call.
- **Backend changes** — `be-apply-fav` already implements the six endpoints.
- **Actual logout-triggered reset wiring** — `reset()` is provided; calling it from `auth.store`'s `logout`/`clearSession` is left to whichever ticket integrates the stores (may be revisited in `app-nav-shell` or handled as a small follow-up).

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Optimistic update shape for `add`/`remove` → **resolution:** `add(job)` for favorites takes the full `Job` (needed to render immediately without a round trip); `add(jobId, job)` or similar for applications needs an `appliedAt` — research/plan decides whether to optimistically synthesize a client-side timestamp (corrected on the next `fetch()`) or require the caller (job-detail-sheet, later) to pass one.
- [x] Where `isJobApplied`/`isJobFavorited` live → **resolution:** a small shared utility module (e.g. `app/core/lib/activityStatus.ts` or similar) reading `useApplicationsStore.getState()`/`useFavoritesStore.getState()` — research confirms the right location per `core/lib/` conventions (currently empty/nonexistent — check).

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
