import type { Application, Job } from '@occ/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { useApplicationsStore } from '../../../../store/applications.store'
import { useJobsStore } from '../../../../store/jobs.store'
import AppliedScreen from './applied'

// Per `docs/MAP.md`'s test guidance and `index.test.tsx`'s precedent: mock
// the module boundaries this screen actually talks to (`applications.store`,
// `jobs.store`), not the network layer.
jest.mock('../../../../store/applications.store', () => ({
  useApplicationsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))
jest.mock('../../../../store/jobs.store', () => ({
  useJobsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))

const mockedUseApplicationsStore = useApplicationsStore as unknown as jest.Mock & {
  getState: jest.Mock
}
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

function makeApplication(overrides: Partial<Application> = {}): Application {
  const job = overrides.job ?? makeJob()
  return {
    jobId: job.id,
    appliedAt: '2026-06-01T00:00:00.000Z',
    job,
    ...overrides,
  }
}

interface StoreState {
  items: Application[]
  isLoading: boolean
  error: string | null
}

let fetchMock: jest.Mock
let removeMock: jest.Mock
let setActiveJob: jest.Mock

function setStoreState(state: StoreState): void {
  mockedUseApplicationsStore.mockImplementation((selector: (s: StoreState) => unknown) =>
    selector(state),
  )
  mockedUseApplicationsStore.getState.mockReturnValue({
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

describe('AppliedScreen', () => {
  it('calls applications.store.fetch() once on mount (R1)', async () => {
    render(<AppliedScreen />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('maps Application[] items to { id: jobId, job } rows correctly (R1)', () => {
    // Distinguishable mock data (different job ids/titles) to prove the
    // mapping isn't coincidentally correct.
    const applications = [
      makeApplication({ job: makeJob({ id: 'job-a', title: 'Frontend Dev' }) }),
      makeApplication({ job: makeJob({ id: 'job-b', title: 'Data Analyst' }) }),
    ]
    setStoreState({ items: applications, isLoading: false, error: null })

    render(<AppliedScreen />)

    expect(screen.getByText('Frontend Dev')).toBeTruthy()
    expect(screen.getByText('Data Analyst')).toBeTruthy()
  })

  it('tapping a row calls setActiveJob with the embedded job id and index (R8)', () => {
    const applications = [
      makeApplication({ job: makeJob({ id: 'job-a', title: 'Frontend Dev' }) }),
      makeApplication({ job: makeJob({ id: 'job-b', title: 'Data Analyst' }) }),
    ]
    setStoreState({ items: applications, isLoading: false, error: null })

    render(<AppliedScreen />)

    fireEvent.press(screen.getByText('Data Analyst'))

    expect(setActiveJob).toHaveBeenCalledWith('job-b', 1)
  })

  it('tapping Cancelar calls applications.store.remove with the application jobId (R3)', () => {
    const applications = [
      makeApplication({ job: makeJob({ id: 'job-a', title: 'Frontend Dev' }) }),
      makeApplication({ job: makeJob({ id: 'job-b', title: 'Data Analyst' }) }),
    ]
    setStoreState({ items: applications, isLoading: false, error: null })

    render(<AppliedScreen />)

    fireEvent.press(screen.getByLabelText('Cancelar Data Analyst'))

    expect(removeMock).toHaveBeenCalledWith('job-b')
  })

  it('renders ErrorState with retry calling fetch again when error and items empty (R6)', async () => {
    setStoreState({ items: [], isLoading: false, error: 'Network down' })

    render(<AppliedScreen />)

    expect(screen.getByText('No se pudo cargar la información')).toBeTruthy()

    fetchMock.mockClear()
    fireEvent.press(screen.getByText('Reintentar'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  it('renders EmptyState when done loading, no error, and items empty (R7)', () => {
    setStoreState({ items: [], isLoading: false, error: null })

    render(<AppliedScreen />)

    expect(screen.getByText('Sin postulaciones')).toBeTruthy()
  })
})

// A4 snapshot policy: this screen is declared complete (activities-screen
// ticket PASS), so its rendered output is pinned — populated variant, since
// the list body is the screen's main surface.
describe('AppliedScreen snapshot (A4 snapshot policy)', () => {
  it('matches the completed-screen snapshot with one application', () => {
    setStoreState({ items: [makeApplication()], isLoading: false, error: null })
    expect(render(<AppliedScreen />).toJSON()).toMatchSnapshot()
  })
})
