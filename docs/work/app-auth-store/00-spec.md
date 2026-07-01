# Spec · app-auth-store

- **Feature id:** `app-auth-store`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 3 · Auth); `docs/work/ROADMAP.md` (Epic B); A2 Decision 1/3
- **Depends on:** `app-api-client` (`configureApi`, `get`/`post`, `ApiError`), `@occ/shared` (`LoginRequestSchema`, `LoginResponseSchema`, `MeResponseSchema`, `User`), `be-auth` (the real backend this will eventually call)

## Summary

Build `app/store/auth.store.ts` — the Zustand store holding the JWT + user, persisted via AsyncStorage — plus a thin `app/core/services/auth.service.ts` wrapping the three auth endpoints (`login`, `logout`, `me`) through the `app-api-client`. On store creation, `configureApi({ getToken, onUnauthorized })` is wired so the API client can read the current token and clear the session on 401, closing the circular-dependency gap `app-api-client` deliberately left open. This ticket does not build the login screen or route guards — only the store, the service, and the wiring between them.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                            | Source                 | Acceptance criterion                                                                                                                           | Priority |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | `auth.service.ts` wraps `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` via the api client        | PDF §3; A1             | Three exported functions call `post`/`get` from `app-api-client` with the shared schemas; no `fetch`/`axios` in the service or store           | must     |
| R2  | `auth.store` holds `token`, `user`, and exposes `login(email, password)`, `logout()` actions              | PDF §3                 | `login` calls the service, sets `token`+`user` on success, throws/propagates `ApiError` on failure; `logout` calls the service then clears     | must     |
| R3  | The store is persisted via AsyncStorage (Zustand `persist`)                                               | PDF §3; A2 Dec. 1      | `token`/`user` survive a store rehydration from AsyncStorage; only `auth.store` persists (per A2 — no other store touched here)                | must     |
| R4  | `configureApi` is wired so the api client reads the current token and clears the session on 401           | app-api-client spec    | `getToken` returns the store's current `token`; `onUnauthorized` clears `token`+`user` in the store (no navigation here — nav is out of scope) | must     |
| R5  | A `hydrate()` / bootstrap action validates the persisted token against `GET /auth/me` before it's trusted | PDF §3 ("al iniciar…") | After rehydration, calling `hydrate()` calls `me()`; on success the user is refreshed; on failure (401/expired) the session is cleared         | must     |
| R6  | Unit tests for the session store (spec-required)                                                          | PDF §3                 | Tests assert: `login` sets token+user, `logout` clears both, `onUnauthorized` (simulated) clears the session, `hydrate` clears on failure      | must     |

## Explicitly out of scope

- **Login screen UI, route guards, navigation on logout/401** — `login-screen` / `app-nav-shell` tickets. `onUnauthorized` only clears store state here; it does not navigate.
- **`jobs.store` / `activity-stores`** — separate tickets; not persisted (A2 Decision 1), not touched here.
- **AsyncStorage itself** — already a declared dependency (`@react-native-async-storage/async-storage`); no new package.
- **Backend changes** — `be-auth` already implements the endpoints this consumes.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Where `configureApi` gets called → **resolution:** at module load time in `auth.store.ts` (or a small init function invoked once), reading `useAuthStore.getState()` inside the injected closures so it always reflects current state, not a stale closure captured at store creation.
- [x] `hydrate()` naming/shape → **resolution:** research confirms Zustand `persist` rehydration hooks/APIs available in the installed version; plan picks the concrete mechanism (e.g. `onRehydrateStorage` callback vs. an explicit `hydrate()` action called from app startup).

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
