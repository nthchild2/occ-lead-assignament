# Verification Report · job-search-screen

- **Feature id:** `job-search-screen`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier (agent, independent fresh context)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | Search debounce wired in `index.tsx:206-214` (`useDebounce(searchText, 300)` → guarded `useEffect` → `setFilters({ q })` + `refetch()`). Tested at `index.test.tsx:240-270` (3 keystrokes, no fetch at 299ms, exactly 1 `setFilters`/`refetch` at 300ms).                                                                                                                                       |
| R2   | must     | ✅          | `handleCityChange` (`index.tsx:236-240`) calls `setFilters({ city })` + `refetch()` immediately using `Select`. Tested at `index.test.tsx:334-358`, including the `'__all__'` → `undefined` sentinel mapping.                                                                                                                                                                                   |
| R3   | must     | ✅          | Two numeric `Input`s (`keyboardType="numeric"`) feed a shared debounced `useEffect` (`index.tsx:216-227`), `parseSalary` maps `''` → `undefined`. Tested at `index.test.tsx:272-332` (debounced fire, and clearing → `undefined`).                                                                                                                                                              |
| R4   | must     | ✅          | `handleSortChange` (`index.tsx:242-246`) calls `setFilters({ sort })` + `refetch()` immediately, 5 fixed `SORT_OPTIONS` (`index.tsx:39-45`), default `'date_desc'` (`index.tsx:196`). Tested at `index.test.tsx:360-371`.                                                                                                                                                                       |
| R5   | must     | ✅          | `FlashList` with `data`, `renderItem`, `keyExtractor`, `getItemType`, `drawDistance`, `onEndReached={fetchNextPage}` (`index.tsx:166-178`). Tested at `index.test.tsx:194-238`; `onEndReached` wiring proven via direct prop invocation (see §"Deviation 2" below — not vacuous).                                                                                                               |
| R6   | must     | ✅          | `isLoading && jobs.length === 0` → `SKELETON_COUNT` (5) `JobCardSkeleton`s (`index.tsx:142-150`). Tested positively via `UNSAFE_getAllByType` at `index.test.tsx:148-162`, plus negative assertions that error/empty text is absent.                                                                                                                                                            |
| R7   | must     | ✅          | `error && jobs.length === 0` → `ErrorState` with `onRetry={refetch}` (`index.tsx:152-154`). Tested at `index.test.tsx:164-181`, retry press asserted to call `refetch`.                                                                                                                                                                                                                         |
| R8   | must     | ✅          | `!isLoading && jobs.length === 0` (post-error branch) → `EmptyState` (`index.tsx:156-163`). Tested at `index.test.tsx:183-192`.                                                                                                                                                                                                                                                                 |
| R9   | must     | ✅          | `JobCard.tsx` (new) — memoized, `useTheme()`-only styling, salary line conditional on `job.salary !== null`, up to 3 `Badge`s, `accessibilityLabel`. `onPress` wired via screen's `handleJobPress` → `setActiveJob(job.id, index)` (`index.tsx:248-250`). Tested in both `JobCard.test.tsx` (render/salary/tags/press) and `index.test.tsx:207-219` (correct id+index passed through the list). |
| R10  | must     | ✅          | Every filter/sort handler calls `refetch()` (never `resetList()`/`fetchPage` directly), delegating pagination reset to `useJobs.refetch()` (`useJobs.ts:48-51`). Verified indirectly across R1-R4's tests, each asserting `refetch` (not raw `fetchPage`) is the call made.                                                                                                                     |

