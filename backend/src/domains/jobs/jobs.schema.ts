import { z } from 'zod'
import type { Job, JobFilters, Pagination, JobListResponse, JobDetailResponse } from '@occ/shared'

/**
 * Jobs-domain-internal types + request schemas.
 *
 * The wire contract (`Job`, `JobFilters`, `Pagination`, `JobListResponse`,
 * `JobDetailResponse`) is owned by `@occ/shared` (A1 Decision 1) and re-exported
 * here so the service/router/seed refer to a single symbol.
 *
 * `JobQuerySchema` is a **backend-only** request parser: Express delivers all
 * query values as strings, so the numeric filters use `z.coerce.number()`
 * (precedent: `config/env.ts`). The shared `JobFiltersSchema` types those fields
 * as plain `z.number()` and would reject raw string query values, so it cannot
 * serve as the request parser — we keep coercion here and never edit `@occ/shared`.
 * Enum values and defaults mirror `JobFiltersSchema` exactly.
 */
export type { Job, JobFilters, Pagination, JobListResponse, JobDetailResponse }

/** The five supported sort modes, derived from the shared filter enum. */
export type SortMode = NonNullable<JobFilters['sort']>

/** Backend-only parser for `GET /jobs` query params (coerces string → number). */
export const JobQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  salary_min: z.coerce.number().optional(),
  salary_max: z.coerce.number().optional(),
  sort: z
    .enum(['date_desc', 'date_asc', 'salary_desc', 'salary_asc', 'relevance'])
    .optional()
    .default('date_desc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
})

/** Backend-only parser for the `GET /jobs/:id` path param. */
export const JobParamsSchema = z.object({
  id: z.string(),
})
