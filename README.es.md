# occ-lead-ejercicio

Ejercicio técnico para la posición de Developer Lead Sr. — React Native en OCC · Redarbor México.

_[Read this in English](README.md)_

## Qué es este repositorio y cómo fue construido

El brief (`docs/ejercicio_tecnico_lead_rn_occ.pdf`) pide una app de búsqueda de empleo: login, búsqueda/filtros/orden, detalle de vacante con swipe, postular/favoritos, una pantalla de actividades y notificaciones push locales. Construir esas pantallas nunca fue la parte difícil de este ejercicio. Lo que realmente se evalúa en un Lead son las decisiones _alrededor_ del código: cómo está organizado el codebase, qué convenciones seguiría un equipo de ingenieros, y cómo esas convenciones sobreviven al contacto con nuevas features y nuevos colaboradores — incluyendo colaboradores de IA, ya que así se escribió gran parte de este repositorio.

Así que la prioridad aquí se invirtió: en lugar de "entregar las pantallas", primero se hizo legible la arquitectura y el proceso, y luego se construyeron las pantallas sobre esa base. Concretamente:

1. **Arquitectura antes que código.** `docs/A1`–`A5` (estructura del monorepo, estrategia de estado/datos, navegación, estándar de calidad, rendimiento) se escribieron _antes_ de cualquier código de feature, no se documentaron después. `CLAUDE.md` y `.github/copilot-instructions.md` le indican a cualquier herramienta de IA que los lea antes de tocar la estructura, así que los documentos son vinculantes, no decorativos.
2. **Un proceso repetible para el resto del build**, descrito abajo como AIDLC, de modo que cada feature — implementada por mí o por un agente — pasa por el mismo pipeline spec → research → plan → implement → verify, dejando un rastro auditable por feature bajo `docs/work/`.
3. **Un sistema de diseño**, descrito abajo, para que la UI no tenga estilos ad-hoc por pantalla sino que se alimente de una sola fuente de tokens.

Este proyecto fue construido en cooperación con Claude Code, pero cada decisión arquitectónica y de proceso la tomé yo, un humano. El contenido de `docs/A1`–`A6` se definió a través de discusión con Claude — yo tomé las decisiones, Claude ayudó a identificar los tradeoffs y a redactarlos — y la mayor parte de la implementación de features, siguiendo esa arquitectura ya acordada, la hicieron agentes de IA bajo el proceso descrito en `docs/A6`, revisando yo cada cambio.

### El sistema de diseño

`app/core/theme/` es la única fuente de verdad visual. `tokens.ts` contiene los valores crudos — una paleta de colores literal, escala de espaciado, tipografía, radios, sombras, duraciones de movimiento — para los esquemas claro y oscuro. `theme.ts` compone esos tokens crudos en una interfaz `Theme` que los componentes consumen vía `useTheme()`. Los componentes nunca hardcodean un color, un valor de espaciado o un tamaño de fuente; leen `theme.colors.fg`, `theme.spacing[3]`, `theme.type.headingSm`, etc. Esto está impuesto, no es solo convención — `.eslintrc.js` bloquea literales de estilo inline, y `import/no-restricted-paths` impide que un componente acceda directamente a `tokens.ts` saltándose la capa semántica.

El beneficio práctico: pasar de modo claro a oscuro, o rediseñar toda la app, es un cambio en un solo archivo (`tokens.ts`), no un buscar-y-reemplazar en cada pantalla. `app/core/components/` (`Button`, `Card`, `Input`, `Select`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, …) es la librería de componentes resultante, cada uno guiado por el theme y reutilizable entre pantallas.

### AIDLC — el proceso detrás del código

AIDLC (AI-Assisted Development Lifecycle) es el framework bajo el cual se construyeron realmente las features de este repositorio — documentado en su totalidad en [`docs/A6 · Ciclo de Vida de Desarrollo Asistido por IA.md`](<docs/A6 · Ciclo de Vida de Desarrollo Asistido por IA.md>). La versión corta:

