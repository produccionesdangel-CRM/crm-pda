# HALLAZGOS — AGENTE A (equipo rojo) · Auditoría del CRM PDA v5.0

**Sello del archivo auditado:** `2026-10-08.24`
**Archivo:** `C:\Users\noman\Documents\deepseek-harness\crm-pda\index.html` (1,155,715 bytes)
**sha256 al momento de la auditoría:** `d338c290535e2c0b991185e81754a5569ef0ccb816e4ebb2de6ff0162b0e7b6d`
**Caja de arena:** `pruebas\sandbox\sandbox.mjs` (config de Firebase inventada + red a `firebaseio.com`/`firebaseapp.com`/`googleapis.com`/`gstatic.com` bloqueada + modo local).
**Aislamiento comprobado en las 11 corridas:** `aislado = true`, `database = false`, `auth = false`, `fugasDatos = []`.
**Peticiones de red en total (11 corridas):** 116, **ninguna** a los dominios de datos; los únicos intentos fueron al SDK (`gstatic.com`), que quedó bloqueado (por eso la app arranca en modo local).
**`index.html` NO se modificó** (`git status --short` no lo lista). Tampoco se tocó `pruebas\sandbox\sandbox.mjs`.

---

## 0. Cómo se corre

```powershell
cd C:\Users\noman\Documents\deepseek-harness\crm-pda
node pruebas\sandbox\agente-a\02-fechas.mjs        # familia 1
node pruebas\sandbox\agente-a\03-telefonos.mjs     # familia 2
node pruebas\sandbox\agente-a\04-tareas.mjs        # familia 3
node pruebas\sandbox\agente-a\05-prospectos.mjs    # familia 4
node pruebas\sandbox\agente-a\06-clientes.mjs      # familia 5
node pruebas\sandbox\agente-a\07-contratos.mjs     # familia 6
node pruebas\sandbox\agente-a\08-pagos.mjs         # familia 7
node pruebas\sandbox\agente-a\09-campanias.mjs     # familia 8
node pruebas\sandbox\agente-a\10-concurrencia.mjs  # familia 9
node pruebas\sandbox\agente-a\11-integridad.mjs    # familia 10
node pruebas\sandbox\agente-a\99-resumen.mjs       # conteos y tabla
```

Cada script imprime **una línea por ataque** con su veredicto (`CANDADO OK` / `HUECO` / `ROTO` / `DUPLICA`), deja el detalle completo en `resultados\<familia>.json` y **termina con código 1 si encontró algo distinto de CANDADO OK** (0 si todo estuvo bien). El arnés común está en `comun.mjs`; los ayudantes que usan los formularios reales están documentados ahí dentro.

### Método (importante para leer los veredictos)
* Cada ataque **abre el modal real, escribe en el campo real y dispara el envío real**. Nunca se escriben datos "por debajo" en los arreglos.
* `dispatchEvent(new Event('submit'))` = simula **pegado / autocompletado** (se salta la validación nativa del navegador). `requestSubmit()` y el clic real del botón = lo que hace un practicante con el dedo. **Cuando la diferencia importa, se probaron los dos y se anota.**
* `window.open` se intercepta **solo** para leer la URL que la app abriría con WhatsApp (no se sale a internet).

---

## 1. Resumen de una línea por familia

| # | Familia | Ataques | CANDADO OK | HUECO | ROTO | DUPLICA |
|---|---------|--------:|-----------:|------:|-----:|--------:|
| 1 | Fechas | 15 | 9 | **6** | 0 | 0 |
| 2 | Teléfonos | 15 | 1 | **14** | 0 | 0 |
| 3 | Tareas repetidas/duplicadas | 9 | 4 | **3** | 0 | **2** |
| 4 | Prospectos | 14 | 6 | **7** | **1** | 0 |
| 5 | Clientes | 12 | 4 | **7** | 0 | **1** |
| 6 | Contratos | 15 | 12 | **3** | 0 | 0 |
| 7 | Pagos y cargos | 17 | 12 | **1** | **4** | 0 |
| 8 | Campañas y dinámicas | 13 | 4 | **9** | 0 | 0 |
| 9 | Concurrencia y prisa | 11 | 4 | **1** | 0 | **6** |
| 10 | Integridad referencial y coherencia | 8 | 4 | **4** | 0 | 0 |
| | **TOTAL** | **129** | **60** | **55** | **5** | **9** |

* **Fechas:** los candados de fecha están concentrados en el formulario de contrato; el resto (tareas, campañas, motor) acepta años absurdos y fechas imposibles.
* **Teléfonos:** **no existe ninguna validación de teléfono**. Todo lo que se escribe se guarda; 14 de 15 ataques entraron.
* **Tareas:** se pueden crear duplicados idénticos y tareas apuntando a un cliente que no existe.
* **Prospectos:** hay **XSS almacenado** por la vía de importar un archivo, un prospecto creado desde campañas **rompe el listado**, y no hay detección de duplicados.
* **Clientes:** el CRUD **no valida nada en el código** (solo confía en el `required` del HTML) → clientes vacíos, estados en blanco, correos basura, duplicados por teléfono y por nombre.
* **Contratos (lo mejor protegido):** 12 de 15 candados OK. Los huecos son permitir dos contratos idénticos, contratos de $0 y poner fecha pasada al editar.
* **Pagos y cargos:** los montos están bien protegidos (nada negativo, nada en cero, nada con letras, nada por encima del saldo sin confirmación explícita), **pero anular un movimiento está roto: lanza excepción, no se guarda y el pago "revive" al recargar**.
* **Campañas:** el asistente valida, **el motor no**. Todo lo que se meta por `crearCampania`/`actualizarCampania` se guarda sin revisar (fechas invertidas, etapas sin inicial, metas negativas, criterios inventados, ofertas con precio negativo) y no se puede activar después, pero queda basura en la base.
* **Concurrencia:** **5 casos de duplicado por doble clic** (prospecto, tarea, cliente y contrato). Solo el pago rápido se salva.
* **Integridad:** borrar un prospecto deja sus participaciones huérfanas; las tareas pueden quedar apuntando a ids que no existen y nada lo revisa.

