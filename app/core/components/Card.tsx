import React from 'react'
import { Pressable, View, type ViewProps } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../theme'

type ShadowSize = 'sm' | 'md' | 'lg' | 'none'

interface CardProps extends ViewProps {
  shadow?: ShadowSize
  onPress?: () => void
}

export function Card({
  shadow = 'md',
  onPress,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  ...rest
}: CardProps) {
  const theme = useTheme()
  const shadowStyle = shadow === 'none' ? {} : shadowForSize(theme, shadow)

  // When pressable, the a11y label/hint belong on the Pressable (the node
  // screen readers focus), not the inner View — so they're destructured out
  // of `rest` and attached to whichever node is the interactive one.
  const content = (
    <View
      style={[
        {
          borderRadius: theme.radii.lg,
          padding: theme.spacing[5],
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        shadowStyle,
        style,
      ]}
      accessibilityLabel={onPress ? undefined : accessibilityLabel}
      accessibilityHint={onPress ? undefined : accessibilityHint}
      {...rest}
    >
      {children}
    </View>
  )

  if (!onPress) return content

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
    >
      {content}
    </Pressable>
  )
}

function shadowForSize(theme: Theme, size: Exclude<ShadowSize, 'none'>) {
  const key = size === 'sm' ? 'brickSm' : size === 'lg' ? 'brickLg' : 'brickMd'
  return theme.shadows[key]
}
