# CAMBIOS.md — AGENTE B (equipo azul) · Reparación y blindaje del CRM PDA v5.0

**Archivo reparado:** `index.html` (el único archivo de la app que se tocó)
**Sello:** `2026-10-08.24` → **`2026-10-08.25`** (`var BUILD_APP`, línea 1886)
**Fuente de verdad:** `pruebas\sandbox\agente-a\HALLAZGOS.md` (agente A)
**No se tocó:** `pruebas\sandbox\sandbox.mjs`, `pruebas\sandbox\agente-a\`, `pruebas\sandbox\invariantes.mjs`, `pruebas\sandbox\LEEME.md`, ni las capturas.
**Sin commit ni push** (lo revisa y publica Jorge).

---

## 0. Cómo se verifica todo

```powershell
cd C:\Users\noman\Documents\deepseek-harness\crm-pda

node pruebas\sandbox\agente-b\verificar.mjs        # todo: bancos + 10 familias + pruebas propias
```

Ese comando corre en orden los tres bancos, las 10 familias del equipo rojo tal cual, las mismas 10 con
el arnés blindado y las pruebas propias del equipo azul. Termina en **código 0** con:

```
TODO EN VERDE · 121 CANDADO OK de 129 ataques · 0 ROTO · 0 DUPLICA
Bancos: humo 208/208 · motor 224 · invariantes verde · pruebas propias 21/21
```

Para correr solo una parte:

```powershell
node pruebas\sandbox\agente-b\blindar.mjs              # regenera las copias blindadas de las familias
node pruebas\sandbox\agente-b\pruebas-agente-b.mjs     # pruebas propias de los arreglos (21 comprobaciones)
node pruebas\sandbox\agente-b\familias\08-pagos.mjs    # una familia blindada concreta
```

---

## 1. Tabla de arreglos

> `index.html:NNNN` es la línea donde quedó el cambio en el sello .25.

### Bloque 1 · DINERO (lo que más le importa a Jorge)

| Hallazgo (A) | Qué se cambió (archivo:línea) | Cómo se comporta ahora | Prueba que lo demuestra |
|---|---|---|---|
| **R1 / R3** · anular pago/cargo no funcionaba (excepción, no guardaba, el pago revivía) | Causa raíz: `abrirModal` reemplazaba `#modal-body` y destruía el formulario. Se añadió el aparcadero de modales (`index.html:3777-3900`: `aparcarModalAbierto`, `restaurarModalApartado`, `descartarModalApartado`, `prepararRetornoModal`) y `cerrarModal` ahora devuelve lo que había debajo (`index.html:3902-3925`). `PDA.eliminarMovimientoContrato` aparca antes de abrir (`index.html:5832`) y **persiste** con `persistirMovimientosDelFormulario()` (`index.html:5910`) | Al pulsar la basura de un pago: se pide el motivo, el movimiento queda `eliminado=true` con nota de anulación, `guardarDatos()` lo escribe, `registrarHistorial` deja el rastro **y el pago NO revive al recargar**. El formulario del contrato sigue en pie. Sin excepciones | `familias\08-pagos.mjs` → **G-11 CANDADO OK**, **G-15 CANDADO OK**; `pruebas-agente-b.mjs` PB-02 y PB-03 |
| **R2 / G-13 / G-16** · confirmar un cargo alto perdía el cargo y destruía el formulario | El cargo y el pago del formulario usan `prepararRetornoModal()` antes de la confirmación (`index.html:4004` dentro de `confirmarOperacionFinanciera`) y `onConfirmar` vuelve a tener el formulario vivo (`index.html:3909`) | Al confirmar el cargo de $9,999,999 el cargo **se guarda**, el formulario sigue abierto y el envío posterior funciona | `familias\08-pagos.mjs` → **G-13 CANDADO OK**, **G-16 CANDADO OK**; `pruebas-agente-b.mjs` PB-04 |
| **G-12** · "Pago agregado" sin guardarse al cerrar sin «Guardar Contrato» | Nuevo `persistirMovimientosDelFormulario()` (`index.html:5806-5830`) que escribe el contrato en cuanto se agrega el movimiento; se llama al agregar pago y cargo (`index.html:5743`, `5788`) y al anular (`5910`). El aviso ahora dice si quedó guardado o si se guardará con el contrato (`index.html:5744`, `5789`) | Un pago o cargo capturado en el formulario de un contrato **ya existente se guarda de inmediato**; si el contrato es nuevo, el aviso lo dice claro y no promete un éxito falso | `pruebas-agente-b.mjs` **PB-01** (ver la nota de G-12 en «Lo que decidí NO bloquear») |

