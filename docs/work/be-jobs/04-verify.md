# Verification Report · be-jobs

- **Feature id:** `be-jobs`
- **Inputs read:** `00-spec.md`, `01-research.md`, `02-plan.md`, `03-impl-report.md`
- **Verifier:** verifier subagent (fresh context, independent of implementer)
- **Date:** 2026-07-01
- **Result:** ✅ PASS

## 1 · Coverage matrix

Cross-referenced the R1–R10 ledger against the **actual source** (`backend/src/domains/jobs/*`, `backend/src/app.ts`), not the impl-report's claims.

| R-id | Priority | Has change? | Notes (verified against source)                                                                                                                                                                                                    |
| ---- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | must     | ✅          | `jobs.seed.ts` — 96 rows (`job-01`..`job-96`), 17 `salary: null`, 96 distinct ISO `publishedAt`, 10 MX cities. `ceil(96/20)=5 ≥ 4` pages. (counts verified by script.)                                                             |
| R2   | must     | ✅          | `jobs.service.ts` `paginate` computes `total`/`hasNext`/`hasPrev`; `list` returns `{items,pagination}`; router wraps in `success` → `{data:{…}}`. Router test parses body through `JobListResponseSchema`.                         |
| R3   | must     | ✅          | `matchesQuery` = `contains(title)                                                                                                                                                                                                  |     | contains(company)`, both lowercased (case-insensitive substring). |
| R4   | must     | ✅          | `matchesCity` = `job.city.toLowerCase() === city.toLowerCase()` (case-insensitive exact).                                                                                                                                          |
| R5   | must     | ✅          | `matchesSalary`: returns `true` when both bounds absent; when either present, `salary === null` → excluded, then range applied. Mutation-tested (see §Findings).                                                                   |
| R6   | must     | ✅          | `comparatorFor` typed `Record<SortMode, Comparator>`; 5 modes. `relevance` = title(2)>company(1)>none(0) desc, `byDateDesc` tiebreak, `date_desc` fallback when `q` absent. Mutation-tested.                                       |
| R7   | must     | ✅          | `JobQuerySchema` (`z.coerce.number()` on salary/page/limit; `page`/`limit` add `.int().positive()`); `validate({query})` coerces + reassigns `req.query`; bad `page`/`sort` → 422. Router tests assert 422 and coerced page/limit. |
| R8   | must     | ✅          | `getById` returns job or throws `AppError('NOT_FOUND')` (→404). Router `GET /:id` uses `success`; unknown id test asserts 404 `NOT_FOUND`.                                                                                         |
| R9   | must     | ✅          | `app.ts:23` `app.use('/jobs', jobsRouter)` — mounted before `errorMiddleware` (line 28), no `authMiddleware`. Router imports no auth middleware.                                                                                   |
| R10  | must     | ✅          | `__tests__/jobs.service.test.ts` (filters incl. null-exclusion, all 5 sorts, pagination boundaries, `getById` 404, seed integrity) + `__tests__/jobs.router.test.ts` (200/422/404 wire shapes).                                    |

- [x] **No gaps** — every `must` requirement has ≥1 real change in source.
- [x] **No orphans** — every source file traces to a requirement: `jobs.schema.ts`→R7, `jobs.seed.ts`→R1, `jobs.service.ts`→R2–R6/R8, `jobs.router.ts`→R2/R7/R8/R9, `app.ts` mount→R9, both test files→R10. No scope creep.
- [x] **Out-of-scope items NOT implemented** — `@occ/shared` untouched (`git status` clean on `packages/`); no cross-domain imports from `jobs/` (grep clean); no apply/favorites; no job mutation (`source: readonly Job[]`, no push/splice/create/update/delete).

## 2 · Citation spot-check

Opened each cited `path:line` and confirmed it says what the doc claims (relevance, not just existence).

| Cited claim                                                                                                                                 | `path:line`                                             | Holds up?                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `JobSchema` shape: `salary` nullable, `publishedAt` datetime string, `tags[]`                                                               | `packages/shared/src/schemas/job.schema.ts:3-12`        | ✅ Exactly this shape; `salary: z.number().nullable()`, `publishedAt: z.string().datetime()`.                  |
| `JobFiltersSchema` types salary/page/limit as plain `z.number()` + 5-value `sort` enum default `date_desc`; page 1 / limit 20               | `packages/shared/src/schemas/job.schema.ts:22-33`       | ✅ Confirms why it can't parse string query values (motivates the backend-only coercion schema).               |
| `validate` `safeParse`s each part, reassigns `req[part]=result.data` on success (line 36), throws `AppError('VALIDATION_ERROR')` on failure | `backend/src/middleware/validation.middleware.ts:24-41` | ✅ Reassignment at line 36, throw at line 33 — this is the R7 coercion + 422 wiring.                           |
| `z.coerce.number()` is the established repo idiom                                                                                           | `backend/src/config/env.ts:14-19`                       | ✅ `PORT: z.coerce.number().int().positive().default(3000)` — the exact idiom `JobQuerySchema` reuses.         |
| `AppError('NOT_FOUND')` → 404; typed `Record` indexing precedent (`ERROR_STATUS[code]`)                                                     | `backend/src/lib/errors.ts:12-40`                       | ✅ `NOT_FOUND: 404`; `status = ERROR_STATUS[code]` narrowed-key access, the precedent for `comparators[sort]`. |
| Router pattern to mirror: `Router()` + `validate` + thin handler + `success`, only Express file                                             | `backend/src/domains/auth/auth.router.ts:14-24`         | ✅ `jobs.router.ts` mirrors it (minus `authMiddleware`, which auth uses on `/me` `/logout`).                   |

