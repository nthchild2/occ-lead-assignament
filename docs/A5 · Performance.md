# A5 · Performance

## Context

This document covers the metrics we monitor in production, the tools we use, and the concrete optimizations applied to the job list. It also covers how the swipe prefetch is managed without impacting the initial render.

> **Implementation status.** The FlashList optimizations (Decision 2) and the `InteractionManager` prefetch strategy (Decision 3) are implemented and live in the code. The monitoring and analytics stack (Decisions 1 and 4) is the **production plan, not wired in this exercise**: Sentry is not a dependency of the project, and the `@react-native-firebase/perf` / `analytics` packages are installed but never initialized — no traces or events fire today. They're documented here so the day the app ships, what to instrument and why is already decided; treat every code snippet in Decisions 1 and 4 as the intended integration, not existing code.

---

## Decision 1 · Production monitoring

### Sentry — error and crash monitoring

Sentry captures crashes, unhandled exceptions, and network errors in both the app and the backend. It is the primary tool for detecting and diagnosing production issues.

**App:**

- Crash reporting with full stack trace and device context
- Unhandled promise rejections
- Network error tracking — failed API calls, timeouts, 4xx/5xx responses
- Release tracking — errors are tagged to the version that introduced them, making regressions easy to identify
- Breadcrumbs — a trail of user actions leading up to a crash, without capturing PII

**Backend:**

- Unhandled exceptions in Express middleware
- Domain service errors
- JWT verification failures (volume spikes indicate potential abuse)

Sentry is initialized in both `app/_layout.tsx` and `backend/src/app.ts` before any other setup. Source maps are uploaded as part of the EAS production build so stack traces resolve to original TypeScript, not minified output.

### Firebase Performance — runtime performance monitoring

Firebase Performance monitors the real-world performance of the app on user devices — not just what we observe in development or staging.

**What we instrument:**

| Metric                     | What it tells us                                     |
| -------------------------- | ---------------------------------------------------- |
| App start time (cold)      | Time from process launch to first interactive screen |
| App start time (warm)      | Time from background to foreground                   |
| Job list first render      | Time from screen mount to first visible job card     |
| API response times         | P50, P90, P99 for each endpoint                      |
| HTTP success/failure rates | Error rates per endpoint in production               |

Firebase Performance's network monitoring instruments fetch calls automatically — no manual instrumentation needed for API response times. Custom traces are added for the metrics that matter most: app start and list first render.

```ts
// app/_layout.tsx
const appStartTrace = perf().newTrace('app_start')
appStartTrace.start()

// After session hydration and first screen renders
appStartTrace.stop()
```

### What we do not monitor

We do not log user behavior analytics (taps, navigation paths, session duration) in this setup. That is a product analytics concern — a separate tool (Mixpanel, Amplitude) would own it. Sentry and Firebase Performance are strictly technical metrics.

---

## Decision 2 · FlashList optimizations

The job search screen is the highest-traffic surface in the app. List performance directly affects perceived app quality.

### Optimization 1 · `estimatedItemSize`

FlashList uses `estimatedItemSize` to calculate scroll position and layout without measuring every item on render. If this value is missing or inaccurate, FlashList falls back to measuring each item individually — expensive and the most common cause of janky list performance.

We measure a representative job card at design time and set a fixed value:

```tsx
<FlashList
  data={jobs}
  estimatedItemSize={88} // measured from a typical job card
  renderItem={({ item }) => <JobCard job={item} />}
/>
```

If job cards have variable heights (with and without salary), we measure the average and accept a small layout adjustment on first render rather than measuring dynamically.

### Optimization 2 · Memoized list items

Without memoization, every update to `jobs.store` — including pagination appending new jobs — triggers a re-render of every visible card, even if their data didn't change. On a list of 80+ items this is measurable.

```ts
const JobCard = React.memo(
  ({ job }: { job: Job }) => {
    // render
  },
  (prev, next) => prev.job.id === next.job.id,
)
```

The comparison function checks only the job `id` — if the id hasn't changed, the card doesn't re-render. This is safe because jobs are immutable once fetched.

### Optimization 3 · `keyExtractor` stability

Unstable keys cause FlashList to discard and remount items instead of recycling them. Keys must always be the job `id`, never the array index:

```tsx
<FlashList
  keyExtractor={(item) => item.id}
  ...
/>
```

### Optimization 4 · `getItemType`

Job cards without a salary field render shorter than those with one. Without `getItemType`, FlashList may recycle a tall card slot into a short one, causing layout jumps:

```tsx
<FlashList
  getItemType={(item) => item.salary ? 'with-salary' : 'without-salary'}
  ...
/>
```

### Optimization 5 · `drawDistance`

The default `drawDistance` pre-renders items well outside the viewport, increasing initial render cost. Reducing it improves first paint at the cost of occasional blank frames when scrolling very fast:

```tsx
<FlashList
  drawDistance={250}
  ...
/>
```

