# A4 · Estrategia de Calidad

## Contexto

Este documento cubre qué testeamos en cada capa, la estrategia de branching y releases, los requisitos de PR, la propiedad del código y las convenciones que el equipo sigue día a día.

---

## Decisión 1 · Estrategia de testing

El ejercicio requiere como mínimo un test unitario por módulo core: el store de sesión, el hook de búsqueda y el servicio de API. Los tratamos como el piso, no el techo.

### Qué testeamos y dónde

| Capa                          | Qué                                                                                                                                | Herramientas                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Esquemas de `packages/shared` | Los esquemas Zod parsean correctamente formas válidas e inválidas                                                                  | Jest                                          |
| `core/services/api.ts`        | Construcción de requests, inyección de JWT, intercepción de 401                                                                    | Jest (`global.fetch` mockeado)                |
| `core/services/*.service.ts`  | Las funciones de servicio llaman a los endpoints correctos con los parámetros correctos                                            | Jest (`global.fetch` mockeado)                |
| `store/*.store.ts`            | Las acciones del store producen las transiciones de estado correctas                                                               | Jest                                          |
| `core/hooks/`                 | Los hooks retornan el estado correcto dado un store y configuración de servicio                                                    | Jest, React Native Testing Library            |
| `core/components/`            | Renderiza correctamente contra tokens de tema, regresión por snapshot, props de a11y                                               | Jest, React Native Testing Library, snapshots |
| Componentes de pantalla       | Las interacciones del usuario disparan las acciones de store y llamadas de servicio correctas, regresión por snapshot al completar | React Native Testing Library, snapshots       |
| `*.service.ts` del backend    | Lógica de negocio, casos borde, códigos de error                                                                                   | Jest                                          |
| `*.router.ts` del backend     | Contratos de endpoints, middleware de auth, forma de la respuesta                                                                  | Jest, `supertest`                             |

### Tests de snapshot

Los tests de snapshot se usan para detección de regresiones — capturar cambios de UI no intencionales después de que una pantalla o componente se considera terminado. Las aserciones de comportamiento viven en el test propio de cada unidad; los snapshots solo fijan el output renderizado de lo que se declaró completo.

**Biblioteca de componentes (`core/components/`):** Cada componente tiene un snapshot — `app/core/components/snapshots.test.tsx` fija todos los componentes exportados, incluyendo sus variantes significativas (`Avatar` con imagen vs. iniciales, `Button` disabled/loading, `Card` presionable, `Input` en estado de error, `JobCard` sin salario, …).

**Pantallas de funcionalidades:** Cada pantalla completada fija su snapshot en su propio archivo de test co-locado (`login`, `index` de búsqueda, `applied`, `favorites` y el contenido del sheet `JobDetail`) — agregado una vez que el ticket de la pantalla pasó verificación, según la regla de que los snapshots cubren pantallas que se entregan como completas, no pantallas en desarrollo activo. Los PRs futuros que modifiquen intencionalmente una pantalla deben incluir el snapshot actualizado, revisado como parte del diff del PR — un `jest --updateSnapshot` a ciegas sin revisar qué cambió es una violación del checklist.

El checklist del PR incluye: _"Snapshots revisados, no actualizados a ciegas."_

### Qué no testeamos

- Detalles de implementación — testeamos qué hace un módulo, no cómo lo hace internamente
- Bibliotecas de terceros — confiamos en que `@gorhom/bottom-sheet`, `@notifee/react-native`, etc. funcionan

### Herramientas

**Frontend:**

- `jest` + `@testing-library/react-native` — tests de componentes y hooks
- `global.fetch` mockeado / módulos de servicio mockeados en el límite de red. `msw` se evaluó y se descartó deliberadamente para tests unitarios: las dependencias ESM-only de msw v2 fallan al transformarse bajo `jest-expo` + el `node_modules` anidado de pnpm, y mockear `fetch` es más ligero e idiomático para alcance unitario de todos modos (ver `docs/MAP.md`). Queda como opción para futuros tests de integración genuinos.
- `@testing-library/jest-native` — matchers adicionales para React Native

**Backend:**

- `jest` — tests unitarios para servicios
- `supertest` — tests de integración para routers, levanta la app Express sin un servidor real

### Ejemplo — store de sesión

