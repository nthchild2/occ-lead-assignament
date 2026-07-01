import type { Job, Pagination } from '@occ/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type React from 'react'
import { InteractionManager } from 'react-native'
import type * as ReactNative from 'react-native'

import * as activityStatus from '../../core/lib/activityStatus'
import { useJobs } from '../../core/hooks/useJobs'
import { ApiError } from '../../core/services/api'
import * as jobsService from '../../core/services/jobs.service'
import { useApplicationsStore } from '../../store/applications.store'
import { useFavoritesStore } from '../../store/favorites.store'
import { useJobsStore } from '../../store/jobs.store'
import JobDetail from './JobDetail'

// `@gorhom/bottom-sheet` transitively imports `react-native-gesture-handler`,
// which crashes at import time under `jest-expo` here (an
// `ReactNativeRenderer-dev.js` internal throws — the same class of
// ESM/native-module incompatibility `job-search-screen` hit with
// `@shopify/flash-list`, per `docs/MAP.md`). A real render was attempted
// first; it crashes before any test body runs. Per the plan, this mocks the
// module boundary in this test file only (never the shared jest config) with
// a minimal `ScrollView` stand-in — sufficient since this component only
// needs `BottomSheetScrollView` to render its children as a scroll
// container, not any gesture/animation behavior.
jest.mock('@gorhom/bottom-sheet', () => {
  const mockRN = jest.requireActual('react-native') as typeof ReactNative
  return {
    BottomSheetScrollView: mockRN.ScrollView,
  }
})

// `react-native-gesture-handler`'s real `Gesture.Pan()`/`GestureDetector`
// depend on the native gesture-recognizer runtime, which isn't meaningfully
// exercisable under `jest-expo`/RNTL (same class of native-module boundary
// as the `@gorhom/bottom-sheet` mock above). Per the plan, this is a scoped
// mock (this test file only) that renders `GestureDetector`'s children
// directly and returns a chainable `Gesture.Pan()` stub whose configuration
// methods (`enabled`/`activeOffsetX`/`failOffsetY`/`onEnd`) just record
// their arguments and return `this` — the captured `onEnd` callback is what
// the tests below invoke directly with synthetic event payloads.
//
// IMPORTANT — testing boundary: this does NOT simulate real finger-swipe
// touch physics, native gesture-recognizer activation, or velocity/distance
// thresholds as evaluated by the native runtime. It only exercises the
// *outcome* logic reachable through the captured `onEnd` callback (index
// computation, `setActiveJob`, prefetch scheduling, end-of-results
// flagging) — mirrors `index.test.tsx`'s `onEndReached`/`_layout.test.tsx`'s
// `onDismiss` precedent of invoking captured callbacks directly rather than
// simulating native behavior.
let capturedOnEnd: ((event: { translationX: number; velocityX: number }) => void) | null = null
let capturedEnabled: boolean | null = null

jest.mock('react-native-gesture-handler', () => {
  const mockReact = jest.requireActual('react') as typeof React

  function makePanGestureStub() {
    const stub = {
      enabled: (value: boolean) => {
        capturedEnabled = value
        return stub
      },
      activeOffsetX: () => stub,
      failOffsetY: () => stub,
      onEnd: (callback: (event: { translationX: number; velocityX: number }) => void) => {
        capturedOnEnd = callback
        return stub
      },
    }
    return stub
  }

  return {
    Gesture: { Pan: makePanGestureStub },
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  }
})

