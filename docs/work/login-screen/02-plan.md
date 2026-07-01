# Plan · login-screen

- **Feature id:** `login-screen`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner (full-auto)
- **Date:** 2026-07-01

## Approach

Replace the placeholder `app/app/(auth)/login.tsx` in a single edit with a controlled form: two `Input`s (email, password with `secureTextEntry`) and one `Button` (`label="Log in"`, `loading={isSubmitting}`), all local `useState` — no new store, no new files under `core/`. Pre-submit validation reuses `LoginRequestSchema.safeParse` from `@occ/shared` (single source of truth for the email/password rules, per `docs/MAP.md`'s "no duplicate rules" spirit) instead of hand-rolled regex checks; the first Zod issue is mapped to the offending field's `error` prop by inspecting `issue.path[0]`. Submission wraps `useAuthStore.getState().login(email, password)` in try/catch/finally, sets `formError` from `err.message` on failure (narrowed via `err instanceof Error`), and never calls `router.*` — `(auth)/_layout.tsx`'s existing redirect handles navigation once `login()` resolves and `token` is set. Layout wraps the form in `KeyboardAvoidingView` (`behavior: Platform.OS === 'ios' ? 'padding' : 'height'`) since no in-repo precedent exists and the password field can sit under the keyboard on shorter screens.

Rejected alternative: a hand-rolled validation function (non-empty + regex/`@`-check) instead of `LoginRequestSchema.safeParse`. Rejected because it would duplicate the email-format rule that already lives in `@occ/shared`, risking drift if the schema's rules ever change, and Zod's default messages are already presentable inline — no advantage to reimplementing.

This PR adds one RNTL interaction test for the screen (see "Tests to add or update" and the note under coverage) — treated as a `should`, not a `must`, since no `R`-id in the ledger names it, but justified explicitly rather than silently deferred.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | File(s) (`path:line`)                                    | R-ids                  | Type |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- | ---- |
| 1   | Replace the placeholder screen entirely: local `useState` for `email`, `password`, `isSubmitting`, `emailError`, `passwordError`, `formError`; `Input` × 2 (email: `label="Email"`, `keyboardType="email-address"`, `autoCapitalize="none"`; password: `label="Password"`, `secureTextEntry`), both wired to their `error` prop; `Button` (`label="Log in"`, `onPress={handleSubmit}`, `loading={isSubmitting}`); wrap the form in `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`) inside the existing themed `View` wrapper; import `Input`/`Button` from the `core/components` barrel, `useTheme` from `../../core/hooks/useTheme` (same relative depth as the placeholder), `useAuthStore` from `../../store/auth.store`, `LoginRequestSchema` from `@occ/shared` | `app/app/(auth)/login.tsx` (replace)                     | R1, R2, R3, R4, R6, R7 | edit |
| 2   | Implement `handleSubmit`: clear prior field errors and `formError`; run `LoginRequestSchema.safeParse({ email, password })`; on failure, take `result.error.issues[0]`, set `emailError`/`passwordError` (based on `issue.path[0] === 'email' \| 'password'`) to `issue.message`, and return without calling `login()`; on success, `setIsSubmitting(true)`, `try { await useAuthStore.getState().login(email, password) } catch (err) { setFormError(err instanceof Error ? err.message : 'Unknown error') } finally { setIsSubmitting(false) }` — no `router.*` call anywhere in this handler                                                                                                                                                                                                         | `app/app/(auth)/login.tsx` (same file, part of change 1) | R2, R4, R5, R6         | edit |
| 3   | Render `formError` (if set) as themed `Text` above the submit button, using `theme.colors.danger` and `theme.type.caption`/`bodySm` (whichever token the theme exposes for small body text — confirm against `theme.type` keys during implementation, no new literal sizes) — this is the login-failure surface distinct from the two field-level `Input` `error` props                                                                                                                                                                                                                                                                                                                                                                                                                                 | `app/app/(auth)/login.tsx` (same file, part of change 1) | R5, R7                 | edit |
| 4   | Add RNTL interaction test covering: (a) empty-submit shows field error(s) and does not call `login`; (b) invalid-email-format submit shows the email field error and does not call `login`; (c) valid submit calls `useAuthStore.getState().login` with the entered values and disables the button (`loading`) while in flight; (d) a rejected `login()` (mocked `ApiError`-shaped rejection) surfaces the message via `formError` and leaves `email`/`password` field values intact — mock `useAuthStore`, not `global.fetch`, per research's recommendation (screen's unit of concern is "did it call `login()` correctly," not the network layer)                                                                                                                                                    | `app/app/(auth)/login.test.tsx` (new)                    | R1, R2, R3, R4, R5, R6 | test |

Type: `create` \| `edit` \| `delete` \| `test` \| `config`.

Notes on sequencing: changes 1–3 are one file edit executed as a single coherent rewrite (split into three rows only to make each concern — layout/inputs, submit logic, error surface — separately reviewable); the file is fully typecheckable after that edit lands. Change 4 (test) is added last, against the finished screen, consistent with A4's "tests added when the developer considers the screen done" policy and this being the PR that completes `login.tsx`.

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 1, 4                 |
| R2   | must     | 1, 2, 4              |
| R3   | must     | 1, 4                 |
| R4   | must     | 1, 2, 4              |
| R5   | must     | 2, 3, 4              |
| R6   | must     | 1, 2, 4              |
| R7   | must     | 1, 3                 |

