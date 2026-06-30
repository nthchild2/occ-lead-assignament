# A6 · Ciclo de Vida de Desarrollo Asistido por IA

## Contexto

Este monorepo se construyó con agentes de IA de codificación (Claude Code) realizando la mayor parte del scaffolding, la implementación y la documentación, bajo la dirección de un lead humano que definía el alcance, revisaba el resultado y tomaba las decisiones que la IA no debe tomar sola. Este documento describe ese ciclo de vida tal como se practicó en este ejercicio — no como un marco teórico, sino como la secuencia real de pasos, salvaguardas y puntos de control utilizados — para que un revisor pueda evaluar el proceso detrás del código, no solo el código en sí.

Esta es meta-documentación: no describe una decisión técnica, describe cómo se llegó a las decisiones técnicas de A1–A5 y cómo se mantuvieron honestas.

---

## El ciclo de vida

```
1. Ingesta de la especificación →  leer el brief del ejercicio en PDF, extraer los requisitos duros
2. Arquitectura primero          →  escribir A1–A5 antes de cualquier código de implementación
3. Archivos de salvaguarda       →  CLAUDE.md, copilot-instructions.md codifican las reglas de
                                     A1–A5 como restricciones legibles por máquina para
                                     futuras sesiones de IA
4. Scaffolding                   →  estructura del monorepo, configs, tooling — verificado,
                                     no asumido
5. Implementación                →  código de funcionalidades, contra la arquitectura y
                                     las salvaguardas
6. Gate de verificación          →  typecheck + lint + test, en cada cambio, antes de
                                     reportar como terminado
7. Revisión y corrección         →  el humano detecta lo que los gates automatizados no
                                     pueden — preguntas de proceso, naming, scope creep,
                                     cosas que se ven bien pero no lo están
8. Los docs se mantienen al día  →  los cambios de config/proceso se reflejan de vuelta en
                                     A1–A6 en la misma unidad de trabajo, no como un seguimiento
```

