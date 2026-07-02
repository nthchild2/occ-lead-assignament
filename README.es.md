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

## Arquitectura — las decisiones, documento por documento

Cinco documentos (`docs/A1`–`A5`) contienen el razonamiento real — contexto, decisión, alternativas consideradas, código — detrás de todo lo que sigue. Esta sección es el hilo conductor que los conecta; trátala como un mapa del _por qué_, no como un sustituto de leer los documentos cuando necesites el detalle.

### [A1 · Arquitectura del Monorepo](<docs/A1 · Arquitectura del Monorepo.md>)

Tres workspaces de pnpm — `app`, `backend`, `packages/shared` — con los schemas de Zod de `@occ/shared` como el único punto de acoplamiento intencional: un cambio de schema rompe el build de cualquier consumidor que no se adapte, así que el compilador es el contrato, no un changelog. Dentro del frontend, `core/` (agnóstico de navegación, reutilizable) y `app/` (la jerarquía de Expo Router) tienen una regla de dependencia unidireccional impuesta por ESLint (`import/no-restricted-paths`), no solo por convención. El backend es un **Monolito Modular**: cada dominio (`auth`, `jobs`, `applications`) es autocontenido, y dentro de cada dominio, capas de Clean Architecture separan el contrato HTTP (`*.router.ts`) de la lógica de negocio (`*.service.ts`, que nunca importa Express) de los tipos (`*.schema.ts`) — así que migrar de framework o extraer un dominio a su propio servicio más adelante es un cambio de capa de transporte, no una reescritura. El servidor también adopta las partes de costo cero de 12-Factor (config por variables de entorno, un endpoint `/health`, logging estructurado con `pino`, apagado grácil por `SIGTERM`) con una excepción documentada: la lista negra de JWT en memoria no es stateless-safe entre múltiples instancias — señalada como deuda técnica consciente, no oculta. Finalmente, en A1 vive la decisión del envelope de API sin `ok` (ver [más abajo](#envelope-de-respuesta-de-la-api-sin-campo-ok)).

### [A2 · Estrategia de Estado y Datos](<docs/A2 · Estrategia de Estado y Datos.md>)

Un store de Zustand por dominio (`auth`, `jobs`, `applications`, `favorites`); solo `auth.store` persiste, vía AsyncStorage — todo lo demás se reinicia en cada arranque. La validez de la sesión no se asume a partir de un token guardado: al iniciar la app, `GET /auth/me` la confirma antes de renderizar cualquier pantalla protegida, y un interceptor de 401 en `core/services/api.ts` maneja la expiración a mitad de sesión de la misma forma, sin que cada hook necesite su propia rama de manejo de fallo de auth. El estado de paginación y los filtros con debounce viven ambos en `jobs.store`; cualquier cambio de filtro u orden reinicia la lista y vuelve a pedir la página 1. La única pieza genuinamente delicada es el **prefetch del swipe**: llegar a 3 vacantes del final de la página cargada dispara silenciosamente el siguiente fetch en segundo plano — sin estado de carga, sin interrupción — y un fetch fallido degrada a un indicador discreto de fin-de-resultados en vez de una pantalla de error.

### [A3 · Navegación y Deep Linking](<docs/A3 · Navegación y Deep Linking.md>)

El árbol de rutas es una separación directa de Expo Router en `(auth)`/`(protected)`, cada una con su propio layout de guardia-por-redirección. La única decisión deliberadamente poco convencional: el `BottomSheetModal` del Detalle de Vacante **no** es una ruta. Es propiedad de `(protected)/_layout.tsx` y se abre de forma imperativa — cualquier parte de la app (un tap en una tarjeta, un tap en una notificación, un deep link) simplemente pone `activeJobId` en `jobs.store`, y el layout reacciona a ese valor. Esto evita que abrir/cerrar la hoja toque jamás el stack de rutas o el tab activo, lo cual importa para dos requisitos concretos: cerrar la hoja no debe reiniciar la posición de scroll de la lista, y un tap en una notificación debe abrir la hoja sobre _cualquier_ tab que esté activo en ese momento, sin forzar un cambio de tab. La otra sutileza real es la **carrera del estado quit**: si la app arranca en frío desde un estado cerrado vía un tap en una notificación, el id de la vacante objetivo se retiene en una ref a nivel de módulo hasta que la hidratación de sesión (`GET /auth/me`) realmente se resuelve — de lo contrario la hoja podría abrirse, y una acción de Postular/Favorito dentro de ella podría dispararse, antes de que la sesión esté confirmada como válida.

### [A4 · Estrategia de Calidad](<docs/A4 · Estrategia de Calidad.md>)

El testing está estratificado a propósito — schemas, servicios, stores, hooks, componentes y pantallas reciben cada uno una herramienta distinta para un modo de fallo distinto (Jest para lógica, `msw` para el límite de red, React Native Testing Library para queries de interacción/a11y, `supertest` para los routers del backend). Los snapshots deliberadamente no son automáticos: se agregan solo cuando una pantalla se considera _terminada_, se revisan como parte del diff de ese PR, y un `--updateSnapshot` a ciegas sin revisar qué cambió es una violación del checklist. El branching sigue Gitflow (`main`/`develop`/`feature`/`release`/`hotfix`) mapeado sobre tres perfiles de build de EAS (`development`/`preview`/`production`), con los merges a `main` bloqueados detrás de la aprobación tanto de QA como del lead vía CODEOWNERS — el build de producción y el envío a las tiendas siempre son manuales, nunca automáticos al hacer merge. Husky impone lo barato de forma local (lint, formato, typecheck en cada commit; la suite de tests completa en cada push) para que CI nunca sea el primer lugar donde aparece un error. La accesibilidad no es un ítem de checklist pegado al final — WCAG 2.1 AA se impone estructuralmente, ya que cada color de la app viene de tokens de theme elegidos por contraste, `eslint-plugin-react-native-a11y` detecta labels/roles faltantes al hacer commit, y las queries de RNTL basadas en role/label hacen que un componente inaccesible falle su propio test antes de fallar una auditoría.

### [A5 · Rendimiento](<docs/A5 · Rendimiento.md>)

Sentry se encarga del monitoreo de crashes/errores; Firebase Performance se encarga de las métricas de runtime que importan en producción pero son invisibles en desarrollo — tiempo de arranque en frío, tiempo-hasta-la-primera-tarjeta-de-vacante, P50/P90/P99 de la API. La lista de vacantes (la pantalla de mayor tráfico) recibe seis ajustes concretos de FlashList: un `estimatedItemSize` medido en vez de dejar que FlashList mida cada ítem, tarjetas memoizadas con clave en el `id` inmutable de la vacante, `getItemType` para que las tarjetas de altura variable (con/sin salario) no causen saltos de layout al reciclarse, y un `drawDistance` reducido para bajar el costo del render inicial. El prefetch del swipe de A2 obtiene aquí su garantía de rendimiento: `InteractionManager.runAfterInteractions` posterga el fetch hasta que la animación de swipe en el hilo de UI (impulsada por Reanimated, que nunca toca el hilo de JS) realmente se asienta, así que una llamada de red en segundo plano nunca puede competir por tiempo del hilo de JS con el manejo de gestos a 60fps. La infraestructura de analytics (Firebase Analytics) está provista pero explícitamente condicionada al consentimiento — la recolección está apagada por defecto y solo se habilita después del opt-in, ya que agregar consentimiento después a un SDK que ya está recolectando es costoso y esto está pensado para ser correcto desde el día uno, no parchado después.

Las traducciones al inglés de A1–A6 están disponibles junto a los originales (p. ej. `docs/A1 · Monorepo Architecture.md`).

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

## Decisiones clave, de un vistazo

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
