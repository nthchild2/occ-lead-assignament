import type { Job } from '@occ/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { useFavoritesStore } from '../../../../store/favorites.store'
import { useJobsStore } from '../../../../store/jobs.store'
import FavoritesScreen from './favorites'

// Per `docs/MAP.md`'s test guidance and `index.test.tsx`'s precedent: mock
// the module boundaries this screen actually talks to (`favorites.store`,
// `jobs.store`), not the network layer.
jest.mock('../../../../store/favorites.store', () => ({
  useFavoritesStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))
jest.mock('../../../../store/jobs.store', () => ({
  useJobsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))

const mockedUseFavoritesStore = useFavoritesStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedUseJobsStore = useJobsStore as unknown as jest.Mock & { getState: jest.Mock }

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme Corp',
    city: 'Ciudad de México',
    salary: 35000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: ['remote'],
    ...overrides,
  }
}

interface StoreState {
  items: Job[]
  isLoading: boolean
  error: string | null
}

let fetchMock: jest.Mock
let removeMock: jest.Mock
let setActiveJob: jest.Mock

function setStoreState(state: StoreState): void {
  mockedUseFavoritesStore.mockImplementation((selector: (s: StoreState) => unknown) =>
    selector(state),
  )
  mockedUseFavoritesStore.getState.mockReturnValue({
    ...state,
    fetch: fetchMock,
    remove: removeMock,
  })
}

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue(undefined)
  removeMock = jest.fn().mockResolvedValue(undefined)
  setActiveJob = jest.fn()
  mockedUseJobsStore.getState.mockReturnValue({ setActiveJob })
  setStoreState({ items: [], isLoading: false, error: null })
})

describe('FavoritesScreen', () => {
  it('calls favorites.store.fetch() once on mount (R2)', async () => {
    render(<FavoritesScreen />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('maps Job[] items to { id, job } rows via the identity adapter (R2)', () => {
    // Distinguishable mock data (different job ids/titles) to prove the
    // mapping isn't coincidentally correct.
    const jobs = [
      makeJob({ id: 'job-a', title: 'Frontend Dev' }),
      makeJob({ id: 'job-b', title: 'Data Analyst' }),
    ]
    setStoreState({ items: jobs, isLoading: false, error: null })

    render(<FavoritesScreen />)

    expect(screen.getByText('Frontend Dev')).toBeTruthy()
    expect(screen.getByText('Data Analyst')).toBeTruthy()
  })

  it('tapping a row calls setActiveJob with the job id and index, no .job unwrap (R8)', () => {
    const jobs = [
      makeJob({ id: 'job-a', title: 'Frontend Dev' }),
      makeJob({ id: 'job-b', title: 'Data Analyst' }),
    ]
    setStoreState({ items: jobs, isLoading: false, error: null })

    render(<FavoritesScreen />)

    fireEvent.press(screen.getByText('Data Analyst'))

    expect(setActiveJob).toHaveBeenCalledWith('job-b', 1)
  })

  it('tapping Quitar calls favorites.store.remove with the job id (R4)', () => {
    const jobs = [
      makeJob({ id: 'job-a', title: 'Frontend Dev' }),
      makeJob({ id: 'job-b', title: 'Data Analyst' }),
    ]
    setStoreState({ items: jobs, isLoading: false, error: null })

    render(<FavoritesScreen />)

    fireEvent.press(screen.getByLabelText('Quitar Data Analyst'))

    expect(removeMock).toHaveBeenCalledWith('job-b')
  })

  it('renders ErrorState with retry calling fetch again when error and items empty (R6)', async () => {
    setStoreState({ items: [], isLoading: false, error: 'Network down' })

    render(<FavoritesScreen />)

    expect(screen.getByText('No se pudo cargar la información')).toBeTruthy()

    fetchMock.mockClear()
    fireEvent.press(screen.getByText('Reintentar'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('renders EmptyState when done loading, no error, and items empty (R7)', () => {
    setStoreState({ items: [], isLoading: false, error: null })

    render(<FavoritesScreen />)

    expect(screen.getByText('Sin favoritos')).toBeTruthy()
  })
})
