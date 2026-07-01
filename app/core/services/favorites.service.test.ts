import * as favoritesService from './favorites.service'
import { configureApi } from './api'

// Mirrors `applications.service.test.ts` — mocks `global.fetch` directly and
// asserts the HTTP method/path/auth wiring plus the schema-parsed shape.

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

function lastRequest(): { url: string; init: RequestInit } {
  const calls = fetchMock().mock.calls
  const [url, init] = calls[calls.length - 1]
  return { url: url as string, init: init as RequestInit }
}

const job = {
  id: 'job-1',
  title: 'Developer',
  company: 'Acme',
  city: 'CDMX',
  salary: 20000,
  description: 'desc',
  publishedAt: '2026-01-01T00:00:00.000Z',
  tags: ['react'],
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  configureApi({ getToken: () => 'tok' })
})

describe('favorites.service', () => {
  it('favorite() POSTs to /jobs/:id/favorite with auth and returns the parsed message (R2)', async () => {
    mockResponseOnce(200, { data: { message: 'Vacante agregada a favoritos' } })

    const result = await favoritesService.favorite('job-1')

    const { url, init } = lastRequest()
    expect(url).toBe(`${BASE_URL}/jobs/job-1/favorite`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(result).toEqual({ data: { message: 'Vacante agregada a favoritos' } })
  })

  it('unfavorite() DELETEs to /jobs/:id/favorite with auth and returns the parsed message (R2)', async () => {
    mockResponseOnce(200, { data: { message: 'Vacante eliminada de favoritos' } })

    const result = await favoritesService.unfavorite('job-1')

    const { url, init } = lastRequest()
    expect(url).toBe(`${BASE_URL}/jobs/job-1/favorite`)
    expect(init.method).toBe('DELETE')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(result).toEqual({ data: { message: 'Vacante eliminada de favoritos' } })
  })

  it('list() GETs /favorites with auth and returns the parsed list (R2)', async () => {
    const payload = { data: { items: [job] } }
    mockResponseOnce(200, payload)

    const result = await favoritesService.list()

    const { url, init } = lastRequest()
    expect(url).toBe(`${BASE_URL}/favorites`)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(result).toEqual(payload)
  })

  it('rejects when the response body does not match the schema (R2)', async () => {
    mockResponseOnce(200, { data: { message: 123 } })

    await expect(favoritesService.favorite('job-1')).rejects.toBeTruthy()
  })
})
