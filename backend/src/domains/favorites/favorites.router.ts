import { Router, type Request, type Response } from 'express'
import type { Job } from '@occ/shared'
import { validate } from '../../middleware/validation.middleware'
import { authMiddleware } from '../../middleware/auth.middleware'
import { success } from '../../lib/response'
import { AppError } from '../../lib/errors'
import { JobIdParamsSchema } from './favorites.schema'
import { createFavoritesService } from './favorites.service'

/**
 * Favorites HTTP layer — the only file in the domain that touches Express (A1
 * Decision 4). Both router factories take `{ getJob }` and pass it straight
 * through to `createFavoritesService`, so the domain never imports
 * `domains/jobs` directly (A1 Decision 3 / R9) — only `app.ts` wires the two
 * together.
 *
 * The `if (!req.user)` guard after `authMiddleware` mirrors `auth.router.ts:26-29`
 * — it narrows `req.user` from optional to defined without a non-null assertion.
 */

interface FavoritesRouterDeps {
  getJob: (id: string) => Job
}

/** `POST/DELETE /:id/favorite`, mounted at `/jobs` alongside the public `jobsRouter`. */
export const createFavoritesActionsRouter = ({ getJob }: FavoritesRouterDeps): Router => {
  const router = Router()
  const service = createFavoritesService({ getJob })

  router.post(
    '/:id/favorite',
    authMiddleware,
    validate({ params: JobIdParamsSchema }),
    (req: Request, res: Response): void => {
      if (!req.user) {
        throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
      }
      const { id } = req.params as { id: string }
      service.favorite(req.user.id, id)
      success(res, { message: 'Vacante agregada a favoritos' })
    },
  )

  router.delete(
    '/:id/favorite',
    authMiddleware,
    validate({ params: JobIdParamsSchema }),
    (req: Request, res: Response): void => {
      if (!req.user) {
        throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
      }
      const { id } = req.params as { id: string }
      service.unfavorite(req.user.id, id)
      success(res, { message: 'Vacante eliminada de favoritos' })
    },
  )

  return router
}

/** `GET /`, mounted at `/favorites`. */
export const createFavoritesListRouter = ({ getJob }: FavoritesRouterDeps): Router => {
  const router = Router()
  const service = createFavoritesService({ getJob })

  router.get('/', authMiddleware, (req: Request, res: Response): void => {
    if (!req.user) {
      throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
    }
    success(res, service.list(req.user.id))
  })

  return router
}
