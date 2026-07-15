# A3 · Navegación y Deep Linking

## Contexto

Este documento cubre la estructura de rutas, la navegación protegida, el deep linking desde notificaciones push, cómo el `BottomSheetModal` coexiste con el router, y cómo el índice del swipe se sincroniza con la lista cuando el sheet se cierra.

---

## Estructura de rutas

```
/
├── (auth)/
│   ├── _layout.tsx              ← redirige a (protected) si la sesión existe
│   └── login.tsx                ← Pantalla 3: Auth
└── (protected)/
    ├── _layout.tsx              ← guardia de auth + hidratación de sesión + handler de Notifee + BottomSheetModal
    └── (tabs)/
        ├── _layout.tsx          ← barra de tabs inferior: Búsqueda | Actividades
        ├── index.tsx            ← Pantalla 1: Búsqueda de Empleos (FlashList, filtros)
        └── activities/
            ├── _layout.tsx      ← selector de tabs superior: Postuladas | Favoritos
            ├── applied.tsx      ← Pantalla 4a: Empleos postulados (por defecto)
            └── favorites.tsx    ← Pantalla 4b: Favoritos
```

El `BottomSheetModal` vive en `(protected)/_layout.tsx`, por encima del tab navigator. Esto desacopla el sheet de la pestaña de Búsqueda — puede abrirse sobre cualquier pestaña sin cambiar la pestaña activa.

---

## Diagrama

```
┌─────────────────────────────────────────┐
│              app/_layout.tsx            │
│         (raíz: providers, fuentes)      │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼──────┐  ┌──────▼──────────────────────────────────────┐
│   (auth)/    │  │              (protected)/                    │
│  _layout.tsx │  │  _layout.tsx                                 │
│              │  │  - valida token al montar                    │
│  login.tsx   │  │  - redirige al login si no hay sesión        │
│              │  │  - registra handler de Notifee               │
└──────────────┘  │  - posee ref de BottomSheetModal             │
                  └──────────────┬───────────────────────────────┘
                                 │
                  ┌──────────────▼───────────────────┐
                  │         (tabs)/_layout.tsx        │
                  │         barra de tabs inferior    │
                  └──────┬───────────────┬────────────┘
                         │               │
              ┌──────────▼──────┐  ┌─────▼──────────────────┐
              │   index.tsx     │  │   activities/           │
              │   Búsqueda de   │  │   _layout.tsx           │
              │   Empleos       │  │   selector tabs superior│
              │   (FlashList)   │  └──────┬──────────────────┘
              └─────────────────┘         │               │
                                   ┌──────▼─────┐  ┌─────▼──────┐
                                   │ applied.tsx│  │favorites   │
                                   │ (default)  │  │.tsx        │
                                   └────────────┘  └────────────┘

  BottomSheetModal se renderiza sobre todas las pestañas, pertenece a (protected)/_layout.tsx
```

---

## Decisión 1 · Rutas protegidas

### Contexto

Todas las pantallas excepto el login requieren una sesión autenticada. Expo Router maneja esto mediante redirecciones a nivel de layout.

### Decisión

`(protected)/_layout.tsx` es la guardia de auth para todo el subárbol protegido. Al montar lee el token de `auth.store`, llama a `GET /auth/me` y redirige a `/(auth)/login` si el token está ausente o es inválido.

```ts
// app/(protected)/_layout.tsx
const { token, logout } = useAuthStore()

useEffect(() => {
  if (!token) {
    router.replace('/(auth)/login')
    return
  }
  authService.me().catch(() => {
    logout()
    router.replace('/(auth)/login')
  })
}, [])
```

`(auth)/_layout.tsx` hace lo inverso — si ya existe una sesión, redirige a `/(protected)/(tabs)/index` para que un usuario autenticado nunca vea la pantalla de login.

La guardia se ejecuta una vez al montar. Los 401 durante la sesión son manejados por el interceptor en `core/services/api.ts`, que llama a `logout()` y navega al login sin pasar por la guardia nuevamente.

---

## Decisión 2 · BottomSheetModal desacoplado del tab navigator

### Contexto

El detalle de empleo es un `BottomSheetModal` que se abre sobre cualquier pantalla activa. No debe estar vinculado a una pestaña específica — un tap en una notificación debe abrir el sheet sin cambiar la pestaña activa.

