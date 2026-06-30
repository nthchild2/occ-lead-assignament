import {
  colorsByScheme,
  gutter,
  motion,
  palette,
  radii,
  shadows,
  spacing,
  typeScale,
} from './tokens'
import type { ColorScheme, SemanticColors } from './tokens'

export interface Theme {
  scheme: ColorScheme
  colors: SemanticColors
  palette: typeof palette
  type: typeof typeScale
  spacing: typeof spacing
  gutter: typeof gutter
  radii: typeof radii
  shadows: typeof shadows
  motion: typeof motion
}

export const buildTheme = (scheme: ColorScheme): Theme => ({
  scheme,
  colors: colorsByScheme[scheme],
  palette,
  type: typeScale,
  spacing,
  gutter,
  radii,
  shadows,
  motion,
})

export const lightTheme = buildTheme('light')
export const darkTheme = buildTheme('dark')

export type { ColorScheme } from './tokens'
