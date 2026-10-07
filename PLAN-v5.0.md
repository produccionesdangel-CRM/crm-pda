# Plan de integración v5.0 — motor de campañas sobre el CRM real

> Documento de trabajo. Todo lo que dice aquí está **verificado** contra el archivo
> `index.html` de este repositorio (BUILD `2026-10-05.9`), no supuesto.
> Base de la investigación: `AUDITORIA-CRM-CAMPANAS.md` (auditoría de la PC de trabajo)
> y el código de `CRM Lite Campanas\`.

## 0. Reglas de trabajo (no negociables)

1. **Nada se toca en producción** hasta que exista un respaldo exportado **y verificado** desde el CRM real.
2. Todo el trabajo va en la rama **`v5.0`**; `main` se queda igual a lo publicado hasta que Jorge apruebe.
3. Los cambios son **aditivos**: no se renombra ni se borra ningún campo existente.
4. Antes de dar algo por bueno: **correr `pruebas\humo-crm.mjs`** (detecta errores de arranque que ni la
   compilación ni la revisión de sintaxis ven) y probar en el navegador con `pruebas\servir.mjs`.
5. Las pruebas de interfaz deben **hacer clic** en los botones, no solo comprobar que se dibujan
   (en la lite, tres listados quedaron mudos sin que ninguna prueba lo notara).

## 1. Mapa del archivo real (líneas verificadas)

| Zona | Línea | Nota |
|---|---|---|
| Scripts de Firebase (CDN, compat 9.22.0) | 9–11 | app, database, auth |
| CSS (con bloques `@CSS-...`) | 12–1022 | termina en `</style>` (1022) |
| Menú lateral (`li.menu-item`) | 1107–1114 | informes, prospectos, clientes, contratos, paquetes, servicios*(admin)*, calendario, configuración |
| Secciones (`section.seccion`) | 1125–1540 | informes 1125 · prospectos 1171 · clientes 1198 · contratos 1225 · paquetes 1257 · servicios 1289 · calendario 1316 · configuración 1356 |
| `</main>` | 1540 | fin del cuerpo |
| Script grande | 1563–6882 | 5.319 líneas |
| `firebase.initializeApp` | 1614 | |
| IndexedDB (`@JS-ALMACEN`) | 1911–2050 | si no hay `indexedDB`, cae a `localStorage` |
| `const CLAVES = [...]` | 2051 | segunda lista en 2697 |
| `function renderizarInformes()` | 5578 | modelo para el render del Panel |
| `function iniciarAplicacion()` | 6493 | aquí se engancha el arranque de cada vista |
| `function cambiarSeccion(seccionId)` | 6767 | `switch` de vistas; caso `servicios` en 6783 |
| Arranque (IIFE asíncrona) | 6853–6882 | sin sesión de Google → `mostrarPantallaLogin()` |

## 2. Qué se porta y en qué orden

### Fase 1 — Menú y estructura (aditivo)
1. Insertar en el menú, **después de Informes**: `Panel` (`data-seccion="panel"`), y luego
   `Prospectos`, `Campañas` (`data-seccion="campanias"`). El resto conserva su sitio:
   Clientes · Contratos · Paquetes · Servicios · Calendario · Configuración.
2. Dos secciones nuevas: `#seccion-panel` y `#seccion-campanias` (mismo patrón `section.seccion`).
3. Portar `src\estilos-campanias.css` como bloque `@CSS-CAMPANIAS` antes de `</style>` (usa las variables de tema del CRM).

### Fase 2 — Datos (subidos al mecanismo que ya existe)
4. Sumar `campanias` y `participaciones` a `CLAVES` (2051) **y** a la segunda lista (2697).
5. Engancharlas a: guardado/carga local, IndexedDB, outbox, control de versión, `historial` y `papelera`.
   **No estrenar un quinto mecanismo** (los cuatro huecos conocidos: concurrencia, outbox, idempotencia, papelera).
6. Campos nuevos **opcionales**: en `prospecto` (ciudad, origen, fechas, presupuesto…) y en `tarea`
   (`participacionId`, `campaniaId`, `prioridad`, `estado`, resultado de contacto, `responsable`, `origen`).
   **Conservar `clienteId` y `completada`** tal cual (vínculo polimórfico ya en uso).

### Fase 3 — Motor e interfaz
7. **Motor** (`src\js\20-motor.js`, 1.628 líneas, **cero DOM**, ya trae `module.exports`): es el más fácil de
   portar. Necesita que antes existan `raiz.Util` y `Catalogos`.
8. **Catálogos y utilidades** (`src\js\10-datos.js`): portar `Util` y `Catalogos` (sin la semilla de demo).
9. **Interfaz** (`src\js\40-campanias.js`, 1.733 líneas): ya está escrita contra la capa `App`
   (`App.abrirModal`, `App.cerrarModal`, `App.asistenteCampania`) y `esc()` → portar consiste en
   **implementar ese `App`** con las funciones reales del CRM (`abrirModal`, `cerrarModal`, `mostrarNotificacion`).
