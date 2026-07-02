# Verification Report · activities-screen

- **Feature id:** `activities-screen`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier subagent (Claude Sonnet 5, fresh/independent context)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                            |
| ---- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `applied.tsx:22-24` `useEffect` calls `useApplicationsStore.getState().fetch()` on mount; `ActivityList.tsx` renders `row.job` per row. Verified by direct read + `applied.test.tsx` "calls applications.store.fetch() once on mount".                                                                           |
| R2   | must     | ✅          | `favorites.tsx:22-24` identical pattern against `useFavoritesStore`. Verified by direct read + `favorites.test.tsx`.                                                                                                                                                                                             |
| R3   | must     | ✅          | `applied.tsx:34-36` `handleRemove(jobId)` → `useApplicationsStore.getState().remove(jobId)`, wired as `onRemove` on `ActivityList`, `removeLabel="Cancelar"`. `applied.test.tsx` asserts `toHaveBeenCalledWith('job-b')` (strict, not loose). Mutation-tested independently (see §Findings) — confirmed genuine. |
| R4   | must     | ✅          | `favorites.tsx:34-36` mirrors R3 against `useFavoritesStore`, `removeLabel="Quitar"`. Same strict assertion + independent mutation test — confirmed genuine.                                                                                                                                                     |
| R5   | must     | ✅          | `ActivityList.tsx:83-91` `isLoading && rows.length === 0` → `JobCardSkeleton × 5`. Covered in `ActivityList.test.tsx`.                                                                                                                                                                                           |
| R6   | must     | ✅          | `ActivityList.tsx:93-95` `error && rows.length === 0` → `ErrorState` with `onRetry`. Covered in `ActivityList.test.tsx` + both screen tests. Mutation-tested independently — confirmed genuine (see §Findings).                                                                                                  |
| R7   | must     | ✅          | `ActivityList.tsx:97-99` `!isLoading && !error && rows.length === 0` → `EmptyState`. Covered in `ActivityList.test.tsx` + both screen tests.                                                                                                                                                                     |
| R8   | should   | ✅          | `applied.tsx:30-32` uses `row.job.id` (embedded job); `favorites.tsx:30-32` uses `row.id` (identity adapter) — both confirmed correct by direct code read, not just the impl-report's claim. Screen tests assert `setActiveJob` called `toHaveBeenCalledWith('job-b', 1)` (strict).                              |

- [x] **No gaps** — every `must` requirement (R1–R7) has ≥1 traceable change, confirmed by reading `ActivityList.tsx`, `applied.tsx`, `favorites.tsx` directly (not just the impl-report table).
- [x] **No orphans** — every change traces to ≥1 requirement; `git diff --stat HEAD` shows only `applied.tsx` and `favorites.tsx` modified (96 insertions/24 deletions, both files) plus 4 new untracked files (`ActivityList.tsx` + 3 test files) — no changes outside the plan's six-item change list.
- [x] Out-of-scope items from the ledger were NOT implemented — verified via targeted `git diff --stat HEAD` on the exact files: `packages/shared` (empty diff), `app/store/applications.store.ts` / `app/store/favorites.store.ts` (empty diff), `app/core/components/JobCard.tsx` (empty diff), `app/store/jobs.store.ts` (empty diff), and additionally `JobDetail.tsx` / `(protected)/_layout.tsx` / `activities/_layout.tsx` / `activityStatus.ts` (all empty diff). Every one of the plan's "No changes to..." list and the spec's "Explicitly out of scope" list is confirmed untouched.

## 2 · Citation spot-check