---

## 2. Tabla de hallazgos ordenada por gravedad

> `dato` = el valor exacto inyectado. `qué pasó` = lo que la app hizo y lo que quedó guardado.
> La gravedad de esta tabla es la final (en los `DUPLICA` de contratos/clientes subí la gravedad a ALTA respecto al JSON, porque mueven dinero).

### Gravedad ALTA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---------|----------------------|----------|----------|----------|------------|
| 1 | Pagos | **Anular un pago** con el botón de basura del contrato (`$5,000` de un contrato con `$5,000 + $3,000`) | Excepción `Uncaught TypeError: Cannot set properties of null (setting 'innerHTML')`. **No se guarda**: en memoria `totalPagos $8,000 → $3,000` y `eliminado=true`, pero tras recargar del almacén vuelve a `$8,000` y `eliminado=false`. Nunca se crea la nota de anulación. El aviso "Movimiento anulado" **nunca aparece** y el formulario del contrato desaparece. | La anulación debe persistir y quedar auditada | **ALTA** | `08-pagos.mjs` (G-11) |
| 2 | Pagos | **Cargo extra de `$9,999,999`** confirmado en el aviso, luego «Guardar Contrato» | Excepción `Cannot set properties of null (setting 'value')` al confirmar. `abrirModal` reemplaza el cuerpo del modal, así que el formulario del contrato se destruye (`form-contrato` deja de existir). El cargo confirmado **se pierde** (0 antes → 0 después) y el envío posterior responde `no-existe:form-contrato`. | El cargo confirmado debe quedar guardado | **ALTA** | `08-pagos.mjs` (G-13, G-16) |
| 3 | Pagos | **Anular un cargo** de `$1,500` con el botón de basura | Misma excepción. En memoria el total del contrato baja `$28,000 → $26,500`; **en disco sigue `$28,000`** (0 eliminados). | Igual que el pago: persistir y auditar | **ALTA** | `08-pagos.mjs` (G-15) |
| 4 | Prospectos | Importar un archivo (CSV/XLSX) con `nombre = <img src=x onerror=window.__A.xss=7>` | El nombre se guarda **sin sanear**. `renderizarProspectos()` en vista de lista inyecta el `<img>` real en el DOM y **`onerror` se ejecuta** (`xss=7`). Es **XSS almacenado** con el archivo como vector. | Neutralizar el HTML del archivo | **ALTA** | `05-prospectos.mjs` (P-11) |
| 5 | Prospectos | El mismo `<img src=x onerror=window.__A.xss=9>` visto en la ficha de detalle del prospecto | `construirDetalleEntidad` mete `nombre` y `notasGenerales` sin escapar: `<img>` real dentro del modal y **`onerror` ejecutado** (`xss=9`). | Escapar en el detalle | **ALTA** | `05-prospectos.mjs` (P-12) |
| 6 | Prospectos | Prospecto creado por el **motor de campañas** (`App.motor.crearProspecto`, el que usa el botón "Crear y agregar" de la campaña) + vista de lista | Ese prospecto **no tiene `faseActual`** (el motor escribe `faseComercial`). `renderizarProspectos()` lanza `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` (línea 4512) y **la lista se queda con el contenido viejo** (25 filas pintadas, sin el nuevo). | El listado siempre debe pintarse | **ALTA** | `05-prospectos.mjs` (P-15) |
| 7 | Concurrencia | **Doble clic en «Guardar»** de prospecto: nombre `REDTEAM doble prospecto` (probado con `dispatchEvent` y con dos `requestSubmit`) | **2 prospectos** creados (`20 → 22`). No hay bandera antirrepetición en `mostrarFormularioProspecto`. | 1 prospecto | **ALTA** | `10-concurrencia.mjs` (D-01, D-02) |
| 8 | Concurrencia | **Doble clic en «Guardar»** de tarea (`REDTEAM doble tarea`, `2027-11-11`) | **2 tareas** creadas. | 1 tarea | **ALTA** | `10-concurrencia.mjs` (D-03), `04-tareas.mjs` (R-02, R-03) |
| 9 | Concurrencia | **Doble clic en «Guardar»** de cliente (`REDTEAM doble cliente 2`, tel. `8785550003`) | **2 clientes** creados. La bandera `guardando` **no sirve**: se pone en `true` al entrar y se limpia en el `finally` del primer manejador, que corre completo antes del segundo. | 1 cliente | **ALTA** | `10-concurrencia.mjs` (D-04), `06-clientes.mjs` (C-07) |
| 10 | Concurrencia | **Doble clic en «Guardar Contrato»** (`REDTEAM doble contrato`, paquete de $25,000, `2028-08-08`) | **2 contratos idénticos** de $25,000 (`0 → 2`). `guardarContrato` no tiene bandera antirrepetición. | 1 contrato | **ALTA** | `10-concurrencia.mjs` (D-05) |
| 10b | Concurrencia | **Reenviar el formulario de contrato ya guardado y cerrado** (`REDTEAM form zombi`) | `cerrarModal()` **no limpia `#modal-body`**, así que el formulario sigue en el DOM oculto y un segundo envío crea **otro contrato** (mismo festejado: 1 → 2; contratos 4 → 6). | El formulario cerrado no debe poder guardar otra vez | **ALTA** | `10-concurrencia.mjs` (D-11) |
| 11 | Clientes | Cliente con **nombre y teléfono vacíos** por envío tipo pegado/autocompletado (`campo-nombre=""`, `campo-telefono=""`) | Se guarda un **cliente fantasma** (nombre `""`, teléfono `""`) con aviso "Cliente guardado correctamente". El CRUD **no comprueba los campos obligatorios en el código**: el único candado es el `required` del HTML. Con `requestSubmit()` (clic real) el navegador sí lo frena. | Rechazo | **ALTA** | `06-clientes.mjs` (C-04, C-05, D-10) |
| 12 | Prospectos | Dos prospectos **exactamente iguales**: `Ana López Ruiz` / `8781234567` / `Interesado` (ya existía) | Se guarda el duplicado (1 → 2 con el mismo nombre y teléfono). La app **nunca compara contra los que ya existen**. | Aviso de posible duplicado | **ALTA** | `05-prospectos.mjs` (P-05) |
| 13 | Contratos | **Dos contratos idénticos** para el mismo cliente y el mismo festejado (`Festejada Contrato Base`, mismo paquete de $25,000, misma fecha `2027-10-10`) | Se guarda el segundo sin ninguna advertencia (1 → 2). Para bodas/XV años, dos contratos gemelos es dinero cobrado dos veces o trabajo duplicado. | Aviso de contrato repetido | **ALTA** | `07-contratos.mjs` (K-06) |
| 14 | Integridad | **Borrar un prospecto que tiene participaciones** (`eliminarProspecto`, botón real del listado) | El prospecto se va a la papelera y **sus participaciones quedan huérfanas** (1 antes → 1 después, apuntando a un prospecto que ya no existe). `eliminarProspecto` borra las tareas del prospecto pero **no las participaciones**. El motor sí protege (`motor.eliminarProspecto` rechaza); la interfaz no. | No dejar participaciones colgadas | **ALTA** | `11-integridad.mjs` (I-01) |
| 15 | Clientes | **Eliminar un cliente con 1 contrato y $8,000 pagados** con el botón de basura de la tarjeta (vista de mosaico, la de por defecto) | El aviso **no menciona ni los contratos ni el dinero**: solo "Esta acción moverá el cliente a la papelera". El cliente (con su contrato y sus pagos) sí queda recuperable en la papelera, pero el practicante borra $8,000 sin que se lo digan. La ruta de la **vista de lista** (`eliminarCliente`) sí dice "1 contratos · 0 tareas vinculadas". | Que las dos vistas avisen igual, con conteo | **ALTA** | `06-clientes.mjs` (C-09, C-12) |
| 16 | Campañas | Cambiar de etapa una **participación ya cerrada**: se mueve a "Convertido" (estado `convertida`) y luego se regresa a la etapa inicial "Registrado" | `cambiarEtapa` lo acepta (`ok=true`). Resultado incoherente: **etapa "Registrado" pero estado `convertida`**. | Rechazar reabrir una participación cerrada | **ALTA** | `09-campanias.mjs` (A-09) |

