import type React from 'react'
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

import { useTheme } from '../hooks/useTheme'

interface CollapsibleHeaderProps extends Omit<PressableProps, 'style'> {
  label: string
  isExpanded: boolean
  onToggle: () => void
  accessibilityHint?: string
}

/**
 * CollapsibleHeader — a reusable header button for collapsible sections.
 * Animates a chevron icon and manages the expand/collapse visual feedback
 * using theme tokens from the design system.
 */
export function CollapsibleHeader({
  label,
  isExpanded,
  onToggle,
  accessibilityHint,
  ...rest
}: CollapsibleHeaderProps) {
  const theme = useTheme()
  const chevronRotation = useSharedValue(0)

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }))

  const handleToggle = () => {
    chevronRotation.value = withTiming(isExpanded ? 0 : 180, {
      duration: theme.motion.base.duration,
    })
    onToggle()
  }

  return (
    <Pressable
      onPress={handleToggle}
      style={[
        styles.container,
        { paddingHorizontal: theme.gutter, paddingVertical: theme.spacing[3] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        accessibilityHint || (isExpanded ? `Contraer ${label}` : `Expandir ${label}`)
      }
      accessibilityState={{ expanded: isExpanded }}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          {
            fontFamily: theme.type.bodyMd.fontFamily,
            fontSize: theme.type.bodyMd.fontSize,
            color: theme.colors.fg,
          },
        ]}
      >
        {label}
      </Text>
      <Animated.View style={animatedChevronStyle}>
        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.fg} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
})
