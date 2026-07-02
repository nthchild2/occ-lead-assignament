import type { Job } from '@occ/shared'
import { useEffect } from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../../../../core/hooks/useTheme'
import { useFavoritesStore } from '../../../../store/favorites.store'
import { useJobsStore } from '../../../../store/jobs.store'
import { ActivityList, type ActivityRow } from './ActivityList'

function toRow(job: Job): ActivityRow {
  return { id: job.id, job }
}

// R2, R4, R5, R6, R7, R8: lists the user's favorites, fetched on mount, with
// remove (R4) and tap-to-open (R8) wired to the shared `ActivityList`.
export default function FavoritesScreen() {
  const theme = useTheme()
  const items = useFavoritesStore((s) => s.items)
  const isLoading = useFavoritesStore((s) => s.isLoading)
  const error = useFavoritesStore((s) => s.error)

  useEffect(() => {
    void useFavoritesStore.getState().fetch()
  }, [])

  function handleRetry(): void {
    void useFavoritesStore.getState().fetch()
  }

  function handlePress(row: ActivityRow, index: number): void {
    useJobsStore.getState().setActiveJob(row.id, index)
  }

  function handleRemove(jobId: string): void {
    void useFavoritesStore.getState().remove(jobId)
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Text
        style={{
          fontFamily: theme.type.headingSm.fontFamily,
          fontSize: theme.type.headingSm.fontSize,
          color: theme.colors.fg,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing[6],
          paddingBottom: theme.spacing[3],
        }}
      >
        Favoritos
      </Text>
      <View style={{ flex: 1 }}>
        <ActivityList
          rows={items.map(toRow)}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
          onPress={handlePress}
          onRemove={handleRemove}
          removeLabel="Quitar"
          emptyTitle="Sin favoritos"
          emptyDescription="Guarda vacantes para encontrarlas fácilmente aquí."
        />
      </View>
    </View>
  )
}
