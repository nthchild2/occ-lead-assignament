# Plan · app-api-client

- **Feature id:** `app-api-client`
- **Inputs read:** `00-spec.md`, `01-research.md`
- **Planner:** planner subagent
- **Date:** 2026-07-01

## Approach

Build a single plain service module at `app/core/services/api.ts` — the one boundary all network traffic flows through — plus its co-located `msw` test. The module holds a module-scope config singleton (`getToken`, `onUnauthorized`) mutated through an exported `configureApi(...)`, mirroring the singleton-with-setter shape of `app/store/theme.store.ts:22-30`; this is dependency inversion, so the client imports nothing from `store/` or `app/` and stays inside the `core/` boundary (`.eslintrc.js:33`). Request helpers (`get`/`post`/`del`, plus `put`/`patch` since they share one code path) each take a response Zod schema from `@occ/shared` and return `z.infer<>`-typed data, parsed at the boundary; there is no `any`. A shared private helper resolves the base URL from `process.env.EXPO_PUBLIC_API_BASE_URL` (inlined by `babel-preset-expo`, `app/babel.config.js:4`), builds headers (injecting `Authorization: Bearer <token>` only when `getToken()` yields a token), and centralizes the non-2xx path: parse the body with `ApiErrorSchema` and throw a throwable `ApiError` class carrying `code`/`message`; on HTTP 401 fire `onUnauthorized()` first, then still throw so the caller never proceeds.

The chosen R2 mechanism is **option (a)** from research Risks — rename the documented var to `EXPO_PUBLIC_API_BASE_URL` and read it via `process.env`. Rejected: **option (b)** `expo-constants` `extra` via an `app.config.ts` — it adds a config file and an `extra` block absent from the current flat `app.json` (`app/app.json:2-28`) for no benefit at this scope; (a) is the lower-friction SDK-54 idiom.

One design point research surfaced implicitly: `@occ/shared` exports `ApiError` as a **plain envelope type** (`z.infer<typeof ApiErrorSchema>` = `{ error: { code, message } }`, `packages/shared/src/schemas/application.schema.ts:32`), which is not throwable/catchable as an `Error`. R5 requires callers to `catch` a typed error with `code` + `message`. The client therefore defines a throwable `ApiError` **class** (extends `Error`, exposes `code`/`message`) whose data is validated against the shared `ApiErrorSchema` — the schema stays the source of truth for the wire shape; the class is the thrown surface. This touches no shared files.

## Planned changes

| #   | Change                                                                                                                                                                                                                                                                                                                             | File(s) (`path:line`)                 | R-ids      | Type   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | ------ |
| 1   | Rename the app base-URL var to `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` (keep the "place in app/.env" comment) so `process.env` resolves it at runtime; no literal URL will live in source                                                                                                                                 | `.env.example:8-9`                    | R2         | config |
| 2   | Create the service module scaffold: module-scope config singleton `{ getToken, onUnauthorized }` (both undefined until configured) and exported `configureApi({ getToken, onUnauthorized })` setter (à la `theme.store` `setPreference`, `app/store/theme.store.ts:22-30`); imports nothing from `store/`/`app/`                   | `app/core/services/api.ts` (new)      | R3, R6     | create |
| 3   | Add private `resolveBaseUrl()` reading `process.env.EXPO_PUBLIC_API_BASE_URL`; throw a typed config error if unset (no non-null assertion, `.eslintrc.js:14`); no hardcoded URL                                                                                                                                                    | `app/core/services/api.ts` (new)      | R2         | create |
| 4   | Add throwable `ApiError` class `extends Error` with public `code: string` (message via `super`); a private `mapError(status, body)` parses the envelope with `ApiErrorSchema` from `@occ/shared` and returns/throws it                                                                                                             | `app/core/services/api.ts` (new)      | R5         | create |
| 5   | Add private `buildHeaders(auth: boolean)`: always `Content-Type: application/json`; when `auth`, read `config.getToken()` and add `Authorization: Bearer <token>` only if a token is returned (omit otherwise)                                                                                                                     | `app/core/services/api.ts` (new)      | R3         | create |
| 6   | Add private `request<T>(method, path, schema, { body?, auth? })` core: `fetch` base+path with headers; on 401 call `config.onUnauthorized?.()` then throw the mapped `ApiError`; on other non-2xx throw mapped `ApiError`; on 2xx `schema.parse(json)` and return `z.infer<typeof schema>` (throws on shape mismatch, never `any`) | `app/core/services/api.ts` (new)      | R4, R5, R6 | create |
| 7   | Export the typed request helpers `get`/`post`/`put`/`patch`/`del`, each `<T>(path, schema, body?)` delegating to `request`, each returning `z.infer<typeof schema>` (single module surface for all network calls)                                                                                                                  | `app/core/services/api.ts` (new)      | R1, R4     | create |
| 8   | Create the co-located `msw` test: server intercepts a stub endpoint; assert (a) `Authorization: Bearer` injected when `getToken` set, (b) success body `schema.parse`d and returned typed, (c) `{ error }` envelope → thrown `ApiError` with `code`/`message`, (d) 401 → injected `onUnauthorized` fired and request still rejects | `app/core/services/api.test.ts` (new) | R7         | test   |

Type: `create` | `edit` | `delete` | `test` | `config`.

Notes on new files (not in research as existing — justified):

- `app/core/services/api.ts` — the module this feature exists to build; `services/` dir is new, reserved by A1 (`docs/A1 · Monorepo Architecture.md:31`) and named by research (`01-research.md` Relevant files, R1–R6).
- `app/core/services/api.test.ts` — co-located test mandated by R7; app jest preset auto-discovers `*.test.ts` beside the unit (no `roots`/`testMatch`, `app/package.json:40-48`); pattern from `app/store/theme.store.test.ts`. No `__tests__/` dir.

