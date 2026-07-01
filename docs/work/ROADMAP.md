# Roadmap · OCC Lead RN Exercise

Backlog derived from `docs/ejercicio_tecnico_lead_rn_occ.pdf`, decomposed into tickets sized for a single AIDLC run each (one implementer subagent per ticket, in one pass). Every ticket becomes a `docs/work/<id>/` run started with `/aidlc-spec <id>`.

- **Created:** 2026-07-01
- **Source:** `docs/ejercicio_tecnico_lead_rn_occ.pdf`
- **Framework:** see [`docs/A6`](<../A6 · AI-Assisted Development Lifecycle.md>) → "The Framework"

---

## Resolved cross-cutting decisions

These were settled before ticketing and are binding acceptance context for the tickets they touch. Each ticket's spec ledger should reference the relevant one rather than re-deciding it.

1. **Response envelope keeps no `ok` field.** The brief specifies `{ ok, data/error }`; we keep the `{ data }` / `{ error: { code, message } }` shape already committed in `backend/src/lib/response.ts:4` and all `packages/shared` schemas (A1 Decision 6). This is a deliberate, justified deviation — **the README must carry an explicit section explaining it** so it reads as a decision, not an oversight. (Owner: `be-core`.)
2. **`relevance` sort definition.** When `q` is present, rank by match quality — title match ranks above company match — with `publishedAt` descending as the tiebreak. When `q` is absent, `relevance` falls back to `date_desc`. (Owner: `be-jobs`.)
3. **Applied/favorited state is derived client-side.** `JobSchema` carries no `applied`/`favorited` flag; the app cross-references `applications.store` + `favorites.store` by job id to render toggle state. Keeps `GET /jobs` stateless/cacheable, matches A2's separate stores. (Owners: `activity-stores`, `job-detail-sheet`.)
4. **Job Detail is two tickets.** `job-detail-sheet` (static sheet + content + actions) then `job-detail-swipe` (swipe + transparent prefetch), split to keep each within one subagent's reach.
5. **Documented structural deviations stand.** `app/core/services/api.ts` (not `app/src/services/`) per A1's `core/` split, and the extra `packages/shared` workspace. Both already justified in A1/README; no further action.

> Priorities: nearly everything in the brief is a hard requirement, so ledgers will be mostly `must`. A few polish items (e.g. the swipe end-of-results indicator) may be `should`.

---

## Epic A · Backend API

Independent of the app — can start immediately. Services testable in isolation with `supertest`.