Además, la especificación requiere que cerrar el sheet no resetee la posición de scroll de la lista — lo que descarta cualquier evento de navegación al abrir o cerrar. Y dado que el usuario navega entre empleos haciendo swipe dentro del sheet, routear cada empleo como una pantalla separada contaminaría el back stack y entraría en conflicto con el gesto de swipe.

### Decisión

El `BottomSheetModal` pertenece a `(protected)/_layout.tsx` y se controla imperativamente mediante una ref. Abrir y cerrar el sheet no es un evento de navegación — el stack de rutas y la pestaña activa no cambian.

Cualquier parte de la app que necesite abrir el sheet establece `activeJobId` en `jobs.store`. El layout protegido escucha ese valor y abre el sheet:

```ts
// app/(protected)/_layout.tsx
const sheetRef = useRef<BottomSheetModal>(null)
const { activeJobId, clearActiveJob } = useJobsStore()

useEffect(() => {
  if (activeJobId) sheetRef.current?.present()
}, [activeJobId])

const onSheetDismiss = () => {
  // Solo hace scroll de la lista si hay una posición conocida (índice >= 0)
  if (activeJobIndex !== null && activeJobIndex >= 0) {
    flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })
  }
  clearActiveJob()
}

return (
  <>
    <Slot />
    <BottomSheetModal ref={sheetRef} onDismiss={onSheetDismiss}>
      <JobDetail />
    </BottomSheetModal>
  </>
)
```

Las tarjetas de empleo en `index.tsx` llaman a `setActiveJob(job.id, index)`. Los taps en notificaciones y el deep link `occ://vacante/:id` desembocan en exactamente la misma llamada (con índice `-1` — ver Decisión 3), así que el layout tiene un único disparador para presentar el sheet sin importar el punto de entrada.

---

## Decisión 3 · Deep linking desde notificaciones push

### Contexto

La especificación requiere que al tocar una notificación push se abra el sheet de Detalle de Empleo para un empleo específico usando el esquema `occ://vacante/:id`. El sheet debe abrirse sobre cualquier pestaña activa — no necesariamente la de Búsqueda.

### Decisión

El deep link se implementa como una ruta dinámica dedicada: `occ://vacante/:id` resuelve a `app/(protected)/vacante/[id].tsx`, que Expo Router auto-registra como destino de deep link a partir de la ruta del archivo. La ruta no renderiza UI — lee el parámetro `id`, establece el empleo activo y redirige de inmediato a la raíz de tabs; el efecto existente del layout protegido que observa `activeJobId` (Decisión 2) presenta entonces el sheet sobre la pestaña que esté activa:

```ts
// app/(protected)/vacante/[id].tsx
export default function VacanteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()

  useEffect(() => {
    if (id) {
      useJobsStore.getState().setActiveJob(id, -1)
    }
  }, [id])

  return <Redirect href="/(protected)/(tabs)" />
}
```

`activeJobIndex` es `-1` al llegar por esta vía — el empleo no está necesariamente en la lista de `jobs.store`. El swipe entre empleos está deshabilitado en este caso, y el contenido del sheet recurre a obtener el empleo por id (`jobsService.getById`) cuando no está en la lista cargada.

Como la ruta redirige de inmediato, ningún parámetro de URL queda vivo después de que el sheet se abre — el riesgo de "el sheet se reabre en el siguiente render" de un enfoque basado en query params no existe aquí.

### Registro del handler de Notifee

Los taps en foreground no pasan por el router en absoluto. `(protected)/_layout.tsx` registra el handler — para que solo se dispare cuando el usuario está autenticado — y llama al store directamente:

```ts
// app/(protected)/_layout.tsx
function handleForegroundPress(event: NotifeeEvent): void {
  if (event.type !== EventType.PRESS) return
  const jobId = event.detail.notification?.data?.jobId
  if (typeof jobId === 'string') {
    useJobsStore.getState().setActiveJob(jobId, -1)
  }
}

useEffect(() => notifee.onForegroundEvent(handleForegroundPress), [])
```

