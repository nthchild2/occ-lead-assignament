import jwt, { type SignOptions } from 'jsonwebtoken'
import { AppError } from '../../lib/errors'
import { env } from '../../config/env'
import type { JwtPayload, User } from './auth.schema'

/**
 * Auth domain logic — Express-free by design (A1 Decision 4): it validates the
 * fixed mock credentials, signs/derives JWTs, and owns the in-memory token
 * blacklist. Failures are surfaced as `AppError` so the router/error middleware
 * do the HTTP translation.
 */

// The brief specifies a single fixed mock user (no DB, no password hashing).
const FIXED_EMAIL = 'test@occ.com.mx'
const FIXED_PASSWORD = 'Test1234'
const FIXED_USER_ID = '1'

/**
 * In-memory logout blacklist. Single-instance, non-persisted, cleared on restart
 * — sanctioned tech debt (A1 Decision 5); production would use Redis/DynamoDB.
 */
const blacklist = new Set<string>()

// `env.JWT_EXPIRES_IN` is a plain string; `SignOptions.expiresIn` is the narrow
// `ms` template type. Building the options object once keeps the sign call typed
// without `any` at the call site.
const signOptions: SignOptions = {
  expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
}

const toUser = (email: string): User => ({ id: FIXED_USER_ID, email })

/**
 * Validate credentials against the fixed mock user. On success returns a freshly
 * signed 1h JWT plus the user; on failure throws `AppError('INVALID_CREDENTIALS')`.
 */
export const login = (email: string, password: string): { token: string; user: User } => {
  if (email !== FIXED_EMAIL || password !== FIXED_PASSWORD) {
    throw new AppError('INVALID_CREDENTIALS', 'Email o contraseña incorrectos')
  }

  const user = toUser(email)
  const payload: JwtPayload = { sub: user.id, email: user.email }
  const token = jwt.sign(payload, env.JWT_SECRET, signOptions)

  return { token, user }
}

/** Map a verified JWT payload back to the domain `User`. */
export const getUserFromPayload = (payload: JwtPayload): User => toUser(payload.email)

/** Invalidate a token by adding it to the in-memory blacklist. */
export const logout = (token: string): void => {
  blacklist.add(token)
}

/** Whether a token has been blacklisted via `logout`. */
export const isBlacklisted = (token: string): boolean => blacklist.has(token)
