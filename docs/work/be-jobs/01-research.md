# Research · be-jobs

- **Feature id:** `be-jobs`
- **Inputs read:** `00-spec.md`, `docs/MAP.md`, `docs/A1 · Monorepo Architecture.md`, `docs/A4 · Quality Strategy.md` (referenced), `.eslintrc.js`, the `be-auth` domain + `be-core` libs
- **Researcher:** researcher subagent (read-only)
- **Date:** 2026-07-01

## Relevant files

### `@occ/shared` — the wire contract (reuse as-is, do not edit)

| File (`path:line`)                                | Why it matters to this feature                                                                                                                                                                                                                                                          | R-ids                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `packages/shared/src/schemas/job.schema.ts:3-12`  | `JobSchema` — the job shape the seed must populate: `id,title,company,city,salary(number\|null),description,publishedAt(datetime string),tags[]`. Seed rows and `getById` must satisfy it.                                                                                              | R1, R8                 |
| `packages/shared/src/schemas/job.schema.ts:14-20` | `PaginationSchema` — `page,limit,total,hasNext,hasPrev`. The service's pagination math must produce exactly these fields.                                                                                                                                                               | R2                     |
| `packages/shared/src/schemas/job.schema.ts:22-33` | `JobFiltersSchema` — **types `salary_min/salary_max/page/limit` as `z.number()`** and `sort` as a 5-value enum with `.default('date_desc')`; `page` defaults 1, `limit` defaults 20. This is the _service-facing_ filter type (`JobFilters`), NOT a query-string parser — see Risks R7. | R2, R3, R4, R5, R6, R7 |
| `packages/shared/src/schemas/job.schema.ts:35-40` | `JobListResponseSchema` — `{ data: { items, pagination } }`. The `GET /jobs` envelope must match.                                                                                                                                                                                       | R2                     |
| `packages/shared/src/schemas/job.schema.ts:42-44` | `JobDetailResponseSchema` — `{ data: Job }`. The `GET /jobs/:id` 200 envelope.                                                                                                                                                                                                          | R8                     |
| `packages/shared/src/schemas/job.schema.ts:46-50` | Inferred types `Job`, `Pagination`, `JobFilters`, `JobListResponse`, `JobDetailResponse` — derive via `z.infer`; no hand-written duplicates.                                                                                                                                            | R1, R2, R8             |
| `packages/shared/src/schemas/index.ts:2`          | `job.schema` is re-exported from the shared barrel; import everything as `@occ/shared` (never a deep path).                                                                                                                                                                             | R1, R2, R8             |

### `be-core` — reuse for errors, validation, envelope

| File (`path:line`)                                      | Why it matters to this feature                                                                                                                                                                                                                                                                                                               | R-ids  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `backend/src/lib/errors.ts:12-20`                       | `ERROR_STATUS` maps `NOT_FOUND→404` and `VALIDATION_ERROR→422`. The service throws `AppError('NOT_FOUND')` for R8; `validate` throws `VALIDATION_ERROR` for R7.                                                                                                                                                                              | R7, R8 |
| `backend/src/lib/errors.ts:30-40`                       | `AppError(code, message)` — Express-free error the jobs service throws for the 404.                                                                                                                                                                                                                                                          | R8     |
| `backend/src/middleware/validation.middleware.ts:24-41` | `validate({ body?, query?, params? })` factory. **`safeParse`s each part; on success writes parsed data back via `req[part] = result.data` (line 36)** — so a query schema with `z.coerce.number()` will hand _coerced numbers_ to the handler. On first failure throws `AppError('VALIDATION_ERROR')` → 422. This is exactly the R7 wiring. | R7     |
| `backend/src/lib/response.ts:3-5`                       | `success(res, data, status=200)` → `{ data }`. Both jobs routes use this for the 200 envelope.                                                                                                                                                                                                                                               | R2, R8 |
| `backend/src/lib/response.ts:7-14`                      | `fail(res, status, code, message)` → `{ error: { code, message } }`. Not called directly by the domain — the error middleware calls it — but documents the failure envelope tests assert against.                                                                                                                                            | R7, R8 |
| `backend/src/middleware/error.middleware.ts:14-27`      | Global handler: an `AppError` renders `{code,message}` at its status; anything else → 500. Must stay mounted last (see `app.ts`). Confirms thrown `AppError` from the jobs service surfaces correctly.                                                                                                                                       | R7, R8 |

