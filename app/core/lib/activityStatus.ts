import { useApplicationsStore } from '../../store/applications.store'
import { useFavoritesStore } from '../../store/favorites.store'

// Plain functions, no React hooks — `Job` carries no `applied`/`favorited`
// field (ROADMAP resolved decision #3), so toggle state is derived by
// cross-referencing `applications.store`/`favorites.store` at call time via
// `getState()`, mirroring the `getState()`-at-call-time idiom used in
// `auth.store.ts`'s `configureApi` wiring. Usable from screens/components
// (not just hooks) since they read the store snapshot directly.

export function isJobApplied(jobId: string): boolean {
  return useApplicationsStore.getState().items.some((item) => item.jobId === jobId)
}

export function isJobFavorited(jobId: string): boolean {
  return useFavoritesStore.getState().items.some((job) => job.id === jobId)
}
