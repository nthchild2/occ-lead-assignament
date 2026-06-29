import { z } from 'zod'

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  city: z.string(),
  salary: z.number().nullable(),
  description: z.string(),
  publishedAt: z.string().datetime(),
  tags: z.array(z.string()),
})

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export const JobFiltersSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  sort: z
    .enum(['date_desc', 'date_asc', 'salary_desc', 'salary_asc', 'relevance'])
    .optional()
    .default('date_desc'),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export const JobListResponseSchema = z.object({
  data: z.object({
    items: z.array(JobSchema),
    pagination: PaginationSchema,
  }),
})

export const JobDetailResponseSchema = z.object({
  data: JobSchema,
})

export type Job = z.infer<typeof JobSchema>
export type Pagination = z.infer<typeof PaginationSchema>
export type JobFilters = z.infer<typeof JobFiltersSchema>
export type JobListResponse = z.infer<typeof JobListResponseSchema>
export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>
