import { AppError } from '../../lib/errors'
import type { Job } from '@occ/shared'

/**
 * Favorites domain logic — Express-free by design (A1 Decision 4). Job
 * existence/lookup is received via dependency injection (`getJob`), never by
 * importing `domains/jobs` directly, so the favorites domain stays decoupled
 * from the jobs domain (A1 Decision 3 / spec R9).
 */

export interface FavoritesDeps {
  getJob: (id: string) => Job
}

/**
 * Per-user favorited job ids. Module-level so it persists for the process
 * lifetime (in-memory only — A1 Decision 5 sanctioned tech debt). Only ids are
 * stored; the job object is re-fetched via `getJob` at list time so the list
 * always reflects the current job data, consistent with the jobs domain being
 * the source of truth.
 */
const favoritesByUser = new Map<string, Set<string>>()

const favoritesFor = (userId: string): Set<string> => {
  const existing = favoritesByUser.get(userId)
  if (existing) return existing

  const created = new Set<string>()
  favoritesByUser.set(userId, created)
  return created
}

/**
 * Build the favorites service. `getJob` is called first in `favorite` so a
 * missing job surfaces its own `AppError('NOT_FOUND')` for free.
 */
export const createFavoritesService = ({ getJob }: FavoritesDeps) => ({
  /**
   * Favorite `jobId` for `userId`. Throws `NOT_FOUND` (via `getJob`) if the job
   * doesn't exist, or `ALREADY_FAVORITED` if it's already favorited.
   */
  favorite: (userId: string, jobId: string): void => {
    getJob(jobId)
    const favorites = favoritesFor(userId)

    if (favorites.has(jobId)) {
      throw new AppError('ALREADY_FAVORITED', `La vacante ${jobId} ya está en favoritos`)
    }

    favorites.add(jobId)
  },

  /** Remove an existing favorite. Throws `NOT_FOUND` if it isn't favorited. */
  unfavorite: (userId: string, jobId: string): void => {
    const favorites = favoritesFor(userId)
    if (!favorites.has(jobId)) {
      throw new AppError('NOT_FOUND', `La vacante ${jobId} no está en favoritos`)
    }
    favorites.delete(jobId)
  },

  /** List the current user's favorited jobs (empty list if none). */
  list: (userId: string): { items: Job[] } => ({
    items: Array.from(favoritesFor(userId)).map((jobId) => getJob(jobId)),
  }),
})

export type FavoritesService = ReturnType<typeof createFavoritesService>
