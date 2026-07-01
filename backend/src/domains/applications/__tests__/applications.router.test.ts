import request from 'supertest'
import {
  ApplicationSchema,
  ApplicationListResponseSchema,
  ApiErrorSchema,
  LoginResponseSchema,
} from '@occ/shared'
import { app } from '../../../app'
import { jobs } from '../../jobs/jobs.seed'

/**
 * Router integration tests — supertest against the mounted app. Assert wire
 * shapes via the shared schemas and error envelopes via `ApiErrorSchema`.
 * `loginAndGetToken` mirrors `auth.router.test.ts:9-12`.
 */
const VALID_CREDS = { email: 'test@occ.com.mx', password: 'Test1234' }
const JOB_ID = jobs[0].id // 'job-01', pinned seed record
const BOGUS_JOB_ID = 'does-not-exist'

const loginAndGetToken = async (): Promise<string> => {
  const res = await request(app).post('/auth/login').send(VALID_CREDS)
  return LoginResponseSchema.parse(res.body).data.token
}

describe('applications router (integration)', () => {
  describe('POST/DELETE /jobs/:id/apply', () => {
    it('applies, rejects a duplicate, cancels, then 404s on a repeat cancel', async () => {
      const token = await loginAndGetToken()
      const auth = `Bearer ${token}`

      const applyRes = await request(app).post(`/jobs/${JOB_ID}/apply`).set('Authorization', auth)
      expect(applyRes.status).toBe(200)
      const parsedApply = ApplicationSchema.parse(applyRes.body.data)
      expect(parsedApply.jobId).toBe(JOB_ID)
      expect(parsedApply.job.id).toBe(JOB_ID)

      const dupeRes = await request(app).post(`/jobs/${JOB_ID}/apply`).set('Authorization', auth)
      expect(dupeRes.status).toBe(409)
      expect(ApiErrorSchema.parse(dupeRes.body).error.code).toBe('ALREADY_APPLIED')

      const cancelRes = await request(app)
        .delete(`/jobs/${JOB_ID}/apply`)
        .set('Authorization', auth)
      expect(cancelRes.status).toBe(200)

      const reCancelRes = await request(app)
        .delete(`/jobs/${JOB_ID}/apply`)
        .set('Authorization', auth)
      expect(reCancelRes.status).toBe(404)
      expect(ApiErrorSchema.parse(reCancelRes.body).error.code).toBe('NOT_FOUND')
    })

    it('returns 404 NOT_FOUND when applying to a job that does not exist', async () => {
      const token = await loginAndGetToken()
      const res = await request(app)
        .post(`/jobs/${BOGUS_JOB_ID}/apply`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND')
    })

    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const applyRes = await request(app).post(`/jobs/${JOB_ID}/apply`)
      expect(applyRes.status).toBe(401)
      expect(ApiErrorSchema.parse(applyRes.body).error.code).toBe('AUTH_REQUIRED')

      const cancelRes = await request(app).delete(`/jobs/${JOB_ID}/apply`)
      expect(cancelRes.status).toBe(401)
      expect(ApiErrorSchema.parse(cancelRes.body).error.code).toBe('AUTH_REQUIRED')
    })
  })

  describe('GET /applications', () => {
    it('returns 401 AUTH_REQUIRED without a token', async () => {
      const res = await request(app).get('/applications')
      expect(res.status).toBe(401)
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('AUTH_REQUIRED')
    })

    it('returns 200 with a body matching ApplicationListResponseSchema, embedding the job', async () => {
      const token = await loginAndGetToken()
      const auth = `Bearer ${token}`

      await request(app).post(`/jobs/${JOB_ID}/apply`).set('Authorization', auth)

      const res = await request(app).get('/applications').set('Authorization', auth)
      expect(res.status).toBe(200)
      const parsed = ApplicationListResponseSchema.parse(res.body)
      const found = parsed.data.items.find((item) => item.jobId === JOB_ID)
      expect(found).toBeDefined()
      expect(found?.job.id).toBe(JOB_ID)

      // cleanup so this test file's shared state doesn't leak into other assertions
      await request(app).delete(`/jobs/${JOB_ID}/apply`).set('Authorization', auth)
    })
  })
})