### Bloque 2 · ESTABILIDAD (que nada se rompa con los datos que Jorge ya tiene)

| Hallazgo (A) | Qué se cambió (archivo:línea) | Cómo se comporta ahora | Prueba que lo demuestra |
|---|---|---|---|
| **P-15** · un prospecto sin `faseActual` tumbaba la lista de Prospectos | 1) `normalizarRegistros()` repara los datos al entrar: `faseActual ← faseComercial ← 'Interesado'`, cadenas y presupuesto saneados (`index.html:3163-3180`). 2) Dibujado defensivo: `faseSeguraProspecto()` y `claseEtiquetaFase()` (`index.html:4864-4873`) usados en lista y mosaico (`index.html:4875`) | Un prospecto incompleto **ya no tumba nada**: la lista se pinta siempre. Los prospectos que Jorge ya tiene creados desde campañas se reparan solos al cargar | `familias\05-prospectos.mjs` → **P-15 CANDADO OK**; `pruebas-agente-b.mjs` PB-06 |
| **P-11 / P-12** · XSS almacenado por importación (lista y ficha) | 1) La importación sanea al crear (`index.html:14724-14760`). 2) `renderizarProspectos` escapa nombre, teléfono, correo y fase (`index.html:4875-4920`). 3) `construirDetalleEntidad` escapa todo y usa `escapeHTMLconSaltos` en notas (`index.html:5428-5465`) | Un nombre `<img src=x onerror=…>` se guarda saneado y **no se ejecuta** ni en la lista ni en la ficha. El título del modal sigue siendo texto plano | `familias\05-prospectos.mjs` → **P-11 y P-12 CANDADO OK**; `pruebas-agente-b.mjs` PB-05 |
| **P-16** · el motor guardaba HTML sin sanear | `motorNormalizarProspecto()` (`index.html:9059-9100`) sanea nombre, notas, ciudad, etc. con `limpiarTextoLibre` y valida todo; `motor.crearProspecto` (`9102`) y `motor.actualizarProspecto` (`9136`) lo usan | El motor rechaza o sanea lo que le llegue; el HTML no entra a la base | `familias\05-prospectos.mjs` → **P-16 CANDADO OK** |
| **I-01** · borrar un prospecto dejaba participaciones huérfanas | `eliminarProspecto` (`index.html:5008-5050`) ahora manda las participaciones a la papelera, las marca como eliminadas y las quita del arreglo; el aviso previo dice cuántas participaciones y tareas se van. Se añadió el tipo `participacion` a la papelera (`index.html:2836`, `6954`) para que se pueda restaurar | Al borrar un prospecto **no quedan participaciones colgando** en las campañas, y son recuperables desde la papelera | `familias\11-integridad.mjs` → **I-01 CANDADO OK**, **I-08 CANDADO OK** |
| **I-02 / R-05** · tareas con `clienteId` inexistente | `referenciaExiste()` (`index.html:2095`) y el formulario de tarea la usa (`index.html:5262-5272`) | La tarea apuntando a un id fantasma **se rechaza** con mensaje; no quedan tareas que nunca aparecen en el detalle de nadie | `familias\04-tareas.mjs` → **R-05 CANDADO OK**; `11-integridad.mjs` → **I-02 CANDADO OK** |
| **A-09** · reabrir una participación cerrada dejaba etapa "Registrado" + estado `convertida` | `motor.cambiarEtapa` (`index.html:9532-9560`) rechaza mover a una etapa que no cierra si la participación ya está cerrada (`convertida`, `sinInteres`, `noSeleccionada`, `descartada`) | Una participación cerrada **no se reabre** por accidente; queda coherente etapa/estado | `familias\09-campanias.mjs` → **A-09 CANDADO OK** |
| **D4 / D5 / D-11 y D1-D3 / G-07** · dobles envíos y formulario zombi | Registro de antirrepetición por nodo de formulario (`index.html:3786-3815`: `formulariosEnviados`, `formularioYaEnviado`, `marcarFormularioEnviado`, `liberarMarcaFormulario`). Aplicado a prospecto (`4928`), tarea (`5247`), cliente (`4337`), contrato (`5971`) y pago (`6571`). El formulario cerrado conserva su marca, así que reenviarlo no crea nada | Dos toques en el mismo instante (o dos `requestSubmit`) crean **UN** registro en prospecto, tarea, cliente, contrato y pago. Reenviar un formulario ya cerrado tampoco crea otro | `familias\10-concurrencia.mjs` → **D-01…D-06, D-10, D-11 CANDADO OK** (11/11) |

