import type { Job } from '@occ/shared'
import { create } from 'zustand'

import * as favoritesService from '../core/services/favorites.service'
import { ApiError } from '../core/services/api'

interface FavoritesStore {
  items: Job[]
  isLoading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (job: Job) => Promise<void>
  remove: (jobId: string) => Promise<void>
  reset: () => void
}

const GENERIC_ERROR_MESSAGE = 'No se pudo completar la operación.'

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return GENERIC_ERROR_MESSAGE
}

// Mirrors `applications.store.ts` exactly (same plain, non-persisted shape
// and optimistic add/remove-with-rollback pattern) — `items` is `Job[]`
// directly since favorites carry no extra wrapper metadata.
export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  fetch: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await favoritesService.list()
      set({ items: result.data.items })
    } catch (error) {
      set({ error: messageFor(error) })
    } finally {
      set({ isLoading: false })
    }
  },
  add: async (job) => {
    // Optimistic: push the full `Job` immediately — no synthesis needed
    // since favorites don't carry extra metadata like `appliedAt`.
    set((s) => ({ items: [...s.items, job], error: null }))

    try {
      await favoritesService.favorite(job.id)
    } catch (error) {
      set((s) => ({
        items: s.items.filter((item) => item.id !== job.id),
        error: messageFor(error),
      }))
      throw error
    }
  },
  remove: async (jobId) => {
    const removed = get().items.find((item) => item.id === jobId)
    set((s) => ({ items: s.items.filter((item) => item.id !== jobId), error: null }))

    try {
      await favoritesService.unfavorite(jobId)
    } catch (error) {
      if (removed) {
        set((s) => ({ items: [...s.items, removed], error: messageFor(error) }))
      } else {
        set({ error: messageFor(error) })
      }
      throw error
    }
  },
  reset: () => {
    set({ items: [], isLoading: false, error: null })
  },
}))