### `be-auth` — the domain shape to mirror (minus auth)

| File (`path:line`)                                             | Why it matters to this feature                                                                                                                                                                                                                                                                                                                                               | R-ids          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `backend/src/domains/auth/auth.router.ts:14-24`                | Router pattern to copy: `Router()`, `validate({...})` first, thin handler that casts `req.body`/`req.query`, calls the service, then `success(res, ...)`. **Only file in the domain that imports Express.** The jobs router mirrors this with `validate({ query })` on the list route and `validate({ params })` on the detail route — and **no `authMiddleware`** (public). | R2, R7, R8, R9 |
| `backend/src/domains/auth/auth.service.ts:1-58`                | Service pattern to copy: pure module functions, **no Express import**, in-memory state (`const blacklist = new Set`) is the precedent for the in-memory jobs array. Throws `AppError` for domain failures. Jobs service holds all filter/sort/paginate/getById logic here so it is unit-testable in isolation.                                                               | R2-R6, R8, R10 |
| `backend/src/domains/auth/auth.schema.ts:1-17`                 | Domain-internal types pattern: re-export the shared wire types (`export type { User }`) and define only domain-internal types locally. Jobs' `jobs.schema.ts` re-exports `Job`/`JobFilters`/etc. and defines the **backend-only query-parse schema** (the `z.coerce` one) here.                                                                                              | R7             |
| `backend/src/domains/auth/__tests__/auth.router.test.ts:1-101` | Test-harness pattern to copy: `supertest` against `import { app }`, `request(app).get(...)`, assert `res.status`, and **parse the body through the shared response schema** (`JobListResponseSchema.parse(res.body)`). Assert `error.code` via `ApiErrorSchema` for the 422/404 cases. Tests live in `__tests__/`.                                                           | R10            |

### `app.ts` — mount point

| File (`path:line`)         | Why it matters to this feature                                                                                                                        | R-ids |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `backend/src/app.ts:21-22` | `authRouter` is mounted at `/auth`; **line 22 is a commented `// app.use('/jobs', jobsRouter)` placeholder.** Mount the real `jobsRouter` here.       | R9    |
| `backend/src/app.ts:27`    | `app.use(errorMiddleware)` must remain last — the jobs router mounts **before** it (line 22 sits above line 27).                                      | R9    |
| `backend/src/app.ts:31-44` | Under `NODE_ENV=test` no port is bound, so supertest can `import { app }` cleanly. Confirms the R10 integration tests need no server-lifecycle setup. | R10   |

### Test harness / config (reuse, no change needed)

| File (`path:line`)                | Why it matters to this feature                                                                                                                                                                                                                                | R-ids |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `backend/package.json:20-35`      | jest config: `preset: ts-jest`, `roots: src`, **`testMatch: **/__tests__/**/*.test.ts`** (co-located backend tests are silently skipped), `setupFiles: jest.setup.ts`, and `@occ/shared` → `packages/shared/src/index.ts`. New tests must go in `__tests__/`. | R10   |
| `backend/package.json:15`         | `express: ^4.18.0` declared — installed **4.22.2** (see Risks). Decisive for R7.                                                                                                                                                                              | R7    |
| `backend/jest.setup.ts:6`         | Sets `JWT_SECRET` before any import so `config/env.ts` parses. Jobs tests inherit this automatically; nothing to add.                                                                                                                                         | R10   |
| `backend/src/config/env.ts:14-19` | **Precedent that `z.coerce.number()` is the established repo pattern** — `PORT: z.coerce.number()...` parses a string env var to a number. Reuse the same idiom for the query schema.                                                                         | R7    |

### New files to create (bare paths — do not exist yet)