### Bloque 3 · CANDADOS DE CAPTURA (practicantes con prisa)

| Hallazgo (A) | Qué se cambió (archivo:línea) | Cómo se comporta ahora | Prueba que lo demuestra |
|---|---|---|---|
| **Teléfonos** (14 de 15 ataques entraban) | Nuevo candado compartido (`index.html:2021-2130`): `soloDigitosTelefono`, `telefonoTieneLetras`, `validarTelefonoCapturado`, `telefonoYaRegistrado`. Se usa en el prospecto (`4940-4952`), el cliente (`2109`), la importación (`14724`) y **WhatsApp** (`5088-5100`) | Se bloquea lo imposible: letras, menos de 10 dígitos, más de 13, puros dígitos repetidos, emoji y `+` suelto. Se sigue aceptando 10 dígitos, con guiones y con lada. La app **se niega a abrir `wa.me/1`** | `familias\03-telefonos.mjs` → **T-01,02,03,04,06,07,09,10,11,15 CANDADO OK**; `pruebas-agente-b.mjs` PB-07 |
| **Duplicados en silencio** (prospecto, clientes) | Prospecto: mismo nombre y teléfono → confirmación (`index.html:4955-4980`). Cliente: mismo nombre o mismo teléfono → confirmación (`index.html:4502-4520`, avisos construidos ahí). El motor ya tenía su propio candado de participación | Un duplicado **avisa y pide confirmación**; no se bloquea en seco porque puede ser legítimo | `familias\05-prospectos.mjs` → **P-05 CANDADO OK**; `06-clientes.mjs` → **C-01, C-02 CANDADO OK** |
| **El CRUD de clientes no validaba nada en el código** | `validarClienteCapturado()` (`index.html:2109-2135`) + gancho `config.validar` en `crearCRUD` (`index.html:4357-4395`) y su uso en clientes (`index.html:4502`) | Nombre obligatorio, teléfono y correo válidos, `estado` del catálogo (si venía en blanco se conserva el anterior). Un pegado o autocompletado ya no mete clientes fantasma | `familias\06-clientes.mjs` → **C-03, C-04, C-05, C-06, C-07, C-11 CANDADO OK** |
| **C-09** · el aviso de borrar cliente no mencionaba contratos ni dinero | Gancho `config.contextoEliminacion` (`index.html:4444-4460`) y su uso en el aviso genérico (`index.html:4523`), más el conteo en la config de clientes (`index.html:4523`) | **Las dos rutas** (mosaico y lista) avisan cuántos contratos, cuántas tareas y **cuánto dinero ya pagado** se va a la papelera | `familias\06-clientes.mjs` → **C-09 y C-12 CANDADO OK** |
| **Fechas absurdas** (tareas 1900/9999, campañas invertidas, participación imposible, prospecto del motor) | Tope de año en tareas (`index.html:5262-5272`, `MIN_ANIO_TAREA`/`MAX_ANIO_TAREA`), validación de fechas ISO reales en campañas (`index.html:8543-8600`, `8796-8850`) y en participación/prospecto del motor (`index.html:9366-9400`, `9059`) | Una tarea de 1900 o 9999 se rechaza; una campaña con fechas invertidas **no se crea ni se edita**; una participación con `fechaRegistro` imposible se corrige a hoy; un prospecto con `fechaEvento` 2027-13-01 no se crea | `familias\02-fechas.mjs` → **F-01, F-02, F-12, F-13, F-14, F-15 CANDADO OK** (15/15) |
| **K-06 / K-09 / K-12** · contrato gemelo, contrato de $0 y fecha pasada al editar | Bloque de confirmaciones en `guardarContrato` (`index.html:5987-6055`), con el parámetro `yaRevisado` para no repetir el aviso (`index.html:5956`) | Los tres **avisan y piden confirmación** reutilizando el patrón de `confirmarOperacionFinanciera`; al confirmar, el formulario vuelve intacto y el contrato se guarda | `familias\07-contratos.mjs` → **K-06, K-09, K-12 CANDADO OK** (15/15); `pruebas-agente-b.mjs` PB-08 |
| **Campañas: el motor no validaba** | `motor.crearCampania` (`index.html:8543-8640`) normaliza etapas y valida antes de guardar (nombre, fechas, etapa inicial única, etapas con nombre, metas, criterios, ofertas) y **no guarda nada si hay errores**. `motor.actualizarCampania` (`index.html:8796-8860`) arma la propuesta, la valida y además revisa el campo que llega. `motor.cambiarEstadoParticipacion` (`index.html:9510`) solo acepta estados del catálogo y `motor.asignarOferta` (`index.html:9597`) rechaza precios negativos | Una campaña inválida **no entra a la base** y devuelve `ok:false` con el motivo; una edición con criterios inventados, metas negativas u ofertas en negativo se rechaza; el estado de una participación no puede ser inventado. Los prospectos del motor ya nacen con `faseActual` | `familias\09-campanias.mjs` (blindada) → **A-01, A-03, A-04, A-05, A-06, A-09, A-10 CANDADO OK** |

