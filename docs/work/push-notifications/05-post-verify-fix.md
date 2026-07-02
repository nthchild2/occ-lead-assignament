# Post-verify correction · `app.json`'s notifee plugin entry was NOT inert

- **Feature id:** `push-notifications`
- **Date:** 2026-07-02
- **Found by:** the user, running `pnpm exec expo start` for the first time after all 15 roadmap tickets were verified
- **Fixed by:** orchestrator

## What went wrong

`01-research.md`, `02-plan.md`, and `04-verify.md` all state that `app.json`'s `"@notifee/react-native"` plugin entry is **"inert"** — meaning safe to leave in place, no config plugin ships with the installed version (9.1.8), and Android channel setup happens entirely at runtime via `notifee.createChannel()` regardless.

That reasoning was correct for the AIDLC pipeline's verification path (`jest`, `tsc`, `eslint`) — **none of those tools ever load `app.json`**, so a broken plugin entry there is genuinely invisible to them. It was wrong for the real Expo CLI, which does load and try to resolve every string in `plugins` at `expo start` time, before Metro serves anything. `@notifee/react-native@9.1.8` has no `app.plugin.js` and its main export (`dist/index.js`) is ESM — Expo's config-plugin resolver tried to `require()` it as CJS and crashed:

```
PluginError: Unable to resolve a valid config plugin for @notifee/react-native.
SyntaxError: Unexpected token 'typeof'
```

This is a **known gap in the AIDLC framework as practiced on this run**: every ticket's verification gate is `tsc` + `eslint` + `jest`, none of which exercise `expo start`/Metro bundling. A config-level bug that only a live dev-server run can surface passed all 15 tickets' independent verification passes undetected.

## The fix

Removed `"@notifee/react-native"` from `app/app.json`'s `plugins` array (it was already correctly identified as contributing nothing at runtime — Android channel creation is 100% runtime, via `notifee.createChannel()` in `app/core/services/notifications.service.ts`). No other change needed.

**Verified via a real run**, not just re-typechecking:

1. `pnpm exec expo start` — Metro started clean, no `PluginError`.
2. Fetched the Expo manifest (`GET http://localhost:8081/`) — 200 OK, full config resolved including `scheme: "occ"`.
3. Fetched the actual iOS bundle URL Metro generated — **200 OK, 12.1MB compiled bundle**.
4. Server log confirmed: `iOS Bundled 4776ms ... entry.js (1898 modules)` — the entire app (all 15 tickets' code, `@notifee/react-native` included) compiles end-to-end via Metro/Hermes with zero errors.

## Correction to the record

The three "inert" claims in `01-research.md`, `02-plan.md`, and `04-verify.md` are **superseded by this file** — they were accurate for the verification tooling actually used, but incomplete: "inert" should have been scoped to "inert for the test/lint/typecheck pipeline," not "inert, full stop." Not editing those files in place, since they're an honest record of what the pipeline could see at the time; this file is the correction layer.

## Framework takeaway

Added to `docs/A6`'s "What this document is not" spirit: **the verification gate (`tsc`/`eslint`/`jest`) does not substitute for actually running the app.** A finding that's invisible to unit tests — like an Expo config-plugin resolution failure — can still block `expo start` outright. Any AIDLC run building an Expo/RN app should include at least one real `expo start` (or equivalent build) spot-check before calling the roadmap "done," not just green CI.