### Gravedad MEDIA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---------|----------------------|----------|----------|----------|------------|
| 17 | Pagos | Pago agregado **dentro del formulario del contrato** (`$2,000` con «Agregar pago») y luego cerrar el modal sin «Guardar Contrato» | La app dice "Pago agregado" (éxito), pero **no se guarda**: tras recargar el contrato sigue con 0 pagos. El aviso es engañoso. | No avisar de éxito si no se guardó, o guardarlo | MEDIA | `08-pagos.mjs` (G-12) |
| 18 | Contratos | **Contrato con paquete de precio $0** (`REDTEAM paquete en cero`) | Se guarda el contrato con `precioBase=0 precioFinal=0 totalAPagar=$0` y sin ningún aviso. | Aviso de contrato sin importe | MEDIA | `07-contratos.mjs` (K-09) |
| 19 | Contratos | **Editar** un contrato y poner la fecha del evento en el pasado (`contrato-fecha-evento = 2020-05-05`) | Se acepta: `2027-10-10 → 2020-05-05`. `guardarContrato` solo revisa el pasado cuando el contrato es **nuevo**. | Rechazar también al editar (o pedir confirmación) | MEDIA | `07-contratos.mjs` (K-12) |
| 20 | Fechas | **Tarea con fecha `1900-01-01`** (`tarea-fecha`) | Se guarda la tarea sin ningún aviso. El `<input type=date>` la acepta y `mostrarFormularioTarea` no tiene rango. | Rechazo por fecha fuera de rango | MEDIA | `02-fechas.mjs` (F-01) |
| 21 | Fechas | **Tarea con fecha `9999-12-31`** | Se guarda igual. | Rechazo | MEDIA | `02-fechas.mjs` (F-02) |
| 22 | Fechas | **Campaña con fecha de fin ANTES de la de inicio** (`crearCampania`, `2027-12-31 → 2027-01-01`) | Se crea la campaña en borrador con las fechas invertidas. `validarCampania` **sí** detecta el error, y por eso no se puede activar; el asistente valida antes de llamar. Pero el motor guarda la basura. | Que el motor no cree la campaña | MEDIA | `02-fechas.mjs` (F-12) |
| 23 | Fechas | **Editar campaña** y dejar `fechaInicio=2030-12-31`, `fechaFin=2029-01-01` (`actualizarCampania`) | `ok=true`, `errores=[]`, quedó guardado. `actualizarCampania` **no llama a `validarCampania`**. | Rechazo | MEDIA | `02-fechas.mjs` (F-13) |
| 24 | Fechas | Prospecto del motor con `fechaEvento=2027-13-01` y `fechaNacimiento=0000-00-00` | Se guarda tal cual. | Validar fechas del prospecto | MEDIA | `02-fechas.mjs` (F-15) |
| 25 | Teléfonos | Prospecto con `prospecto-telefono = "abc"` | Se guarda `"abc"`. | Validar teléfono | MEDIA | `03-telefonos.mjs` (T-01) |
| 26 | Teléfonos | Prospecto con `prospecto-telefono = "1"` | Se guarda `"1"` y **WhatsApp abriría `https://wa.me/1`**. | Validar teléfono | MEDIA | `03-telefonos.mjs` (T-02) |
| 27 | Teléfonos | Prospecto con teléfono de **40 dígitos** (`1234…7890`) | Se guarda completo. | Recortar o rechazar | MEDIA | `03-telefonos.mjs` (T-03) |
| 28 | Teléfonos | Prospecto con teléfono `"+"` | Se guarda. | Rechazo | MEDIA | `03-telefonos.mjs` (T-04) |
| 29 | Teléfonos | Prospecto con teléfono `"1111111111"` | Se guarda y **WhatsApp abriría `https://wa.me/521111111111`**. | Rechazo / aviso | MEDIA | `03-telefonos.mjs` (T-06, T-14) |
| 30 | Teléfonos | Prospecto con teléfono `"llamar al 878 luego 1234567"` | Se guarda el texto completo y `normalizarTelefonoWhatsApp` **extrae `528781234567`**: la app abre WhatsApp a un número que el practicante no escribió como número. | Validar | MEDIA | `03-telefonos.mjs` (T-09) |
| 31 | Teléfonos | Cliente (CRUD) con `campo-telefono = "abc"` | Se guarda `"abc"`. | Validar | MEDIA | `03-telefonos.mjs` (T-10) |
| 32 | Teléfonos | **Editar** un cliente y ponerle `campo-telefono = "##########"` | Se guarda `"##########"`. | Validar | MEDIA | `03-telefonos.mjs` (T-11) |
| 33 | Teléfonos | **WhatsApp con teléfono de 1 dígito** (`telefono="1"`) en un cliente | La app abre `https://wa.me/1` sin protestar (solo avisa "Abriendo WhatsApp"). | Negarse a abrir el enlace | MEDIA | `03-telefonos.mjs` (T-12) |
| 34 | Teléfonos | **Importar** un prospecto con teléfono de 40 dígitos (`9998887776665554443332221110009998887776`) | El importador lo guarda **completo** (40 caracteres). | Recortar o rechazar | MEDIA | `03-telefonos.mjs` (T-15) |
| 35 | Tareas | **La misma tarea dos veces el mismo día** (`Llamar`, `2027-05-10`, "REDTEAM duplicada", cliente Base Uno) | Se crean 2 tareas idénticas con dos avisos de éxito. | Aviso de tarea repetida | MEDIA | `04-tareas.mjs` (R-01) |
| 36 | Tareas | **Tarea asignada a un cliente/prospecto INEXISTENTE** (`tarea-cliente = "no-existe-1234"`) | Se guarda la tarea con `clienteId="no-existe-1234"`. Esa tarea **nunca aparecerá** en el detalle de nadie. | Rechazo o limpieza de la referencia | MEDIA | `04-tareas.mjs` (R-05), `11-integridad.mjs` (I-02) |
| 37 | Prospectos | Prospecto con **nombre de 500 caracteres** | Se guarda completo (`maxlength` ausente y `limpiarTextoLibre` no recorta sin `maxLargo`). | Tope de longitud | MEDIA | `05-prospectos.mjs` (P-03) |
| 38 | Prospectos | Prospecto del **motor de campañas** con `presupuesto = -5000` | Se guarda en negativo. | Rechazo o cero | MEDIA | `05-prospectos.mjs` (P-13) |
| 39 | Prospectos | Prospecto del motor con `presupuesto = "mil pesos"` | Se guarda **en silencio** `presupuesto = 0` (el texto se convierte en 0 sin avisar). | Aviso de dato no numérico | MEDIA | `05-prospectos.mjs` (P-14) |
| 40 | Prospectos | Prospecto del motor con `nombre = <div onclick=window.__A.xss=9>toca</div>` | Se guarda el HTML **intacto** (el motor no sanea como sí hace el formulario). | Sanear | MEDIA | `05-prospectos.mjs` (P-16) |
| 41 | Clientes | Dos clientes con el **MISMO teléfono** (`8781112233`, el de Cliente Base Uno) | Se guarda el duplicado. | Aviso | MEDIA | `06-clientes.mjs` (C-01) |
| 42 | Clientes | Dos clientes con el **MISMO nombre** (`Cliente Base Dos`) | Se guarda el duplicado. | Aviso | MEDIA | `06-clientes.mjs` (C-02) |
| 43 | Clientes | Cliente con `campo-estado = "EstadoInventado"` | Se guarda con **`estado = ""`** (el `select` no acepta el valor y nadie lo revisa). Esos clientes desaparecen de los filtros por estado. | Rechazo | MEDIA | `06-clientes.mjs` (C-03) |
| 44 | Clientes | Cliente con `campo-email = "no-es-un-correo"` por pegado/autocompletado | Se guarda. El CRUD no usa `esCorreoValido`; solo confía en `type=email` del navegador. | Rechazo | MEDIA | `06-clientes.mjs` (C-06) |
| 45 | Clientes | **Editar** un cliente para dejarle `campo-nombre = ""` | Se guarda con el nombre en blanco. | Rechazo | MEDIA | `06-clientes.mjs` (C-11) |
| 46 | Campañas | Campaña **sin nombre** por el motor (`nombre: ""`) | Queda guardada como `"Campaña sin nombre"` (renombrada en silencio). | Rechazo | MEDIA | `09-campanias.mjs` (A-01) |
| 47 | Campañas | Campaña con **etapas y NINGUNA inicial** | Se guarda. `validarCampania` lo detecta, pero el motor no lo revisa. | Rechazo | MEDIA | `09-campanias.mjs` (A-02) |
| 48 | Campañas | Campaña con **DOS etapas iniciales** | Se guarda con 2 iniciales. | Rechazo | MEDIA | `09-campanias.mjs` (A-03) |
| 49 | Campañas | Campaña con **metas negativas y con texto**: `{prospectos:-50, conversiones:"muchas"}` | Se guardan y `validarCampania` sí lo detecta ("La meta prospectos no puede ser negativa"), pero `actualizarCampania` no valida. | Rechazo | MEDIA | `09-campanias.mjs` (A-04) |
| 50 | Campañas | Campaña con **criterio de elegibilidad inventado**: `{tipo:"signo-zodiacal", valor:"escorpio"}` | Se guarda; `actualizarCampania` responde `ok=true, errores=[]`. | Rechazo | MEDIA | `09-campanias.mjs` (A-05) |
| 51 | Campañas | **Oferta con precio NEGATIVO** (`precioEspecial:-3000`) asignada a una participación | Se guarda y `asignarOferta` la aplica: el **`valorPotencial` de la participación queda en `-3000`**. | Rechazo | MEDIA | `09-campanias.mjs` (A-06) |
| 52 | Campañas | Participación con **estado inventado** (`cambiarEstadoParticipacion(id, "estadoInventado")`) | `ok=true` y el estado queda como `"estadoInventado"`. | Rechazo | MEDIA | `09-campanias.mjs` (A-10) |
| 53 | Campañas | Campaña con **etapas sin nombre** (`nombre:""` y `"   "`, todas con `orden:1`) | Se guarda. | Rechazo | MEDIA | `09-campanias.mjs` (A-11) |
| 54 | Concurrencia | Cliente con **nombre vacío**: `dispatchEvent` vs `requestSubmit` | Con `dispatchEvent` (pegado/autocompletado) se creó **1 cliente vacío**; con `requestSubmit` (clic real) **0**. | Validar en el código, no solo en el HTML | MEDIA | `10-concurrencia.mjs` (D-10) |
| 55 | Integridad | **Tarea apuntando a un id que ya no existe** (`no-existe-9999`) | Queda la tarea huérfana (`tarea_huerfana` detectada por el propio CRM). | Sin referencias colgadas | MEDIA | `11-integridad.mjs` (I-02) |
| 56 | Integridad | **Lote de bajas**: 3 prospectos con participación + 1 contrato con $5,000 pagados | **No se pierde el cuadre** (0 fallos de suma), pero quedan **3 participaciones huérfanas** y la tarea huérfana. | Sin referencias colgadas | MEDIA | `11-integridad.mjs` (I-06, I-08) |

