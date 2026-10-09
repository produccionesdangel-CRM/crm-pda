# Auditoría de congruencia del CRM — reporte simple

**Fecha:** 8 de octubre de 2026 · **Sello reparado:** `2026-10-08.24` → **`2026-10-08.25`**
**Archivo verificado (congelado):** `sha256 96684c1f5ed1dd1f…` — la verificación final corrió **antes y después**
de toda la batería y el archivo **no cambió** durante ella.
**Qué se hizo:** se atacó el CRM a propósito con datos erróneos (como los de un practicante con prisa) para ver
qué candados faltaban; se repararon los huecos y se volvió a atacar para comprobar que ya no entren.

> **Cómo se organizó:** dos equipos. El **equipo rojo** (agente A) buscó romper la congruencia (129 ataques en 10
> familias + **164 intentos de evasión** en una segunda pasada). El **equipo azul** (agente B) reparó y blindó. La
> **verificación final la hice yo**, por separado, con pruebas propias que no dependen de lo que ellos afirmaran.

---

## 1. Cómo se probó (y por qué tu base nunca estuvo en riesgo)

Se levantó **el CRM completo** en una **caja de arena**: una copia del archivo con la configuración de Firebase
**cambiada por una inventada** y la **red bloqueada** hacia `firebaseio.com`, `firebaseapp.com`, `googleapis.com`
y `gstatic.com`. Así la app arranca en **modo local** (que ya existe) y **no puede** tocar tu base.

* Datos de la prueba: **20 prospectos y 2 campañas activas** ("Bodas 2027" y "XV años verano"), con **24
  participaciones** creadas por los mismos formularios que usas tú.
* En **todas** las corridas: **0 peticiones** a los dominios de datos reales, `database = false`, `auth = false`.
* Si alguien dejara la configuración real en la copia, el propio preparador **se niega a usarla** y avisa.
* **Tu `index.html` de producción no se tocó durante la auditoría**: el equipo rojo trabajó solo sobre la copia
  (verificado con `git status` y el sha256 del archivo).

## 2. Qué se encontró y cómo quedó

**129 ataques** en 10 familias. Antes: **60 candados aguantaron** y **69 problemas** (55 datos incongruentes
aceptados, 5 excepciones de JavaScript, 9 registros duplicados). Después: **121 candados OK** y **0 duplicados
ni excepciones reales**.

### 2.1 Dinero (lo que más importaba)

| Problema encontrado | Qué pasaba | Cómo quedó |
|---|---|---|
| **Anular un pago no funcionaba** | El botón de basura lanzaba un error, **no guardaba** la anulación y el pago **revivía** al recargar. El practicante creía haber corregido el cobro | Pide el **motivo** (obligatorio), anula conservando monto y autor, lo deja en el historial y **ya no revive**. Comprobado recargando la app |
| **Confirmar un cargo alto perdía el cargo** | Al aceptar el aviso, el cargo no se guardaba y **el formulario del contrato desaparecía** (se perdía lo capturado) | El cargo **se guarda** y el formulario sigue en pie con sus datos |
| **"Pago agregado" sin guardarse** | Un pago capturado dentro del formulario del contrato decía "agregado" y **no se guardaba** si cerrabas sin pulsar «Guardar Contrato» | En un contrato que ya existe, el movimiento **se guarda al instante**; en uno nuevo, el aviso lo dice claro y no promete un éxito falso |
| **Doble clic en «Guardar»** | Dos toques seguidos creaban **2 contratos de $25,000**, 2 clientes, 2 tareas o 2 prospectos | Un solo registro, aunque el toque se repita o se reenvíe el formulario ya cerrado |
| **Contrato gemelo, contrato en $0 y fecha pasada al editar** | Se guardaban sin decir nada | **Avisan y piden confirmación** (no se bloquean: a veces son legítimos) |

