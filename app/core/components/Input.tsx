import React, { useState } from 'react'
import { Text, TextInput, View, type TextInputProps } from 'react-native'

import { useTheme } from '../hooks/useTheme'

interface InputProps extends TextInputProps {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useTheme()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.borderStrong

  return (
    <View>
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            fontFamily: theme.type.overline.fontFamily,
            fontSize: theme.type.overline.fontSize,
            fontWeight: '700',
            letterSpacing: theme.type.overline.letterSpacing,
            textTransform: 'uppercase',
            color: theme.colors.fgMuted,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.fgSubtle}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        style={[
          {
            height: 48,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: theme.colors.surfaceSunken,
            paddingHorizontal: 16,
            fontFamily: theme.type.bodyMd.fontFamily,
            fontSize: theme.type.bodyMd.fontSize,
            color: theme.colors.fg,
          },
          style,
        ]}
        {...rest}
      />
      {error || hint ? (
        <Text
          style={{
            marginTop: 8,
            fontFamily: theme.type.caption.fontFamily,
            fontSize: theme.type.caption.fontSize,
            color: error ? theme.colors.danger : theme.colors.fgSubtle,
          }}
        >
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  )
}