### Gravedad BAJA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---------|----------------------|----------|----------|----------|------------|
| 57 | Teléfonos | Prospecto con teléfono de **solo espacios** (`"   "`) | Se guarda `""` (el saneo recorta) pero el prospecto entra igual. | Aviso | BAJA | `03-telefonos.mjs` (T-05) |
| 58 | Teléfonos | Prospecto con teléfono **emoji** (`"📞📞"`) | Se guarda el emoji. WhatsApp sí lo frena ("Teléfono inválido"). | Validar al guardar | BAJA | `03-telefonos.mjs` (T-07) |
| 59 | Teléfonos | Prospecto con teléfono `"878-123-4567"` | Se guarda con guiones (normaliza bien para WhatsApp). | — | BAJA | `03-telefonos.mjs` (T-08) |
| 60 | Tareas | Tarea con **descripción de 5,000 caracteres** | Se guarda completa. | Tope de longitud | BAJA | `04-tareas.mjs` (R-07) |
| 61 | Fechas | Participación con `fechaRegistro = "2027-02-31"` (fecha inexistente) | Se guarda tal cual desde el motor. | Rechazo / normalización | BAJA | `02-fechas.mjs` (F-14) |
| 62 | Campañas | Campaña con **etapas sin id** (`etapas` propias sin `id`) | `crearCampania` las guarda sin id; quedan inservibles para el flujo (participaciones con `etapaId` indefinido). | Generar id cuando falta | BAJA | `09-campanias.mjs` (A-03), `09b-diagnostico.mjs` |
| 63 | Integridad | **Borrar un cliente con contrato de $25,000 y $2,000 pagados** | El cuadre sigue bien y el cliente en papelera conserva 1 contrato y sus 2 pagos (recuperable), pero **$2,000 desaparecen de Informes** sin que el aviso lo diga. | Avisar del dinero que sale de los informes | BAJA (por ser recuperable) | `11-integridad.mjs` (I-04) |

