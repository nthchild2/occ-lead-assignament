import { Appearance } from 'react-native'
import { create } from 'zustand'

import { buildTheme, type ColorScheme, type Theme } from '../core/theme'

export type ThemePreference = ColorScheme | 'system'

interface ThemeStore {
  preference: ThemePreference
  scheme: ColorScheme
  theme: Theme
  setPreference: (preference: ThemePreference) => void
}

const resolveScheme = (preference: ThemePreference): ColorScheme => {
  if (preference === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  }
  return preference
}

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: 'system',
  scheme: resolveScheme('system'),
  theme: buildTheme(resolveScheme('system')),
  setPreference: (preference) => {
    const scheme = resolveScheme(preference)
    set({ preference, scheme, theme: buildTheme(scheme) })
  },
}))

Appearance.addChangeListener(() => {
  const { preference, setPreference } = useThemeStore.getState()
  if (preference === 'system') setPreference('system')
})
