import type { Job } from '@occ/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type React from 'react'
import type * as ReactNative from 'react-native'

import { JobCardSkeleton } from '../../../core/components'
import { useJobs } from '../../../core/hooks/useJobs'
import { useJobsStore } from '../../../store/jobs.store'
import SearchScreen from './index'

// Per `docs/MAP.md`'s test guidance and `login.test.tsx`'s precedent: mock
// the module boundaries this screen actually talks to (`jobs.store` and
// `useJobs`), not the network layer — those are already covered by their
// own unit tests (`jobs.store.test.ts`, `useJobs.test.ts`).
jest.mock('../../../store/jobs.store', () => ({
  useJobsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))
jest.mock('../../../core/hooks/useJobs', () => ({
  useJobs: jest.fn(),
}))

// `@shopify/flash-list`'s published `dist/index.js` is ESM and isn't
// transformed by `jest-expo`'s default `transformIgnorePatterns` (which only
// whitelists `react-native`/`@react-native*`), so importing the real package
// crashes Jest with "Cannot use import statement outside a module". Per
// `docs/MAP.md`, a custom `transformIgnorePatterns` must not be added to the
// app's shared jest config — so instead this test mocks the module boundary
// with a minimal stand-in that renders `data` via `renderItem` and forwards
// `onEndReached` as a plain prop so it can be invoked directly (see the
// dedicated "wires FlashList onEndReached" test below; scroll-triggered
// firing itself is out of scope, as native viewport behavior isn't
// meaningfully testable without heavy FlashList internals mocking).
//
// Jest's module-factory hoisting forbids referencing top-level
// imports/consts from inside `jest.mock(...)` (only `jest`/`mock`-prefixed
// names are allowed) — so this factory pulls `react`/`react-native` via
// `jest.requireActual` (the real, un-mocked modules) instead.
jest.mock('@shopify/flash-list', () => {
  const mockReact = jest.requireActual('react') as typeof React
  const mockRN = jest.requireActual('react-native') as typeof ReactNative

  interface MockFlashListProps {
    data: unknown[]
    renderItem: (info: { item: unknown; index: number }) => React.ReactElement | null
    keyExtractor?: (item: unknown, index: number) => string
    onEndReached?: () => void
  }

  interface MockListContainerProps {
    testID: string
    onEndReached?: () => void
    children?: React.ReactNode
  }

  // A typed stand-in for `View` that additionally accepts `onEndReached` as
  // a plain (non-rendered) prop, so the test can read it back via `.props`.
  const MockListContainer = mockRN.View as unknown as React.ComponentType<MockListContainerProps>

  return {
    FlashList: ({ data, renderItem, keyExtractor, onEndReached }: MockFlashListProps) =>
      mockReact.createElement(
        MockListContainer,
        { testID: 'mock-flash-list', onEndReached },
        data.map((item, index) =>
          mockReact.createElement(
            mockRN.View,
            { key: keyExtractor ? keyExtractor(item, index) : index },
            renderItem({ item, index }),
          ),
        ),
      ),
  }
})

const mockedUseJobsStore = useJobsStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedUseJobs = useJobs as jest.Mock

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
  jobs: Job[]
  isLoading: boolean
  error: string | null
  pagination: { page: number; limit: number; total: number; hasNext: boolean; hasPrev: boolean }
}

function setStoreState(state: StoreState, setFilters: jest.Mock, setActiveJob: jest.Mock): void {
  // The screen uses `useJobsStore((s) => s.field)` (hook-style selector
  // usage) for `jobs`/`isLoading`/`error`/`pagination`, and
  // `useJobsStore.getState()` for imperative `setFilters`/`setActiveJob`
  // calls — both call shapes are wired to the same underlying state here.
  mockedUseJobsStore.mockImplementation((selector: (s: StoreState) => unknown) => selector(state))
  mockedUseJobsStore.getState.mockReturnValue({ ...state, setFilters, setActiveJob })
}

let setFilters: jest.Mock
let setActiveJob: jest.Mock
let refetch: jest.Mock
let fetchNextPage: jest.Mock

const emptyPagination = { page: 1, limit: 20, total: 0, hasNext: false, hasPrev: false }

beforeEach(() => {
  jest.useRealTimers()
  setFilters = jest.fn()
  setActiveJob = jest.fn()
  refetch = jest.fn().mockResolvedValue(undefined)
  fetchNextPage = jest.fn().mockResolvedValue(undefined)
  mockedUseJobs.mockReturnValue({ refetch, fetchNextPage, fetchPage: jest.fn() })
  setStoreState(
    { jobs: [], isLoading: false, error: null, pagination: emptyPagination },
    setFilters,
    setActiveJob,
  )
})

