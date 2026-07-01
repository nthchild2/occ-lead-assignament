import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { Slot } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useThemeFonts } from '../core/hooks/useThemeFonts'

// Root layout — owns the provider stack and the font-load gate. Renders
// bare `<Slot />` so it has no dependency on `(auth)`/`(protected)` route
// groups; Expo Router resolves whichever top-level group applies.
//
// `BottomSheetModalProvider` is mounted once here (not duplicated at
// `(protected)/_layout.tsx`) — R2's provider stack already lists it and R8
// only requires it to wrap `(protected)`'s subtree, so root-level coverage
// is a superset with no duplication (see 02-plan.md's Approach).
export default function RootLayout() {
  const fontsLoaded = useThemeFonts()

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <Slot />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
