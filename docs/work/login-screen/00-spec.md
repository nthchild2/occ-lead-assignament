# Spec · login-screen

- **Feature id:** `login-screen`
- **Date:** 2026-07-01
- **Author:** orchestrator (full-auto)
- **Source spec:** `docs/ejercicio_tecnico_lead_rn_occ.pdf` §3 (Screen 3 · Auth); `docs/work/ROADMAP.md` (Epic D, `login-screen`)
- **Depends on:** `app-auth-store` (`login` action, `ApiError`), `app-nav-shell` (`(auth)/login.tsx` placeholder to replace, redirect-on-session behavior)

## Summary

Replace the `app/app/(auth)/login.tsx` placeholder with the real login form: email + password inputs, a submit button, inline validation, loading state during submission, and error display on failure (invalid credentials / network error). On success, `auth.store.login()` sets the session and `(auth)/_layout.tsx`'s existing redirect-when-authenticated logic takes the user to the protected area — this screen does not navigate manually.

## Requirements ledger

| ID  | Requirement (atomic, testable)                                                                        | Source                   | Acceptance criterion                                                                                                             | Priority |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Email and password inputs, using `core/components/Input`                                              | PDF §3                   | Two labeled inputs render; password input obscures text; both are controlled (local component state)                             | must     |
| R2  | Client-side validation before submit: non-empty email in a valid format, non-empty password           | PDF §3 (implied form UX) | Submitting with an invalid/empty email or empty password shows an inline error and does NOT call `auth.store.login()`            | must     |
| R3  | Submit button using `core/components/Button`, disabled/loading while a login request is in flight     | PDF §3                   | Button shows a loading state during submission; a second tap while loading does not fire a duplicate request                     | must     |
| R4  | On submit, calls `auth.store.login(email, password)`                                                  | PDF §3                   | A valid form submission calls the store action with the entered credentials                                                      | must     |
| R5  | On login failure (`ApiError`), display the error message inline without crashing or clearing the form | PDF §3 (error UX)        | A rejected `login()` call surfaces `error.message` (e.g. "Bad credentials") in the UI; email/password fields retain their values | must     |
| R6  | No manual navigation on success — rely on `(auth)/_layout.tsx`'s existing redirect                    | A3; `app-nav-shell` R4   | The screen does not call `router.replace`/`push` after a successful login                                                        | must     |
| R7  | All styling via `useTheme()` — no inline color/size literals                                          | MAP convention           | Matches the established component styling pattern                                                                                | must     |

## Explicitly out of scope

- **Route/guard logic** — already built in `app-nav-shell`; this ticket only fills the screen content.
- **Forgot-password / registration** — not in the brief.
- **Session hydration on app launch** — already handled by `(protected)/_layout.tsx`'s `hydrate()`.

## Open questions / ambiguities

<!-- Non-blocking; resolve in research/plan. -->

- [x] Exact validation rules → **resolution:** research confirms whether `LoginRequestSchema` (Zod) can be reused client-side for validation (parse-and-show-first-error) rather than hand-rolling separate validation logic — prefer reuse if the schema's error messages are presentable, else a minimal local check (non-empty + `@` presence).
- [x] Loading/error state location → **resolution:** local component state (`useState`) is sufficient — no new store needed; `auth.store.login()` already throws/propagates `ApiError` for the screen to catch.

## Sign-off

- [x] Ledger reviewed — full-auto mode 2026-07-01; proceeding to RESEARCH.