describe('SearchScreen', () => {
  it('renders the search input, salary inputs, city select, and sort select (R1, R2, R3, R4)', () => {
    render(<SearchScreen />)

    expect(screen.getByLabelText('Buscar')).toBeTruthy()
    expect(screen.getByLabelText('Salario mín.')).toBeTruthy()
    expect(screen.getByLabelText('Salario máx.')).toBeTruthy()
    expect(screen.getByText('Todas las ciudades')).toBeTruthy()
    expect(screen.getByText('Más recientes')).toBeTruthy()
  })

  it('calls refetch once on mount (initial fetch)', async () => {
    render(<SearchScreen />)

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1)
    })
  })

  it('renders JobCardSkeleton placeholders when loading and jobs is empty (R6)', () => {
    setStoreState(
      { jobs: [], isLoading: true, error: null, pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    // Positive assertion: the skeleton branch actually mounts >=1
    // `JobCardSkeleton` instances (not merely "nothing else rendered").
    expect(screen.UNSAFE_getAllByType(JobCardSkeleton).length).toBeGreaterThan(0)
    // ErrorState/EmptyState titles must NOT be present in the loading branch.
    expect(screen.queryByText('Sin resultados')).toBeNull()
    expect(screen.queryByText('No se pudo cargar la información')).toBeNull()
  })

  it('renders ErrorState and pressing retry calls refetch when error and jobs is empty (R7)', async () => {
    setStoreState(
      { jobs: [], isLoading: false, error: 'Network down', pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    expect(screen.getByText('No se pudo cargar la información')).toBeTruthy()
    expect(screen.getByText('Network down')).toBeTruthy()

    refetch.mockClear()
    fireEvent.press(screen.getByText('Reintentar'))

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1)
    })
  })

  it('renders EmptyState when done loading, no error, and jobs is empty (R8)', () => {
    setStoreState(
      { jobs: [], isLoading: false, error: null, pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    expect(screen.getByText('Sin resultados')).toBeTruthy()
  })

  it('renders the job list when jobs are present (R5, R9)', () => {
    const jobs = [makeJob({ id: 'a', title: 'Job A' }), makeJob({ id: 'b', title: 'Job B' })]
    setStoreState(
      { jobs, isLoading: false, error: null, pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    expect(screen.getByText('Job A')).toBeTruthy()
    expect(screen.getByText('Job B')).toBeTruthy()
  })

  it('tapping a job card calls setActiveJob with the job id and index (R9)', () => {
    const jobs = [makeJob({ id: 'a', title: 'Job A' }), makeJob({ id: 'b', title: 'Job B' })]
    setStoreState(
      { jobs, isLoading: false, error: null, pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    fireEvent.press(screen.getByText('Job B'))

    expect(setActiveJob).toHaveBeenCalledWith('b', 1)
  })

  it('wires FlashList onEndReached to fetchNextPage (R5)', () => {
    // Scroll-triggered firing of FlashList's native `onEndReached` is not
    // meaningfully testable under jest-expo/RNTL (no real viewport/layout) —
    // per the plan, this asserts the prop is wired by invoking it directly
    // and checking `fetchNextPage` fires, not that scrolling triggers it.
    const jobs = [makeJob()]
    setStoreState(
      { jobs, isLoading: false, error: null, pagination: emptyPagination },
      setFilters,
      setActiveJob,
    )
    render(<SearchScreen />)

    const list = screen.getByTestId('mock-flash-list')
    list.props.onEndReached()

    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('does not call setFilters/refetch on every keystroke, but does after the 300ms debounce window (R1)', () => {
    jest.useFakeTimers()
    render(<SearchScreen />)
    refetch.mockClear()

    act(() => {
      fireEvent.changeText(screen.getByLabelText('Buscar'), 'r')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Buscar'), 're')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Buscar'), 'react')
    })

    // Still within the debounce window — no fetch yet.
    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(setFilters).not.toHaveBeenCalled()
    expect(refetch).not.toHaveBeenCalled()

    // Debounce window elapses (300ms since the last keystroke).
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(setFilters).toHaveBeenCalledWith({ q: 'react' })
    expect(refetch).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  it('debounces salary_min/salary_max entry, parsing to a number and firing once after 300ms (R3)', () => {
    jest.useFakeTimers()
    render(<SearchScreen />)
    refetch.mockClear()

    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario mín.'), '1')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario mín.'), '15000')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario máx.'), '30000')
    })

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(setFilters).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(setFilters).toHaveBeenCalledWith({ salary_min: 15000, salary_max: 30000 })
    expect(refetch).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  it('leaves salary filters undefined when the inputs are cleared (R3)', () => {
    jest.useFakeTimers()
    render(<SearchScreen />)

    // Seed a non-empty value first so "clearing" is an actual state
    // transition (both inputs start at '', so a no-op changeText to '' would
    // never re-trigger the debounce effect).
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario mín.'), '15000')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario máx.'), '30000')
    })
    act(() => {
      jest.advanceTimersByTime(300)
    })
    setFilters.mockClear()

    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario mín.'), '')
    })
    act(() => {
      fireEvent.changeText(screen.getByLabelText('Salario máx.'), '')
    })

    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(setFilters).toHaveBeenCalledWith({ salary_min: undefined, salary_max: undefined })

    jest.useRealTimers()
  })

  it('selecting a city calls setFilters + refetch immediately, no debounce (R2, R10)', async () => {
    render(<SearchScreen />)
    refetch.mockClear()

    fireEvent.press(screen.getByText('Todas las ciudades'))
    fireEvent.press(screen.getByText('Guadalajara'))

    expect(setFilters).toHaveBeenCalledWith({ city: 'Guadalajara' })
    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1)
    })
  })

  it('selecting "all cities" maps to city: undefined (R2)', async () => {
    render(<SearchScreen />)

    fireEvent.press(screen.getByText('Todas las ciudades'))
    fireEvent.press(screen.getByText('Monterrey'))
    setFilters.mockClear()

    fireEvent.press(screen.getByText('Monterrey'))
    fireEvent.press(screen.getByText('Todas las ciudades'))

    expect(setFilters).toHaveBeenCalledWith({ city: undefined })
  })

  it('selecting a sort option calls setFilters + refetch immediately, no debounce (R4, R10)', async () => {
    render(<SearchScreen />)
    refetch.mockClear()

    fireEvent.press(screen.getByText('Más recientes'))
    fireEvent.press(screen.getByText('Relevancia'))

    expect(setFilters).toHaveBeenCalledWith({ sort: 'relevance' })
    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1)
    })
  })
})
