# Verification Report · job-detail-sheet

- **Feature id:** `job-detail-sheet`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** agent (VERIFY phase, independent/fresh context)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                                                                      |
| ---- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `snapPoints={['60%', '100%']}` on `BottomSheetModal` (`_layout.tsx:13,93`); `_layout.test.tsx` asserts `props.snapPoints` equals `['60%','100%']` directly on the mounted mock.                                                                                                                                                                            |
| R2   | must     | ✅          | `useEffect` on `activeJobId` calls `sheetRef.current?.present()` (`_layout.tsx:63-67`); `_layout.test.tsx` asserts not-called-while-null and called-once-on-transition. Confirmed via mutation (see §4).                                                                                                                                                   |
| R3   | must     | ✅          | `JobDetailContent` renders title/company/city/salary(conditional)/description/tags(`Badge`)/`publishedAt` inside `BottomSheetScrollView` (`JobDetail.tsx:184-250`); `JobDetail.test.tsx` asserts each field's text and the salary-null-hides case.                                                                                                         |
| R4   | must     | ✅          | `onDismiss={() => useJobsStore.getState().clearActiveJob()}` (`_layout.tsx:94`); asserted directly and confirmed via mutation (see §4).                                                                                                                                                                                                                    |
| R5   | must     | ✅          | `handleApply` calls `useApplicationsStore.getState().add(job.id, job)` (`JobDetail.tsx:162-169`); Apply button label/variant/disabled branch on `isJobApplied` (`ActionButtons`, `JobDetail.tsx:120-134`). Tests assert `toHaveBeenCalledWith('job-1', job)` and that the disabled "Ya aplicaste" state blocks the call.                                   |
| R6   | must     | ✅          | `handleToggleFavorite` calls `.add(job)` / `.remove(job.id)` based on `isJobFavorited` (`JobDetail.tsx:171-182`); tests assert `toHaveBeenCalledWith` in both directions with the opposite action asserted `not.toHaveBeenCalled()`.                                                                                                                       |
| R7   | should   | ✅          | `messageFor` falls back to `GENERIC_ACTION_ERROR` for non-`ApiError` rejections (`JobDetail.tsx:34-37`); test rejects `add()` with a plain `Error` and asserts the generic inline message, no crash.                                                                                                                                                       |
| R8   | must     | ✅          | `try/catch` around `add`/`remove` sets an inline message via `messageFor`, never re-throws or dismisses (`JobDetail.tsx:162-182`); tests reject with `ApiError('ALREADY_APPLIED', ...)` and `ApiError('ALREADY_FAVORITED', ...)` and assert the specific message renders and sheet content stays mounted. Confirmed via mutation (see §4).                 |
| R9   | should   | ✅          | `jobs.service.getById` added (`jobs.service.ts:30-32`), covered by `jobs.service.test.ts`; `useActiveJob` hook falls back to it when not found in `jobs.store.jobs`, holding local `loading`/`error`/`fetchedJob` state with a `retry` (`JobDetail.tsx:46-99`). Tests cover loading→resolved and error→retry transitions. Confirmed via mutation (see §4). |

