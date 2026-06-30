/**
 * Design tokens — adapted from the Boletify "Ánima Nocturna" system for
 * React Native. Two color schemes (light / dark), one shared scale for
 * typography, spacing, radii, shadows and motion.
 */

export type ColorScheme = 'light' | 'dark'

// ---- Literal palette (fixed brand hues, never flip with theme) --------

export const palette = {
  ink1000: '#000000',
  ink950: '#08080C',
  ink900: '#0F0F15',
  ink850: '#161620',
  ink800: '#1F1F2B',
  ink700: '#2E2E3E',
  ink500: '#55556A',
  ink400: '#787891',
  ink300: '#9B9BB3',
  ink200: '#C2C2D0',
  ink100: '#E4E4EB',

  bone50: '#F6F2EA',
  bone100: '#EFE9DC',

  signal400: '#D7FF3A',
  signal500: '#C6FF2E',
  signal600: '#9FE600',
  signal900: '#2B3300',

  rosa400: '#FF6AA9',
  rosa500: '#FF2E88',
  rosa600: '#D6005F',

  oxblood400: '#A32438',
  oxblood500: '#7A1020',

  leaf400: '#55EBA6',
  leaf500: '#20D987',
  sun400: '#FFB85C',
  sun500: '#FF9E00',
  cenote500: '#00B3C7',
} as const

// ---- Semantic tokens, per color scheme ---------------------------------

export interface SemanticColors {
  bg: string
  surface: string
  surfaceRaised: string
  surfaceSunken: string

  fg: string
  fgSecondary: string
  fgMuted: string
  fgSubtle: string

  border: string
  borderStrong: string
  borderInk: string

  primary: string
  primaryFg: string
  primaryHover: string
  primaryPressed: string

  accent: string
  accentFg: string
  accentHover: string

  danger: string
  dangerFg: string
  dangerHover: string
  success: string
  warning: string
  info: string

  inverse: string
  inverseFg: string

  brick: string

  glassTint: string
  glassEdge: string
  navTint: string
}

const lightColors: SemanticColors = {
  bg: '#F4F4F8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#E8E8F0',

  fg: '#08080C',
  fgSecondary: '#2E2E3E',
  fgMuted: '#55556A',
  fgSubtle: '#6E6E8A',

  border: '#DDDDE6',
  borderStrong: '#B8B8CB',
  borderInk: '#000000',

  primary: '#08080C',
  primaryFg: '#C6FF2E',
  primaryHover: '#0F0F15',
  primaryPressed: '#161620',

  accent: '#D6005F',
  accentFg: '#F4F4F8',
  accentHover: '#FF2E88',

  danger: '#7A1020',
  dangerFg: '#F4F4F8',
  dangerHover: '#A32438',
  success: '#20D987',
  warning: '#FF9E00',
  info: '#00B3C7',

  inverse: '#08080C',
  inverseFg: '#F4F4F8',

  brick: '#000000',

  glassTint: 'rgba(255, 255, 255, 0.60)',
  glassEdge: 'rgba(0, 0, 0, 0.06)',
  navTint: 'rgba(244, 244, 248, 0.72)',
}

const darkColors: SemanticColors = {
  bg: '#08080C',
  surface: '#0F0F15',
  surfaceRaised: '#161620',
  surfaceSunken: '#161620',

  fg: '#F6F2EA',
  fgSecondary: '#C2C2D0',
  fgMuted: '#9B9BB3',
  fgSubtle: '#787891',

  border: '#1F1F2B',
  borderStrong: '#2E2E3E',
  borderInk: '#000000',

  primary: '#C6FF2E',
  primaryFg: '#08080C',
  primaryHover: '#D7FF3A',
  primaryPressed: '#9FE600',

  accent: '#FF2E88',
  accentFg: '#08080C',
  accentHover: '#FF6AA9',

  danger: '#7A1020',
  dangerFg: '#F6F2EA',
  dangerHover: '#A32438',
  success: '#20D987',
  warning: '#FF9E00',
  info: '#00B3C7',

  inverse: '#F6F2EA',
  inverseFg: '#08080C',

  brick: '#000000',

  glassTint: 'rgba(255, 255, 255, 0.05)',
  glassEdge: 'rgba(255, 255, 255, 0.10)',
  navTint: 'rgba(8, 8, 12, 0.72)',
}

export const colorsByScheme: Record<ColorScheme, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
}

// ---- Typography ----------------------------------------------------------
// tracking is stored as an em multiplier and resolved to px (letterSpacing)
// per-instance via typeScale[token].letterSpacing(fontSize).

export const fontFamily = {
  display: 'BricolageGrotesque_800ExtraBold',
  displaySemiBold: 'BricolageGrotesque_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const

interface TypeToken {
  fontSize: number
  lineHeight: number
  fontWeight: '400' | '500' | '600' | '700' | '800' | '900'
  letterSpacing: number
  fontFamily: string
}

export const typeScale = {
  displayLg: {
    fontSize: 56,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontFamily: fontFamily.display,
  },
  displayMd: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontFamily: fontFamily.display,
  },
  headingLg: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.48,
    fontFamily: fontFamily.displaySemiBold,
  },
  headingMd: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.24,
    fontFamily: fontFamily.displaySemiBold,
  },
  headingSm: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.09,
    fontFamily: fontFamily.bodySemiBold,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0,
    fontFamily: fontFamily.body,
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
    fontFamily: fontFamily.body,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
    fontFamily: fontFamily.body,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.52,
    fontFamily: fontFamily.bodySemiBold,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.24,
    fontFamily: fontFamily.body,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.76,
    fontFamily: fontFamily.bodyBold,
  },
  monoMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    fontFamily: fontFamily.mono,
  },
  monoSm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0,
    fontFamily: fontFamily.mono,
  },
} satisfies Record<string, TypeToken>

export type TypeScaleToken = keyof typeof typeScale

// ---- Spacing & radii -------------------------------------------------------

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const

export const gutter = 20

export const radii = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 14,
  xl: 22,
  '2xl': 28,
  '3xl': 40,
  full: 9999,
} as const

// ---- Shadows ---------------------------------------------------------------
// Two families, never blended: "brick" is a hard offset shadow with zero
// blur — simulated on RN with shadowOpacity 1 + no radius (iOS) and
// elevation (Android, which always blurs — closest available approximation).
// "glass" is the soft layered drop used behind blurred/translucent surfaces.

interface ShadowToken {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

export const shadows = {
  brickSm: {
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  brickMd: {
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  brickLg: {
    shadowColor: '#000000',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  glassSm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  glassMd: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  glassLg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 16,
  },
} satisfies Record<string, ShadowToken>

// ---- Motion ------------------------------------------------------------
// Durations in ms, paired with Reanimated-compatible bezier points.

export const motion = {
  instant: { duration: 80, easing: [0, 0, 1, 1] as [number, number, number, number] },
  fast: { duration: 120, easing: [0.2, 0, 0, 1] as [number, number, number, number] },
  base: { duration: 220, easing: [0.2, 0, 0, 1] as [number, number, number, number] },
  expressive: { duration: 420, easing: [0.34, 1.3, 0.64, 1] as [number, number, number, number] },
} as const
