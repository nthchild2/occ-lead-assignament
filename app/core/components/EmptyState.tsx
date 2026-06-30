import React from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme()

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing[8],
        gap: theme.spacing[2],
      }}
    >
      <Text
        style={{
          fontFamily: theme.type.headingSm.fontFamily,
          fontSize: theme.type.headingSm.fontSize,
          fontWeight: '600',
          color: theme.colors.fg,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontFamily: theme.type.bodySm.fontFamily,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.fgMuted,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing[3] }}>
          <Button label={actionLabel} variant="secondary" size="sm" onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}
