# A5 · Rendimiento

## Contexto

Este documento cubre las métricas que monitoreamos en producción, las herramientas que usamos y las optimizaciones concretas aplicadas a la lista de empleos. También cubre cómo se gestiona el prefetch del swipe sin impactar el render inicial.

---

## Decisión 1 · Monitoreo en producción

### Sentry — monitoreo de errores y crashes

Sentry captura crashes, excepciones no manejadas y errores de red tanto en la app como en el backend. Es la herramienta principal para detectar y diagnosticar problemas en producción.

**App:**

- Reporte de crashes con stack trace completo y contexto del dispositivo
- Promesas rechazadas no manejadas
- Seguimiento de errores de red — llamadas de API fallidas, timeouts, respuestas 4xx/5xx
- Seguimiento de releases — los errores se etiquetan con la versión que los introdujo
- Breadcrumbs — un rastro de acciones del usuario antes de un crash, sin capturar PII

**Backend:**

- Excepciones no manejadas en middleware de Express
- Errores en servicios de dominio
- Fallos de verificación de JWT (picos de volumen indican posible abuso)

Sentry se inicializa en `app/_layout.tsx` y `backend/src/app.ts` antes de cualquier otra configuración. Los source maps se suben como parte del build de producción de EAS para que los stack traces resuelvan al TypeScript original.

### Firebase Performance — monitoreo de rendimiento en runtime

Firebase Performance monitorea el rendimiento real de la app en dispositivos de usuarios reales.

**Qué instrumentamos:**

| Métrica                              | Qué nos dice                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Tiempo de inicio de la app (frío)    | Tiempo desde el lanzamiento del proceso hasta la primera pantalla interactiva     |
| Tiempo de inicio de la app (cálido)  | Tiempo de background a foreground                                                 |
| Primer render de la lista de empleos | Tiempo desde el montaje de la pantalla hasta la primera tarjeta de empleo visible |
| Tiempos de respuesta de la API       | P50, P90, P99 por endpoint                                                        |
| Tasas de éxito/fallo HTTP            | Tasas de error por endpoint en producción                                         |

El monitoreo de red de Firebase Performance instrumenta las llamadas fetch automáticamente — no se necesita instrumentación manual para los tiempos de respuesta de la API. Se agregan trazas personalizadas para las métricas más importantes: inicio de la app y primer render de la lista.

```ts
// app/_layout.tsx
const appStartTrace = perf().newTrace('app_start')
appStartTrace.start()

// Después de la hidratación de sesión y el render de la primera pantalla
appStartTrace.stop()
```

---

## Decisión 2 · Optimizaciones de FlashList

La pantalla de búsqueda de empleos es la superficie de mayor tráfico en la app. El rendimiento de la lista afecta directamente la calidad percibida de la app.

### Optimización 1 · `estimatedItemSize`

FlashList usa `estimatedItemSize` para calcular la posición del scroll y el layout sin medir cada ítem al renderizar. Si este valor falta o es inexacto, FlashList vuelve a medir cada ítem individualmente — costoso y la causa más común de rendimiento irregular en listas.

Medimos una tarjeta de empleo representativa en tiempo de diseño y establecemos un valor fijo:

```tsx
<FlashList
  data={jobs}
  estimatedItemSize={88} // medido de una tarjeta de empleo típica
  renderItem={({ item }) => <JobCard job={item} />}
/>
```

### Optimización 2 · Ítems de lista memoizados

Sin memoización, cada actualización de `jobs.store` — incluyendo la paginación que agrega nuevos empleos — dispara un re-render de cada tarjeta visible, incluso si sus datos no cambiaron.

```ts
const JobCard = React.memo(
  ({ job }: { job: Job }) => {
    // render
  },
  (prev, next) => prev.job.id === next.job.id,
)
```

La función de comparación verifica solo el `id` del empleo. Si el id no cambió, la tarjeta no se re-renderiza. Esto es seguro porque los empleos son inmutables una vez obtenidos.

### Optimización 3 · Estabilidad de `keyExtractor`

Las claves inestables hacen que FlashList descarte y remonte ítems en lugar de reciclarlos. Las claves deben ser siempre el `id` del empleo, nunca el índice del array:

```tsx
<FlashList
  keyExtractor={(item) => item.id}
  ...
/>
```

### Optimización 4 · `getItemType`

Las tarjetas de empleo sin campo de salario se renderizan más cortas que las que lo tienen. Sin `getItemType`, FlashList puede reciclar un slot de tarjeta alta en una corta, causando saltos de layout:

```tsx
<FlashList
  getItemType={(item) => item.salary ? 'with-salary' : 'without-salary'}
  ...
/>
```

### Optimización 5 · `drawDistance`

El `drawDistance` por defecto pre-renderiza ítems muy fuera del viewport, aumentando el costo del render inicial. Reducirlo mejora el primer pintado a costa de frames en blanco ocasionales al scrollear muy rápido:

```tsx
<FlashList
  drawDistance={250}
  ...
/>
```

### Optimización 6 · Manejo de logos con `expo-image`

`expo-image` maneja la carga lazy y el caché en disco de forma nativa. Es significativamente más rápido que el componente `Image` integrado de React Native en escenarios de lista porque usa un caché compartido y decodifica imágenes fuera del hilo principal.

