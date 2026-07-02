import type { Job } from '@occ/shared'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, InteractionManager, Text, View } from 'react-native'
import type { ViewStyle } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { Badge, Button, ErrorState, type ButtonVariant } from '../../core/components'
import { useTheme } from '../../core/hooks/useTheme'
import { isJobApplied, isJobFavorited } from '../../core/lib/activityStatus'
import { useJobs } from '../../core/hooks/useJobs'
import * as jobsService from '../../core/services/jobs.service'
import { ApiError } from '../../core/services/api'
import type { Theme } from '../../core/theme'
import { useApplicationsStore } from '../../store/applications.store'
import { useFavoritesStore } from '../../store/favorites.store'
import { useJobsStore } from '../../store/jobs.store'

const GENERIC_ACTION_ERROR = 'No se pudo completar la operación. Intenta de nuevo.'

// Scoped to this file (single call site) per the plan — mirrors
// `JobCard.tsx`'s `formatSalary`, kept local rather than shared since no
// other component needs it yet.
function formatSalary(salary: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(salary)
}

// Minimal `Intl.DateTimeFormat` call, no new date library, per the plan.
function formatPublishedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso))
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return GENERIC_ACTION_ERROR
}

const SUCCESS_CHIP_DURATION_MS = 2200

// Auto-dismissing success message — separate from the (persistent, per the
// spec's "mostrar mensaje sin cerrar el sheet") error message state below.
// File-scoped since this is the only place that needs it, mirroring
// `formatSalary`'s "no other component needs it yet" precedent.
function useSuccessChip(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), SUCCESS_CHIP_DURATION_MS)
    return () => clearTimeout(timer)
  }, [message])

  return [message, setMessage]
}

/**
 * Resolves the active job: looks it up in `jobs.store.jobs` first (already
 * loaded from the list), falling back to `jobsService.getById` when it's not
 * present (R9 — e.g. accessed outside the currently-loaded list). Local
 * component state only, per the plan — this ticket does not lift it into a
 * store.
 */
