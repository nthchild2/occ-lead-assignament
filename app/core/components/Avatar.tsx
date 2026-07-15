import { Image } from 'expo-image'
import React from 'react'
import { Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'

interface AvatarProps {
  uri?: string | null
  fallback: string
  size?: number
}

/** Company logo with an initials fallback when no image is available. */
export function Avatar({ uri, fallback, size = 44 }: AvatarProps) {
  const theme = useTheme()
  const initials = fallback.trim().slice(0, 2).toUpperCase()

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: theme.radii.full }}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    )
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: theme.type.label.fontFamily,
          fontSize: size * 0.36,
          color: theme.colors.fgMuted,
        }}
      >
        {initials}
      </Text>
    </View>
  )
}
