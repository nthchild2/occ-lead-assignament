import type { Job } from '@occ/shared'

import { isJobApplied, isJobFavorited } from './activityStatus'
import { useApplicationsStore } from '../../store/applications.store'
import { useFavoritesStore } from '../../store/favorites.store'

// Directly seeds store state via `setState` — does not go through
// `fetch`/`add`, keeping this test isolated from the service-mocking
// machinery in `applications.store.test.ts`/`favorites.store.test.ts`.

function job(id: string): Job {
  return {
    id,
    title: `Developer ${id}`,
    company: 'Acme',
    city: 'CDMX',
    salary: 20000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['react'],
  }
}

beforeEach(() => {
  useApplicationsStore.setState({ items: [], isLoading: false, error: null })
  useFavoritesStore.setState({ items: [], isLoading: false, error: null })
})

describe('activityStatus', () => {
  it('isJobApplied returns true when the job id is present in applications.store (R6)', () => {
    useApplicationsStore.setState({
      items: [{ jobId: 'job-1', appliedAt: '2026-07-01T00:00:00.000Z', job: job('job-1') }],
    })

    expect(isJobApplied('job-1')).toBe(true)
  })

  it('isJobApplied returns false for a non-matching id (R6)', () => {
    useApplicationsStore.setState({
      items: [{ jobId: 'job-1', appliedAt: '2026-07-01T00:00:00.000Z', job: job('job-1') }],
    })

    expect(isJobApplied('job-2')).toBe(false)
  })

  it('isJobApplied returns false for an empty store (R6)', () => {
    expect(isJobApplied('job-1')).toBe(false)
  })

  it('isJobFavorited returns true when the job id is present in favorites.store (R6)', () => {
    useFavoritesStore.setState({ items: [job('job-1')] })

    expect(isJobFavorited('job-1')).toBe(true)
  })

  it('isJobFavorited returns false for a non-matching id (R6)', () => {
    useFavoritesStore.setState({ items: [job('job-1')] })

    expect(isJobFavorited('job-2')).toBe(false)
  })

  it('isJobFavorited returns false for an empty store (R6)', () => {
    expect(isJobFavorited('job-1')).toBe(false)
  })

  it('a job present in only applications.store is applied but not favorited (R6)', () => {
    useApplicationsStore.setState({
      items: [{ jobId: 'job-1', appliedAt: '2026-07-01T00:00:00.000Z', job: job('job-1') }],
    })

    expect(isJobApplied('job-1')).toBe(true)
    expect(isJobFavorited('job-1')).toBe(false)
  })

  it('a job present in only favorites.store is favorited but not applied (R6)', () => {
    useFavoritesStore.setState({ items: [job('job-2')] })

    expect(isJobFavorited('job-2')).toBe(true)
    expect(isJobApplied('job-2')).toBe(false)
  })

  it('a job present in neither store is neither applied nor favorited (R6)', () => {
    expect(isJobApplied('job-3')).toBe(false)
    expect(isJobFavorited('job-3')).toBe(false)
  })
})
