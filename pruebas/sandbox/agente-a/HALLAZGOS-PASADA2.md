# HALLAZGOS — PASADA 2 (verificación adversarial) · AGENTE A

**Qué es esto:** la segunda pasada del equipo rojo. Primero **volví a correr mis 10 familias tal cual** contra el sello `2026-10-08.25` para ver qué quedó; después **atacé a propósito los candados nuevos** con **164 intentos de evasión** para ver si se pueden burlar. No arreglé nada: solo encontré, demostré y documenté. La caja de arena es obligatoria y se usó siempre.

---

## 0. AVISO IMPORTANTE: `index.html` cambió SOLO, varias veces, durante esta pasada

Me dijeron que auditara el sha256 `6a097ae2d5d83b1295e0401fd8c04152948d6de952ac33cbc180a24e806eed30`. **Ese archivo ya no es el que está en disco y nunca volvió a serlo.** Yo **no toqué `index.html`** (todas mis escrituras van a la copia de la caja, en `%TEMP%\crm-sandbox\`); alguien más lo estuvo editando mientras yo probaba:

| Revisión | sha256 (primeros 12) | Sello | Cuándo la vi | Qué corrí contra ella |
|---|---|---|---|---|
| H1 | `6a097ae2d5d8` | `2026-10-08.25` | al empezar (la que me indicaron) | familias originales 02–11 y evasiones 20, 21, 22 |
| H2 | `e062ca2ae747` | `2026-10-08.25` | 8-oct 21:58 (a media sesión) | 23–31 + **re-corrida completa** de las 10 familias y de 20, 21, 22, 26–29, 31 |
| H3 | `22e8216282c4` | `2026-10-08.25` | unos minutos después | no auditada |
| H4 | `f6d5c892376d` | `2026-10-08.25` | al empezar la comprobación final | 31, 28, 27 |
| H5 | `57de2252b886` | `2026-10-08.25` | al terminar esa misma comprobación (3 scripts) | — |

**El sello `BUILD_APP` nunca se subió entre estas revisiones**, así que por el sello no se puede saber qué archivo se probó: hay que usar el sha256. Cada `resultados-p2-*/<familia>.json` guarda el `sha256Fuente` exacto con el que corrió.

**Consecuencias para la verificación:**
1. La comprobación final que me pidieron (**sha256 = `6a097ae2…`**) **NO se puede confirmar**: el archivo cambió por causas ajenas a mi trabajo. Siguió cambiando **incluso mientras yo escribía este reporte**: el último hash que vi fue `1abdee734a5bf9c00d4683cb5194c9ee6109fbf1f890e462175ee085a972ae4e` (sello todavía `2026-10-08.25`). No afirmo que mis hallazgos sigan en ese último archivo: los comprobé hasta `f6d5c892` / `57de2252`.
2. **Recomendación para Jorge / el equipo azul:** congelen el archivo (o súbanle el sello, p. ej. `.26`) antes de la siguiente ronda de verificación. Con el archivo cambiando cada pocos minutos, ninguna evidencia es reproducible: el mismo script da resultados distintos según el minuto.
3. **Mis hallazgos se mantienen en las dos revisiones que sí alcancé a auditar completas (H1 y H2)**, y los volví a comprobar en H4: los cuatro más graves (contrato mudo, pago rápido mudo, diálogo que se lleva el formulario, duplicado de prospecto por acentos/guiones) **siguen presentes**. Uno de los hallazgos (contrato gemelo con fecha distinta, Y-13) **ya estaba arreglado en H4**: cambió de HUECO a CANDADO OK mientras yo probaba, lo cual es buena señal de que el equipo azul está trabajando en paralelo.

**Aislamiento de la caja (las 61 corridas de las 5 carpetas de resultados):** `aislado = true` en las 61 · **615 peticiones de red, 0 a los dominios de datos** (`firebaseio.com`, `firebaseapp.com`, `googleapis.com`) · los únicos intentos fueron al SDK (`gstatic.com`), bloqueados, por eso la app arrancó en modo local.

---

## 1. Las 10 familias, antes (.24) y ahora (.25)

| Familia | Antes `.24` (ata/OK/HUECO/ROTO/DUPLICA) | Ahora `.25` (H1 y H2, idéntico) |
|---|---|---|
| 1. Fechas | 15 / 9 / 6 / 0 / 0 | 15 / **14** / 0 / 1 / 0 |
| 2. Teléfonos | 15 / 1 / 14 / 0 / 0 | 15 / **10** / 2 / 3 / 0 |
| 3. Tareas | 9 / 4 / 3 / 0 / 2 | 9 / **9** / 0 / 0 / 0 |
| 4. Prospectos | 14 / 6 / 7 / 1 / 0 | 14 / **14** / 0 / 0 / 0 |
| 5. Clientes | 12 / 4 / 7 / 0 / 1 | 12 / **12** / 0 / 0 / 0 |
| 6. Contratos | 15 / 12 / 3 / 0 / 0 | 15 / **15** / 0 / 0 / 0 |
| 7. Pagos y cargos | 17 / 12 / 1 / 4 / 0 | 17 / **16** / 1 / 0 / 0 |
| 8. Campañas | 13 / 4 / 9 / 0 / 0 | 13 / **8** / 0 / 5 / 0 |
| 9. Concurrencia | 11 / 4 / 1 / 0 / 6 | 11 / **11** / 0 / 0 / 0 |
| 10. Integridad | 8 / 4 / 4 / 0 / 0 | 8 / **8** / 0 / 0 / 0 |
| **TOTAL** | **129 / 60 / 55 / 5 / 9** | **129 / 117 / 3 / 9 / 0** |

**Los 9 ROTO y los 3 HUECO que quedan son 12 artefactos de MIS pruebas, no del CRM.** Lo comprobé con `26-originales-corregidos.mjs`, que hace las mismas 12 comprobaciones con la aserción arreglada: **12 de 12 CANDADO OK**. Detalle uno por uno:

| Ataque original | Qué salió | Por qué es culpa de mi prueba |
|---|---|---|
| `F-12` (campaña con fechas invertidas) | ROTO: `Cannot read properties of null` | Leía `App.almacen.campania(id)` de una campaña que el motor **rechazó correctamente** (ya no está en la base). La aserción correcta es mirar la base → CANDADO OK (X-01) |
| `A-01`, `A-02`, `A-03`, `A-04`, `A-11` (campañas basura) | ROTO × 5 | Igual: leía `.nombre` / `.etapas` / `.metas` del objeto nulo de una campaña **rechazada**. Mirando la base: las 5 se rechazan → CANDADO OK (X-02…X-06) |
| `T-12`, `T-13`, `T-14` (WhatsApp con teléfono basura) | ROTO × 3: `Cannot read properties of undefined (reading 'id')` | Mi prueba creaba el cliente basura por el formulario y leía `c.id`; ahora el formulario **rechaza** ese cliente, así que `c` era `undefined`. Con un cliente de **datos viejos** (que sí existen en la base real) la app se niega a abrir WhatsApp y avisa → CANDADO OK (X-09…X-11) |
| `T-05` (teléfono de solo espacios) | HUECO | Mi expectativa estaba mal: el campo es opcional, así que guardar al prospecto **sin teléfono** es correcto (X-07) |
| `T-08` (teléfono con guiones) | HUECO | Formato legítimo: se guarda tal cual y sirve para marcar (X-08) |
| `G-12` (pago en el formulario y cerrar) | HUECO | Mi prueba usaba el formulario **ya cerrado** (un nodo zombi en el DOM). Haciéndolo en la **edición real** de un contrato existente el pago **se guarda al instante** → CANDADO OK (X-12) |

**Conclusión honesta de esta parte: en las 10 familias originales no encontré ni una regresión real.** Los 5 ROTO de la familia 8 y los 3 de la 2 son míos.

---

## 2. Hallazgos NUEVOS de la segunda pasada (evasión dirigida)

**164 intentos de evasión** en 11 scripts. Después de descartar mis propios artefactos (sección 3), quedan **16 hallazgos reales** (7 ALTA, 8 MEDIA y 1 BAJA). Los ordeno por gravedad; cada uno se puede reproducir con el comando que indica la última columna.

### Gravedad ALTA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---|---|---|---|---|---|
| 1 | **Antirrepetición · Contrato** | Contrato: `contrato-cliente-id=""` → envío → «Selecciona un cliente» → se pone el cliente → **envío otra vez** | El 2º intento **no guarda nada y no dice nada**: 0 contratos creados y `avisos = []`. El botón «Guardar Contrato» queda **mudo para siempre en ese formulario**. Caja limpia, sin estado previo. | El 2º intento debe guardar | **ALTA** | `31-antirrepeticion-limpio.mjs` (V-01), también `29` (W-02) y `22` (A-05) |
| 2 | **Antirrepetición · Pago** | Pago rápido: `pago-rapido-monto = 0` → aviso → `1500` → «Registrar» otra vez | «El monto del pago debe ser mayor que cero» y después **0 pagos registrados y ningún mensaje**. El practicante cree que registró el anticipo. | El 2º intento debe registrar | **ALTA** | `31-antirrepeticion-limpio.mjs` (V-02), `29` (W-04), `22` (A-06) |
| 3 | **Captura · los 3 formularios** | Prospecto con datos buenos + teléfono `"abc"` → Guardar → diálogo «No se registró nada» | El diálogo **borra el formulario**: `#form-prospecto` deja de existir y **todo lo escrito se pierde** (nombre, notas, teléfono). Igual en **tarea** (fecha `1900-01-01`) y en **cliente** (correo basura). En `.24` estos avisos eran notificaciones que **no** rompían el formulario. | Avisar **sin** destruir el formulario | **ALTA** | `28-diagnostico-final.mjs` (Z-01, Z-02, Z-03) |
| 4 | **Datos viejos** | Prospecto **viejo** con teléfono `"abc"`: abrir su edición y cambiar **solo el nombre** → Guardar. Igual con un **cliente viejo** con teléfono `"1"` | **Rechazado**: no se puede corregir ningún otro campo sin antes arreglar el teléfono. Peor: el diálogo de error **destruye el formulario** (ver #3), así que el practicante además pierde lo que había escrito. Jorge **ya tiene** registros así. | Poder editar lo demás (o pedir solo el teléfono, sin tirar el formulario) | **ALTA** | `28-diagnostico-final.mjs` (Z-07, Z-08), `20` (E-18, E-19) |
| 5 | **Duplicados · Prospecto** | Existe `José Único` / `5550008888` y se crea `JOSE UNICO` / `5550008888` | **No avisa**: se guardan los dos. La comparación de nombres es `toLowerCase()` sobre el texto crudo, **sin quitar acentos**. El **importador sí lo detecta** (usa `sinAcentos()` + `claveNombre()`), así que la misma duplicación se frena al importar y se cuela al teclear. | Avisar y pedir confirmación | **ALTA** | `27-correcciones-y-casos-nuevos.mjs` (Y-11), `21` (D-02), contraste en `21` (D-18) |
| 6 | **Duplicados · Prospecto** | Existe `Prospecto Guiones` / `5550009999` y se crea el **mismo nombre** con `555-000-9999` | **No avisa**: quedan 2 prospectos con los mismos dígitos. La comprobación mezcla `soloDigitosTelefono(p.telefono)` (el que ya existe, en dígitos) contra `telefono` (**el nuevo, en crudo**): escribir el nuevo con guiones o espacios **desactiva el candado**. | Avisar | **ALTA** | `27-correcciones-y-casos-nuevos.mjs` (Y-12), `21` (D-04) |
| 7 | **Duplicados · Contrato** | Existe «Festejada Fecha» con fecha `2031-01-15` y se crea **la misma festejada** con `2031-02-15` | **No avisa**: quedan 2 contratos de la misma festejada. El aviso de gemelo exige **misma fecha Y mismo paquete**, así que **una fecha mal tecleada lo esquiva**. *(En la revisión H4 este caso ya salió CANDADO OK: el equipo azul lo arregló mientras yo probaba.)* | Avisar por festejada repetida aunque cambie la fecha | **ALTA** | `27` (Y-13), `21` (D-17) |

### Gravedad MEDIA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---|---|---|---|---|---|
| 8 | **Teléfonos · bloquea de más** | Prospecto con `prospecto-telefono = "878 123 4567 ext 4"` | **Rechazado** (el candado prohíbe cualquier letra). Un conmutador de oficina con extensión es un teléfono real, no basura. | Aceptar extensiones (o al menos no bloquear el prospecto) | MEDIA | `20-evasiones-telefonos.mjs` (E-06) |
| 9 | **Teléfonos · incoherente** | Prospecto con `prospecto-telefono = "8781234567 #4"` | **Aceptado** (11 dígitos: `87812345674`). Es decir: `ext 4` se rechaza y `#4` entra. La regla «cualquier letra es basura» es un cuchillo, no un candado. | La misma decisión para `ext` y para `#` | MEDIA | `20-evasiones-telefonos.mjs` (E-10) |
| 10 | **Duplicados · Tarea** | Existe la tarea «Visita rápida» (`2031-03-03`, tipo Visita) y se crea «VISITA RAPIDA» | **No avisa**: quedan 2 tareas el mismo día. La comparación es `toLowerCase()` **sin quitar acentos**. | Avisar | MEDIA | `27` (Y-14), `21` (D-14) |
| 11 | **Campañas · motor** | `App.motor.crearCampania({ nombre:'X', criteriosElegibilidad:[{tipo:'signo-zodiacal',…}] })` | **Se guarda la campaña con un criterio que no existe.** Lo curioso: el **mismo cambio** por `actualizarCampania` **sí se rechaza** («El criterio … no existe en el catálogo»). El arreglo se puso en la puerta de edición y no en la de creación. | Rechazar en las dos puertas | MEDIA | `25-blindado-confirmado.mjs` (B-12) |
| 12 | **Campañas · motor** | `crearCampania({ metas: { prospectos: 'muchas' } })` | **Se guarda** con la meta en texto (`{"prospectos":"muchas"}`), y `actualizarCampania` con la misma meta **sí la rechaza** («debe ser un número igual o mayor que cero»). `validarCampania` no revisa el texto, solo `< 0` (y `Number('muchas')` es `NaN`, que no es `< 0`). | Rechazar en las dos | MEDIA | `23-evasiones-fechas-campanias.mjs` (F-13) |
| 13 | **Campañas · asistente vs motor** | Borrador **con etapas válidas** y `fechaInicio = 2029-02-31` | Las dos puertas **no coinciden**: `validarCampania` (la que usa el asistente) dice **`ok = true`, 0 errores**; `crearCampania` **rechaza** («La fecha de inicio no es válida»). El asistente, en `index.html` ~13027, hace `asi.campaniaId = nueva.id` y avisa «Campaña creada en borrador» **sin mirar `guardada`**: quedaría apuntando a una campaña que no existe y diría que la creó. | Que las dos validaciones coincidan | MEDIA | `28-diagnostico-final.mjs` (Z-06) |
| 14 | **Teléfonos · sin aviso** | Dos prospectos con el teléfono `8781234599` (nombres distintos); y un prospecto con el teléfono de un **cliente** existente (`8781112233`) | **No avisa en ninguno de los dos.** El ayudante `telefonoYaRegistrado()` existe y **cruza prospectos y clientes**, pero el formulario de prospecto **no lo llama** (el de cliente sí). | Avisar como en clientes | MEDIA | `20-evasiones-telefonos.mjs` (E-27, E-28) |
| 15 | **Concurrencia · modales** | Prospecto duplicado + **dos envíos en el mismo tick** | El 2º envío **tira el formulario aparcado**: `aparcados: 2`, `formProspecto: false`, `retornoPendiente: true`. Al confirmar, el CRM busca `#form-prospecto`, no está, y **no guarda nada**; queda una ventana de confirmación encima de otra. **Alcance honesto:** **no** se reproduce con dos clics humanos (el 2º clic cae en la ventana de confirmación), solo con **dos envíos programáticos antes de que termine el primero** (la vía «pegado/autocompletado» que el ejercicio acepta como válida). | Un solo aviso y el formulario intacto | MEDIA | `22-evasiones-antirrepeticion-modales.mjs` (A-11) |

### Gravedad BAJA

| # | Familia | Ataque (dato exacto) | Qué pasó | Esperado | Gravedad | Reproducir |
|---|---|---|---|---|---|---|
| 16 | **Campañas** | Criterio **válido** (`faseComercial`) con `valor: ""` | Se guarda la campaña con el criterio vacío: no filtra a nadie y nadie lo avisa. | Pedir el valor | BAJA | `23-evasiones-fechas-campanias.mjs` (F-14) |

**Causa raíz de los hallazgos 1 y 2 (los más graves):** la marca de «ya enviado» se pone al entrar al manejador (`marcarFormularioEnviado(form)`) y **solo se libera** en la rama del «aparcadero» de `cerrarModal()`. Los caminos que avisan con una **notificación** (no con un diálogo) y hacen `return` —todas las validaciones tempranas de `guardarContrato`, y el «monto debe ser mayor que cero» del pago rápido— **no liberan la marca**. La marca vive en el nodo del formulario, así que ese formulario queda inservible **en silencio** hasta cerrarlo y volver a abrirlo. Los formularios de prospecto, tarea y cliente **sí** llaman a `liberarMarcaFormulario` en sus errores, por eso no les pasa.

**Causa raíz de los hallazgos 3 y 4:** `mostrarErroresFinancieros()` usa `abrirModal()`, que **reemplaza todo `#modal-body`**. El formulario que estaba debajo se destruye con lo que el practicante había escrito.

---

## 3. Artefactos MÍOS en la segunda pasada (confirmados y corregidos)

Para que nadie persiga falsos positivos, aquí están los veredictos malos de mis scripts nuevos y por qué eran culpa de mi prueba. Todos tienen su versión corregida (scripts `26` y `27`).

| Ataque | Qué salió | Por qué era artefacto mío | Corrección |
|---|---|---|---|
| `E-11`, `E-12` (cliente con +52 / 11 dígitos) | EXCESO | Usé teléfonos que **ya existían** en casos anteriores (E-02, E-01) → el CRM **avisó de teléfono repetido** y yo no confirmé, así que no se guardó. El aviso era correcto | `27` (Y-01, Y-02): con números únicos → **CANDADO OK** |
| `E-21`, `E-22` (importador 11 dígitos / +52) | HUECO | Mismo choque de teléfonos: el importador los marcó como **duplicados** (correcto) y yo esperaba que entraran | `27` (Y-03): con números únicos entran los dos → **CANDADO OK** |
| `E-24`, `E-25` (importador con letras / 1 dígito) | HUECO | Yo esperaba que la fila se **rechazara**; el CRM la acepta **sin teléfono** y guarda el texto crudo en notas. El dato incongruente **no** queda como teléfono | `27` (Y-04, Y-05): la fila entra, `telefono=""` y el texto va a notas → **CANDADO OK** |
| `E-26` (dos columnas al mismo campo) | HUECO | La fila se marcó como duplicada (teléfono ya sembrado) y mi aserción lo leyó como fallo | `27` (Y-06): con teléfono único, se guarda el bueno y `Celular: abcdefghij` va a notas → **CANDADO OK** |
| `A-10` (cliente duplicado: cancelar y volver a guardar) | EXCESO | Solo cambié el **nombre**; dejé el mismo **teléfono**, así que el CRM volvió a avisar (correcto) y yo no confirmé | `27` (Y-10): cambiando nombre **y** teléfono → se guarda → **CANDADO OK** |
| `D-03`, `D-10`, `D-15` (espacios dobles) | HUECO | Invertí la expectativa: creía que el CRM **no** lo detectaría, y **sí lo detecta**, porque `limpiarTextoLibre` colapsa los espacios dobles al guardar. Mi veredicto marcó como fallo un acierto | N/A (el CRM está bien) |
| `D-09` (cliente con acentos) | HUECO | El nombre que usé (`CLIENTE DUP UNO`) **coincidía literalmente** con el del caso D-08 → el aviso era correcto. No era la prueba de acentos que yo quería | `28` (Z-09): con nombres que no chocan (`Cliente Único Acento` vs `CLIENTE UNICO ACENTO`) → **CANDADO OK** (el teléfono repetido sí se detecta) |
| `N-14` (pago + cargo normales) | ROTO | Cancelé el aviso del cargo (que es legítimo cuando ya hay pagos) en vez de confirmarlo | `28` (Z-05): confirmando el cargo → los dos persisten → **CANDADO OK** |
| `Y-07`, `Y-08`, `Y-09` | ROTO | **Error de sintaxis en mi script** (un `;` de más dentro de un literal) → la página no podía evaluar | `28` (Z-07, Z-08, Z-09) con el mismo caso bien escrito |
| `Y-15`, `Y-16`, `Z-04` | ROTO | Mi lógica de veredicto estaba mal (marcaba ROTO el resultado intermedio). El **dato** que recogieron es correcto y es el que sostiene los hallazgos 1 y 2 | N/A (el dato sirve; el veredicto se reinterpreta en este reporte) |

**Lección para el que repare:** las dos trampas que me hicieron perder tiempo fueron (a) **teléfonos que chocan entre casos** (el CRM avisa de repetidos y la prueba lo lee como fallo) y (b) **expectativas invertidas** sobre lo que debería pasar. Las corregí, pero conviene que cualquier prueba nueva use **números y nombres únicos** por caso.

---

## 4. Lo que ahora SÍ está blindado (y yo mismo comprobé que ya no se puede romper)

Todo esto salió **CANDADO OK** en la segunda pasada. Es la lista de lo que Jorge ya puede dar por protegido:

**Dinero (lo que más importaba de la pasada 1)**
1. **Anular un pago ya funciona**: pide motivo, conserva monto y autor, deja la nota de anulación y **ya no revive** al recargar (`B-04`, `M-02` con `recargarDeAlmacen`: pagos anulados 1, notas 1, total $3,000). *(Era el hallazgo #1 de la pasada 1.)*
2. **Anular un cargo** igual, y se persiste (`G-15`).
3. **Cancelar la anulación no cambia nada** y el formulario sigue vivo (`M-03`).
4. **Confirmar un cargo alto ya no pierde el cargo ni el formulario**: el formulario sobrevive con **festejado y dirección intactos** y el cargo queda en disco (`M-01`, `G-16`).
5. **Un pago o cargo capturado en el formulario de un contrato existente se guarda al instante** y ya no miente la app (`B-08`, `X-12`, `Z-05`). *(Hallazgo G-12 de la pasada 1.)*
6. **Pago mayor al saldo**: sigue pidiendo confirmación explícita y deja el pago marcado `aceptadoConAviso` (`N-17`). No se cuela ni se bloquea de más.
7. **Contrato de $0 y fecha pasada al editar**: avisan y piden confirmación (`B-11`), y **confirmando se guardan** (`N-07`).
8. **La igualdad del dinero se cumple siempre**: suma de pagos por contrato = total pagado; saldo = total − pagos; 0 fallos de cuadre en toda la base después de 164 ataques (`B-15`).

**Estabilidad (que nada se rompa con los datos actuales de Jorge)**
9. **Se acabó el XSS almacenado**: importar `<img src=x onerror=…>` en el nombre ya no crea el `<img>` ni ejecuta el `onerror` (0 ejecuciones en lista y en ficha) (`B-01`).
10. **El motor de campañas ya sanea el HTML** (`B-02`) y **escribe `faseActual`**: la lista de Prospectos ya no se cae con un prospecto creado desde Campañas (`B-03`, `V-03`: 3 vueltas, 1 nodo por id, 3 prospectos, sin excepciones). *(ROTO P-15 de la pasada 1.)*
11. **Borrar un prospecto ya no deja participaciones huérfanas**: se archivan con él y quedan recuperables en la papelera (`B-04`: 0 huérfanas, 1 participación en papelera). *(I-01.)*
12. **Tareas con cliente inexistente**: rechazadas (`B-05`). **Años absurdos (1900/9999)**: rechazados (`B-06`).

**Candados de captura**
13. **Teléfonos basura**: 0 de 5 aceptados — letras, un dígito, 40 dígitos, `+` solo y emoji (`B-09`).
14. **Formatos legítimos que SÍ entran**: 11 dígitos, 12 y 13 dígitos, `+52 878 123 4567`, `(878) 123-4567`, `525512345678`, `8787878787` (repetidos pero 10) y con guiones — todos se guardan **conservando el formato** y sirven para marcar (`E-01`…`E-05`, `E-07`, `E-08`, `N-02`).
15. **WhatsApp con teléfono basura de un dato viejo**: se niega y explica por qué, en los 5 casos (`E-13`…`E-17`, `X-09`…`X-11`): letras, un dígito, emoji, 40 dígitos y repetidos.
16. **Cliente vacío, con estado inventado o con correo basura**: rechazado incluso por pegado/autocompletado (`B-07`).
17. **Clientes duplicados**: avisan y, **confirmando, se guardan los dos** (mismo nombre `N-03`, mismo teléfono `N-08`, teléfono con guiones contra sin guiones `D-11`). No bloquearon de más.
18. **Prospecto duplicado**: avisa y **confirmando se guarda** (`N-05`); nombre en MAYÚSCULAS y espacios sobrantes al inicio/final se detectan (`D-01`, `D-06`).
19. **Tarea repetida**: avisa y **confirmando se guarda** (`N-04`, `D-13`).
20. **Contrato gemelo**: avisa y **confirmando se guarda** (`N-06`, `D-16`).

**Campañas**
21. Campaña **sin nombre** y **sin etapa inicial**: rechazadas, no se guardan (`X-02`, `X-03`). **Dos etapas iniciales** y **etapas sin nombre**: rechazadas (`X-04`, `X-06`). **Fechas invertidas** y **fechas imposibles**: rechazadas (`X-01`, `F-18`). **Etapas vacías `[]`**: rechazada (`F-11`).
22. **Campaña válida**: se crea sin estorbos, con las 3 etapas por defecto y activable (`F-15`); con **etapas propias válidas** también, y ahora **con id propio** (`F-16`); con **fecha fin = fecha inicio** también (`F-17`). **Metas en cero**: permitidas (`F-12`).
23. **Oferta con precio negativo**: rechazada al crear/editar y al asignarla (`F-21`, `A-06`). **Estado de participación inventado**: rechazado (`B-13`). **Reabrir una participación cerrada**: rechazado con mensaje (`B-13`, `A-09`).
24. **Fechas límite de tarea**: `2027-02-28`, `2028-02-29` (bisiesto), `2000-01-01` y `2100-12-31` entran; `2027-02-29` (no bisiesto), `1999-12-31` y `2101-01-01` no (`F-01`…`F-07`). **Contrato**: `2100-12-31` entra, `2101-01-01` no (`F-08`, `F-09`).
25. **Participación con fecha imposible y valor potencial negativo**: se corrigen solos a hoy y a 0 (`F-20`).

**Concurrencia y modales**
26. **Ni un duplicado en 4 formularios**: doble envío en prospecto, tarea, cliente y contrato → 1 registro en cada uno (`B-14`). Dos `requestSubmit()`, y `requestSubmit()` + `dispatchEvent`, también dan 1 (`A-01`, `A-02`). **Reenviar el formulario ya cerrado** ya no crea otro (`A-03`, `D-11`). **Cerrar y reabrir sí permite guardar de nuevo** (no se bloquea de más) (`A-04`).
27. **El aparcado de modales nuevo funciona muy bien**: abrir una ventana encima de otra **no pierde nada** — el formulario de abajo sobrevive con sus datos y sus escuchadores (`M-01`…`M-06`), incluso cerrando con la **X** (`M-04`) o con un **clic en el fondo** (`M-05`), y con **dos ventanas seguidas** (`M-06`: festejado, dirección y notas intactos, 2 pagos vigentes). **Cancelar el aviso de gemelo y volver a intentar ya avisa otra vez** (`W-03`, `A-07` en la revisión H2) — eso lo arregló el equipo azul a media sesión, con `liberarFormularioModado()` al devolver el formulario aparcado.
28. **Un clic real con un `required` vacío lo frena el navegador** antes de llegar al código (0 eventos `submit`): el candado nativo sigue ahí (`W-01`).
29. **Nombres y descripciones largos se recortan, no se bloquean**: 200 caracteres → 120 (`N-09`), 1,000 → 300 (`N-10`), notas de 1,500 se guardan (`N-15`). **Prospecto sin teléfono** y **tarea sin vincular**: se guardan (`N-01`, `N-11`). **Editar un prospecto normal**: actualiza sin duplicar (`N-12`).
30. **Eliminar un cliente con contratos y pagos ahora dice cuántos y cuánto**: «Se irán con él a la papelera: 1 contrato · $8,000 ya pagados…» (`C-09`, `N-16`). *(Era C-09 de la pasada 1.)*

---

## 5. Notas de método y límites

* **Caja de arena obligatoria**: usada en las 61 corridas de resultados (`aislado === true` en todas). **615 peticiones de red, ninguna a los dominios de datos**; los intentos al SDK (`gstatic.com`) quedaron bloqueados. `window.open` se intercepta **solo** para leer la URL de WhatsApp, sin salir a internet.
* **`index.html` no lo toqué.** Todas mis escrituras van a `pruebas\sandbox\agente-a\` y a la copia de la caja en `%TEMP%\crm-sandbox\`. El archivo cambió 5 veces durante la sesión por agentes externos (sección 0).
* **`dispatchEvent` vs clic real**: cada hallazgo dice con qué vía se reprodujo. Los de antirrepetición (1 y 2) salen con **las dos**: primero el envío forzado (pegado/autocompletado) deja la marca, y luego el **clic real** de corrección es el que se pierde en silencio. El de modales (15) **solo** con dos envíos programáticos, y así queda anotado.
* **Lo que NO pude determinar**: en el caso del aviso de contrato gemelo seguido de **Cancelar** tuve evidencia mixta entre dos revisiones (en H1 el 2º intento quedaba mudo; en H2 volvía a avisar). En H4 el mismo caso volvió a salir OK. Lo dejo anotado tal cual en vez de afirmar una causa que no pude aislar; el mecanismo exacto (qué libera la marca en cada rama de `cerrarModal`) conviene que lo mire quien tenga el archivo congelado.
* **No probado** (fuera del alcance de esta pasada): sincronización con Firebase, papelera/restauración a 30 días, Google Calendar, impresión, comprobantes y respaldos. El pago con fecha inválida o anterior al contrato sigue **sin campo de fecha**, así que no es atacable desde la interfaz (`G-14`).
* **Recordatorio de reproducibilidad**: si el archivo sigue cambiando, los comandos de este reporte pueden dar otro resultado. Cada `resultados-p2-*/<script>.json` guarda el `sha256Fuente` con el que corrió.

---

## 6. Archivos de esta segunda pasada (todo dentro de `pruebas\sandbox\agente-a\`)

| Archivo | Qué es |
|---|---|
| `20-evasiones-telefonos.mjs` | 28 ataques de teléfono (formatos legítimos, datos viejos, importador, WhatsApp) |
| `21-evasiones-duplicados.mjs` | 19 ataques de duplicados (mayúsculas, acentos, espacios, guiones, contratos, tareas, importador) |
| `22-evasiones-antirrepeticion-modales.mjs` | 18 ataques de doble envío y del aparcado de modales |
| `23-evasiones-fechas-campanias.mjs` | 21 ataques de fechas límite y campañas |
| `24-no-bloquear-de-mas.mjs` | 17 comprobaciones de «esto debe seguir funcionando» (un EXCESO aquí es hallazgo) |
| `25-blindado-confirmado.mjs` | 15 comprobaciones de que los hallazgos de la pasada 1 ya no se reproducen |
| `26-originales-corregidos.mjs` | Las 12 comprobaciones de las familias originales con la **aserción arreglada** (12/12 CANDADO OK) |
| `27-correcciones-y-casos-nuevos.mjs` | Mis artefactos corregidos + casos nuevos (acentos, guiones, fecha distinta) |
| `28-diagnostico-final.mjs` | Diagnóstico: formulario destruido por el diálogo, datos viejos, divergencia del asistente |
| `29-antirrepeticion-contrato.mjs` | Contador de eventos `submit` para separar el candado nativo del de código |
| `31-antirrepeticion-limpio.mjs` | Reproducción limpia (caja recién abierta) de los hallazgos 1 y 2 y comprobación de ids duplicados |
| `99b-resumen-p2.mjs` | Conteos y tablas (`resumen-p2.txt`, `resumen-p2.json`) |
| `resultados-p2-originales/` | Mis 10 familias contra H1 (`6a097ae2`) |
| `resultados-p2-nuevos/` | Evasiones contra H1 (20–22) y H2 (`e062ca2a`) |
| `resultados-p2-actual/` | Re-corrida completa de 18 scripts contra H2 |
| `resultados-p2-actual2/` | Comprobación final de los hallazgos contra H4 (`f6d5c892`) |
| `_diff-024-025.txt` | Diferencias entre el `index.html` de la pasada 1 y el de la pasada 2, para entender cada candado nuevo |