10. **Calendario** (`src\js\50-calendario.js`): ampliar `renderizarCalendario()` y `mostrarOpcionesDia()`
    con los eventos de campaña y el filtro nuevo, sin romper los filtros existentes.
11. **Panel del prospecto** (regla acordada): datos, campañas con el estado de **sus** tareas, tareas de campaña
    agrupadas por vencimiento y ordenadas por fecha y prioridad, y las tareas sueltas aparte.
    El CRM **ya tiene** un panel lateral (`#panel-lateral-global`) que hoy sólo se abre para contratos
    (`cambiarSeccion`, línea 6774): hay que reutilizarlo y ampliar esa condición, no crear otro.
12. **Falta en el banco de pruebas:** hoy el arranque termina en la pantalla de login (no hay sesión de Google),
    así que las vistas nuevas aún no se pueden verificar de verdad desde Node. Antes de dar la Fase 3 por buena,
    el banco debe poder **simular una sesión iniciada** y comprobar que las vistas nuevas se dibujan.

### Fase 4 — Rol de Ventas (espera las decisiones de Jorge)
12. Tabla **única de capacidades** por rol (evita regar `if (rol === 'ventas')` por el archivo) + el rol nuevo.
13. Guardas de interfaz **y reglas de Firebase** (la barrera real; falta que la PC de trabajo publique
    `firebase-rules-recomendadas.json`).

### Fase 5 — Cierre

**Pruebas del motor portado (hecho):** `pruebas\motor-v5.cmd` corre las **224 pruebas originales del CRM Lite**
contra **el motor tal como quedó dentro del CRM v5.0** (se extrae el bloque del motor desde `index.html` y se le
enchufa el almacén de prueba de la lite). Resultado: **224/224 en verde** → el port no cambió el comportamiento.
Para regenerar la copia del motor tras tocar `index.html`: `pruebas\preparar-motor-v5.ps1`.
14. Suites completas (motor + interfaz con clics) + regresión de lo existente + recorrido en móvil.
15. Respaldo, publicación al canal y despliegue (el despliegue necesita credenciales de Jorge: no se guardan aquí).

## 3. Reglas del motor que hay que respetar (ya probadas en la lite)

1. **Solo una campaña ACTIVA opera**: borrador, programada o pausada no recibe participantes ni genera tareas
   (el motor lo rechaza con `campania-no-activa`).
2. **La etapa de campaña no es la fase comercial** del prospecto; solo cambia si la campaña lo pide explícitamente.
3. **Las tareas sueltas nunca se ligan a una campaña** (`campaniaId = null`, `origen = 'manual'`) para no
   ensuciar métricas, embudo ni informes.
4. **No hay borrado destructivo** de campaña con historial: solo cancelar.
5. Un prospecto **es único**: se reutiliza entre campañas, nunca se duplica.

## 4. Estado actual

- [x] Base confirmada: `parche-v4.8.9\index.html` es **idéntica** a lo publicado en Pages (solo CRLF vs LF).
- [x] Repositorio clonado, rama `v5.0`, `.gitattributes` con LF (commit `5a493f2`).
- [x] **Banco de pruebas del archivo real** (`pruebas\humo-crm.mjs`): 13/13 en verde (arranque sin errores,
      funciones base, llegada al login, orden del menú, secciones nuevas, ids sin repetir, CSS portado).
- [x] Servidor local para pruebas en navegador y móvil (`pruebas\servir.mjs`).
- [x] **Fase 1** (commit `65433cd`): pestañas **Panel** y **Campañas** en el menú, sus dos secciones y el CSS de
      campañas en su propio bloque `@CSS-CAMPANIAS`. Menú final: Informes · **Panel** · Prospectos · **Campañas** ·
      Clientes · Contratos · Paquetes · Servicios · Calendario · Configuración. Marcado balanceado (10 secciones, 315 divs).
      Nada se rompió: el CRM arranca igual y ningún id quedó repetido.
- [x] **Fase 2** (commit `398440f`): `campanias` y `participaciones` entraron al mecanismo que ya existía —
      `COLECCIONES_VERSIONADAS`, outbox persistente, guardado local confirmable, carga/guardado en la nube,
      respaldo de seguridad, exportación e importación. Verificado guardando de verdad y revisando qué se escribió.
- [x] **Fase 3a** (motor): portados `Util`, `Catalogos` y el motor puro (2.300 líneas) **sin tocar nada existente**
      (no había choque de nombres: `Util`, `Catalogos` y `esc` no existían en el CRM).
      `crearMotor(almacen)` sólo pide 9 cosas: `db` + `campania`, `cliente`, `paquete`, `participacion`, `prospecto`,
      `servicio`, `tarea` y `guardar`. El adaptador lee las colecciones **por función** (el CRM reasigna esos arreglos
      al cargar de la nube; una copia se quedaría con la versión vieja) y `guardar()` marca como pendiente lo tocado
      y **encola el historial nuevo** para la nube.
      El rastro de auditoría usa el usuario real: se quitó `var USUARIO = 'Sesión de prueba'` y sus 16 usos pasaron a
      `usuarioDeSesion()`.
