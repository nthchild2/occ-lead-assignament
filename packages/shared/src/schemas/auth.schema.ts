import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
})

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const LoginResponseSchema = z.object({
  data: z.object({
    token: z.string(),
    user: UserSchema,
  }),
})

export const MeResponseSchema = z.object({
  data: UserSchema,
})

export type User = z.infer<typeof UserSchema>
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export type MeResponse = z.infer<typeof MeResponseSchema>
