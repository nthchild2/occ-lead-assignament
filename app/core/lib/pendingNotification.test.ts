import { consumePendingJobId, setPendingJobId } from './pendingNotification'

// R5: read-and-clear semantics — `consumePendingJobId()` must both return
// the held value and reset it, so a second consume never re-delivers the
// same notification's job id.
describe('pendingNotification', () => {
  afterEach(() => {
    // Reset module-level state between tests so assertions never leak
    // across test cases (this holder is intentionally not test-isolated by
    // Jest's module registry the way a fresh `create()`d store would be).
    setPendingJobId(null)
  })

  it('returns null when nothing was set', () => {
    expect(consumePendingJobId()).toBeNull()
  })

  it('set then consume returns the held id', () => {
    setPendingJobId('job-42')

    expect(consumePendingJobId()).toBe('job-42')
  })

  it('a second consume call after a successful consume returns null (read-and-clear)', () => {
    setPendingJobId('job-42')

    expect(consumePendingJobId()).toBe('job-42')
    expect(consumePendingJobId()).toBeNull()
  })

  it('setPendingJobId(null) clears a previously held id', () => {
    setPendingJobId('job-1')
    setPendingJobId(null)

    expect(consumePendingJobId()).toBeNull()
  })
})
