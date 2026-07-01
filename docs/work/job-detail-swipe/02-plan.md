# Plan · job-detail-swipe

- **Feature id:** `job-detail-swipe`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** agent (PLAN phase)
- **Date:** 2026-07-01

## Spec correction (carried from research, not an escalation)

R3's ledger source column says the disable condition is `activeJobIndex === -1`. Research
confirmed by grep that **no code path in this codebase ever sets `activeJobIndex` to `-1`**
today — `-1` is A3's reserved sentinel for the not-yet-built deep-link flow (`push-notifications`,
out of scope here). The only real signal available now is `activeJobIndex === null` (the initial/
cleared state) or a defensive mismatch check (the job at `jobs[activeJobIndex]` doesn't have
`id === activeJobId`, which covers today's `useActiveJob` fallback-fetch case where
`activeJobIndex` is left stale/null while a different job is shown). This plan implements R3 as:

```
swipeDisabled = activeJobIndex === null || jobs[activeJobIndex]?.id !== activeJobId
```

This is a strict superset of the spec's stated `-1` case (if `-1` is ever set by a future ticket,
`jobs[-1]` is `undefined`, so the mismatch branch already covers it safely). No requirement
change needed — R3's acceptance criterion ("swipe gestures do not attempt to navigate to a
nonexistent adjacent index") is satisfied either way.

## Approach

Add swipe as a thin behavioral layer composed around the existing `JobDetailContent` in
`JobDetail.tsx`, using the modern `Gesture.Pan()` + `GestureDetector` API (gesture-handler
2.28.0) driving `useSharedValue`/`useAnimatedStyle` (reanimated 4.1.7, no
`useAnimatedGestureHandler` — confirmed absent from the installed version). A new
`useJobSwipe`-style hook/component, extracted per the complexity ceiling, computes the target
index on gesture end, calls `jobs.store.setActiveJob(newJob.id, newIndex)` (R2), and — inside
`InteractionManager.runAfterInteractions` — triggers `fetchNextPage()` when within 3 of the end
and `pagination.hasNext` (R4/R5), relying on `fetchNextPage()`'s own internal `hasNext`/
`isLoading` guard rather than duplicating it (research Risk #2: pick one, this plan drops the
redundant outer guard to keep one source of truth). The FlashList's cross-tree ref problem (R7)
is solved by adding a single new field to `jobs.store.ts` — `flashListRef` plus a
`setFlashListRef` action — since Zustand is this codebase's only existing cross-tree
handle-sharing mechanism (no Context, no module singleton exists anywhere today); `index.tsx`
registers its ref on mount, `_layout.tsx`'s `onDismiss` reads it imperatively via `.getState()`
and calls `scrollToIndex`.

