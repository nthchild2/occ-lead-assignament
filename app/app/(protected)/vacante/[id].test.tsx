import { render } from '@testing-library/react-native'
import type React from 'react'

import { useJobsStore } from '../../../store/jobs.store'
import VacanteRoute from './[id]'

// R6: this route has no UI of its own (redirects immediately) — its unit of
// concern is "does mounting with a given `id` param call `setActiveJob(id,
// -1)` and render a redirect to the tabs root". Narrowly mocks
// `expo-router`'s two exports this file uses, mirroring
// `(protected)/_layout.test.tsx`'s own `Slot`/`Redirect` mock.
jest.mock('expo-router', () => {
  const mockReact = jest.requireActual('react') as typeof React
  return {
    useLocalSearchParams: jest.fn(),
    Redirect: ({ href }: { href: string }) => mockReact.createElement('MockRedirect', { href }),
  }
})

jest.mock('../../../store/jobs.store', () => ({
  useJobsStore: { getState: jest.fn() },
}))

const mockedUseLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock
const mockedGetState = useJobsStore.getState as jest.Mock

let setActiveJob: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  setActiveJob = jest.fn()
  mockedGetState.mockReturnValue({ setActiveJob })
})

describe('VacanteRoute', () => {
  it('calls setActiveJob(id, -1) with the route param id (R6)', () => {
    mockedUseLocalSearchParams.mockReturnValue({ id: 'job-9' })

    render(<VacanteRoute />)

    expect(setActiveJob).toHaveBeenCalledWith('job-9', -1)
  })

  it('renders a redirect to the tabs root (R6)', () => {
    mockedUseLocalSearchParams.mockReturnValue({ id: 'job-9' })

    const { UNSAFE_root } = render(<VacanteRoute />)

    const redirect = UNSAFE_root.findByType('MockRedirect')
    expect(redirect.props.href).toBe('/(protected)/(tabs)')
  })

  it('does not call setActiveJob when id is missing', () => {
    mockedUseLocalSearchParams.mockReturnValue({ id: undefined })

    render(<VacanteRoute />)

    expect(setActiveJob).not.toHaveBeenCalled()
  })
})
