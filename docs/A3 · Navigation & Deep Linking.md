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
    ├── _layout.tsx              ← auth guard + session hydration + Notifee handler
    └── (tabs)/
        ├── _layout.tsx          ← bottom tab bar: Search | Activities
        ├── index.tsx            ← Screen 1: Job Search + BottomSheetModal (Screen 2)
        └── activities/
            ├── _layout.tsx      ← top tab switcher: Applied | Favorites
            ├── applied.tsx      ← Screen 4a: Applied jobs (default)
            └── favorites.tsx    ← Screen 4b: Favorites
```

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
┌───────▼──────┐  ┌──────▼──────────────────────────────┐
│   (auth)/    │  │           (protected)/               │
│  _layout.tsx │  │  _layout.tsx                         │
│              │  │  - validates token on mount          │
│  login.tsx   │  │  - redirects to login if no session  │
│              │  │  - registers Notifee handler         │
└──────────────┘  └──────────────┬───────────────────────┘
                                 │
                  ┌──────────────▼───────────────────┐
                  │         (tabs)/_layout.tsx        │
                  │      bottom tab bar               │
                  └──────┬───────────────┬────────────┘
                         │               │
              ┌──────────▼──────┐  ┌─────▼──────────────────┐
              │   index.tsx     │  │   activities/           │
              │   Job Search    │  │   _layout.tsx           │
              │                 │  │   top tab switcher      │
              │  ┌───────────┐  │  └──────┬──────────────────┘
              │  │BottomSheet│  │         │               │
              │  │  Modal    │  │  ┌──────▼─────┐  ┌─────▼──────┐
              │  │ Job Detail│  │  │ applied.tsx│  │favorites   │
              │  └───────────┘  │  │ (default)  │  │.tsx        │
              └─────────────────┘  └────────────┘  └────────────┘
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

## Decision 2 · BottomSheetModal coexistence with the router

### Context

The job detail is a `BottomSheetModal` that opens over the list. It is not a route. The spec requires that closing the sheet does not reset the list scroll position — which rules out any navigation event being involved in opening or closing it.

Additionally, the user navigates between jobs by swiping inside the sheet. If each job were a route, every swipe would push or pop a route, polluting the back stack and creating conflicts between the back gesture and the swipe gesture.

### Decision

The `BottomSheetModal` is controlled imperatively via a ref in `index.tsx`. Opening and closing the sheet is not a navigation event — the route stack does not change.

```ts
// app/(protected)/(tabs)/index.tsx
const sheetRef = useRef<BottomSheetModal>(null)

const onJobPress = (job: Job, index: number) => {
  setActiveJob(job.id, index)
  sheetRef.current?.present()
}

const onSheetDismiss = () => {
  flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })
  clearActiveJob()
}
```

The list scroll position is never touched while the sheet is open. On dismiss, `scrollToIndex` brings the active job into view before `clearActiveJob()` resets the store.

---

## Decision 3 · Deep linking from push notifications

### Context

The spec requires that tapping a push notification opens the Job Detail sheet for a specific job, identified by `id` in the notification payload. The deep link scheme is `occ://vacante/:id`.

The entry point is always the Job Search screen — the sheet opens over it regardless of where the user is in the app. This keeps the UX identical whether the user tapped a job card or a notification.

### Decision

The deep link resolves to `/(protected)/(tabs)/index` with the job id passed as a query param: `/(protected)/(tabs)/index?jobId=123`.

`index.tsx` reads `jobId` from the URL params on mount and whenever params change. If present, it fetches the job and opens the sheet:

```ts
// app/(protected)/(tabs)/index.tsx
const { jobId } = useLocalSearchParams<{ jobId?: string }>()

useEffect(() => {
  if (!jobId) return
  jobsService.getById(jobId).then((job) => {
    setActiveJob(job.id, -1) // index unknown when coming from deep link
    sheetRef.current?.present()
  })
}, [jobId])
```

When the sheet closes from a deep link entry, `clearActiveJob()` is called and the `jobId` param is cleared from the URL so a re-render doesn't reopen the sheet:

```ts
const onSheetDismiss = () => {
  if (jobId) router.setParams({ jobId: undefined })
  clearActiveJob()
}
```

Note: when arriving from a deep link, the job is not in the `jobs.store` list — the user hasn't searched. In this case `activeJobIndex` is `-1` and swipe between jobs is disabled. The sheet shows the single job detail only.

### Notifee handler registration

The Notifee event handler is registered in `(protected)/_layout.tsx` so it is only active when the user is authenticated:

```ts
// app/(protected)/_layout.tsx
useEffect(() => {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data?.jobId) {
      router.push({
        pathname: '/(protected)/(tabs)/index',
        params: { jobId: detail.notification.data.jobId },
      })
    }
  })
}, [])
```

Background and quit state events are handled in the app entry point (`app/_layout.tsx`) via `notifee.onBackgroundEvent` and `notifee.getInitialNotification`.

---

## Decision 4 · Quit state — session hydration before navigating

### Context

When the app is closed and the user taps a notification, the app launches cold. The session must be validated before navigating to the protected sheet — otherwise the user could land on the detail screen without a valid token, and any action (apply, favorite) would fail with a 401.

### Decision

The hydration sequence in `(protected)/_layout.tsx` already handles this — it runs `GET /auth/me` before rendering any child screen. The deep link params are held in the URL until hydration completes.

The sequence on quit state tap:

```
App launches cold
  → root _layout.tsx renders
  → notifee.getInitialNotification() reads the pending notification
  → stores jobId in a ref (not navigating yet)
  → (protected)/_layout.tsx mounts
  → GET /auth/me runs
  → if valid: render children, then navigate to index?jobId=123
  → if invalid: logout(), navigate to login (jobId is dropped)
```

The jobId is not passed to the router until after hydration succeeds. This prevents a race condition where the sheet opens before the session is confirmed.

---

## Decision 5 · Activities nested navigation

### Context

The My Activities screen shows two lists: applied jobs and favorites. The spec says it can be "una pantalla con tabs internos o dos pantallas separadas."

### Decision

A nested navigator inside `activities/` with a top tab switcher. Applied jobs is the default tab.

```
activities/
├── _layout.tsx      ← top tab switcher (e.g. MaterialTopTabNavigator or custom)
├── applied.tsx      ← default
└── favorites.tsx
```

This keeps each list in its own file with its own data fetching, while the switcher at the top of the screen handles the transition between them. Each tab mounts its store (`applications.store`, `favorites.store`) independently.

The bottom tab bar remains visible — this is a nested navigator inside the Activities tab, not a replacement for it.

---

## Swipe index sync with the list

When the sheet is open and the user has swiped to job at index N:

1. `jobs.store.activeJobIndex` is updated on every swipe via `setActiveJob`
2. On sheet dismiss, `index.tsx` reads `activeJobIndex` and calls `flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })`
3. `clearActiveJob()` resets the store

If the user arrived via deep link (`activeJobIndex === -1`), `scrollToIndex` is skipped.

If the user swiped into jobs loaded from a subsequent page, `activeJobIndex` reflects the position in the full accumulated `jobs.store.jobs` array — not the position within a single page. `FlashList` receives the full array so the index is valid.