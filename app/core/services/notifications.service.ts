import { Platform } from 'react-native'

import { getNotifee } from '../lib/notifeeCompat'

// Channel id shared between channel creation and every displayed
// notification's `android.channelId` — kept as a single constant so the two
// never drift apart.
const JOBS_CHANNEL_ID = 'jobs'

// R1: Android requires a notification channel (API 26+) before a
// notification can be displayed with a given importance; iOS has no channel
// concept, so this is a deliberate no-op there (Platform.OS guard) rather
// than an native-module error. Also a no-op in Expo Go (`getNotifee()`
// returns `null` there — see `notifeeCompat.ts`).
export async function initNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  const mod = getNotifee()
  if (!mod) return

  await mod.notifee.createChannel({
    id: JOBS_CHANNEL_ID,
    name: 'Vacantes',
    importance: mod.AndroidImportance.HIGH,
  })
}

// R2: simulates a backend push ("Nueva vacante para ti") arriving for a
// given job, carrying `jobId` in `data` so the tap-handling wiring in
// `app/_layout.tsx` / `(protected)/_layout.tsx` can resolve which job to
// open (R3/R4/R5) without a separate lookup mechanism.
export async function triggerDemoJobNotification(jobId: string): Promise<void> {
  const mod = getNotifee()
  if (!mod) return

  await mod.notifee.displayNotification({
    title: 'Nueva vacante para ti',
    body: 'Encontramos una nueva vacante que puede interesarte.',
    android: { channelId: JOBS_CHANNEL_ID },
    data: { jobId },
  })
}