| File (bare path)                                          | Why it matters to this feature                                                                                                                                                                                                    | R-ids           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `backend/src/domains/jobs/jobs.schema.ts`                 | Re-export shared `Job`/`JobFilters`/`Pagination`/response types; define the **backend-only `JobQuerySchema`** using `z.coerce.number()` (+ same `sort` enum/defaults) for `validate({ query })`, plus a params schema (`{ id }`). | R7              |
| `backend/src/domains/jobs/jobs.seed.ts`                   | In-memory `Job[]` of ≥90 rows, some with `salary: null`, varied ISO `publishedAt`, realistic city/tag sets. Confirmed feasible (see Risks).                                                                                       | R1              |
| `backend/src/domains/jobs/jobs.service.ts`                | Express-free logic: `list(filters): {items, pagination}` (filter → sort → paginate) and `getById(id): Job` (throws `AppError('NOT_FOUND')`).                                                                                      | R2-R6, R8       |
| `backend/src/domains/jobs/jobs.router.ts`                 | Public router: `GET /` (`validate({ query: JobQuerySchema })` → service.list → `success`) and `GET /:id` (`validate({ params })` → service.getById → `success`). No `authMiddleware`.                                             | R2, R7, R8, R9  |
| `backend/src/domains/jobs/__tests__/jobs.service.test.ts` | Unit tests: q/city/salary filters incl. null-salary exclusion, all five sorts, pagination boundaries, `getById` 404.                                                                                                              | R10             |
| `backend/src/domains/jobs/__tests__/jobs.router.test.ts`  | supertest integration: 200 list-envelope parse, 422 on bad query, 404 on unknown id.                                                                                                                                              | R2, R7, R8, R10 |

## Existing patterns to follow

- **Structure a backend domain** → mirror `backend/src/domains/auth/`: router (`auth.router.ts:14-24`) is the only Express-touching file and does `validate` + thin handler + `success`; service (`auth.service.ts:1-58`) is pure/Express-free and owns in-memory state; internal types in `*.schema.ts` (`auth.schema.ts:1-17`).
- **Validate + coerce a request part** → `validate({ query })` (`validation.middleware.ts:24-41`); it reassigns `req[part]` (line 36), so a `z.coerce.number()` query schema delivers numbers to the handler. Precedent for `z.coerce.number()`: `backend/src/config/env.ts:15`.
- **Success / error envelope** → `success()` (`response.ts:3`) for 200; throw `AppError(code, msg)` (`errors.ts:30`) and let `errorMiddleware` (`error.middleware.ts:20-26`) render `{error:{code,message}}`. No manual `res.json` of errors in the domain.
- **Backend tests** → co-locate under `__tests__/` (`package.json:26`), supertest against `import { app }`, parse response bodies through the shared schemas and assert `error.code` (`auth.router.test.ts:1-101`).
- **Mount a router** → add `app.use('/jobs', jobsRouter)` at `app.ts:22` (the placeholder), keeping `errorMiddleware` (`app.ts:27`) last.
- **API types** → derive with `z.infer` from `@occ/shared`; never hand-write duplicate interfaces (`job.schema.ts:46-50`).

## Constraints that apply

- **Services must not import Express** — `jobs.service.ts` is the named example of this rule (A1 Decision 4, `docs/A1 · Monorepo Architecture.md:159,163`). Only `jobs.router.ts` imports Express.
- **Domains must not import each other** — `.eslintrc.js:70-86` explicitly forbids `backend/src/domains/jobs` importing from `backend/src/domains/auth` (use DI). The jobs domain is self-contained; it needs no auth import anyway (public endpoints).
- **Do not edit `@occ/shared`** — the shared job schemas are the single source of truth (MAP.md "add or change an API type"; A1 Decision 1). Query coercion lives in a **backend-only** schema, per `00-spec.md:32,38`.
- **Response envelope** — `{ data }` / `{ error: { code, message } }`, no `ok` field; use `response.ts` helpers (A1 Decision 6, MAP.md:55).
- **No `any`; API types via `z.infer<>`** — `.eslintrc.js:13`.
- **No `console.*`** in production code — `.eslintrc.js:18`; use the backend `logger` if logging is needed (relaxed in test files, `.eslintrc.js:91-95`).
- **Cyclomatic complexity ≤ 10** — `.eslintrc.js:26`. The sort/filter dispatch must not be one giant branching function; use a sort-mode → comparator lookup table and small filter helpers rather than nested `if`s.
- **`no-non-null-assertion`** — `.eslintrc.js:14`; no `!` in the seed/service.
- **`eslint-plugin-security` `detect-object-injection`** is a _warn_ on `backend/**` (`.eslintrc.js:63`). A `sort` string used to index a comparator map may trip this warning — prefer a typed `Record<SortMode, Comparator>` accessed via a narrowed enum key (mirrors how `errors.ts:38` indexes `ERROR_STATUS`) to keep it clean.

## What NOT to touch

