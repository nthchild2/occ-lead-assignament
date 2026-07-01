import * as jobsService from '../services/jobs.service'
import { ApiError } from '../services/api'
import { useJobsStore } from '../../store/jobs.store'

interface UseJobsResult {
  fetchPage: (page: number) => Promise<void>
  fetchNextPage: () => Promise<void>
  refetch: () => Promise<void>
}

const GENERIC_ERROR_MESSAGE = 'No se pudo cargar la lista de empleos.'

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return GENERIC_ERROR_MESSAGE
}

/**
 * Owns all async orchestration for the jobs list (no `fetch`/`axios` in the
 * store, per `docs/MAP.md`). Subscribes to nothing directly for its actions —
 * imperative reads use `useJobsStore.getState()` inside the async functions
 * so they never close over stale `filters`/`pagination`, mirroring the
 * `getState()`-at-call-time idiom in `app/store/auth.store.ts`.
 */
export function useJobs(): UseJobsResult {
  const fetchPage = async (page: number): Promise<void> => {
    const { filters, appendJobs, setLoading, setError } = useJobsStore.getState()
    setLoading(true)
    setError(null)
    try {
      const result = await jobsService.list({ ...filters, page })
      appendJobs(result.data.items, result.data.pagination)
    } catch (error) {
      // Deliberately does not touch `jobs`/`pagination` — a failed page
      // fetch must not discard already-accumulated results (R8).
      setError(messageFor(error))
    } finally {
      setLoading(false)
    }
  }

  const fetchNextPage = async (): Promise<void> => {
    const { pagination, isLoading } = useJobsStore.getState()
    if (!pagination.hasNext || isLoading) return
    await fetchPage(pagination.page + 1)
  }

  const refetch = async (): Promise<void> => {
    useJobsStore.getState().resetList()
    await fetchPage(1)
  }

  return { fetchPage, fetchNextPage, refetch }
}