### ROTO (excepciones de JavaScript) — resumen

| # | Ataque | Excepción exacta | Estado del dato |
|---|--------|------------------|-----------------|
| R1 | Anular un pago (`G-11`) | `Uncaught TypeError: Cannot set properties of null (setting 'innerHTML')` | Mutado en memoria, **no persistido**; el pago revive al recargar |
| R2 | Confirmar un cargo por encima del límite (`G-13`, `G-16`) | `Uncaught TypeError: Cannot set properties of null (setting 'value')` | El cargo **se pierde** y el formulario del contrato queda destruido |
| R3 | Anular un cargo (`G-15`) | `Uncaught TypeError: Cannot set properties of null (setting 'innerHTML')` | Igual que R1 |
| R4 | Prospecto del motor de campañas en vista de lista (`P-15`) | `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` (línea 4512) | La lista se queda con el contenido anterior, sin aviso al usuario |

**Causa raíz común de R1–R3:** `abrirModal()` reemplaza `#modal-body` **completo**. Al abrir el modal de anulación o el de confirmación financiera **desde dentro del formulario del contrato**, ese formulario deja de existir; cuando el manejador continúa (`renderizarPagos()`, `renderizarCargos()`, `el('cargo-descripcion').value = ''`) encuentra `null` y revienta. Además `window.PDA.eliminarMovimientoContrato` **nunca llama a `guardarDatos()` ni a `marcarSucia()`**.