All sampled citations hold.

## 3 · Tooling gate

Run in a clean shell with `env -u JWT_SECRET` (no shell `JWT_SECRET`; `jest.setup.ts` supplies it for tests, `env.ts` defaults the rest).

| Check           | Command                                                | Result                                                                            |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Types (backend) | `pnpm --filter './backend' run typecheck`              | ✅ clean (`tsc --noEmit`, no output)                                              |
| Lint            | `pnpm lint`                                            | ✅ **0 errors**, 12 warnings (all `security/detect-object-injection`, warn-level) |
| Tests           | `env -u JWT_SECRET pnpm --filter './backend' run test` | ✅ 7 suites / 52 tests passed                                                     |

**Lint detail:** all 12 warnings are `security/detect-object-injection` (warn-level on `backend/**` per `.eslintrc.js`), including `jobs.service.ts:82` (`comparators[sort]` — the typed `Record<SortMode,Comparator>` keyed by the narrowed enum, matching the `errors.ts:38` precedent) and array-index reads in the tests. Not gate failures. **0 errors.**

**Tests detail:**

```
Test Suites: 7 passed, 7 total
Tests:       52 passed, 52 total
Time:        0.877 s
```

The `AppError: Expected number, received nan` line in the log is the error-middleware log for the intentional `page=abc` → 422 test, not a failure.

### Reality checks (verified, not taken on faith)

- **Seed (R1):** script count → 96 rows, 17 `salary: null`, 96 distinct `publishedAt`, `ceil(96/20)=5` pages (≥4). ✅
- **R7 bad query → 422 + coercion:** `jobs.router.test.ts` asserts `page=abc` → 422 `VALIDATION_ERROR`, `sort=not-a-sort` → 422, and `page=2&limit=10` arrive coerced (`pagination.page===2`, `limit===10`). All green. ✅
- **No `any` / `!`:** grep of the four source files finds no `any` and no non-null assertion — the only `!` is `if (!job)` (boolean negation) in `getById`. Sort dispatch is a typed record, not dynamic string indexing that would error. ✅
- **Mutation tests (reverted after):**
  - Broke null-exclusion (`return false`→`return true`) → both R5 `salary_min`/`salary_max` tests **failed**. ✅ teeth confirmed.
  - Broke relevance tiebreak (`byDateDesc`→`byDateAsc`) → "breaks ties by publishedAt desc" test **failed**. ✅
  - Swapped `date_desc`↔`date_asc` comparators → both date-sort tests + relevance-fallback test **failed**. ✅
  - `jobs.service.ts` restored byte-identical to the pre-mutation backup (`diff` clean); no source left modified.

## Findings

- **Test-strength gap (non-blocking, worth a reviewer note).** The "relevance ranks title matches above company matches" test uses `q='engineer'`. Because `applyFilters` removes every job that matches neither title nor company _before_ the relevance comparator runs, and the seed has **zero** company-only "engineer" matches, all surviving rows have score 2. The score-difference term is therefore always 0 and the ordering is decided entirely by the tiebreak — so a mutation that **swapped the relevance direction** (`b-a`→`a-b`) did **not** fail any test. The service logic is correct (verified by reading it), but this specific assertion cannot distinguish a title-over-company regression. Recommendation for a follow-up: pick a `q` that yields both title-match and company-match rows (e.g. a token that appears in a company name but not the title of some rows), or unit-test `relevanceScore` directly. This is a coverage-depth observation, not a gate failure.
- **Cosmetic count drift.** Seed comment and impl-report say "16 rows (~17%)" null-salary; there are actually **17**. No impact on any requirement (R5 only needs ≥1 null and ≥1 priced, both satisfied).
- **`app.ts` diff-vs-HEAD is larger than the plan's "one line."** It also uncomments the `/auth` mount, adds the `authRouter` import, and wraps `listen`/SIGTERM in `if (NODE_ENV !== 'test')`. These belong to the **prior be-auth ticket** (both tickets are uncommitted on this branch), not to be-jobs. The be-jobs delta is exactly the `jobsRouter` import + `/jobs` mount before `errorMiddleware`, no `authMiddleware` — R9 as specified.
- **Deviation from plan (accepted).** `JobQuerySchema` adds `.int().positive()` to `page`/`limit` (impl-report §Deviations). This is a tightening within the backend-only schema that makes `page=abc`→`NaN` reliably fail (R7); no `@occ/shared` edit. Sound.

## Verdict

- ✅ **PASS** → ready for human PR review. Coverage complete (R1–R10, no gaps/orphans), out-of-scope items untouched, all sampled citations hold, and `tsc` + `eslint` (0 errors) + `jest` (52/52) are green in a clean shell without a shell `JWT_SECRET`. Mutation-tested R5/R6 assertions have teeth.

**Reviewer summary:** Read-only jobs domain — 96-row in-memory seed, public `GET /jobs` (paginated/filtered/sorted, 5 sort modes incl. `relevance`) and `GET /jobs/:id` (404), mounted public before `errorMiddleware`. Express-free service owns all filter→sort→paginate + `getById`; query coercion lives in a backend-only `JobQuerySchema` (`@occ/shared` untouched). **Look first at** the relevance test's `q='engineer'` choice — the service is correct but that one assertion can't catch a title-vs-company regression because filtering removes non-matches (see Findings); consider strengthening it in a follow-up. Everything else is solid.
