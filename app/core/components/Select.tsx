import React, { useState } from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'

import { useTheme } from '../hooks/useTheme'

export interface SelectOption<T extends string = string> {
  label: string
  value: T
}

interface SelectProps<T extends string> {
  label?: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
}

/** Used for the city filter and the five-option sort selector on Job Search. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
}: SelectProps<T>) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

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
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          height: 44,
          paddingHorizontal: 14,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.surfaceSunken,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontFamily: theme.type.bodySm.fontFamily,
            fontSize: theme.type.bodySm.fontSize,
            color: selected ? theme.colors.fg : theme.colors.fgSubtle,
          }}
        >
          {selected?.label ?? placeholder ?? 'Seleccionar'}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              paddingVertical: theme.spacing[4],
              maxHeight: '60%',
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: theme.gutter,
                    backgroundColor:
                      item.value === value ? theme.colors.surfaceSunken : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.type.bodyMd.fontFamily,
                      fontSize: theme.type.bodyMd.fontSize,
                      fontWeight: item.value === value ? '600' : '400',
                      color: theme.colors.fg,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}
