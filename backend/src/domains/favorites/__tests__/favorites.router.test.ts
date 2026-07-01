import request from 'supertest'
import { FavoriteListResponseSchema, ApiErrorSchema, LoginResponseSchema } from '@occ/shared'
import { app } from '../../../app'
import { jobs } from '../../jobs/jobs.seed'

/**
 * Router integration tests — supertest against the mounted app. Assert wire
 * shapes via the shared schemas and error envelopes via `ApiErrorSchema`.
 * `loginAndGetToken` mirrors `auth.router.test.ts:9-12`.
 */
const VALID_CREDS = { email: 'test@occ.com.mx', password: 'Test1234' }
const JOB_ID = jobs[1].id // 'job-02', pinned seed record
const BOGUS_JOB_ID = 'does-not-exist'

const loginAndGetToken = async (): Promise<string> => {
  const res = await request(app).post('/auth/login').send(VALID_CREDS)
  return LoginResponseSchema.parse(res.body).data.token
}

describe('favorites router (integration)', () => {
  describe('POST/DELETE /jobs/:id/favorite', () => {
    it('favorites, rejects a duplicate, removes, then 404s on a repeat remove', async () => {
      const token = await loginAndGetToken()
      const auth = `Bearer ${token}`

      const favRes = await request(app).post(`/jobs/${JOB_ID}/favorite`).set('Authorization', auth)
      expect(favRes.status).toBe(200)

      const dupeRes = await request(app).post(`/jobs/${JOB_ID}/favorite`).set('Authorization', auth)
      expect(dupeRes.status).toBe(409)
      expect(ApiErrorSchema.parse(dupeRes.body).error.code).toBe('ALREADY_FAVORITED')

      const removeRes = await request(app)
        .delete(`/jobs/${JOB_ID}/favorite`)
        .set('Authorization', auth)
      expect(removeRes.status).toBe(200)

      const reRemoveRes = await request(app)
        .delete(`/jobs/${JOB_ID}/favorite`)
        .set('Authorization', auth)
      expect(reRemoveRes.status).toBe(404)
      expect(ApiErrorSchema.parse(reRemoveRes.body).error.code).toBe('NOT_FOUND')
    })

    it('returns 404 NOT_FOUND when favoriting a job that does not exist', async () => {
      const token = await loginAndGetToken()
      const res = await request(app)
        .post(`/jobs/${BOGUS_JOB_ID}/favorite`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND')
    })

    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const favRes = await request(app).post(`/jobs/${JOB_ID}/favorite`)
      expect(favRes.status).toBe(401)
      expect(ApiErrorSchema.parse(favRes.body).error.code).toBe('AUTH_REQUIRED')

      const removeRes = await request(app).delete(`/jobs/${JOB_ID}/favorite`)
      expect(removeRes.status).toBe(401)
      expect(ApiErrorSchema.parse(removeRes.body).error.code).toBe('AUTH_REQUIRED')
    })
  })

  describe('GET /favorites', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const res = await request(app).get('/favorites')
      expect(res.status).toBe(401)
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('AUTH_REQUIRED')
    })

    it('returns 200 with a body matching FavoriteListResponseSchema (full Job items)', async () => {
      const token = await loginAndGetToken()
      const auth = `Bearer ${token}`

      await request(app).post(`/jobs/${JOB_ID}/favorite`).set('Authorization', auth)

      const res = await request(app).get('/favorites').set('Authorization', auth)
      expect(res.status).toBe(200)
      const parsed = FavoriteListResponseSchema.parse(res.body)
      const found = parsed.data.items.find((item) => item.id === JOB_ID)
      expect(found).toBeDefined()

      // cleanup so this test file's shared state doesn't leak into other assertions
      await request(app).delete(`/jobs/${JOB_ID}/favorite`).set('Authorization', auth)
    })
  })
})
