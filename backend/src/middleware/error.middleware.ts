import type { NextFunction, Request, Response } from 'express'
import { fail } from '../lib/response'
import { logger } from '../lib/logger'
import { AppError } from '../lib/errors'

/**
 * Global error-handling middleware — must be registered last in the chain.
 *
 * An `AppError` renders with its taxonomy-derived status and `{ code, message }`;
 * any other error becomes a 500 `INTERNAL_ERROR`. Both branches emit the envelope
 * exclusively through `fail()`, so output always conforms to the shared
 * `ApiErrorSchema`.
 *
 * Log level tracks severity, not just "was it an AppError": a client-driven 4xx
 * (expired token, already-applied, not-found) is expected, routine traffic, not
 * an incident — logging it at `error` is indistinguishable in the terminal from
 * a genuine 500 and trains whoever's watching to ignore (or panic at) both. Only
 * `status >= 500` gets `error`; every 4xx AppError gets `warn`.
 */
export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (err instanceof AppError) {
    const log = err.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger)
    log({ err }, 'Handled AppError')
    return fail(res, err.status, err.code, err.message)
  }

  logger.error({ err }, 'Unhandled error')
  return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}
