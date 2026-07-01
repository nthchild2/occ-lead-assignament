import { act, renderHook } from '@testing-library/react-native'

import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('collapses rapid changes within the delay window to only the final value (R7)', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })

    expect(result.current).toBe('a')

    // Rapid changes, each well within the 300ms delay window.
    rerender({ value: 'ab' })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({ value: 'abc' })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({ value: 'abcd' })

    // Still within 300ms of the *last* change — the debounced value must
    // still be the original, none of the intermediate values ever surfaced.
    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    // Now the delay has fully elapsed since the last ('abcd') change — only
    // the final value should be reflected, none of the intermediate ones.
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('abcd')
  })

  it('does not update before the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'first' },
    })

    rerender({ value: 'second' })

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe('first')

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('second')
  })
})
