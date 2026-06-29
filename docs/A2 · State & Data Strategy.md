# A2 · State & Data Strategy

## Context

This document covers how state is managed across the app: user session, server data, pagination, and the prefetch strategy for the job detail swipe. Types referenced here (`Job`, `User`, `JobFilters`) are imported from `@occ/shared`.

---

## State ownership model

| Category | Examples | Tool |
|---|---|---|
| Auth state | JWT, user data | Zustand + AsyncStorage |
| UI state | active job index, bottom sheet state | Zustand (not persisted) |
| Server data | jobs, applications, favorites | fetch in hooks, stored in Zustand |
| Pagination | current page, total, hasNext | Zustand per domain |

The exercise specifies Zustand for state management. We use it for all state categories — auth, UI, and server data — with a thin service layer handling the actual HTTP calls.

---

## Decision 1 · Zustand stores

### Context

The exercise requires JWT persistence across app restarts and a global auth state that gates navigation.

### Decision

One store per domain:

```
store/
├── auth.store.ts          ← JWT, user data, login/logout actions — persisted
├── jobs.store.ts          ← jobs list, pagination, filters, active job — not persisted
├── applications.store.ts  ← applied jobs list, loading, error — not persisted
└── favorites.store.ts     ← favorited jobs list, loading, error — not persisted
```

Only `auth.store` is persisted via AsyncStorage. All other stores reset on every app launch.

```ts
// store/auth.store.ts
interface AuthStore {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

```ts
// store/jobs.store.ts
interface JobsStore {
  // List state
  jobs: Job[]
  filters: JobFilters
  pagination: { page: number; total: number; hasNext: boolean }
  isLoading: boolean
  error: string | null

  // Active job (swipe)
  activeJobId: string | null
  activeJobIndex: number | null

  // Actions
  setFilters: (filters: Partial<JobFilters>) => void
  appendJobs: (jobs: Job[], pagination: Pagination) => void
  resetList: () => void
  setActiveJob: (id: string, index: number) => void
  clearActiveJob: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}
```

The JWT is read from `auth.store` by the API service interceptor in `core/services/api.ts` on every authenticated request. Components never access `token` directly.

`applications.store` and `favorites.store` follow the same shape as `jobs.store` — a list, loading flag, error, and actions to fetch and mutate. They are fetched on mount in the My Activities screen and reset when the user logs out.

---

## Decision 2 · Pagination

### Context

The job search screen loads jobs in pages of 20. Scrolling to the end of the list triggers the next page. Any change to filters or sort order resets the list to page 1.

### Decision

Pagination state lives in `jobs.store`. The fetch hook reads the current page from the store and appends results:

```ts
// core/hooks/useJobs.ts
const useJobs = () => {
  const { filters, pagination, appendJobs, resetList, setLoading, setError } = useJobsStore()

  const fetchPage = async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await jobsService.list({ ...filters, page })
      appendJobs(response.data.items, response.data.pagination)
    } catch (err) {
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const fetchNextPage = () => {
    if (pagination.hasNext) fetchPage(pagination.page + 1)
  }

  const refetch = () => {
    resetList()
    fetchPage(1)
  }

  return { fetchNextPage, refetch }
}
```

Filter or sort changes call `resetList()` then `fetchPage(1)`, which clears the accumulated jobs and starts from scratch. This is wired to the debounced search input (300ms as specified) and the sort/filter selectors.

---

## Decision 3 · Auth session lifecycle

### Context

On app start, the persisted JWT may be expired. The app needs to validate it before navigating to a protected screen.

### Decision

On app start, the root layout reads the token from `auth.store` and calls `GET /auth/me` before rendering any screen:

```ts
// app/_layout.tsx
const { token, logout } = useAuthStore()

useEffect(() => {
  if (!token) {
    router.replace('/(auth)/login')
    return
  }
  authService.me()
    .then((user) => {
      // token is valid, navigation proceeds
    })
    .catch(() => {
      logout()
      router.replace('/(auth)/login')
    })
}, [])
```

The 401 interceptor in `core/services/api.ts` handles token expiration mid-session — it clears `auth.store` and redirects to login without the mutation or hook needing to handle it.

Logout calls `POST /auth/logout`, clears `auth.store`, resets `jobs.store`, and navigates to login.

---

## Decision 4 · Swipe prefetch strategy

### Context

The exercise requires that when the user is 3 jobs from the end of the current page while swiping, the next page loads silently in the background. The swipe must not show any loading state between pages.

### Decision

The swipe handler in the Job Detail bottom sheet tracks `activeJobIndex` against the jobs array length. When the threshold is reached, it triggers `fetchNextPage()` from `useJobs` in the background:

```ts
const PREFETCH_THRESHOLD = 3

// In the swipe handler
const onSwipe = (newIndex: number) => {
  setActiveJob(jobs[newIndex].id, newIndex)

  const nearEnd = newIndex >= jobs.length - PREFETCH_THRESHOLD
  if (nearEnd && pagination.hasNext && !isLoading) {
    fetchNextPage()
  }
}
```

Because `appendJobs` adds to the existing array in the store, the new jobs become available as the user continues swiping — no reset, no loading state exposed in the sheet.

If the next page fetch fails, `isLoading` returns to false and `error` is set in the store. The swipe stops at the last available job and a subtle end-of-results indicator is shown.

When the sheet closes, `activeJobIndex` from `jobs.store` is used to scroll the FlashList to the last active job before `clearActiveJob()` is called.

---

## State flow summary

```
User opens app
  → auth.store rehydrates from AsyncStorage
  → GET /auth/me validates token
  → valid: navigate to (protected)
  → invalid: logout(), navigate to (auth)/login

User searches jobs
  → filter change → resetList() → fetchPage(1)
  → scroll to end → fetchNextPage()
  → jobs accumulate in jobs.store

User opens job detail
  → setActiveJob(id, index)
  → bottom sheet opens over the list

User swipes to job N-3 from end
  → fetchNextPage() fires in background
  → new jobs append to jobs.store
  → swipe continues uninterrupted

User closes sheet
  → FlashList scrolls to activeJobIndex
  → clearActiveJob()

User logs out
  → POST /auth/logout
  → auth.store cleared
  → jobs.store reset
  → applications.store reset
  → favorites.store reset
  → navigate to (auth)/login
```