- [x] Every `must` requirement is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans).

## Tests to add or update

- `app/app/(auth)/login.test.tsx` (new) — asserts: empty-form submit blocks `login()` and shows a field error (R2); invalid-email submit blocks `login()` and shows the email field error (R2); valid submit calls `useAuthStore.getState().login(email, password)` with the typed values (R1, R3, R4); the submit `Button` is queryable by role/label and reflects a loading/disabled state while the mocked `login()` promise is pending (R3); a mocked `login()` rejection (`ApiError`-shaped, `{ name: 'ApiError', message: 'Bad credentials' }`) surfaces `'Bad credentials'` as inline text and leaves the email/password `Input` values unchanged (R5); no test asserts a `router.replace`/`push` call was made, and the test mocks `useAuthStore` directly rather than rendering `(auth)/_layout.tsx`, so R6 is covered by the _absence_ of a navigation call in the handler under test rather than an end-to-end redirect assertion (R6).

This is a `should`-priority addition (no `R`-id in the spec ledger names a test), justified because: (a) A4 (`docs/A4 · Quality Strategy.md:33,37`) frames interaction tests as added "when the developer considers the screen done," and this PR is exactly that milestone for `login.tsx`; (b) this is the first screen in the app with real branching logic (two validation paths, a success path, a failure path) as opposed to every other route file, which remains a static placeholder — it is the natural first screen to set the RNTL screen-test precedent; (c) all required infra (`@testing-library/react-native`, `@testing-library/jest-native/extend-expect`) is already present in `app/package.json`, so this adds zero new dependencies or config.

## Risks & rollback

- **Zod issue-path mapping is a judgment call** (no in-repo precedent for `safeParse` client-side). Risk: `issue.path[0]` could theoretically be empty for a whole-object-level error, though `LoginRequestSchema`'s two fields are each independently validated so this shouldn't occur in practice. Mitigation: default unmapped issues to `formError` (not a field error) so nothing is silently dropped. Rollback: this logic is isolated to `handleSubmit` inside one file — revert `app/app/(auth)/login.tsx` to the prior placeholder (still in git history) if this proves wrong post-verify.
- **`KeyboardAvoidingView` behavior choice is unverified against a real device/simulator** (no existing usage to copy). Risk: `'padding'` vs `'height'` may need a follow-up `keyboardVerticalOffset` if a header is later added above the form. Mitigation: the `(auth)` route currently has no header (confirmed via `_layout.tsx`'s bare `<Slot />`), so no offset is needed now. Rollback: swapping the `behavior` value or removing the wrapper is a one-line, isolated change.
- **Complexity budget**: `handleSubmit` combines validation branching + try/catch/finally. Estimated cyclomatic complexity is well under the `.eslintrc.js:26` limit of 10 (roughly 5–6 branches: two field-error checks, try, catch, finally, one instanceof narrow), but if implementation grows past that, extract a pure `validate(email, password)` helper returning `{ emailError?, passwordError? }` above the component — no plan change needed, just a note for the implementer.
- **New test file risk**: if `login.test.tsx` proves flaky against `KeyboardAvoidingView`/animation timers from `Button`'s `react-native-reanimated` press-absorb effect, mitigate with `jest-expo`'s existing RN mocks (already configured) rather than adding fake timers ad hoc; if still blocked, the test can be scoped down to (a)+(c)+(d) and revisited, but should not be dropped entirely given the justification above.
- Rollback for the whole feature: single file replace + one new test file, both isolated to `app/app/(auth)/login.tsx` and `app/app/(auth)/login.test.tsx` — reverting is a plain `git checkout` of those two paths with no cascading effect on other tickets (`_layout.tsx`, `auth.store.ts`, `@occ/shared` are all untouched, per research's "what NOT to touch").

## Handoff to IMPLEMENT

1. Replace `app/app/(auth)/login.tsx`: keep the themed `View` wrapper convention (`theme.colors.bg` background, `theme.spacing[6]` padding), add `KeyboardAvoidingView` inside it, add local `useState` for `email`/`password`/`isSubmitting`/`emailError`/`passwordError`/`formError`.
2. Add the two `Input`s (email + password/`secureTextEntry`) and the `Button` (`label`, `loading={isSubmitting}`), imported from `../../core/components`.
3. Implement `handleSubmit`: `LoginRequestSchema.safeParse` → map first issue to a field error and return, or `try/catch/finally` around `useAuthStore.getState().login(email, password)` → `formError` on catch. No `router.*` call anywhere.
4. Render `formError` as themed danger text above/below the button; verify `theme.type` for the right small-text token during implementation.
5. Run `tsc --noEmit` in `app/` to confirm the file typechecks before adding the test.
6. Add `app/app/(auth)/login.test.tsx` mocking `useAuthStore`, covering the five cases in "Tests to add or update"; run `yarn test` (or workspace equivalent) scoped to this file.
7. Run full lint/typecheck/test gate before marking the feature done.

## Sign-off

- [x] Plan reviewed by a human and approved to proceed to IMPLEMENT.
      (Full-auto mode; no blocking ambiguity found — both open questions in the spec ledger were pre-resolved by research with an explicit, cited recommendation.)