## Requirement coverage check

| R-id | Priority | Covered by change(s) |
| ---- | -------- | -------------------- |
| R1   | must     | 7                    |
| R2   | must     | 1, 3                 |
| R3   | must     | 2, 5                 |
| R4   | must     | 6, 7                 |
| R5   | must     | 4, 6                 |
| R6   | must     | 2, 6                 |
| R7   | must     | 8                    |

- [x] Every `must` requirement is covered by ≥1 change.
- [x] Every planned change cites ≥1 requirement (no orphans): 1→R2, 2→R3/R6, 3→R2, 4→R5, 5→R3, 6→R4/R5/R6, 7→R1/R4, 8→R7.

## Tests to add or update

- `app/core/services/api.test.ts` (new, co-located, `msw ^2.2.0` from `app/package.json:58`) — one `describe('api')` with cases tied to R7's four assertions:
  - **JWT injection (R3)** — `configureApi({ getToken: () => 'tok' })`; msw handler captures the inbound `Authorization` header; assert it equals `Bearer tok`. A second case with `getToken` returning `undefined`/an unauthenticated call asserts the header is absent.
  - **Success parsed & typed (R4)** — msw returns a valid `{ data: ... }` body; call a helper with a real `@occ/shared` schema (e.g. `MeResponseSchema`, `packages/shared/src/schemas/auth.schema.ts:20`); assert the resolved value deep-equals the parsed data. A malformed-body case asserts the call rejects (schema mismatch throws, never returns `any`).
  - **Error envelope → thrown `ApiError` (R5)** — msw returns non-2xx `{ error: { code, message } }` (`ApiErrorSchema`, `packages/shared/src/schemas/application.schema.ts:22-27`); assert the call rejects with an `ApiError` instance whose `code`/`message` match.
  - **401 → `onUnauthorized` (R6)** — `configureApi({ onUnauthorized: jest.fn() })`; msw returns 401; assert the mock was called once **and** the promise still rejects.
  - msw v2 under jest-expo may need a `fetch`/`Response` polyfill or the node interceptor in test setup — an implementation detail for IMPLEMENT (research Risks); if unavailable, wire it locally in the test file, do **not** touch the shared `app/package.json` jest block (research "What NOT to touch").

## Risks & rollback

- **R2 env var not inlined at runtime.** Only `EXPO_PUBLIC_*` vars are inlined by `babel-preset-expo` (`app/babel.config.js:4`); the old bare `API_BASE_URL` would read `undefined`. Mitigation: change #1 renames it and change #3 throws a clear config error when unset (fail-loud, not silent hardcode). Rollback: revert `.env.example:8-9` and the `resolveBaseUrl` reader; no other file depends on the name yet.
- **`ApiError` name collision.** The shared `ApiError` type (envelope) and the client's throwable `ApiError` class share a name. Mitigation: import the shared symbol as a `type` only where needed and let the class be the module's exported runtime `ApiError`; if ambiguity arises, alias the import (`import type { ApiError as ApiErrorEnvelope }`). Rollback: contained to `api.ts`.
- **msw / jsdom fetch wiring flakiness** (research Risks). Mitigation: keep any polyfill local to the test file. Rollback: delete `api.test.ts`; production module is unaffected.
- **Verification-gate guardrails.** No `any` (helpers return `z.infer<>`), no non-null assertion (guard unset config/token/env), no `console.*` (surface via thrown `ApiError`), `consistent-type-imports` (types via `import type`), complexity ≤ 10 (per-method extraction: `resolveBaseUrl`/`buildHeaders`/`mapError`/`request` are separate functions). All checked against `.eslintrc.js:13-26`. Rollback for any gate failure: the whole feature is two new files + one config-line rename — revert those three edits and the tree returns to green.

## Handoff to IMPLEMENT

1. Rename `.env.example:8-9` to `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` (keep the app/.env comment). [#1, R2]
2. Create `app/core/services/api.ts`: config singleton + `configureApi({ getToken, onUnauthorized })` setter; import nothing from `store/`/`app/`. [#2, R3/R6]
3. Add `resolveBaseUrl()` reading `process.env.EXPO_PUBLIC_API_BASE_URL`, throwing a typed error if unset. [#3, R2]
4. Add the throwable `ApiError` class + `mapError()` parsing the envelope via `ApiErrorSchema` from `@occ/shared`. [#4, R5]
5. Add `buildHeaders(auth)` injecting `Authorization: Bearer <token>` from `config.getToken()` only when a token exists. [#5, R3]
6. Add the `request<T>(...)` core: 401 → `onUnauthorized?.()` then throw; other non-2xx → throw mapped `ApiError`; 2xx → `schema.parse` and return typed. [#6, R4/R5/R6]
7. Export `get`/`post`/`put`/`patch`/`del` helpers delegating to `request`, returning `z.infer<typeof schema>`. [#7, R1/R4]
8. Add co-located `app/core/services/api.test.ts` with `msw`; cover JWT injection, success parse/type, error-envelope→`ApiError`, 401→`onUnauthorized`. [#8, R7]
9. Run typecheck, lint, and the app test suite; confirm no `any`/`console`/non-null-assertion and complexity ≤ 10.

## Sign-off

- [x] Plan reviewed — full-auto mode; the two hard stops (no unresolved blocking ambiguity; no uncovered `must`) both pass. Proceeding to IMPLEMENT.
