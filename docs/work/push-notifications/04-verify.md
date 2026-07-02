# Verification Report · push-notifications

- **Feature id:** `push-notifications`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `03-impl-report.md`, `01-research.md`
- **Verifier:** agent (VERIFY phase, independent/fresh context — RE-VERIFY, second pass)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

**Context:** this is a re-verify after a first FAIL. The prior FAIL found that `handleSheetDismiss`'s guard (`activeJobIndex !== null && activeJobIndex >= 0`) had no test covering the `activeJobIndex: -1` case specifically (only `null` and `4` were exercised) — a real, confirmed gap: three of this ticket's production entry points (`handleForegroundPress`, `consumePendingIfReady`, `vacante/[id].tsx`) all call `setActiveJob(id, -1)`, so `-1` is a genuinely reachable production value with zero direct test coverage. The impl-report's Deviations item 4 claims a new test case was added and independently mutation-tested to close this gap. This report does not trust that narrative — every claim below was re-derived from scratch, per the instructions for this re-verify.

## 1 · Coverage matrix

Cross-referenced the ledger against the impl-report by reading every changed/new production file directly.

| R-id | Priority               | Has change? | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1   | must                   | ✅          | `core/services/notifications.service.ts:13-21` `initNotificationChannel()` — Android-only, `AndroidImportance.HIGH`, no-op on iOS via `Platform.OS` guard. Called from `app/_layout.tsx:44` in a mount effect. Tested: `notifications.service.test.ts` ("creates the jobs channel with HIGH importance on Android", "is a no-op on iOS"); `app/_layout.test.tsx` ("calls initNotificationChannel() on mount").                                                                                         |
| R2   | must                   | ✅          | `core/services/notifications.service.ts:27-34` `triggerDemoJobNotification(jobId)` — `notifee.displayNotification` with `data: { jobId }`, title "Nueva vacante para ti". Fired from `app/(auth)/login.tsx:55` after a successful login. Tested in `notifications.service.test.ts` (call shape) and `login.test.tsx` (fire-on-success coverage).                                                                                                                                                       |
| R3   | must                   | ✅          | `app/(protected)/_layout.tsx:73-79,139-142` `handleForegroundPress` registered via `notifee.onForegroundEvent` in a mount effect; `EventType.PRESS` → `setActiveJob(jobId, -1)`, non-PRESS is a no-op. Tested directly in `_layout.test.tsx` (both cases, lines 381-432, read in full).                                                                                                                                                                                                                |
| R4   | must                   | ✅          | `app/_layout.tsx:20-25` module-level `notifee.onBackgroundEvent` registration (outside the component function, registered exactly once per process); stashes `data.jobId` via `setPendingJobId`, never navigates directly. Tested in `app/_layout.test.tsx` (stash/skip cases).                                                                                                                                                                                                                        |
| R5   | must                   | ✅          | `app/_layout.tsx:46-51` (`getInitialNotification` → `setPendingJobId`) + `app/(protected)/_layout.tsx:89-95,148-150` (`consumePendingIfReady`, hydration-gated) + `core/lib/pendingNotification.ts` (read-and-clear holder). Tested in `app/_layout.test.tsx` and `_layout.test.tsx` ("consumes a pending quit-state job id... once hydration is ready, not before"; "does not call setActiveJob when there is no pending job id"), plus `pendingNotification.test.ts` for the holder's own semantics. |
| R6   | must                   | ✅          | `app/(protected)/vacante/[id].tsx` — new dynamic route, reads `id`, calls `setActiveJob(id, -1)`, redirects to `/(protected)/(tabs)`. Tested in `vacante/[id].test.tsx`.                                                                                                                                                                                                                                                                                                                               |
| —    | (bug-fix, R6-adjacent) | ✅          | `handleSheetDismiss`'s guard: `activeJobIndex !== null && activeJobIndex >= 0` (`_layout.tsx:53`) — prevents `scrollToIndex({ index: -1 })` for jobs opened via notification/deep-link with no known list position. **The item this ticket's prior VERIFY FAILED on — independently re-verified in its own section below, not just re-read.**                                                                                                                                                          |

