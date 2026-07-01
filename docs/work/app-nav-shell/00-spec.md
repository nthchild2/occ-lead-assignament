# Spec · app-nav-shell

- **Feature id:** `app-nav-shell`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 3 · Auth — route protection; deep link `occ://vacante/:id`); `docs/work/ROADMAP.md` (Epic C); `docs/A3 · Navigation & Deep Linking.md`
- **Depends on:** `app-auth-store` (session/hydration), `jobs-store` (activeJobId, for the later sheet), `activity-stores` (reset on logout, if wired here)

## Summary

Scaffold `app/app/` — the Expo Router file-based route tree — with route groups `(auth)` and `(protected)/(tabs)/activities`, a root `_layout.tsx` wiring providers (SafeAreaProvider, GestureHandlerRootView, BottomSheetModalProvider, font loading via `useThemeFonts`, theme), a protected-route guard that redirects based on `auth.store` session state, and the `occ://` deep-link scheme registered in `app.json`. This is the navigation skeleton only — no screen content (login form, job list, etc.) is built here; each route file renders a placeholder that the later screen tickets replace.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                                                                       | Source                                                 | Acceptance criterion                                                                                                                                                        | Priority                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R1  | Route group structure exists: `(auth)/login`, `(protected)/(tabs)/index`, `(protected)/(tabs)/activities/{applied,favorites}`                                        | PDF §3; A3                                             | The file tree matches A3's documented structure; each route file renders a minimal placeholder (screen ticket's job to fill in)                                             | must                                                                      |
| R2  | Root `_layout.tsx` wires SafeAreaProvider, GestureHandlerRootView, BottomSheetModalProvider, and loads theme fonts before rendering children                         | PDF §3 (gorhom/bottom-sheet, gesture-handler deps); A1 | App renders nothing (or a loading state) until `useThemeFonts()` resolves `true`; providers wrap the route tree in the correct nesting order                                | must                                                                      |
| R3  | `(protected)/_layout.tsx` guards the subtree: redirects to `(auth)/login` if there's no valid session                                                                | PDF §3 ("al iniciar la app, validar el token"); A3     | On mount, reads `auth.store`; if no token, immediately redirects; if a token exists, calls `hydrate()` and redirects to login on failure, renders children on success       | must                                                                      |
| R4  | `(auth)/_layout.tsx` redirects an already-authenticated user away from `/login` to the protected area                                                                | A3                                                     | If `auth.store` has a valid session, mounting `(auth)` redirects to `(protected)/(tabs)`                                                                                    | must                                                                      |
| R5  | Bottom tab navigator at `(protected)/(tabs)/_layout.tsx`: Búsqueda                                                                                                   | Actividades                                            | PDF §3 (Screen 1/4)                                                                                                                                                         | Two tabs are registered and navigable                                     | must |
| R6  | Top tab/segmented control at `(protected)/(tabs)/activities/_layout.tsx`: Postuladas                                                                                 | Favoritos                                              | PDF §3 (Screen 4)                                                                                                                                                           | Two nested routes are registered and navigable within the Actividades tab | must |
| R7  | The `occ://` URL scheme is registered so `occ://vacante/:id` deep links resolve into the app                                                                         | PDF §3 (Screen 2/5)                                    | `app.json`'s `scheme` is set to `occ`; the app is linkable via that scheme (verified via Expo's linking config, not a live device test)                                     | must                                                                      |
| R8  | A `BottomSheetModal` placeholder/provider is mounted at the `(protected)` layout level (decoupled from the tab navigator), ready for `job-detail-sheet` to attach to | A3 (sheet coexists with routes)                        | `BottomSheetModalProvider` wraps `(protected)`'s subtree; no actual sheet content yet (that's `job-detail-sheet`'s job)                                                     | must                                                                      |
| R9  | Logout (when triggered) navigates back to `(auth)/login` and resets the activity stores                                                                              | A2 Decision 1 (session lifecycle)                      | Calling `auth.store`'s `logout`/`clearSession` from within the protected tree results in navigation to login; `applications.store`/`favorites.store`'s `reset()` are called | should                                                                    |

## Explicitly out of scope

- **Screen content** (search UI, job cards, login form fields, activities lists) — later screen tickets (`login-screen`, `job-search-screen`, `activities-screen`).
- **`job-detail-sheet` / `job-detail-swipe`** — the actual sheet content and swipe logic; this ticket only provides the `BottomSheetModalProvider` mount point.
- **Push notifications / deep-link event handling** (notifee, tap-to-open-sheet) — `push-notifications` ticket; this ticket only registers the URL scheme so the OS routes `occ://` to the app.
- **Actual API calls beyond `hydrate()`** — already implemented in `app-auth-store`.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Placeholder screen content → **resolution:** each route file renders a minimal `<View><Text>` placeholder using the theme (via `useTheme()`), not literally empty, so the nav tree is visually verifiable without waiting for screen tickets.
- [x] Where the tab bar / top-tab visuals live → **resolution:** Expo Router's built-in `Tabs`/`Stack` navigators with minimal styling (theme colors), not a custom tab bar component — that polish is deferred to screen tickets if needed.
- [x] R9 (reset on logout) wiring location → **resolution:** research/plan decides whether this belongs in `(protected)/_layout.tsx`'s redirect-on-no-session effect, or a small wrapper in `auth.store` itself; kept as `should` since the stores already expose `reset()`/`clearSession()` primitives regardless of where the call site ends up.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
