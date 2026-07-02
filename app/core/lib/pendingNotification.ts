// Quit-state notification handoff (R5). `notifee.getInitialNotification()`
// is read in `app/_layout.tsx` before the auth session is known to be
// hydrated — that file has no hydration awareness (per `02-plan.md`'s
// Approach). This module-level, non-Zustand holder carries a single pending
// job id across the app/_layout.tsx -> (protected)/_layout.tsx boundary
// without persisting it (it's a one-shot, process-lifetime value, not
// user-scoped state — doesn't belong in a Zustand store per A2 Decision 1).
//
// Read-and-clear semantics: `consumePendingJobId()` returns the held value
// and resets it to `null` in the same call, so a second consume in the same
// process never re-delivers the same notification's job id.
let pendingJobId: string | null = null

export function setPendingJobId(id: string | null): void {
  pendingJobId = id
}

export function consumePendingJobId(): string | null {
  const id = pendingJobId
  pendingJobId = null
  return id
}
