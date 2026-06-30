import { useFonts } from 'expo-font'

import { themeFonts } from '../theme'

/** Loads the three theme typefaces. Gate splash-screen hiding on the boolean it returns. */
export const useThemeFonts = (): boolean => {
  const [loaded] = useFonts(themeFonts)
  return loaded
}