// Per `docs/MAP.md`'s test guidance and `login.test.tsx`/`index.test.tsx`
// precedent: mock the module boundaries this component actually talks to
// (`jobs.store`, `applications.store`, `favorites.store`, `activityStatus`,
// `useJobs`, and `jobs.service`'s `getById`), not the network layer — those
// already have their own unit tests.
jest.mock('../../store/jobs.store', () => ({
  useJobsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))
jest.mock('../../store/applications.store', () => ({
  useApplicationsStore: { getState: jest.fn() },
}))
jest.mock('../../store/favorites.store', () => ({
  useFavoritesStore: { getState: jest.fn() },
}))
jest.mock('../../core/lib/activityStatus', () => ({
  isJobApplied: jest.fn(),
  isJobFavorited: jest.fn(),
}))
jest.mock('../../core/services/jobs.service', () => ({
  getById: jest.fn(),
}))
jest.mock('../../core/hooks/useJobs', () => ({
  useJobs: jest.fn(),
}))

const mockedUseJobsStore = useJobsStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedApplicationsGetState = useApplicationsStore.getState as jest.Mock
const mockedFavoritesGetState = useFavoritesStore.getState as jest.Mock
const mockedIsJobApplied = activityStatus.isJobApplied as jest.Mock
const mockedIsJobFavorited = activityStatus.isJobFavorited as jest.Mock
const mockedGetById = jobsService.getById as jest.Mock
const mockedUseJobs = useJobs as jest.Mock
let mockedRunAfterInteractions: jest.SpiedFunction<typeof InteractionManager.runAfterInteractions>

// `InteractionManager.runAfterInteractions`'s real return value is a
// `{ then, done, cancel }` handle — not used by production code here (the
// call site in `JobDetail.tsx` discards the return value), so this stub is
// a sufficient stand-in for both mock implementations below. Production
// code only ever passes a plain `() => void` callback (never a
// `SimpleTask`/`PromiseTask` object), so the mock only needs to handle that
// shape.
function fakeInteractionHandle(): ReturnType<typeof InteractionManager.runAfterInteractions> {
  return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() } as unknown as ReturnType<
    typeof InteractionManager.runAfterInteractions
  >
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme Corp',
    city: 'Ciudad de México',
    salary: 35000,
    description: 'Great role building things.',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['react', 'node'],
    ...overrides,
  }
}

const readyPagination: Pagination = { page: 1, limit: 20, total: 20, hasNext: true, hasPrev: false }
const donePagination: Pagination = { page: 1, limit: 20, total: 1, hasNext: false, hasPrev: false }

interface SwipeState {
  activeJobId: string | null
  activeJobIndex: number | null
  jobs: Job[]
  pagination: Pagination
  error: string | null
}

function setActiveJobId(
  activeJobId: string | null,
  jobs: Job[],
  overrides: Partial<Omit<SwipeState, 'activeJobId' | 'jobs'>> = {},
): jest.Mock {
  const setActiveJob = jest.fn()
  // `'activeJobIndex' in overrides` (not `??`) so an explicit
  // `activeJobIndex: null` override (R3's "cleared state" case) isn't
  // silently replaced by the computed default — `??` can't distinguish
  // "not provided" from "explicitly null" when the override value is itself
  // `null`.
  const defaultIndex = activeJobId
    ? (() => {
        const found = jobs.findIndex((j) => j.id === activeJobId)
        return found === -1 ? null : found
      })()
    : null
  const state: SwipeState = {
    activeJobId,
    jobs,
    activeJobIndex:
      'activeJobIndex' in overrides ? (overrides.activeJobIndex ?? null) : defaultIndex,
    pagination: overrides.pagination ?? readyPagination,
    error: overrides.error ?? null,
  }
  mockedUseJobsStore.mockImplementation((selector: (s: SwipeState) => unknown) => selector(state))
  mockedUseJobsStore.getState.mockReturnValue({ ...state, setActiveJob })
  return setActiveJob
}

let applicationsAdd: jest.Mock
let favoritesAdd: jest.Mock
let favoritesRemove: jest.Mock
let fetchNextPage: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  capturedOnEnd = null
  capturedEnabled = null
  applicationsAdd = jest.fn().mockResolvedValue(undefined)
  favoritesAdd = jest.fn().mockResolvedValue(undefined)
  favoritesRemove = jest.fn().mockResolvedValue(undefined)
  fetchNextPage = jest.fn().mockResolvedValue(undefined)
  mockedApplicationsGetState.mockReturnValue({ add: applicationsAdd })
  mockedFavoritesGetState.mockReturnValue({ add: favoritesAdd, remove: favoritesRemove })
  mockedIsJobApplied.mockReturnValue(false)
  mockedIsJobFavorited.mockReturnValue(false)
  mockedUseJobs.mockReturnValue({ fetchNextPage, refetch: jest.fn(), fetchPage: jest.fn() })
  mockedRunAfterInteractions = jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation((task) => {
      if (typeof task === 'function') task()
      return fakeInteractionHandle()
    })
})

