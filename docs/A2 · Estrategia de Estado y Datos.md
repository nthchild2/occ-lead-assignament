# A2 · Estrategia de Estado y Datos

## Contexto

Este documento cubre cómo se gestiona el estado en toda la app: sesión de usuario, datos del servidor, paginación y la estrategia de prefetch para el swipe de detalle de empleo. Los tipos referenciados aquí (`Job`, `User`, `JobFilters`) se importan desde `@occ/shared`.

---

## Modelo de propiedad del estado

| Categoría          | Ejemplos                                         | Herramienta                           |
| ------------------ | ------------------------------------------------ | ------------------------------------- |
| Estado de auth     | JWT, datos del usuario                           | Zustand + AsyncStorage                |
| Estado de UI       | índice de empleo activo, estado del bottom sheet | Zustand (no persistido)               |
| Datos del servidor | empleos, postulaciones, favoritos                | fetch en hooks, almacenado en Zustand |
| Paginación         | página actual, total, hasNext                    | Zustand por dominio                   |

El ejercicio especifica Zustand para la gestión de estado. Lo usamos para todas las categorías — auth, UI y datos del servidor — con una capa de servicios delgada que maneja las llamadas HTTP reales.

---

## Decisión 1 · Stores de Zustand

### Contexto

El ejercicio requiere persistencia del JWT entre reinicios de la app y un estado global de auth que controla la navegación.

### Decisión

Un store por dominio:

```
store/
├── auth.store.ts          ← JWT, datos del usuario, acciones login/logout — persistido
├── jobs.store.ts          ← lista de empleos, paginación, filtros, empleo activo — no persistido
├── applications.store.ts  ← lista de postulaciones, loading, error — no persistido
└── favorites.store.ts     ← lista de favoritos, loading, error — no persistido
```

Solo `auth.store` se persiste mediante AsyncStorage. Todos los demás stores se resetean en cada inicio de la app.

```ts
// store/auth.store.ts
interface AuthStore {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth', storage: createJSONStorage(() => AsyncStorage) },
  ),
)
```

```ts
// store/jobs.store.ts
interface JobsStore {
  // Estado de la lista
  jobs: Job[]
  filters: JobFilters
  pagination: { page: number; total: number; hasNext: boolean }
  isLoading: boolean
  error: string | null

  // Empleo activo (swipe)
  activeJobId: string | null
  activeJobIndex: number | null

  // Acciones
  setFilters: (filters: Partial<JobFilters>) => void
  appendJobs: (jobs: Job[], pagination: Pagination) => void
  resetList: () => void
  setActiveJob: (id: string, index: number) => void
  clearActiveJob: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}
```

El JWT se lee desde `auth.store` por el interceptor del servicio de API en `core/services/api.ts` en cada request autenticado. Los componentes nunca acceden a `token` directamente.

`applications.store` y `favorites.store` siguen la misma forma que `jobs.store` — una lista, flag de loading, error y acciones para obtener y mutar. Se obtienen al montar la pantalla de Mis Actividades y se resetean cuando el usuario cierra sesión.

---

## Decisión 2 · Paginación

### Contexto

La pantalla de búsqueda de empleos carga empleos en páginas de 20. Al llegar al final de la lista se dispara la siguiente página. Cualquier cambio en filtros u orden resetea la lista a la página 1.

### Decisión

El estado de paginación vive en `jobs.store`. El hook de fetch lee la página actual del store y agrega resultados:

```ts
// core/hooks/useJobs.ts
const useJobs = () => {
  const { filters, pagination, appendJobs, resetList, setLoading, setError } = useJobsStore()

  const fetchPage = async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await jobsService.list({ ...filters, page })
      appendJobs(response.data.items, response.data.pagination)
    } catch (err) {
      setError('Error al cargar empleos')
    } finally {
      setLoading(false)
    }
  }

  const fetchNextPage = () => {
    if (pagination.hasNext) fetchPage(pagination.page + 1)
  }

  const refetch = () => {
    resetList()
    fetchPage(1)
  }

  return { fetchNextPage, refetch }
}
```

