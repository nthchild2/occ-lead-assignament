import { useEffect, useState } from 'react'
import { Redirect, Slot } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useTheme } from '../../core/hooks/useTheme'
import { useApplicationsStore } from '../../store/applications.store'
import { useAuthStore } from '../../store/auth.store'
import { useFavoritesStore } from '../../store/favorites.store'

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

  return <Slot />
}
