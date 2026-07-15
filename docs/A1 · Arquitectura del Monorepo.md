# A1 · Arquitectura del Monorepo

## Contexto

Este documento cubre la estructura del monorepo `occ-lead-ejercicio` y el razonamiento detrás de cada decisión estructural.

---

## Estructura del Monorepo

```
occ-lead-ejercicio/
├── .github/
│   ├── CLAUDE.md                        ← instrucciones para agentes de IA
│   ├── copilot-instructions.md          ← instrucciones para GitHub Copilot
│   └── pull_request_template.md         ← plantilla estructurada de PR
├── packages/
│   └── shared/                          ← esquemas Zod compartidos entre app y backend
│       ├── package.json
│       └── src/
│           ├── schemas/
│           │   ├── job.schema.ts
│           │   ├── auth.schema.ts
│           │   ├── application.schema.ts
│           │   └── index.ts
│           └── index.ts
├── app/                                 ← proyecto Expo (React Native)
│   ├── core/                            ← biblioteca interna reutilizable
│   │   ├── components/                  ← componentes UI independientes de la pantalla
│   │   ├── theme/                       ← tokens de diseño, colores, tipografía
│   │   ├── services/                    ← api.ts y servicios de dominio
│   │   ├── hooks/                       ← hooks genéricos (useDebounce, etc.)
│   │   └── lib/                         ← utilidades puras (formateadores, validadores)
│   ├── app/                             ← Expo Router — rutas basadas en archivos
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx
│   │   ├── (protected)/
│   │   │   ├── _layout.tsx              ← guardia de auth + hidratación de sesión + handler de Notifee + BottomSheetModal
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx          ← barra de tabs inferior: Búsqueda | Actividades
│   │   │       ├── index.tsx            ← Búsqueda de Empleos (FlashList, filtros)
│   │   │       └── activities/
│   │   │           ├── _layout.tsx      ← selector de tabs superior: Postuladas | Favoritos
│   │   │           ├── applied.tsx      ← Empleos postulados (por defecto)
│   │   │           └── favorites.tsx    ← Favoritos
│   │   └── _layout.tsx                  ← layout raíz, providers, fuentes
│   ├── store/                           ← stores de Zustand (auth, estado UI)
│   └── package.json
├── backend/                             ← servidor Node.js + Express
│   ├── src/
│   │   ├── domains/                     ← módulos de dominio autocontenidos
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
│   │   │   ├── auth.middleware.ts       ← verificación de JWT
│   │   │   └── error.middleware.ts      ← manejador global de errores
│   │   ├── lib/
│   │   │   ├── response.ts              ← helpers: success(), fail()
│   │   │   └── logger.ts               ← logging estructurado con pino
│   │   └── app.ts                       ← raíz de composición, sin lógica de negocio
│   └── package.json
├── docs/
│   ├── A1 · Monorepo Architecture.md
│   ├── A2 · State & Data Strategy.md
│   ├── A3 · Navigation & Deep Linking.md
│   ├── A4 · Quality Strategy.md
│   └── A5 · Performance.md
├── package.json                         ← raíz del workspace (pnpm workspaces)
├── .env.example
└── README.md
```

---

## Decisión 1 · Monorepo con pnpm workspaces

### Contexto

El ejercicio tiene tres artefactos distintos con un único punto de acoplamiento intencional: los tipos y esquemas de la API. La pregunta es cómo gestionar ese acoplamiento de forma verificable en tiempo de compilación.

### Decisión

Usamos **pnpm workspaces** (declarados en `pnpm-workspace.yaml`) con tres paquetes: `app`, `backend` y `packages/shared`. El paquete compartido se referencia como `@occ/shared: "workspace:*"` desde los otros dos — un protocolo que npm no soporta, y por eso `npm install` falla en este repo por diseño.

- Un cambio en un esquema Zod en `shared` rompe el build de cualquier consumidor que no se adapte. El compilador es el contrato.
- Sin sincronización manual de tipos entre app y backend.
- La estructura está lista para escalar a más paquetes (p.ej. `packages/ui`, `packages/analytics`) sin modificar la configuración base.

---

## Decisión 2 · Separación `core/` vs `app/` en el frontend

### Contexto

En proyectos React Native que crecen, el mayor problema estructural es el acoplamiento entre lógica de negocio, lógica de navegación y componentes UI. Cuando estos tres conceptos viven mezclados, cada cambio tiene efectos secundarios difíciles de rastrear.

### Decisión

El frontend se divide en dos zonas con una regla de dependencia explícita:

**`core/`** — la biblioteca interna. Independiente de la navegación y del estado de la aplicación. Contiene componentes reutilizables, tokens de diseño, servicios de API y hooks genéricos. Podría extraerse como un paquete npm interno sin modificaciones.

**`app/`** — la jerarquía. Todo lo relacionado con navegación, pantallas y composición vive aquí. `app/` puede importar desde `core/`, pero `core/` nunca importa desde `app/`. Esta regla es aplicable con ESLint (`import/no-restricted-paths`).

- `core/` es testeable de forma aislada, sin un navigator ni un router.
- La regla de dependencia unidireccional puede verificarse automáticamente (ESLint), sin depender de la disciplina manual.
- Onboarding más rápido: la estructura es predecible.

---

## Decisión 3 · Backend como Monolito Modular

### Contexto

