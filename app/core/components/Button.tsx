import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../theme'

export type ButtonVariant = 'primary' | 'accent' | 'danger' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 36, paddingHorizontal: 14, fontSize: 12 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 13 },
  lg: { height: 56, paddingHorizontal: 28, fontSize: 14 },
}

const isBrutal = (variant: ButtonVariant) =>
  variant === 'primary' || variant === 'accent' || variant === 'danger'

const borderWidthFor = (variant: ButtonVariant, brutal: boolean) => {
  if (brutal) return 1.5
  if (variant === 'secondary') return 1
  return 0
}

const usePressAbsorb = (brickOffset: number) => {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pressed.value * brickOffset },
      { translateY: pressed.value * brickOffset },
    ],
    shadowOpacity: 1 - pressed.value,
  }))

  const handlers = {
    onPressIn: () => {
      pressed.value = withTiming(1, { duration: 80 })
    },
    onPressOut: () => {
      pressed.value = withTiming(0, { duration: 80 })
    },
  }

  return { animatedStyle, handlers }
}

/**
 * Brutal variants carry a hard brick-shadow that "absorbs" on press — the
 * button translates by the shadow offset while the shadow itself disappears,
 * mirroring Boletify's signature press interaction.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const theme = useTheme()
  const dims = SIZES[size]
  const brutal = isBrutal(variant)
  const brickOffset = size === 'sm' ? 3 : 6
  const { animatedStyle, handlers } = usePressAbsorb(brutal ? brickOffset : 0)
  const colors = variantColors(theme, variant)

  return (
    <Animated.View
      style={[
        animatedStyle,
        brutal && {
          shadowColor: theme.colors.brick,
          shadowOffset: { width: brickOffset, height: brickOffset },
          shadowRadius: 0,
          elevation: 6,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        disabled={disabled || loading}
        onPressIn={(e) => {
          handlers.onPressIn()
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          handlers.onPressOut()
          onPressOut?.(e)
        }}
        style={[
          styles.base,
          {
            height: dims.height,
            paddingHorizontal: dims.paddingHorizontal,
            borderRadius: theme.radii.md,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: borderWidthFor(variant, brutal),
            opacity: disabled ? 0.5 : 1,
          },
          fullWidth && styles.fullWidth,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={colors.fg} size="small" />
        ) : (
          <ButtonLabel label={label} icon={icon} fontSize={dims.fontSize} color={colors.fg} />
        )}
      </Pressable>
    </Animated.View>
  )
}

function ButtonLabel({
  label,
  icon,
  fontSize,
  color,
}: {
  label: string
  icon: React.ReactNode
  fontSize: number
  color: string
}) {
  const theme = useTheme()
  return (
    <View style={styles.content}>
      {icon}
      <Text
        style={{
          fontFamily: theme.type.label.fontFamily,
          fontSize,
          fontWeight: '600',
          letterSpacing: theme.type.label.letterSpacing,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function variantColors(theme: Theme, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return {
        bg: theme.colors.primary,
        fg: theme.colors.primaryFg,
        border: theme.colors.borderInk,
      }
    case 'accent':
      return { bg: theme.colors.accent, fg: theme.colors.accentFg, border: theme.colors.borderInk }
    case 'danger':
      return { bg: theme.colors.danger, fg: theme.colors.dangerFg, border: theme.colors.borderInk }
    case 'secondary':
      return { bg: 'transparent', fg: theme.colors.fg, border: theme.colors.borderStrong }
    case 'ghost':
      return { bg: 'transparent', fg: theme.colors.fg, border: 'transparent' }
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
})
