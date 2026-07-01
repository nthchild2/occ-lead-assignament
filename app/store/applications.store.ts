import type { Application, Job } from '@occ/shared'
import { create } from 'zustand'

import * as applicationsService from '../core/services/applications.service'
import { ApiError } from '../core/services/api'

interface ApplicationsStore {
  items: Application[]
  isLoading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (jobId: string, job: Job) => Promise<void>
  remove: (jobId: string) => Promise<void>
  reset: () => void
}

const GENERIC_ERROR_MESSAGE = 'No se pudo completar la operación.'

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return GENERIC_ERROR_MESSAGE
}

// Plain, non-persisted store (no `persist` middleware) — per A2 Decision 1,
// only `auth.store` is persisted. Mirrors `jobs.store.ts`'s plain-store shape
// and `auth.store.ts`'s "actions call the service inline" precedent (spec R5
// requires `fetch`/`add`/`remove` on the store itself, not a separate hook).
export const useApplicationsStore = create<ApplicationsStore>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,
  fetch: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await applicationsService.list()
      set({ items: result.data.items })
    } catch (error) {
      set({ error: messageFor(error) })
    } finally {
      set({ isLoading: false })
    }
  },
  add: async (jobId, job) => {
    // Optimistic: synthesize a client-side `appliedAt` so the item renders
    // immediately, no round trip. Reconciled with the server's `Application`
    // (including its authoritative `appliedAt`) on success.
    const optimistic: Application = { jobId, appliedAt: new Date().toISOString(), job }
    set((s) => ({ items: [...s.items, optimistic], error: null }))

    try {
      const result = await applicationsService.apply(jobId)
      set((s) => ({
        items: s.items.map((item) => (item.jobId === jobId ? result.data : item)),
      }))
    } catch (error) {
      set((s) => ({
        items: s.items.filter((item) => item.jobId !== jobId),
        error: messageFor(error),
      }))
      throw error
    }
  },
  remove: async (jobId) => {
    const removed = get().items.find((item) => item.jobId === jobId)
    set((s) => ({ items: s.items.filter((item) => item.jobId !== jobId), error: null }))

    try {
      await applicationsService.cancel(jobId)
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
