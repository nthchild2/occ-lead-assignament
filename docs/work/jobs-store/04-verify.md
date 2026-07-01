# Verification Report · jobs-store

- **Feature id:** `jobs-store`
- **Inputs read:** `00-spec.md`, `02-plan.md`, `03-impl-report.md`, `01-research.md`
- **Verifier:** agent (VERIFY phase, independent/fresh context)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                                                              |
| ---- | -------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `app/core/services/jobs.service.ts`: `buildQueryString` skips `undefined`/`null`/`''`, `list()` calls `get('/jobs' + qs, JobListResponseSchema, false)` — unauthenticated, no `fetch`/`axios` outside this file. Matches R1's acceptance criterion exactly.                                                                                        |
| R2   | must     | ✅          | `app/store/jobs.store.ts` `JobsStore` interface has `jobs`, `filters`, `pagination` (real 5-field `@occ/shared` `Pagination`), `isLoading`, `error`, `activeJobId`, `activeJobIndex`. Plain `create<JobsStore>((set, get) => ({...}))` — no `persist` import, no persistence. `setActiveJob`/`clearActiveJob` present and tested.                  |
| R3   | must     | ✅          | `appendJobs: (newJobs, pagination) => set((s) => ({ jobs: [...s.jobs, ...newJobs], pagination }))` — verified by reading the source; `jobs.store.test.ts`'s first test calls `appendJobs` twice and asserts concatenation (`[...page1, ...page2]`) and that `pagination` is replaced with the latest value.                                        |
| R4   | must     | ✅          | `resetList: () => set({ jobs: [], pagination: initialPagination, isLoading: false, error: null })` — deliberately does not touch `filters`/active-job state (matches R4's scope: "clears accumulated jobs and pagination"). Test explicitly asserts `filters` survives untouched.                                                                  |
| R5   | must     | ✅          | `setFilters: (partial) => set({ filters: { ...get().filters, ...partial } })` — pure shallow merge, no other `set()` calls, no side effects. Test asserts only the given key changes and `jobs` is untouched.                                                                                                                                      |
| R6   | must     | ✅          | `app/core/hooks/useJobs.ts` exposes `fetchPage`, `fetchNextPage`, `refetch`. `fetchNextPage` guards on `!pagination.hasNext \|\| isLoading`; `refetch` calls `resetList()` then `fetchPage(1)`. All three behaviors covered in `useJobs.test.ts` (see mutation-test section below for the guard's genuineness).                                    |
| R7   | must     | ✅          | `app/core/hooks/useDebounce.ts`: generic `useDebounce<T>(value, delay)`, `useEffect`+`setTimeout`+cleanup, delay caller-supplied (not hardcoded). `useDebounce.test.ts` asserts value unchanged at `delay-1` and flips only at `delay` — confirmed genuine via mutation test below.                                                                |
| R8   | must     | ✅          | `useJobs.ts`'s `fetchPage` catch branch calls only `setError(messageFor(error))`, never touches `jobs`/`pagination`; `finally` always clears `isLoading`. `useJobs.test.ts`'s R8 test seeds distinguishable prior `jobs`/`pagination`, triggers a failing fetch, and asserts exact equality afterward — confirmed genuine via mutation test below. |
| R9   | must     | ✅          | Three new test files present and green: `app/store/jobs.store.test.ts` (4 tests), `app/core/hooks/useJobs.test.ts` (5 tests), `app/core/hooks/useDebounce.test.ts` (2 tests). This satisfies the spec-required "hook de búsqueda" unit test.                                                                                                       |

- [x] **No gaps** — every `must` requirement (R1–R9) has ≥1 real change, verified by reading the actual source files, not just the impl-report's prose.
- [x] **No orphans** — `git status --porcelain` shows exactly 7 new files (`jobs.service.ts`, `jobs.store.ts`, `useDebounce.ts`, `useJobs.ts`, and their three test files) plus `app/package.json`/`pnpm-lock.yaml` (the documented `react-test-renderer` deviation) — every changed file traces to a ledger R-id or the documented environment-fix deviation. No unexplained files.
- [x] Out-of-scope items from the ledger were **NOT** implemented:
  - **Screen UI** — `find app/app -iname "*job*"` returned nothing; no screen/UI files touched.
  - **Active-job swipe/prefetch-threshold logic** — `grep -n "swipe|prefetch|threshold" useJobs.ts jobs.store.ts` returned nothing. Only `setActiveJob`/`clearActiveJob` state-setters exist, no triggering logic.
  - **`activity-stores`** — no `activity`/`favorite`/`application` files found anywhere under `app/`.
  - **Backend changes** — `git status --porcelain backend/` is empty; `git diff --stat` confirms zero backend files touched.

## 2 · Citation spot-check

| Cited claim                                                                                | `path:line`                                       | Holds up?                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `get(path, schema, auth?)` is path-string-only, no query-object overload                   | `app/core/services/api.ts:110-116`                | ✅ — read; signature is exactly `get<T>(path: string, schema: T, auth?: boolean)`.        |
| `theme.store.ts` uses plain non-curried `create<T>((set) => ({...}))`, no `persist`        | `app/store/theme.store.ts:22-30`                  | ✅ — confirmed, `create<ThemeStore>((set) => ({...}))`, no persist import.                |
| `PaginationSchema` has 5 fields (`page, limit, total, hasNext, hasPrev`), all required     | `packages/shared/src/schemas/job.schema.ts:14-20` | ✅ — confirmed exact field list and no `.optional()`.                                     |
| `auth.store.ts` uses the curried `create<T>()(persist(...))` form (contrast case)          | `app/store/auth.store.ts:18-55`                   | ✅ — confirmed `create<AuthStore>()(persist((set, get) => ({...}), {...}))`.              |
| `auth.service.ts` is the thin-service pattern to mirror                                    | `app/core/services/auth.service.ts:12-23`         | ✅ — confirmed one function per endpoint, explicit `auth` boolean, shared schema.         |
| Backend router casts `req.query as unknown as JobFilters` — confirms querystring key names | `backend/src/domains/jobs/jobs.router.ts:15-21`   | ✅ — confirmed at line 21 exactly (`const filters = req.query as unknown as JobFilters`). |

All sampled citations are relevant and accurate — no drift found between claimed and actual content.

## 3 · Tooling gate

| Check       | Command                               | Result                                                                                                                                                                                           |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types (app) | `pnpm --filter './app' run typecheck` | ✅ `tsc --noEmit` — no output, clean exit.                                                                                                                                                       |
| Lint        | `pnpm lint`                           | ✅ 0 errors, 12 pre-existing warnings (all in unrelated `backend/` files — `security/detect-object-injection`, not touched by this feature).                                                     |
| Tests       | `pnpm --filter './app' run test`      | ✅ 6 suites / 26 tests passed (`jobs.store.test.ts`, `useJobs.test.ts`, `useDebounce.test.ts` plus pre-existing `theme.store.test.ts`, `auth.store.test.ts`, `api.test.ts` unchanged and green). |

No `any`/non-null-assertion (`!`) found in any of the 7 new files (service, store, 2 hooks, 3 test files) via targeted grep.

## Mutation testing (anti-vacuity checks, per verification instructions)

Given the prior ticket's verifier caught a vacuous test, each of the three flagged claims was independently mutated and reverted (all mutations confirmed cleanly reverted via `git diff` showing no residual changes and full suite re-passing 26/26 afterward):

1. **R8 (failure path doesn't clobber existing jobs).** Mutated `useJobs.ts`'s catch branch to call `appendJobs([], emptyPagination)` before `setError`. Ran `useJobs.test.ts -t "R8"` → **failed as expected**:

   ```
   ● useJobs › fetchPage failure sets error and leaves prior jobs untouched (R8)
     expect(received).toEqual(expected) // deep equality
     - Expected  - 2
     + Received  + 2
         "hasNext": true,  →  "hasNext": false,
         "total": 5,       →  "total": 0,
   ```

   Confirms the test genuinely asserts exact prior-state equality, not a vacuous "still an array" check. Reverted; `git diff app/core/hooks/useJobs.ts` empty.

2. **R7 (debounce timing, not just "eventually settles").** Mutated `useDebounce.ts` to use `Math.min(delay, 1)` as the effective `setTimeout` delay. Ran `useDebounce.test.ts` → **both tests failed as expected**:

   ```
   ● collapses rapid changes within the delay window... : Expected "a", Received "abcd"
   ● does not update before the delay has elapsed        : Expected "first", Received "second"
   ```

   Confirms the "unchanged before delay elapses" assertions are genuinely exercising real timer behavior, not trivially true. Reverted; `git diff app/core/hooks/useDebounce.ts` empty.

3. **`fetchNextPage` `hasNext` guard.** Mutated `useJobs.ts`'s `fetchNextPage` to drop the `!pagination.hasNext` condition (kept only the `isLoading` check). Ran `useJobs.test.ts -t "no-ops when hasNext is false"` → **failed as expected**:
   ```
   ● fetchNextPage no-ops when hasNext is false
     expect(jest.fn()).not.toHaveBeenCalled()
     Expected number of calls: 0
     Received number of calls: 1
     1: "http://api.test/jobs?sort=date_desc&page=2&limit=20", ...
   ```
   Confirms the test's `expect(fetchMock()).not.toHaveBeenCalled()` assertion is a real, load-bearing check on `fetch` never being invoked — not a side assertion that happens to pass regardless. Reverted; `git diff app/core/hooks/useJobs.ts` empty.

All three flagged claims are **genuine, non-vacuous** tests.

## `react-test-renderer@18.3.1` devDependency pin — independent check

- `app/package.json` diff is a single added line: `"react-test-renderer": "18.3.1"` under `devDependencies`. No other dependency, script, or config line touched.
- `pnpm-lock.yaml` diff (53 lines) is entirely attributable to this pin: `react-test-renderer@19.1.0` → `18.3.1` in the resolution paths of `@testing-library/jest-native` and `@testing-library/react-native`, plus `react-test-renderer@18.3.1`'s own transitive deps (`react-shallow-renderer@16.15.0`, `scheduler@0.23.2`) being added to the lockfile, plus a cosmetic `expo-router@6.0.24` peer-dependency content-hash change (`798e8f0...` → `28684b0...`, same version, hash shift caused only by its optional peer `@testing-library/react-native` now resolving through a different `react-test-renderer`). No unrelated dependency version bumps found.
- `pnpm --filter './app' why react-test-renderer` was run independently and shows **two coexisting versions** in the graph after the fix:
  - `react-test-renderer@18.3.1` — used directly by `@occ/app` (devDependency), `@testing-library/jest-native`, and `@testing-library/react-native`.
  - `react-test-renderer@19.1.0` — still present, pulled in directly by `jest-expo@54.0.17`'s own `package.json` dependency (confirmed in the lockfile's `jest-expo` snapshot block, unchanged by this feature — `jest-expo` has always depended on `19.1.0` and still does).
  - **Finding:** the impl-report's Deviations section states _"Confirmed via `pnpm why react-test-renderer` that this was the only version in the graph both before and after the pin (i.e., the pin resolved the mismatch rather than introducing a second copy)."_ This claim is **factually incorrect for "after."** Verified against `git show HEAD:pnpm-lock.yaml`, which shows a single-version graph (`19.1.0` only) before this change; after the pin, the graph has two versions (`18.3.1` and `19.1.0`) coexisting, because `jest-expo`'s own dependency on `19.1.0` was never touched — only `@testing-library/*`'s resolution was repinned to `18.3.1`.
  - This is a **documentation/self-report accuracy issue**, not a functional defect: the fix works correctly (tests pass, `renderHook`/`act` from `@testing-library/react-native` now correctly resolve `18.3.1` matching `react@18.3.1`, and `jest-expo`'s own internal use of `19.1.0` — for whatever jest-expo does with it internally, not exercised by this feature's tests — is isolated and doesn't leak into the test files under verification). Does not block PASS, but should be corrected in the impl-report's claim if it's revised, and is flagged here for reviewer awareness.

## Findings

- All 9 requirements (R1–R9) trace to real, correct changes verified by reading source, not just the impl-report's prose.
- Out-of-scope boundaries were respected: no screen UI, no swipe/prefetch trigger logic, no activity-stores, no backend changes.
- No `any`/`!` in any new file.
- All three flagged test claims (R8 failure-path exactness, R7 debounce timing, `fetchNextPage` `hasNext` guard) were independently mutated and confirmed genuine — none were vacuous.
- One documentation inaccuracy found (non-blocking): the impl-report's claim that `react-test-renderer` has "only one version in the graph both before and after the pin" is false for the "after" state — two versions now coexist (`18.3.1` for `@occ/app`/testing-library, `19.1.0` still pulled by `jest-expo` itself, unchanged by this feature). The pin still correctly fixes the reported `renderHook`/`act` failure and is scoped to exactly one devDependency line; this is a self-report precision issue, not a functional or scope problem.
- `useJobs.ts` intentionally does not subscribe to the store (uses `getState()` imperatively in all three functions) — as documented, this means the hook itself triggers no re-renders; this is consistent with R6's requirements and is explicitly flagged for the future screen ticket, not a defect here.

## Verdict

✅ **PASS** — ready for human PR review.

**Reviewer summary (on pass):** `jobs-store` delivers the service/store/hooks plumbing (R1–R9) exactly as planned, with no scope creep into screen UI, swipe/prefetch logic, activity-stores, or backend. All three tooling gates are green (tsc, eslint, 26/26 jest tests), and three targeted mutation tests confirm the R8/R7/`hasNext`-guard tests are genuine, not vacuous. One minor note for the reviewer: the impl-report overstates the `react-test-renderer` pin's effect (claims a single version in the graph after the fix; actually two coexist — `18.3.1` for app/testing-library, `19.1.0` still used internally by `jest-expo`) — functionally harmless, but worth a one-line correction if the report is touched again.
