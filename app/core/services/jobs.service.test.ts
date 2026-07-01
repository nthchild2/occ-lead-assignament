import * as jobsService from './jobs.service'
import { configureApi } from './api'

// Mirrors `favorites.service.test.ts`/`applications.service.test.ts` — mocks
// `global.fetch` directly and asserts the HTTP method/path/auth wiring plus
// the schema-parsed return shape (R9).

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
  // No token configured — asserts `getById` is called unauthenticated (R9),
  // mirroring `list()`'s own public/no-auth contract.
  configureApi({ getToken: () => undefined })
})

describe('jobs.service', () => {
  it('getById() GETs /jobs/:id unauthenticated and returns the parsed job (R9)', async () => {
    const payload = { data: job }
    mockResponseOnce(200, payload)

    const result = await jobsService.getById('job-1')

    const { url, init } = lastRequest()
    expect(url).toBe(`${BASE_URL}/jobs/job-1`)
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(result).toEqual(payload)
  })

  it('rejects when the response body does not match the schema (R9)', async () => {
    mockResponseOnce(200, { data: { ...job, salary: 'not-a-number' } })

    await expect(jobsService.getById('job-1')).rejects.toBeTruthy()
  })
})
