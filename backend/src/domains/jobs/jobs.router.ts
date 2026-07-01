import { Router, type Request, type Response } from 'express'
import { validate } from '../../middleware/validation.middleware'
import { success } from '../../lib/response'
import { JobQuerySchema, JobParamsSchema } from './jobs.schema'
import type { JobFilters } from './jobs.schema'
import * as jobsService from './jobs.service'

/**
 * Jobs HTTP layer — the only file in the domain that touches Express (A1
 * Decision 4). Both routes are public (no `authMiddleware`); the router does
 * request validation and envelope translation, delegating all filter/sort/
 * paginate/lookup logic to `jobs.service`.
 *
 * `validate({ query: JobQuerySchema })` coerces the string query params to
 * numbers and writes them back onto `req.query`, so the cast to `JobFilters`
 * here reflects the already-parsed shape.
 */
export const jobsRouter: Router = Router()

jobsRouter.get('/', validate({ query: JobQuerySchema }), (req: Request, res: Response): void => {
  const filters = req.query as unknown as JobFilters
  success(res, jobsService.list(filters))
})

jobsRouter.get(
  '/:id',
  validate({ params: JobParamsSchema }),
  (req: Request, res: Response): void => {
    const { id } = req.params as { id: string }
    success(res, jobsService.getById(id))
  },
)
