import type { Job } from '@occ/shared'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { Badge, Button, ErrorState, type ButtonVariant } from '../../core/components'
import { useTheme } from '../../core/hooks/useTheme'
import { isJobApplied, isJobFavorited } from '../../core/lib/activityStatus'
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

interface ActionButtonsProps {
  theme: Theme
  jobId: string
  applyMessage: string | null
  favoriteMessage: string | null
  onApply: () => void
  onToggleFavorite: () => void
}

// Extracted so `JobDetailContent`'s own branching stays under the complexity
// ceiling (mirrors `index.tsx`'s `FilterBar`/`ListContent` extraction).
function ActionButtons({
  theme,
  jobId,
  applyMessage,
  favoriteMessage,
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

  // R7/R8: never lets a rejected `add`/`remove` throw further — the sheet
  // stays open either way, and a 409 (`ALREADY_APPLIED`) or any other error
  // surfaces as an inline message instead.
  async function handleApply(): Promise<void> {
    setApplyMessage(null)
    try {
      await useApplicationsStore.getState().add(job.id, job)
    } catch (err) {
      setApplyMessage(messageFor(err))
    }
  }

  async function handleToggleFavorite(): Promise<void> {
    setFavoriteMessage(null)
    try {
      if (isJobFavorited(job.id)) {
        await useFavoritesStore.getState().remove(job.id)
      } else {
        await useFavoritesStore.getState().add(job)
      }
    } catch (err) {
      setFavoriteMessage(messageFor(err))
    }
  }

  return (
    <BottomSheetScrollView contentContainerStyle={{ padding: theme.gutter, gap: theme.spacing[3] }}>
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
        favoriteMessage={favoriteMessage}
        onApply={handleApply}
        onToggleFavorite={handleToggleFavorite}
      />
    </BottomSheetScrollView>
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
