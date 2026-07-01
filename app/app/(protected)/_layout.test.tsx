import type { Job, Pagination } from '@occ/shared'
import { act, render, waitFor } from '@testing-library/react-native'
import type React from 'react'
import type * as ReactNative from 'react-native'

import * as jobsService from '../../core/services/jobs.service'
import { useAuthStore } from '../../store/auth.store'
import { useJobsStore } from '../../store/jobs.store'
import ProtectedLayout from './_layout'

// `@gorhom/bottom-sheet` transitively imports `react-native-gesture-handler`,
// which crashes at import time under `jest-expo` (an internal
// `ReactNativeRenderer-dev.js` throw) — the same class of ESM/native-module
// incompatibility `job-search-screen` hit with `@shopify/flash-list`, per
// `docs/MAP.md`. A real render was attempted first (a throwaway spike file
// with the same imports as this layout crashed identically before any test
// body ran). Per the plan, this mocks the module boundary in this test file
// only (never the shared jest config): a minimal stand-in that exposes
// `present`/`dismiss` via the forwarded ref (through a module-level spy, so
// the test can assert on calls across re-renders) and renders `children`
// directly, forwarding `onDismiss` as a plain prop the test can invoke
// manually — native swipe/backdrop-tap gestures are not meaningfully
// testable under RNTL without heavy internals mocking, mirroring
// `job-search-screen`'s `onEndReached` precedent.
//
// Jest's module-factory hoisting forbids referencing top-level
// imports/consts from inside `jest.mock(...)` (only `jest`/`mock`-prefixed
// names are allowed) — so `mockPresent`/`mockDismiss` are declared with the
// `mock` prefix and pulled via `jest.requireActual('react')` inside the
// factory, mirroring `index.test.tsx`'s `@shopify/flash-list` mock.
const mockPresent = jest.fn()
const mockDismiss = jest.fn()

jest.mock('@gorhom/bottom-sheet', () => {
  const mockReact = jest.requireActual('react') as typeof React
  const mockRN = jest.requireActual('react-native') as typeof ReactNative

  interface MockBottomSheetModalProps {
    onDismiss?: () => void
    snapPoints?: string[]
    children?: React.ReactNode
  }

  const MockBottomSheetModal = mockReact.forwardRef<unknown, MockBottomSheetModalProps>(
    function MockBottomSheetModal({ onDismiss, snapPoints, children }, ref) {
      mockReact.useImperativeHandle(ref, () => ({
        present: mockPresent,
        dismiss: mockDismiss,
      }))
      return mockReact.createElement(
        mockReact.Fragment,
        null,
        mockReact.createElement('MockBottomSheetModal', { onDismiss, snapPoints }),
        children,
      )
    },
  )

  // `JobDetail.tsx` (rendered as this sheet's child) also imports
  // `BottomSheetScrollView` directly — a plain `ScrollView` stand-in is
  // enough here too, mirroring `JobDetail.test.tsx`'s own mock.
  return { BottomSheetModal: MockBottomSheetModal, BottomSheetScrollView: mockRN.ScrollView }
})

// `JobDetail.tsx` (rendered as this sheet's child) also directly imports
// `react-native-gesture-handler` for its swipe gesture (R1), which crashes
// at import time under `jest-expo` for the same native-module-boundary
// reason as `@gorhom/bottom-sheet` above. Scoped to this test file only,
// mirroring `JobDetail.test.tsx`'s own mock — this file's unit of concern is
// the sheet's ref/effect/dismiss wiring, not the swipe gesture itself
// (already covered by `JobDetail.test.tsx`), so the stub only needs to
// render `GestureDetector`'s children without crashing.
jest.mock('react-native-gesture-handler', () => {
  const mockReact = jest.requireActual('react') as typeof React

  function makePanGestureStub() {
    const stub = {
      enabled: () => stub,
      activeOffsetX: () => stub,
      failOffsetY: () => stub,
      onEnd: () => stub,
    }
    return stub
  }

  return {
    Gesture: { Pan: makePanGestureStub },
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  }
})

