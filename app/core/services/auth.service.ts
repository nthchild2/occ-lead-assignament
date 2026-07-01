import type { LoginRequest, LoginResponse, MeResponse } from '@occ/shared'
import { LoginResponseSchema, MeResponseSchema } from '@occ/shared'
import { z } from 'zod'

import { get, post } from './api'

// `/auth/logout`'s response envelope is not part of `@occ/shared` (the spec
// scopes shared deps to Login*/MeResponseSchema/User only) — a minimal local
// schema is defined here rather than adding to the shared package.
const LogoutResponseSchema = z.object({ data: z.unknown() })

export function login(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password }
  return post('/auth/login', LoginResponseSchema, body, false)
}

export function logout(): Promise<z.infer<typeof LogoutResponseSchema>> {
  return post('/auth/logout', LogoutResponseSchema, undefined, true)
}

export function me(): Promise<MeResponse> {
  return get('/auth/me', MeResponseSchema)
}
