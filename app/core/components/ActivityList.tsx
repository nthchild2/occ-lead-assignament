import type { Job } from '@occ/shared'
import React from 'react'
import { FlatList, View } from 'react-native'

import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { JobCard } from './JobCard'
import { JobCardSkeleton } from './Skeleton'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../theme'

// Lives in core/components/ (not route-adjacent) per docs/MAP.md: it's a
// reusable, navigation-agnostic list shared by two screens — and a non-route
// file inside app/app/ makes Expo Router warn about a missing default export
// on every start, since the router scans that whole tree as routes.

/** Normalized row shape both `applied.tsx` and `favorites.tsx` adapt into. */
export interface ActivityRow {
  id: string
  job: Job
}

interface ActivityListProps {
  rows: ActivityRow[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onPress: (row: ActivityRow, index: number) => void
  onRemove: (id: string) => void
  removeLabel: string
  emptyTitle: string
  emptyDescription?: string
}

const SKELETON_COUNT = 5

// Extracted so `ActivityList`'s own branching stays under the complexity
// ceiling (mirrors `index.tsx`'s `ListContent` extraction, `.eslintrc.js:26`).
function ActivityRowItem({
  theme,
  row,
  index,
  onPress,
  onRemove,
  removeLabel,
}: {
  theme: Theme
  row: ActivityRow
  index: number
  onPress: (row: ActivityRow, index: number) => void
  onRemove: (id: string) => void
  removeLabel: string
}) {
  // `JobCard` and the remove `Button` are SIBLINGS inside this `View`, never
  // nested inside `JobCard`'s own `Card` `Pressable` boundary — nesting two
  // Pressables would double-fire `onPress` when the inner one is tapped.
  return (
    <View style={{ gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
      <JobCard job={row.job} onPress={() => onPress(row, index)} />
      <Button
        label={removeLabel}
        variant="danger"
        size="sm"
        accessibilityLabel={`${removeLabel} ${row.job.title}`}
        accessibilityHint="Se elimina de esta lista de inmediato"
        onPress={() => onRemove(row.id)}
      />
    </View>
  )
}

/**
 * Shared four-state list (loading/error/empty/list) used by both
 * `applied.tsx` and `favorites.tsx`, parameterized over a normalized
 * `{ id, job }` row so it works identically for `Application[]` and `Job[]`
 * sources. `FlatList`-based (not `FlashList`) — these are small, non-paginated
 * per-user lists outside A5's virtualization scope.
 */
export function ActivityList({
  rows,
  isLoading,
  error,
  onRetry,
  onPress,
  onRemove,
  removeLabel,
  emptyTitle,
  emptyDescription,
}: ActivityListProps) {
  const theme = useTheme()

  if (isLoading && rows.length === 0) {
    return (
      <View style={{ paddingHorizontal: theme.gutter }}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </View>
    )
  }

  if (error && rows.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (!isLoading && !error && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item, index }) => (
        <ActivityRowItem
          theme={theme}
          row={item}
          index={index}
          onPress={onPress}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      )}
      contentContainerStyle={{ paddingHorizontal: theme.gutter, paddingBottom: theme.spacing[6] }}
    />
  )
}
