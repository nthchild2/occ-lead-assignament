# Spec · app-api-client

- **Feature id:** `app-api-client`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 "Requisitos técnicos transversales"; `docs/work/ROADMAP.md` (Epic B); A2 Decision 3

## Summary

Build the centralized, typed API layer at `app/core/services/api.ts` — the single boundary through which every network call flows. Components and stores never call `fetch`/`axios` directly. It reads the base URL from env, injects the JWT on authenticated requests, validates responses with the shared Zod schemas, maps error envelopes to a typed `ApiError`, and triggers a session-clear/redirect on 401. To avoid a circular dependency with `auth.store` (which is built later and itself calls this client), the token source and the 401 handler are **injected** via a `configureApi(...)` call, not imported from the store.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                              | Source                 | Acceptance criterion                                                                                                                                                                         | Priority |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Provide typed request methods (`get`/`post`/`delete`, and `put`/`patch` if trivially uniform) over `fetch`  | PDF §3; A2             | A single module exports request helpers; each takes a response Zod schema and returns `z.infer<>`-typed data on success                                                                      | must     |
| R2  | Base URL comes from environment config, never hardcoded                                                     | PDF §2.1, §3           | The client resolves its base URL from env (Expo mechanism, e.g. `EXPO_PUBLIC_API_BASE_URL` / `expo-constants`); no literal URL in source; documented in an app-level `.env.example` / config | must     |
| R3  | Inject the JWT as `Authorization: Bearer <token>` on authenticated requests, via an injected token provider | PDF §3; A2             | Authenticated requests include the header sourced from a `getToken()` provider set by `configureApi`; unauthenticated calls omit it                                                          | must     |
| R4  | Validate every response body against its Zod schema and return typed data                                   | PDF §3                 | Success responses are parsed with the provided schema; a shape mismatch throws a typed error, never returns `any`                                                                            | must     |
| R5  | Map error responses (`{ error: { code, message } }`) to a thrown typed `ApiError`                           | PDF §2.3, §3           | A non-2xx response is parsed into `ApiError` (`@occ/shared`) and thrown; callers catch a typed error with `code` + `message`                                                                 | must     |
| R6  | On HTTP 401, invoke an injected `onUnauthorized` handler (clear session + redirect), then reject            | PDF §3 (token expiry)  | A 401 response triggers the `onUnauthorized` callback set via `configureApi`; the request still rejects so the caller doesn't proceed                                                        | must     |
| R7  | Unit tests for the client using `msw`                                                                       | PDF §3 (spec-required) | Tests assert: JWT injected on authed request, success parsed/typed, error envelope → thrown `ApiError`, 401 → `onUnauthorized` fired                                                         | must     |

## Explicitly out of scope

- **`auth.store` and session state** — `app-auth-store` ticket. This client only defines the injection points (`configureApi({ getToken, onUnauthorized })`); the actual wiring happens in `app-auth-store` / `app-nav-shell`.
- **Domain service modules** (`jobs.service`, `auth.service`, etc.) — they belong to their respective tickets and will be built on top of this client.
- **Navigation/redirect implementation** — `onUnauthorized` is injected; the redirect itself is wired by the nav shell.
- **Retry/offline/caching** — not required by the brief.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Env mechanism (`expo-constants` extra vs `EXPO_PUBLIC_` var) → **resolution:** research inspects `app/app.json` / existing config and picks the idiomatic Expo 54 approach; either satisfies R2 as long as the base URL is not hardcoded and is documented.
- [x] Circular dependency with `auth.store` → **resolution:** dependency inversion via `configureApi({ getToken, onUnauthorized })`; the client imports nothing from `store/`.

## Sign-off

- [x] Ledger reviewed — full-auto mode authorized 2026-07-01; proceeding to RESEARCH.
