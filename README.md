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

## Credentials (mock)

```
email: test@occ.com.mx
password: Test1234
```
