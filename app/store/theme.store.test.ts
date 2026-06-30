import { useThemeStore } from './theme.store'

describe('theme.store', () => {
  it('resolves an explicit light/dark preference directly', () => {
    useThemeStore.getState().setPreference('dark')
    expect(useThemeStore.getState().scheme).toBe('dark')
    expect(useThemeStore.getState().theme.colors.primary).toBe('#C6FF2E')

    useThemeStore.getState().setPreference('light')
    expect(useThemeStore.getState().scheme).toBe('light')
    expect(useThemeStore.getState().theme.colors.primary).toBe('#08080C')
  })

  it('keeps theme tokens in sync with the resolved scheme', () => {
    useThemeStore.getState().setPreference('dark')
    const { theme, scheme } = useThemeStore.getState()
    expect(theme.scheme).toBe(scheme)
  })
})