- **El problema que resuelve:** un solo agente de IA al que se le da una feature completa y se le dice "adelante" tiende a perder de vista el alcance, redecidir arquitectura ya definida, o producir código que "se ve bien" sin que nadie lo compare contra un requisito. Ese es el modo de fallo del "vibe-coding" — rápido, pero inauditable.
- **La solución:** dividir el trabajo en fases, cada una ejecutada por un agente nuevo que solo lee sus propios inputs y produce exactamente un documento de entrega, y luego termina:

  ```
  0. SPEC      → ledger de requisitos (R1, R2, …), aprobado por un humano
  1. RESEARCH  → mapa de archivos + restricciones, cada afirmación citada a path:line
  2. PLAN      → lista de cambios, cada ítem citando un R-id       ◀ gate humano clave
  3. IMPLEMENT → código + un reporte que traza cada cambio a un R-id
  4. VERIFY    → matriz de cobertura (cada requisito cumplido, nada de más) + tsc/eslint/jest
  ```

- **La trazabilidad es mecánica, no aspiracional.** Cada requisito debe mapear a un cambio, y cada cambio debe mapear a un requisito — un requisito sin cambio es un hueco, un cambio sin requisito es scope creep, y ambos fallan la fase de verificación. Cada uno de los 15 tickets de feature en `docs/work/ROADMAP.md` tiene su propio `docs/work/<feature>/00-spec.md` hasta `04-verify.md`, formando un rastro comprometido y auditable de qué se construyó, por qué, y cómo se verificó.
- **El gate de verificación es innegociable.** Ningún ticket se marca como terminado sin que `tsc --noEmit`, `eslint` y `jest` pasen en cada workspace que tocó. Esto detectó bugs reales durante la construcción (ver A6, Decisión 3, para la lista real) — incluyendo bugs que ya existían antes de cualquier cambio hecho por IA.
- **Un hueco conocido, documentado con honestidad:** ese gate es `tsc`+`eslint`+`jest`, ninguno de los cuales realmente lanza la app. Un par de bugs a nivel de configuración (una entrada de plugin de Expo rota, una dependencia de logging de desarrollo faltante) solo salieron a la luz al correr la app de verdad, después de que los 15 tickets ya habían pasado su verificación de forma independiente. Eso está documentado en [`docs/work/push-notifications/05-post-verify-fix.md`](docs/work/push-notifications/05-post-verify-fix.md) como una corrección al registro, no se escondió bajo la alfombra.

`.claude/agents/` contiene un subagente por fase (researcher, planner, implementer, verifier); `.claude/commands/` contiene el orquestador (`/aidlc-run`) y comandos por fase para toma de control manual. El pipeline corre bajo una "política de gate" configurable — full-control (un humano aprueba cada fase), balanced (checkpoint solo en PLAN), o full-auto — pero dos paradas duras aplican sin importar el modo: la ambigüedad siempre escala a un humano en vez de adivinarse, y una verificación fallida siempre regresa al ciclo en vez de marcarse como terminada.

## Configuración

### Prerrequisitos

