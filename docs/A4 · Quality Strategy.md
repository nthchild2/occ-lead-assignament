# A4 · Quality Strategy

## Context

This document covers what we test at each layer, the branching and release strategy, PR requirements, code ownership, and the conventions the team follows day to day.

---

## Decision 1 · Testing strategy

The exercise requires at minimum one unit test per core module: the session store, the search hook, and the API service. We treat these as the floor, not the ceiling.

### What we test and where

| Layer | What | Tools |
|---|---|---|
| `packages/shared` schemas | Zod schemas parse valid and invalid shapes correctly | Jest |
| `core/services/api.ts` | Request construction, JWT injection, 401 interception | Jest, `msw` |
| `core/services/*.service.ts` | Service functions call the right endpoints with the right params | Jest, `msw` |
| `store/*.store.ts` | Store actions produce the correct state transitions | Jest |
| `core/hooks/` | Hooks return the correct state given a store and service setup | Jest, React Native Testing Library |
| `core/components/` | Renders correctly against theme tokens, snapshot regression, a11y props | Jest, React Native Testing Library, snapshots |
| Screen components | User interactions trigger the right store actions and service calls, snapshot regression on completion | React Native Testing Library, snapshots |
| Backend `*.service.ts` | Business logic, edge cases, error codes | Jest |
| Backend `*.router.ts` | Endpoint contracts, auth middleware, response shape | Jest, `supertest` |

### Snapshot tests

Snapshot tests are used for regression detection — catching unintended UI changes after a screen or component is considered done.

**Component library (`core/components/`):** Every component has a snapshot. Components are stable by design — a snapshot failure is always a signal worth investigating.

**Feature screens:** A snapshot is added in the same PR that completes the feature, after the developer considers the screen done. The snapshot is reviewed as part of the PR diff. Future PRs that intentionally change the screen must include the updated snapshot — a blind `jest --updateSnapshot` without reviewing the diff is a checklist violation.

The PR checklist includes: *"Snapshots reviewed, not blindly updated."*

Snapshots are not added to screens under active development — only to screens being submitted as complete.

### What we do not test

- Implementation details — we test what a module does, not how it does it internally
- Third party libraries — we trust `@gorhom/bottom-sheet`, `@notifee/react-native`, etc. to work

### Tools

**Frontend:**
- `jest` + `@testing-library/react-native` — component and hook tests
- `msw` (Mock Service Worker) — intercepts fetch calls in tests without mocking modules
- `@testing-library/jest-native` — additional matchers for React Native

**Backend:**
- `jest` — unit tests for services
- `supertest` — integration tests for routers, spins up the Express app without a real server

### Example — session store

