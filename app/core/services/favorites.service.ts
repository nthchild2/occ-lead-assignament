import type { FavoriteListResponse } from '@occ/shared'
import { FavoriteListResponseSchema } from '@occ/shared'
import { z } from 'zod'

import { del, get, post } from './api'

// `POST/DELETE /jobs/:id/favorite`'s response envelopes are not part of
// `@occ/shared` (only the list envelope — `FavoriteListResponseSchema` — is
// shared). Mirrors the local-schema precedent in `applications.service.ts`
// and `auth.service.ts:7-10`; duplicated per-file rather than sharing a
// cross-service util module (no requirement asks for one). Confirmed against
// `backend/src/domains/favorites/favorites.router.ts`: both
// `POST /:id/favorite` and `DELETE /:id/favorite` return
// `{ data: { message: string } }`.
const MessageResponseSchema = z.object({ data: z.object({ message: z.string() }) })

export function favorite(jobId: string): Promise<z.infer<typeof MessageResponseSchema>> {
  return post(`/jobs/${jobId}/favorite`, MessageResponseSchema, undefined, true)
}

export function unfavorite(jobId: string): Promise<z.infer<typeof MessageResponseSchema>> {
  return del(`/jobs/${jobId}/favorite`, MessageResponseSchema, true)
}

export function list(): Promise<FavoriteListResponse> {
  return get('/favorites', FavoriteListResponseSchema, true)
}