- [x] **No gaps** — every `must` requirement (R1-R6) has ≥1 change, independently confirmed against the actual source (not just the impl-report's table), and the previously-flagged coverage gap on the `-1` guard is now closed (see mutation section below).
- [x] **No orphans** — every changed file traces to at least one R-id; `git log` confirms `app/app/(protected)/JobDetail.tsx` and `app/store/auth.store.ts` were last touched by earlier tickets, not this one — no unexplained production changes exist beyond what the ledger/plan describe.
- [x] Out-of-scope items were **not** implemented:
  - No real backend push (FCM/APNs) — `notifications.service.ts` only calls local `notifee.displayNotification`.
  - No iOS permission-priming UX — zero occurrences of `requestPermission` anywhere in `app/app`, `app/core`, `app/store`.
  - `JobDetail.tsx` untouched — `git log --oneline -3 -- app/app/(protected)/JobDetail.tsx` shows its last commits are `55c4209`/`6eab4fc` (`job-detail-sheet`/`job-detail-swipe`), nothing from this ticket.
  - `app.json`'s `scheme`/`plugins` array untouched — read directly: `"scheme": "occ"` and the three-entry `plugins` array (including the still-inert `"@notifee/react-native"` string) are exactly as research/plan describe, no new plugin entry added.

## 2 · Citation spot-check

| Cited claim                                                                                                                | `path:line`                                                                         | Holds up?                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enum EventType { ... PRESS=1 ... }`                                                                                       | `app/node_modules/@notifee/react-native/src/types/Notification.ts:310-372`          | ✅ Read directly — `UNKNOWN = -1`, `DISMISSED = 0`, `PRESS` immediately follows as the next member, matching the claimed value `1`.                                                                                                            |
| `enum AndroidImportance { ... HIGH=4 ... }`                                                                                | `app/node_modules/@notifee/react-native/src/types/NotificationAndroid.ts:1291-1307` | ✅ Read directly — `DEFAULT = 3`, `HIGH = 4` confirmed verbatim. This is the highest-risk citation (a silently-drifted hand-rolled mock would make tests pass while misrepresenting production semantics) — independently re-confirmed, holds. |
| `jobs.store.ts:26`: `setActiveJob: (id: string, index: number) => void` (non-nullable index — motivates the `-1` sentinel) | `app/store/jobs.store.ts:6-29`                                                      | ✅ Confirmed — interface declares exactly this signature.                                                                                                                                                                                      |
| `app/(protected)/_layout.tsx:43-53`: `handleSheetDismiss` needs an `activeJobIndex >= 0` guard fix                         | `app/app/(protected)/_layout.tsx:53` (current)                                      | ✅ Guard now reads `if (flashListRef?.current && activeJobIndex !== null && activeJobIndex >= 0)`, exactly as plan/report describe.                                                                                                            |
| Hand-rolled mock's `EventType`/`AndroidImportance` "copied from the real package's type declarations"                      | `app/jest/notifeeMock.js:21-34` vs. real source above                               | ✅ Values match exactly (`PRESS: 1`, `HIGH: 4`, `DEFAULT: 3`, `UNKNOWN: -1`, `DISMISSED: 0`).                                                                                                                                                  |

All sampled citations are relevant and accurate, not just path-valid.

## 3 · Tooling gate

| Check                                             | Command                          | Result                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (all workspaces)                            | `pnpm -r run typecheck`          | ✅ Clean — `packages/shared`, `app`, `backend` all report "Done"                                                                                                                                         |
| Lint (repo-wide)                                  | `pnpm lint`                      | ✅ 0 errors; 12 pre-existing unrelated `backend` `security/detect-object-injection` warnings, unrelated to this feature                                                                                  |
| Tests (app, fresh)                                | `pnpm --filter './app' run test` | ✅ **24 suites / 153 tests, all green** — one more than the prior FAIL's 152, matching the new `-1` test case. Confirmed as a fresh run, and reconfirmed again after my own mutation+revert cycle below. |
| Eslint on the 6 changed source files individually | `eslint <files>`                 | ✅ 0 errors/warnings — confirms `complexity: 10` is respected on `(protected)/_layout.tsx` and `app/_layout.tsx` despite the former now being touched by four consecutive tickets                        |

No failing output to paste — all green.

## Independent `-1` guard mutation (the one thing that matters most)

Re-derived from scratch per the re-verify instructions; the prior report's fix and mutation claim were not trusted.

1. **Read the actual test file directly** (`app/app/(protected)/_layout.test.tsx:338-357`), not just grepped for the string. The new test genuinely exists and structurally mirrors the pre-existing `null`-case test (lines 317-336): same `setActiveJobId` helper, same `scrollToIndex` mock setup, only `activeJobIndex: -1` differs. It asserts `expect(scrollToIndex).not.toHaveBeenCalled()` and `expect(clearActiveJob).toHaveBeenCalledTimes(1)` — a real, non-vacuous assertion on the exact behavior the guard exists to provide.

2. **Applied my own mutation** to `app/app/(protected)/_layout.tsx:53` (backed up the pre-mutation file first), changing:

   ```
   if (flashListRef?.current && activeJobIndex !== null && activeJobIndex >= 0) {
   ```

   to:

   ```
   if (flashListRef?.current && activeJobIndex !== null) {
   ```

3. **Reran** `app/_layout.test.tsx` and `app/(protected)/_layout.test.tsx` together (`pnpm exec jest "_layout.test.tsx" --verbose`). Result: **exactly one test failed** — `onDismiss skips scrollToIndex without throwing when activeJobIndex is -1 (notification/deep-link-opened job with no known list position) (R7, push-notifications)` — with the precise symptom the guard is meant to prevent:

   ```
   expect(jest.fn()).not.toHaveBeenCalled()
   Expected number of calls: 0
   Received number of calls: 1
   1: {"animated": false, "index": -1}
   ```

   All 17 other tests across both `_layout.test.tsx` files (including the pre-existing `null`- and `4`-index cases, and all R3/R4/R5 notification-wiring cases) remained green — confirming the mutation's blast radius is exactly the one test designed to catch it.

4. **Reverted** the mutation and confirmed via `diff` against a pre-mutation backup: **byte-identical**. `git status` on the file showed no diff.

5. **Reran the full app suite**: 24 suites / 153 tests, all green again.

This independently confirms the gap the prior VERIFY pass found is now genuinely closed — the new test has real teeth, not just textual presence in the file.

## Spot-checks on other prior-verified items (re-confirmed, not exhaustively redone)

- **notifee `moduleNameMapper` fix (highest-risk item):** `app/package.json:50` maps `^@notifee/react-native$` to `<rootDir>/jest/notifeeMock.js` — **not** the broken `@notifee/react-native/jest-mock.js`. Confirmed by direct read of both `package.json` and `jest/notifeeMock.js`. The mock is CommonJS, exposes exactly the five methods the codebase calls, and its enum values were re-verified byte-for-byte against the real installed package's type declarations (see citation spot-check above).
- **Hydration-gate logic:** `consumePendingIfReady(hydration)` (`_layout.tsx:89-95`) early-returns unless `hydration === 'ready'`; the "consumes a pending quit-state job id... once hydration is ready, not before" test (`_layout.test.tsx:434-453`) asserts `setActiveJob` is not called before hydration settles and is called with the pending id afterward — read directly, logic and test remain genuinely coupled.
- **`EventType.PRESS` gate:** `handleForegroundPress` (`_layout.tsx:73-79`) gates on `event.type !== EventType.PRESS`; the "not a PRESS is a no-op" test (`_layout.test.tsx:409-432`) uses `EventType.DISMISSED` and asserts `setActiveJob` is never called.

## Findings

- No `any` or non-null assertion (`!`) found in any changed source file (`(protected)/_layout.tsx`, `app/_layout.tsx`, `pendingNotification.ts`, `notifications.service.ts`, `vacante/[id].tsx`, `login.tsx`) — confirmed by grep plus a clean eslint pass (`@typescript-eslint/no-non-null-assertion` is `error` in `.eslintrc.js:14` and did not fire).
- `(protected)/_layout.tsx` has now been touched by four consecutive tickets (`app-nav-shell`, `job-detail-sheet`, `job-detail-swipe`, `push-notifications`) and remains under the eslint `complexity: 10` ceiling via the two extracted standalone helpers (`handleForegroundPress`, `consumePendingIfReady`), mirroring the pre-existing `handleSheetDismiss` extraction pattern.
- The previously-flagged gap (no direct test for `activeJobIndex: -1` on `handleSheetDismiss`'s guard) is closed: the new test exists, matches the established pattern, and was independently proven load-bearing via my own mutation-and-revert cycle above.
- `DEMO_JOB_ID = 'demo-job-1'` in `login.tsx` remains a hardcoded placeholder — flagged by the impl-report as a known, accepted limitation, in-scope-acceptable per the spec's "no real backend push source."
- This is the final ticket in the roadmap; no further follow-up tickets exist per the impl-report.

## Verdict

- ✅ **PASS** → ready for human PR review.

**Reviewer summary (on pass):** Local push notifications (`@notifee/react-native`) are wired across all three lifecycle states (foreground/background/quit) plus a direct `occ://vacante/:id` deep link, all converging on the existing `setActiveJob` sheet-open mechanism. The gap from the prior FAIL — a missing test for `handleSheetDismiss`'s `activeJobIndex: -1` guard case — is now closed and independently re-verified via my own mutation (removed the `>= 0` clause, confirmed exactly the new test fails with the expected `scrollToIndex({ index: -1 })` call and all 17 other tests stay green, reverted, confirmed byte-identical). Fresh tooling gate is green end-to-end: `tsc` clean across all 3 workspaces, `eslint` 0 errors, and 24/24 suites (153/153 tests) passing. This is the final ticket in the entire roadmap.

All source-code mutations made during this verification (the `-1` guard removal) were reverted; no code was left modified. `git status` at the end of this verification run matches its state at the start.
