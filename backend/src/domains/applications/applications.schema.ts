import { z } from 'zod'
import type { Application, ApplicationListResponse } from '@occ/shared'

/**
 * Applications-domain-internal types + request schemas.
 *
 * The wire contract (`Application`, `ApplicationListResponse`) is owned by
 * `@occ/shared` (A1 Decision 1) and re-exported here so the service/router refer
 * to a single symbol.
 *
 * `JobIdParamsSchema` is a **backend-only** request parser for the `:id` path
 * param shared by `POST/DELETE /jobs/:id/apply` (mirrors `jobs.schema.ts:38-40`
 * `JobParamsSchema`) — kept local to this domain rather than imported from
 * `jobs.schema.ts` to preserve the no-cross-domain-import boundary (A1 Decision 3).
 */
export type { Application, ApplicationListResponse }

/** Backend-only parser for the `:id` path param on the apply/cancel routes. */
export const JobIdParamsSchema = z.object({
  id: z.string(),
})
