import { AppError, ERROR_STATUS } from '../errors'

describe('AppError', () => {
  it('derives status 404 for NOT_FOUND from the taxonomy', () => {
    const err = new AppError('NOT_FOUND', 'Vacante no encontrada')
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Vacante no encontrada')
  })

  it('derives status 409 for ALREADY_APPLIED', () => {
    const err = new AppError('ALREADY_APPLIED', 'Ya aplicaste')
    expect(err.status).toBe(409)
  })

  it('derives status 422 for VALIDATION_ERROR', () => {
    const err = new AppError('VALIDATION_ERROR', 'Datos inválidos')
    expect(err.status).toBe(422)
  })

  it('is an instance of Error', () => {
    expect(new AppError('AUTH_REQUIRED', 'Auth requerido')).toBeInstanceOf(Error)
  })

  it('reads status straight from the ERROR_STATUS record for every code', () => {
    const codes = Object.keys(ERROR_STATUS) as (keyof typeof ERROR_STATUS)[]
    for (const code of codes) {
      expect(new AppError(code, 'x').status).toBe(ERROR_STATUS[code])
    }
  })
})
