import { useEffect, useState } from 'react'

/**
 * Generic, store-agnostic debounce hook. Returns `value`, but only updates
 * to a new value after it has remained stable for `delay` ms — rapid
 * successive changes within the delay window collapse to the last value.
 * `delay` is always caller-supplied (e.g. 300ms for the search input); no
 * hardcoded default here so this stays reusable beyond the search screen.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value)
    }, delay)

    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}
