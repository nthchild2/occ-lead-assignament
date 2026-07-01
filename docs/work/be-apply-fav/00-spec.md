# Spec · be-apply-fav

- **Feature id:** `be-apply-fav`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §2.2 (Apply, Favoritos); `docs/work/ROADMAP.md` (Epic A, `be-apply-fav`)
- **Depends on:** `be-core` (AppError, error codes), `be-auth` (`authMiddleware`), `be-jobs` (job existence lookup), `@occ/shared` (`ApplicationSchema`, `ApplicationListResponseSchema`, `FavoriteListResponseSchema`, `JobSchema`)

## Summary

Implement the applications and favorites domains under `backend/src/domains/` — authenticated, per-user, in-memory toggles over existing jobs. Apply/cancel + list applications (with the embedded job), favorite/unfavorite + list favorites. All routes require auth. Job existence is checked via an injected jobs lookup so the services stay decoupled from the jobs domain (no cross-domain import in service code, per A1 Decision 3).

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                 | Source     | Acceptance criterion                                                                                                                                                                                | Priority |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `POST /jobs/:id/apply` (auth) registers an application for the current user                                    | PDF §2.2   | New application → success; job that doesn't exist → 404 `NOT_FOUND`                                                                                                                                 | must     |
| R2  | `POST /jobs/:id/apply` rejects a duplicate application                                                         | PDF §2.2   | Applying again to the same job → 409 `ALREADY_APPLIED`                                                                                                                                              | must     |
| R3  | `DELETE /jobs/:id/apply` (auth) cancels an existing application                                                | PDF §2.2   | Existing application → removed (success); no application for that job → 404 `NOT_FOUND`                                                                                                             | must     |
| R4  | `GET /applications` (auth) lists the current user's applications with the embedded job                         | PDF §2.2/3 | 200 `{ data: { items } }` matching `ApplicationListResponseSchema` (each item `{ jobId, appliedAt, job }`)                                                                                          | must     |
| R5  | `POST /jobs/:id/favorite` (auth) adds a favorite; rejects duplicates; 404 for missing job                      | PDF §2.2   | New favorite → success; missing job → 404 `NOT_FOUND`; already favorited → 409 `ALREADY_FAVORITED`                                                                                                  | must     |
| R6  | `DELETE /jobs/:id/favorite` (auth) removes a favorite                                                          | PDF §2.2   | Existing favorite → removed (success); not favorited → 404 `NOT_FOUND`                                                                                                                              | must     |
| R7  | `GET /favorites` (auth) lists the current user's favorited jobs                                                | PDF §2.2   | 200 `{ data: { items } }` matching `FavoriteListResponseSchema` (items are full `Job`s)                                                                                                             | must     |
| R8  | All six endpoints require authentication                                                                       | PDF §2.2   | No/invalid token → 401 `AUTH_REQUIRED` (via `be-auth` `authMiddleware`)                                                                                                                             | must     |
| R9  | Per-user in-memory state; job existence validated via an injected jobs lookup (no cross-domain service import) | A1 Dec. 3  | State keyed by user id; services receive a `jobExists`/`getJob` function, not an import of the jobs domain                                                                                          | must     |
| R10 | The routers are mounted in `app.ts`                                                                            | PDF §2.2   | Routes reachable (`/jobs/:id/apply`, `/jobs/:id/favorite`, `/applications`, `/favorites`); error middleware stays last                                                                              | must     |
| R11 | Integration tests (supertest) for both domains                                                                 | PDF §3, A4 | apply → dupe (409) → cancel → cancel-again (404); favorite → dupe (409) → remove → remove-again (404); apply/favorite missing job → 404; unauthenticated → 401; `GET` lists return the right shapes | must     |

## Explicitly out of scope

- **Job data / search** — owned by `be-jobs`; this ticket only reads jobs (via injection) to validate existence and embed them.
- **App-side stores/screens** (`activity-stores`, `activities-screen`) — later tickets.
- **Persistence across restarts / multi-instance** — in-memory only (A1 conscious tech debt).

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Domain layout (one combined domain vs two) → **resolution:** two domains, `domains/applications/` and `domains/favorites/`, each router+service, mirroring `be-auth`/`be-jobs`. Routers may be mounted so paths match the brief (`/jobs/:id/apply` etc.).
- [x] Job existence without cross-domain import → **resolution:** the composition layer (`app.ts` or a router factory) injects the jobs lookup (`getById`) into the applications/favorites services; services never import the jobs domain (A1 Decision 3). Research confirms the exact eslint zones.
- [x] Success response bodies for mutations → **resolution:** return a minimal `{ data }` (e.g. the created application / a status), consistent with the `success()` helper; the brief doesn't mandate a specific body beyond the status code.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
