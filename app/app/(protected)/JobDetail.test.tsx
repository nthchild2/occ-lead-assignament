import type { Job } from '@occ/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type * as ReactNative from 'react-native'

import * as activityStatus from '../../core/lib/activityStatus'
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

// Per `docs/MAP.md`'s test guidance and `login.test.tsx`/`index.test.tsx`
// precedent: mock the module boundaries this component actually talks to
// (`jobs.store`, `applications.store`, `favorites.store`, `activityStatus`,
// and `jobs.service`'s `getById`), not the network layer — those already
// have their own unit tests.
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

const mockedUseJobsStore = useJobsStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedApplicationsGetState = useApplicationsStore.getState as jest.Mock
const mockedFavoritesGetState = useFavoritesStore.getState as jest.Mock
const mockedIsJobApplied = activityStatus.isJobApplied as jest.Mock
const mockedIsJobFavorited = activityStatus.isJobFavorited as jest.Mock
const mockedGetById = jobsService.getById as jest.Mock

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

function setActiveJobId(activeJobId: string | null, jobs: Job[]): void {
  const state = { activeJobId, jobs }
  mockedUseJobsStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state))
  mockedUseJobsStore.getState.mockReturnValue(state)
}

let applicationsAdd: jest.Mock
let favoritesAdd: jest.Mock
let favoritesRemove: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  applicationsAdd = jest.fn().mockResolvedValue(undefined)
  favoritesAdd = jest.fn().mockResolvedValue(undefined)
  favoritesRemove = jest.fn().mockResolvedValue(undefined)
  mockedApplicationsGetState.mockReturnValue({ add: applicationsAdd })
  mockedFavoritesGetState.mockReturnValue({ add: favoritesAdd, remove: favoritesRemove })
  mockedIsJobApplied.mockReturnValue(false)
  mockedIsJobFavorited.mockReturnValue(false)
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