> **Un efecto secundario que encontró mi verificación independiente** (no lo vieron las pruebas de ninguno de los
> dos equipos): al cancelar uno de esos avisos, el botón **«Guardar» quedaba mudo** — el segundo intento no hacía
> nada y no se podía guardar sin cerrar y volver a abrir la ventana. **Ya está arreglado y comprobado**: se puede
> cancelar el aviso, corregir y volver a guardar. La prueba que lo vigila es
> `pruebas\sandbox\verificar-criticos.mjs` (caso 7).

### 2.2 Estabilidad (que nada se rompa con tus datos actuales)

| Problema encontrado | Qué pasaba | Cómo quedó |
|---|---|---|
| **Un prospecto creado desde Campañas rompía la pantalla de Prospectos** | El motor de campañas no le ponía la "fase", así que la lista lanzaba un error y **se quedaba con la información vieja** | El motor ya la escribe, los registros viejos **se reparan solos al entrar** y la lista se dibuja siempre |
| **Se podía ejecutar código desde un archivo importado** | Un CSV/Excel con `<img onerror=…>` en el nombre **se ejecutaba** al ver la lista o la ficha | Se neutraliza al guardar y al dibujar. Ya no se ejecuta nada |
| **Borrar un prospecto dejaba sus campañas con fantasmas** | Las participaciones quedaban huérfanas y seguían contando en los tableros | Se archivan con él (y se pueden restaurar desde la papelera) |
| **Tareas apuntando a un cliente que no existe** | Quedaban invisibles para siempre | Se rechazan al guardar |
| **Reabrir una participación ya cerrada** | Quedaba incoherente (etapa "Registrado" pero estado "convertida") | Se rechaza |

### 2.3 Candados para los practicantes

| Problema encontrado | Cómo quedó |
|---|---|
| **Teléfonos: no había ninguna validación** (entraban `"abc"`, `"+"`, `"1"`, 40 dígitos, emoji, texto) y WhatsApp abría `wa.me/1` tan tranquilo | Se **bloquea lo imposible** (letras, menos de 10 dígitos, más de 13, puros repetidos, emoji). Se sigue aceptando 10 dígitos, con guiones y con lada. Y la app **se niega a abrir WhatsApp** con un número basura |
| **Clientes duplicados o vacíos** (mismo teléfono, mismo nombre, nombre en blanco, estado en blanco, correo basura) | Avisa y **pide confirmación** de duplicados; rechaza nombre vacío, correo inválido y estado fuera del catálogo |
| **Prospectos duplicados** (mismo nombre y teléfono) | Avisa y pide confirmación |
| **Aviso de borrar cliente que no mencionaba dinero** (vista de mosaico, la de por defecto) | Las dos vistas avisan cuántos **contratos, tareas y pesos pagados** se van a la papelera |
| **Campañas inválidas por el motor** (sin nombre, fechas invertidas, sin etapa inicial, metas negativas, criterios inventados, ofertas en negativo, estados inventados) | **No se guardan**; devuelven el motivo. El asistente ya validaba, ahora el motor también |

## 3. Lo que NO se rompió (y hay que conservar)

* **Los candados de dinero ya eran buenos**: importes negativos, cero, con letras, por encima del límite,
  pagos mayores al saldo (avisan y piden confirmación), descuentos excesivos, cargos sin descripción.
* **Editar un contrato nunca perdió sus pagos** (ni antes ni ahora): comprobado con pagos reales.
* **La igualdad del dinero se cumple siempre**: `total = pagos + saldo`, con los montos redondeados a centavos.
* **El importador ya detectaba duplicados** por teléfono/nombre y filas repetidas.
* **Los permisos por rol ya estaban bien**: el rol **Ventas** no puede borrar clientes, prospectos, tareas,
  contratos, pagos ni paquetes; no ve Informes ni la papelera; no imprime contratos; y su fase comercial topa
  en Negociación. **Se comprobó con el CRM en la caja de arena**: los 6 intentos de borrado quedaron bloqueados
  con aviso, y el practicante **sí** puede dar de alta prospectos, completar tareas y registrar pagos.

## 4. Pruebas que puedes volver a correr

