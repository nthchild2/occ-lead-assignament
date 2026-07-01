import { z } from 'zod'

/**
 * Validated environment configuration.
 *
 * Parses `process.env` at import time so the process fails fast at boot if a
 * required variable is missing. Only `JWT_SECRET` is hard-required; `PORT`,
 * `JWT_EXPIRES_IN`, and `NODE_ENV` are defaulted so dev/CI can boot without a
 * full `.env`. `dotenv/config` is already loaded at `backend/src/app.ts` before
 * this module is imported.
 *
 * Express-free by design.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export const env: Env = envSchema.parse(process.env)
