import type { Job } from '@occ/shared'

import { useFavoritesStore } from './favorites.store'
import { configureApi } from '../core/services/api'

// Mirrors `applications.store.test.ts` — mocks `global.fetch` directly, plain
// `getState()` calls (no `renderHook`), `Job`-keyed items instead of
// `Application`-keyed items.

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

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  configureApi({ getToken: () => 'tok' })
  useFavoritesStore.setState({ items: [], isLoading: false, error: null })
})

describe('favorites.store', () => {
  it('fetch() populates items from the service on success (R4, R5)', async () => {
    const items = [job('pre-1')]
    mockResponseOnce(200, { data: { items } })

    await useFavoritesStore.getState().fetch()

    expect(useFavoritesStore.getState().items).toEqual(items)
    expect(useFavoritesStore.getState().isLoading).toBe(false)
    expect(useFavoritesStore.getState().error).toBeNull()
  })

  it('fetch() failure sets error and leaves items at their pre-call value (R4, R5)', async () => {
    const preExisting = [job('pre-1')]
    useFavoritesStore.setState({ items: preExisting })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await useFavoritesStore.getState().fetch()

    expect(useFavoritesStore.getState().items).toEqual(preExisting)
    expect(useFavoritesStore.getState().error).not.toBeNull()
    expect(useFavoritesStore.getState().isLoading).toBe(false)
  })

  it('add() success leaves the optimistically-added job in items alongside the pre-existing one (R5)', async () => {
    const preJob = job('pre-1')
    useFavoritesStore.setState({ items: [preJob] })
    const newJob = job('job-2')
    mockResponseOnce(200, { data: { message: 'Vacante agregada a favoritos' } })

    await useFavoritesStore.getState().add(newJob)

    expect(useFavoritesStore.getState().items).toEqual([preJob, newJob])
  })

  it('add() rollback on failure restores exactly the pre-mutation items and sets error (R5)', async () => {
    const preJob = job('pre-1')
    useFavoritesStore.setState({ items: [preJob] })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await expect(useFavoritesStore.getState().add(job('job-3'))).rejects.toThrow()

    expect(useFavoritesStore.getState().items).toEqual([preJob])
    expect(useFavoritesStore.getState().error).not.toBeNull()
  })

  it('remove() success leaves only the other pre-existing job (R5)', async () => {
    const keep = job('keep-1')
    const toRemove = job('remove-1')
    useFavoritesStore.setState({ items: [keep, toRemove] })
    mockResponseOnce(200, { data: { message: 'Vacante eliminada de favoritos' } })

    await useFavoritesStore.getState().remove('remove-1')

    expect(useFavoritesStore.getState().items).toEqual([keep])
  })

  it('remove() rollback on failure restores exactly the original two-item array and sets error (R5)', async () => {
    const keep = job('keep-1')
    const toRemove = job('remove-1')
    useFavoritesStore.setState({ items: [keep, toRemove] })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await expect(useFavoritesStore.getState().remove('remove-1')).rejects.toThrow()

    expect(useFavoritesStore.getState().items).toEqual([keep, toRemove])
    expect(useFavoritesStore.getState().error).not.toBeNull()
  })

  it('reset() clears a seeded non-empty/error/loading state back to initial (R7)', () => {
    useFavoritesStore.setState({
      items: [job('pre-1')],
      isLoading: true,
      error: 'some error',
    })

    useFavoritesStore.getState().reset()

    expect(useFavoritesStore.getState()).toMatchObject({
      items: [],
      isLoading: false,
      error: null,
    })
  })
})
