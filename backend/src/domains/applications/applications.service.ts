import { AppError } from '../../lib/errors'
import type { Job } from '@occ/shared'
import type { Application } from './applications.schema'

/**
 * Applications domain logic — Express-free by design (A1 Decision 4). Job
 * existence/lookup is received via dependency injection (`getJob`), never by
 * importing `domains/jobs` directly, so the applications domain stays decoupled
 * from the jobs domain (A1 Decision 3 / spec R9).
 */

export interface ApplicationsDeps {
  getJob: (id: string) => Job
}

/**
 * Per-user, per-job application state, keyed by user id then job id. Module-level
 * so it persists for the process lifetime (in-memory only — A1 Decision 5
 * sanctioned tech debt; no persistence across restarts or instances).
 */
const applicationsByUser = new Map<string, Map<string, Application>>()

const applicationsFor = (userId: string): Map<string, Application> => {
  const existing = applicationsByUser.get(userId)
  if (existing) return existing

  const created = new Map<string, Application>()
  applicationsByUser.set(userId, created)
  return created
}

/**
 * Build the applications service. `getJob` is called first in `apply` so a
 * missing job surfaces its own `AppError('NOT_FOUND')` for free, without the
 * applications domain knowing anything about how jobs are stored.
 */
export const createApplicationsService = ({ getJob }: ApplicationsDeps) => ({
  /**
   * Register an application for `userId` on `jobId`. Throws `NOT_FOUND` (via
   * `getJob`) if the job doesn't exist, or `ALREADY_APPLIED` if the user already
   * applied to it.
   */
  apply: (userId: string, jobId: string): Application => {
    const job = getJob(jobId)
    const applications = applicationsFor(userId)

    if (applications.has(jobId)) {
      throw new AppError('ALREADY_APPLIED', `Ya existe una postulación a la vacante ${jobId}`)
    }

    const application: Application = {
      jobId,
      appliedAt: new Date().toISOString(),
      job,
    }
    applications.set(jobId, application)
    return application
  },

  /** Cancel an existing application. Throws `NOT_FOUND` if none exists. */
  cancel: (userId: string, jobId: string): void => {
    const applications = applicationsFor(userId)
    if (!applications.has(jobId)) {
      throw new AppError('NOT_FOUND', `No existe una postulación a la vacante ${jobId}`)
    }
    applications.delete(jobId)
  },

  /** List the current user's applications (empty list if none). */
  list: (userId: string): { items: Application[] } => ({
    items: Array.from(applicationsFor(userId).values()),
  }),
})

export type ApplicationsService = ReturnType<typeof createApplicationsService>
