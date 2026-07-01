import { AppError } from '../../lib/errors'
import { jobs } from './jobs.seed'
import type { Job, JobFilters, Pagination, SortMode } from './jobs.schema'

/**
 * Jobs domain logic — Express-free by design (A1 Decision 4). Owns all
 * filter → sort → paginate logic over the in-memory seed plus `getById`, and
 * surfaces the not-found case as an `AppError` so the router/error middleware do
 * the HTTP translation.
 */

/** The seed is read-only; every read starts from this immutable source. */
const source: readonly Job[] = jobs

const contains = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.toLowerCase())

/** `q` matches when the (lowercased) title OR company contains the term. */
const matchesQuery = (job: Job, q: string): boolean =>
  contains(job.title, q) || contains(job.company, q)

/** `city` is a case-insensitive exact match. */
const matchesCity = (job: Job, city: string): boolean =>
  job.city.toLowerCase() === city.toLowerCase()

/**
 * Salary range. When either bound is present, jobs with `salary === null` are
 * excluded; a non-null salary must then fall within `[min, max]`.
 */
const matchesSalary = (job: Job, min?: number, max?: number): boolean => {
  if (min === undefined && max === undefined) return true
  if (job.salary === null) return false
  if (min !== undefined && job.salary < min) return false
  if (max !== undefined && job.salary > max) return false
  return true
}

const applyFilters = (list: readonly Job[], filters: JobFilters): Job[] =>
  list.filter(
    (job) =>
      (filters.q === undefined || matchesQuery(job, filters.q)) &&
      (filters.city === undefined || matchesCity(job, filters.city)) &&
      matchesSalary(job, filters.salary_min, filters.salary_max),
  )

type Comparator = (a: Job, b: Job) => number

const byDateDesc: Comparator = (a, b) => b.publishedAt.localeCompare(a.publishedAt)
const byDateAsc: Comparator = (a, b) => a.publishedAt.localeCompare(b.publishedAt)

/** Null salaries sort last regardless of direction. */
const bySalary = (a: Job, b: Job, dir: number): number => {
  if (a.salary === null && b.salary === null) return 0
  if (a.salary === null) return 1
  if (b.salary === null) return -1
  return (a.salary - b.salary) * dir
}

/** Higher `q`-relevance first: title match (2) > company match (1) > none (0). */
const relevanceScore = (job: Job, q: string): number => {
  if (job.title.toLowerCase().includes(q.toLowerCase())) return 2
  if (job.company.toLowerCase().includes(q.toLowerCase())) return 1
  return 0
}

/**
 * Build a comparator per sort mode. `relevance` needs `q`; when `q` is absent it
 * falls back to `date_desc` (decision #2). The `publishedAt` desc tiebreak keeps
 * equal-score jobs newest-first.
 */
const comparatorFor = (sort: SortMode, q?: string): Comparator => {
  const comparators: Record<SortMode, Comparator> = {
    date_desc: byDateDesc,
    date_asc: byDateAsc,
    salary_desc: (a, b) => bySalary(a, b, -1),
    salary_asc: (a, b) => bySalary(a, b, 1),
    relevance:
      q === undefined
        ? byDateDesc
        : (a, b) => relevanceScore(b, q) - relevanceScore(a, q) || byDateDesc(a, b),
  }
  return comparators[sort]
}

const applySort = (list: Job[], filters: JobFilters): Job[] =>
  [...list].sort(comparatorFor(filters.sort, filters.q))

/** Offset pagination; derives `total`/`hasNext`/`hasPrev` from the window. */
const paginate = (
  list: Job[],
  page: number,
  limit: number,
): { items: Job[]; pagination: Pagination } => {
  const total = list.length
  const start = (page - 1) * limit
  const items = list.slice(start, start + limit)
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      hasNext: start + limit < total,
      hasPrev: page > 1,
    },
  }
}

/** Filter → sort → paginate the seed, returning the list-response payload. */
export const list = (filters: JobFilters): { items: Job[]; pagination: Pagination } => {
  const filtered = applyFilters(source, filters)
  const sorted = applySort(filtered, filters)
  return paginate(sorted, filters.page, filters.limit)
}

/** Return a job by id, or throw `AppError('NOT_FOUND')` if none matches. */
export const getById = (id: string): Job => {
  const job = source.find((candidate) => candidate.id === id)
  if (!job) {
    throw new AppError('NOT_FOUND', `No existe la vacante con id ${id}`)
  }
  return job
}