### DUPLICA (se creó dos veces) — resumen

| # | Ataque | Resultado |
|---|--------|-----------|
| D1 | Doble envío en prospecto (`D-01`, `D-02`) | 2 prospectos |
| D2 | Doble envío en tarea (`R-02`, `R-03`, `D-03`) | 2 tareas |
| D3 | Doble envío en cliente (`C-07`, `D-04`) | 2 clientes (la bandera `guardando` no lo evita) |
| D4 | Doble envío en contrato (`D-05`) | 2 contratos de $25,000 |
| D5 | **Reenviar el formulario de contrato ya cerrado** (`D-11`) | `cerrarModal()` **no limpia `#modal-body`**: el `form-contrato` sigue vivo en el DOM después de guardar y cerrarse. Un segundo envío del mismo formulario crea **otro contrato** (1 → 2 con el mismo festejado; 4 → 6 en total) |

---

## 3. Lo que NO se rompió (candados que sí funcionan)

Lista corta de los 60 ataques que la app rechazó con mensaje claro:

**Fechas**
1. Contrato con fecha `1900-01-01`, `9999-12-31`, vacía o `2027-02-31` → "La fecha del evento no es válida." / "Faltan campos obligatorios". (F-07, F-08, F-10, F-11)
2. Contrato **nuevo** con fecha en el pasado (`2020-05-05`) → "La fecha del evento no puede estar en el pasado para un contrato nuevo." (F-09)
3. Tarea con fecha escrita a mano `31/02/2027`, `2027-02-31`, `0000-00-00` o vacía → el `<input type=date>` deja el campo vacío y la app responde "Campos obligatorios faltantes". (F-03, F-04, F-05, F-06)

**Teléfonos**
4. WhatsApp con teléfono que no tiene ni un dígito (emoji) → "Teléfono inválido" y no abre nada. (T-13)

**Tareas**
5. Tarea con tipo fuera del catálogo (`"Invitación a la luna"`) → el `select` no lo acepta y la app responde "Campos obligatorios faltantes". (R-06)
6. Editar / completar / borrar una tarea con id inexistente → ninguna excepción. (R-08)
7. Tarea con fecha vacía → rechazo. (R-09)
8. Completar dos veces la misma tarea → la segunda la reabre, **pero la app avisa** ("Tarea reabierta"). Es un interruptor con aviso. (R-04)

**Prospectos**
9. Nombre vacío o de solo espacios → "Campos obligatorios faltantes". (P-01, P-02)
10. `<script>` y `<img onerror>` escritos **en el formulario** → `sanearCamposFormulario` borra `< > " ' \`` y no queda HTML en el DOM. (P-04)
11. Fase fuera del catálogo → rechazo. (P-06)
12. Correo sin formato → "El correo no tiene un formato válido." (P-07)
13. Convertir el mismo prospecto a cliente dos veces → la segunda llamada no crea nada (sale en silencio, sin duplicar). (P-08)

**Clientes**
14. Cliente con nombre vacío por **clic real** (`requestSubmit`) → el navegador frena el `required`. (C-05)
15. Cliente eliminado → el prospecto que lo apuntaba queda con `clienteId = null` (sin referencias colgadas). (C-10)
16. La ruta de la vista de lista al eliminar un cliente sí dice "1 contratos · 0 tareas vinculadas". (C-12)