```ts
// store/auth.store.test.ts
describe('auth.store', () => {
  it('almacena token y usuario en login', () => {
    const { login, token, user } = useAuthStore.getState()
    login('jwt-token', { id: '1', email: 'test@occ.com.mx' })
    expect(useAuthStore.getState().token).toBe('jwt-token')
    expect(useAuthStore.getState().user?.email).toBe('test@occ.com.mx')
  })

  it('limpia token y usuario en logout', () => {
    useAuthStore.getState().login('jwt-token', { id: '1', email: 'test@occ.com.mx' })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

### Ejemplo — interceptor del servicio de API

El cliente es un wrapper delgado sobre `fetch`, así que sus tests mockean `global.fetch` directamente (este es el patrón real de `app/core/services/api.test.ts`):

```ts
// core/services/api.test.ts (extracto)
it('inyecta el JWT como Authorization: Bearer <token> en requests autenticados', async () => {
  configureApi({ getToken: () => 'tok' })
  mockResponseOnce(200, { data: { id: '1', email: 'a@b.co' } })

  await get('/me', MeResponseSchema)

  const headers = lastRequestInit().headers as Record<string, string>
  expect(headers.Authorization).toBe('Bearer tok')
})

it('invoca onUnauthorized (limpieza de sesión) ante un 401', async () => {
  const onUnauthorized = jest.fn()
  configureApi({ onUnauthorized })
  mockResponseOnce(401, { error: { code: 'TOKEN_EXPIRED', message: 'El token ha expirado' } })

  await expect(get('/me', MeResponseSchema)).rejects.toBeInstanceOf(ApiError)
  expect(onUnauthorized).toHaveBeenCalled()
})
```

---

## Decisión 2 · Estrategia de branching (Gitflow)

Seguimos Gitflow. El fundamento: a medida que el equipo crece, necesitamos controlar qué va a producción de forma independiente a lo que se está desarrollando. La rama de release provee una ventana de estabilización antes del lanzamiento, y las ramas hotfix permiten parchear producción sin incluir trabajo inacabado de develop.

### Tipos de rama

| Rama        | Propósito                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`      | Producción. Solo recibe merges de `release/*` y `hotfix/*`. Cada merge tiene un tag.                                                                         |
| `develop`   | Rama de integración. Todo el trabajo de feature, chore y hotfix se mergea aquí primero.                                                                      |
| `feature/*` | Nuevas funcionalidades. Ramifica desde `develop`, mergea de vuelta a `develop`.                                                                              |
| `chore/*`   | Mantenimiento, dependencias, config, refactors. Mismo flujo que `feature/*`.                                                                                 |
| `hotfix/*`  | Parches de producción. Ramifica desde `main`, mergea tanto a `main` como a `develop`.                                                                        |
| `release/*` | Estabilización. Ramifica desde `develop` cuando está listo para lanzar, mergea a `main`. Solo se permiten correcciones de bugs — sin nuevas funcionalidades. |

### Flujo de desarrollo completo

**Desarrollo día a día**

Los desarrolladores ramifican desde `develop` para cada trabajo — features, chores, refactors. Al terminar, abren un PR de vuelta a `develop`. Cada merge a `develop` dispara un build EAS de preview que va al equipo de QA para testing del sprint.

`develop` siempre está en movimiento. Mientras QA testea un lote de cambios, los desarrolladores ya están trabajando en el siguiente.

```
develop
  └──→ feature/job-search-filters
            │  (PR revisado + aprobado)
            └──→ develop ──→ [EAS preview → QA]
```

**Fin de sprint — creando un release**

Cuando el sprint termina y `develop` está en estado lanzable, se crea una rama `release/*` desde `develop`. Esta es una instantánea de `develop` en ese momento — congela el alcance del release.

Desde este punto, `develop` avanza. Los desarrolladores comienzan el siguiente sprint en `develop` sin esperar que el release se lance. La rama de release está aislada — solo se permiten correcciones de bugs encontrados durante el smoke testing. Sin nuevas funcionalidades.

```
develop ──→ release/1.2.0  (instantánea de develop al final del sprint)
│                │
│          (QA smoke tests, solo correcciones de bugs)
│                │
continúa         └──→ main (tagged v1.2.0) ──→ producción
siguiente sprint │
                 └──→ develop (backport de correcciones en rama release)
```

