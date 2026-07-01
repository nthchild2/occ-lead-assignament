import type { User } from '@occ/shared'

/**
 * Auth-domain-internal types.
 *
 * Wire shapes (`User`, `LoginRequest`, `Login`/`MeResponse`) are owned by
 * `@occ/shared` (A1 Decision 1) and re-exported here so the service/router refer
 * to a single symbol. `JwtPayload` is the internal claim set we sign and verify —
 * it never crosses the API boundary, so it lives in the domain, not in shared.
 */
export type { User }

/** Claims carried inside the signed JWT: `sub` = user id, plus the email. */
export interface JwtPayload {
  sub: string
  email: string
}