function useActiveJob(activeJobId: string | null): {
  job: Job | null
  loading: boolean
  error: string | null
  retry: () => void
} {
  const jobsInStore = useJobsStore((s) => s.jobs)
  const storeJob = jobsInStore.find((j) => j.id === activeJobId) ?? null

  const [fetchedJob, setFetchedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!activeJobId || storeJob) {
      setFetchedJob(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    jobsService
      .getById(activeJobId)
      .then((result) => {
        if (cancelled) return
        setFetchedJob(result.data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(messageFor(err))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, storeJob, attempt])

  return {
    job: storeJob ?? fetchedJob,
    loading,
    error,
    retry: () => setAttempt((n) => n + 1),
  }
}

// R1/R5: distance/velocity thresholds a pan gesture must cross on release to
// count as an intentional swipe (rather than an incidental drag that should
// snap back). Mirrors typical carousel/pager thresholds — no existing
// precedent in this codebase to match, chosen conservatively.
const SWIPE_DISTANCE_THRESHOLD = 80
const SWIPE_VELOCITY_THRESHOLD = 800
// R4: prefetch the next page once within this many jobs of the end of the
// currently-loaded list.
const PREFETCH_REMAINING_THRESHOLD = 3

/**
 * R3 (spec correction, see `02-plan.md`): swiping is a no-op unless the
 * active job is genuinely positioned in `jobs` at `activeJobIndex` — covers
 * both the initial/cleared state (`activeJobIndex === null`) and
 * `useActiveJob`'s fallback-fetch case (job shown via `jobsService.getById`,
 * not part of the loaded list, so `activeJobIndex` is stale/mismatched).
 */
function isSwipeDisabled(
  jobs: Job[],
  activeJobIndex: number | null,
  activeJobId: string | null,
): boolean {
  if (activeJobIndex === null) return true
  return jobs[activeJobIndex]?.id !== activeJobId
}

/**
 * R1/R2: determines the target index a swipe should land on, clamped to
 * `[0, jobs.length - 1]`. `direction` is `1` for a left swipe (advance to
 * the next job) and `-1` for a right swipe (go back).
 */
function computeSwipeTargetIndex(
  currentIndex: number,
  direction: 1 | -1,
  jobsLength: number,
): number {
  const raw = currentIndex + direction
  return Math.max(0, Math.min(jobsLength - 1, raw))
}

/**
 * R4/R5: within `PREFETCH_REMAINING_THRESHOLD` of the end of the loaded
 * list and a next page exists, schedule `fetchNextPage()` via
 * `InteractionManager.runAfterInteractions` so it never competes with the
 * settling swipe animation. `fetchNextPage()` carries its own
 * `hasNext`/`isLoading` guard (see `useJobs.ts`), so this only checks
 * `hasNext` here to avoid a second, potentially-stale source of truth for
 * the "already loading" half of the guard.
 */
function maybePrefetchNextPage(targetIndex: number, fetchNextPage: () => Promise<void>): void {
  const { jobs, pagination } = useJobsStore.getState()
  const remaining = jobs.length - targetIndex
  if (remaining <= PREFETCH_REMAINING_THRESHOLD && pagination.hasNext) {
    InteractionManager.runAfterInteractions(() => {
      void fetchNextPage()
    })
  }
}

interface SwipeGestureResult {
  panGesture: ReturnType<typeof Gesture.Pan>
  animatedStyle: ViewStyle
  endOfResults: boolean
}

/**
 * Builds the horizontal swipe-between-jobs gesture (R1-R6). Extracted out of
 * `JobDetailContent` to keep that component's own branching under the
 * complexity ceiling, mirroring the `ActionButtons` extraction above.
 *
 * The pan gesture runs its callbacks on the UI thread (reanimated
 * worklets); `onEnd`'s index/store/prefetch logic must run on the JS thread
 * (Zustand `set()`, `InteractionManager`), so it's wrapped in `runOnJS`.
 */
function useJobSwipe(): SwipeGestureResult {
  const { fetchNextPage } = useJobs()
  const jobs = useJobsStore((s) => s.jobs)
  const activeJobIndex = useJobsStore((s) => s.activeJobIndex)
  const activeJobId = useJobsStore((s) => s.activeJobId)
  const error = useJobsStore((s) => s.error)
  const pagination = useJobsStore((s) => s.pagination)
  const [endOfResults, setEndOfResults] = useState(false)

  const translateX = useSharedValue(0)
  const swipeDisabled = isSwipeDisabled(jobs, activeJobIndex, activeJobId)

  // R6: reaching the last loaded job with no next page (or a prior prefetch
  // attempt left `jobs.store.error` set) means further swipe-past-the-end
  // attempts should show the indicator instead of doing anything jarring.
  const atLastLoadedJob = activeJobIndex !== null && activeJobIndex === jobs.length - 1
  const noMoreToLoad = !pagination.hasNext || error !== null

  function handleSwipeEnd(direction: 1 | -1): void {
    if (swipeDisabled || activeJobIndex === null) return

    if (direction === 1 && atLastLoadedJob && noMoreToLoad) {
      setEndOfResults(true)
      return
    }
    setEndOfResults(false)

    const targetIndex = computeSwipeTargetIndex(activeJobIndex, direction, jobs.length)
    if (targetIndex === activeJobIndex) return

    const targetJob = jobs[targetIndex]
    if (!targetJob) return

    useJobsStore.getState().setActiveJob(targetJob.id, targetIndex)
    maybePrefetchNextPage(targetIndex, fetchNextPage)
  }

  const panGesture = Gesture.Pan()
    .enabled(!swipeDisabled)
    // Only claims horizontal movement so vertical drags pass through to
    // `BottomSheetScrollView` untouched (plan risk: gesture conflicts
    // between the horizontal pan and the sheet's own vertical scroll/drag).
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      'worklet'
      const passesThreshold =
        Math.abs(event.translationX) > SWIPE_DISTANCE_THRESHOLD ||
        Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD
      translateX.value = 0
      if (!passesThreshold) return
      const direction: 1 | -1 = event.translationX < 0 ? 1 : -1
      runOnJS(handleSwipeEnd)(direction)
    })

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return { panGesture, animatedStyle, endOfResults }
}

interface ActionButtonsProps {
  theme: Theme
  jobId: string
  applyMessage: string | null
  applySuccess: string | null
  favoriteMessage: string | null
  favoriteSuccess: string | null
  onApply: () => void
  onToggleFavorite: () => void
}

// Extracted so `JobDetailContent`'s own branching stays under the complexity
// ceiling (mirrors `index.tsx`'s `FilterBar`/`ListContent` extraction).
function ActionButtons({
  theme,
  jobId,
  applyMessage,
  applySuccess,
  favoriteMessage,
  favoriteSuccess,
  onApply,
  onToggleFavorite,
}: ActionButtonsProps) {
  const applied = isJobApplied(jobId)
  const favorited = isJobFavorited(jobId)

  const applyVariant: ButtonVariant = applied ? 'secondary' : 'primary'
  const favoriteVariant: ButtonVariant = favorited ? 'accent' : 'secondary'

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Button
        label={applied ? 'Ya aplicaste' : 'Aplicar'}
        variant={applyVariant}
        disabled={applied}
        onPress={onApply}
        fullWidth
      />
      {applySuccess ? <Badge label={applySuccess} variant="leaf" /> : null}
      {applyMessage ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.type.bodySm.fontSize }}>
          {applyMessage}
        </Text>
      ) : null}
      <Button
        label={favorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        variant={favoriteVariant}
        onPress={onToggleFavorite}
        fullWidth
      />
      {favoriteSuccess ? <Badge label={favoriteSuccess} variant="leaf" /> : null}
      {favoriteMessage ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.type.bodySm.fontSize }}>
          {favoriteMessage}
        </Text>
      ) : null}
    </View>
  )
}

