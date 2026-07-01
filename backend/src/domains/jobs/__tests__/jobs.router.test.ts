import request from 'supertest'
import { JobListResponseSchema, JobDetailResponseSchema, ApiErrorSchema } from '@occ/shared'
import { app } from '../../../app'
import { jobs } from '../jobs.seed'

/**
 * Router integration tests — supertest against the mounted app. Assert the wire
 * shapes by parsing responses through the shared schemas, and assert the 422/404
 * error envelopes via `ApiErrorSchema`. The endpoints are public (no auth header).
 */
describe('jobs router (integration)', () => {
  describe('GET /jobs', () => {
    it('returns 200 with a body matching JobListResponseSchema', async () => {
      const res = await request(app).get('/jobs')

      expect(res.status).toBe(200)
      const parsed = JobListResponseSchema.parse(res.body)
      expect(parsed.data.items.length).toBeGreaterThan(0)
      expect(parsed.data.pagination.total).toBe(jobs.length)
    })

    it('applies coerced numeric query params (page/limit arrive as numbers)', async () => {
      const res = await request(app).get('/jobs').query({ page: '2', limit: '10' })

      expect(res.status).toBe(200)
      const parsed = JobListResponseSchema.parse(res.body)
      expect(parsed.data.pagination.page).toBe(2)
      expect(parsed.data.pagination.limit).toBe(10)
      expect(parsed.data.pagination.hasPrev).toBe(true)
    })

    it('returns 422 VALIDATION_ERROR for a non-numeric page', async () => {
      const res = await request(app).get('/jobs').query({ page: 'abc' })

      expect(res.status).toBe(422)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 422 VALIDATION_ERROR for an out-of-enum sort', async () => {
      const res = await request(app).get('/jobs').query({ sort: 'not-a-sort' })

      expect(res.status).toBe(422)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /jobs/:id', () => {
    it('returns 200 with a body matching JobDetailResponseSchema for an existing id', async () => {
      const target = jobs[0]
      const res = await request(app).get(`/jobs/${target.id}`)

      expect(res.status).toBe(200)
      const parsed = JobDetailResponseSchema.parse(res.body)
      expect(parsed.data.id).toBe(target.id)
    })

    it('returns 404 NOT_FOUND for an unknown id', async () => {
      const res = await request(app).get('/jobs/does-not-exist')

      expect(res.status).toBe(404)
      const parsed = ApiErrorSchema.parse(res.body)
      expect(parsed.error.code).toBe('NOT_FOUND')
    })
  })
})
