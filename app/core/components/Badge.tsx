import React from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../theme'

export type BadgeVariant = 'signal' | 'rosa' | 'oxblood' | 'leaf' | 'sun' | 'cenote' | 'ink'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

export function Badge({ label, variant = 'ink' }: BadgeProps) {
  const theme = useTheme()
  const { bg, fg, border } = badgeColors(theme, variant)

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radii.xs,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          fontFamily: theme.type.overline.fontFamily,
          fontSize: theme.type.overline.fontSize,
          fontWeight: '700',
          letterSpacing: theme.type.overline.letterSpacing,
          textTransform: 'uppercase',
          color: fg,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function badgeColors(theme: Theme, variant: BadgeVariant) {
  switch (variant) {
    case 'signal':
      return {
        bg: theme.palette.signal500,
        fg: theme.palette.ink950,
        border: theme.colors.borderInk,
      }
    case 'rosa':
      return { bg: theme.palette.rosa500, fg: theme.palette.ink950, border: theme.colors.borderInk }
    case 'oxblood':
      return {
        bg: theme.palette.oxblood500,
        fg: theme.palette.bone50,
        border: theme.colors.borderInk,
      }
    case 'leaf':
      return { bg: theme.palette.leaf500, fg: theme.palette.ink950, border: theme.colors.borderInk }
    case 'sun':
      return { bg: theme.palette.sun500, fg: theme.palette.ink950, border: theme.colors.borderInk }
    case 'cenote':
      return {
        bg: theme.palette.cenote500,
        fg: theme.palette.ink950,
        border: theme.colors.borderInk,
      }
    case 'ink':
      return { bg: theme.colors.navTint, fg: theme.colors.fg, border: theme.colors.glassEdge }
  }
}
