# occ-lead-ejercicio

Technical exercise for the Developer Lead Sr. — React Native position at OCC · Redarbor México.

## How this project was build

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI (`npm install -g expo-cli`)

### Install

```bash
# Install all workspaces from the root
npm install
```

### Environment variables

```bash
# Copy the example and fill in values
cp .env.example .env         # backend env
cp .env.example app/.env     # app env (API_BASE_URL only)
```

### Run the backend

```bash
cd backend
npm start
# Server running at http://localhost:3000
```

### Run the app

```bash
cd app
npx expo start
```

### Run tests

```bash
# From root — runs all workspaces
npm test
```

### Type check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

---

## Architecture

See `docs/` for full architecture documentation:

- [A1 · Monorepo Architecture](docs/A1-architecture.md)
- [A2 · State & Data Strategy](docs/A2-state-data.md)
- [A3 · Navigation & Deep Linking](docs/A3-navigation.md)
- [A4 · Quality Strategy](docs/A4-quality.md)
- [A5 · Performance](docs/A5-performance.md)

## Key decisions

- **Monorepo**: npm workspaces with three packages — `app`, `backend`, `packages/shared`
- **Shared types**: Zod schemas in `packages/shared` consumed by both app and backend
- **API contract**: `{ data }` for success, `{ error: { code, message } }` for errors — no `ok` field, aligned with Google Cloud API Design Guide
- **State**: Zustand for all state, one store per domain
- **Backend**: Modular Monolith with Clean Architecture layers per domain
- **Frontend**: `core/` (reusable library) + `app/` (Expo Router hierarchy)

## API response envelope (no `ok` field)

The exercise brief proposes an `{ ok, data, error }` envelope. We deliberately
drop the `ok` field and use `{ data }` on success and `{ error: { code, message } }`
on failure. This is a reasoned decision, not an oversight.

The `ok` flag is redundant with the HTTP status code, which already communicates
success or failure at the transport level. Keeping both invites contradictions —
if `ok: true` arrives with a `500` status, which does the client trust? Following
the Google Cloud API Design Guide, we separate the two concerns:

- **Transport errors** (`404 Not Found`, `500 Internal Server Error`) → the HTTP
  status code is the right mechanism.
- **Domain errors** (`ALREADY_APPLIED`, `VALIDATION_ERROR`) → the status code alone
  is insufficient, so the `error.code` field carries the domain semantics. Clients
  branch on `error.code`, never on message strings (which can change).

Removing `ok` leaves one source of truth per concern and avoids subtle client bugs.
Full rationale and alternatives considered (RFC 9457 Problem Details, keeping `ok`)
are documented in `docs/A1 · Monorepo Architecture.md` Decision 6.

## Credentials (mock)

```
email: test@occ.com.mx
password: Test1234
```