**Alternative rejected:** a `React.createContext` provider for the FlashList ref, or a bespoke
module-level `let flashListRef` singleton. Both are new patterns with zero precedent in this
codebase; the Zustand-store field mirrors `theme.store.ts`'s existing `.getState()`-from-outside-
React idiom exactly and keeps the "one mechanism for cross-tree state" convention intact. Also
rejected: keeping `fetchNextPage()`'s outer `hasNext`/`isLoading` guard duplicated inline (A2's
illustrative pseudocode does this) — redundant against the hook's own guard, adds a second place
that can drift out of sync; this plan calls `fetchNextPage()` as-is and lets it no-op.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | File(s) (`path:line`)                                                                                                                                      | R-ids                  | Type |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---- |
| 1   | Add `flashListRef: React.RefObject<FlashListRef<Job>> \| null` field + `setFlashListRef(ref)` action to the store interface and initial state, alongside a code comment noting this field is non-serializable and must never be added to a future `persist`/`partialize` config. No existing action/field touched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `app/store/jobs.store.ts:4-19,41-70`                                                                                                                       | R7                     | edit |
| 2   | In `index.tsx`, create `const flashListRef = useRef<FlashListRef<Job>>(null)`, pass `ref={flashListRef}` to the `<FlashList>` element, and register it into the store once on mount via a `useEffect(() => { useJobsStore.getState().setFlashListRef(flashListRef) }, [])`. Import `FlashListRef` as `import type`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `app/app/(protected)/(tabs)/index.tsx:158-169` (JSX), `:194-196` (refs), new `useEffect` near `:221-226`                                                   | R7                     | edit |
| 3   | Extract a `useJobSwipe` hook (or a small co-located non-exported helper set, whichever keeps `JobDetailContent` under complexity 10) in `JobDetail.tsx`: computes `swipeDisabled` (per spec correction above), exposes a `Gesture.Pan()` built from `useSharedValue`/`withSpring`, an `onEnd` callback that (a) determines the target index (`activeIndex ± 1`, clamped to `[0, jobs.length - 1]`), (b) via `runOnJS`, calls `jobs.store.setActiveJob(jobs[targetIndex].id, targetIndex)` (R2) only when the target index differs and is in-bounds, (c) computes `jobs.length - targetIndex <= 3 && pagination.hasNext` and if true schedules `InteractionManager.runAfterInteractions(() => fetchNextPage())` (R4, R5), and (d) when the swipe would go past the last loaded job and `pagination.hasNext` is false (or `jobs.store.error` is set from a failed prefetch), snaps back instead of advancing and flags an `endOfResults` boolean for the indicator (R6). `fetchNextPage` obtained from `useJobs()`, called as-is (no duplicated outer guard, per Approach).                                                                                                                                                                                                                                                                                                                                                                 | `app/app/(protected)/JobDetail.tsx` (new logic within this file; no new file — mirrors `ActionButtons`' in-file extraction precedent)                      | R1, R2, R3, R4, R5, R6 | edit |
| 4   | Wrap `JobDetailContent`'s returned `BottomSheetScrollView` in `GestureDetector` + `Animated.View` (translateX driven by the pan gesture's shared value), keeping all existing children (title/company/salary/tags/description/`ActionButtons`) unchanged and still scrollable vertically. Render a small themed "no more results" `Text`/`View` (using `useTheme()` tokens, following the inline-message pattern at `JobDetail.tsx:136-138`) when `endOfResults` is true. Pass `swipeDisabled` into the `Gesture.Pan()` config (e.g. `.enabled(!swipeDisabled)`) so R3's no-op is enforced at the gesture-recognizer level, not just in the `onEnd` callback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `app/app/(protected)/JobDetail.tsx:155-251` (`JobDetailContent`), `:261-283` (`JobDetail` — passes `activeJobIndex`/`jobs` down or reads via the new hook) | R1, R3, R6             | edit |
| 5   | Add `onDismiss` scroll-to-index logic: replace the current one-line `onDismiss={() => useJobsStore.getState().clearActiveJob()}` with a named handler that first reads `{ flashListRef, activeJobIndex } = useJobsStore.getState()`, and if both `flashListRef?.current` and `activeJobIndex !== null` are present, calls `flashListRef.current.scrollToIndex({ index: activeJobIndex, animated: false })` (fire-and-forget on the returned `Promise<void>` — no `await` needed in a dismiss callback), then calls `clearActiveJob()`. Order matters: read `activeJobIndex` before `clearActiveJob()` resets it to `null`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `app/app/(protected)/_layout.tsx:88-98`                                                                                                                    | R7                     | edit |
| 6   | Update `jobs.store.test.ts`: add a test asserting `setFlashListRef` stores the given ref object on `flashListRef` and leaves other fields untouched (plain reducer-style, mirroring existing tests in this file).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `app/store/jobs.store.test.ts` (edit — add test + extend `beforeEach` reset to include `flashListRef: null`)                                               | R7                     | test |
| 7   | Update `index.test.tsx`'s `@shopify/flash-list` mock to forward a `ref` via `forwardRef` + `useImperativeHandle` exposing `scrollToIndex: jest.fn()` (a module-level spy, mirroring `_layout.test.tsx`'s `mockPresent`/`mockDismiss` pattern), and add a test asserting `useJobsStore.getState().setFlashListRef` is called once on mount with an object exposing `.current`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `app/app/(protected)/(tabs)/index.test.tsx:38-73` (mock), new `it(...)` block                                                                              | R7                     | test |
| 8   | Add a scoped `jest.mock('react-native-gesture-handler', ...)` to `JobDetail.test.tsx` returning a minimal `Gesture`/`GestureDetector` stand-in (`GestureDetector` renders `children` directly; `Gesture.Pan()` returns a chainable stub object exposing `.onUpdate/.onEnd/.enabled/...` that just returns itself, with the test invoking the `onEnd` callback directly to assert outcomes — not simulating real touch physics, which RNTL/gesture-handler cannot do meaningfully). Reuse the existing `@gorhom/bottom-sheet` mock unchanged. Add new tests: (a) calling the captured `onEnd` callback with a left-swipe-sized translation advances to `activeIndex + 1` and calls `setActiveJob` with the next job's id/index (R2); (b) same for right-swipe to `activeIndex - 1`; (c) when `activeJobIndex === null`, the gesture is configured `enabled(false)` / `onEnd` no-ops without calling `setActiveJob` (R3); (d) when `jobs[activeJobIndex].id !== activeJobId` (mismatch case), same no-op (R3); (e) when within 3 of the end and `pagination.hasNext` is true, `fetchNextPage` (from a mocked `useJobs`) is called after `InteractionManager.runAfterInteractions` fires (R4, R5) — assert it is _not_ called synchronously during the gesture callback itself; (f) when at the last loaded job and `pagination.hasNext` is false, swiping further does not call `setActiveJob` and the "no more results" text renders (R6). | `app/app/(protected)/JobDetail.test.tsx` (edit — new mocks + `describe('swipe')` block)                                                                    | R1, R2, R3, R4, R5, R6 | test |
| 9   | Add a test to `_layout.test.tsx`: `onDismiss` calls `flashListRef.current.scrollToIndex({ index: activeJobIndex, animated: false })` when a ref and non-null `activeJobIndex` are present in `jobs.store`'s mocked `getState()`, and a second test confirming it is skipped (no throw) when `flashListRef` is `null`. Extend the existing `setActiveJobId`/mocked `getState()` helper to also return a `flashListRef` with a `current.scrollToIndex` jest spy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `app/app/(protected)/_layout.test.tsx:144-149` (helper), new `it(...)` blocks                                                                              | R7                     | test |

