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
  // Only scroll the list if the Search tab is currently active
  if (activeTab === 'index' && activeJobIndex !== -1) {
    flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })
  }
  clearActiveJob()
  if (jobId) router.setParams({ jobId: undefined })
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

Job cards in `index.tsx` call `setActiveJob(job.id, index)`. Notification taps set `jobId` as a URL param, which the protected layout reads and translates into a `setActiveJob` call.

---

## Decision 3 · Deep linking from push notifications

### Context

The spec requires that tapping a push notification opens the Job Detail sheet for a specific job using the scheme `occ://vacante/:id`. The sheet must open over whatever tab is currently active — not necessarily the Search tab.

### Decision

The deep link resolves to `/(protected)/(tabs)/index?jobId=123`. The protected layout intercepts the `jobId` param, fetches the job, and opens the sheet without switching tabs:

```ts
// app/(protected)/_layout.tsx
const { jobId } = useLocalSearchParams<{ jobId?: string }>()

useEffect(() => {
  if (!jobId) return
  jobsService.getById(jobId).then((job) => {
    setActiveJob(job.id, -1) // index is unknown when arriving from a deep link
  })
}, [jobId])
```

`activeJobIndex` is `-1` when arriving from a deep link — the job is not in the `jobs.store` list. Swipe between jobs is disabled in this case. The sheet shows the single job detail only.

When the sheet closes, the `jobId` param is cleared from the URL so the sheet doesn't reopen on re-render.

### Notifee handler registration

The Notifee event handler is registered in `(protected)/_layout.tsx` so it only fires when the user is authenticated:

```ts
// app/(protected)/_layout.tsx
useEffect(() => {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data?.jobId) {
      router.setParams({ jobId: detail.notification.data.jobId })
    }
  })
}, [])
```

Background and quit state events are handled in `app/_layout.tsx` via `notifee.onBackgroundEvent` and `notifee.getInitialNotification`.

---

## Decision 4 · Quit state — session hydration before navigating

### Context

When the app is closed and the user taps a notification, the app launches cold. The session must be validated before the sheet opens — otherwise any action (apply, favorite) would fail with a 401.

### Decision

The hydration sequence in `(protected)/_layout.tsx` runs `GET /auth/me` before rendering any children. The `jobId` is held until hydration completes.

Sequence on quit state tap:

```
App launches cold
  → app/_layout.tsx renders
  → notifee.getInitialNotification() reads the pending notification
  → stores jobId in a ref (not navigating yet)
  → (protected)/_layout.tsx mounts
  → GET /auth/me runs
  → if valid: render children, then set jobId param → sheet opens
  → if invalid: logout(), navigate to login (jobId is dropped)
```

The `jobId` is not passed to the router until after hydration succeeds. This prevents the sheet from opening before the session is confirmed.

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
2. On sheet dismiss, if the Search tab is active and `activeJobIndex !== -1`, `scrollToIndex` brings the active job into view
3. `clearActiveJob()` resets the store

If `activeJobIndex` is `-1` (deep link entry), `scrollToIndex` is skipped.

If the user swiped into jobs loaded from a subsequent page, `activeJobIndex` reflects the position in the full accumulated `jobs.store.jobs` array — not the position within a single page. `FlashList` receives the full array so the index is valid.

---

## Implementation note · Quit state jobId handoff

The quit state sequence stores the `jobId` in a ref in `app/_layout.tsx` before hydration completes. The protected layout reads this value after hydration succeeds. The handoff between them needs to be deliberate — a React context or a module-level variable is the cleanest option. A Zustand slice is possible but adds persistence risk: this value should never survive an app restart on its own. This needs careful attention during implementation to avoid a race condition where the sheet opens before the session is confirmed.