| ID             | Scope                                                                                                                                                                                                                                                                                                                                                                                                    | Deps                            | Size  | Required tests                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| `be-core`      | Error-code taxonomy (`AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `NOT_FOUND`, `ALREADY_APPLIED`, `ALREADY_FAVORITED`, `VALIDATION_ERROR`), Zod validation middleware (body + query), env config (`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`), CORS, graceful shutdown. `response.ts`/`logger.ts` already exist. **Also: add the README section justifying the no-`ok` envelope (decision #1).** | —                               | S–M   | —                                                                                    |
| `be-auth`      | `POST /auth/login` (validate fixed creds `test@occ.com.mx`/`Test1234`, JWT 1h expiry), `POST /auth/logout` (in-memory blacklist), `GET /auth/me`, JWT issue/verify, auth middleware                                                                                                                                                                                                                      | `be-core`                       | M     | supertest: login (valid/invalid), me (valid/expired), logout→blacklist               |
| `be-jobs`      | Seed ≥90 jobs (fields per brief; ≥4 pages at `limit=20`), `GET /jobs` — offset pagination, `q` (title+company), `city`, `salary_min`/`salary_max` (exclude null-salary rows when either present), 5 sorts incl. `relevance` (decision #2); `GET /jobs/:id` with 404                                                                                                                                      | `be-core`                       | **L** | service unit: filter combinations, each sort, pagination math, null-salary exclusion |
| `be-apply-fav` | `POST`/`DELETE /jobs/:id/apply` (409 already-applied / 404 not-applied), `GET /applications`; `POST`/`DELETE /jobs/:id/favorite` (409/404), `GET /favorites`; per-user in-memory state                                                                                                                                                                                                                   | `be-core`, `be-auth`, `be-jobs` | M     | supertest: apply/dupe/cancel, favorite/dupe/remove, auth-required                    |

## Epic B · App foundation

Parallel track. Screens can develop against the contract via `msw` before the real backend is wired.

| ID               | Scope                                                                                                                                                                                                    | Deps              | Size | Required tests                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---- | -------------------------------------------------------------------------------------- |
| `app-api-client` | `core/services/api.ts`: typed fetch wrapper, base URL from env (`expo-constants`), JWT injection interceptor, 401 handling (clear session + redirect), Zod-parsed responses, error mapping to `ApiError` | `packages/shared` | M    | **API service test (spec-required)** — JWT injected, 401 clears session, error parsing |
| `app-auth-store` | `auth.store` (Zustand + AsyncStorage persist), `login`/`logout`/`me` actions, session hydration bootstrap on launch                                                                                      | `app-api-client`  | M    | **session store test (spec-required)** — login sets token/user, logout clears          |

## Epic C · Navigation shell

| ID              | Scope                                                                                                                                                                                                                                                            | Deps             | Size |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---- |
| `app-nav-shell` | Expo Router groups `(auth)`/`(protected)`/`(tabs)`/`activities`, root `_layout` with providers (SafeArea, GestureHandler root, `BottomSheetModalProvider`, fonts via `useThemeFonts`, theme), protected-route guard + redirect, `occ://` deep-link scheme config | `app-auth-store` | M    |

## Epic D · Stores + screens

| ID                  | Scope                                                                                                                                                                                                                                                                | Deps                                             | Size  | Required tests                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----- | ------------------------------------ |
| `jobs-store`        | `jobs.store` (list, filters, pagination, activeJob/activeIndex), `useJobs` (fetchPage/fetchNextPage/refetch), `useDebounce`                                                                                                                                          | `app-api-client`                                 | M     | **search hook test (spec-required)** |
| `activity-stores`   | `applications.store` + `favorites.store` + services (list/mutate), applied/favorited derivation helper (decision #3)                                                                                                                                                 | `app-api-client`                                 | M     | —                                    |
| `login-screen`      | `(auth)/login.tsx` form (Input/Button), validation, error states, wire to `auth.store`, redirect on success                                                                                                                                                          | `app-auth-store`, `app-nav-shell`                | S–M   | —                                    |
| `job-search-screen` | `(tabs)/index.tsx`: FlashList, debounced search (300ms), inline city filter (Select), salary-range inputs (hide null-salary when active), sort selector (5 opts, resets to page 1), end-reach pagination, filters/sort reset list, skeleton/error+retry/empty states | `jobs-store`, `app-nav-shell`                    | **L** | —                                    |
| `job-detail-sheet`  | `BottomSheetModal` in `(protected)/_layout`, snap points 60%/100%, `BottomSheetScrollView`, detail content, Apply + Favorite (optimistic via `activity-stores`), 401→login, 409→message without closing; opens via `activeJobId`                                     | `app-nav-shell`, `jobs-store`, `activity-stores` | **L** | —                                    |
| `job-detail-swipe`  | Horizontal swipe between jobs (reanimated + gesture-handler, 60fps UI thread), transparent prefetch (3-from-end, silent, `InteractionManager`), end-of-results indicator on failure, active item visible in list on close (`scrollToIndex`)                          | `job-detail-sheet`, `job-search-screen`          | **L** |                                      |
| `activities-screen` | `(tabs)/activities` top tabs applied/favorites, lists from stores, cancel application + remove favorite with immediate optimistic feedback                                                                                                                           | `activity-stores`, `app-nav-shell`               | M     | —                                    |

## Epic E · Notifications

| ID                   | Scope                                                                                                                                                                                                                                                     | Deps                                                  | Size  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----- |
| `push-notifications` | notifee setup, Android channel HIGH importance, local "Nueva vacante para ti" (payload carries job id), `occ://vacante/:id` → open detail sheet over active tab, tap handling in foreground/background/quit, quit-state session-hydration-before-navigate | `app-nav-shell`, `job-detail-sheet`, `app-auth-store` | **L** |

---

## Build waves

Backend and app-foundation tracks run in parallel; screens develop against the contract (`msw`) until the real backend is wired.

```
Wave 1   be-core                 ‖  app-api-client
Wave 2   be-auth · be-jobs       ‖  app-auth-store · jobs-store · activity-stores
Wave 3   be-apply-fav            ‖  app-nav-shell
Wave 4                              login-screen · job-search-screen
Wave 5                              job-detail-sheet → job-detail-swipe · activities-screen
Wave 6                              push-notifications
```

## How to run a ticket

```
/aidlc-spec <id>          # scaffold docs/work/<id>/ + draft the ledger, then human sign-off
/aidlc-run  <id> [mode]   # research → plan → implement → verify under a gate policy
```

Reference the relevant resolved decision(s) above when filling each ticket's spec ledger, so the pipeline doesn't re-litigate settled calls.