- Node.js 20+
- [pnpm](https://pnpm.io) 9+ — este repositorio usa **pnpm workspaces** (protocolo `workspace:*`). `npm install` fallará con `EUNSUPPORTEDPROTOCOL`; usa pnpm.
- Expo CLI no es una instalación global separada — se invoca vía `pnpm exec expo` desde `app/`.

### Instalación

```bash
# Desde la raíz del repo — instala los cuatro workspaces (app, backend, packages/shared, tooling raíz)
pnpm install
```

### Variables de entorno

El `.env.example` de la raíz documenta las variables tanto del backend como de la app, pero es solo de referencia — ninguno de los dos procesos carga realmente un `.env` a nivel raíz. Cada workspace necesita su propio archivo:

```bash
# Backend — lee backend/.env
cat > backend/.env <<'EOF'
PORT=3000
NODE_ENV=development
JWT_SECRET=local-dev-secret-change-me
JWT_EXPIRES_IN=1h
LOG_LEVEL=info
EOF

# App — lee app/.env (solo las variables con prefijo EXPO_PUBLIC_ se exponen al cliente)
cat > app/.env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EOF
```

Ambos archivos están en `.gitignore`; los valores de arriba son valores seguros para desarrollo local, no secretos reales.

### Correr el backend

```bash
cd backend
pnpm dev
# Servidor corriendo en http://localhost:3000
```

### Correr la app

```bash
cd app
pnpm exec expo start -c
```

El backend debe estar corriendo primero — la app resuelve la API a través de `EXPO_PUBLIC_API_BASE_URL`, que apunta a `http://localhost:3000` arriba. `-c` limpia el caché de Metro; puedes omitirlo para un arranque más rápido una vez que todo esté estable.

**Debe correrse desde `app/`, no desde la raíz del repo.** `expo` es solo una dependencia del workspace `app`. Correr `pnpm exec expo start` desde la raíz del repo falla con `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL — Command "expo" not found`, porque pnpm trata un `exec` a nivel raíz como recursivo sobre todos los workspaces y falla en el primero que no tenga `expo` instalado. Si no quieres hacer `cd`, corre `pnpm --filter ./app exec expo start -c` desde la raíz.

### Correr los tests

```bash
# Desde la raíz — corre los workspaces app y backend
pnpm test
```

### Type check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

---

## Arquitectura

Ver `docs/` para la documentación completa de arquitectura:

- [A1 · Arquitectura del Monorepo](<docs/A1 · Arquitectura del Monorepo.md>)
- [A2 · Estrategia de Estado y Datos](<docs/A2 · Estrategia de Estado y Datos.md>)
- [A3 · Navegación y Deep Linking](<docs/A3 · Navegación y Deep Linking.md>)
- [A4 · Estrategia de Calidad](<docs/A4 · Estrategia de Calidad.md>)
- [A5 · Rendimiento](<docs/A5 · Rendimiento.md>)
- [A6 · Ciclo de Vida de Desarrollo Asistido por IA](<docs/A6 · Ciclo de Vida de Desarrollo Asistido por IA.md>)

Las versiones en inglés de cada uno están disponibles junto a los originales (p. ej. `docs/A1 · Monorepo Architecture.md`).

## Decisiones clave

- **Monorepo**: pnpm workspaces con tres paquetes — `app`, `backend`, `packages/shared`
- **Tipos compartidos**: schemas de Zod en `packages/shared`, consumidos tanto por app como por backend
- **Contrato de API**: `{ data }` en éxito, `{ error: { code, message } }` en error — sin campo `ok`, alineado con la Google Cloud API Design Guide
- **Estado**: Zustand para todo el estado, un store por dominio
- **Backend**: Monolito Modular con capas de Clean Architecture por dominio
- **Frontend**: `core/` (librería reutilizable) + `app/` (jerarquía de Expo Router)

## Envelope de respuesta de la API (sin campo `ok`)

El brief del ejercicio propone un envelope `{ ok, data, error }`. Deliberadamente
eliminamos el campo `ok` y usamos `{ data }` en éxito y `{ error: { code, message } }`
en error. Esta es una decisión razonada, no un descuido.

El flag `ok` es redundante con el código de estado HTTP, que ya comunica
éxito o fracaso a nivel de transporte. Mantener ambos invita a contradicciones —
si llega `ok: true` con un status `500`, ¿en cuál confía el cliente? Siguiendo
la Google Cloud API Design Guide, separamos las dos preocupaciones:

- **Errores de transporte** (`404 Not Found`, `500 Internal Server Error`) → el código
  de estado HTTP es el mecanismo correcto.
- **Errores de dominio** (`ALREADY_APPLIED`, `VALIDATION_ERROR`) → el código de estado
  por sí solo no es suficiente, así que el campo `error.code` lleva la semántica
  de dominio. Los clientes bifurcan sobre `error.code`, nunca sobre strings de
  mensaje (que pueden cambiar).

Quitar `ok` deja una única fuente de verdad por preocupación y evita bugs sutiles
del lado del cliente. El razonamiento completo y las alternativas consideradas
(RFC 9457 Problem Details, mantener `ok`) están documentadas en
`docs/A1 · Arquitectura del Monorepo.md`, Decisión 6.

## Credenciales (mock)

```
email: test@occ.com.mx
password: Test1234
```
