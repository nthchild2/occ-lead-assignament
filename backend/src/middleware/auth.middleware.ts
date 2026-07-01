import type { NextFunction, Request, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from '../lib/errors'
import { env } from '../config/env'
import * as authService from '../domains/auth/auth.service'
import type { JwtPayload, User } from '../domains/auth/auth.schema'

/**
 * Express `Request` augmentation: after `authMiddleware` runs, handlers can read
 * the authenticated `user` and the raw `token` with no `any` and no non-null
 * assertions. The declaration lives here — the module every protected router
 * imports — so the global merge is always loaded.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User
      token?: string
    }
  }
}

const BEARER_PREFIX = 'Bearer '

/** Extract the bearer token, or throw `AUTH_REQUIRED` for a missing/malformed header. */
const extractToken = (header: string | undefined): string => {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
  }

  const token = header.slice(BEARER_PREFIX.length).trim()
  if (token.length === 0) {
    throw new AppError('AUTH_REQUIRED', 'Falta el token de autenticación')
  }

  return token
}

/**
 * Verify the token and map failures to the taxonomy. `TokenExpiredError` is
 * checked BEFORE `JsonWebTokenError` because the former extends the latter — a
 * `JsonWebTokenError`-first branch would mislabel expiry as `AUTH_REQUIRED`.
 */
const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET)
    return { sub: String(decoded.sub), email: String((decoded as { email?: unknown }).email) }
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 'El token ha expirado')
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError('AUTH_REQUIRED', 'Token inválido')
    }
    throw err
  }
}

/**
 * Reusable Bearer-JWT verifier. Reads `Authorization`, rejects a
 * missing/malformed or blacklisted token as `AUTH_REQUIRED`, verifies the
 * signature/expiry, then attaches the authenticated user and raw token to the
 * request before calling `next`.
 */
export const authMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = extractToken(req.headers.authorization)

  if (authService.isBlacklisted(token)) {
    throw new AppError('AUTH_REQUIRED', 'Token inválido')
  }

  const payload = verifyToken(token)
  req.user = authService.getUserFromPayload(payload)
  req.token = token

  next()
}
