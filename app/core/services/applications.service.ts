import type { ApplicationListResponse } from '@occ/shared'
import { ApplicationListResponseSchema, ApplicationSchema } from '@occ/shared'
import { z } from 'zod'

import { del, get, post } from './api'

// `POST/DELETE /jobs/:id/apply`'s response envelopes are not part of
// `@occ/shared` (only the list envelope — `ApplicationListResponseSchema` — is
// shared). Minimal local schemas are defined here, mirroring the
// `LogoutResponseSchema` precedent in `auth.service.ts:7-10`. Confirmed against
// `backend/src/domains/applications/applications.router.ts`: `POST /:id/apply`
// returns `{ data: Application }`, `DELETE /:id/apply` returns
// `{ data: { message: string } }`.
const ApplyResponseSchema = z.object({ data: ApplicationSchema })
const MessageResponseSchema = z.object({ data: z.object({ message: z.string() }) })

export function apply(jobId: string): Promise<z.infer<typeof ApplyResponseSchema>> {
  return post(`/jobs/${jobId}/apply`, ApplyResponseSchema, undefined, true)
}

export function cancel(jobId: string): Promise<z.infer<typeof MessageResponseSchema>> {
  return del(`/jobs/${jobId}/apply`, MessageResponseSchema, true)
}

export function list(): Promise<ApplicationListResponse> {
  return get('/applications', ApplicationListResponseSchema, true)
}