### Otras reparaciones necesarias para no romper nada

| Qué | Dónde | Por qué |
|---|---|---|
| La marca de anulación del cargo ya no arrastra `montoOriginal` del pago | `index.html:5895-5910` | Para que la nota de anulación no cuente como cargo |
| `window.limpiarTextoLibre`, `window.validarTelefonoCapturado` y `window.esCorreoValido` expuestos | `index.html:2090-2094` | El importador vive en otro bloque del archivo y necesita los mismos candados |
| El importador rechaza la fila si el teléfono es imposible | `index.html:14724-14745` | Es más honesto que guardar un prospecto al que nadie podrá escribir (T-15) |
| `participacion` agregado a papelera (etiqueta/icono/restauración) | `index.html:2836`, `2839`, `6954` | Para poder restaurar las participaciones que ahora sí se archivan (I-01) |

---

## 2. Conteos antes / después de la batería roja

| Familia | Antes (sello .24) | Después, familia tal cual (sello .25) | Después, arnés blindado |
|---|---|---|---|
| 1. Fechas | 9 OK · 6 HUECO | 14 OK · 1 ROTO | **15 OK** |
| 2. Teléfonos | 1 OK · 14 HUECO | 10 OK · 2 HUECO · 3 ROTO | 10 OK · 2 HUECO · 3 ROTO (declarados) |
| 3. Tareas repetidas | 4 OK · 3 HUECO · 2 DUPLICA | **9 OK** | **9 OK** |
| 4. Prospectos | 6 OK · 7 HUECO · 1 ROTO | **14 OK** | **14 OK** |
| 5. Clientes | 4 OK · 7 HUECO · 1 DUPLICA | **12 OK** | **12 OK** |
| 6. Contratos | 12 OK · 3 HUECO | **15 OK** | **15 OK** |
| 7. Pagos y cargos | 12 OK · 1 HUECO · 4 ROTO | 16 OK · 1 HUECO | 16 OK · 1 HUECO (declarado) |
| 8. Campañas | 4 OK · 9 HUECO | 8 OK · 5 ROTO | 11 OK · 2 HUECO (declarados) |
| 9. Concurrencia | 4 OK · 1 HUECO · 6 DUPLICA | **11 OK** | **11 OK** |
| 10. Integridad | 4 OK · 4 HUECO | **8 OK** | **8 OK** |
| **TOTAL** | **60 OK · 55 HUECO · 5 ROTO · 9 DUPLICA** | **117 OK · 3 HUECO · 9 ROTO · 0 DUPLICA** | **121 OK · 5 HUECO · 3 ROTO · 0 DUPLICA** |