**Contratos (lo mejor protegido)**
17. Contrato sin cliente → "Selecciona un cliente". (K-01)
18. Contrato con cliente inexistente → "Cliente no encontrado". (K-02)
19. Contrato sin festejado / sin fecha / sin estado → "Faltan campos obligatorios: festejado, fecha del evento o estado." (K-03)
20. Contrato sin paquete seleccionado → "Selecciona un paquete". (K-04)
21. **Descuento mayor al total** ($99,000 sobre $25,000) → modal "No se registró nada… Un descuento así dejaría el importe a pagar en negativo." (K-07)
22. **Descuento negativo** ($-5,000) → "El descuento debe ser mayor que cero." (K-08)
23. **Editar un contrato NO pierde los pagos**: festejado editado, 2 pagos antes y 2 después, $8,000 antes y después, `precioBase` intacto. (K-10)
24. **Cambiar el paquete en la edición** recalcula (`$25,000 → $17,000`) y **conserva los 2 pagos**; el saldo queda correcto ($17,000 − $8,000 = $9,000). (K-11)
25. La igualdad `saldo = total − pagos` se cumple siempre tras editar. (K-13)
26. Monto con letras (`"mil"`) en el contrato → el `<input type=number>` lo rechaza y el código además bloquea montos no finitos. (K-14)
27. **Eliminar un paquete con 4 contratos vinculados** → "Este paquete tiene 4 contratos vinculados…" y el paquete sigue existiendo. (K-15)

**Pagos y cargos (los montos están muy bien protegidos)**
28. **Pago mayor al saldo** ($99,999 sobre un saldo de $25,000) → aviso exacto ("El pago excede el saldo pendiente en $74,999"), **confirmación explícita**, y el pago queda con `aceptadoConAviso=true` y un registro en el historial "CONFIRMADO CON AVISO". El saldo queda a favor del cliente y se marca la alerta `pago_excedido`. (G-01)
29. Pago negativo (`-500`) → "El monto del pago debe ser mayor que cero." (G-02)
30. Pago en cero → rechazo. (G-03)
31. Pago con letras `"mil"` → rechazo. (G-04)
32. Pago `"1,000.50"` → rechazo. (G-05)
33. Pago `"1.000,50"` → rechazo. (G-06)
34. **Doble clic en «Registrar pago»** ($1,000) → **solo 1 pago**: el segundo envío se detiene en el aviso de monto repetido. (G-07, D-06)
35. Segundo pago por el mismo monto con calma → confirmación explícita. (G-08)
36. Cargo sin descripción → "Ingresa una descripción del cargo". (G-09)
37. Cargo negativo (`-800`) → "El monto del cargo debe ser mayor que cero." (G-10)
38. Cargo absurdo ($9,999,999) → aviso + confirmación (el problema es lo que pasa *después* de confirmar: ver G-13/G-16).

**Campañas**
39. Agregar el **mismo prospecto dos veces** a la misma campaña → `codigo: duplicado` con mensaje claro. (A-07)
40. Agregar participantes a una campaña **en borrador** → `campania-no-activa` con mensaje claro. (A-08)
41. **Activar** una campaña con etapas sin inicial → rechazado por `validarCampania`. (A-12)
42. `motor.eliminarProspecto` con participaciones → rechazado. (A-13)

**Concurrencia**
43. `alternarCompletarTarea` + `eliminarTarea` inmediata → sin excepciones, la tarea queda en papelera. (D-07)
44. **Importar dos veces el mismo texto** → la 2ª vez detecta `repetidas` y crea 0. El importador tiene firmas de fila y detección de duplicados por teléfono/nombre. (D-08)
45. Flujo en ráfaga cliente → contrato → pago: **los totales cuadran** y no aparecen problemas de integridad. (D-09)

**Integridad**
46. **La comprobación final cuadra**: `suma de pagos por contrato = totalPagos reportado` ($8,234.56 a mano = $8,234.56 reportado), `saldo = total − pagos` ($16,765.44 exacto) y **0 fallos de cuadre** en toda la base. (I-07)
47. Convertir un prospecto y luego borrar ese cliente → el prospecto queda con `clienteId = null`. (I-05)

---

## 4. Riesgo para clientes, contratos y pagos

Esto es lo que le importa a Jorge, en orden de riesgo:

