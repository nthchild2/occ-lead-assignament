import React, { useEffect } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '../hooks/useTheme'

interface SkeletonProps {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: ViewStyle
}

export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme()
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true)
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radii.sm,
          backgroundColor: theme.colors.surfaceSunken,
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

/** Skeleton matching the JobCard layout, for the search list's loading state. */
export function JobCardSkeleton() {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Skeleton width={44} height={44} radius={theme.radii.full} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
})
