import { MeResponseSchema } from '@occ/shared'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { z } from 'zod'

import { ApiError, configureApi, get } from './api'

const BASE_URL = 'http://api.test'

const server = setupServer()

let capturedAuthHeader: string | null = null

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  capturedAuthHeader = null
  // Reset injected config between cases.
  configureApi({})
})

afterAll(() => {
  server.close()
})

describe('api', () => {
  it('injects the JWT as Authorization: Bearer <token> on authed requests (R3)', async () => {
    configureApi({ getToken: () => 'tok' })
    server.use(
      http.get(`${BASE_URL}/me`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization')
        return HttpResponse.json({ data: { id: '1', email: 'a@b.co' } })
      }),
    )

    await get('/me', MeResponseSchema)

    expect(capturedAuthHeader).toBe('Bearer tok')
  })

  it('omits the Authorization header when no token is available (R3)', async () => {
    configureApi({ getToken: () => undefined })
    server.use(
      http.get(`${BASE_URL}/me`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization')
        return HttpResponse.json({ data: { id: '1', email: 'a@b.co' } })
      }),
    )

    await get('/me', MeResponseSchema, false)

    expect(capturedAuthHeader).toBeNull()
  })

  it('parses a 2xx body with the supplied schema and returns typed data (R4)', async () => {
    const payload = { data: { id: '42', email: 'user@occ.com' } }
    server.use(http.get(`${BASE_URL}/me`, () => HttpResponse.json(payload)))

    const result = await get('/me', MeResponseSchema)

    expect(result).toEqual(payload)
    expect(result.data.email).toBe('user@occ.com')
  })

  it('rejects when the 2xx body does not match the schema (R4)', async () => {
    server.use(
      http.get(`${BASE_URL}/me`, () =>
        HttpResponse.json({ data: { id: 1, email: 'not-an-email' } }),
      ),
    )

    await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(z.ZodError)
  })

  it('maps an error envelope to a thrown ApiError with code and message (R5)', async () => {
    server.use(
      http.get(`${BASE_URL}/me`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'No existe' } }, { status: 404 }),
      ),
    )

    await expect(get('/me', MeResponseSchema)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'No existe',
    })
    await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(ApiError)
  })

  it('fires onUnauthorized and still rejects on a 401 (R6)', async () => {
    const onUnauthorized = jest.fn()
    configureApi({ onUnauthorized })
    server.use(
      http.get(`${BASE_URL}/me`, () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Token expirado' } },
          { status: 401 },
        ),
      ),
    )

    await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
