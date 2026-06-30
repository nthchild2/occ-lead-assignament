import { useThemeStore } from '../../store/theme.store'
import type { Theme } from '../theme'

/** Primary entry point for consuming theme tokens in components. */
export const useTheme = (): Theme => useThemeStore((s) => s.theme)
