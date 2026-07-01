/**
 * Backend error-code taxonomy.
 *
 * `ERROR_STATUS` is the single source of truth mapping each domain error code to
 * its HTTP status. The `ErrorCode` union is derived from its keys, so the codes
 * are a closed union type rather than loose strings, and `AppError.status` reads
 * straight from this record — one map, no drift, no dynamic string indexing.
 *
 * Express-free by design (A1 Decision 4): domain services can throw `AppError`
 * without importing Express.
 */
export const ERROR_STATUS = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  NOT_FOUND: 404,
  ALREADY_APPLIED: 409,
  ALREADY_FAVORITED: 409,
  VALIDATION_ERROR: 422,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

/**
 * Domain error carrying a taxonomy `code`, its derived HTTP `status`, and a
 * human-readable `message`. The `status` is looked up from `ERROR_STATUS` using
 * the narrowed `ErrorCode` key — a typed record access, not arbitrary string
 * indexing.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
  }
}