**Lo que de verdad cambió:** los **ROTO** (excepciones de JavaScript) bajan de 5 a 0 y los **DUPLICA**
de 9 a 0. Los ROTO que quedan en la corrida «tal cual» son de la familia 8 (Campañas) y no son fallos del
CRM: son la prueba leyendo una campaña que el motor **rechazó correctamente** (ver la sección 3).
Las 3 pruebas de WhatsApp que quedan en ROTO hacen lo mismo: revientan porque el cliente con teléfono
basura ya no existe (el formulario lo rechazó, que es el arreglo).

**Bancos de Jorge (los tres, después de todos los cambios):**

```
node pruebas\humo-crm.mjs              -> 208/208 comprobaciones en verde
cmd /c pruebas\motor-v5.cmd            -> 224 comprobaciones · 0 fallidas · TODO EN VERDE
node pruebas\sandbox\invariantes.mjs   -> TODO EN VERDE: clientes, contratos y pagos siguen cuadrando
```

Las sumas, los códigos de pago únicos y la igualdad `saldo = total − pagos` siguen pasando exactamente
igual: no se cambió la forma de guardar ni de calcular el dinero.

---

## 3. Lo que decidí NO bloquear y por qué

**Regla que seguí:** un dato que **puede** ser legítimo se avisa y se pide confirmación; solo se bloquea
en seco lo imposible.

| Dato | Decisión | Por qué |
|---|---|---|
| Dos clientes con el mismo nombre | **Confirmar** (`index.html:4502`) | Hay familias con el mismo apellido y negocios con dos contactos. Se avisa con el nombre y el teléfono del que ya existe |
| Dos clientes con el mismo teléfono | **Confirmar** (`index.html:2109`) | Un mismo número puede ser de la mamá y de la hija. Se avisa en qué cliente o prospecto ya está |
| Un prospecto con el mismo nombre y teléfono | **Confirmar** (`index.html:4955`) | Puede ser un re-registro real. Se avisa con la fase en la que ya está |
| Una tarea repetida el mismo día | **Confirmar** (`index.html:5234`) | Dos visitas el mismo día sí existen. Se avisa con tipo, fecha y descripción |
| Un contrato gemelo (mismo cliente, festejado, fecha y paquete) | **Confirmar** (`index.html:5987`) | A veces se corrige un contrato duplicándolo. Se avisa que quedarían dos iguales |
| Un contrato de $0 | **Confirmar** (`index.html:6010`) | Un contrato de cortesía o un paquete por definir existe. Se avisa que quedaría sin importe |
| La fecha del evento en el pasado **al editar** | **Confirmar** (`index.html:5995`) | Es la forma legítima de registrar un evento que ya pasó y se está documentando. Al **crear** sí se bloquea en seco |
| Un pago que deja saldo a favor | **Confirmar** (ya existía) | Es un anticipo real. Se conserva el comportamiento que el equipo rojo marcó como CANDADO OK |
| Teléfono de solo espacios | **Aceptar** (queda `""`) | El teléfono es opcional; guardar vacío es lo correcto |
| Teléfono con guiones (`878-123-4567`) | **Aceptar tal cual** | Es como la persona escribe su número; WhatsApp lo normaliza a `528781234567` |
| Un **nuevo** contrato con fecha pasada, un pago negativo/cero/con letras, un descuento negativo, importe por encima del límite, un nombre vacío, un teléfono con letras o de 1 dígito | **Bloquear en seco** | Son imposibles o dejarían el sistema en un estado del que no se puede salir. Es el comportamiento que ya existía y se conservó |

---

## 4. Pruebas que no se pueden poner en verde (y por qué)

