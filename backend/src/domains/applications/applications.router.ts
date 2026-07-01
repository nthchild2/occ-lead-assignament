import { Router, type Request, type Response } from 'express'
import type { Job } from '@occ/shared'
import { validate } from '../../middleware/validation.middleware'
import { authMiddleware } from '../../middleware/auth.middleware'
import { success } from '../../lib/response'
import { AppError } from '../../lib/errors'
import { JobIdParamsSchema } from './applications.schema'
import { createApplicationsService } from './applications.service'

/**
 * Applications HTTP layer — the only file in the domain that touches Express
 * (A1 Decision 4). Both router factories take `{ getJob }` and pass it straight
 * through to `createApplicationsService`, so the domain never imports
 * `domains/jobs` directly (A1 Decision 3 / R9) — only `app.ts` wires the two
 * together.
 *
 * The `if (!req.user)` guard after `authMiddleware` mirrors `auth.router.ts:26-29`
 * — it narrows `req.user` from optional to defined without a non-null assertion.
 */

interface ApplicationsRouterDeps {
  getJob: (id: string) => Job
}

/** `POST/DELETE /:id/apply`, mounted at `/jobs` alongside the public `jobsRouter`. */
export const createApplicationsActionsRouter = ({ getJob }: ApplicationsRouterDeps): Router => {
  const router = Router()
  const service = createApplicationsService({ getJob })

  router.post(
    '/:id/apply',
    authMiddleware,
    validate({ params: JobIdParamsSchema }),
    (req: Request, res: Response): void => {
      if (!req.user) {
        throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
      }
      const { id } = req.params as { id: string }
      const application = service.apply(req.user.id, id)
      success(res, application)
    },
  )

  router.delete(
    '/:id/apply',
    authMiddleware,
    validate({ params: JobIdParamsSchema }),
    (req: Request, res: Response): void => {
      if (!req.user) {
        throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
      }
      const { id } = req.params as { id: string }
      service.cancel(req.user.id, id)
      success(res, { message: 'Postulación cancelada' })
    },
  )

  return router
}

/** `GET /`, mounted at `/applications`. */
export const createApplicationsListRouter = ({ getJob }: ApplicationsRouterDeps): Router => {
  const router = Router()
  const service = createApplicationsService({ getJob })

  router.get('/', authMiddleware, (req: Request, res: Response): void => {
    if (!req.user) {
      throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
    }
    success(res, service.list(req.user.id))
  })

  return router
}
