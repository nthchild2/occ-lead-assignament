import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../auth.middleware'
import { AppError } from '../../lib/errors'
import { env } from '../../config/env'
import * as authService from '../../domains/auth/auth.service'

const res = {} as Response

const runWith = (
  headers: Record<string, string>,
): { thrown: unknown; req: Request; next: jest.Mock } => {
  const req = { headers } as unknown as Request
  const next = jest.fn()
  let thrown: unknown
  try {
    authMiddleware(req, res, next as unknown as NextFunction)
  } catch (err) {
    thrown = err
  }
  return { thrown, req, next }
}

const sign = (payload: object, expiresIn: string | number): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions)

describe('authMiddleware', () => {
  it('attaches the user + token and calls next() for a valid Bearer token', () => {
    const token = sign({ sub: '1', email: 'test@occ.com.mx' }, '1h')
    const { thrown, req, next } = runWith({ authorization: `Bearer ${token}` })

    expect(thrown).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(req.user).toEqual({ id: '1', email: 'test@occ.com.mx' })
    expect(req.token).toBe(token)
  })

  it('throws AUTH_REQUIRED (401) when the Authorization header is missing', () => {
    const { thrown, next } = runWith({})

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('AUTH_REQUIRED')
    expect((thrown as AppError).status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('throws AUTH_REQUIRED when the header is not a Bearer token', () => {
    const { thrown } = runWith({ authorization: 'Basic abc123' })

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('AUTH_REQUIRED')
  })

  it('throws AUTH_REQUIRED for an invalid signature', () => {
    const forged = jwt.sign({ sub: '1', email: 'x@y.z' }, 'a-different-secret', {
      expiresIn: '1h',
    })
    const { thrown } = runWith({ authorization: `Bearer ${forged}` })

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('AUTH_REQUIRED')
  })

  it('throws TOKEN_EXPIRED for an expired token (branch checked before AUTH_REQUIRED)', () => {
    // Negative expiry forces an already-expired token.
    const expired = sign({ sub: '1', email: 'test@occ.com.mx' }, -10)
    const { thrown } = runWith({ authorization: `Bearer ${expired}` })

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('TOKEN_EXPIRED')
    expect((thrown as AppError).status).toBe(401)
  })

  it('throws AUTH_REQUIRED for a blacklisted token', () => {
    const token = sign({ sub: '1', email: 'test@occ.com.mx' }, '1h')
    authService.logout(token)

    const { thrown } = runWith({ authorization: `Bearer ${token}` })

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('AUTH_REQUIRED')
  })
})