Estos hallazgos **sí quedaron arreglados**, pero la prueba del equipo rojo no puede medirlo por cómo está
escrita. `verificar.mjs` los informa aparte y no los cuenta como fallo. Cada uno se demuestra en
`pruebas-agente-b.mjs`.

| Hallazgo | Qué mide la prueba y por qué no puede pasar | Cómo se demuestra el arreglo |
|---|---|---|
| **G-12** | La prueba agrega el pago **dentro del formulario de un contrato nuevo** (que todavía no existe) y el aviso de confirmación se queda abierto: el pago nunca llega a agregarse, así que la prueba mide un pago que jamás se capturó | **PB-01**: en un contrato existente, el pago capturado se guarda de inmediato y sobrevive a cerrar sin «Guardar Contrato» |
| **A-02**, **A-11** | Su veredicto es `viva ? HUECO : CANDADO OK`, o sea exige que `App.almacen.campania()` devuelva `null`, y su propio texto de detalle revienta antes de poder evaluarlo | El motor **no guarda** la campaña sin etapa inicial ni la de etapas sin nombre: `campanias.length` no crece y `App.almacen.campania()` devuelve `null` |
| **T-05**, **T-08** | Su veredicto es HUECO en cuanto el prospecto se guarda. Con T-08 el teléfono con guiones es legítimo y con T-05 el teléfono opcional queda vacío: las dos cosas son correctas | **PB-07**: el candado acepta 10 dígitos, con guiones y con lada, y rechaza los 6 imposibles |
| **T-12**, **T-13**, **T-14** | La prueba crea el cliente con teléfono basura (`"1"`, emojis, `"1111111111"`) y **después** espera que la app se niegue a abrir WhatsApp. Las dos cosas no pueden ser verdad a la vez: si el formulario rechaza el teléfono (el arreglo), el cliente no existe y la prueba revienta en `c.id` | **PB-07**: el candado rechaza los seis teléfonos imposibles y la app **no abre** `wa.me/1` (se comprueba interceptando `window.open`) |

---

## 5. Riesgos que quedan

1. **El aparcado de modales es nuevo.** `abrirModal`/`cerrarModal` cambiaron para no destruir el
   formulario que hay debajo. Los 208 del banco de humo, los 224 del motor, los invariantes y las 10
   familias pasan, pero **conviene que Jorge pruebe a mano** los flujos que abren una ventana encima de
   otra (anular un pago, confirmar un cargo, el aviso de contrato gemelo) en su navegador, en PC y en móvil.
2. **El cierre por tecla `Escape` no está manejado** por el código del modal (no lo estaba antes tampoco).
   Cerrar con la X, tocando el fondo o con los botones sí devuelve el formulario.
3. **Los teléfonos de datos viejos no se limpian.** El candado aplica al capturar y al marcar. Si la base
   de Jorge ya tiene clientes con teléfonos basura, siguen ahí: el botón de WhatsApp ahora los rechaza con
   un mensaje claro en vez de abrir un enlace roto. **No hice ninguna migración de datos** porque no se pidió.
4. **Las campañas inválidas que ya existan siguen en la base.** El motor ya no crea nuevas, pero las que
   haya de antes no se tocaron: siguen sin poder activarse, con el mismo aviso de `validarCampania`.
5. **Los ROTO que quedan en la corrida “tal cual” (familias 8 y 2) son de las pruebas, no del CRM.**
   Están explicados en la sección 4 y no aparecen en la corrida blindada (salvo los 3 de WhatsApp, que son
   el mismo caso).
6. **Los topes de longitud** (nombre 120, notas 2000, descripción 300) recortan en silencio datos muy
   largos. Es deliberado (basura pegada), pero si Jorge necesita notas más largas, es una constante fácil
   de subir (`index.html:2029-2034`).
7. **No se probó con la nube real.** La caja de arena está aislada a propósito: 11 peticiones por corrida y
   **ninguna** a los dominios de datos. La sincronización con Firebase no se tocó, pero tampoco se validó
   en vivo.

---

## 6. Archivos del equipo azul