Type: `create` | `edit` | `delete` | `test` | `config`.

No new files are introduced outside test additions to already-existing test files — the gesture
logic is added in-file to `JobDetail.tsx`, mirroring the `ActionButtons`/`useActiveJob`
in-file-extraction precedent already established there, rather than a new
`app/app/(protected)/useJobSwipe.ts` file. This keeps the change set minimal and avoids a new
cross-file import surface for logic that is entirely sheet-lifecycle-coupled.

## Requirement coverage check

| R-id | Priority                                            | Covered by change(s) |
| ---- | --------------------------------------------------- | -------------------- |
| R1   | must                                                | 3, 4, 8              |
| R2   | must                                                | 3, 8                 |
| R3   | must (re-scoped per research — see Spec correction) | 3, 4, 8              |
| R4   | must                                                | 3, 8                 |
| R5   | must                                                | 3, 8                 |
| R6   | must                                                | 3, 4, 8              |
| R7   | must                                                | 1, 2, 5, 6, 7, 9     |

- [x] Every `must` requirement is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans) — changes 1-2, 5-7, 9 cite R7;
      changes 3-4, 8 cite R1-R6 as applicable.

## Tests to add or update

- `app/store/jobs.store.test.ts` — asserts `setFlashListRef` stores the ref and leaves other
  fields untouched (R7).
- `app/app/(protected)/(tabs)/index.test.tsx` — asserts the FlashList mock's `ref` is registered
  into `jobs.store` via `setFlashListRef` on mount (R7).
- `app/app/(protected)/JobDetail.test.tsx` — asserts swipe-left/right update `activeJobId`/
  `activeJobIndex` via `setActiveJob` (R1, R2); asserts swipe no-ops when `activeJobIndex === null`
  or mismatched with `activeJobId` (R3); asserts `fetchNextPage` fires only after
  `InteractionManager.runAfterInteractions` when within-3-of-end and `hasNext` (R4, R5); asserts
  swiping past the last loaded job with `hasNext: false` does not advance and renders the
  end-of-results indicator (R6).
- `app/app/(protected)/_layout.test.tsx` — asserts `onDismiss` calls `scrollToIndex` with the
  current `activeJobIndex` when a `flashListRef` is present, and skips gracefully when absent (R7).

