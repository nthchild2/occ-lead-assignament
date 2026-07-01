import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny } from 'zod'
import { AppError } from '../lib/errors'

interface ValidationSchemas {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

type RequestPart = keyof ValidationSchemas

const PARTS: readonly RequestPart[] = ['body', 'query', 'params']

/**
 * Reusable request-validation middleware factory.
 *
 * `validate({ body?, query?, params? })` returns an Express middleware that
 * `safeParse`s each provided Zod schema against the matching request part. On the
 * first failure it throws `AppError('VALIDATION_ERROR')` (rendered as 422 by the
 * error middleware); on success it writes the parsed values back onto the request
 * so handlers see coerced/typed data, then calls `next()`.
 */
export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const part of PARTS) {
      const schema = schemas[part]
      if (!schema) continue

      const result = schema.safeParse(req[part])
      if (!result.success) {
        const message = result.error.issues[0]?.message ?? 'Invalid request'
        throw new AppError('VALIDATION_ERROR', message)
      }

      req[part] = result.data
    }

    next()
  }
}