function JobDetailContent({ job, theme }: { job: Job; theme: Theme }) {
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useSuccessChip()
  const [favoriteSuccess, setFavoriteSuccess] = useSuccessChip()

  // R7/R8: never lets a rejected `add`/`remove` throw further — the sheet
  // stays open either way, and a 409 (`ALREADY_APPLIED`) or any other error
  // surfaces as an inline message instead. On success, a transient chip
  // confirms the action fired — the button's own state change (label/variant/
  // disabled) is the persistent indicator; the chip is just the "yes, that
  // just happened" moment.
  async function handleApply(): Promise<void> {
    setApplyMessage(null)
    try {
      await useApplicationsStore.getState().add(job.id, job)
      setApplySuccess('Aplicaste a esta vacante')
    } catch (err) {
      setApplyMessage(messageFor(err))
    }
  }

  async function handleToggleFavorite(): Promise<void> {
    setFavoriteMessage(null)
    try {
      if (isJobFavorited(job.id)) {
        await useFavoritesStore.getState().remove(job.id)
        setFavoriteSuccess('Quitaste de favoritos')
      } else {
        await useFavoritesStore.getState().add(job)
        setFavoriteSuccess('Agregado a favoritos')
      }
    } catch (err) {
      setFavoriteMessage(messageFor(err))
    }
  }

  const { panGesture, animatedStyle, endOfResults } = useJobSwipe()

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <BottomSheetScrollView
          contentContainerStyle={{ padding: theme.gutter, gap: theme.spacing[3] }}
        >
          <Text
            style={{
              fontFamily: theme.type.headingSm.fontFamily,
              fontSize: theme.type.headingSm.fontSize,
              fontWeight: '600',
              color: theme.colors.fg,
            }}
          >
            {job.title}
          </Text>
          <Text
            style={{
              fontFamily: theme.type.bodyMd.fontFamily,
              fontSize: theme.type.bodyMd.fontSize,
              color: theme.colors.fgMuted,
            }}
          >
            {job.company} · {job.city}
          </Text>
          {job.salary !== null ? (
            <Text
              style={{
                fontFamily: theme.type.monoMd.fontFamily,
                fontSize: theme.type.monoMd.fontSize,
                color: theme.colors.fgSecondary,
              }}
            >
              {formatSalary(job.salary)}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: theme.type.bodySm.fontFamily,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.fgMuted,
            }}
          >
            Publicado el {formatPublishedAt(job.publishedAt)}
          </Text>
          {job.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
              {job.tags.map((tag) => (
                <Badge key={tag} label={tag} />
              ))}
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: theme.type.bodyMd.fontFamily,
              fontSize: theme.type.bodyMd.fontSize,
              color: theme.colors.fg,
            }}
          >
            {job.description}
          </Text>
          <ActionButtons
            theme={theme}
            jobId={job.id}
            applyMessage={applyMessage}
            applySuccess={applySuccess}
            favoriteMessage={favoriteMessage}
            favoriteSuccess={favoriteSuccess}
            onApply={handleApply}
            onToggleFavorite={handleToggleFavorite}
          />
          {endOfResults ? (
            <Text
              style={{
                fontFamily: theme.type.bodySm.fontFamily,
                fontSize: theme.type.bodySm.fontSize,
                color: theme.colors.fgMuted,
                textAlign: 'center',
              }}
            >
              No hay más vacantes por mostrar.
            </Text>
          ) : null}
        </BottomSheetScrollView>
      </Animated.View>
    </GestureDetector>
  )
}

/**
 * Renders the Job Detail sheet's content. Store-aware (`jobs.store`,
 * `applications.store`, `favorites.store`, `activityStatus.ts`) — lives
 * outside `core/components/` because `core/` must not import from `app/`
 * (`.eslintrc.js` `import/no-restricted-paths`). Takes no props; reads
 * `activeJobId` directly so `(protected)/_layout.tsx` only owns the sheet's
 * ref/effect/dismiss plumbing.
 */
export default function JobDetail() {
  const theme = useTheme()
  const activeJobId = useJobsStore((s) => s.activeJobId)
  const { job, loading, error, retry } = useActiveJob(activeJobId)

  if (loading) {
    return (
      <View style={{ padding: theme.spacing[8], alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.fg} />
      </View>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={retry} />
  }

  if (!job) {
    return null
  }

  return <JobDetailContent job={job} theme={theme} />
}