### Optimization 6 · Company logo handling with `expo-image`

If job cards include company logos, `expo-image` handles lazy loading and disk caching out of the box. It is significantly faster than React Native's built-in `Image` component in list scenarios because it uses a shared cache and decodes images off the main thread.

```tsx
import { Image } from 'expo-image'

;<Image
  source={{ uri: job.companyLogoUrl }}
  style={styles.logo}
  contentFit="contain"
  placeholder={blurhash}
/>
```

The `placeholder` prop shows a blurhash while the image loads — no blank squares, no layout shift.

---

## Decision 3 · Swipe prefetch without impacting initial render

This section expands on the prefetch strategy defined in A2 with the specific concern of not impacting the initial render of the job list or the bottom sheet.

### The problem

`fetchNextPage()` is a network call that runs on the JS thread. If it fires while the bottom sheet is animating open or while the list is mounting, it competes for JS thread time and can cause dropped frames.

### The solution — `InteractionManager`

`InteractionManager.runAfterInteractions` queues work until all animations and interactions have settled. The prefetch fires after the sheet animation completes, not during it:

```ts
const onSwipe = (newIndex: number) => {
  setActiveJob(jobs[newIndex].id, newIndex)

  if (shouldPrefetchNextPage(newIndex, jobs)) {
    InteractionManager.runAfterInteractions(() => {
      fetchNextPage()
    })
  }
}
```

This guarantees the swipe animation runs at 60 fps on the UI thread (via Reanimated) while the prefetch is deferred to a quiet moment on the JS thread.

### Why this works with Reanimated

The swipe animation runs entirely on the UI thread via `react-native-reanimated`. It does not touch the JS thread during animation. `InteractionManager` defers JS work until the interaction is complete — in this case, until the swipe gesture settles. The two systems don't interfere.

### Metrics to watch

Firebase Performance custom traces on the swipe interaction will surface any regression here:

```ts
const swipeTrace = perf().newTrace('job_swipe')
swipeTrace.start()
// on swipe settle
swipeTrace.stop()
```

If `job_swipe` P90 climbs above ~16ms, it indicates JS thread contention during the swipe and warrants investigation.

---

## Decision 4 · Analytics infrastructure

Analytics setup is our responsibility. What gets measured and where is owned by the analytics team — this document covers only the infrastructure decisions.

### SDK

Firebase Analytics is the natural choice — we already initialize the Firebase SDK for Performance Monitoring. Adding Analytics requires no additional dependency or initialization cost.

Firebase Analytics integrates natively with Google Analytics 4 (GA4) via the Firebase ↔ GA4 link. The analytics team gets GA4 event data without us adding a separate GA SDK to the app.

### Initialization

Firebase Analytics initializes lazily by default — it does not block the JS thread on startup and does not impact cold start time. No special handling needed beyond the standard Firebase initialization in `app/_layout.tsx`.

### What we instrument

We provide the infrastructure and a typed event logging utility. The analytics team defines the event taxonomy — names, properties, funnels. Our utility enforces that events are logged consistently:

```ts
// core/lib/analytics.ts
import analytics from '@react-native-firebase/analytics'

export const logEvent = (name: string, params?: Record<string, string | number | boolean>) => {
  if (!consentGranted()) return
  analytics().logEvent(name, params)
}
```

All event logging goes through this utility — never directly through the Firebase Analytics SDK from components or services. This gives us a single place to enforce consent checks, add debugging, or swap the underlying SDK.

### User consent — GDPR

Analytics must be gated behind user consent in markets where GDPR or equivalent privacy regulations apply. Firebase Analytics must not fire events before the user has explicitly opted in.

Firebase Analytics supports this via `setAnalyticsCollectionEnabled`:

```ts
// Disable on startup by default
await analytics().setAnalyticsCollectionEnabled(false)

// Enable only after user grants consent
const onConsentGranted = async () => {
  await analytics().setAnalyticsCollectionEnabled(true)
}
```

The consent flow and UI are out of scope for this exercise but the infrastructure must support it from day one. Retrofitting consent into an analytics setup that assumed opt-in by default is expensive.

### What this document does not cover

- Event naming conventions and taxonomy — owned by the analytics team
- Funnel definitions and conversion tracking — owned by product
- A/B testing instrumentation — a separate concern, likely Firebase Remote Config

---

## Key metrics summary

| Metric                                   | Tool                              | Target  |
| ---------------------------------------- | --------------------------------- | ------- |
| Crash-free sessions                      | Sentry                            | > 99.5% |
| App cold start                           | Firebase Performance              | < 2s    |
| Job list first render                    | Firebase Performance              | < 500ms |
| API P90 response time                    | Firebase Performance              | < 300ms |
| Job swipe P90                            | Firebase Performance custom trace | < 16ms  |
| High-severity dependency vulnerabilities | Dependabot + `npm audit`          | 0       |