// `expo-router`'s real `<Slot />` calls into `useRouteNode`, which uses
// React 19's `use()` internally — unavailable under this project's
// `jest-expo`/`react-test-renderer` (React 18) combination, so it throws
// `(0, react_1.use) is not a function` as soon as `<Slot />` actually
// mounts. No other test in this repo renders a `_layout.tsx` file (screen
// tests like `index.test.tsx` render the screen component directly, never
// its enclosing layout), so this is the first place that hits it. Mocked
// narrowly to just `Slot`/`Redirect` — the two exports this layout uses —
// scoped to this test file only, same rationale as the `@gorhom/bottom-sheet`
// mock above.
jest.mock('expo-router', () => {
  const mockReact = jest.requireActual('react') as typeof React
  return {
    Slot: () => mockReact.createElement('MockSlot'),
    Redirect: () => mockReact.createElement('MockRedirect'),
  }
})

// Per `docs/MAP.md`'s test guidance and `login.test.tsx`/`index.test.tsx`
// precedent: mock the store module boundaries this layout actually talks to.
// `JobDetail`'s own rendering/behavior is exercised by `JobDetail.test.tsx`;
// mocking its store dependencies here too keeps this file's render
// self-contained without re-testing `JobDetail`'s internals.
jest.mock('../../store/auth.store', () => ({
  useAuthStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}))
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
  isJobApplied: jest.fn().mockReturnValue(false),
  isJobFavorited: jest.fn().mockReturnValue(false),
}))
jest.mock('../../core/services/jobs.service', () => ({
  getById: jest.fn(),
}))

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedUseJobsStore = useJobsStore as unknown as jest.Mock & { getState: jest.Mock }
const mockedGetById = jobsService.getById as jest.Mock

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, hasNext: false, hasPrev: false }

interface JobsState {
  activeJobId: string | null
  activeJobIndex: number | null
  // Deliberately non-empty so `JobDetail`'s "not found in jobs.store.jobs"
  // fallback (R9, `jobsService.getById`) never triggers here — this test
  // file's unit of concern is the sheet's ref/effect/dismiss wiring, not
  // `JobDetail`'s own fetch-fallback branching (already covered by
  // `JobDetail.test.tsx`).
  jobs: Job[]
  // R7: cross-tree FlashList ref — `null` unless a test opts in via
  // `setActiveJobId`'s `flashListRef` param.
  flashListRef: { current: { scrollToIndex: jest.Mock } | null } | null
  // `JobDetail.tsx`'s `useJobSwipe` (rendered as this sheet's child) reads
  // these too — present so that hook doesn't crash on `undefined`. This
  // file's unit of concern is the sheet's dismiss wiring, not the swipe
  // gesture's own behavior (already covered by `JobDetail.test.tsx`).
  pagination: Pagination
  error: string | null
}

function makeJob(id: string): Job {
  return {
    id,
    title: 'Backend Engineer',
    company: 'Acme Corp',
    city: 'Ciudad de México',
    salary: 35000,
    description: 'desc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    tags: [],
  }
}

function setAuthReady(): void {
  mockedUseAuthStore.mockImplementation((selector: (s: { token: string | null }) => unknown) =>
    selector({ token: 'tok' }),
  )
  mockedUseAuthStore.getState.mockReturnValue({
    hydrate: jest.fn().mockResolvedValue(undefined),
  })
}

function setActiveJobId(
  activeJobId: string | null,
  clearActiveJob: jest.Mock,
  options: { activeJobIndex?: number | null; flashListRef?: JobsState['flashListRef'] } = {},
): void {
  const jobs = activeJobId ? [makeJob(activeJobId)] : []
  const state: JobsState = {
    activeJobId,
    activeJobIndex: options.activeJobIndex ?? null,
    jobs,
    flashListRef: options.flashListRef ?? null,
    pagination: emptyPagination,
    error: null,
  }
  mockedUseJobsStore.mockImplementation((selector: (s: JobsState) => unknown) => selector(state))
  mockedUseJobsStore.getState.mockReturnValue({ ...state, clearActiveJob })
}

let clearActiveJob: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  clearActiveJob = jest.fn()
  // Never resolves — this test file doesn't exercise the fetch-fallback
  // path, so `getById` should simply never be called given `jobs` always
  // contains `activeJobId` when non-null (see `setActiveJobId` above).
  mockedGetById.mockReturnValue(new Promise(() => {}))
  setAuthReady()
  setActiveJobId(null, clearActiveJob)
})