- [x] **Decisiones de Jorge recibidas (6/10/2026)**: las 5 importantes como se recomendaron, nombre del rol
      **"Ventas"**, Paquetes se queda donde está, puede borrar prospectos y sus tareas, ve solo sus tareas,
      **sí puede imprimir y enviar comprobantes de pago** (corrección suya), fase comercial hasta Negociación,
      los Operadores conservan sus permisos, **sin PIN: solo cuenta de Google**, y **autorizó ajustar las reglas
      de Firebase**. Matriz completa y límites en `PERMISOS-VENTAS.md`.
- [x] **Fase 3b (parte 1)** (commit siguiente): **puente `App`** con el CRM — `abrirModal`, `cerrarModal`, `notificar`
      (traduce el `'ok'` de la lite a `'success'`), `confirmar` (conecta el botón del CRM y ejecuta la acción),
      `descargar`, navegación (`seleccionarSeccion`, `renderSeccion`, `renderTodo`) y las pantallas que el CRM ya
      tiene (prospectos, clientes, catálogo, historial, configuración, tema). Verificado **35/35** en el banco.
- [x] **Fase 3b (parte 2)**: portados `30-vistas.js` (1.169 líneas), `40-campanias.js` (1.734) y `50-calendario.js`
      (412) **antes** del puente, así las versiones del CRM son las que ganan. No hubo que cablear nada extra: la
      interfaz se trae sus propias piezas (`App.opciones` resultó ser una **función** que arma `<option>`, no un
      objeto de configuración) y no publica ningún global fuera de `App`.
      Cableado del CRM: `renderizarSeccion()` ahora pinta `panel` y `campanias`, y el refresco general
      (`renderizarTodo`, que también usa el arranque) redibuja las dos vistas.
      **Verificado: 42/42** — el Panel pinta métricas y embudo, la lista de Campañas se dibuja, **el asistente de
      campaña arma sus pasos** y el refresco general del CRM no se rompe.
- [x] **Fase 3c (parte 1) — Calendario**: el calendario que ya tenía el CRM ahora distingue lo de campaña:
      las tareas con `campaniaId`/`participacionId` salen con el color de campaña, aparecen los **seguimientos**
      (`participacion.fechaProximoSeguimiento`, ignorando las participaciones cerradas), hay un filtro
      **"Solo campañas"** (que también aplica a la lista de tareas) y la leyenda tiene sus dos renglones nuevos.
      Nada se duplicó: se amplió el calendario existente, como pedía la auditoría (§7).
      **Verificado: 50/50** — incluye comprobar que el motor **rechaza meter gente en una campaña en borrador**.
- [x] **Fase 3c (parte 2) — Ficha del prospecto**: al abrir un prospecto, si está en alguna campaña, su ficha
      muestra **sus campañas** (etapa, estado y fecha de seguimiento) y **sus tareas de campaña agrupadas por
      vencimiento** (vencidas · hoy · próximas · sin fecha, ordenadas por fecha y prioridad). Los cálculos los
      hace el motor (`resumenCampaniasDeProspecto`, `tareasAgrupadas`); si el prospecto no está en ninguna
      campaña, **no se dibuja nada** y la ficha queda como estaba. **Verificado: 56/56**.
      Nota de vocabulario del motor (verificada, no es error): las **participaciones** usan claves en inglés
      (`campaignId`, `prospectId`) y las **tareas** en español (`campaniaId`, `participacionId`, `prospectoId`).
- [x] **FASE 3 COMPLETA** (motor integrado: vistas, calendario y ficha del prospecto).
- [ ] Fase 4 (rol de Ventas: capacidades, guardas, `admins/<uid>` y reglas de Firebase) · Fase 5 (cierre)
- [ ] Respaldo exportado y verificado por Jorge (regla de oro, antes de tocar la base real).
- [ ] `firebase-rules-recomendadas.json` (pedido a la PC de trabajo por el canal).

### Notas de la integración (para no repetir errores)

- El CRM **ya tiene** `sync-dot`/`sync-text` y un panel lateral (`#panel-lateral-global`): los ids del mismo nombre
  que venían en la lite se descartaron al portar (duplicar ids habría roto la app).
- Del CSS de la lite se dejaron fuera las reglas de `.aviso-modo` (eran el cartel de la "versión lite") y tres reglas
  que cambiaban el **panel lateral global** existente (`.panel-lateral-body .detalle-seccion`, `.tarea-vinculada`,
  `.tarea-fechas`): se aplicarán en la Fase 3, ya con el panel de campañas integrado.
- El markup de la lite traía la clase `active` en la sección Panel (allá es la vista inicial). En el CRM la inicial es
  Informes: se quitó, si no, dos secciones habrían quedado activas a la vez.
