import request from 'supertest'
import jwt from 'jsonwebtoken'
import { LoginResponseSchema, MeResponseSchema, ApiErrorSchema } from '@occ/shared'
import { app } from '../../../app'
import { env } from '../../../config/env'

const VALID_CREDS = { email: 'test@occ.com.mx', password: 'Test1234' }

const loginAndGetToken = async (): Promise<string> => {
  const res = await request(app).post('/auth/login').send(VALID_CREDS)
  return LoginResponseSchema.parse(res.body).data.token
}

describe('auth router (integration)', () => {
  describe('POST /auth/login', () => {
    it('returns 200 with a verifiable token + user for valid credentials', async () => {
      const res = await request(app).post('/auth/login').send(VALID_CREDS)

      expect(res.status).toBe(200)
      const parsed = LoginResponseSchema.parse(res.body)
      expect(parsed.data.user).toEqual({ id: '1', email: VALID_CREDS.email })

      const decoded = jwt.verify(parsed.data.token, env.JWT_SECRET)
      expect(typeof decoded).toBe('object')
      expect((decoded as jwt.JwtPayload).sub).toBe('1')
      expect((decoded as jwt.JwtPayload).email).toBe(VALID_CREDS.email)
    })

    it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: VALID_CREDS.email, password: 'wrong-password' })

      expect(res.status).toBe(401)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('returns 422 VALIDATION_ERROR for a malformed body', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'not-an-email' })

      expect(res.status).toBe(422)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /auth/me', () => {
    it('returns 200 with the current user for a valid token', async () => {
      const token = await loginAndGetToken()
      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      const parsed = MeResponseSchema.parse(res.body)
      expect(parsed.data).toEqual({ id: '1', email: VALID_CREDS.email })
    })

    it('returns 401 AUTH_REQUIRED when no token is provided', async () => {
      const res = await request(app).get('/auth/me')

      expect(res.status).toBe(401)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('AUTH_REQUIRED')
    })

    it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
      const expired = jwt.sign({ sub: '1', email: VALID_CREDS.email }, env.JWT_SECRET, {
        expiresIn: -10,
      } as jwt.SignOptions)
      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`)

      expect(res.status).toBe(401)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('TOKEN_EXPIRED')
    })
  })

  describe('POST /auth/logout', () => {
    it('invalidates the token so reusing it on /me returns 401', async () => {
      const token = await loginAndGetToken()

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
      expect(logoutRes.status).toBe(200)

      const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
      expect(meRes.status).toBe(401)
      const parsed = ApiErrorSchema.parse(meRes.body)
      expect(parsed.error.code).toBe('AUTH_REQUIRED')
    })
  })
})