Los eventos en background y estado cerrado se manejan en `app/_layout.tsx` mediante `notifee.onBackgroundEvent` y `notifee.getInitialNotification` — ambos guardan el id del empleo en `core/lib/pendingNotification.ts` (un holder a nivel de módulo con semántica de leer-y-limpiar) en vez de navegar, y la Decisión 4 cubre cuándo se consume ese id pendiente.

---

## Decisión 4 · Estado cerrado — hidratación de sesión antes de navegar

### Contexto

Cuando la app está cerrada y el usuario toca una notificación, la app se lanza en frío. La sesión debe validarse antes de que el sheet se abra — de lo contrario cualquier acción (postular, agregar a favoritos) fallará con un 401.

### Decisión

La secuencia de hidratación en `(protected)/_layout.tsx` ejecuta `GET /auth/me` antes de renderizar cualquier hijo. El id del empleo se retiene en `core/lib/pendingNotification.ts` hasta que la hidratación completa.

Secuencia al tocar una notificación con app cerrada:

```
La app se lanza en frío
  → app/_layout.tsx se renderiza
  → notifee.getInitialNotification() lee la notificación pendiente
  → setPendingJobId(jobId) lo guarda (aún no navega)
  → (protected)/_layout.tsx se monta
  → GET /auth/me se ejecuta
  → si válido: la hidratación pasa a 'ready' → consumePendingJobId()
    → setActiveJob(jobId, -1) → el sheet se abre
  → si inválido: clearSession() → redirect al login (el id pendiente se descarta)
```

`consumePendingJobId()` es leer-y-limpiar — devuelve el valor retenido y lo resetea en la misma llamada, así que la misma notificación nunca puede reabrir el sheet dos veces — y solo corre una vez que la hidratación está en `'ready'`, lo que evita que el sheet se abra antes de que la sesión esté confirmada.

---

## Decisión 5 · Navegación anidada en Actividades

### Contexto

La pantalla de Mis Actividades muestra dos listas: empleos postulados y favoritos. La especificación dice que puede ser "una pantalla con tabs internos o dos pantallas separadas."

### Decisión

Un navigator anidado dentro de `activities/` con un selector de tabs superior. Los empleos postulados son la pestaña por defecto.

```
activities/
├── _layout.tsx      ← selector de tabs superior
├── applied.tsx      ← por defecto
└── favorites.tsx
```

Cada pestaña monta su propio store (`applications.store`, `favorites.store`) de forma independiente. La barra de tabs inferior permanece visible — este es un navigator anidado dentro de la pestaña de Actividades, no un reemplazo.

---

## Sincronización del índice de swipe con la lista

Cuando el sheet está abierto y el usuario ha hecho swipe hasta el empleo en el índice N:

1. `jobs.store.activeJobIndex` se actualiza en cada swipe mediante `setActiveJob`
2. Al cerrar el sheet, si el ref de la lista está registrado y `activeJobIndex >= 0`, `scrollToIndex` lleva el empleo activo a la vista (best-effort, envuelto para que un ref/índice obsoleto nunca pueda romper el cierre)
3. `clearActiveJob()` resetea el store

Si `activeJobIndex` es `-1` (entrada por deep link / notificación) o `null`, se omite `scrollToIndex`.

Si el usuario hizo swipe hasta empleos cargados desde una página posterior, `activeJobIndex` refleja la posición en el array completo acumulado de `jobs.store.jobs` — no la posición dentro de una sola página. FlashList recibe el array completo, por lo que el índice es válido.

---

## Nota de implementación · Traspaso de jobId en estado cerrado

El traspaso de estado cerrado está implementado como un holder a nivel de módulo, `core/lib/pendingNotification.ts`: `app/_layout.tsx` llama a `setPendingJobId()` antes de que la hidratación complete, y `(protected)/_layout.tsx` llama a `consumePendingJobId()` (semántica de leer-y-limpiar) solo después de que su estado de hidratación llega a `'ready'`. Se evitó deliberadamente un slice de Zustand — este valor nunca debe sobrevivir un reinicio de la app por sí solo, y mantenerlo fuera de cualquier store elimina el riesgo de que algún día termine dentro de una configuración `persist` futura. El contrato de leer-y-limpiar más la compuerta de hidratación es lo que cierra la condición de carrera donde el sheet podría abrirse antes de que la sesión esté confirmada.
