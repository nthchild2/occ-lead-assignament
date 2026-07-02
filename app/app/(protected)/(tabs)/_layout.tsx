import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'

import { useTheme } from '../../../core/hooks/useTheme'

// Bottom tab navigator: Búsqueda | Actividades (R5). Screen content is each
// route file's own concern (placeholders in this ticket); this layout only
// wires the tab bar and theme colors.
export default function TabsLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.fgMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Búsqueda',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: 'Actividades',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'briefcase' : 'briefcase-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  )
}
