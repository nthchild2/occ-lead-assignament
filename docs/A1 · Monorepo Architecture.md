# A1 · Monorepo Architecture

## Context

This document covers the structure of the `occ-lead-ejercicio` monorepo and the reasoning behind each structural decision.

---

## Monorepo Structure

```
occ-lead-ejercicio/
├── .github/
│   ├── CLAUDE.md                        ← instructions for AI agents
│   ├── copilot-instructions.md          ← instructions for GitHub Copilot
│   └── pull_request_template.md         ← structured PR template
├── packages/
│   └── shared/                          ← Zod schemas shared between app and backend
│       ├── package.json
│       └── src/
│           ├── schemas/
│           │   ├── job.schema.ts
│           │   ├── auth.schema.ts
│           │   ├── application.schema.ts
│           │   └── index.ts
│           └── index.ts
├── app/                                 ← Expo project (React Native)
│   ├── core/                            ← reusable internal library
│   │   ├── components/                  ← screen-agnostic UI components
│   │   ├── theme/                       ← design tokens, colors, typography
│   │   ├── services/                    ← api.ts and domain services
│   │   ├── hooks/                       ← generic hooks (useDebounce, etc.)
│   │   └── lib/                         ← pure utilities (formatters, validators)
│   ├── app/                             ← Expo Router — file-based routing
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx
│   │   ├── (protected)/
│   │   │   ├── _layout.tsx              ← auth guard + session hydration + Notifee handler + BottomSheetModal
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx          ← bottom tab bar: Search | Activities
│   │   │       ├── index.tsx            ← Job Search (FlashList, filters)
│   │   │       └── activities/
│   │   │           ├── _layout.tsx      ← top tab switcher: Applied | Favorites
│   │   │           ├── applied.tsx      ← Applied jobs (default)
│   │   │           └── favorites.tsx    ← Favorites
│   │   └── _layout.tsx                  ← root layout, providers, fonts
│   ├── store/                           ← Zustand stores (auth, UI state)
│   └── package.json
├── backend/                             ← Node.js + Express server
│   ├── src/
│   │   ├── domains/                     ← self-contained domain modules
│   │   │   ├── auth/
│   │   │   │   ├── auth.router.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.schema.ts
│   │   │   ├── jobs/
│   │   │   │   ├── jobs.router.ts
│   │   │   │   ├── jobs.service.ts
│   │   │   │   ├── jobs.schema.ts
│   │   │   │   └── jobs.seed.ts
│   │   │   └── applications/
│   │   │       ├── applications.router.ts
│   │   │       └── applications.service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       ← JWT verification
│   │   │   └── error.middleware.ts      ← global error handler
│   │   ├── lib/
│   │   │   ├── response.ts              ← helpers: success(), fail()
│   │   │   └── logger.ts               ← structured logging with pino
│   │   └── app.ts                       ← composition root, no business logic
│   └── package.json
├── docs/
│   ├── A1-architecture.md               ← this document
│   ├── A2-state-data.md
│   ├── A3-navigation.md
│   ├── A4-quality.md
│   └── A5-performance.md
├── package.json                         ← workspace root (npm workspaces)
├── .env.example
└── README.md
```

---

## Decision 1 · Monorepo with npm workspaces

### Context

The exercise has three distinct artifacts with one intentional coupling point: the API types and schemas. The question is how to manage that coupling in a way that is verifiable at compile time.

### Decision

We use **npm workspaces** with three packages: `app`, `backend`, and `packages/shared`. The shared package is referenced as `@occ/shared: "workspace:*"` from the other two.

- A change to a Zod schema in `shared` breaks the build of any consumer that doesn't adapt. The compiler is the contract.
- No manual type synchronization between app and backend.
- The structure is ready to scale to more packages (e.g. `packages/ui`, `packages/analytics`) without changing the base configuration.

---

## Decision 2 · `core/` vs `app/` separation in the frontend

### Context

In React Native projects that grow, the biggest structural problem is coupling between business logic, navigation logic, and UI components. When these three concepts live mixed together, each change has side effects that are hard to trace.

### Decision

The frontend is divided into two zones with an explicit dependency rule:

**`core/`** — the internal library. Navigation-agnostic, application-state-agnostic. Contains reusable components, design tokens, API services, and generic hooks. It could be extracted as an internal npm package without modifications.

**`app/`** — the hierarchy. Everything related to navigation, screens, and composition lives here. `app/` can import from `core/`, but `core/` never imports from `app/`. This rule is enforceable with ESLint (`import/no-restricted-paths`).

The folder structure inside `app/` mirrors screen nesting, following Expo Router and Next.js conventions. A new developer can read the file structure and understand the navigation without opening the code.

- `core/` is testable in isolation, without a navigator or a router.
- The unidirectional dependency rule can be verified automatically (ESLint), not relying on manual discipline.
- Faster onboarding: the structure is predictable.

---

## Decision 3 · Backend as a Modular Monolith

### Context

The exercise asks for a simple Express server with in-memory data. The question is not whether we need microservices today (clearly not), but whether the internal structure of the monolith allows us to extract a service in the future without a major refactor.

### Decision

We adopt the **Modular Monolith** pattern: a single process, but with explicit domain boundaries. Each domain (`auth`, `jobs`, `applications`) is self-contained — its router, service, and schemas live together and do not communicate with other domains via cross-domain internal imports.