- `packages/shared/src/schemas/job.schema.ts` and the rest of `@occ/shared` — reuse only; editing requires lead review (`00-spec.md:32`).
- `backend/src/lib/*`, `backend/src/middleware/*`, `backend/src/config/env.ts` — `be-core` primitives, already committed and reused as-is. No change required for jobs.
- `backend/src/domains/auth/*` — do not import from or modify; cross-domain import is eslint-forbidden.
- `backend/package.json` jest config / `jest.setup.ts` — the harness already supports the new tests; no config change.
- apply / favorites / any job mutation (create/update/delete) — out of scope (`00-spec.md:30`, `be-apply-fav` ticket). Seed is read-only.
- `app.ts` beyond adding the single `/jobs` mount line — do not reorder or touch `errorMiddleware`.

## Risks & unknowns

- **R7 — `req.query` reassignment (RESOLVED, non-blocking).** Installed Express is **4.22.2** (`node_modules/.pnpm/express@4.22.2/...`, confirmed via lockfile + `pnpm why`), not Express 5. In Express 4 `req.query` is a plain writable own property, so `validate`'s `req[part] = result.data` (`validation.middleware.ts:36`) succeeds — the coerced query object is assigned back and reaches the handler. (In Express 5 `req.query` is a getter and this would throw; not our case.) **Wiring for R7:** define `JobQuerySchema` in `jobs.schema.ts` with `z.coerce.number()` for `salary_min/salary_max/page/limit`, the same `sort` enum (`.default('date_desc')`), and pass it to `validate({ query })`. The handler then reads `req.query` already typed/coerced. Do not add manual `Number()` parsing in the router; do not re-validate against the shared `JobFiltersSchema` (its plain `z.number()` would reject string input before coercion).
- **Seed volume / realism (RESOLVED, non-blocking).** No existing seed file — greenfield, fully in our control. ≥90 rows with `limit=20` → 5 pages (`ceil(90/20)=5 ≥ 4`), R1 satisfied. Realistic Mexico-market city set (matches OCC context): `Ciudad de México, Guadalajara, Monterrey, Puebla, Querétaro, Tijuana, Mérida, León, Cancún, Remoto`. Realistic tag set: `react, react-native, typescript, node, javascript, remoto, hibrido, presencial, senior, junior, mid, mobile, backend, frontend, fullstack`. Include a subset (~15-20%) with `salary: null` to exercise R5's null-exclusion, and spread `publishedAt` across distinct dates so date sorts and the `relevance` tiebreak are testable.
- **`relevance` semantics (RESOLVED in spec).** Decision #2 (`00-spec.md:22,39`): with `q` present, title-match ranks above company-match, `publishedAt` desc tiebreak; with `q` absent, `relevance` behaves as `date_desc`. Plan must encode this as a scoring comparator, not a naive string sort.
- **No blocking ambiguities found.** All three spec open-questions were pre-resolved and confirmed against the codebase.

## Handoff to PLAN

- Build `backend/src/domains/jobs/{jobs.schema,jobs.seed,jobs.service,jobs.router}.ts` + `__tests__/`, cloning the `auth` domain shape (`auth.router.ts:14-24`, `auth.service.ts:1-58`, `auth.schema.ts:1-17`) — router-only Express, pure service, tests in `__tests__/` with supertest.
- R7 is settled: Express **4.22.2**, so `validate({ query })` (`validation.middleware.ts:36`) can reassign `req.query`. Define a backend-only `JobQuerySchema` with `z.coerce.number()` (precedent: `env.ts:15`) mirroring `JobFiltersSchema`'s enum/defaults; do **not** touch `@occ/shared`.
- Service owns filter→sort→paginate + `getById` (throws `AppError('NOT_FOUND')`, `errors.ts:16`); use a typed `Record<SortMode, comparator>` to respect complexity ≤10 (`.eslintrc.js:26`) and avoid the `detect-object-injection` warning.
- Mount `app.use('/jobs', jobsRouter)` at the `app.ts:22` placeholder, before `errorMiddleware` (`app.ts:27`), with **no** `authMiddleware` (public).
- Seed ≥90 rows (5 pages at `limit=20`), ~15-20% `salary:null`, varied ISO `publishedAt`, using the Mexico city/tag sets above — satisfies R1 and feeds R5's null-exclusion and R6's date/relevance tests.
- Tests: mirror `auth.router.test.ts` (parse `JobListResponseSchema`/`JobDetailResponseSchema`, assert `ApiErrorSchema.error.code` for 422/404) plus service unit tests for every filter/sort/pagination-boundary and the 404 (R10).
