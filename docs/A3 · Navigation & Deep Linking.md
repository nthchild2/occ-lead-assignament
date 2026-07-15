# A3 · Navigation & Deep Linking

## Context

This document covers the route structure, protected navigation, deep linking from push notifications, how the `BottomSheetModal` coexists with the router, and how the swipe index syncs with the list when the sheet closes.

---

## Route structure

```
/
├── (auth)/
│   ├── _layout.tsx              ← redirects to (protected) if session exists
│   └── login.tsx                ← Screen 3: Auth
└── (protected)/
    ├── _layout.tsx              ← auth guard + session hydration + Notifee handler + BottomSheetModal
    └── (tabs)/
        ├── _layout.tsx          ← bottom tab bar: Search | Activities
        ├── index.tsx            ← Screen 1: Job Search (FlashList, filters)
        └── activities/
            ├── _layout.tsx      ← top tab switcher: Applied | Favorites
            ├── applied.tsx      ← Screen 4a: Applied jobs (default)
            └── favorites.tsx    ← Screen 4b: Favorites
```

The `BottomSheetModal` lives in `(protected)/_layout.tsx`, above the tab navigator. This decouples the sheet from the Search tab — it can open over any tab without switching the active tab.

---

## Diagram

```
┌─────────────────────────────────────────┐
│              app/_layout.tsx            │
│         (root: providers, fonts)        │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼──────┐  ┌──────▼──────────────────────────────────────┐
│   (auth)/    │  │              (protected)/                    │
│  _layout.tsx │  │  _layout.tsx                                 │
│              │  │  - validates token on mount                  │
│  login.tsx   │  │  - redirects to login if no session          │
│              │  │  - registers Notifee handler                 │
└──────────────┘  │  - owns BottomSheetModal ref                 │
                  └──────────────┬───────────────────────────────┘
                                 │
                  ┌──────────────▼───────────────────┐
                  │         (tabs)/_layout.tsx        │
                  │         bottom tab bar            │
                  └──────┬───────────────┬────────────┘
                         │               │
              ┌──────────▼──────┐  ┌─────▼──────────────────┐
              │   index.tsx     │  │   activities/           │
              │   Job Search    │  │   _layout.tsx           │
              │   (FlashList)   │  │   top tab switcher      │
              └─────────────────┘  └──────┬──────────────────┘
                                          │               │
                                   ┌──────▼─────┐  ┌─────▼──────┐
                                   │ applied.tsx│  │favorites   │
                                   │ (default)  │  │.tsx        │
                                   └────────────┘  └────────────┘

  BottomSheetModal renders above all tabs, owned by (protected)/_layout.tsx
```

---

## Decision 1 · Protected routes

### Context

All screens except login require an authenticated session. Expo Router handles this via layout-level redirects.

### Decision

`(protected)/_layout.tsx` is the auth guard for the entire protected subtree. On mount it reads the token from `auth.store`, calls `GET /auth/me`, and redirects to `/(auth)/login` if the token is missing or invalid.

```ts
// app/(protected)/_layout.tsx
const { token, logout } = useAuthStore()

useEffect(() => {
  if (!token) {
    router.replace('/(auth)/login')
    return
  }
  authService.me().catch(() => {
    logout()
    router.replace('/(auth)/login')
  })
}, [])
```

`(auth)/_layout.tsx` does the inverse — if a session already exists, it redirects to `/(protected)/(tabs)/index` so a logged-in user never sees the login screen.

The guard runs once on mount. Mid-session 401s are handled by the interceptor in `core/services/api.ts`, which calls `logout()` and navigates to login without going through the guard again.

---

## Decision 2 · BottomSheetModal decoupled from the tab navigator

### Context

The job detail is a `BottomSheetModal` that opens over whatever screen is currently active. It must not be tied to a specific tab — a notification tap should open the sheet without switching the active tab.

Additionally, the spec requires that closing the sheet does not reset the list scroll position — which rules out any navigation event being involved in opening or closing it. And since the user navigates between jobs by swiping inside the sheet, routing each job as a separate screen would pollute the back stack and conflict with the swipe gesture.

### Decision

The `BottomSheetModal` is owned by `(protected)/_layout.tsx` and controlled imperatively via a ref. Opening and closing the sheet is not a navigation event — the route stack and the active tab do not change.

Any part of the app that needs to open the sheet sets `activeJobId` in `jobs.store`. The protected layout listens to that value and opens the sheet:

```ts
// app/(protected)/_layout.tsx
const sheetRef = useRef<BottomSheetModal>(null)
const { activeJobId, clearActiveJob } = useJobsStore()

useEffect(() => {
  if (activeJobId) sheetRef.current?.present()
}, [activeJobId])

const onSheetDismiss = () => {
  // Only scroll the list if we have a known list position (index >= 0)
  if (activeJobIndex !== null && activeJobIndex >= 0) {
    flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })
  }
  clearActiveJob()
}

return (
  <>
    <Slot />
    <BottomSheetModal ref={sheetRef} onDismiss={onSheetDismiss}>
      <JobDetail />
    </BottomSheetModal>
  </>
)
```

Job cards in `index.tsx` call `setActiveJob(job.id, index)`. Notification taps and the `occ://vacante/:id` deep link funnel into the exact same call (with index `-1` — see Decision 3), so the layout has a single trigger for presenting the sheet regardless of entry point.

---

