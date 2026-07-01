import type { Job, Pagination } from '@occ/shared'

import { useJobsStore } from './jobs.store'

// Plain-reducer style, mirroring `app/store/theme.store.test.ts`: state is
// asserted directly via `getState()`, no `renderHook`.

const initialFilters = { sort: 'date_desc' as const, page: 1, limit: 20 }
const initialPagination: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  hasNext: false,
  hasPrev: false,
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

beforeEach(() => {
  useJobsStore.setState({
    jobs: [],
    filters: initialFilters,
    pagination: initialPagination,
    isLoading: false,
    error: null,
    activeJobId: null,
    activeJobIndex: null,
    flashListRef: null,
  })
})

describe('jobs.store', () => {
  it('appendJobs accumulates across two calls and updates pagination (R3)', () => {
    const page1 = [makeJob('1'), makeJob('2')]
    const pagination1: Pagination = { page: 1, limit: 2, total: 4, hasNext: true, hasPrev: false }
    useJobsStore.getState().appendJobs(page1, pagination1)

    expect(useJobsStore.getState().jobs).toEqual(page1)
    expect(useJobsStore.getState().pagination).toEqual(pagination1)

    const page2 = [makeJob('3'), makeJob('4')]
    const pagination2: Pagination = { page: 2, limit: 2, total: 4, hasNext: false, hasPrev: true }
    useJobsStore.getState().appendJobs(page2, pagination2)

    expect(useJobsStore.getState().jobs).toEqual([...page1, ...page2])
    expect(useJobsStore.getState().pagination).toEqual(pagination2)
  })

  it('resetList clears jobs and resets pagination/isLoading/error but leaves filters untouched (R4)', () => {
    const customFilters = { ...initialFilters, city: 'Monterrey' }
    useJobsStore.setState({
      jobs: [makeJob('1')],
      filters: customFilters,
      pagination: { page: 2, limit: 20, total: 40, hasNext: true, hasPrev: true },
      isLoading: true,
      error: 'boom',
    })

    useJobsStore.getState().resetList()

    expect(useJobsStore.getState().jobs).toEqual([])
    expect(useJobsStore.getState().pagination).toEqual(initialPagination)
    expect(useJobsStore.getState().isLoading).toBe(false)
    expect(useJobsStore.getState().error).toBeNull()
    // filters must NOT be touched by resetList
    expect(useJobsStore.getState().filters).toEqual(customFilters)
  })

  it('setFilters merges only the given keys (R5)', () => {
    useJobsStore.setState({ jobs: [makeJob('1')] })

    useJobsStore.getState().setFilters({ city: 'Guadalajara' })

    expect(useJobsStore.getState().filters).toEqual({ ...initialFilters, city: 'Guadalajara' })
    // no side effects on jobs
    expect(useJobsStore.getState().jobs).toEqual([makeJob('1')])

    useJobsStore.getState().setFilters({ q: 'developer' })

    expect(useJobsStore.getState().filters).toEqual({
      ...initialFilters,
      city: 'Guadalajara',
      q: 'developer',
    })
  })

  it('setActiveJob/clearActiveJob round-trip correctly (R2)', () => {
    useJobsStore.getState().setActiveJob('job-9', 3)

    expect(useJobsStore.getState().activeJobId).toBe('job-9')
    expect(useJobsStore.getState().activeJobIndex).toBe(3)

    useJobsStore.getState().clearActiveJob()

    expect(useJobsStore.getState().activeJobId).toBeNull()
    expect(useJobsStore.getState().activeJobIndex).toBeNull()
  })

  it('setFlashListRef stores the given ref object and leaves other fields untouched (R7)', () => {
    useJobsStore.setState({ jobs: [makeJob('1')], activeJobId: 'job-9', activeJobIndex: 3 })

    const ref = { current: null }
    useJobsStore.getState().setFlashListRef(ref)

    expect(useJobsStore.getState().flashListRef).toBe(ref)
    // No side effects on unrelated fields.
    expect(useJobsStore.getState().jobs).toEqual([makeJob('1')])
    expect(useJobsStore.getState().activeJobId).toBe('job-9')
    expect(useJobsStore.getState().activeJobIndex).toBe(3)
  })
})
