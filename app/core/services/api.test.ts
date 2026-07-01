import { MeResponseSchema } from '@occ/shared'
import { z } from 'zod'

import { ApiError, configureApi, get } from './api'

// The API client is a thin `fetch` wrapper, so we unit-test it by mocking
// `global.fetch` directly rather than intercepting at the network layer with
// msw. This is lighter and idiomatic for a fetch wrapper, and it avoids msw
// v2's ESM-only dependencies failing to transform under jest-expo + pnpm's
// nested node_modules. Network-level interception (msw) is reserved for any
// higher-level integration tests if the need arises.

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

function lastRequestInit(): RequestInit {
  const calls = fetchMock().mock.calls
  return calls[calls.length - 1][1] as RequestInit
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  configureApi({})
})

describe('api', () => {
  it('injects the JWT as Authorization: Bearer <token> on authed requests (R3)', async () => {
    configureApi({ getToken: () => 'tok' })
    mockResponseOnce(200, { data: { id: '1', email: 'a@b.co' } })

    await get('/me', MeResponseSchema)

    const headers = lastRequestInit().headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
  })

  it('omits the Authorization header when no token is available (R3)', async () => {
    configureApi({ getToken: () => undefined })
    mockResponseOnce(200, { data: { id: '1', email: 'a@b.co' } })

    await get('/me', MeResponseSchema, false)

    const headers = lastRequestInit().headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('parses a 2xx body with the supplied schema and returns typed data (R4)', async () => {
    const payload = { data: { id: '42', email: 'user@occ.com' } }
    mockResponseOnce(200, payload)

    const result = await get('/me', MeResponseSchema)

    expect(result).toEqual(payload)
    expect(result.data.email).toBe('user@occ.com')
  })

  it('rejects when the 2xx body does not match the schema (R4)', async () => {
    mockResponseOnce(200, { data: { id: 1, email: 'not-an-email' } })

    await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(z.ZodError)
  })

  it('maps an error envelope to a thrown ApiError with code and message (R5)', async () => {
    mockResponseOnce(404, { error: { code: 'NOT_FOUND', message: 'No existe' } })

    await expect(get('/me', MeResponseSchema)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NOT_FOUND',
      message: 'No existe',
    })
  })

  it('fires onUnauthorized and still rejects on a 401 (R6)', async () => {
    const onUnauthorized = jest.fn()
    configureApi({ onUnauthorized })
    mockResponseOnce(401, { error: { code: 'TOKEN_EXPIRED', message: 'Token expirado' } })

    await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