El backport a `develop` asegura que los bugs corregidos en `release/1.2.0` no reaparezcan en releases futuros.

**Hotfixes**

Los hotfixes son diferentes — ramifican desde `main`, no desde `develop`. La razón: un hotfix necesita parchear lo que está actualmente en producción, no lo que se está desarrollando.

```
main (v1.2.0 en producción)
  └──→ hotfix/fix-auth-crash
            │  (corrección aplicada, smoke test)
            ├──→ main (tagged v1.2.1) ──→ producción
            └──→ develop (backport)
```

---

## Decisión 3 · Perfiles de build EAS, distribución y flujo de release

> **Estado: política de equipo propuesta.** La protección de ramas y la aplicación de CODEOWNERS son configuraciones del repo hosteado en GitHub, y los perfiles de EAS requieren un proyecto de EAS — ninguna está activada en este repo de ejercicio de un solo autor. El workflow de CI (Decisión 4) sí está activo hoy; la capa de aprobaciones es lo que el equipo enciende el día que se suma un segundo contribuidor.

Usamos Expo Application Services (EAS) con tres perfiles de build mapeados a la estrategia de branching.

### Perfiles de build

| Perfil        | Disparador                                                                   | Audiencia        |
| ------------- | ---------------------------------------------------------------------------- | ---------------- |
| `development` | Manual, local                                                                | Desarrolladores  |
| `preview`     | Automático al mergear a `develop` y al crear `release/*`                     | Equipo de QA     |
| `production`  | `eas build` manual + `eas submit` después de que `release/*` mergea a `main` | Usuarios finales |

### Distribución

**iOS:** Los builds de preview se distribuyen vía TestFlight (testers internos). Los builds de producción van a App Store Connect vía `eas submit` manual.

**Android:** Los builds de preview se distribuyen vía Google Play Internal Testing. Los builds de producción van a Google Play vía `eas submit` manual.

El envío siempre es manual — sin `autoSubmit`. El lead ejecuta `eas submit` después de verificar que el build de producción está en buen estado:

```bash
# Después de que el build de producción completa
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Puntos de contacto con QA

**QA del sprint — cada merge a `develop`**

Cada vez que una rama `feature/*`, `chore/*` o `hotfix/*` mergea a `develop`, EAS inicia automáticamente un build `preview`. El build llega a TestFlight y Play Internal Testing. QA testea los cambios dentro del mismo sprint.

**Smoke test — cada rama `release/*`**

Cuando se crea una rama `release/*` desde `develop`, EAS inicia un build `preview` separado. QA ejecuta smoke tests contra este build antes de aprobar el release.

---

## Decisión 4 · Automatización pre-merge con Husky + CI

Husky ejecuta verificaciones localmente antes de que el código llegue al remoto. Dos hooks:

**Pre-commit** — verificaciones rápidas que se ejecutan en cada commit:

- ESLint (`eslint --fix`)
- Formato con Prettier (`prettier --write`)
- Verificación de TypeScript (`tsc --noEmit`)

Usando `lint-staged` para que solo se analicen los archivos en staging — no todo el codebase en cada commit.

**Pre-push** — la suite completa de tests se ejecuta antes de hacer push al remoto:

- `jest --passWithNoTests`

Esto evita que CI sea el primer lugar donde se detectan fallos. El desarrollador sabe que su rama está limpia antes de que llegue al remoto.

**CI — `.github/workflows/ci.yml`** — el mismo gate corre en GitHub Actions en cada push y PR a `main`/`develop`, como respaldo de aplicación que no depende de que cada contribuidor tenga los hooks instalados:

1. `pnpm install --frozen-lockfile` — una deriva del lockfile falla el build en vez de re-resolver silenciosamente
2. `pnpm typecheck` · `pnpm lint` · `pnpm test`
3. `pnpm expo:check` (`expo install --check`) — valida cada dependencia gestionada por Expo contra lo que el SDK de Expo realmente fija. Este paso existe porque `tsc`/`eslint`/`jest` nunca ejercitan Metro, Babel ni el runtime nativo de Expo Go — una dependencia que se desvía de la versión fijada por el SDK pasa las tres y aun así rompe la app en el primer arranque (pasó; ver la tabla del gate de verificación en A6). `pnpm verify` corre los mismos cuatro pasos localmente.

---

## Decisión 5 · Requisitos de PR

### Responsabilidad única

Un PR hace una sola cosa. Si se encuentra una oportunidad de refactor mientras se desarrolla una funcionalidad, va en un PR separado de tipo `chore/*`. Esta es una regla estricta, no una guía — mantiene las revisiones enfocadas y facilita revertir un cambio específico sin perder trabajo no relacionado.

### Formato de mensajes de commit

Seguimos Conventional Commits:

```
feat(jobs): agregar filtro de rango salarial a la pantalla de búsqueda
fix(auth): manejar expiración de token durante fetch en background
chore(deps): actualizar expo-router a 6.1
refactor(jobs): extraer lógica de paginación a useJobsPagination
test(auth): agregar tests unitarios para el store de sesión
docs(a3): actualizar diagrama de navegación con sheet desacoplado
```

Formato: `tipo(scope): descripción`. Tipos: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`. El scope es el dominio o nombre de pantalla.

### Propiedad del código (CODEOWNERS)

```
# .github/CODEOWNERS

# Los contratos compartidos y auth siempre requieren revisión del lead
/packages/shared/                  @lead
/app/core/services/                @lead
/backend/src/domains/auth/         @lead
/docs/                             @lead

# Las pantallas de funcionalidades pueden ser revisadas por cualquier miembro del equipo
/app/app/                          @team
/backend/src/domains/jobs/         @team
/backend/src/domains/applications/ @team
```

### Plantilla de PR

```markdown
## ¿Qué hace este PR?

<!-- Una oración. Si no puedes describirlo en una oración, divide el PR. -->

## Tipo

- [ ] feat
- [ ] fix
- [ ] chore
- [ ] refactor
- [ ] docs

## Checklist

- [ ] Este PR hace una sola cosa
- [ ] Tests agregados o actualizados
- [ ] Snapshots revisados, no actualizados a ciegas (si hubo cambios de UI)
- [ ] Sin errores de TypeScript (`tsc --noEmit`)
- [ ] Sin errores de ESLint
- [ ] Docs relevantes actualizados (si aplica)

## Cómo testear

<!-- Pasos para que el reviewer verifique el cambio -->

## Screenshots / grabaciones (si es cambio de UI)

## Issues / tickets relacionados
```

### Requisitos de merge

Un PR no puede mergearse a menos que:

- Todos los ítems del checklist estén marcados
- Los hooks pre-push pasen (tests en verde, TypeScript limpio)
- Al menos una aprobación de un miembro del equipo
- Aprobación del lead si CODEOWNERS lo requiere
- Sin comentarios de revisión sin resolver

---

## Decisión 6 · Preparación para IA

### CLAUDE.md

`CLAUDE.md` vive en `.github/` y es leído automáticamente por Claude Code cuando se abre el proyecto. Le da a cualquier agente de IA el contexto necesario para trabajar en este codebase sin leer todos los archivos.

### Instrucciones para GitHub Copilot

`.github/copilot-instructions.md` le da a Copilot el mismo contexto estructural para sugerencias en línea — qué patrones seguir, qué evitar y dónde viven las cosas.

---

## Decisión 7 · Linting, formateo y convenciones de código

### ESLint — qué aplicamos

**Límites de arquitectura:**

- `import/no-restricted-paths` — `core/` no puede importar desde `app/`. Los servicios de dominio del backend no pueden importar desde routers o middleware.

**Higiene de TypeScript:**

- `@typescript-eslint/no-explicit-any` — sin `any`. Usar `z.infer<>` para tipos de respuesta de API.
- `@typescript-eslint/no-non-null-assertion` — sin aserciones `!`. Manejar la nulabilidad explícitamente.
- `@typescript-eslint/consistent-type-imports` — `import type` para importaciones solo de tipos.

**React Native:**

- `react-hooks/rules-of-hooks` — hooks solo en el nivel superior de componentes y hooks personalizados.
- `react-hooks/exhaustive-deps` — sin dependencias faltantes en `useEffect`.

**Code smells:**

- `no-console` — sin `console.log` en código de producción. Usar el `logger` de `backend/src/lib/logger.ts`.
- `no-unused-vars` — sin código muerto.
- `complexity` — complejidad ciclomática máxima de 10 por función.

### Convenciones de código no aplicables por herramientas

- **Sin estilos en línea en componentes React Native** — todos los estilos van a través de los tokens de tema en `core/theme/`.
- **Sin acceso directo al store en componentes** — los componentes llaman acciones, no `setState` directamente.
- **Las funciones de servicio retornan respuestas tipadas** — nunca `any`, nunca `Response` crudo.
- **Manejo de errores en el límite** — los servicios lanzan, los hooks capturan. Los componentes nunca manejan errores crudos de fetch.
- **Un componente por archivo** — sin archivos barrel que exporten múltiples componentes.

---

## Decisión 8 · Accesibilidad

Seguimos WCAG 2.1 AA como línea base. La accesibilidad se aplica en tres niveles: análisis estático, testing y auditoría en runtime durante el desarrollo.

### Análisis estático — pre-commit

`eslint-plugin-react-native-a11y` se ejecuta como parte de la configuración de ESLint — `.eslintrc.js` extiende `plugin:react-native-a11y/all`, con alcance `app/**/*.tsx`. Detecta las violaciones más comunes antes de que el código sea commiteado:

- `accessibilityLabel` faltante en elementos interactivos
- `accessibilityRole` faltante en touchables
- Touchables con label pero sin `accessibilityHint`
- Imágenes sin `accessibilityIgnoresInvertColors`
- `accessibilityState` incorrecto o faltante en toggles (botones de Postular, Favorito)

Encender el plugin sacó a la luz cinco violaciones reales en código ya revisado — hints faltantes en touchables con label (`Input`, `JobCard`, el botón de quitar en actividades), un backdrop de modal sin descriptores en `Select`, y el flag de invert-colors faltante en la imagen de `Avatar` — todas corregidas en el mismo cambio, que es exactamente el argumento a favor del enforcement automático sobre la disciplina manual.

### Testing — a nivel de componente y pantalla

React Native Testing Library consulta por `accessibilityRole` y `accessibilityLabel` por defecto. Escribir tests de esta manera aplica naturalmente la corrección semántica.

```ts
// Aplica que el botón tiene el rol y label correctos
const applyButton = getByRole('button', { name: 'Postularme a este empleo' })
expect(applyButton).toBeEnabled()
```

### Aplicación de WCAG mediante tokens de tema

| Criterio                 | Requisito                                   | Aplicación                                                                       |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| 1.4.3 Contraste          | Ratio de contraste de texto ≥ 4.5:1         | Los tokens de tema definen pares de colores con contraste seguro.                |
| 2.5.5 Tamaño de objetivo | Touch targets ≥ 44×44pt                     | ESLint vía `react-native-a11y`. Tamaños mínimos en tokens de espaciado del tema. |
| 4.1.2 Nombre, Rol, Valor | Todo elemento interactivo tiene label y rol | ESLint + consultas RNTL como patrón estándar de testing.                         |

---

## Decisión 9 · Escaneo de seguridad

**Vulnerabilidades de dependencias — Dependabot**

Dependabot está habilitado vía `.github/dependabot.yml`. Escanea dependencias semanalmente y abre PRs automáticamente cuando se encuentra una vulnerabilidad.

**Auditoría de dependencias — `npm audit`**

`npm audit --audit-level=high` se ejecuta como requisito de merge. Un PR con una vulnerabilidad de dependencia de alta severidad no puede mergearse.

**Seguridad a nivel de código — `eslint-plugin-security`**

Agregado a la configuración de ESLint para el backend. Detecta problemas comunes de seguridad en Node.js: regex inseguras, riesgos de inyección, uso de `eval`, aleatoriedad insegura.

No se aplica al frontend — la superficie de riesgo ahí es menor y las reglas agregan ruido sin un valor proporcional.

`eslint-plugin-security@3.x` eliminó su export legado `plugin:security/recommended` y ahora solo distribuye flat config, lo cual es incompatible con nuestro `.eslintrc.js` basado en eslintrc (su objeto de configuración trae un campo `name` de nivel superior que el schema de eslintrc rechaza). En lugar de fijar la versión a v2 o migrar todo el repo a flat config, el set de reglas recomendado se reproduce de forma inline bajo el override de `backend/**/*.ts` en `.eslintrc.js`. Revisitar esto cuando el proyecto migre a ESLint flat config (`eslint.config.js`).
