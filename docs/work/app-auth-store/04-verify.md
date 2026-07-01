# Verification Report · app-auth-store

- **Feature id:** `app-auth-store`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier subagent (independent, fresh context) — RE-VERIFY after a prior FAIL
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 0 · Context — what the prior FAIL found and what changed

The prior VERIFY pass found the R4 test ("`onUnauthorized` clears the session") triggered its 401 via `hydrate()`, which has its own independent `catch { clearSession() }` (R5's logic) — so the test passed even when `onUnauthorized` itself was mutated to a no-op, proving it never actually exercised the R4 wiring. Confirmed by that report's own mutation test: `onUnauthorized: () => {}` left all 7 tests green.

A second, deeper defect surfaced while fixing the first: the test file's `beforeEach` was redundantly re-wiring `configureApi({ onUnauthorized: () => useAuthStore.getState().clearSession() })` before every test. This masked bugs in `auth.store.ts`'s own module-load wiring entirely — even with the real wiring broken, the redundant re-wire in `beforeEach` would silently reinstall a correct closure regardless.

Both defects are fixed in the current `app/store/auth.store.test.ts`:

- The R4 test now triggers the 401 via `login('a@b.co', 'wrong')`, not `hydrate()`.
- `beforeEach` (lines 31-34) only resets `global.fetch` and `useAuthStore` state — it no longer calls `configureApi(...)`. The file's header comment (lines 7-12) documents why: the module-load wiring fires exactly once, as a side effect of the top-of-file `import { useAuthStore } from './auth.store'`, and that is the only wiring the suite now exercises.

This re-verify independently re-derives that these fixes are genuine (see §4) using a different method than the implementer's own report — direct code reading plus fresh, self-performed mutation tests — rather than trusting the narrative.

## 1 · Coverage matrix

| R-id | Priority | Has change? | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1   | must     | ✅          | `app/core/services/auth.service.ts` — `login`, `logout`, `me` each call `post`/`get` from `./api` with `LoginResponseSchema`/a local `LogoutResponseSchema`/`MeResponseSchema`. Grepped `auth.service.ts` and `auth.store.ts` for `fetch`/`axios` — zero hits in either.                                                                                                       |
| R2   | must     | ✅          | `auth.store.ts:23-26` — `login` calls `authService.login`, sets `{token, user}` on success; no `try`/`catch`, so a rejected `ApiError` propagates untouched. `logout` (`:27-36`) calls the service in a `try`, swallows failure, `finally` always calls `clearSession()`.                                                                                                      |
| R3   | must     | ✅          | `auth.store.ts:18-55` — curried `create<AuthStore>()(persist(...))` with `storage: createJSONStorage(() => AsyncStorage)`, `name: 'auth'`, `partialize: (state) => ({ token: state.token, user: state.user })` (line 52). Confirmed no other store touched — `app/store/` contains only `auth.store.ts`/`theme.store.ts` and their test files; `theme.store.ts` is unmodified. |
| R4   | must     | ✅          | `auth.store.ts:57-63` — module-load `configureApi({ getToken, onUnauthorized: () => useAuthStore.getState().clearSession() })`. Independently re-confirmed with a fresh, self-run mutation (§4) that this is the wiring the R4 test actually exercises — not a side effect of `hydrate()`'s own catch.                                                                         |
| R5   | must     | ✅          | `auth.store.ts:40-47` — `hydrate()` calls `authService.me()`; on success `set({ user: result.data })` (token untouched); on any rejection calls `clearSession()`.                                                                                                                                                                                                              |
| R6   | must     | ✅          | `app/store/auth.store.test.ts` — 7 tests: login success, login failure (`ApiError` + state untouched), logout success/failure (both clear), `onUnauthorized`-via-`login` (R4, re-verified genuine below), `hydrate` failure/success. All pass standalone and in the full suite; the R4 test's genuineness gap from the prior FAIL is confirmed closed.                         |

- [x] **No gaps** — every `must` requirement (R1–R6) has ≥1 real change, verified by reading the actual files, not just the report's table.
- [x] **No orphans** — every changed file (`auth.service.ts`, `auth.store.ts`, `auth.store.test.ts`, `app/package.json` jest config) traces to a requirement. The `app/package.json` `moduleNameMapper` addition is infra-only — one new entry mapping the async-storage package to its own vendored jest mock (confirmed no new dependency added anywhere in `dependencies`/`devDependencies`) — required to make R6's tests runnable at all under `jest-expo`, not scope creep.
- [x] Out-of-scope items from the ledger were NOT implemented — confirmed via direct search: no file under `app/app/**` references `auth.store`/`auth.service` (no login screen, no route guards, no nav-on-401/logout wiring); `app/store/` contains no `jobs.store.ts`/`activity-store*` files; no changes to `packages/shared/**` or `backend/**` attributable to this feature (git status shows only pre-existing, unrelated in-flight work in those trees).

## 2 · Citation spot-check

| Cited claim                                                                                                                                                      | `path:line`                                       | Holds up?                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ApiConfig` interface (`getToken?`/`onUnauthorized?`) — exactly what the store must inject                                                                       | `app/core/services/api.ts:10-13`                  | ✅ exact match                                                                                                                                                                                                                                                                       |
| On any 401, `config.onUnauthorized?.()` fires before the error is thrown                                                                                         | `app/core/services/api.ts:94-97`                  | ✅ confirmed — `if (response.status === 401) { config.onUnauthorized?.(); throw mapError(...) }`. This is the exact mechanism the R4 mutation test in §4 relies on.                                                                                                                  |
| `theme.store.ts:32-35` — module-level `Appearance.addChangeListener` reads `getState()` at call time; `auth.store.ts`'s `configureApi` wiring mirrors this idiom | `app/store/theme.store.ts:32-35`                  | ✅ confirmed — `Appearance.addChangeListener(() => { const { preference, setPreference } = useThemeStore.getState(); ... })`; `auth.store.ts:60-63` follows the identical pattern (state read inside each closure at call time, never captured).                                     |
| `api.test.ts:15-38` — `mockResponseOnce` helper + `beforeEach` fetch/`configureApi` reset convention                                                             | `app/core/services/api.test.ts:15-38`             | ✅ confirmed present verbatim (helper at 17-25, `beforeEach` reset at 35-38). `auth.store.test.ts` reuses the same `mockResponseOnce` shape but deliberately drops the `configureApi({})` re-wire — a documented, reasoned deviation (the whole point of the fix), not an oversight. |
| `LoginResponseSchema`/`MeResponseSchema`/`User` shapes                                                                                                           | `packages/shared/src/schemas/auth.schema.ts:8-22` | ✅ confirmed — `LoginResponseSchema` is `{ data: { token, user: UserSchema } }`, `MeResponseSchema` is `{ data: UserSchema }`; matches both `auth.service.ts`'s usage and the report's traceability table exactly.                                                                   |

No citation sampled was stale, fabricated, or irrelevant.

## 3 · Tooling gate

| Check       | Command                               | Result                                                                                                                                                |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types (app) | `pnpm --filter './app' run typecheck` | ✅ clean, no output                                                                                                                                   |
| Lint        | `pnpm lint`                           | ✅ 0 errors, 12 pre-existing warnings confined to unrelated `backend/**` files (`security/detect-object-injection`), not attributable to this feature |
| Tests (app) | `pnpm --filter './app' run test`      | ✅ 3 suites, 15/15 tests pass (`store/auth.store.test.ts`: 7, `store/theme.store.test.ts`: 2, `core/services/api.test.ts`: 6)                         |

## 4 · Independent re-check of the R4 fix (the reason this is a re-verify)

Performed with a different method than the implementer's own report — direct code reading plus fresh, self-run mutation tests, not trust in the narrative.

**a) `beforeEach` no longer re-wires `configureApi`.** Read `app/store/auth.store.test.ts:31-34`:

```
beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  useAuthStore.setState({ token: null, user: null })
})
```

Confirmed — no `configureApi(...)` call anywhere in the test file. The file's header comment explicitly documents this was deliberate and why.

**b) R4 test triggers the 401 via `login()`, not `hydrate()`, and `login()`'s failure path cannot independently clear the session.** Read `auth.store.test.ts:78-94` — the test calls `useAuthStore.getState().login('a@b.co', 'wrong')` against a mocked 401 response, expects it to reject with `ApiError`, then asserts `token`/`user` are `null`. Read `auth.store.ts:23-26` — `login`'s full implementation is:

```
login: async (email, password) => {
  const result = await authService.login(email, password)
  set({ token: result.data.token, user: result.data.user })
},
```

No `try`/`catch` at all. On rejection, the `await` throws straight out of the action; `set(...)` is never reached, and there is no code path inside `login()` that calls `clearSession()`. The only place `clearSession()` can be invoked as a result of this call is `api.ts:94-97`'s `config.onUnauthorized?.()`, fired inside the shared `request()` pipeline before the error is thrown. This confirms the report's reasoning: if the assertion passes, it is necessarily because the module-load `onUnauthorized` wiring fired for real — not because of any independent logic in `login()` (unlike `hydrate()`, which does have its own catch-and-clear for R5).

**c) Live mutation test #1 — `onUnauthorized` wiring (the core re-check).** Mutated `app/store/auth.store.ts`'s module-load call from:

```
onUnauthorized: () => useAuthStore.getState().clearSession(),
```

to:

```
onUnauthorized: () => {},
```

Reran `pnpm --filter './app' run test`. Result: **exactly 1 test failed** — `auth.store › onUnauthorized (fired by configureApi on any 401) clears the session independently of the calling action (R4)`, with `expect(received).toBeNull() // Received: "tok-1"`. All 14 other tests (all other `auth.store.test.ts` tests, `theme.store.test.ts`, `api.test.ts`) still passed. This proves the R4 test has real teeth and is precisely targeted — no over- or under-coupling to unrelated behavior.

Reverted the mutation via a byte-for-byte restore from a pre-mutation copy taken before the edit. Confirmed via `md5` (`2b7ec522660ea460bfe9c24fee471140` before and after the mutate/revert cycle) and `git diff app/store/auth.store.ts` (empty) that the file is identical to its pre-mutation state. Reran the full suite: 15/15 green again.

**d) Live mutation test #2 — test-isolation spot check on a different test (`logout` best-effort, R2).** To confirm the `beforeEach` simplification didn't silently break isolation or genuineness elsewhere in the file, mutated `logout()` in `auth.store.ts` from the best-effort `try/catch/finally` form to an unguarded:

```
logout: async () => {
  await authService.logout()
  get().clearSession()
},
```

(removing the "clear regardless of network outcome" behavior). Reran the suite. Result: **exactly 1 test failed** — `auth.store › logout clears token and user even when the network call fails (R2)`, throwing the mocked `ApiError` instead of clearing the session as expected. All 14 other tests, including the R4 test, still passed. This confirms the `beforeEach` simplification did not degrade isolation for the rest of the file — each test's assertions still depend on the real behavior of the store action under test, not on a stale mock/wiring artifact left over from a previous test.

Reverted the mutation; confirmed byte-identical via `md5` and an empty `git diff`; reran the full suite: 15/15 green.

**Conclusion:** the R4 fix is genuine and confirmed independently, using code inspection plus two separately-run mutation tests rather than trusting the implementer's report. No other vacuous test was found during this spot check.

## Findings

- The `LogoutResponseSchema` guess (`z.object({ data: z.unknown() })`) remains an acknowledged, explicitly flagged risk pending inspection of `be-auth`'s real `/auth/logout` response shape. This is a carried-forward, non-blocking risk (fails safe: a schema mismatch is swallowed by `logout()`'s best-effort catch, session still clears), not a defect in this ticket's scope, and was already correctly deferred by the plan/spec.
- The `app/package.json` `moduleNameMapper` addition for `@react-native-async-storage/async-storage` is minimal and correct — it maps to the package's own officially-shipped Jest mock, no new dependency was added anywhere.
- No new vacuous or orphaned tests were found beyond the R4 issue already fixed in this iteration; the two independent mutation tests performed here (targeting `onUnauthorized` and `logout`'s best-effort clause) both isolated to exactly the expected single test each, with zero collateral failures or false passes.
- No source file was left modified by this verification pass. Both mutations were applied to `app/store/auth.store.ts` and reverted immediately after each check; `md5`/`git diff` confirm byte-identity before/after both cycles, and the final `pnpm --filter './app' run test` run (15/15 green) post-dates the last revert.

## Verdict

- ✅ **PASS** — ready for human PR review.

**Reviewer summary:** `app-auth-store` adds `auth.service.ts` (thin API wrapper for `login`/`logout`/`me`) and `auth.store.ts` (Zustand + `persist` store with `login`/`logout`/`hydrate`/`clearSession`, wired into the api client's `configureApi` for token injection and 401-triggered session clearing), plus a 7-test suite. All 6 `must` requirements trace to real code with no gaps or orphans; `tsc`/`eslint`/`jest` are all green (15/15 tests, 0 lint errors). The R4 test-genuineness issue and the masking `beforeEach` re-wiring from the prior FAIL are both independently confirmed fixed via two fresh, self-run mutation tests (each isolating to exactly the expected single test, zero collateral, clean revert) — this re-verify used its own method rather than trusting the implementer's claim, and reached the same conclusion.
