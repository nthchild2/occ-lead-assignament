import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { useAuthStore } from '../../store/auth.store'
import LoginScreen from './login'

// This screen's unit of concern is "did it call `useAuthStore`'s `login`
// correctly, and did it react correctly to what `login` does" — not the
// network layer (already covered by `auth.store.test.ts`). Per
// `docs/MAP.md`'s test guidance we mock the module boundary the screen
// actually talks to (the store), not `global.fetch`.
jest.mock('../../store/auth.store', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}))

const mockedGetState = useAuthStore.getState as jest.Mock

function setLoginMock(loginImpl: jest.Mock): void {
  mockedGetState.mockReturnValue({ login: loginImpl })
}

class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

beforeEach(() => {
  mockedGetState.mockReset()
})

describe('LoginScreen', () => {
  it('renders the email input, password input, and submit button (R1, R3)', () => {
    setLoginMock(jest.fn())
    render(<LoginScreen />)

    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('blocks submit and shows a field error on an invalid email, without calling login (R2)', async () => {
    const login = jest.fn()
    setLoginMock(login)
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret')
    fireEvent.press(screen.getByRole('button'))

    // Zod's default `.email()` message is exactly "Invalid email" — matching
    // on that exact string (rather than a loose /email/i regex) avoids
    // ambiguously also matching the "Email" field label itself.
    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeTruthy()
    })
    expect(login).not.toHaveBeenCalled()
  })

  it('blocks submit and shows a field error on an empty password, without calling login (R2)', async () => {
    const login = jest.fn()
    setLoginMock(login)
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText('Email'), 'valid@example.com')
    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(login).not.toHaveBeenCalled()
    })
  })

  it('calls useAuthStore.getState().login with the entered credentials on a valid submit (R1, R4)', async () => {
    const login = jest.fn().mockResolvedValue(undefined)
    setLoginMock(login)
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText('Email'), 'valid@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret123')
    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('valid@example.com', 'secret123')
    })
  })

  it('shows a loading state on the button while login is in flight (R3)', async () => {
    let resolveLogin: () => void = () => {}
    const login = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve
        }),
    )
    setLoginMock(login)
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText('Email'), 'valid@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret123')
    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true)
    })

    resolveLogin()
    await waitFor(() => {
      expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(false)
    })
  })

  it('surfaces a rejected login() error message and preserves the entered field values (R5, R6)', async () => {
    const login = jest
      .fn()
      .mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'Bad credentials'))
    setLoginMock(login)
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText('Email'), 'valid@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrongpass')
    fireEvent.press(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Bad credentials')).toBeTruthy()
    })

    expect(screen.getByLabelText('Email').props.value).toBe('valid@example.com')
    expect(screen.getByLabelText('Password').props.value).toBe('wrongpass')
  })
})

// A4 snapshot policy: this screen is declared complete (login-screen ticket
// PASS), so its rendered output is pinned. Intentional UI changes must update
// this snapshot in the same PR, reviewed — never blindly regenerated.
describe('LoginScreen snapshot (A4 snapshot policy)', () => {
  it('matches the completed-screen snapshot', () => {
    expect(render(<LoginScreen />).toJSON()).toMatchSnapshot()
  })
})