```tsx
import { Image } from 'expo-image'

;<Image
  source={{ uri: job.companyLogoUrl }}
  style={styles.logo}
  contentFit="contain"
  placeholder={blurhash}
/>
```

El prop `placeholder` muestra un blurhash mientras la imagen carga — sin cuadrados en blanco, sin saltos de layout.

---

## Decisión 3 · Prefetch del swipe sin impactar el render inicial

Esta sección expande la estrategia de prefetch definida en A2 con la preocupación específica de no impactar el render inicial de la lista de empleos ni del bottom sheet.

### El problema

`fetchNextPage()` es una llamada de red que se ejecuta en el hilo de JS. Si se dispara mientras el bottom sheet está animando su apertura o mientras la lista se está montando, compite por el tiempo del hilo de JS y puede causar frames caídos.

### La solución — `InteractionManager`

`InteractionManager.runAfterInteractions` encola trabajo hasta que todas las animaciones e interacciones se hayan estabilizado. El prefetch se dispara después de que la animación del sheet completa, no durante:

```ts
const onSwipe = (newIndex: number) => {
  setActiveJob(jobs[newIndex].id, newIndex)

  if (shouldPrefetchNextPage(newIndex, jobs)) {
    InteractionManager.runAfterInteractions(() => {
      fetchNextPage()
    })
  }
}
```

Esto garantiza que la animación del swipe corra a 60 fps en el hilo de UI (vía Reanimated) mientras el prefetch se difiere a un momento tranquilo en el hilo de JS.

### Por qué funciona con Reanimated

La animación del swipe corre enteramente en el hilo de UI vía `react-native-reanimated`. No toca el hilo de JS durante la animación. `InteractionManager` difiere el trabajo de JS hasta que la interacción completa — en este caso, hasta que el gesto de swipe se estabiliza. Los dos sistemas no interfieren.

### Métricas a monitorear

Las trazas personalizadas de Firebase Performance en la interacción de swipe mostrarán cualquier regresión aquí:

```ts
const swipeTrace = perf().newTrace('job_swipe')
swipeTrace.start()
// al estabilizarse el swipe
swipeTrace.stop()
```

Si el P90 de `job_swipe` supera ~16ms, indica contención del hilo de JS durante el swipe y merece investigación.

---

## Decisión 4 · Infraestructura de analytics

La configuración de analytics es nuestra responsabilidad. Qué se mide y dónde es propiedad del equipo de analytics — este documento cubre solo las decisiones de infraestructura.

### SDK

Firebase Analytics es la elección natural — ya inicializamos el SDK de Firebase para Firebase Performance. Agregar Analytics no requiere ninguna dependencia ni costo de inicialización adicional.

Firebase Analytics se integra nativamente con Google Analytics 4 (GA4) vía el enlace Firebase ↔ GA4. El equipo de analytics obtiene datos de eventos de GA4 sin que agreguemos un SDK de GA separado.

### Inicialización

Firebase Analytics se inicializa de forma lazy por defecto — no bloquea el hilo de JS al inicio y no impacta el tiempo de inicio en frío. No se necesita manejo especial más allá de la inicialización estándar de Firebase en `app/_layout.tsx`.

### Qué instrumentamos

Provemos la infraestructura y una utilidad de logging de eventos tipada. El equipo de analytics define la taxonomía de eventos. Nuestra utilidad garantiza que los eventos se registren de forma consistente:

```ts
// core/lib/analytics.ts
import analytics from '@react-native-firebase/analytics'

export const logEvent = (name: string, params?: Record<string, string | number | boolean>) => {
  if (!consentGranted()) return
  analytics().logEvent(name, params)
}
```

Todo el logging de eventos pasa por esta utilidad — nunca directamente a través del SDK de Firebase Analytics desde componentes o servicios.

### Consentimiento del usuario — GDPR

Los analytics deben estar detrás del consentimiento del usuario en mercados donde aplican el GDPR o regulaciones de privacidad equivalentes. Firebase Analytics no debe disparar eventos antes de que el usuario haya optado in explícitamente.

Firebase Analytics soporta esto vía `setAnalyticsCollectionEnabled`:

```ts
// Deshabilitar al inicio por defecto
await analytics().setAnalyticsCollectionEnabled(false)

// Habilitar solo después de que el usuario otorgue consentimiento
const onConsentGranted = async () => {
  await analytics().setAnalyticsCollectionEnabled(true)
}
```

El flujo y UI de consentimiento están fuera del alcance de este ejercicio, pero la infraestructura debe soportarlo desde el día uno.

---

## Resumen de métricas clave

| Métrica                                            | Herramienta                              | Objetivo |
| -------------------------------------------------- | ---------------------------------------- | -------- |
| Sesiones sin crashes                               | Sentry                                   | > 99.5%  |
| Inicio en frío de la app                           | Firebase Performance                     | < 2s     |
| Primer render de la lista de empleos               | Firebase Performance                     | < 500ms  |
| Tiempo de respuesta P90 de la API                  | Firebase Performance                     | < 300ms  |
| P90 del swipe de empleos                           | Traza personalizada Firebase Performance | < 16ms   |
| Vulnerabilidades de dependencias de alta severidad | Dependabot + `npm audit`                 | 0        |
