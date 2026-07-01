import type { NextFunction, Request, Response } from 'express'
import { ApiErrorSchema } from '@occ/shared'
import { errorMiddleware } from '../error.middleware'
import { AppError } from '../../lib/errors'

interface MockResponse {
  statusCode: number
  body: unknown
  res: Response
}

const makeRes = (): MockResponse => {
  const state: MockResponse = { statusCode: 0, body: undefined, res: {} as Response }
  const res = {
    status(code: number) {
      state.statusCode = code
      return this
    },
    json(payload: unknown) {
      state.body = payload
      return this
    },
  }
  state.res = res as unknown as Response
  return state
}

const req = {} as Request
const next = (() => undefined) as NextFunction

describe('errorMiddleware', () => {
  it('renders an AppError with its taxonomy status and envelope', () => {
    const state = makeRes()
    errorMiddleware(new AppError('NOT_FOUND', 'Vacante no encontrada'), req, state.res, next)

    expect(state.statusCode).toBe(404)
    expect(state.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Vacante no encontrada' },
    })
    expect(() => ApiErrorSchema.parse(state.body)).not.toThrow()
  })

  it('maps a VALIDATION_ERROR AppError to 422', () => {
    const state = makeRes()
    errorMiddleware(new AppError('VALIDATION_ERROR', 'Datos inválidos'), req, state.res, next)

    expect(state.statusCode).toBe(422)
    expect(state.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' },
    })
  })

  it('maps an unknown Error to 500 INTERNAL_ERROR', () => {
    const state = makeRes()
    errorMiddleware(new Error('boom'), req, state.res, next)

    expect(state.statusCode).toBe(500)
    expect(state.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
    expect(() => ApiErrorSchema.parse(state.body)).not.toThrow()
  })
})
