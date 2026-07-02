import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import notifee from '@notifee/react-native'
import { Slot } from 'expo-router'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { setPendingJobId } from '../core/lib/pendingNotification'
import { useThemeFonts } from '../core/hooks/useThemeFonts'
import { initNotificationChannel } from '../core/services/notifications.service'

// R4/R5: notifee only supports a single `onBackgroundEvent` registration
// (per notifee's own docs/research) — registered once at module scope
// (outside the component function) rather than in an effect, so it survives
// regardless of how many times `RootLayout` mounts/remounts and is never
// re-registered. This layout has no auth/hydration awareness (that lives in
// `(protected)/_layout.tsx`), so a background press only stashes the job id
// via `setPendingJobId` for that layout to consume once it's ready — it
// never navigates directly.
notifee.onBackgroundEvent(async (event) => {
  const jobId = event.detail.notification?.data?.jobId
  if (typeof jobId === 'string') {
    setPendingJobId(jobId)
  }
})

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

  // R1: channel creation has no UI dependency, so it runs regardless of the
  // font-load gate below. R5: `getInitialNotification()` covers the
  // quit-state case — the app process was launched by the notification tap
  // itself, so there's no background-event listener to catch it; the id is
  // stashed the same way as the background-event handler above.
  useEffect(() => {
    initNotificationChannel()

    notifee.getInitialNotification().then((initial) => {
      const jobId = initial?.notification.data?.jobId
      if (typeof jobId === 'string') {
        setPendingJobId(jobId)
      }
    })
  }, [])

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