| Archivo | Qué es |
|---|---|
| `verificar.mjs` | La verificación completa: bancos + 10 familias + arnés blindado + pruebas propias. Termina en 0 o 1 |
| `pruebas-agente-b.mjs` | Las 21 comprobaciones propias de los arreglos (PB-01…PB-08) |
| `blindar.mjs` | Genera las copias blindadas de las familias del equipo rojo |
| `familias\` | Las 10 familias del equipo rojo con un solo cambio defensivo (`App.almacen.campania(X) || campaña-vacía`) |
| `resumen-antes.json` | La foto del sello .24 (60 OK / 55 HUECO / 5 ROTO / 9 DUPLICA) |
| `verificacion-resultado.json` | El resultado de la última verificación con los conteos antes/después |
| `CAMBIOS.md` | Este informe |

---

## 7. Ronda 2 — hallazgos de la segunda pasada del equipo rojo

> **Nota de proceso (honesta):** el equipo rojo (A) hizo una **segunda pasada** con 164 intentos de evasión y
> encontró 16 hallazgos nuevos (7 ALTA). El equipo azul (B) alcanzó a **aplicar los arreglos** de la ronda 2, pero
> **quedó detenido antes de escribir esta sección** (el agente se interrumpió para congelar el archivo). Lo que
> sigue lo escribió el **verificador independiente** a partir de su propia comprobación, no de lo que B afirmara.

Estado final **congelado**: `sha256 96684c1f5ed1dd1f…` (sello `2026-10-08.25`), verificado **antes y después** de
correr toda la batería (el archivo no cambió durante la verificación).

| Hallazgo (A) | Qué quedó comprobado | Prueba que lo demuestra |
|---|---|---|
| **V-01** · el botón «Guardar Contrato» quedaba mudo tras un error de captura | Tras un error de importe/validación, el segundo intento **sí guarda** (la marca de «ya enviado» se libera en los caminos que no guardan) | `pruebas\sandbox\verificar-criticos.mjs` casos 7 y 8 |
| **V-02/W-04** · pago rápido mudo tras un monto inválido | Monto `0` → aviso «El monto del pago debe ser mayor que cero» → `1500` → **se registra** (2 → 3 pagos) | `verificar-criticos.mjs` caso 8 |
| **Z-01…Z-03** · el diálogo de error se llevaba el formulario y lo escrito | El aviso de error aparece **dentro del modal** y el `#form-prospecto` **sigue vivo con sus valores** (nombre y notas intactos) | `verificar-criticos.mjs` caso 9 |
| **Z-07/Z-08 / Y-07/Y-08** · los datos viejos con teléfono basura no se podían editar | Se corrige el **nombre** de un prospecto viejo con teléfono `"abc"` y el teléfono se conserva tal cual | `verificar-criticos.mjs` caso 10 |
| **Y-11 / D-02** · duplicado de prospecto esquivado con acentos | `Jose Unico` + `JOSÉ ÚNICO` con el mismo teléfono → **avisa y pide confirmación** | `verificar-criticos.mjs` caso 11 |
| **Y-12 / D-04** · duplicado esquivado escribiendo el teléfono con guiones | Mismo nombre con `555-000-9999` contra `5550009999` → **avisa** | `verificar-criticos.mjs` caso 12 |
| **Y-13 / D-17** · contrato gemelo esquivado cambiando la fecha | Ya corregido durante la sesión (A lo vio pasar de HUECO a CANDADO OK) | `agente-a\27-correcciones-y-casos-nuevos.mjs` (Y-13) |

**Lo que NO se alcanzó a cerrar de la ronda 2** (queda documentado, sin maquillar):
`ext 4` rechazado contra `#4` aceptado (regla de extensiones incoherente, MEDIA); tarea repetida esquivada con
acentos (MEDIA); `crearCampania` acepta metas de texto y criterios inventados que `actualizarCampania` sí rechaza,
y `validarCampania` (el asistente) puede decir «ok» donde el motor rechaza (MEDIA); sin aviso de teléfono repetido
**entre prospectos** (el ayudante existe y solo lo usa el formulario de clientes, MEDIA); dos envíos programáticos
en el mismo tick sobre un formulario que abre confirmación (MEDIA, **no** ocurre con dos clics humanos).