1. **Se puede cobrar dos veces sin darse cuenta.** Doble clic en «Guardar Contrato» crea **dos contratos idénticos** (D-05) y dos contratos iguales para el mismo festejado se aceptan con calma (K-06). Con un contrato de $25,000 eso son $25,000 fantasma en Informes o un cliente al que se le cobra dos veces.
2. **Anular un pago no funciona.** El botón de basura del pago lanza una excepción, no guarda nada, no deja rastro en el historial y **el pago reaparece al recargar** (G-11). Si un practicante anula un pago mal capturado, cree que lo resolvió y los totales vuelven a estar mal en cuanto se recarga la app. Lo mismo con los cargos (G-15). **Este es el hallazgo más peligroso para el dinero**, porque da una falsa sensación de corrección.
3. **Confirmar un cargo grande pierde el cargo y destruye el formulario.** Al aceptar el aviso de "cargo por un monto alto", el código revienta, el cargo no se guarda y el contrato en pantalla desaparece: si el practicante había llenado datos, los pierde (G-13, G-16).
4. **Se pueden borrar $8,000 sin que nadie avise.** El aviso de eliminar cliente (vista de mosaico, la de por defecto) no menciona contratos ni pagos; el cliente con su contrato y sus pagos se va a la papelera (recuperable 30 días) y **esos $2,000–$8,000 desaparecen de Informes** (C-09, I-04).
5. **El dinero se puede capturar mal y quedar así.** Pagos/cargos **dentro** del formulario de contrato dicen "Pago agregado" y no se guardan si cierras sin pulsar «Guardar Contrato» (G-12) — el practicante cree que registró un anticipo que no existe.
6. **Los contratos de $0 se guardan sin decir nada** (K-09) y **al editar se puede poner la fecha del evento en el pasado** (K-12): los informes por fecha pueden quedar mal.
7. **Los teléfonos no tienen ningún candado** (14 de 15 ataques). El caso más visible: la app abre WhatsApp a `wa.me/1` o a `wa.me/521111111111` y dice "Abriendo WhatsApp" con toda tranquilidad. Con clientes basura el botón de WhatsApp deja de servir y nadie sabe por qué.
8. **Los clientes se pueden duplicar y quedar vacíos**: dos clientes con el mismo teléfono o el mismo nombre, clientes con nombre en blanco y contratos colgando de ellos (C-01, C-02, C-04, C-11). Después los informes cuentan clientes de más.
9. **Un archivo importado puede ejecutar código en el navegador de Jorge.** Un CSV/XLSX de Google Forms con `<img src=x onerror=…>` en la columna de nombre se guarda tal cual y **se ejecuta** al ver la lista o la ficha (P-11, P-12). Con IndexedDB + sesión abierta, eso es un riesgo real, no teórico.
10. **Un prospecto creado desde Campañas rompe la pantalla de Prospectos** (P-15): el practicante ve la lista vieja y cree que su prospecto no se guardó.
11. **Borrar prospectos deja las campañas con fantasmas** (I-01): las participaciones siguen contando en los tableros de la campaña aunque el prospecto ya no exista.
12. **Lo bueno, para que se conserve:** los candados de importe (negativo, cero, letras, mayor al saldo, descuento excesivo) y la edición de contratos sin perder pagos funcionan bien; el importador detecta duplicados; la validación de campañas del asistente es sólida. **El problema no es lo que valida, es dónde no lo llama.**

---

## 5. Notas de método y límites (lo que NO se pudo probar)

* **Ataques con `dispatchEvent` vs clic real:** los casos donde la diferencia importa se probaron con los dos métodos y se anotó. En particular el CRUD de clientes **no valida nada en el código** (C-04 sí entra con `dispatchEvent`, C-05 no entra con `requestSubmit`). Los dobles envíos se probaron también con dos `requestSubmit()` (lo que hace un dedo rápido) y **también duplican** (D-02, R-03).
* **Un ataque con `dispatchEvent` es un ataque válido** (equivale a pegado/autocompletado) y así está marcado en el detalle de cada resultado.
* **Montos con letras y formatos raros:** no se pueden teclear en un `<input type=number>`; los probé igual (asignando el valor por JS) y el resultado es que el navegador deja el campo vacío y **además** el código bloquea montos no finitos. Quedan como CANDADO OK con doble candado, no como hueco.
* **Pago con fecha inválida o anterior al contrato: NO PROBADO** porque **no existe campo de fecha** en el pago (ni en `#form-pago-rapido` ni en `#contrato-nuevo-pago`): `crearMovimientoFinanciero` pone `fecha = ahora`. Lo mismo para "fecha futura". No es un hueco explotable desde la interfaz, pero tampoco hay forma de corregir una fecha mal puesta.
* **"Tarea con fecha inválida"** no se puede inyectar por el campo de fecha (el navegador lo vacía), pero **sí** se pueden guardar años absurdos (`1900`, `9999`), que es el hueco real (F-01, F-02).
* **Campañas:** los huecos A-01…A-11 se alcanzan llamando al **motor** (`App.motor.crearCampania` / `actualizarCampania`), que es exactamente lo que llama el asistente **después** de validar. Por eso, hoy, un practicante usando el asistente **no** los provoca; los provoca cualquier otro camino (importación, código futuro, o el propio motor si alguien lo llama sin validar). El daño es basura en la base y campañas que no se pueden activar. Se reportan como HUECO del motor, no del asistente.
* **Concurrencia real con dos usuarios:** no se probó (la caja es local y sin nube, y no hay que tocarla). Lo probado es el doble envío en el mismo navegador.
* **No se probó**: la papelera/restauración a 30 días, la sincronización con Firebase (bloqueada a propósito), Google Calendar, impresión, comprobantes y respaldos. No son parte de las 10 familias.
* **`index.html` sigue intacto** y la caja quedó aislada en las 11 corridas (`revisarAislamiento().aislado === true`, `fugasDatos = []`).

---

## 6. Archivos de esta auditoría

| Archivo | Qué es |
|---------|--------|
| `comun.mjs` | Arnés: abre la caja, instrumenta avisos y errores de JS, siembra paquetes/clientes base y ejecuta los ataques |
| `00-humo.mjs` | Control de que el arnés funciona (1 ataque, CANDADO OK) |
| `01-sondeo.mjs` | Sondeo previo (motor vs arreglos globales, persistencia, anulación, importador) |
| `02-fechas.mjs` … `11-integridad.mjs` | Un script por familia (los 129 ataques) |
| `09b-diagnostico.mjs` | Diagnóstico de la contradicción A-03/A-08 del motor de campañas |
| `99-resumen.mjs` | Junta todo y saca los conteos (`resumen.txt`, `resumen.json`) |
| `resultados\<familia>.json` | Detalle completo por ataque: dato, avisos de la app, errores JS, evidencia y estado del almacén antes/después |
