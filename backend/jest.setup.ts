// Jest runs this before the test framework and before any test module is
// imported, so the validated env config (`src/config/env.ts`, which `.parse()`s
// at import and fails fast on a missing `JWT_SECRET`) sees a value. Supertest
// suites import `app`, which transitively loads the config — without this a
// clean shell (CI, or the verification gate) would throw at import time.
process.env.JWT_SECRET ||= 'test-secret-do-not-use-in-prod'
