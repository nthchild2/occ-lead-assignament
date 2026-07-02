import { BottomSheetModal } from '@gorhom/bottom-sheet'
import notifee, { EventType } from '@notifee/react-native'
import type { Event as NotifeeEvent } from '@notifee/react-native'
import { useEffect, useRef, useState } from 'react'
import { Redirect, Slot } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { consumePendingJobId } from '../../core/lib/pendingNotification'
import { useTheme } from '../../core/hooks/useTheme'
import { useApplicationsStore } from '../../store/applications.store'
import { useAuthStore } from '../../store/auth.store'
import { useFavoritesStore } from '../../store/favorites.store'
import { useJobsStore } from '../../store/jobs.store'
import JobDetail from './JobDetail'

const SNAP_POINTS = ['60%', '100%']

type HydrationState = 'idle' | 'checking' | 'ready'

/**
 * Logs out the current session: clears auth, then resets the activity
 * stores that carry per-user data (`jobs.store` has no `reset()` and is
 * intentionally left out — its data is not user-scoped). Does not call
 * `router.replace()` itself — once `logout()` clears `token`, the guard's
 * own no-token branch below redirects to `/(auth)/login` on the next
 * render, so there is a single source of navigation truth (R9).
 */
export async function handleLogout(): Promise<void> {
  await useAuthStore.getState().logout()
  useApplicationsStore.getState().reset()
  useFavoritesStore.getState().reset()
}

/**
 * R7: before clearing the active job, best-effort scrolls the (separately-
 * mounted) job-search FlashList to the job that was active when the sheet
 * closed, so the underlying list is in sync when the sheet is dismissed.
 * Reads `flashListRef`/`activeJobIndex` from `jobs.store` BEFORE calling
 * `clearActiveJob()` — order matters, since `clearActiveJob()` resets
 * `activeJobIndex` to `null`. `scrollToIndex` returns a `Promise<void>` that
 * can reject if the index is out of the currently-rendered range; this is a
 * fire-and-forget imperative call (mirrors `sheetRef.current?.present()` in
 * this same file), guarded with `.catch()` so a rejection never surfaces as
 * an unhandled rejection warning.
 */
function handleSheetDismiss(): void {
  const { flashListRef, activeJobIndex } = useJobsStore.getState()
  // `activeJobIndex` is `-1` for jobs opened via a notification tap / deep
  // link (push-notifications' `setActiveJob(id, -1)` calls) — there is no
  // known list position to scroll to for those, so `-1` (like `null`) must
  // skip `scrollToIndex` rather than being passed straight through to
  // FlashList, which would throw/misbehave on a negative index.
  if (flashListRef?.current && activeJobIndex !== null && activeJobIndex >= 0) {
    try {
      flashListRef.current.scrollToIndex({ index: activeJobIndex, animated: false }).catch(() => {})
    } catch {
      // Best-effort: a stale ref/index must never crash the dismiss flow.
    }
  }
  useJobsStore.getState().clearActiveJob()
}

/**
 * R3: already-authenticated foreground notification tap. Extracted as a
 * standalone function (mirrors `handleSheetDismiss` above) to keep
 * `ProtectedLayout` under the eslint `complexity: 10` ceiling — this is
 * registered via `notifee.onForegroundEvent` in a mount effect below. Only
 * `EventType.PRESS` carries a job id worth acting on; other event types
 * (dismiss, delivered, etc.) are no-ops here. `-1` is passed as the index —
 * there is no known list position for a job opened via notification tap
 * (see `handleSheetDismiss`'s `-1` guard above).
 */
function handleForegroundPress(event: NotifeeEvent): void {
  if (event.type !== EventType.PRESS) return
  const jobId = event.detail.notification?.data?.jobId
  if (typeof jobId === 'string') {
    useJobsStore.getState().setActiveJob(jobId, -1)
  }
}

/**
 * R5: quit-state notification handoff. `app/_layout.tsx` stashes a job id
 * (via `setPendingJobId`) when the app cold-starts from a notification tap,
 * before this layout's own `hydrate()` has resolved — reading it here, only
 * once `hydration` is `'ready'`, ensures `setActiveJob` never fires while
 * the auth guard could still redirect to `/login`. Extracted as a standalone
 * function for the same complexity-budget reason as `handleForegroundPress`.
 */
function consumePendingIfReady(hydration: HydrationState): void {
  if (hydration !== 'ready') return
  const jobId = consumePendingJobId()
  if (jobId) {
    useJobsStore.getState().setActiveJob(jobId, -1)
  }
}

// The guard for the entire protected subtree (R3). No token → redirect
// immediately. Token present → call `hydrate()` once to validate it against
// the server; render nothing but a themed loading state while that
// resolves, so no protected content flashes before hydration settles. If
// `hydrate()` fails, it calls `clearSession()` internally (see
// `auth.store.ts`), which sets `token` back to null — the token-null branch
// below then naturally redirects on the next render; no second explicit
// redirect is needed for that case.
export default function ProtectedLayout() {
  const theme = useTheme()
  const token = useAuthStore((s) => s.token)
  const [hydration, setHydration] = useState<HydrationState>('idle')
  const sheetRef = useRef<BottomSheetModal>(null)
  const activeJobId = useJobsStore((s) => s.activeJobId)

  useEffect(() => {
    if (!token) {
      setHydration('idle')
      return
    }

    setHydration('checking')
    useAuthStore
      .getState()
      .hydrate()
      .finally(() => setHydration('ready'))
  }, [token])

  // R2: the sheet opens whenever `activeJobId` becomes non-null (set by
  // `job-search-screen`'s card tap, or any future entry point) — this effect
  // is the single place that translates store state into an imperative
  // `present()` call on the sheet ref.
  useEffect(() => {
    if (activeJobId) {
      sheetRef.current?.present()
    }
  }, [activeJobId])

  // R3: already authenticated here, so a foreground notification press can
  // call `setActiveJob` directly — no deep-link route round-trip needed.
  // Registered/unsubscribed once per mount; `notifee.onForegroundEvent`
  // returns its own unsubscribe function (per notifee's API).
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(handleForegroundPress)
    return unsubscribe
  }, [])

  // R5: consume a quit-state notification's held job id only once hydration
  // has resolved (see `consumePendingIfReady`'s doc comment above) — runs on
  // every `hydration` change but is a no-op except the one time it flips to
  // `'ready'` with a pending id actually set.
  useEffect(() => {
    consumePendingIfReady(hydration)
  }, [hydration])

  if (!token) {
    return <Redirect href="/(auth)/login" />
  }

  if (hydration !== 'ready') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.colors.fg} />
      </View>
    )
  }

  return (
    <>
      <Slot />
      <BottomSheetModal ref={sheetRef} snapPoints={SNAP_POINTS} onDismiss={handleSheetDismiss}>
        <JobDetail />
      </BottomSheetModal>
    </>
  )
}
