import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from '@occ/shared'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import * as authService from '../core/services/auth.service'
import { configureApi } from '../core/services/api'

interface AuthStore {
  token: string | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearSession: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: async (email, password) => {
        const result = await authService.login(email, password)
        set({ token: result.data.token, user: result.data.user })
      },
      logout: async () => {
        try {
          await authService.logout()
        } catch {
          // Best-effort — the user is logged out locally regardless of
          // whether the network call succeeds.
        } finally {
          get().clearSession()
        }
      },
      clearSession: () => {
        set({ token: null, user: null })
      },
      hydrate: async () => {
        try {
          const result = await authService.me()
          set({ user: result.data })
        } catch {
          get().clearSession()
        }
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)

// Wired at module load, mirroring `theme.store.ts`'s `Appearance.addChangeListener`
// idiom: closures read `useAuthStore.getState()` at call time so they always
// reflect the current store, never a value captured at module init.
configureApi({
  getToken: () => useAuthStore.getState().token ?? undefined,
  onUnauthorized: () => useAuthStore.getState().clearSession(),
})