- [x] **No gaps** — every `must` requirement (R1–R6, R8) has ≥1 change, confirmed by reading the actual implementation, not just the impl-report's table.
- [x] **No orphans** — every change traces to ≥1 requirement; no unexplained code found in `jobs.service.ts`, `JobDetail.tsx`, or `_layout.tsx`.
- [x] Out-of-scope items were **not** implemented — confirmed by grep: no `scrollToIndex`, `useLocalSearchParams`, `router.setParams`, `activeJobIndex` usage, `prefetch`, `swipe`, or `occ://vacante` handling anywhere in the touched files. `packages/shared/` has zero diff. `app/store/*` files have zero diff (only `app/core/services/jobs.service.ts` was touched, matching the plan's minimal-addition scope).

**Placement check (`JobDetail.tsx` under `app/app/(protected)/`, not `core/components/`):** confirmed the file lives at `app/app/(protected)/JobDetail.tsx`. However, the plan's and impl-report's stated justification — "`core/` must not import from `app/` … it cannot live under `core/components/` without inverting that boundary" — does not hold up to a literal reading of the eslint rule. The actual zone in `.eslintrc.js:33-44` is `{ target: './app/core', from: './app/app' }`, i.e. it forbids `core/` importing from `app/app/*` specifically. `JobDetail.tsx`'s imports are exclusively `core/*`, `store/*` (e.g. `../../store/applications.store`), and external packages — **zero** imports from `app/app/*`. Critically, `core/` already imports from `store/` elsewhere in the codebase today with zero lint errors (e.g. `app/core/lib/activityStatus.ts:1-2` imports `useApplicationsStore`/`useFavoritesStore` directly, and `pnpm lint` confirms 0 errors repo-wide). So store-awareness alone does **not** force `JobDetail.tsx` out of `core/components/`; the eslint boundary as literally written would not have been violated by placing it there. This is a **finding, not a blocking defect** — the placement itself is still reasonable on other grounds (it is the sheet's route-adjacent content, one-call-site, arguably not a generic reusable primitive per `docs/MAP.md`'s "one component per file, exported via `core/components/index.ts`" convention for _reusable_ primitives), and no eslint error was actually produced by the current placement either way. Flagging for the reviewer since the stated rationale in the plan/impl-report overstates what the tooling would actually enforce.

## 2 · Citation spot-check

| Cited claim                                                                                                | `path:line`                                                   | Holds up? |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------- |
| `BottomSheetModalProvider` mounted once at root, wrapping bare `<Slot />`, not duplicated at `(protected)` | `app/app/_layout.tsx:12-15,26-28`                             | ✅        |
| `isJobApplied`/`isJobFavorited` are plain functions (no hooks), read `getState().items` synchronously      | `app/core/lib/activityStatus.ts:11-17`                        | ✅        |
| `ApiError` class has a `code: string` field settable/catchable via `instanceof`                            | `app/core/services/api.ts:28-36`                              | ✅        |
| `GET /jobs/:id` exists on the backend, public (no `authMiddleware` in the chain)                           | `backend/src/domains/jobs/jobs.router.ts:25-32`               | ✅        |
| Exact 409 code string `ALREADY_APPLIED`                                                                    | `backend/src/domains/applications/applications.service.ts:48` | ✅        |
| Exact 409 code string `ALREADY_FAVORITED`                                                                  | `backend/src/domains/favorites/favorites.service.ts:47`       | ✅        |
| `JobDetailResponseSchema`/`JobDetailResponse` already exist in `@occ/shared`                               | `packages/shared/src/schemas/job.schema.ts:42-44,50`          | ✅        |
| `JobCard.tsx`'s `formatSalary` pattern (`Intl.NumberFormat('es-MX', {...})`) is the precedent mirrored     | `app/core/components/JobCard.tsx:19-25`                       | ✅        |
| `ErrorState` wraps `EmptyState` with a retry action (`actionLabel="Reintentar"`)                           | `app/core/components/ErrorState.tsx:1-23`                     | ✅        |

All sampled citations are accurate and relevant, not just path-valid.

## 3 · Tooling gate

| Check       | Command                               | Result                                                                                                                                   |
| ----------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Types (app) | `pnpm --filter './app' run typecheck` | ✅ PASS (clean, no output)                                                                                                               |
| Lint        | `pnpm lint`                           | ✅ PASS (0 errors, 12 pre-existing `security/detect-object-injection` warnings in unrelated `backend/` files, unchanged by this feature) |
| Tests (app) | `pnpm --filter './app' run test`      | ✅ PASS — **17/17 suites, 98/98 tests**, matching the implementer's self-check exactly (independently re-run fresh)                      |

## 4 · Mutation testing (high-scrutiny — proving the new mocks are not vacuous)

All mutations applied to the working-tree files, tested, and reverted (confirmed byte-identical via `diff` against pre-mutation backups after each revert; final full suite re-run confirms 17/17 green).

| #   | Mutation                                                                                   | File                             | Expected failure                                                       | Actual result                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Commented out `sheetRef.current?.present()` inside the `activeJobId` `useEffect`           | `_layout.tsx`                    | R1/R2 "calls present()..." test fails                                  | ✅ Failed exactly as expected (`Expected number of calls: 1, Received: 0`); other 2 tests in the file stayed green                                                                                                                                              |
| 2   | Replaced `onDismiss={() => useJobsStore.getState().clearActiveJob()}` with a no-op         | `_layout.tsx`                    | R4 "onDismiss calls clearActiveJob()" test fails                       | ✅ Failed exactly as expected; other 2 tests stayed green                                                                                                                                                                                                       |
| 3   | `messageFor` always returns `GENERIC_ACTION_ERROR`, ignoring `ApiError`'s specific message | `JobDetail.tsx`                  | R8's `ALREADY_APPLIED`/`ALREADY_FAVORITED`-specific message tests fail | ✅ 3 tests failed (both 409-specific tests plus the R9 `getById`-rejection error-message test, which also depends on `messageFor`); the other 8 tests (including the R7 generic-error test, which coincidentally also asserts the generic message) stayed green |
| 4   | R9 fallback branch returns early before calling `jobsService.getById`                      | `JobDetail.tsx` (`useActiveJob`) | Both R9 fallback-fetch tests (loading→resolved, error→retry) fail      | ✅ Both failed exactly as expected (`Unable to find an element with text: 'Fetched Job'` / `'No se encontró la vacante'`); the other 9 tests stayed green                                                                                                       |

**Conclusion: neither the `@gorhom/bottom-sheet` mock nor the `expo-router` `Slot`/`Redirect` mock makes the tests vacuous.** Both mocks render `children`/forward props genuinely (`MockBottomSheetModal` uses `useImperativeHandle` to wire the module-level `mockPresent`/`mockDismiss` spies to the actual ref, and forwards `onDismiss`/`snapPoints` as real props the test reads back — not stubbed to always-pass), and all four targeted mutations were caught precisely by the relevant test(s) without over- or under-triggering unrelated tests.

**Store-action call-argument precision:** confirmed all positive call assertions in `JobDetail.test.tsx` use `toHaveBeenCalledWith` with the real argument values, not `toHaveBeenCalled()`:

- `expect(applicationsAdd).toHaveBeenCalledWith('job-1', job)` — the actual `job` object, not a stub.
- `expect(favoritesAdd).toHaveBeenCalledWith(job)`
- `expect(favoritesRemove).toHaveBeenCalledWith('job-1')`
- Negative assertions (`not.toHaveBeenCalled()`) are correctly used only to confirm the _opposite_ action wasn't also triggered.

**`Button`'s `disabled` state is real, not cosmetic:** confirmed `Button.tsx:103-106` passes `disabled={disabled || loading}` to the underlying `Pressable`, which genuinely blocks `onPress`; the "Ya aplicaste" test presses the disabled button and asserts `add` was never called — a behavioral test, not a rendering-only check.

**No `any`/`!` in new or changed files:** confirmed via grep across `JobDetail.tsx`, `_layout.tsx`, `jobs.service.ts`, and all three new test files — zero occurrences of `any` as a type or non-null assertions (`!`); only the English word "any" appears in prose comments.

## 5 · Auto-commit / working-tree consistency check

The impl-report notes an external process auto-committed a mid-session snapshot (`6eab4fc "Add Job Detail sheet, service, tests, docs"`). Confirmed:

- The working tree currently has one uncommitted diff beyond that commit: `app/app/(protected)/_layout.test.tsx` gained a `snapPoints` prop assertion refinement (adds `snapPoints` to the mock's props interface/forwarding and a new `expect(...props.snapPoints).toEqual(['60%','100%'])` assertion) — a strict superset/refinement of the committed version, not a divergent or conflicting change.
- `docs/work/job-detail-sheet/03-impl-report.md` is untracked (written after the commit), which is expected and consistent with this being the final artifact for this VERIFY phase to consume.
- No files are missing or duplicated as a result — the working tree (what was read, tested, and mutation-tested in this report) is the authoritative, most current, and internally consistent state. All tooling-gate and mutation results above were run against this working-tree state, not the stale commit.

## Findings

- The plan's/impl-report's stated eslint-boundary rationale for placing `JobDetail.tsx` outside `core/components/` is imprecise (see §1) — the actual `import/no-restricted-paths` zone would not have blocked store imports from `core/`, since `store/` is not `app/app/*`. This does not change the verdict (no eslint error was produced either way, and the placement remains defensible on other grounds — route-adjacent, single-call-site, not a reusable primitive) but the reviewer should be aware the "boundary" framing in the docs overstates what's actually enforced.
- `_layout.test.tsx` does not exercise the pre-existing `!token → <Redirect />` branch (only the authenticated path is tested). This is not a gap introduced by this ticket — that guard logic and its test coverage (or lack thereof) predates `job-detail-sheet` (added in `app-nav-shell`, commit `7560711`) — but it's the first test file to render `_layout.tsx` at all, so it's a reasonable spot for a future ticket to backfill.
- Native swipe-down/backdrop-tap dismissal of the real `BottomSheetModal` is untested (only the programmatic `onDismiss` callback is), consistent with the plan's own risk note — acceptable given `@gorhom/bottom-sheet` internals would require heavy additional mocking for no meaningful signal gain.

## Verdict

- ✅ **PASS** → ready for human PR review.

**Reviewer summary (on pass):** Job Detail bottom sheet (60%/100% snap points, Apply/Favorite actions, 409-aware inline errors, `getById` fallback fetch for jobs not in the loaded list) is fully implemented and traces cleanly to R1–R9. Fresh tooling gate is green (tsc, lint, 17/17 suites · 98/98 tests), and the two new Jest module mocks (`@gorhom/bottom-sheet`, `expo-router`'s `Slot`/`Redirect`) were proven non-vacuous via four independent mutation tests that all failed exactly as expected. One documentation nit: the plan's eslint-boundary justification for `JobDetail.tsx`'s file placement is inaccurate on a technicality (see Findings) — worth a follow-up doc correction, not a blocker.