describe('ProtectedLayout sheet wiring', () => {
  it('does not call present() while activeJobId stays null (R2)', async () => {
    const { UNSAFE_root } = render(<ProtectedLayout />)

    // Wait for hydration to settle (the guard renders a loading state, not
    // the sheet, until `hydrate()` resolves) before asserting `present()`
    // was never called.
    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    expect(mockPresent).not.toHaveBeenCalled()
  })

  it("calls the sheet ref's present() when activeJobId becomes non-null, configured with the 60%/100% snap points (R1, R2)", async () => {
    const { rerender, UNSAFE_root } = render(<ProtectedLayout />)
    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    expect(mockPresent).not.toHaveBeenCalled()
    expect(UNSAFE_root.findByType('MockBottomSheetModal').props.snapPoints).toEqual(['60%', '100%'])

    setActiveJobId('job-1', clearActiveJob)
    await act(async () => {
      rerender(<ProtectedLayout />)
    })

    await waitFor(() => {
      expect(mockPresent).toHaveBeenCalledTimes(1)
    })
  })

  it('onDismiss calls jobs.store.clearActiveJob() (R4)', async () => {
    setActiveJobId('job-1', clearActiveJob)
    const { UNSAFE_root } = render(<ProtectedLayout />)

    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    const sheetNode = UNSAFE_root.findByType('MockBottomSheetModal')

    act(() => {
      sheetNode.props.onDismiss()
    })

    expect(clearActiveJob).toHaveBeenCalledTimes(1)
  })

  it('onDismiss calls flashListRef.current.scrollToIndex with the current activeJobIndex before clearing it (R7)', async () => {
    const scrollToIndex = jest.fn().mockResolvedValue(undefined)
    setActiveJobId('job-1', clearActiveJob, {
      activeJobIndex: 4,
      flashListRef: { current: { scrollToIndex } },
    })
    const { UNSAFE_root } = render(<ProtectedLayout />)

    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    const sheetNode = UNSAFE_root.findByType('MockBottomSheetModal')

    act(() => {
      sheetNode.props.onDismiss()
    })

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 4, animated: false })
    expect(clearActiveJob).toHaveBeenCalledTimes(1)
  })

  it('onDismiss skips scrollToIndex without throwing when flashListRef is null (R7)', async () => {
    setActiveJobId('job-1', clearActiveJob, { activeJobIndex: 4, flashListRef: null })
    const { UNSAFE_root } = render(<ProtectedLayout />)

    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    const sheetNode = UNSAFE_root.findByType('MockBottomSheetModal')

    expect(() => {
      act(() => {
        sheetNode.props.onDismiss()
      })
    }).not.toThrow()

    expect(clearActiveJob).toHaveBeenCalledTimes(1)
  })

  it('onDismiss skips scrollToIndex without throwing when activeJobIndex is null (R7)', async () => {
    const scrollToIndex = jest.fn().mockResolvedValue(undefined)
    setActiveJobId('job-1', clearActiveJob, {
      activeJobIndex: null,
      flashListRef: { current: { scrollToIndex } },
    })
    const { UNSAFE_root } = render(<ProtectedLayout />)

    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    const sheetNode = UNSAFE_root.findByType('MockBottomSheetModal')

    act(() => {
      sheetNode.props.onDismiss()
    })

    expect(scrollToIndex).not.toHaveBeenCalled()
    expect(clearActiveJob).toHaveBeenCalledTimes(1)
  })

  it('does not crash and still clears the active job when scrollToIndex rejects (R7)', async () => {
    const scrollToIndex = jest.fn().mockRejectedValue(new Error('index out of range'))
    setActiveJobId('job-1', clearActiveJob, {
      activeJobIndex: 4,
      flashListRef: { current: { scrollToIndex } },
    })
    const { UNSAFE_root } = render(<ProtectedLayout />)

    await waitFor(() => {
      expect(UNSAFE_root.findAllByType('MockBottomSheetModal').length).toBe(1)
    })
    const sheetNode = UNSAFE_root.findByType('MockBottomSheetModal')

    expect(() => {
      act(() => {
        sheetNode.props.onDismiss()
      })
    }).not.toThrow()

    expect(clearActiveJob).toHaveBeenCalledTimes(1)
  })
})
