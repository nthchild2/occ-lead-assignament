import type { Job, JobFilters, Pagination } from '@occ/shared'
import type { FlashListRef } from '@shopify/flash-list'
import type React from 'react'
import { create } from 'zustand'

interface JobsStore {
  jobs: Job[]
  filters: JobFilters
  pagination: Pagination
  isLoading: boolean
  error: string | null
  activeJobId: string | null
  activeJobIndex: number | null
  // Cross-tree handle to `job-search-screen`'s FlashList (R7) — set once by
  // `index.tsx` on mount, read imperatively by `(protected)/_layout.tsx`'s
  // `onDismiss`. Non-serializable (a React ref object): this store has no
  // `persist` middleware today (A2 Decision 1 — only `auth.store` persists),
  // and this field must NEVER be added to a future `persist`/`partialize`
  // config if one is introduced.
  flashListRef: React.RefObject<FlashListRef<Job>> | null
  setFilters: (partial: Partial<JobFilters>) => void
  appendJobs: (newJobs: Job[], pagination: Pagination) => void
  resetList: () => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setActiveJob: (id: string, index: number) => void
  clearActiveJob: () => void
  setFlashListRef: (ref: React.RefObject<FlashListRef<Job>>) => void
}

const initialPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  hasNext: false,
  hasPrev: false,
}

// Matches `JobFiltersSchema`'s own `.default()` values — a plain in-memory
// object has no runtime defaults, so they're seeded explicitly here.
const initialFilters: JobFilters = {
  sort: 'date_desc',
  page: 1,
  limit: 20,
}

// Plain, non-persisted store (no `persist` middleware) — per A2 Decision 1,
// only `auth.store` is persisted; jobs list state resets on launch. Mirrors
// the non-curried `create<T>((set, get) => ({...}))` shape of
// `app/store/theme.store.ts`.
export const useJobsStore = create<JobsStore>((set, get) => ({
  jobs: [],
  filters: initialFilters,
  pagination: initialPagination,
  isLoading: false,
  error: null,
  activeJobId: null,
  activeJobIndex: null,
  flashListRef: null,
  setFilters: (partial) => {
    set({ filters: { ...get().filters, ...partial } })
  },
  appendJobs: (newJobs, pagination) => {
    set((s) => ({ jobs: [...s.jobs, ...newJobs], pagination }))
  },
  resetList: () => {
    set({ jobs: [], pagination: initialPagination, isLoading: false, error: null })
  },
  setLoading: (isLoading) => {
    set({ isLoading })
  },
  setError: (error) => {
    set({ error })
  },
  setActiveJob: (id, index) => {
    set({ activeJobId: id, activeJobIndex: index })
  },
  clearActiveJob: () => {
    set({ activeJobId: null, activeJobIndex: null })
  },
  setFlashListRef: (ref) => {
    set({ flashListRef: ref })
  },
}))
