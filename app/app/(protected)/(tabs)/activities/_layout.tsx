import { Tabs } from 'expo-router'

import { useTheme } from '../../../../core/hooks/useTheme'

// Nested top-tab/segmented navigator within the Actividades tab:
// Postuladas | Favoritos (R6). Reuses Expo Router's `Tabs` (per the plan's
// resolution — no custom tab bar component for this ticket).
export default function ActivitiesLayout() {
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
      <Tabs.Screen name="applied" options={{ title: 'Postuladas' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoritos' }} />
    </Tabs>
  )
}