## Decision 3 · Deep linking from push notifications

### Context

The spec requires that tapping a push notification opens the Job Detail sheet for a specific job using the scheme `occ://vacante/:id`. The sheet must open over whatever tab is currently active — not necessarily the Search tab.

### Decision

The deep link is implemented as a dedicated dynamic route: `occ://vacante/:id` resolves to `app/(protected)/vacante/[id].tsx`. Expo Router automatically registers file-based routes as deep-link targets — the file path `app/(protected)/vacante/[id].tsx` becomes the scheme handler `occ://vacante/:id` without additional configuration. The route renders no UI — it reads the `id` param, sets the active job, and immediately redirects to the tabs root; the protected layout's existing `activeJobId` effect (Decision 2) then presents the sheet over whatever tab is active:

```ts
// app/(protected)/vacante/[id].tsx
export default function VacanteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()

  useEffect(() => {
    if (id) {
      useJobsStore.getState().setActiveJob(id, -1)
    }
  }, [id])

  return <Redirect href="/(protected)/(tabs)" />
}
```

`activeJobIndex` is `-1` when arriving this way — the job is not necessarily in the `jobs.store` list. Swipe between jobs is disabled in this case, and the sheet's content falls back to fetching the job by id (`jobsService.getById`) when it isn't in the loaded list.

Because the route redirects immediately, no URL param lingers after the sheet opens — the "sheet reopens on re-render" hazard of a query-param approach doesn't arise.

### Notifee handler registration

Foreground taps don't go through the router at all. `(protected)/_layout.tsx` registers the handler — so it only fires when the user is authenticated — and calls the store directly:

```ts
// app/(protected)/_layout.tsx
function handleForegroundPress(event: NotifeeEvent): void {
  if (event.type !== EventType.PRESS) return
  const jobId = event.detail.notification?.data?.jobId
  if (typeof jobId === 'string') {
    useJobsStore.getState().setActiveJob(jobId, -1)
  }
}

useEffect(() => notifee.onForegroundEvent(handleForegroundPress), [])
```

Background and quit-state events are handled in `app/_layout.tsx` via `notifee.onBackgroundEvent` and `notifee.getInitialNotification` — both stash the job id in `core/lib/pendingNotification.ts` (a module-level, read-and-clear holder) instead of navigating, and Decision 4 covers when that pending id is consumed.

---

## Decision 4 · Quit state — session hydration before navigating

### Context

When the app is closed and the user taps a notification, the app launches cold. The session must be validated before the sheet opens — otherwise any action (apply, favorite) would fail with a 401.

### Decision

The hydration sequence in `(protected)/_layout.tsx` runs `GET /auth/me` before rendering any children. The job id is held in `core/lib/pendingNotification.ts` until hydration completes.

Sequence on quit state tap:

```
App launches cold
  → app/_layout.tsx renders
  → notifee.getInitialNotification() reads the pending notification
  → setPendingJobId(jobId) stashes it (no navigation yet)
  → (protected)/_layout.tsx mounts
  → GET /auth/me runs
  → if valid: hydration flips to 'ready' → consumePendingJobId()
    → setActiveJob(jobId, -1) → sheet opens
  → if invalid: clearSession() → redirect to login (pending id is dropped)
```

`consumePendingJobId()` is read-and-clear — it returns the held value and resets it in the same call, so the same notification can never re-open the sheet twice — and it only runs once hydration is `'ready'`, which prevents the sheet from opening before the session is confirmed.

---

## Decision 5 · Activities nested navigation

### Context

The My Activities screen shows two lists: applied jobs and favorites. The spec says it can be "una pantalla con tabs internos o dos pantallas separadas."

### Decision

A nested navigator inside `activities/` with a top tab switcher. Applied jobs is the default tab.

```
activities/
├── _layout.tsx      ← top tab switcher
├── applied.tsx      ← default
└── favorites.tsx
```

Each tab mounts its own store (`applications.store`, `favorites.store`) independently. The bottom tab bar remains visible — this is a nested navigator inside the Activities tab, not a replacement for it.

---

## Swipe index sync with the list

When the sheet is open and the user has swiped to job at index N:

1. `jobs.store.activeJobIndex` is updated on every swipe via `setActiveJob`
2. On sheet dismiss, if the list's ref is registered and `activeJobIndex >= 0`, `scrollToIndex` brings the active job into view (best-effort, wrapped so a stale ref/index can never crash the dismiss)
3. `clearActiveJob()` resets the store

If `activeJobIndex` is `-1` (deep link / notification entry) or `null`, `scrollToIndex` is skipped.

If the user swiped into jobs loaded from a subsequent page, `activeJobIndex` reflects the position in the full accumulated `jobs.store.jobs` array — not the position within a single page. `FlashList` receives the full array so the index is valid.

---

## Implementation note · Quit state jobId handoff

The quit-state handoff is implemented as a module-level holder, `core/lib/pendingNotification.ts`: `app/_layout.tsx` calls `setPendingJobId()` before hydration completes, and `(protected)/_layout.tsx` calls `consumePendingJobId()` (read-and-clear semantics) only after its hydration state reaches `'ready'`. A Zustand slice was deliberately avoided — this value must never survive an app restart on its own, and keeping it out of any store removes the risk of it ever being swept into a future `persist` config. The read-and-clear contract plus the hydration gate is what closes the race condition where the sheet could open before the session is confirmed.