El ejercicio pide un servidor Express simple con datos en memoria. La pregunta no es si necesitamos microservicios hoy (claramente no), sino si la estructura interna del monolito nos permite extraer un servicio en el futuro sin una refactorización mayor.

### Decisión

Adoptamos el patrón de **Monolito Modular**: un único proceso, pero con límites de dominio explícitos. Cada dominio (`auth`, `jobs`, `applications`) es autocontenido — su router, servicio y esquemas viven juntos y no se comunican con otros dominios mediante importaciones cruzadas internas.

Si un dominio necesita escalar de forma independiente, el cambio es reemplazar la importación directa con una llamada HTTP o un mensaje en una cola — la lógica de negocio no se toca.

- Cero sobrecarga operativa de microservicios hoy.
- Los límites son visibles en la estructura de carpetas, sin necesidad de documentación adicional.
- La extracción futura de un dominio es un cambio de capa de transporte, no un cambio de lógica de negocio.

**Alternativas consideradas:**

- _Microservicios desde el inicio_: sobrecarga operativa injustificada para el alcance actual.
- _Monolito sin estructura_: más rápido al inicio, imposible de mantener a escala.

---

## Decisión 4 · Capas de Clean Architecture dentro de cada dominio

### Contexto

Dentro de cada dominio, necesitamos separar tres responsabilidades: el contrato HTTP, la lógica de negocio y la infraestructura.

### Decisión

Dentro de cada dominio aplicamos capas de Clean Architecture de forma pragmática:

| Archivo        | Capa                  | Responsabilidad                                             |
| -------------- | --------------------- | ----------------------------------------------------------- |
| `*.schema.ts`  | Entidades             | Tipos puros, esquemas Zod. Sin importaciones de frameworks. |
| `*.service.ts` | Casos de Uso          | Lógica de negocio. Sin importaciones de Express.            |
| `*.router.ts`  | Adaptador de Interfaz | Traduce HTTP ↔ servicio. Sin lógica de negocio.             |
| `*.seed.ts`    | Infraestructura       | Datos y dependencias externas.                              |

- `jobs.service.ts` no importa nada de Express. Si el equipo migra a Fastify, una Lambda o un worker de cola, el servicio no se modifica.
- Los servicios son testeables sin levantar un servidor HTTP.
- El framework (Express) es un detalle de implementación, no una restricción arquitectónica.

---

## Decisión 5 · Cloud-readiness desde el día uno

### Contexto

El servidor es un proceso Node.js con datos en memoria. Queremos poder desplegarlo en infraestructura cloud (Cloud Run, ECS, Lambda) sin cambios estructurales.

### Decisión

Adoptamos los principios de **12-Factor App** que tienen costo de implementación cero:

1. **Configuración en variables de entorno** — nada hardcodeado. `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV` vienen de `.env` (local) o de la configuración del entorno de despliegue.

2. **Sin estado por diseño** — el servidor no mantiene estado entre requests, con una excepción explícitamente documentada: la lista negra de JWT en memoria (ver Deuda Técnica Consciente más abajo).

3. **Health check en `GET /health`** — cualquier orquestador cloud necesita este endpoint para saber si el proceso está vivo.

4. **Logging estructurado con `pino`** — `console.log` no es parseable en Cloud Logging o CloudWatch. Pino produce JSON estructurado por defecto y tiene el menor overhead de rendimiento entre las opciones disponibles.

5. **Graceful shutdown** — el servidor escucha `SIGTERM` y cierra las conexiones activas antes de terminar. Los entornos cloud (Kubernetes, Cloud Run) matan procesos con SIGTERM; sin este handler, los requests en vuelo mueren.

### Deuda Técnica Consciente

La lista negra de JWT en memoria rompe la propiedad sin estado: si hay más de una instancia del servidor, un logout en la instancia A no invalida el token en la instancia B. La solución en producción es Redis con TTL igual a la expiración del JWT, o DynamoDB con TTL. Esta limitación está documentada aquí en lugar de en el código.

---

## Decisión 6 · Contrato de Respuesta de la API

### Contexto

El ejercicio propone un envelope `{ ok: boolean, data, error }`. Este patrón introduce una redundancia problemática: el código de estado HTTP ya comunica si la operación fue exitosa.

La distinción importante, señalada por la Google Cloud API Design Guide, es entre **errores de transporte** y **errores de dominio**:

- **Errores de transporte** (`404 Not Found`, `500 Internal Server Error`) → el código de estado HTTP es el mecanismo correcto.
- **Errores de dominio** (`ALREADY_APPLIED`, `ACCOUNT_SUSPENDED`) → el código de estado HTTP es insuficiente o engañoso.

### Decisión

Adoptamos un envelope sin el campo `ok`, alineado con la Google Cloud API Design Guide:

```json
// Respuesta exitosa — HTTP 2xx
{
  "data": { ... }
}

// Respuesta paginada exitosa — HTTP 200
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
    "message": "Ya te has postulado a esta posición"
  }
}
```

El campo `ok` se elimina porque su valor siempre puede derivarse del código de estado HTTP. El campo `code` en el error provee la semántica de dominio que el código de estado no puede expresar.

---

## Lo que este documento no cubre

Cada uno de los siguientes temas tiene su propio documento:

- **Estado y datos** → A2
- **Navegación y deep linking** → A3
- **Calidad, testing y preparación para IA** → A4
- **Rendimiento y métricas** → A5
