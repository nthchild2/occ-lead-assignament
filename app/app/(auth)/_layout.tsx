import { Redirect, Slot } from 'expo-router'

import { useAuthStore } from '../../store/auth.store'

// Redirects an already-authenticated user away from `/login` to the
// protected area. Reads locally-known session state only (no `hydrate()`
// call here) — `(protected)/_layout.tsx` owns server-side token validation
// per the spec's division of responsibility.
export default function AuthLayout() {
  const token = useAuthStore((s) => s.token)

  if (token) {
    return <Redirect href="/(protected)/(tabs)" />
  }

  return <Slot />
}