afterEach(() => {
  mockedRunAfterInteractions.mockRestore()
})

describe('JobDetail', () => {
  it('renders all job fields when found in jobs.store.jobs (R3)', () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])

    render(<JobDetail />)

    expect(screen.getByText('Backend Engineer')).toBeTruthy()
    expect(screen.getByText('Acme Corp · Ciudad de México')).toBeTruthy()
    expect(screen.getByText('$35,000')).toBeTruthy()
    expect(screen.getByText('Great role building things.')).toBeTruthy()
    expect(screen.getByText('react')).toBeTruthy()
    expect(screen.getByText('node')).toBeTruthy()
    expect(screen.getByText(/Publicado el/)).toBeTruthy()
  })

  it('hides the salary line when salary is null (R3)', () => {
    const job = makeJob({ salary: null })
    setActiveJobId('job-1', [job])

    render(<JobDetail />)

    expect(screen.queryByText(/\$/)).toBeNull()
  })

  it('falls back to jobsService.getById when the job is not in jobs.store.jobs, showing a loading state first (R9)', async () => {
    const job = makeJob({ id: 'job-2', title: 'Fetched Job' })
    let resolveGetById: (value: { data: Job }) => void = () => {}
    mockedGetById.mockReturnValue(
      new Promise((resolve) => {
        resolveGetById = resolve
      }),
    )
    setActiveJobId('job-2', [])

    render(<JobDetail />)

    // Loading branch: job not yet rendered.
    expect(screen.queryByText('Fetched Job')).toBeNull()

    resolveGetById({ data: job })

    await waitFor(() => {
      expect(screen.getByText('Fetched Job')).toBeTruthy()
    })
    expect(mockedGetById).toHaveBeenCalledWith('job-2')
  })

  it('shows an error state with retry when jobsService.getById rejects (R9)', async () => {
    mockedGetById.mockRejectedValueOnce(new ApiError('NOT_FOUND', 'No se encontró la vacante'))
    setActiveJobId('job-3', [])

    render(<JobDetail />)

    await waitFor(() => {
      expect(screen.getByText('No se encontró la vacante')).toBeTruthy()
    })

    mockedGetById.mockResolvedValueOnce({ data: makeJob({ id: 'job-3', title: 'Retried Job' }) })
    fireEvent.press(screen.getByText('Reintentar'))

    await waitFor(() => {
      expect(screen.getByText('Retried Job')).toBeTruthy()
    })
  })

  it('Apply calls applications.store.add(jobId, job) when not yet applied (R5)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobApplied.mockReturnValue(false)

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Aplicar'))

    await waitFor(() => {
      expect(applicationsAdd).toHaveBeenCalledWith('job-1', job)
    })
  })

  it('shows "Ya aplicaste" disabled when already applied, and does not call add again (R5)', () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobApplied.mockReturnValue(true)

    render(<JobDetail />)

    const button = screen.getByText('Ya aplicaste')
    expect(button).toBeTruthy()
    fireEvent.press(button)

    expect(applicationsAdd).not.toHaveBeenCalled()
  })

  it('Favorite calls favorites.store.add(job) when not favorited (R6)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobFavorited.mockReturnValue(false)

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Agregar a favoritos'))

    await waitFor(() => {
      expect(favoritesAdd).toHaveBeenCalledWith(job)
    })
    expect(favoritesRemove).not.toHaveBeenCalled()
  })

  it('Favorite calls favorites.store.remove(jobId) when already favorited (R6)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobFavorited.mockReturnValue(true)

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Quitar de favoritos'))

    await waitFor(() => {
      expect(favoritesRemove).toHaveBeenCalledWith('job-1')
    })
    expect(favoritesAdd).not.toHaveBeenCalled()
  })

  it('shows an inline message without crashing when add() rejects with ALREADY_APPLIED (R8)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobApplied.mockReturnValue(false)
    applicationsAdd.mockRejectedValueOnce(
      new ApiError('ALREADY_APPLIED', 'Ya existe una postulación a esta vacante'),
    )

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Aplicar'))

    await waitFor(() => {
      expect(screen.getByText('Ya existe una postulación a esta vacante')).toBeTruthy()
    })
    // The sheet's own content stays mounted — no crash, no unmount.
    expect(screen.getByText('Backend Engineer')).toBeTruthy()
  })

  it('shows a generic inline message on a non-ApiError rejection from add() (R7)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobApplied.mockReturnValue(false)
    applicationsAdd.mockRejectedValueOnce(new Error('network exploded'))

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Aplicar'))

    await waitFor(() => {
      expect(screen.getByText('No se pudo completar la operación. Intenta de nuevo.')).toBeTruthy()
    })
  })

  it('shows an inline message without crashing when favorite toggle rejects with ALREADY_FAVORITED (R8)', async () => {
    const job = makeJob()
    setActiveJobId('job-1', [job])
    mockedIsJobFavorited.mockReturnValue(false)
    favoritesAdd.mockRejectedValueOnce(
      new ApiError('ALREADY_FAVORITED', 'Ya está en tus favoritos'),
    )

    render(<JobDetail />)
    fireEvent.press(screen.getByText('Agregar a favoritos'))

    await waitFor(() => {
      expect(screen.getByText('Ya está en tus favoritos')).toBeTruthy()
    })
    expect(screen.getByText('Backend Engineer')).toBeTruthy()
  })
})

