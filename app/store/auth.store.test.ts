import { useAuthStore } from './auth.store'

// Same convention as `app/core/services/api.test.ts`: mock `global.fetch`
// directly (not msw) so the store tests exercise the real
// service -> api-client wire path end to end.
//
// Deliberately do NOT re-call `configureApi(...)` here. `auth.store.ts`
// wires it once at module load (this file's `import { useAuthStore }`
// above triggers that side effect exactly once, before any test runs).
// Re-wiring it in `beforeEach` with a duplicated closure would test that
// duplicate, not the module's own wiring — which is precisely what let a
// broken `onUnauthorized` in `auth.store.ts` pass silently.

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

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL
})

beforeEach(() => {
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
  useAuthStore.setState({ token: null, user: null })
})

describe('auth.store', () => {
  it('login success sets token and user (R2)', async () => {
    mockResponseOnce(200, { data: { token: 'tok-1', user: { id: '1', email: 'a@b.co' } } })

    await useAuthStore.getState().login('a@b.co', 'secret')

    expect(useAuthStore.getState().token).toBe('tok-1')
    expect(useAuthStore.getState().user).toEqual({ id: '1', email: 'a@b.co' })
  })

  it('login failure propagates ApiError and leaves token/user unset (R1, R2)', async () => {
    mockResponseOnce(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Bad credentials' } })

    await expect(useAuthStore.getState().login('a@b.co', 'wrong')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_CREDENTIALS',
    })

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('logout clears token and user when the network call succeeds (R2)', async () => {
    useAuthStore.setState({ token: 'tok-1', user: { id: '1', email: 'a@b.co' } })
    mockResponseOnce(200, { data: {} })

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('logout clears token and user even when the network call fails (R2)', async () => {
    useAuthStore.setState({ token: 'tok-1', user: { id: '1', email: 'a@b.co' } })
    mockResponseOnce(500, { error: { code: 'SERVER_ERROR', message: 'Boom' } })

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('onUnauthorized (fired by configureApi on any 401) clears the session independently of the calling action (R4)', async () => {
    useAuthStore.setState({ token: 'tok-1', user: { id: '1', email: 'a@b.co' } })
    mockResponseOnce(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Bad credentials' } })

    // `login()`'s own failure path only propagates the ApiError — it never
    // calls `clearSession()` itself (unlike `hydrate()`, which has its own
    // catch-and-clear). So if the session still clears here, it can only be
    // because the module-load `configureApi({ onUnauthorized })` wiring
    // fired independently — which is exactly what R4 requires, isolated
    // from R5's `hydrate()` catch logic.
    await expect(useAuthStore.getState().login('a@b.co', 'wrong')).rejects.toMatchObject({
      name: 'ApiError',
    })

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('hydrate clears the session on a failed me() call (R5)', async () => {
    useAuthStore.setState({ token: 'tok-1', user: { id: '1', email: 'a@b.co' } })
    mockResponseOnce(401, { error: { code: 'TOKEN_EXPIRED', message: 'Token expirado' } })

    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('hydrate refreshes user on a successful me() call (R5)', async () => {
    useAuthStore.setState({ token: 'tok-1', user: { id: '1', email: 'old@b.co' } })
    mockResponseOnce(200, { data: { id: '1', email: 'new@b.co' } })

    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState().token).toBe('tok-1')
    expect(useAuthStore.getState().user).toEqual({ id: '1', email: 'new@b.co' })
  })
})
