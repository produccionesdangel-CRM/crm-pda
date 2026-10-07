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

### Fase 4 — Rol de Ventas (espera las decisiones de Jorge)
12. Tabla **única de capacidades** por rol (evita regar `if (rol === 'ventas')` por el archivo) + el rol nuevo.
13. Guardas de interfaz **y reglas de Firebase** (la barrera real; falta que la PC de trabajo publique
    `firebase-rules-recomendadas.json`).

### Fase 5 — Cierre
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
- [x] **Banco de pruebas del archivo real** (`pruebas\humo-crm.mjs`): 6/6 en verde, arranque sin errores.
- [x] Servidor local para pruebas en navegador y móvil (`pruebas\servir.mjs`).
- [ ] Fase 1 · Fase 2 · Fase 3 · Fase 4 · Fase 5
- [ ] Respaldo exportado y verificado por Jorge (regla de oro, antes de tocar la base real).
- [ ] `firebase-rules-recomendadas.json` (pedido a la PC de trabajo por el canal).