```ts
// store/auth.store.test.ts
describe('auth.store', () => {
  it('stores token and user on login', () => {
    const { login, token, user } = useAuthStore.getState()
    login('jwt-token', { id: '1', email: 'test@occ.com.mx' })
    expect(useAuthStore.getState().token).toBe('jwt-token')
    expect(useAuthStore.getState().user?.email).toBe('test@occ.com.mx')
  })

  it('clears token and user on logout', () => {
    useAuthStore.getState().login('jwt-token', { id: '1', email: 'test@occ.com.mx' })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

### Example — API service interceptor

```ts
// core/services/api.test.ts
describe('api interceptor', () => {
  it('injects JWT into authenticated requests', async () => {
    useAuthStore.setState({ token: 'test-jwt' })
    const handler = rest.get('*/jobs', (req, res, ctx) => {
      expect(req.headers.get('Authorization')).toBe('Bearer test-jwt')
      return res(ctx.json({ data: { items: [], pagination: {} } }))
    })
    server.use(handler)
    await api.get('/jobs')
  })

  it('clears session and redirects on 401', async () => {
    server.use(rest.get('*/jobs', (_req, res, ctx) => res(ctx.status(401))))
    await api.get('/jobs').catch(() => {})
    expect(useAuthStore.getState().token).toBeNull()
  })
})
```

---

## Decision 2 · Branching strategy (Gitflow)

We follow Gitflow. The rationale: as the team grows, we need to control what goes to production independently of what is being developed. The release branch provides a stabilization window before shipping, and hotfix branches allow patching production without pulling in unfinished work from develop.

### Branch types

| Branch | Purpose |
|---|---|
| `main` | Production. Only receives merges from `release/*` and `hotfix/*`. Every merge is tagged. |
| `develop` | Integration branch. All feature, chore, and hotfix work merges here first. |
| `feature/*` | New features. Branches off `develop`, merges back into `develop`. |
| `chore/*` | Maintenance, dependencies, config, refactors. Same flow as `feature/*`. |
| `hotfix/*` | Production patches. Branches off `main`, merges into both `main` and `develop`. |
| `release/*` | Stabilization. Branches off `develop` when ready to ship, merges into `main`. Only bug fixes allowed on this branch — no new features. |

### Full dev workflow

**Day-to-day development**

Developers branch off `develop` for every piece of work — features, chores, refactors. When done, they open a PR back into `develop`. Every merge to `develop` triggers a preview EAS build that goes to the QA team for sprint testing.

`develop` is always moving. While QA is testing one batch of changes, developers are already working on the next.

```
develop
  └──→ feature/job-search-filters
            │  (PR reviewed + approved)
            └──→ develop ──→ [EAS preview → QA]
```

**End of sprint — cutting a release**

When the sprint ends and `develop` is in a shippable state, a `release/*` branch is cut from `develop`. This is a snapshot of `develop` at that point in time — it freezes the scope of the release.

From this point, `develop` moves on. Developers start the next sprint on `develop` without waiting for the release to ship. The release branch is isolated — only bug fixes found during smoke testing are allowed on it. No new features.

```
develop ──→ release/1.2.0  (snapshot of develop at sprint end)
│                │
│          (QA smoke tests, bug fixes only)
│                │
continues        └──→ main (tagged v1.2.0) ──→ production
next sprint      │
                 └──→ develop (backport any fixes made on release branch)
```

The backport to `develop` ensures any bugs fixed on `release/1.2.0` don't reappear in future releases.

**Hotfixes**

Hotfixes are different — they branch off `main`, not `develop`. The reason: a hotfix needs to patch what is currently in production, not what is being developed. `develop` may already have features that aren't ready to ship — pulling from it would include unfinished work in the fix.

```
main (v1.2.0 in production)
  └──→ hotfix/fix-auth-crash
            │  (fix applied, smoke tested)
            ├──→ main (tagged v1.2.1) ──→ production
            └──→ develop (backport)
```

**The full picture**

```
feature/* ─┐
chore/*  ──┼──→ develop ──→ release/* ──→ main (tagged)
           │        │              │         │
           │   [EAS preview]  [EAS preview]  └──→ develop (backport)
           │   Sprint QA      Smoke test
           │
hotfix/* (off main) ──→ main (tagged) ──→ develop (backport)
```

---

## Decision 3 · EAS build profiles, distribution, and release flow

We use Expo Application Services (EAS) with three build profiles mapped to the branching strategy.

### Build profiles

| Profile | Trigger | Audience |
|---|---|---|
| `development` | Manual, local | Developers |
| `preview` | Automatic on merge to `develop` and on `release/*` cut | QA team |
| `production` | Manual `eas build` + `eas submit` after `release/*` merges to `main` | End users |

The `preview` build on `release/*` is what QA smoke tests — not the production build. The production build is only triggered after QA has signed off and the lead has approved the merge to `main`. It is built from the merged `main` code and submitted directly to App Store Connect and Google Play.

### Distribution

**iOS:** Preview builds distribute via TestFlight (internal testers). Production builds go to App Store Connect via a manual `eas submit` call.

**Android:** Preview builds distribute via Google Play Internal Testing track. Production builds go to Google Play via a manual `eas submit` call.

Submission is always manual — no `autoSubmit`. The lead runs `eas submit` after verifying the production build is sound:

```bash
# After production build completes
eas submit --platform ios --latest
eas submit --platform android --latest
```

### QA touchpoints

**Sprint QA — every merge into `develop`**

Every time a `feature/*`, `chore/*`, or `hotfix/*` branch merges into `develop`, EAS kicks off a `preview` build automatically. The build lands on TestFlight and Play Internal Testing. QA tests changes within the same sprint.

**Smoke test — every `release/*` branch**

When a `release/*` branch is cut from `develop`, EAS kicks off a separate `preview` build. QA runs smoke tests against this build before the release is approved.

**Production — merge to `main`**

Triggered manually after both QA and lead approvals are in place (see Release approval below).

```
feature/* ──→ develop ──→ [EAS preview → TestFlight + Play Internal] → Sprint QA
                 │
                 └──→ release/* ──→ [EAS preview → TestFlight + Play Internal] → Smoke test
                                          │
                                          └──→ main ──→ [EAS production (manual)]
                                                             │
                                                    eas submit (manual)
                                                             │
                                              App Store Connect + Google Play
```

### Release approval mechanism

The `main` branch has GitHub branch protection rules:
- Direct pushes blocked — only `release/*` and `hotfix/*` PRs can target `main`
- Merge requires QA sign-off — QA reviewer is added to CODEOWNERS for `main` merges and must approve the PR
- Merge requires lead approval — enforced via CODEOWNERS

Both approvals must be present before GitHub unblocks the merge. Only after merge does the lead trigger the production build and submit manually.

### Versioning

We follow semantic versioning (`MAJOR.MINOR.PATCH`):
- `MAJOR` — breaking changes or significant product pivots
- `MINOR` — new features shipped in a sprint
- `PATCH` — bug fixes and hotfixes

Every merge to `main` is tagged with the version: `v1.2.0`, `v1.2.1`, etc.

### Hotfix process

Hotfixes branch off `main`, not `develop`.

**Critical** (auth broken, crash on launch, data loss):
- `hotfix/*` branch cut from `main`
- Fix applied, smoke tested by lead on a preview build
- Lead approves and merges to `main` — skips full QA cycle
- Immediately backported to `develop`
- `eas submit` triggered manually

**Non-critical:**
- Follows the normal sprint cycle
- Picked up in the next `release/*`

### Dev cycle

We release once per sprint. The sprint cadence determines the release cadence:

```
Sprint start
  → feature/* and chore/* branches off develop
  → each merge to develop triggers preview build → Sprint QA

Sprint end
  → release/* cut from develop
  → preview build → QA smoke test
  → QA signs off, lead approves
  → merge to main → tagged release
  → eas build (production) → eas submit
  → Apple review + Google Play review
```

Apple review typically takes 1-2 days. The release PR to `main` is opened at sprint end with enough buffer for review before the next sprint starts.

---

## Decision 9 · Security scanning

**Dependency vulnerabilities — Dependabot**

Dependabot is enabled via `.github/dependabot.yml`. It scans dependencies weekly and opens PRs automatically when a vulnerability is found or a new version is available.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
```

**Dependency audit — `npm audit`**

`npm audit --audit-level=high` runs as a merge requirement. A PR with a high-severity dependency vulnerability cannot be merged.

**Code-level security — `eslint-plugin-security`**

Added to the ESLint config for the backend. Catches common Node.js security issues: unsafe regex, injection risks, use of `eval`, insecure randomness. Relevant given the backend handles JWT, auth middleware, and user input.

Not applied to the frontend — the risk surface there is lower and the rules add noise without proportional value.

---

## Decision 4 · Pre-merge automation with Husky

Husky runs checks locally before code reaches the remote. Two hooks:

**Pre-commit** — fast checks that run on every commit:
- ESLint (`eslint --fix`)
- Prettier formatting (`prettier --write`)
- TypeScript check (`tsc --noEmit`)

Using `lint-staged` so only staged files are linted — not the entire codebase on every commit.

**Pre-push** — full test suite runs before pushing to remote:
- `jest --passWithNoTests`

This keeps CI from being the first place failures are caught. A developer knows their branch is clean before it ever hits the remote.

---

## Decision 5 · PR requirements

### Single responsibility

A PR does one thing. If a refactor opportunity is found while developing a feature, it goes in a separate `chore/*` PR. This is a hard rule, not a guideline — it keeps reviews focused and makes it easy to revert a specific change without losing unrelated work.

### Commit message format

We follow Conventional Commits:

```
feat(jobs): add salary range filter to search screen
fix(auth): handle token expiry during background fetch
chore(deps): upgrade expo-router to 6.1
refactor(jobs): extract pagination logic into useJobsPagination
test(auth): add unit tests for session store
docs(a3): update navigation diagram with decoupled sheet
```

Format: `type(scope): description`. Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`. Scope is the domain or screen name. This makes changelogs and release notes automatable.

### Code ownership (CODEOWNERS)

```
# .github/CODEOWNERS

# Shared contracts and auth always require lead review
/packages/shared/          @lead
/app/core/services/        @lead
/backend/domains/auth/     @lead
/docs/                     @lead

# Feature screens can be reviewed by any team member
/app/app/                  @team
/backend/domains/jobs/     @team
/backend/domains/applications/ @team
```

When a PR touches a path listed in CODEOWNERS, GitHub automatically requests the required reviewer. Lead review is required for shared contracts — a breaking change to `packages/shared` or `core/services/api.ts` affects both app and backend.

### PR template

```markdown
## What does this PR do?
<!-- One sentence. If you can't describe it in one sentence, split the PR. -->

## Type
- [ ] feat
- [ ] fix
- [ ] chore
- [ ] refactor
- [ ] docs

## Checklist
- [ ] This PR does one thing
- [ ] Tests added or updated
- [ ] Snapshots reviewed, not blindly updated (if UI changed)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No ESLint errors
- [ ] Relevant docs updated (if applicable)

## How to test
<!-- Steps for the reviewer to verify the change -->

## Screenshots / recordings (if UI change)

## Related issues / tickets
```

### Merge requirements

A PR cannot be merged unless:
- All checklist items are checked
- Pre-push hooks pass (tests green, TypeScript clean)
- At least one approval from a team member
- Lead approval if CODEOWNERS requires it
- No unresolved review comments

---

## Decision 6 · AI-readiness

### CLAUDE.md

`CLAUDE.md` lives at the repo root and is read automatically by Claude Code when the project is opened. It gives any AI agent the context needed to work in this codebase without reading every file — architecture overview, key conventions, commands, branching strategy, and a pointer to CODEOWNERS for ownership rules.

The file will be created as part of the repo bootstrap. It is the single source of truth for agent instructions and must be kept up to date as the architecture evolves.

### GitHub Copilot instructions

`.github/copilot-instructions.md` gives Copilot the same structural context for inline suggestions — what patterns to follow, what to avoid, and where things live. It covers the same ground as `CLAUDE.md` but scoped to the kind of context Copilot uses for autocomplete and chat suggestions.

The file will be created as part of the repo bootstrap alongside `CLAUDE.md`.

---

## Decision 7 · Linting, formatting, and code conventions

The actual enforcement lives in configuration files at the repo root. This section describes what each file enforces and why — the files themselves are the source of truth.

### Files to be created

| File | Purpose |
|---|---|
| `.eslintrc.js` | ESLint rules for both app and backend |
| `.prettierrc` | Formatting rules |
| `tsconfig.base.json` | Shared TypeScript config, strict mode |

### ESLint — what we enforce

**Architecture boundaries:**
- `import/no-restricted-paths` — `core/` cannot import from `app/`. Backend domain services cannot import from routers or middleware.
- No cross-domain imports in the backend — `domains/jobs` cannot import from `domains/auth` directly.

**TypeScript hygiene:**
- `@typescript-eslint/no-explicit-any` — no `any`. Use `z.infer<>` for API response types.
- `@typescript-eslint/no-non-null-assertion` — no `!` assertions. Handle nullability explicitly.
- `@typescript-eslint/consistent-type-imports` — `import type` for type-only imports.

**React Native:**
- `react-hooks/rules-of-hooks` — hooks only at the top level of components and custom hooks.
- `react-hooks/exhaustive-deps` — no missing dependencies in `useEffect`.

**Code smells:**
- `no-console` — no `console.log` in production code. Use the `logger` from `backend/src/lib/logger.ts`.
- `no-unused-vars` — no dead code.
- `complexity` — max cyclomatic complexity of 10 per function. If a function needs more, it should be split.

### Prettier — what we enforce

Formatting is not a code review concern — Prettier handles it automatically on pre-commit. The config will enforce consistent formatting across the entire codebase so diffs are always about logic, never about style.

### Code conventions not enforceable by tools

These are documented here and referenced in `CLAUDE.md` and `copilot-instructions.md`:

- **No inline styles in React Native components** — all styles go through the theme tokens in `core/theme/`.
- **No direct store access in components** — components call actions, not `setState` directly.
- **Service functions return typed responses** — never `any`, never raw `Response`.
- **Error handling at the boundary** — services throw, hooks catch. Components never handle raw errors from fetch.
- **One component per file** — no barrel files that export multiple components.

---

## Decision 8 · Accessibility

We follow WCAG 2.1 AA as the baseline. Accessibility is enforced at three levels: static analysis, testing, and runtime auditing during development.

### Static analysis — pre-commit

`eslint-plugin-react-native-a11y` runs as part of the ESLint config. Catches the most common violations before code is committed:

- Missing `accessibilityLabel` on interactive elements
- Missing `accessibilityRole` on touchables
- Touch targets smaller than 44×44pt
- Incorrect or missing `accessibilityState` on toggles (Apply, Favorite buttons)

### Testing — component and screen level

React Native Testing Library queries by `accessibilityRole` and `accessibilityLabel` by default. Writing tests this way naturally enforces semantic correctness — if a component can't be queried by role, it isn't accessible.

```ts
// Enforces that the button has the correct role and label
const applyButton = getByRole('button', { name: 'Apply to this job' })
expect(applyButton).toBeEnabled()
```

`@testing-library/jest-native` provides additional matchers:
```ts
expect(applyButton).toHaveAccessibilityLabel('Apply to this job')
```

### Runtime auditing — development builds

Expo's built-in accessibility inspector highlights violations in the simulator during development. No setup required — available out of the box.

For deeper runtime auditing, `@axe-core/react-native` is available as a paid option. Not included in the baseline setup but worth evaluating if the team wants automated contrast and screen reader flow auditing in development builds.

### WCAG enforcement via theme tokens

The three most common WCAG AA violations in mobile apps and how we address them:

| Criterion | Requirement | Enforcement |
|---|---|---|
| 1.4.3 Contrast | Text contrast ratio ≥ 4.5:1 | Theme tokens define contrast-safe color pairs. All colors come from the theme — no hardcoded values. |
| 2.5.5 Target size | Touch targets ≥ 44×44pt | ESLint via `react-native-a11y`. Minimum sizes enforced in theme spacing tokens. |
| 4.1.2 Name, Role, Value | Every interactive element has a label and role | ESLint + RNTL queries as the standard testing pattern. |

Contrast safety is guaranteed by design: if colors only come from theme tokens, and the tokens are defined with contrast in mind, no component can accidentally use a non-compliant color pair.