```powershell
cd C:\Users\noman\Documents\deepseek-harness\crm-pda

node pruebas\sandbox\LEEME.md                 # (léelo: explica la caja de arena)

node pruebas\humo-crm.mjs                     # 208/208
cmd /c pruebas\motor-v5.cmd                   # 224/224
node pruebas\sandbox\invariantes.mjs          # el dinero: TODO EN VERDE
node pruebas\sandbox\practicantes.mjs         # el rol Ventas: TODO EN VERDE
node pruebas\sandbox\verificar-criticos.mjs   # los 12 casos críticos, uno por uno: TODO EN VERDE
node pruebas\sandbox\agente-b\verificar.mjs   # bancos + las 10 familias + las pruebas del equipo azul
node pruebas\sandbox\agente-a\03-telefonos.mjs   # (y 02, 04…11) los ataques del equipo rojo
node pruebas\sandbox\agente-a\20-evasiones-telefonos.mjs   # (y 21…31) las evasiones de la segunda pasada
```

**Resultado de la verificación final (archivo congelado, `sha256 96684c1f…`):**

| Prueba | Resultado |
|---|---|
| Banco de humo del CRM | **208/208** |
| Banco del motor de campañas | **224/224** (0 fallidas) |
| Invariantes de clientes, contratos y pagos | **verde** (sumas, códigos únicos y `saldo = total − pagos`) |
| Rol Ventas (lo que un practicante puede y no puede hacer) | **verde** |
| Arreglos críticos, 12 casos (dinero, modales, teléfonos, duplicados) | **verde** |
| Batería roja completa | **117 de 129 en CANDADO OK**; los 12 restantes los demostró el propio equipo rojo como **defectos de sus pruebas** (leen un registro que la app ya rechazó), con su versión corregida en `26-originales-corregidos.mjs` (12/12) |

## 5. Lo que conviene que pruebes tú (a mano, en PC y en celular)

1. **Anular un pago** y un **cargo** desde la ficha del contrato: debe pedir motivo, decir "anulado" y **seguir
   anulado** después de recargar.
2. **Aceptar el aviso de un cargo alto** (más de lo normal): el cargo debe quedar guardado y el formulario vivo.
3. **Contrato gemelo / contrato en $0 / fecha pasada al editar**: deben avisar y, si confirmas, guardar bien.
4. **Guardar un prospecto desde una campaña** y luego abrir Prospectos en vista de **Lista**.
5. Un **teléfono con letras** en Prospectos y en Clientes: debe avisar y no guardar.

## 6. Riesgos que quedan (dichos claro)

1. El **aparcado de ventanas** (para que una ventana encima de otra no destruya el formulario de abajo) es
   **nuevo**: pasa todo lo automatizado, pero conviene que lo uses a mano un par de veces (punto 5.1 y 5.2).
2. **Los teléfonos basura que ya estén guardados siguen ahí.** El candado aplica al capturar y al marcar; no se
   hizo ninguna migración de tus datos. Al pulsar WhatsApp ahora avisa en vez de abrir un enlace roto. Si quieres,
   se puede hacer una **limpieza guiada** de los teléfonos actuales (avisando cuáles quedarían sin número válido).
3. **Las campañas inválidas que ya existan siguen en la base** (no se pueden activar, con su aviso). No se
   borraron: eso ya es decisión tuya.
4. Los topes de longitud (nombre 120, notas 2000, descripción 300) **recortan en silencio** datos muy largos.
   Es a propósito (basura pegada), pero es una constante fácil de subir.
5. **No se probó la nube real** (a propósito, para no tocar tus datos): la sincronización con Firebase no se
   modificó, pero tampoco se validó en vivo.
6. Único detalle de diseño que dejo anotado: `App.motor.crearCampania` **devuelve un objeto aunque no guarde**
   la campaña inválida. No afecta al asistente (valida antes) y nada inválido entra a la base, pero un programa
   futuro podría confundirse; se puede devolver `ok:false` cuando quieras.

**Nada de esto toca clientes, contratos ni pagos existentes**: los arreglos actúan al **capturar** y al
**dibujar**, y los invariantes del dinero se revisan después de cada operación en las pruebas.
