import type NotifeeType from '@notifee/react-native'
import type { EventType, AndroidImportance } from '@notifee/react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

// `@notifee/react-native` ships fully-native code and is officially
// unsupported inside the Expo Go client (no config plugin can fix this —
// Expo Go's binary simply has no Notifee native module compiled in). Its
// package entry touches the native bridge at *import* time, so it must
// never be statically imported anywhere the app runs — a top-level
// `import notifee from '@notifee/react-native'` throws immediately in Expo
// Go, before any screen renders. `require()` deferred behind this Expo Go
// check is the only way to keep the import from executing there.
//
// Under Jest, `expo-constants`'s mocked native module (`jest-expo`) reports
// `executionEnvironment` as `''`, so `isExpoGo` is `false` in tests and this
// resolves to the real `require()` call, which Jest's own moduleNameMapper
// redirects to `jest/notifeeMock.js` — existing tests are unaffected.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

interface NotifeeHandle {
  notifee: typeof NotifeeType
  EventType: typeof EventType
  AndroidImportance: typeof AndroidImportance
}

// Returns `null` in Expo Go (and any other environment without the native
// module) — callers must treat notification features as a safe no-op there.
export function getNotifee(): NotifeeHandle | null {
  if (isExpoGo) return null

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@notifee/react-native') as NotifeeHandle & { default: typeof NotifeeType }
  return {
    notifee: mod.default,
    EventType: mod.EventType,
    AndroidImportance: mod.AndroidImportance,
  }
}