| Cited claim                                                                                                                                        | `path:line`                                             | Holds up?                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `remove(jobId)` is already optimistic: removes from `items` immediately, rolls back + sets `error` on failure, then re-throws                      | `app/store/applications.store.ts:63-77`                 | ✅ — confirmed: `remove` filters `items` first, then on catch pushes `removed` back and re-throws. |
| `ApplicationSchema = { jobId, appliedAt, job: JobSchema }` confirms `Application.job` is the full embedded `Job`                                   | `packages/shared/src/schemas/application.schema.ts:4-8` | ✅ — schema matches exactly as cited.                                                              |
| `JobCardProps { job: Job; onPress: () => void }` — no cancel/remove/trailing slot today; `areEqual` memo comparator checks only `job.id`/`onPress` | `app/core/components/JobCard.tsx:9-12,78-83`            | ✅ — both confirmed verbatim.                                                                      |
| `setActiveJob: (id: string, index: number) => void` — requires an index, trivial setter, no validation                                             | `app/store/jobs.store.ts:26,75-77`                      | ✅ — confirmed, `set({ activeJobId: id, activeJobIndex: index })`.                                 |
| `handleJobPress` precedent: `useJobsStore.getState().setActiveJob(job.id, index)`                                                                  | `app/app/(protected)/(tabs)/index.tsx:254-256`          | ✅ — confirmed verbatim, same call shape reused by `applied.tsx`/`favorites.tsx`.                  |
| `Select.tsx` already uses plain `FlatList` for a similar small, non-paginated list                                                                 | `app/core/components/Select.tsx:88-104`                 | ✅ — confirmed, `<FlatList data={options} ... renderItem={...} />`.                                |

6/6 sampled citations hold up — both existence and relevance confirmed by direct inspection.

## 3 · Tooling gate

| Check       | Command                               | Result                                                                                                                                                                                                                           |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (app) | `pnpm --filter './app' run typecheck` | ✅ clean, no errors                                                                                                                                                                                                              |
| Lint        | `pnpm lint`                           | ✅ 0 errors, 12 pre-existing backend `security/detect-object-injection` warnings, unrelated to this feature (all in `backend/src/domains/jobs/`, `backend/src/lib/errors.ts`, `backend/src/middleware/validation.middleware.ts`) |
| Tests       | `pnpm --filter './app' run test`      | ✅ 132/132 passed, 20 suites, 3.2s — matches implementer's self-check exactly, run fresh and independently                                                                                                                       |

No `any` or non-null-assertion (`!`) usage found in any of the six changed/new files (`ActivityList.tsx`, `applied.tsx`, `favorites.tsx`, `ActivityList.test.tsx`, `applied.test.tsx`, `favorites.test.tsx`) — confirmed via grep.

## Findings

**Independent mutation tests performed (source-only, tests/mocks untouched, all reverted and byte-diffed to confirm clean restoration):**

1. **Sibling-vs-nested-Pressable independence.** Read `ActivityList.tsx`'s `ActivityRowItem`: `JobCard` (which internally wraps its content in `Card`'s own `Pressable` when `onPress` is given, per `Card.tsx:39-43`) and the remove `Button` (which has its own independent `Pressable`, per `Button.tsx:103-129`) are both direct children of a plain `View` — genuinely siblings, not nested. Mutated the remove `Button`'s `onPress` to also call `onPress(row, index)` (simulating a wiring bug). Result: `ActivityList.test.tsx`'s independence assertion `expect(onPress).not.toHaveBeenCalled()` failed as expected (1 test failed, 5 passed). Reverted; file diffed byte-identical to pre-mutation; re-ran green (6/6). **Confirmed genuine, non-vacuous coverage.**

2. **`Application[] → {id, job}` mapping correctness.** The mapping `{ id: application.jobId, job: application.job }` is trivially consistent with real data (`jobId === job.id` by schema construction), so a naive id-swap mutation wouldn't produce a meaningfully different bug. Instead, mutated `toRow` in `applied.tsx` to always return the _first_ application's `job` object regardless of which application was passed in (breaking the `job` reference for row 2+, a realistic class of adapter bug). Result: 3 of 6 tests in `applied.test.tsx` failed — the distinguishable-data mapping test, the `setActiveJob` id test, and the `Cancelar`-label lookup (since row 2 rendered the wrong title). Reverted; byte-identical restoration confirmed; re-ran green (6/6). **Confirmed genuine coverage; the trivial-mapping caveat from the invocation is noted but a meaningful mutation was still found and caught.**

