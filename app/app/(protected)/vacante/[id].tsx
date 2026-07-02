import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'

import { useJobsStore } from '../../../store/jobs.store'

// R6: resolves `occ://vacante/:id` (Expo Router auto-registers this dynamic
// segment as a deep-link target from the file path alone). This route has no
// UI of its own — it sets `activeJobId` via the same `setActiveJob` call
// every other entry point uses (job-search card tap, foreground notification
// press, quit-state pending notification), then redirects to the tabs root
// so `(protected)/_layout.tsx`'s existing `activeJobId`-watching effect
// opens the sheet on top of it. `-1` is passed as the index: there is no
// known list position for a job opened this way (mirrors the `-1` used by
// the notification tap handlers in `(protected)/_layout.tsx`/`app/_layout.tsx`).
export default function VacanteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()

  useEffect(() => {
    if (id) {
      useJobsStore.getState().setActiveJob(id, -1)
    }
  }, [id])

  return <Redirect href="/(protected)/(tabs)" />
}
