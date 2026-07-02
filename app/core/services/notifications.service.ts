import notifee, { AndroidImportance } from '@notifee/react-native'
import { Platform } from 'react-native'

// Channel id shared between channel creation and every displayed
// notification's `android.channelId` — kept as a single constant so the two
// never drift apart.
const JOBS_CHANNEL_ID = 'jobs'

// R1: Android requires a notification channel (API 26+) before a
// notification can be displayed with a given importance; iOS has no channel
// concept, so this is a deliberate no-op there (Platform.OS guard) rather
// than an native-module error.
export async function initNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  await notifee.createChannel({
    id: JOBS_CHANNEL_ID,
    name: 'Vacantes',
    importance: AndroidImportance.HIGH,
  })
}

// R2: simulates a backend push ("Nueva vacante para ti") arriving for a
// given job, carrying `jobId` in `data` so the tap-handling wiring in
// `app/_layout.tsx` / `(protected)/_layout.tsx` can resolve which job to
// open (R3/R4/R5) without a separate lookup mechanism.
export async function triggerDemoJobNotification(jobId: string): Promise<void> {
  await notifee.displayNotification({
    title: 'Nueva vacante para ti',
    body: 'Encontramos una nueva vacante que puede interesarte.',
    android: { channelId: JOBS_CHANNEL_ID },
    data: { jobId },
  })
}
