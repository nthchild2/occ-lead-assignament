import type { NextFunction, Request, Response } from 'express'
import { fail } from '../lib/response'
import { logger } from '../lib/logger'
import { AppError } from '../lib/errors'

/**
 * Global error-handling middleware — must be registered last in the chain.
 *
 * An `AppError` renders with its taxonomy-derived status and `{ code, message }`;
 * any other error becomes a 500 `INTERNAL_ERROR`. Both branches log via `pino`
 * and emit the envelope exclusively through `fail()`, so output always conforms
 * to the shared `ApiErrorSchema`.
 */
export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (err instanceof AppError) {
    logger.error({ err }, 'Handled AppError')
    return fail(res, err.status, err.code, err.message)
  }

  logger.error({ err }, 'Unhandled error')
  return fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}
