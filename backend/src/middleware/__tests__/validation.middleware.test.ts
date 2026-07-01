import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { validate } from '../validation.middleware'
import { AppError } from '../../lib/errors'

const res = {} as Response

describe('validate', () => {
  const schema = z.object({ page: z.coerce.number().int().positive() })

  it('throws AppError(VALIDATION_ERROR) on invalid body', () => {
    const req = { body: { page: 'not-a-number' } } as Request
    const middleware = validate({ body: schema })

    let thrown: unknown
    try {
      middleware(req, res, (() => undefined) as NextFunction)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(AppError)
    expect((thrown as AppError).code).toBe('VALIDATION_ERROR')
    expect((thrown as AppError).status).toBe(422)
  })

  it('passes valid input through and writes parsed values back onto req', () => {
    const req = { body: { page: '2' } } as Request
    const middleware = validate({ body: schema })
    const next = jest.fn()

    middleware(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    // coerced from the string '2' to the number 2
    expect(req.body).toEqual({ page: 2 })
  })

  it('skips request parts with no schema provided', () => {
    const req = { body: { page: '3' }, query: { junk: 'ignored' } } as unknown as Request
    const middleware = validate({ body: schema })
    const next = jest.fn()

    middleware(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.query).toEqual({ junk: 'ignored' })
  })
})
