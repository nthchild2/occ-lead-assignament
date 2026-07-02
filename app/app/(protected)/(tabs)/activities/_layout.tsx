import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../../../../core/hooks/useTheme'

// Nested top-tab/segmented navigator within the Actividades tab:
// Postuladas | Favoritos (R6). Reuses Expo Router's `Tabs` (per the plan's
// resolution — no custom tab bar component for this ticket).
// `tabBarPosition: 'top'` is required — without it this nested navigator
// defaults to a second BOTTOM tab bar, stacking directly above the outer
// Búsqueda/Actividades bar instead of sitting above this screen's content.
// Being top-positioned, it's now the first thing rendered in this screen's
// content area (the outer `(tabs)/_layout.tsx` has `headerShown: false`, so
// nothing upstream reserves the status bar/notch inset) — `paddingTop:
// insets.top` on `tabBarStyle` accounts for it directly.
export default function ActivitiesLayout() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'top',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.fgMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: 1,
          paddingTop: insets.top,
          height: 48 + insets.top,
        },
      }}
    >
      <Tabs.Screen
        name="applied"
        options={{
          title: 'Postuladas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}