If a domain needs to scale independently, the change is to replace the direct import with an HTTP call or a message on a queue — the business logic is not touched.

- Zero microservices operational overhead today.
- Boundaries are visible in the folder structure, requiring no additional documentation.
- Future extraction of a domain is a transport layer change, not a business logic change.

**Alternatives considered:**
- *Microservices from the start*: unjustified operational overhead for the current scope. A small team paying the cost of microservices without the benefit of independent scaling is operational debt.
- *Unstructured monolith*: faster at first, impossible to maintain at scale.

---

## Decision 4 · Clean Architecture layers within each domain

### Context

Within each domain, we need to separate three concerns: the HTTP contract (what endpoints exist and how they are called), the business logic (what rules apply), and the infrastructure (data, external dependencies).

### Decision

Within each domain we apply Clean Architecture layers pragmatically:

| File | Layer | Responsibility |
|---|---|---|
| `*.schema.ts` | Entities | Pure types, Zod schemas. No framework imports. |
| `*.service.ts` | Use Cases | Business logic. No Express imports. |
| `*.router.ts` | Interface Adapter | Translates HTTP ↔ service. No business logic. |
| `*.seed.ts` | Infrastructure | Data and external dependencies. |

- `jobs.service.ts` does not import anything from Express. If the team migrates to Fastify, a Lambda, or a queue worker tomorrow, the service is not modified.
- Services are testable without spinning up an HTTP server.
- The framework (Express) is an implementation detail, not an architectural constraint.

**Alternatives considered:**
- *Full Clean Architecture with abstract interfaces for everything*: over-engineering for this scope. Adds indirection without tangible benefit when there is only one implementor.

---

## Decision 5 · Cloud-readiness from day one

### Context

The server is a Node.js process with in-memory data. We want to be able to deploy it to cloud infrastructure (Cloud Run, ECS, Lambda) without structural changes.

### Decision

We adopt the **12-Factor App** principles that have zero implementation cost:

1. **Config in environment variables** — nothing hardcoded. `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV` come from `.env` (local) or from the deploy environment configuration.

2. **Stateless by design** — the server does not hold state between requests, with one explicitly documented exception: the in-memory JWT blacklist (see Conscious Technical Debt below).

3. **Health check at `GET /health`** — any cloud orchestrator needs this endpoint to know if the process is alive. Implementation cost: < 10 lines.

4. **Structured logging with `pino`** — `console.log` is not parseable in Cloud Logging or CloudWatch. Pino produces structured JSON by default and has the lowest performance overhead among available options.

5. **Graceful shutdown** — the server listens for `SIGTERM` and closes active connections before terminating. Cloud environments (Kubernetes, Cloud Run) kill processes with SIGTERM; without this handler, in-flight requests die.

### Conscious Technical Debt

The in-memory JWT blacklist breaks the stateless property: if there is more than one server instance, a logout on instance A does not invalidate the token on instance B. The production solution is Redis with TTL equal to the JWT expiration, or DynamoDB with TTL. This limitation is documented here rather than in the code, to avoid adding complexity outside the scope of the exercise.

---

## Decision 6 · API Response Contract

### Context

The exercise proposes an `{ ok: boolean, data, error }` envelope. This pattern is common but introduces a problematic redundancy: the HTTP status code already communicates whether the operation was successful at the transport level. If `ok: true` but the status is `500`, which one do you trust?

The important distinction, noted by the Google Cloud API Design Guide, is between **transport errors** and **domain errors**:

- **Transport errors** (`404 Not Found`, `500 Internal Server Error`) → the HTTP status code is the correct mechanism.
- **Domain errors** (`ALREADY_APPLIED`, `ACCOUNT_SUSPENDED`) → the HTTP status code is insufficient or misleading. A `409 Conflict` does not explain *what* conflict or *why* it matters to the application's logic.

### Decision

We adopt an envelope without the `ok` field, aligned with the Google Cloud API Design Guide:

```json
// Successful response — HTTP 2xx
{
  "data": { ... }
}

// Successful paginated response — HTTP 200
{
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 94,
      "hasNext": true,
      "hasPrev": false
    }
  }
}

// Error — HTTP 4xx / 5xx
{
  "error": {
    "code": "ALREADY_APPLIED",
    "message": "You have already applied to this position"
  }
}
```

The `ok` field is removed because its value can always be derived from the HTTP status code. The `code` field in the error provides the domain semantics that the status code cannot express.

### Consequences

**Positive:**
- No redundancy between HTTP status and body. One source of truth per concern.
- The client can branch logic by `error.code` without depending on message strings (which can change).

**Negative:**
- Deviates from the envelope the exercise explicitly proposes. This decision is documented as a reasoned improvement, not a non-compliance.

**Alternatives considered:**
- *RFC 9457 Problem Details*: more complete IETF standard, includes `type` (URI), `title`, `detail`, `instance`. More verbose than necessary for this scope, but worth revisiting when the API becomes public.
- *Keep `{ ok, data, error }`*: acceptable as an internal team convention, but introduces structural redundancy that can produce subtle bugs in clients that prioritize `ok` over the HTTP status.

---

## What this document does not cover

Each of the following topics has its own document:

- **State and data** → A2
- **Navigation and deep linking** → A3
- **Quality, testing, and AI-readiness** → A4
- **Performance and metrics** → A5