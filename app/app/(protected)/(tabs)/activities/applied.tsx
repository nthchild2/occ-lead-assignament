import type { Application } from '@occ/shared'
import { useEffect } from 'react'
import { Text, View } from 'react-native'

import { ActivityList, type ActivityRow } from '../../../../core/components'
import { useTheme } from '../../../../core/hooks/useTheme'
import { useApplicationsStore } from '../../../../store/applications.store'
import { useJobsStore } from '../../../../store/jobs.store'

function toRow(application: Application): ActivityRow {
  return { id: application.jobId, job: application.job }
}

// R1, R3, R5, R6, R7, R8: lists the user's applications, fetched on mount,
// with cancel (R3) and tap-to-open (R8) wired to the shared `ActivityList`.
export default function AppliedScreen() {
  const theme = useTheme()
  const items = useApplicationsStore((s) => s.items)
  const isLoading = useApplicationsStore((s) => s.isLoading)
  const error = useApplicationsStore((s) => s.error)

  useEffect(() => {
    void useApplicationsStore.getState().fetch()
  }, [])

  function handleRetry(): void {
    void useApplicationsStore.getState().fetch()
  }

  function handlePress(row: ActivityRow, index: number): void {
    useJobsStore.getState().setActiveJob(row.job.id, index)
  }

  function handleRemove(jobId: string): void {
    void useApplicationsStore.getState().remove(jobId)
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
        Postuladas
      </Text>
      <View style={{ flex: 1 }}>
        <ActivityList
          rows={items.map(toRow)}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
          onPress={handlePress}
          onRemove={handleRemove}
          removeLabel="Cancelar"
          emptyTitle="Sin postulaciones"
          emptyDescription="Las vacantes a las que apliques aparecerán aquí."
        />
      </View>
    </View>
  )
}
