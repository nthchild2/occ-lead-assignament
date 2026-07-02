import notifee from '@notifee/react-native'
import { render } from '@testing-library/react-native'
import type React from 'react'
import type * as ReactNative from 'react-native'

import * as notificationsService from '../core/services/notifications.service'
import { consumePendingJobId, setPendingJobId } from '../core/lib/pendingNotification'
import RootLayout from './_layout'

// `RootLayout` imports `BottomSheetModalProvider` from `@gorhom/bottom-sheet`,
// which transitively imports `react-native-gesture-handler` — crashes at
// import time under jest-expo/react-test-renderer (the same native-module-
// boundary issue `(protected)/_layout.test.tsx` already hit and mocked).
// Scoped to this test file only; this file's unit of concern is the
// notification wiring, not the provider's own behavior (untestable/
// unnecessary here — a pass-through that renders children is sufficient).
jest.mock('@gorhom/bottom-sheet', () => {
  const mockReact = jest.requireActual('react') as typeof React
  return {
    BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  }
})

jest.mock('react-native-gesture-handler', () => {
  const mockRN = jest.requireActual('react-native') as typeof ReactNative
  return {
    GestureHandlerRootView: mockRN.View,
  }
})

// `useThemeFonts()` (real `expo-font`'s `useFonts`) throws under this test
// environment regardless of font-loading state (`loadedNativeFonts.forEach
// is not a function`) — unrelated to this ticket's scope (notification
// wiring, not font loading). Mocked to always report loaded so the render
// proceeds past the font-gate; `SafeAreaProvider` needs no mocking.
jest.mock('../core/hooks/useThemeFonts', () => ({
  useThemeFonts: () => true,
}))

jest.mock('../core/services/notifications.service', () => ({
  initNotificationChannel: jest.fn().mockResolvedValue(undefined),
}))

const mockedGetInitialNotification = notifee.getInitialNotification as jest.Mock
const mockedOnBackgroundEvent = notifee.onBackgroundEvent as jest.Mock
const mockedInitNotificationChannel = notificationsService.initNotificationChannel as jest.Mock

// `notifee.onBackgroundEvent` is registered exactly once, at MODULE scope in
// `app/_layout.tsx` (outside the component) — it already fired as a side
// effect of this file's top-level `import RootLayout from './_layout'`,
// before any test hook ran. Captured here in a `beforeAll` (which Jest runs
// once, before the first `beforeEach`) so the later `jest.clearAllMocks()`
// calls in `beforeEach` don't erase the one-and-only registration call.
let backgroundHandler: (event: {
  detail: { notification?: { data?: Record<string, unknown> } }
}) => Promise<void> | void

beforeAll(() => {
  expect(mockedOnBackgroundEvent).toHaveBeenCalledTimes(1)
  backgroundHandler = mockedOnBackgroundEvent.mock.calls[0][0] as typeof backgroundHandler
})

beforeEach(() => {
  jest.clearAllMocks()
  setPendingJobId(null)
  // The official notifee jest-mock's default `getInitialNotification` resolves
  // a canned notification with no `data` field — override per-test as needed.
  mockedGetInitialNotification.mockResolvedValue(null)
})

describe('RootLayout notification wiring', () => {
  it('calls initNotificationChannel() on mount (R1)', () => {
    render(<RootLayout />)

    expect(mockedInitNotificationChannel).toHaveBeenCalledTimes(1)
  })

  it('stashes the job id via setPendingJobId when getInitialNotification resolves one (R5)', async () => {
    mockedGetInitialNotification.mockResolvedValue({
      notification: { id: 'n1', data: { jobId: 'job-quit-1' } },
    })

    render(<RootLayout />)

    // `getInitialNotification()` is awaited inside a `useEffect`'s promise
    // chain — flush microtasks so the `.then()` callback runs before asserting.
    await Promise.resolve()
    await Promise.resolve()

    expect(consumePendingJobId()).toBe('job-quit-1')
  })

  it('does not stash a job id when getInitialNotification resolves with no data.jobId (R5)', async () => {
    mockedGetInitialNotification.mockResolvedValue({
      notification: { id: 'n1' },
    })

    render(<RootLayout />)
    await Promise.resolve()
    await Promise.resolve()

    expect(consumePendingJobId()).toBeNull()
  })

  it('does not stash a job id when getInitialNotification resolves null (app was not launched from a notification) (R5)', async () => {
    mockedGetInitialNotification.mockResolvedValue(null)

    render(<RootLayout />)
    await Promise.resolve()
    await Promise.resolve()

    expect(consumePendingJobId()).toBeNull()
  })

  it('the module-level onBackgroundEvent handler stashes a job id via setPendingJobId on an event carrying data.jobId (R4)', () => {
    backgroundHandler({ detail: { notification: { data: { jobId: 'job-bg-1' } } } })

    expect(consumePendingJobId()).toBe('job-bg-1')
  })

  it('the background handler is a no-op when the event carries no data.jobId (R4)', () => {
    backgroundHandler({ detail: { notification: {} } })

    expect(consumePendingJobId()).toBeNull()
  })
})