**Testing boundary (explicit, per research's Handoff):** these tests exercise gesture
_outcomes_ by directly invoking the `onEnd`/gesture-callback logic captured through the scoped
`react-native-gesture-handler` mock — they do not, and cannot meaningfully, simulate real
finger-swipe physics, velocity thresholds, or native `Gesture.Pan()` recognizer behavior under
RNTL/`jest-expo` (no test in this repo does that for any gesture/native-list interaction; same
boundary as `index.test.tsx`'s `onEndReached` precedent). Real-device/manual verification of the
swipe _feel_ (spring animation, threshold distance) is out of reach of this test suite and is not
claimed as covered.

## Risks & rollback

- **New non-serializable field on `jobs.store`.** `flashListRef` breaks the store's
  otherwise-plain-data convention. Mitigated by an explicit code comment (change #1) warning
  against ever adding it to a `persist`/`partialize` config; store has no `persist` middleware
  today, so no runtime risk yet. Rollback: revert change #1 and #2 together (the field and its
  only writer) — no other change depends on the field except #5's read, which would need to
  revert to the current one-line `onDismiss` in lockstep.
- **Gesture composition breaking existing vertical scroll / Apply-Favorite interaction.**
  `GestureDetector` wrapping `BottomSheetScrollView` risks gesture conflicts between the pan
  (horizontal) and the scroll view (vertical) if not configured to only claim horizontal
  movement. Mitigated by keeping the gesture as a thin wrapper (`Animated.View` around, not
  replacing, the scroll view) and, if needed during implementation, constraining the pan gesture
  with `.activeOffsetX`/`.failOffsetY` so vertical drags pass through to the scroll view
  untouched (implementer's call within change #4; does not change the plan's shape). Rollback:
  revert change #4 only — changes #1-3, #5-9 are independent of the JSX wrapper and would still
  compile/pass (though R1/R6's UI wouldn't render) if #4 is reverted alone; safer to revert #3+#4
  together since #3's `onEnd` logic is otherwise unused.
- **`complexity: ['error', 10]` on the new gesture/prefetch/end-of-results logic.** Mitigated by
  extraction (change #3) into a dedicated hook/helper set rather than inlining into
  `JobDetailContent`, mirroring the `ActionButtons` precedent. If the extracted hook itself risks
  exceeding 10, the implementer should split it further (e.g. separate `computeSwipeTarget`,
  `maybePrefetch` helpers) — still within change #3's scope, no plan change needed.
  Rollback: no cross-change dependency: fixing complexity is a same-change edit, not a revert.
- **`scrollToIndex`'s returned `Promise<void>` rejecting** (e.g. index out of the currently
  rendered viewport range) is uncaught in change #5's fire-and-forget call. Mitigated by not
  `await`-ing it (matches other fire-and-forget imperative calls like `sheetRef.current?.present()`
  in the same file) and by only calling it when `activeJobIndex` is known non-null/in-range;
  if verification surfaces an unhandled-rejection warning, the fix is a `.catch(() => {})` added
  to change #5 in place, not a rollback.
- **Order dependency in change #5** (`activeJobIndex` must be read before `clearActiveJob()`
  nulls it) is called out explicitly in the change description to prevent an implementation bug;
  if missed, the fix is local to `_layout.tsx`'s `onDismiss` handler, no rollback of other changes
  needed.

## Handoff to IMPLEMENT

1. `app/store/jobs.store.ts` — add `flashListRef` field + `setFlashListRef` action (change #1).
2. `app/app/(protected)/(tabs)/index.tsx` — add `useRef<FlashListRef<Job>>`, wire `ref` prop,
   register into store on mount (change #2).
3. `app/app/(protected)/JobDetail.tsx` — build the swipe gesture/prefetch/end-of-results logic
   (`Gesture.Pan()` + `useSharedValue`, R3 disable condition, prefetch threshold via
   `InteractionManager.runAfterInteractions`, R6 graceful stop) (change #3).
4. `app/app/(protected)/JobDetail.tsx` — compose `GestureDetector`/`Animated.View` into
   `JobDetailContent`'s JSX, add the end-of-results indicator (change #4).
5. `app/app/(protected)/_layout.tsx` — update `onDismiss` to read `flashListRef`/`activeJobIndex`
   and call `scrollToIndex` before `clearActiveJob()` (change #5).
6. `app/store/jobs.store.test.ts` — test `setFlashListRef` (change #6).
7. `app/app/(protected)/(tabs)/index.test.tsx` — extend FlashList mock with ref forwarding, test
   registration (change #7).
8. `app/app/(protected)/JobDetail.test.tsx` — scoped `react-native-gesture-handler` mock, swipe
   outcome tests for R1-R6 (change #8).
9. `app/app/(protected)/_layout.test.tsx` — `onDismiss` scroll-to-index tests (change #9).
10. Run `tsc --noEmit`, `eslint`, and the full test suite; confirm complexity/`no-any`/`no-!`
    lint rules pass on all new code before handing to VERIFY.

## Sign-off

- [x] Plan reviewed — full-auto mode 2026-07-01; proceeding to IMPLEMENT.
