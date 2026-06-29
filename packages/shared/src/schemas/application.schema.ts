import { z } from 'zod'
import { JobSchema } from './job.schema'

export const ApplicationSchema = z.object({
  jobId: z.string(),
  appliedAt: z.string().datetime(),
  job: JobSchema,
})

export const ApplicationListResponseSchema = z.object({
  data: z.object({
    items: z.array(ApplicationSchema),
  }),
})

export const FavoriteListResponseSchema = z.object({
  data: z.object({
    items: z.array(JobSchema),
  }),
})

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type Application = z.infer<typeof ApplicationSchema>
export type ApplicationListResponse = z.infer<typeof ApplicationListResponseSchema>
export type FavoriteListResponse = z.infer<typeof FavoriteListResponseSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>