Esto se repite en bucle, no se ejecuta una sola vez. El paso 6 en particular bloqueó casi todos los cambios en esta sesión — ver la [Decisión 3](#decisión-3--el-gate-de-verificación-no-es-negociable) más abajo para lo que realmente detectó.

---

## Decisión 1 · Los docs de arquitectura se escriben antes que el código, y el agente los lee antes de cada cambio estructural

### Contexto

Un agente de IA sin memoria persistente entre sesiones volverá a derivar (o peor, a re-decidir) las decisiones arquitectónicas cada vez que se le pida tocar el codebase, a menos que esas decisiones estén escritas en algún lugar que tenga instrucción de leer primero.

### Decisión

A1–A5 no son documentación retrospectiva — se escribieron antes que el código correspondiente, y `CLAUDE.md` le indica explícitamente al agente que los lea antes de hacer cambios estructurales:

```
## Docs
Architecture decisions are documented in `docs/`. Read them before making
structural changes:
- `docs/A1 · Monorepo Architecture.md`
- `docs/A2 · State & Data Strategy.md`
...
```

Esto hace que los docs sean estructurales, no decorativos. Si `core/` importar desde `app/` está prohibido, esa regla existe en A1 (el razonamiento), en `CLAUDE.md` (la instrucción) y en `.eslintrc.js` (la aplicación) — tres capas, no una.

- Un revisor puede auditar un PR contra una decisión escrita en lugar de confiar en la memoria del agente de una conversación previa.
- Una futura sesión de IA — posiblemente con un modelo distinto — recibe las mismas restricciones que un lead humano habría dado verbalmente.
- Los cambios de arquitectura se vuelven visibles: cambiar A1 y cambiar la estructura de carpetas son el mismo PR.

---

## Decisión 2 · Las salvaguardas se duplican en las herramientas que realmente las leen

### Contexto

Claude Code lee `CLAUDE.md`. GitHub Copilot lee `copilot-instructions.md`. Ninguno lee el archivo del otro, y ninguno lee `docs/A1...md` por defecto a menos que se le indique. Apuntar a ambos únicamente con "ver los docs de arquitectura" significaría que cada herramienta de IA reparsea cinco archivos Markdown en cada invocación, lo cual es lento e inconsistente.

### Decisión

Cada herramienta de IA recibe un archivo corto y específico para esa herramienta que reafirma las reglas estructurales en la forma que esa herramienta consume más rápido, con `docs/` como fuente de verdad para el _por qué_:

- `.github/CLAUDE.md` — para Claude Code: resumen de arquitectura, comandos, índice de docs.
- `.github/copilot-instructions.md` — para GitHub Copilot: las mismas reglas, expresadas como restricciones de sugerencia en línea ("Sin `any`", "Sin fetch en componentes").

Ambos archivos son cortos a propósito. Son una caché de las conclusiones de A1–A5, no un reemplazo — si alguna vez los dos no coinciden, `docs/` gana y el archivo de salvaguarda está desactualizado y necesita corregirse.

- Cada herramienta recibe las restricciones en su formato nativo en lugar de un volcado genérico de documentación.
- La duplicación es barata de mantener sincronizada porque ambos archivos son cortos — unas pocas líneas cada uno, no páginas.
- Un colaborador sin herramientas de IA puede seguir leyendo `docs/` y obtener las mismas reglas con el razonamiento adjunto.

---

## Decisión 3 · El gate de verificación no es negociable

### Contexto

Que un agente de IA reporte "terminado" después de escribir código no es evidencia de que el código funcione. Los errores de tipos, las violaciones de lint y los tests rotos son baratos de detectar de inmediato y costosos de detectar en CI o en revisión.

### Decisión

Ningún cambio se reporta como completo sin ejecutar, en este orden: `tsc --noEmit` para cada workspace tocado, `eslint` y `jest`. Esto no es aspiracional — es lo que realmente sucedió en esta sesión, y detectó problemas reales y no triviales antes de que llegaran a un commit:

| Detectado por el gate       | Qué era                                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` (app)        | `moduleResolution: "bundler"` sin `module: "ESNext"` — bug de configuración del bootstrap, no introducido por la IA, pero habría bloqueado silenciosamente cada typecheck futuro                                                         |
| `tsc --noEmit` (backend)    | Un tipo `app` de Express inferido no era portable a través del anidamiento de `node_modules` de pnpm — error de TS invisible hasta que `--noEmit` realmente se ejecutó                                                                   |
| `eslint`                    | `eslint-plugin-security@3.x` solo distribuye flat config; `extends: ['plugin:security/recommended']` hace que ESLint falle por completo en lugar de advertir                                                                             |
| `eslint` (`complexity`)     | Un componente `Button` excedió el presupuesto de complejidad (12 vs. máximo 10) — detectado por la misma regla documentada en A4, no exceptuada por ser "solo código de UI"                                                              |
| `eslint` (`no-unused-vars`) | La firma del middleware de manejo de errores de Express requiere 4 parámetros incluso cuando uno (`_next`) no se usa — requirió agregar `argsIgnorePattern: '^_'`, una brecha real de configuración, no un falso positivo para silenciar |
| `jest`                      | Se confirmó que el `transformIgnorePatterns` por defecto de `jest-expo` ya maneja el anidamiento `.pnpm/` de pnpm — un override personalizado en `package.json` lo estaba rompiendo activamente                                          |

- Ninguno de estos se detectó porque "el código se ve bien" — se detectaron ejecutando las herramientas reales que el checklist de PR (A4) requiere.
- Varios eran bugs preexistentes del bootstrap, no regresiones introducidas por la IA — al gate no le importa cuál sea el origen; bloquea cualquiera de los dos.
- El gate es el mismo que ejecutan los hooks pre-commit/pre-push de un colaborador humano (`.husky/`), así que el código escrito por IA y el escrito por humanos se sostienen contra la misma barra.

---

## Decisión 4 · Las correcciones de proceso y configuración actualizan los docs en la misma unidad de trabajo

### Contexto

Una corrección de configuración hecha de forma aislada (p. ej. parchear `.eslintrc.js` para evitar un cambio incompatible de una dependencia) es invisible para la siguiente persona — o la siguiente sesión de IA — a menos que el razonamiento quede escrito en algún lugar duradero. El conocimiento tribal que solo vive en el historial de chat no sobrevive un reinicio de contexto.

### Decisión

Cuando una corrección cambia el _por qué_ algo está configurado de cierta forma — no solo _que_ funcione — el doc correspondiente se actualiza en el mismo cambio, no después. La incompatibilidad de flat-config de `eslint-plugin-security` es el ejemplo concreto de esta sesión: la corrección fue a `.eslintrc.js`, y la explicación fue a A4 (ambas versiones de idioma) en el mismo paso, incluyendo la nota a futuro sobre cuándo revisitarla (migración a flat-config).

- Cualquiera que lea A4 después ve tanto la regla como la razón por la que está implementada de forma inusual, en lugar de encontrar un comentario en línea sin explicar en la configuración y preguntarse si es estructural o vestigial.
- Esta es la misma disciplina que se le pide a los colaboradores humanos vía el ítem del checklist de PR "Docs relevantes actualizados (si aplica)" — los cambios escritos por IA siguen la misma regla, no una relajada.

---

## Decisión 5 · Los docs bilingües se generan, no se mantienen a mano en dos lugares

### Contexto

Este proyecto sirve a un equipo de ingeniería mexicano. Mantener `docs/A*.md` en inglés y `docs/A*.md` (español) a mano, por dos autores distintos, arriesga divergencia — una versión se actualiza, la otra no.

### Decisión

Las versiones en español son traducciones completas generadas desde la fuente en inglés en una sola pasada, incluyendo comentarios de código, contenido de tablas y diagramas — el código en sí permanece en inglés ya que es el idioma que usa el codebase y el tooling. Este archivo (A6) sigue la misma convención: inglés aquí, español como `A6 · Ciclo de Vida de Desarrollo Asistido por IA.md`.

Este es un trade-off conocido: una traducción generada puede divergir de una mantenida a mano en tono, y no hay una verificación automatizada de que las dos permanezcan sincronizadas después de ediciones futuras. La mitigación es procedimental, no técnica — cuando una versión de idioma cambia, regenerar la otra en el mismo PR, de la misma forma en que una corrección de configuración y su actualización de doc viajan juntas (Decisión 4).

---

# El Framework · operacionalizando el ciclo de vida

Todo lo anterior es **descriptivo** — lo que realmente se hizo en esta sesión. Esta sección es **prescriptiva**: el framework repetible en el que esos hábitos se solidificaron, para que la siguiente funcionalidad no se construya sobre improvisación. La idea rectora es la **ingeniería de contexto**. El techo de calidad de cualquier resultado de IA lo determina lo que hay en su ventana de contexto, así que en lugar de que un solo agente sostenga toda la tarea (el modo de falla del vibe-coding — inconsistente, no auditable), el trabajo se divide en fases, cada una ejecutada por un **agente nuevo que lee solo sus entradas, produce un documento de handoff y termina**. El humano (o un orquestador delgado) solo transporta documentos pequeños entre fases, así que ninguna ventana de contexto se desborda. La consistencia viene de los contratos entre fases, no de que un agente en particular sea ingenioso.

## El pipeline

```
0. SPEC           → ledger de requisitos (R-ids)            el humano escribe / aprueba
1. RESEARCH       → mapa de archivos + restricciones, todo citado   researcher (solo lectura)
2. PLAN           → lista de cambios, cada uno citando R-ids   planner       ◀ GATE HUMANO CLAVE
3. IMPLEMENT      → código + reporte que rastrea cambios a R-ids   implementer
4. VERIFY         → matriz de cobertura + gate de tooling     verifier (independiente)
                                                                  │
                              ┌────────────────────────────────────┘
                              ▼  en fallo: regresar a PLAN (enfoque equivocado)
                                                  o a IMPLEMENT (código equivocado)
```

Cada fase escribe un documento en `docs/work/<feature>/`, numerado `00`–`04`. Esos documentos son la interfaz entre fases y la traza permanente del trabajo — ver `docs/work/README.md`.

## La trazabilidad es la columna vertebral

La especificación se descompone en un **ledger de requisitos**: ítems atómicos, testeables, con IDs estables (`R1`, `R2`, …). Cada artefacto posterior referencia esos IDs, lo que hace que "hacer solo los cambios que podemos rastrear a un requisito" sea verificable mecánicamente en lugar de aspiracional:

```
ledger        define R1, R2, R3 …
research      mapea cada archivo relevante → los R-ids que toca
plan          cada cambio planeado cita R-ids        (cambio huérfano = scope creep)
impl report   cada cambio rastrea a R-id + paso del plan
verify        matriz de cobertura:  cada R tiene ≥1 cambio  → sin brechas
                                    cada cambio tiene ≥1 R  → sin gold-plating
```

Esa matriz de cobertura es la definición objetiva de "terminado y nada de más". Un requisito `must` sin cambio es una brecha; un cambio sin requisito es scope creep. Ambos fallan el gate.

## Gates y el dial de autonomía

Como cada handoff es un archivo commiteado, **la intervención humana es simplemente "editar el archivo entre fases"** — la siguiente fase lee el artefacto y no le importa si lo escribió un agente o un humano (o ambos). Esto hace que la adopción sea gradual: el mismo pipeline corre con tanta o tan poca participación humana como se quiera, configurada por corrida como una política de gates.

| Modo                           | Comportamiento                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| **control-total**              | El orquestador pausa en cada gate, muestra el artefacto, espera aprobación/ediciones. |
| **balanceado** _(por defecto)_ | Auto a través de research; **checkpoint en PLAN**; auto a través de verify.           |
| **full-auto**                  | Corre de extremo a extremo, deteniéndose solo en las dos reglas duras de abajo.       |

**Dos paradas duras anulan cualquier modo** — incluso full-auto pausa para estas:

1. **Escalación por ambigüedad** — research o plan revela una brecha en la spec → detenerse y preguntar a un humano; nunca adivinar.
2. **Fallo de verificación** — brecha/huérfano en la cobertura, o `tsc`/`eslint`/`jest` falla → detenerse y regresar.

El gate de PLAN es el checkpoint por defecto a propósito: un plan defectuoso cuesta un párrafo corregirlo, código defectuoso cuesta una reescritura. Es el lugar de mayor apalancamiento para que un humano invierta atención.

## Anti-alucinación: la regla de citación

Los agentes se descarrilan cuando afirman cosas sobre el codebase de memoria. Dos mecanismos lo previenen:

- **El Mapa** (`docs/MAP.md`) — un índice estático de "cómo se hace X aquí" desde el cual arranca el researcher, para que navegue a puntos de entrada reales en lugar de inventarlos.
- **Citaciones obligatorias** — cada afirmación factual en un doc de research o plan lleva un `path:line`. Esto se aplica en tres capas, de más barata a más cara: (1) las plantillas hacen de la citación un **campo obligatorio**, así que su ausencia es un error estructural, no un juicio; (2) un script validador verifica que cada `path:line` **exista y esté en rango**, matando rutas fabricadas mecánicamente; (3) el verifier hace **spot-check** de una muestra para relevancia — la ruta es real _y_ dice lo que el doc afirma.

Esta es la misma filosofía que el gate de verificación de la Decisión 3: reemplazar "parece fundamentado" con "la estructura exigió una fuente y una herramienta confirmó que resuelve".

## El tooling, en tres niveles

El framework se divide limpiamente en un núcleo portable y una cáscara delgada específica de la herramienta, para que cambiar de herramienta de IA después conserve la mayor parte:

| Nivel                      | Qué                                                                                                                                                                  | Dónde                                  | ¿Portable?                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| **Contratos**              | Ledger de requisitos + cuatro plantillas de handoff; el Mapa                                                                                                         | `docs/work/_templates/`, `docs/MAP.md` | ✅ markdown plano            |
| **Operadores**             | Un subagente por rol de fase (researcher, planner, implementer, verifier)                                                                                            | `.claude/agents/`                      | ⚙️ específico de Claude Code |
| **Conductor + ejecutores** | Comando orquestador (dirige fases, aplica la política de gates, reporta al humano), comandos por fase para takeover, los scripts validadores de citación + cobertura | `.claude/commands/`, `scripts/`        | ⚙️ específico de la cáscara  |

Los **contratos son el framework**; los operadores y el conductor solo los mueven a través del pipeline. Los operadores son **subagentes** específicamente porque un subagente corre en contexto aislado — ese aislamiento es la propiedad de "un agente nuevo por fase" de la que depende todo el diseño; un skill corriendo en el hilo principal lo anularía. El **orquestador corre en la conversación principal** para que "reporta de vuelta al humano" sea automático — el hilo principal es lo único que le habla al usuario; despacha los subagentes de fase, aplica la política de gates y presenta un resumen corto más el artefacto entre cada fase.

### Cómo correrlo

```
/aidlc-spec <feature-id> [spec-fuente]   →  scaffolding + borrador del ledger (el humano aprueba)
/aidlc-run  <feature-id> [modo]          →  orquesta las cuatro fases con una política de gates
```

Para adopción gradual o takeover humano, los comandos por fase corren una fase a la vez:
`/aidlc-research`, `/aidlc-plan`, `/aidlc-implement`, `/aidlc-verify` — cada uno toma el feature id. Como cada handoff es un archivo, puedes correr una fase, editar su artefacto en disco y regresar al siguiente comando; la siguiente fase lee el archivo y no le importa quién lo escribió. Los scripts ejecutores (`scripts/aidlc/validate-citations.mjs`, `scripts/aidlc/check-coverage.mjs`; también `pnpm aidlc:cite` / `pnpm aidlc:coverage`) respaldan los gates de citación y cobertura mecánicamente.

> Estado: los tres niveles están en su lugar — contratos (`docs/work/_templates/`, `docs/MAP.md`), operadores (`.claude/agents/`) y conductor + ejecutores (`.claude/commands/`, `scripts/aidlc/`). El pipeline también puede correrse completamente a mano: copiar las plantillas e invocar cada fase manualmente sigue exactamente el mismo contrato.

---

## Lo que este documento no es

No es una afirmación de que el resultado de la IA no requiere revisión — las Decisiones 3 y 4 existen precisamente porque sí la requiere. No es un proceso que el equipo deba adoptar hacia adelante sin modificación; es un registro de lo que realmente se hizo aquí, para que pueda evaluarse, conservarse o cambiarse deliberadamente en lugar de asumirse.
