import { Router, type Request, type Response } from 'express'
import { LoginRequestSchema } from '@occ/shared'
import { validate } from '../../middleware/validation.middleware'
import { authMiddleware } from '../../middleware/auth.middleware'
import { success } from '../../lib/response'
import { AppError } from '../../lib/errors'
import * as authService from './auth.service'

/**
 * Auth HTTP layer — the only file in the domain that touches Express (A1
 * Decision 4). It does request validation and envelope translation; all
 * credential/JWT/blacklist logic lives in `auth.service`.
 */
export const authRouter: Router = Router()

authRouter.post(
  '/login',
  validate({ body: LoginRequestSchema }),
  (req: Request, res: Response): void => {
    const { email, password } = req.body as { email: string; password: string }
    const { token, user } = authService.login(email, password)
    success(res, { token, user })
  },
)

authRouter.get('/me', authMiddleware, (req: Request, res: Response): void => {
  if (!req.user) {
    throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
  }
  success(res, req.user)
})

authRouter.post('/logout', authMiddleware, (req: Request, res: Response): void => {
  if (!req.token) {
    throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
  }
  authService.logout(req.token)
  success(res, { message: 'Sesión cerrada' })
})
