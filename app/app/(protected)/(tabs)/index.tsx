import { Text, View } from 'react-native'

import { useTheme } from '../../../core/hooks/useTheme'

// Themed placeholder standing in for the future job-search screen
// (`job-search-screen`, out of scope for app-nav-shell).
export default function SearchScreen() {
  const theme = useTheme()

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg,
        padding: theme.spacing[6],
      }}
    >
      <Text
        style={{
          fontFamily: theme.type.headingSm.fontFamily,
          fontSize: theme.type.headingSm.fontSize,
          color: theme.colors.fg,
        }}
      >
        Búsqueda — placeholder
      </Text>
    </View>
  )
}
