const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Tests are co-located next to the units they cover (see docs/MAP.md), including
// under app/app/ — Expo Router's route root. expo-router's require.context scans
// that whole tree for routes, so without this exclusion Metro bundles *.test.tsx
// files into the app itself: they get rejected as routes (harmless WARNs), but
// their top-level code (jest.mock(...), native-module imports meant for the Jest
// environment) still runs in the real app bundle and crashes it. Jest doesn't
// read this file, so co-located tests are unaffected.
config.resolver.blockList = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/]

module.exports = config
