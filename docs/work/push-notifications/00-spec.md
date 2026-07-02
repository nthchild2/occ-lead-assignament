# Spec · push-notifications

- **Feature id:** `push-notifications`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 5 · Notificaciones push locales)
- **Depends on:** `app-nav-shell` (route tree, `occ://` scheme), `job-detail-sheet`/`job-detail-swipe` (the sheet this opens), `app-auth-store` (`hydrate()` for quit-state session validation)

## Summary

Implement local push notifications via `@notifee/react-native`: an Android notification channel with HIGH importance, a way to trigger a local "Nueva vacante para ti" notification carrying a job id in its payload, and tap-handling across all three app lifecycle states (foreground, background, quit) that opens the Job Detail sheet for the corresponding job via the `occ://vacante/:id` deep link. Quit-state taps must wait for session hydration before navigating (respecting `(protected)/_layout.tsx`'s existing guard).

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                                       | Source | Acceptance criterion                                                                                                                                                                            | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | An Android notification channel is created with HIGH importance                                                      | PDF §3 | `notifee.createChannel({ importance: AndroidImportance.HIGH, ... })` is called (guarded/no-op on iOS)                                                                                           | must     |
| R2  | A function/trigger displays a local notification simulating "Nueva vacante para ti" with a job id in the payload     | PDF §3 | Calling the trigger (e.g. from a dev/demo entry point, since there's no backend push source) calls `notifee.displayNotification` with `data: { jobId }`                                         | must     |
| R3  | Foreground tap opens the Job Detail sheet for the notification's job                                                 | PDF §3 | `notifee.onForegroundEvent` with `EventType.PRESS` sets the deep-link route param, opening the sheet without a full navigation reset                                                            | must     |
| R4  | Background tap (app backgrounded, not killed) opens the Job Detail sheet on foreground                               | PDF §3 | `notifee.onBackgroundEvent` handles the press; the app opens to the correct job when brought to foreground                                                                                      | must     |
| R5  | Quit-state tap (app was killed) opens the Job Detail sheet after the app cold-starts and session hydration completes | PDF §3 | `notifee.getInitialNotification()` is checked at startup; the job id is held until `(protected)/_layout.tsx`'s `hydrate()` resolves, then navigation proceeds                                   | must     |
| R6  | The deep link `occ://vacante/:id` resolves to opening the Job Detail sheet for that job                              | PDF §3 | Navigating/deep-linking to that URL sets `activeJobId` (via `jobs.store`, reusing existing sheet-open machinery), fetching the job if not in the list (reuses `job-detail-sheet`'s R9 fallback) | must     |

## Explicitly out of scope

- **A real backend push source (FCM/APNs)** — the brief only requires local notifications simulating the message; no server-side push infrastructure.
- **iOS-specific notification permission UX polish** — basic functional wiring only; no custom permission-priming screens.
- **Changing the Job Detail sheet's content/behavior** — already built in `job-detail-sheet`/`job-detail-swipe`; this ticket only triggers opening it via a different entry point (deep link / notification tap) instead of a card tap.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Where the "trigger a demo notification" entry point lives → **resolution:** research/plan decides — likely a small dev-only button/screen or a call fired shortly after login for demo purposes, since there's no real backend event to hook it to; keep minimal, don't over-build.
- [x] How `occ://vacante/:id` actually reaches `(protected)/_layout.tsx`'s existing `activeJobId`-setting logic → **resolution:** research confirms Expo Router's deep-linking mechanism (a matching route file, or `Linking`/`expo-router`'s URL handling) and how to translate the incoming `:id` param into a `setActiveJob` call, reusing as much of `job-detail-sheet`'s existing not-in-list fallback as possible.
- [x] Quit-state jobId handoff mechanism → **resolution:** A3's own documented note (from `app-nav-shell`'s research) flagged this needs a deliberate handoff (module-level ref or similar) between `app/_layout.tsx` and `(protected)/_layout.tsx` — research confirms the concrete mechanism against the current codebase.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