// Testing boundary (see the `react-native-gesture-handler` mock comment
// above): these tests invoke the captured `onEnd` callback directly with
// synthetic `{ translationX, velocityX }` payloads to exercise the swipe
// *outcome* logic (index computation, `setActiveJob`, prefetch scheduling,
// end-of-results flagging) — they do not and cannot simulate real
// finger-swipe touch physics or native gesture-recognizer activation.
describe('JobDetail swipe', () => {
  const jobs = [makeJob({ id: 'a' }), makeJob({ id: 'b' }), makeJob({ id: 'c' })]

  it('a left swipe (negative translationX past the threshold) advances to the next job and calls setActiveJob (R1, R2)', () => {
    const setActiveJob = setActiveJobId('b', jobs, { activeJobIndex: 1 })
    render(<JobDetail />)

    expect(capturedOnEnd).not.toBeNull()
    capturedOnEnd?.({ translationX: -120, velocityX: -50 })

    expect(setActiveJob).toHaveBeenCalledWith('c', 2)
  })

  it('a right swipe (positive translationX past the threshold) goes back to the previous job and calls setActiveJob (R1, R2)', () => {
    const setActiveJob = setActiveJobId('b', jobs, { activeJobIndex: 1 })
    render(<JobDetail />)

    capturedOnEnd?.({ translationX: 120, velocityX: 50 })

    expect(setActiveJob).toHaveBeenCalledWith('a', 0)
  })

  it('a swipe below both the distance and velocity threshold is a no-op (does not call setActiveJob)', () => {
    const setActiveJob = setActiveJobId('b', jobs, { activeJobIndex: 1 })
    render(<JobDetail />)

    capturedOnEnd?.({ translationX: -10, velocityX: 10 })

    expect(setActiveJob).not.toHaveBeenCalled()
  })

  it('a fast flick that crosses only the velocity threshold still advances (R1)', () => {
    const setActiveJob = setActiveJobId('b', jobs, { activeJobIndex: 1 })
    render(<JobDetail />)

    capturedOnEnd?.({ translationX: -20, velocityX: -1000 })

    expect(setActiveJob).toHaveBeenCalledWith('c', 2)
  })

  it('is disabled (no-op, enabled(false)) when activeJobIndex is null (R3)', async () => {
    // `activeJobIndex: null` with a job resolved via the fallback-fetch path
    // (job not in `jobs` — mirrors `useActiveJob`'s R9 branch).
    const fetchedJob = makeJob({ id: 'd' })
    mockedGetById.mockResolvedValue({ data: fetchedJob })
    const setActiveJob = setActiveJobId('d', jobs, { activeJobIndex: null })
    render(<JobDetail />)

    await waitFor(() => {
      expect(screen.getByText(fetchedJob.title)).toBeTruthy()
    })

    expect(capturedEnabled).toBe(false)
    capturedOnEnd?.({ translationX: -120, velocityX: -50 })

    expect(setActiveJob).not.toHaveBeenCalled()
  })

  it('is disabled (no-op, enabled(false)) when jobs[activeJobIndex].id !== activeJobId (mismatch case) (R3)', async () => {
    // `activeJobIndex: 1` is stale/left over from a previous job (`jobs[1]`
    // is `'b'`), while the currently-shown job (`'z'`) is not in `jobs` and
    // is resolved via the fallback-fetch path instead — exactly the
    // `useActiveJob` R9 scenario the mismatch guard exists for.
    const fetchedJob = makeJob({ id: 'z' })
    mockedGetById.mockResolvedValue({ data: fetchedJob })
    const setActiveJob = setActiveJobId('z', jobs, { activeJobIndex: 1 })
    render(<JobDetail />)

    await waitFor(() => {
      expect(screen.getByText(fetchedJob.title)).toBeTruthy()
    })

    expect(capturedEnabled).toBe(false)
    capturedOnEnd?.({ translationX: -120, velocityX: -50 })

    expect(setActiveJob).not.toHaveBeenCalled()
  })

  it('when within 3 of the end and pagination.hasNext is true, fetchNextPage fires only after InteractionManager.runAfterInteractions (R4, R5)', () => {
    // 3 jobs total, swiping from index 0 -> 1 leaves 2 remaining (<=3).
    setActiveJobId('a', jobs, { activeJobIndex: 0, pagination: readyPagination })
    const deferred: { callback: (() => void) | null } = { callback: null }
    mockedRunAfterInteractions.mockImplementation((task) => {
      deferred.callback = typeof task === 'function' ? task : null
      return fakeInteractionHandle()
    })
    render(<JobDetail />)

    capturedOnEnd?.({ translationX: -120, velocityX: -50 })

    // Not called synchronously during the gesture callback itself.
    expect(fetchNextPage).not.toHaveBeenCalled()
    expect(mockedRunAfterInteractions).toHaveBeenCalledTimes(1)

    deferred.callback?.()
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('does not schedule a prefetch when not within 3 of the end', () => {
    const manyJobs = Array.from({ length: 10 }, (_, i) => makeJob({ id: `job-${i}` }))
    setActiveJobId('job-0', manyJobs, { activeJobIndex: 0, pagination: readyPagination })
    render(<JobDetail />)

    capturedOnEnd?.({ translationX: -120, velocityX: -50 })

    expect(mockedRunAfterInteractions).not.toHaveBeenCalled()
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('at the last loaded job with hasNext false, a further left swipe does not advance and renders the end-of-results indicator (R6)', () => {
    const setActiveJob = setActiveJobId('c', jobs, {
      activeJobIndex: 2,
      pagination: donePagination,
    })
    render(<JobDetail />)

    act(() => {
      capturedOnEnd?.({ translationX: -120, velocityX: -50 })
    })

    expect(setActiveJob).not.toHaveBeenCalled()
    expect(screen.getByText('No hay más vacantes por mostrar.')).toBeTruthy()
  })

  it('at the last loaded job with a stale prefetch error set, a further left swipe shows the end-of-results indicator instead of erroring (R6)', () => {
    const setActiveJob = setActiveJobId('c', jobs, {
      activeJobIndex: 2,
      pagination: readyPagination,
      error: 'prefetch failed',
    })
    render(<JobDetail />)

    act(() => {
      capturedOnEnd?.({ translationX: -120, velocityX: -50 })
    })

    expect(setActiveJob).not.toHaveBeenCalled()
    expect(screen.getByText('No hay más vacantes por mostrar.')).toBeTruthy()
  })
})