Los cambios de filtro u orden llaman a `resetList()` luego `fetchPage(1)`, lo que limpia los empleos acumulados y comienza desde cero. Esto está conectado al input de búsqueda con debounce (300ms según la especificación) y los selectores de orden/filtro.

---

## Decisión 3 · Ciclo de vida de la sesión de auth

### Contexto

Al iniciar la app, el JWT persistido puede estar expirado. La app necesita validarlo antes de navegar a una pantalla protegida.

### Decisión

Al iniciar la app, el layout raíz lee el token de `auth.store` y llama a `GET /auth/me` antes de renderizar cualquier pantalla:

```ts
// app/_layout.tsx
const { token, logout } = useAuthStore()

useEffect(() => {
  if (!token) {
    router.replace('/(auth)/login')
    return
  }
  authService
    .me()
    .then((user) => {
      // el token es válido, la navegación continúa
    })
    .catch(() => {
      logout()
      router.replace('/(auth)/login')
    })
}, [])
```

El interceptor 401 en `core/services/api.ts` maneja la expiración del token durante la sesión — limpia `auth.store` y redirige al login sin que la mutación o el hook necesiten manejarlo.

El logout llama a `POST /auth/logout`, limpia `auth.store`, resetea `jobs.store` y navega al login.

---

## Decisión 4 · Estrategia de prefetch en el swipe

### Contexto

El ejercicio requiere que cuando el usuario esté a 3 empleos del final de la página actual mientras hace swipe, la siguiente página se cargue silenciosamente en segundo plano. El swipe no debe mostrar ningún estado de loading entre páginas.

### Decisión

El handler de swipe en el bottom sheet de detalle de empleo rastrea `activeJobIndex` contra la longitud del array de empleos. Cuando se alcanza el umbral, dispara `fetchNextPage()` desde `useJobs` en segundo plano:

```ts
const PREFETCH_THRESHOLD = 3

// En el handler de swipe
const onSwipe = (newIndex: number) => {
  setActiveJob(jobs[newIndex].id, newIndex)

  const nearEnd = newIndex >= jobs.length - PREFETCH_THRESHOLD
  if (nearEnd && pagination.hasNext && !isLoading) {
    fetchNextPage()
  }
}
```

Dado que `appendJobs` agrega al array existente en el store, los nuevos empleos quedan disponibles mientras el usuario continúa haciendo swipe — sin reset, sin estado de loading expuesto en el sheet.

Si el fetch de la siguiente página falla, `isLoading` vuelve a false y `error` se establece en el store. El swipe se detiene en el último empleo disponible y se muestra un indicador sutil de fin de resultados.

Cuando el sheet se cierra, `activeJobIndex` de `jobs.store` se usa para hacer scroll de FlashList al último empleo activo antes de llamar a `clearActiveJob()`.

---

## Resumen del flujo de estado

```
El usuario abre la app
  → auth.store se rehidrata desde AsyncStorage
  → GET /auth/me valida el token
  → válido: navegar a (protected)
  → inválido: logout(), navegar a (auth)/login

El usuario busca empleos
  → cambio de filtro → resetList() → fetchPage(1)
  → scroll al final → fetchNextPage()
  → empleos se acumulan en jobs.store

El usuario abre el detalle de empleo
  → setActiveJob(id, index)
  → el bottom sheet se abre sobre la lista

El usuario hace swipe al empleo N-3 del final
  → fetchNextPage() se dispara en segundo plano
  → nuevos empleos se agregan a jobs.store
  → el swipe continúa sin interrupción

El usuario cierra el sheet
  → FlashList hace scroll a activeJobIndex
  → clearActiveJob()

El usuario cierra sesión
  → POST /auth/logout
  → auth.store limpiado
  → jobs.store reseteado
  → applications.store reseteado
  → favorites.store reseteado
  → navegar a (auth)/login
```
