import type { Application, Job } from '@occ/shared'

import { useApplicationsStore } from './applications.store'
import { configureApi } from '../core/services/api'

// Same convention as `app/store/auth.store.test.ts`: mock `global.fetch`
// directly so the store tests exercise the real service -> api-client wire
// path end to end, not `renderHook` (no React involved — plain `getState()`
// calls on the vanilla Zustand store).

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

function job(id: string): Job {
  return {
    id,
    title: `Developer ${id}`,
    company: 'Acme',
    city: 'CDMX',
    salary: 20000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['react'],
  }
}

function application(jobId: string, appliedAt: string): Application {
  return { jobId, appliedAt, job: job(jobId) }
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  configureApi({ getToken: () => 'tok' })
  useApplicationsStore.setState({ items: [], isLoading: false, error: null })
})

describe('applications.store', () => {
  it('fetch() populates items from the service on success (R3, R5)', async () => {
    const items = [application('pre-1', '2026-06-01T00:00:00.000Z')]
    mockResponseOnce(200, { data: { items } })

    await useApplicationsStore.getState().fetch()

    expect(useApplicationsStore.getState().items).toEqual(items)
    expect(useApplicationsStore.getState().isLoading).toBe(false)
    expect(useApplicationsStore.getState().error).toBeNull()
  })

  it('fetch() failure sets error and leaves items at their pre-call value (R3, R5)', async () => {
    const preExisting = [application('pre-1', '2026-06-01T00:00:00.000Z')]
    useApplicationsStore.setState({ items: preExisting })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await useApplicationsStore.getState().fetch()

    expect(useApplicationsStore.getState().items).toEqual(preExisting)
    expect(useApplicationsStore.getState().error).not.toBeNull()
    expect(useApplicationsStore.getState().isLoading).toBe(false)
  })

  it('add() success reconciles the optimistic item with the server response, leaving prior items untouched (R5)', async () => {
    const preItem = application('pre-1', '2026-06-01T00:00:00.000Z')
    useApplicationsStore.setState({ items: [preItem] })
    const serverItem = application('job-2', '2026-07-01T12:00:00.000Z')
    mockResponseOnce(200, { data: serverItem })

    await useApplicationsStore.getState().add('job-2', job('job-2'))

    expect(useApplicationsStore.getState().items).toEqual([preItem, serverItem])
  })

  it('add() rollback on failure restores exactly the pre-mutation items and sets error (R5)', async () => {
    const preItem = application('pre-1', '2026-06-01T00:00:00.000Z')
    useApplicationsStore.setState({ items: [preItem] })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await expect(useApplicationsStore.getState().add('job-3', job('job-3'))).rejects.toThrow()

    expect(useApplicationsStore.getState().items).toEqual([preItem])
    expect(useApplicationsStore.getState().error).not.toBeNull()
  })

  it('remove() success leaves only the other pre-existing item (R5)', async () => {
    const keep = application('keep-1', '2026-06-01T00:00:00.000Z')
    const toRemove = application('remove-1', '2026-06-02T00:00:00.000Z')
    useApplicationsStore.setState({ items: [keep, toRemove] })
    mockResponseOnce(200, { data: { message: 'Postulación cancelada' } })

    await useApplicationsStore.getState().remove('remove-1')

    expect(useApplicationsStore.getState().items).toEqual([keep])
  })

  it('remove() rollback on failure restores exactly the original two-item array and sets error (R5)', async () => {
    const keep = application('keep-1', '2026-06-01T00:00:00.000Z')
    const toRemove = application('remove-1', '2026-06-02T00:00:00.000Z')
    useApplicationsStore.setState({ items: [keep, toRemove] })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await expect(useApplicationsStore.getState().remove('remove-1')).rejects.toThrow()

    expect(useApplicationsStore.getState().items).toEqual([keep, toRemove])
    expect(useApplicationsStore.getState().error).not.toBeNull()
  })

  it('reset() clears a seeded non-empty/error/loading state back to initial (R7)', () => {
    useApplicationsStore.setState({
      items: [application('pre-1', '2026-06-01T00:00:00.000Z')],
      isLoading: true,
      error: 'some error',
    })

    useApplicationsStore.getState().reset()

    expect(useApplicationsStore.getState()).toMatchObject({
      items: [],
      isLoading: false,
      error: null,
    })
  })
})
