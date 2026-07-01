import type { Job } from '@occ/shared'
import React from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import { Badge } from './Badge'
import { Card } from './Card'

interface JobCardProps {
  job: Job
  onPress: () => void
}

// Caps rendered tag badges so the card's height stays bounded regardless of
// how many tags a job has — remainder tags are simply not shown (no "+N"
// literal, per the plan's decision to avoid inventing new copy).
const MAX_VISIBLE_TAGS = 3

function formatSalary(salary: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(salary)
}

function JobCardBase({ job, onPress }: JobCardProps) {
  const theme = useTheme()

  return (
    <Card
      shadow="sm"
      onPress={onPress}
      accessibilityLabel={`${job.title}, ${job.company}`}
      style={{ marginBottom: theme.spacing[3], gap: theme.spacing[2] }}
    >
      <Text
        style={{
          fontFamily: theme.type.bodyMd.fontFamily,
          fontSize: theme.type.bodyMd.fontSize,
          fontWeight: '600',
          color: theme.colors.fg,
        }}
      >
        {job.title}
      </Text>
      <Text
        style={{
          fontFamily: theme.type.bodySm.fontFamily,
          fontSize: theme.type.bodySm.fontSize,
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
      {job.tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          {job.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
            <Badge key={tag} label={tag} />
          ))}
        </View>
      ) : null}
    </Card>
  )
}

function areEqual(prev: JobCardProps, next: JobCardProps): boolean {
  return prev.job.id === next.job.id && prev.onPress === next.onPress
}

/** Renders a single job in the search list — themed, memoized per A5. */
export const JobCard = React.memo(JobCardBase, areEqual)
