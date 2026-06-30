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
  // Solo hace scroll de la lista si la pestaña de Búsqueda está activa
  if (activeTab === 'index' && activeJobIndex !== -1) {
    flashListRef.current?.scrollToIndex({ index: activeJobIndex, animated: false })
  }
  clearActiveJob()
  if (jobId) router.setParams({ jobId: undefined })
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

Las tarjetas de empleo en `index.tsx` llaman a `setActiveJob(job.id, index)`. Los taps en notificaciones establecen `jobId` como parámetro de URL, que el layout protegido lee y traduce en una llamada a `setActiveJob`.

---

## Decisión 3 · Deep linking desde notificaciones push

### Contexto

La especificación requiere que al tocar una notificación push se abra el sheet de Detalle de Empleo para un empleo específico usando el esquema `occ://vacante/:id`. El sheet debe abrirse sobre cualquier pestaña activa — no necesariamente la de Búsqueda.

### Decisión

El deep link resuelve a `/(protected)/(tabs)/index?jobId=123`. El layout protegido intercepta el parámetro `jobId`, obtiene el empleo y abre el sheet sin cambiar de pestaña:

```ts
// app/(protected)/_layout.tsx
const { jobId } = useLocalSearchParams<{ jobId?: string }>()

useEffect(() => {
  if (!jobId) return
  jobsService.getById(jobId).then((job) => {
    setActiveJob(job.id, -1) // el índice es desconocido al llegar desde un deep link
  })
}, [jobId])
```

`activeJobIndex` es `-1` al llegar desde un deep link — el empleo no está en la lista de `jobs.store`. El swipe entre empleos está deshabilitado en este caso. El sheet muestra solo el detalle de ese empleo.

Cuando el sheet se cierra, el parámetro `jobId` se elimina de la URL para que el sheet no se reabra en el siguiente render.

### Registro del handler de Notifee

El handler de eventos de Notifee se registra en `(protected)/_layout.tsx` para que solo se dispare cuando el usuario está autenticado:

```ts
// app/(protected)/_layout.tsx
useEffect(() => {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data?.jobId) {
      router.setParams({ jobId: detail.notification.data.jobId })
    }
  })
}, [])
```

Los eventos en background y estado cerrado se manejan en `app/_layout.tsx` mediante `notifee.onBackgroundEvent` y `notifee.getInitialNotification`.

---

## Decisión 4 · Estado cerrado — hidratación de sesión antes de navegar

### Contexto

Cuando la app está cerrada y el usuario toca una notificación, la app se lanza en frío. La sesión debe validarse antes de que el sheet se abra — de lo contrario cualquier acción (postular, agregar a favoritos) fallará con un 401.

### Decisión

La secuencia de hidratación en `(protected)/_layout.tsx` ejecuta `GET /auth/me` antes de renderizar cualquier hijo. El `jobId` se retiene hasta que la hidratación completa.

Secuencia al tocar una notificación con app cerrada:

```
La app se lanza en frío
  → app/_layout.tsx se renderiza
  → notifee.getInitialNotification() lee la notificación pendiente
  → almacena jobId en una ref (aún no navega)
  → (protected)/_layout.tsx se monta
  → GET /auth/me se ejecuta
  → si válido: renderiza hijos, luego establece parámetro jobId → el sheet se abre
  → si inválido: logout(), navegar al login (el jobId se descarta)
```

El `jobId` no se pasa al router hasta que la hidratación completa con éxito. Esto evita que el sheet se abra antes de que la sesión esté confirmada.

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
2. Al cerrar el sheet, si la pestaña de Búsqueda está activa y `activeJobIndex !== -1`, `scrollToIndex` lleva el empleo activo a la vista
3. `clearActiveJob()` resetea el store

Si `activeJobIndex` es `-1` (entrada por deep link), se omite `scrollToIndex`.

Si el usuario hizo swipe hasta empleos cargados desde una página posterior, `activeJobIndex` refleja la posición en el array completo acumulado de `jobs.store.jobs` — no la posición dentro de una sola página. FlashList recibe el array completo, por lo que el índice es válido.

---

## Nota de implementación · Traspaso de jobId en estado cerrado

La secuencia de estado cerrado almacena el `jobId` en una ref en `app/_layout.tsx` antes de que la hidratación complete. El layout protegido lee este valor después de que la hidratación completa con éxito. El traspaso entre ellos debe ser deliberado — un contexto de React o una variable a nivel de módulo es la opción más limpia. Un slice de Zustand es posible pero agrega riesgo de persistencia: este valor nunca debe sobrevivir un reinicio de la app por sí solo. Esto requiere atención cuidadosa durante la implementación para evitar una condición de carrera donde el sheet se abre antes de que la sesión esté confirmada.
