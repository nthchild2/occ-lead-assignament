// Manual Jest mock for `@notifee/react-native`, wired via
// `app/package.json`'s `moduleNameMapper`.
//
// The package's OWN shipped `jest-mock.js` (the officially documented path,
// `@notifee/react-native/jest-mock`) is itself an ES module (`import { ... }
// from './dist/version'` etc.) and crashes with `SyntaxError: Cannot use
// import statement outside a module` under this project's jest-expo config —
// the same class of ESM-under-Jest incompatibility hit with msw
// (`app-api-client`), `@shopify/flash-list` (`job-search-screen`), and
// `react-native-reanimated` (`login-screen`). Rather than fight
// `transformIgnorePatterns` for a third-party ESM package, this is a small
// hand-rolled CommonJS stand-in exposing only the surface this codebase
// actually calls (`app/core/services/notifications.service.ts`,
// `app/app/_layout.tsx`, `app/app/(protected)/_layout.tsx`).
//
// Values for `EventType`/`AndroidImportance` are copied from the real
// package's type declarations (`dist/types/Notification.d.ts`,
// `dist/types/NotificationAndroid.d.ts`) so any test asserting on the raw
// numeric value still matches production semantics.

const EventType = {
  UNKNOWN: -1,
  DISMISSED: 0,
  PRESS: 1,
  ACTION_PRESS: 2,
  DELIVERED: 3,
}

const AndroidImportance = {
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
}

const notifee = {
  createChannel: jest.fn(async (channel) => channel?.id ?? 'mock-channel-id'),
  displayNotification: jest.fn(async (notification) => notification?.id ?? 'mock-notification-id'),
  // `null` by default (no notification launched the app) — override per-test
  // via `mockResolvedValue`/`mockResolvedValueOnce` for the quit-state case.
  getInitialNotification: jest.fn(async () => null),
  // Both return an unsubscribe function, mirroring notifee's real API and
  // its own official mock's shape — `(protected)/_layout.tsx`'s
  // `useEffect` cleanup calls whatever `onForegroundEvent` returns.
  onBackgroundEvent: jest.fn(() => jest.fn()),
  onForegroundEvent: jest.fn(() => jest.fn()),
}

module.exports = notifee
module.exports.default = notifee
module.exports.EventType = EventType
module.exports.AndroidImportance = AndroidImportance
