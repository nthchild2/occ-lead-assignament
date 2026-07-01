import { ApiErrorSchema } from '@occ/shared'
import type { z, ZodType } from 'zod'

// --- Injected configuration (dependency inversion) ---------------------------
// The token source and the 401 handler are injected via `configureApi` rather
// than imported from `store/`, so this module stays inside the `core/` boundary
// and avoids a circular dependency with `auth.store`. Mirrors the singleton-
// with-setter shape of `app/store/theme.store.ts`.

interface ApiConfig {
  getToken?: () => string | undefined
  onUnauthorized?: () => void
}

const config: ApiConfig = {}

export function configureApi(next: ApiConfig): void {
  config.getToken = next.getToken
  config.onUnauthorized = next.onUnauthorized
}

// --- Errors ------------------------------------------------------------------
// The shared `ApiError` type is a plain envelope (`{ error: { code, message } }`)
// and is not throwable. This throwable class is the surface callers `catch`,
// while `ApiErrorSchema` from `@occ/shared` remains the source of truth for the
// wire shape.

export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

class ApiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConfigError'
  }
}

function mapError(status: number, body: unknown): ApiError {
  const parsed = ApiErrorSchema.safeParse(body)
  if (parsed.success) {
    return new ApiError(parsed.data.error.code, parsed.data.error.message)
  }
  return new ApiError('UNKNOWN', `Request failed with status ${status}`)
}

// --- Request pipeline --------------------------------------------------------

function resolveBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new ApiConfigError('EXPO_PUBLIC_API_BASE_URL is not set')
  }
  return baseUrl
}

function buildHeaders(auth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (auth) {
    const token = config.getToken?.()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  return headers
}

interface RequestOptions {
  body?: unknown
  auth?: boolean
}

async function request<T extends ZodType>(
  method: string,
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const { body, auth = true } = options
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method,
    headers: buildHeaders(auth),
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    config.onUnauthorized?.()
    throw mapError(response.status, await response.json().catch(() => undefined))
  }

  if (!response.ok) {
    throw mapError(response.status, await response.json().catch(() => undefined))
  }

  return schema.parse(await response.json())
}

// --- Public request helpers --------------------------------------------------
// Single module surface for all network calls. Each helper takes a response Zod
// schema and returns `z.infer<>`-typed data, parsed at the boundary.

export function get<T extends ZodType>(
  path: string,
  schema: T,
  auth?: boolean,
): Promise<z.infer<T>> {
  return request('GET', path, schema, { auth })
}

export function post<T extends ZodType>(
  path: string,
  schema: T,
  body?: unknown,
  auth?: boolean,
): Promise<z.infer<T>> {
  return request('POST', path, schema, { body, auth })
}

export function put<T extends ZodType>(
  path: string,
  schema: T,
  body?: unknown,
  auth?: boolean,
): Promise<z.infer<T>> {
  return request('PUT', path, schema, { body, auth })
}

export function patch<T extends ZodType>(
  path: string,
  schema: T,
  body?: unknown,
  auth?: boolean,
): Promise<z.infer<T>> {
  return request('PATCH', path, schema, { body, auth })
}

export function del<T extends ZodType>(
  path: string,
  schema: T,
  auth?: boolean,
): Promise<z.infer<T>> {
  return request('DELETE', path, schema, { auth })
}