- [x] **No gaps** — all 10 `must` requirements have ≥1 real change, confirmed by reading `JobCard.tsx`, `index.tsx`, and both test files directly (not just trusting the impl-report's table).
- [x] **No orphans** — every change in `JobCard.tsx`/`index.tsx`/`index.ts` barrel traces to R9 or the R1-R10 screen bundle; no unexplained edits.
- [x] **Out-of-scope items NOT implemented** — confirmed via `git diff --stat` / `git status`: `app/store/jobs.store.ts`, `app/core/hooks/useJobs.ts`, `app/core/hooks/useDebounce.ts`, `app/core/services/jobs.service.ts`, `packages/shared/**`, and `backend/**` all show zero diff. No job-detail-sheet artifacts exist anywhere in `app/app` (grep/find both empty).

## 2 · Citation spot-check

| Cited claim                                                                                   | `path:line`                                                 | Holds up?                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "`refetch()` already calls `resetList()` then `fetchPage(1)` internally"                      | `app/core/hooks/useJobs.ts:48-51`                           | ✅ — exact match                                                                                                                                                                             |
| "`fetchNextPage()` already no-ops if `!pagination.hasNext \|\| isLoading`"                    | `app/core/hooks/useJobs.ts:44`                              | ✅ — exact match                                                                                                                                                                             |
| "`setActiveJob(id, index)` / `clearActiveJob()`" exact signature                              | `app/store/jobs.store.ts:64-69`                             | ✅ — exact match                                                                                                                                                                             |
| "`Select`... doc comment... names it for 'the city filter and the five-option sort selector'" | `app/core/components/Select.tsx:19`                         | ✅ — exact match                                                                                                                                                                             |
| "`Select`'s `value: T` prop is non-optional"                                                  | `app/core/components/Select.tsx:13`                         | ✅ — confirmed, `value: T` (no `?`)                                                                                                                                                          |
| "`estimatedItemSize` is absent from this interface entirely"                                  | installed `@shopify/flash-list@2.3.2` `FlashListProps.d.ts` | ✅ — `grep -n "estimatedItemSize"` returns no match against the actual installed package; `drawDistance:105`, `keyExtractor:141`, `onEndReached:150`, `getItemType:189` all present as cited |
| "`JobCardSkeleton()` — zero props, already built"                                             | `app/core/components/Skeleton.tsx:46`                       | ✅ — `export function JobCardSkeleton()` at line 46                                                                                                                                          |
| "`Card`... already `accessibilityRole=\"button\"` when pressable"                             | `app/core/components/Card.tsx:40`                           | ✅ — `<Pressable accessibilityRole="button" onPress={onPress}>` at line 40                                                                                                                   |

All sampled citations hold — relevant, not just path-real.

## 3 · Tooling gate

| Check       | Command                               | Result                                                                                                                                                               |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (app) | `pnpm --filter './app' run typecheck` | ✅ Pass (clean, no output)                                                                                                                                           |
| Lint        | `pnpm lint`                           | ✅ Pass — 0 errors; 12 pre-existing `security/detect-object-injection` warnings in `backend/src/domains/jobs/**` and `backend/src/lib/**`, unrelated to this feature |
| Tests       | `pnpm --filter './app' run test`      | ✅ Pass — **14 suites / 82 tests**, all green, independently re-run fresh (matches implementer's self-reported 82/82 exactly)                                        |

No `any` or non-null-assertion (`!`) usage found in any new/changed file (`JobCard.tsx`, `JobCard.test.tsx`, `index.tsx`, `index.test.tsx`) — grep confirms zero real matches (one false-positive hit on the English word "any" inside a comment).

`estimatedItemSize` confirmed genuinely absent from the `FlashList` JSX in `index.tsx` (read the actual props at lines 166-177: `data`, `renderItem`, `keyExtractor`, `getItemType`, `drawDistance`, `onEndReached`, `onEndReachedThreshold`, `contentContainerStyle` — no `estimatedItemSize`).

## Deviation 1 — `JobCard` prop signature

Plan specified `JobCard({ job, index, onPress: (job, index) => void })`; impl-report says it built `{ job, onPress: () => void }` instead, with the screen closing over `index` in `renderItem`.

Read `JobCard.tsx:9-12` (interface is exactly `{ job: Job; onPress: () => void }`) and `index.tsx:166-178`'s `renderItem`:

```tsx
renderItem={({ item, index }) => (
  <JobCard job={item} onPress={() => onJobPress(item, index)} />
)}
```

`FlashList` invokes `renderItem({ item, index })` fresh per row on every render pass — `index` is not a captured/stale outer variable, it's the parameter FlashList passes for that specific row on that specific call. The inline arrow `() => onJobPress(item, index)` closes over that row's own `item`/`index`, which is fresh per invocation, not a shared/mutable closure across rows. `onJobPress` = `handleJobPress(job, index)` → `useJobsStore.getState().setActiveJob(job.id, index)` (`index.tsx:248-250`).

Confirmed via test `index.test.tsx:207-219`: two jobs (`'a'` at index 0, `'b'` at index 1) rendered, tapping "Job B" asserts `setActiveJob` was called with `('b', 1)` — the correct per-row index, not `0` or a stale value. No mismatch between `JobCard`'s call signature and the screen's wiring. **Deviation is benign and correctly implemented.**

## Deviation 2 — local `jest.mock('@shopify/flash-list', ...)` in `index.test.tsx`

This was the highest-priority item to verify independently. Read the mock factory at `index.test.tsx:38-73`:

- The mock's `FlashList` component genuinely calls the **real `renderItem` prop passed by `index.tsx`**, once per item in the **real `data` array**, and uses the real `keyExtractor` if provided (lines 64-70) — it does not hardcode or bypass these props.
- `onEndReached` is forwarded as a readable prop on the rendered `View` (`testID="mock-flash-list"`), not swallowed.

Verified this is **not vacuous** via four independent mutations (all applied to `index.tsx`, none to the mock or test file, all reverted and confirmed byte-identical afterward via `diff`):

1. **Mutation: `onEndReached={onEndReached}` → `onEndReached={() => {}}`.** Re-ran `wires FlashList onEndReached to fetchNextPage (R5)` → **failed** (`Expected: 1, Received: 0`), because the test invokes `list.props.onEndReached()` directly and asserts `fetchNextPage` was called — not a `typeof === 'function'` check. Reverted; confirmed identical to original.
2. **Mutation: `data={jobs}` → `data={[]}`, and stripped `keyExtractor`/`getItemType`/`drawDistance`.** Re-ran `renders the job list when jobs are present (R5, R9)` → **failed** (`getByText('Job A')` threw, rendered tree showed an empty `mock-flash-list` View), proving the mock genuinely respects the real `data`/`renderItem` props rather than rendering something hardcoded. Reverted; confirmed identical to original.
3. **Mutation: removed the search-effect's first-render skip guard** (`isFirstSearchRender` check) in `index.tsx`. Re-ran `calls refetch once on mount (initial fetch)` → **failed** (`Expected: 1, Received: 2`) — confirms the guard is load-bearing and the test catches its removal. This independently re-verifies the implementer's own claimed mutation test. Reverted; confirmed identical to original.
4. **Mutation: city sentinel `'__all__'` NOT mapped to `undefined`** (`setFilters({ city: value })` instead of the ternary). Re-ran `selecting "all cities" maps to city: undefined (R2)` → **failed** (`Expected: {city: undefined}, Received: {city: "__all__"}`) — confirms this test genuinely exercises the sentinel mapping, not merely that `setFilters` was called. Independently re-verifies the implementer's claimed mutation test. Reverted; confirmed identical to original.

All four mutations produced the expected failure, and `git diff`/`diff` confirmed a clean revert after each. `pnpm --filter './app' run typecheck` and `pnpm --filter './app' run test` were re-run after all mutation testing concluded and are both clean (14/14 suites, 82/82 tests) — the working tree was left in its original (pre-verify) state.

## Findings

- **Undocumented `app/package.json` jest config change** (`"resolver": "react-native-worklets/jest/resolver"` added to the `jest` block) is present in the working tree but is **not listed** in the impl-report's "Changes made" table. This is a genuine, necessary fix, not scope creep: stashing this one line and re-running `index.test.tsx` reproduces a hard crash (`WorkletsError: Native part of Worklets doesn't seem to be initialized`, triggered transitively via `core/components/index.ts` → `Button.tsx` → `react-native-reanimated`). `01-research.md:35` already documents this resolver as an assumed-existing precondition ("Jest config already has `resolver: react-native-worklets/jest/resolver`"), suggesting the researcher believed it pre-existed when it in fact did not (it is not present in `HEAD`'s `app/package.json`). This is a minor process gap — the impl-report should have disclosed this config line the same way the `jobs-store` ticket disclosed its `react-test-renderer` devDependency pin as an environment-fix deviation — but it does not affect correctness: the change is minimal (one config line), necessary (tests fail to run without it), scoped to jest config only, and does not touch application/store/hook logic. Recommend the implementer amend the impl-report's Deviations section to disclose this for the record, but it is not blocking.
- The static `CITY_OPTIONS` list (`index.tsx:25-37`) is an invented-but-plausible 10-city + "all" list, exactly as the plan pre-approved (`02-plan.md`'s "Note on change #3's city option list") and the impl-report claims it mirrors `backend/src/domains/jobs/jobs.seed.ts`. Not independently re-verified against the seed file's exact city strings (out of scope for this pass — low risk, plan explicitly permits an invented list), but flagged for a human reviewer to spot-check freshness if desired.
- No `estimatedItemSize`, no `any`, no non-null assertions in any new/changed file — all confirmed by direct inspection, not just tsc's silence.

## Verdict

- ✅ **PASS** → ready for human PR review.

**Reviewer summary (on pass):** The job-search screen (`app/app/(protected)/(tabs)/index.tsx`) and new `JobCard` component fully cover R1-R10 with real, non-vacuous test coverage — the `@shopify/flash-list` module mock was specifically stress-tested with four independent mutations (broken `onEndReached`, emptied `data`/stripped list props, removed debounce first-render guard, removed city-sentinel mapping) and every one produced the expected test failure, then was cleanly reverted. `tsc`, `eslint`, and `jest` are all green (14/14 suites, 82/82 tests, fresh run). One minor process gap: an `app/package.json` jest `resolver` config line (necessary — tests crash without it) is present but undisclosed in the impl-report's Deviations section; worth a one-line amendment but not blocking.