3. **`remove` called with correct id.** Both `applied.test.tsx` and `favorites.test.tsx` use strict `toHaveBeenCalledWith('job-b')`, not loose `toHaveBeenCalled()`. Mutated `applied.tsx`'s `handleRemove` to always call `remove('wrong-hardcoded-id')` — caught (1 test failed with clear expected/received diff). Repeated identically for `favorites.tsx`'s `handleRemove` — caught. Both reverted; byte-identical restoration confirmed; re-ran green (12/12 combined).

4. **R8 wiring.** Confirmed by direct code read (not the impl-report's claim): `applied.tsx:31` calls `setActiveJob(row.job.id, index)` (embedded job id, correct per `Application.job` being the full `Job`); `favorites.tsx:31` calls `setActiveJob(row.id, index)` (identity adapter, `row.id === job.id`, correct, no erroneous `.job` unwrap). Both screen tests assert these with strict `toHaveBeenCalledWith`.

5. **Empty/error/loading state transitions.** Mutated `ActivityList.tsx`'s branching to disable the `error && rows.length===0` condition (`if (false && error && ...)`) and widen the empty condition to `!isLoading && rows.length===0` (dropping the `!error` guard) — simulating a broken mutual-exclusivity between error and empty states. Result: caught at all three levels — `ActivityList.test.tsx`'s own error-state test failed, plus both `applied.test.tsx`'s and `favorites.test.tsx`'s R6 smoke tests failed (3 failures total, 15 passed) — confirming the states are asserted as genuinely mutually exclusive (real text/element assertions, not "renders something"). Reverted; byte-identical restoration confirmed; full suite re-run green (132/132).

**Naming reconciliation (`onSecondaryAction`/`secondaryLabel` plan prose vs `onRemove`/`removeLabel` impl):** confirmed cosmetic-only. Both describe an identical contract: a callback taking the row/job id, a string label, wired to a `Button` with `variant="danger"` and a distinct `accessibilityLabel`. No functional or behavioral gap — verified by comparing the plan's change #1 prose (`02-plan.md:20`) against `ActivityList.tsx`'s actual prop interface and usage.

**Out-of-scope confirmation:** targeted `git diff --stat HEAD` against every file named in the spec's "Explicitly out of scope" section and the plan's "No changes to..." list (`packages/shared/*`, `applications.store.ts`, `favorites.store.ts`, `jobs.store.ts`, `JobCard.tsx`, `JobDetail.tsx`, `(protected)/_layout.tsx`, `activities/_layout.tsx`, `activityStatus.ts`) — all show empty diffs. Only `applied.tsx`/`favorites.tsx` (modified) and 4 new files under the `activities/` route directory were touched.

No residual risk identified. All five high-scrutiny items were independently re-derived (not trusted from the impl-report) and all mutation tests confirmed genuine, catching failures.

## Verdict

- ✅ **PASS** → ready for human PR review.

**Reviewer summary (on pass):** `applied.tsx`/`favorites.tsx` now render real applications/favorites lists via a new shared `ActivityList` component (loading/error/empty/list branching, `FlatList`-based), with cancel/remove wired to the existing optimistic store actions and tap-to-open wired to `setActiveJob`. All coverage, citations, and tooling checks (fresh `tsc`/`eslint`/`jest`, 132/132) pass; five independent mutation tests (sibling-Pressable independence, adapter mapping, remove-id correctness ×2, error/empty mutual exclusivity) all caught injected bugs, confirming the test suite is non-vacuous. No scope creep — verified via targeted diffs on every out-of-scope file named in the spec/plan.
