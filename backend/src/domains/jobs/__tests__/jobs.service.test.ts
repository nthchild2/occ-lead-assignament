import * as jobsService from '../jobs.service'
import { jobs } from '../jobs.seed'
import { AppError } from '../../../lib/errors'
import type { JobFilters, SortMode } from '../jobs.schema'

/**
 * Service unit tests — exercise the Express-free filter/sort/paginate/getById
 * logic directly against the seed, with no HTTP layer.
 */

// Full defaults matching the parsed `JobQuerySchema`; individual tests override.
const filters = (over: Partial<JobFilters> = {}): JobFilters => ({
  sort: 'date_desc',
  page: 1,
  limit: 20,
  ...over,
})

describe('jobs.service', () => {
  describe('seed integrity', () => {
    it('has at least 90 jobs (>= 4 pages at limit 20)', () => {
      expect(jobs.length).toBeGreaterThanOrEqual(90)
      expect(Math.ceil(jobs.length / 20)).toBeGreaterThanOrEqual(4)
    })

    it('includes some null-salary jobs and some priced jobs', () => {
      const nulls = jobs.filter((j) => j.salary === null)
      const priced = jobs.filter((j) => j.salary !== null)
      expect(nulls.length).toBeGreaterThan(0)
      expect(priced.length).toBeGreaterThan(0)
    })
  })

  describe('list · filtering', () => {
    it('q matches title case-insensitively (substring)', () => {
      const { items } = jobsService.list(filters({ q: 'react native', limit: 100 }))
      expect(items.length).toBeGreaterThan(0)
      for (const job of items) {
        const hit =
          job.title.toLowerCase().includes('react native') ||
          job.company.toLowerCase().includes('react native')
        expect(hit).toBe(true)
      }
    })

    it('q matches company case-insensitively', () => {
      const { items } = jobsService.list(filters({ q: 'kavak', limit: 100 }))
      expect(items.length).toBeGreaterThan(0)
      for (const job of items) {
        const hit =
          job.title.toLowerCase().includes('kavak') || job.company.toLowerCase().includes('kavak')
        expect(hit).toBe(true)
      }
    })

    it('city filters by exact (case-insensitive) match', () => {
      const { items } = jobsService.list(filters({ city: 'monterrey', limit: 100 }))
      expect(items.length).toBeGreaterThan(0)
      for (const job of items) {
        expect(job.city.toLowerCase()).toBe('monterrey')
      }
    })

    it('excludes null-salary jobs and honors range when salary_min is set', () => {
      const min = 50000
      const { items } = jobsService.list(filters({ salary_min: min, limit: 200 }))
      expect(items.length).toBeGreaterThan(0)
      for (const job of items) {
        expect(job.salary).not.toBeNull()
        expect(job.salary as number).toBeGreaterThanOrEqual(min)
      }
    })

    it('excludes null-salary jobs and honors range when salary_max is set', () => {
      const max = 60000
      const { items } = jobsService.list(filters({ salary_max: max, limit: 200 }))
      expect(items.length).toBeGreaterThan(0)
      for (const job of items) {
        expect(job.salary).not.toBeNull()
        expect(job.salary as number).toBeLessThanOrEqual(max)
      }
    })

    it('applies both salary bounds together', () => {
      const { items } = jobsService.list(
        filters({ salary_min: 40000, salary_max: 80000, limit: 200 }),
      )
      for (const job of items) {
        expect(job.salary).not.toBeNull()
        expect(job.salary as number).toBeGreaterThanOrEqual(40000)
        expect(job.salary as number).toBeLessThanOrEqual(80000)
      }
    })

    it('no filters returns the whole (paginated) set', () => {
      const { pagination } = jobsService.list(filters())
      expect(pagination.total).toBe(jobs.length)
    })
  })

  describe('list · sorting', () => {
    const allSorted = (sort: SortMode, q?: string) =>
      jobsService.list(filters({ sort, q, limit: 200 })).items

    it('date_desc orders newest first (default)', () => {
      const items = allSorted('date_desc')
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].publishedAt >= items[i].publishedAt).toBe(true)
      }
    })

    it('date_asc orders oldest first', () => {
      const items = allSorted('date_asc')
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].publishedAt <= items[i].publishedAt).toBe(true)
      }
    })

    it('salary_desc orders highest salary first with nulls last', () => {
      const items = allSorted('salary_desc')
      const priced = items.filter((j) => j.salary !== null)
      const nulls = items.filter((j) => j.salary === null)
      // nulls trail the priced ones
      expect(items.slice(items.length - nulls.length).every((j) => j.salary === null)).toBe(true)
      for (let i = 1; i < priced.length; i++) {
        expect((priced[i - 1].salary as number) >= (priced[i].salary as number)).toBe(true)
      }
    })

    it('salary_asc orders lowest salary first with nulls last', () => {
      const items = allSorted('salary_asc')
      const priced = items.filter((j) => j.salary !== null)
      const nulls = items.filter((j) => j.salary === null)
      expect(items.slice(items.length - nulls.length).every((j) => j.salary === null)).toBe(true)
      for (let i = 1; i < priced.length; i++) {
        expect((priced[i - 1].salary as number) <= (priced[i].salary as number)).toBe(true)
      }
    })

    it('relevance ranks title matches above company matches (with q)', () => {
      const q = 'engineer'
      const items = allSorted('relevance', q)
      const score = (title: string, company: string): number => {
        if (title.toLowerCase().includes(q)) return 2
        if (company.toLowerCase().includes(q)) return 1
        return 0
      }
      const scores = items.map((j) => score(j.title, j.company))
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
      }
    })

    it('relevance falls back to date_desc when q is absent', () => {
      const rel = allSorted('relevance')
      const dateDesc = allSorted('date_desc')
      expect(rel.map((j) => j.id)).toEqual(dateDesc.map((j) => j.id))
    })

    it('relevance breaks ties by publishedAt desc within the same score', () => {
      const q = 'engineer'
      const items = allSorted('relevance', q)
      const score = (title: string, company: string): number => {
        if (title.toLowerCase().includes(q)) return 2
        if (company.toLowerCase().includes(q)) return 1
        return 0
      }
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1]
        const cur = items[i]
        if (score(prev.title, prev.company) === score(cur.title, cur.company)) {
          expect(prev.publishedAt >= cur.publishedAt).toBe(true)
        }
      }
    })
  })

  describe('list · pagination boundaries', () => {
    const limit = 20
    const total = jobs.length
    const lastPage = Math.ceil(total / limit)

    it('first page: hasPrev false, hasNext true, total correct', () => {
      const { items, pagination } = jobsService.list(filters({ page: 1, limit }))
      expect(items).toHaveLength(limit)
      expect(pagination).toMatchObject({
        page: 1,
        limit,
        total,
        hasPrev: false,
        hasNext: true,
      })
    })

    it('a middle page: hasPrev and hasNext both true', () => {
      const { pagination } = jobsService.list(filters({ page: 2, limit }))
      expect(pagination.hasPrev).toBe(true)
      expect(pagination.hasNext).toBe(true)
    })

    it('last page: hasNext false, hasPrev true', () => {
      const { items, pagination } = jobsService.list(filters({ page: lastPage, limit }))
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(true)
      expect(items.length).toBe(total - (lastPage - 1) * limit)
    })

    it('a page beyond the data returns an empty window', () => {
      const { items, pagination } = jobsService.list(filters({ page: lastPage + 5, limit }))
      expect(items).toHaveLength(0)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(true)
      expect(pagination.total).toBe(total)
    })
  })

  describe('getById', () => {
    it('returns the job for an existing id', () => {
      const first = jobs[0]
      expect(jobsService.getById(first.id)).toEqual(first)
    })

    it('throws AppError NOT_FOUND for an unknown id', () => {
      expect(() => jobsService.getById('does-not-exist')).toThrow(AppError)
      try {
        jobsService.getById('does-not-exist')
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('NOT_FOUND')
        expect((err as AppError).status).toBe(404)
      }
    })
  })
})
