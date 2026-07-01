import type { Job, Pagination } from '@occ/shared'
import { act, renderHook } from '@testing-library/react-native'

import { configureApi } from '../services/api'
import { useJobsStore } from '../../store/jobs.store'
import { useJobs } from './useJobs'

// Same convention as `app/core/services/api.test.ts` / `app/store/auth.store.test.ts`:
// mock `global.fetch` directly (not msw) so this exercises the real
// hook -> store -> service -> api-client wire path end to end. This is the
// spec-required "hook de búsqueda" unit test.

const BASE_URL = 'http://api.test'

const fetchMock = () => global.fetch as jest.MockedFunction<typeof fetch>

function mockResponseOnce(status: number, body: unknown): void {
  const ok = status >= 200 && status < 300
  fetchMock().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as Response)
}

function makeJob(id: string): Job {
  return {
    id,
    title: `Title ${id}`,
    company: 'Acme',
    city: 'CDMX',
    salary: 20000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
  }
}

const initialFilters = { sort: 'date_desc' as const, page: 1, limit: 20 }
const initialPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  hasNext: false,
  hasPrev: false,
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  configureApi({})
  useJobsStore.setState({
    jobs: [],
    filters: initialFilters,
    pagination: initialPagination,
    isLoading: false,
    error: null,
    activeJobId: null,
    activeJobIndex: null,
  })
})

describe('useJobs', () => {
  it('fetchPage success appends jobs and updates pagination (R6)', async () => {
    const items = [makeJob('1'), makeJob('2')]
    const pagination: Pagination = { page: 1, limit: 20, total: 2, hasNext: false, hasPrev: false }
    mockResponseOnce(200, { data: { items, pagination } })

    const { result } = renderHook(() => useJobs())

    await act(async () => {
      await result.current.fetchPage(1)
    })

    expect(useJobsStore.getState().jobs).toEqual(items)
    expect(useJobsStore.getState().pagination).toEqual(pagination)
    expect(useJobsStore.getState().isLoading).toBe(false)
    expect(useJobsStore.getState().error).toBeNull()
  })

  it('fetchPage failure sets error and leaves prior jobs untouched (R8)', async () => {
    // Seed the store with results from a prior successful fetch.
    const priorJobs = [makeJob('prior-1')]
    const priorPagination: Pagination = {
      page: 1,
      limit: 20,
      total: 5,
      hasNext: true,
      hasPrev: false,
    }
    useJobsStore.setState({ jobs: priorJobs, pagination: priorPagination })

    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    const { result } = renderHook(() => useJobs())

    await act(async () => {
      await result.current.fetchPage(2)
    })

    // Prior jobs/pagination must survive the failed fetch untouched (R8) —
    // asserted against the exact prior values, not merely "still an array",
    // so a reducer bug that clears/replaces them would fail this test.
    expect(useJobsStore.getState().jobs).toEqual(priorJobs)
    expect(useJobsStore.getState().pagination).toEqual(priorPagination)
    expect(useJobsStore.getState().error).toBe('Boom')
    expect(useJobsStore.getState().isLoading).toBe(false)
  })

  it('fetchNextPage no-ops when hasNext is false', async () => {
    useJobsStore.setState({
      jobs: [makeJob('1')],
      pagination: { page: 1, limit: 20, total: 1, hasNext: false, hasPrev: false },
    })

    const { result } = renderHook(() => useJobs())

    await act(async () => {
      await result.current.fetchNextPage()
    })

    expect(fetchMock()).not.toHaveBeenCalled()
    expect(useJobsStore.getState().jobs).toEqual([makeJob('1')])
  })

  it('fetchNextPage calls through (fetches page + 1) when hasNext is true', async () => {
    useJobsStore.setState({
      jobs: [makeJob('1')],
      pagination: { page: 1, limit: 20, total: 2, hasNext: true, hasPrev: false },
    })
    const nextItems = [makeJob('2')]
    const nextPagination: Pagination = {
      page: 2,
      limit: 20,
      total: 2,
      hasNext: false,
      hasPrev: true,
    }
    mockResponseOnce(200, { data: { items: nextItems, pagination: nextPagination } })

    const { result } = renderHook(() => useJobs())

    await act(async () => {
      await result.current.fetchNextPage()
    })

    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const requestUrl = fetchMock().mock.calls[0][0] as string
    expect(requestUrl).toContain('page=2')
    expect(useJobsStore.getState().jobs).toEqual([makeJob('1'), ...nextItems])
    expect(useJobsStore.getState().pagination).toEqual(nextPagination)
  })

  it('refetch clears then refetches page 1', async () => {
    useJobsStore.setState({
      jobs: [makeJob('stale')],
      pagination: { page: 3, limit: 20, total: 60, hasNext: true, hasPrev: true },
      error: 'old error',
    })
    const freshItems = [makeJob('fresh-1')]
    const freshPagination: Pagination = {
      page: 1,
      limit: 20,
      total: 1,
      hasNext: false,
      hasPrev: false,
    }
    mockResponseOnce(200, { data: { items: freshItems, pagination: freshPagination } })

    const { result } = renderHook(() => useJobs())

    await act(async () => {
      await result.current.refetch()
    })

    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const requestUrl = fetchMock().mock.calls[0][0] as string
    expect(requestUrl).toContain('page=1')
    // stale job must be gone, replaced only by the fresh page-1 fetch
    expect(useJobsStore.getState().jobs).toEqual(freshItems)
    expect(useJobsStore.getState().pagination).toEqual(freshPagination)
    expect(useJobsStore.getState().error).toBeNull()
  })
})
