# Plan v5.1 — La nube manda: sincronización en tiempo real y datos críticos protegidos

> **Estado:** propuesta para aprobar. No se ha tocado producción.
> **Base:** v5.0.26 (commit `07ae8af`, build `2026-10-29.1`).
> **Objetivo:** que clientes, contratos y pagos lleguen solos a todos los dispositivos, sin que nadie tenga que “acordarse” de cargar la nube, y que un pago no pueda perderse por un conflicto en otro campo del cliente.

---

## 1. El problema que resuelve

Hoy el CRM es **local-first**:

- La base principal es IndexedDB en cada PC; Firebase es una copia.
- Al abrir, la app usa la copia local y solo pregunta a Firebase por una **marca de versión**. Si la marca no cambió (o el aviso se pierde), la pantalla se queda con datos viejos.
- El pago vive **dentro del cliente**. Un conflicto en cualquier campo del cliente —teléfono, notas, una tarea— puede bloquear la subida del pago.
- La bajada de cambios desde la nube es un **reemplazo completo** que hay que pedir a mano (“Cargar desde la nube”).

Eso funciona para una sola persona con cuidado, pero no para varios usuarios con niveles distintos de entendimiento. Los datos críticos no pueden depender de que alguien recuerde el orden correcto.

## 2. Principio de diseño

**La nube manda. La copia local es un espejo, no la verdad.**

- **Con internet:** el dispositivo está suscrito a los cambios y se actualiza solo. No hay que “cargar” nada.
- **Sin internet:** la app usa la copia local, pero lo dice claramente y no deja emitir un recibo “final” como si el pago estuviera confirmado.
- **Los pagos son registros propios, append-only:** no se borran; se anulan con estado y auditoría. Un conflicto en el cliente no puede bloquearlos.

## 3. Qué cambia para el usuario

- Nunca más “Cargar desde la nube” para ver lo que hizo otra PC. La app se entera sola.
- Estado siempre visible y honesto:
  - `EN LÍNEA · AL DÍA`
  - `SIN CONEXIÓN · COPIA LOCAL (puede estar desactualizada)`
  - `SINCRONIZANDO…`
  - `CONFLICTO: revisa este registro`
- Si alguien cobra sin internet, el comprobante sale marcado **“PENDIENTE DE SINCRONIZAR”**; al confirmarse en la nube se puede reemitir como final. Nunca se hace pasar por confirmado algo que no lo está.
- Los recibos conservan su código único; el código es el identificador del movimiento y no cambia.

## 4. Arquitectura propuesta

### 4.1 Colecciones

| Nodo | Contenido | Regla |
|---|---|---|
| `clientes/{id}` | Datos del cliente (sin contratos anidados) | Editable con versión; no se borra, se marca `_eliminado` |
| `contratos/{id}` | Contrato con `clienteId` | Editable con versión; no se borra |
| `movimientos/{id}` | Pago o cargo: `tipo`, `monto`, `fecha`, `codigo`, `contratoId`, `clienteId`, `estado` | **Append-only**; solo se anula con estado; no se borra |
| `historial/{id}` | Bitácora | Append-only |
| `versiones/{coleccion}/{id}` | Número de versión | Solo números |
| `version` | Marca global | Metadatos |

Los totales de un contrato se **calculan sumando movimientos vigentes**, no se guardan como un saldo que pueda quedar viejo.

### 4.2 Lectura en tiempo real

- Al iniciar sesión, la app se suscribe a `clientes`, `contratos` y `movimientos` con `child_added`, `child_changed`, `child_removed`.
- Cada evento actualiza la caché local (IndexedDB) y el modelo en memoria; la vista activa se vuelve a dibujar con un pequeño retraso para no parpadear.
- La UI sigue leyendo `cliente.contratos` y `contrato.pagos` como hoy: un **adaptador** arma esa forma desde las colecciones nuevas. Así no hay que reescribir las 45 referencias a contratos ni las 17 llamadas a totales.
- La app no muestra `AL DÍA` hasta que la primera foto de la nube se aplicó completa y `info/connected` está en línea.

### 4.3 Escritura

- **Pago:** se crea `movimientos/{id}` con `id = codigo` (único, generado en el dispositivo). Es un `set` idempotente: si se reintenta, no duplica. Se espera la confirmación del servidor; si no hay conexión, queda en la cola local y el recibo se marca pendiente.
- **Contrato/cliente:** transacción con `_version`; si otro usuario cambió el registro, se avisa y se muestra qué cambió. Para ediciones de campos sueltos se puede usar `update` parcial, que reduce conflictos.
- **Cola offline:** se conserva el outbox actual en IndexedDB, con `_opId` para idempotencia. Al reconectar se vacía en orden; los pagos son creaciones, no reemplazos.

### 4.4 Recibos

- El comprobante lleva un campo de estado:
  - `CONFIRMADO EN LA NUBE` (solo cuando el movimiento existe en Firebase).
  - `PENDIENTE DE SINCRONIZAR` (cuando se cobró sin conexión).
- El envío por WhatsApp/email se permite en ambos casos, pero el texto y el PNG dicen claramente cuál es. Cuando el pendiente se confirma, se puede reemitir el final con el mismo código.

### 4.5 Seguridad

- Reglas de Firebase:
  - `movimientos`: crear solo autenticado; actualizar solo para anular, solo administrador; **nunca** borrar.
  - `historial`: crear; no editar ni borrar.
  - `contratos` y `clientes`: escritura autenticada con `_version`; borrado lógico.
  - `versiones`: solo números.
- Auditoría: quién creó, quién anuló, cuándo, desde qué dispositivo.
- Respaldos: export completo antes de la migración y respaldo periódico; el respaldo automático actual se mantiene.

## 5. Fases

### F1 — v5.1.0: lectura en tiempo real y estado honesto

- Listeners sobre `clientes` (con los contratos y pagos anidados actuales).
- Actualización automática de la vista; sin “Cargar desde la nube”.
- Estado `EN LÍNEA / SIN CONEXIÓN / SINCRONIZANDO` visible.
- Reconciliación al reconectar, al volver a la pestaña y cada 60 s si está inactiva.
- **No cambia el esquema.** Es la fase de menor riesgo y la que elimina la carga manual.

### F2 — v5.1.1: contratos y movimientos separados

- Migración de contratos y pagos anidados a `contratos` y `movimientos`.
- Adaptador para que la UI siga igual.
- Pagos append-only; totales por suma.
- Migración idempotente, con simulación, respaldo, doble escritura y bandera de rollback.

### F3 — v5.1.2: escritura, recibos y reglas

- Confirmación de servidor antes del recibo final.
- Reglas nuevas, auditoría y anulación con estado.
- Pantalla de conflicto con diferencias y opción de fusionar.
- Limpieza de la doble escritura.

## 6. Migración (F2)

1. **Respaldo:** export completo y copia del JSON antes de tocar nada.
2. **Simulación:** contar clientes, contratos y movimientos; sumar pagos por contrato y comparar con los totales actuales. Si no cuadra, no se migra.
3. **Escritura:** crear `contratos/{id}` y `movimientos/{id}` con los mismos IDs; no borrar los anidados.
4. **Doble escritura:** durante una semana, la app escribe en ambos lados y lee de los nuevos.
5. **Verificación:** comparar conteos y saldos en dos dispositivos.
6. **Corte:** apagar la lectura de los anidados; conservar el respaldo.
7. **Rollback:** bandera `v51` apagada; los datos viejos siguen intactos.

## 7. Pruebas

- **Entorno:** proyecto Firebase de pruebas o una rama `pruebas-v51/` en la misma base, con reglas propias. No se prueba la migración en producción sin respaldo.
- **Escenarios:**
  - Dos dispositivos en línea: un pago aparece en el otro sin recargar.
  - Un dispositivo cobra sin internet; el recibo sale “pendiente”; al reconectar se confirma.
  - Dos usuarios editan el mismo cliente: se ve el conflicto y se decide.
  - Anulación de un pago: desaparece del saldo, queda en historial.
  - Migración: conteos y saldos idénticos antes y después.
- **Criterio de aceptación:** ningún pago puede quedar solo en local sin que la app lo diga; ningún dispositivo muestra `AL DÍA` con datos sin reconciliar.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Bucles de listener por escribir y recibir el propio cambio | Ignorar el eco por `_opId`/`_version`; debounce |
| Pagos duplicados al reintentar | ID único = código; `set` idempotente; `_opId` |
| Migración parcial | Simulación, lotes, log, bandera, respaldo |
| Reglas nuevas bloquean escrituras | Probar en entorno de pruebas; publicar reglas después |
| Rendimiento con muchos listeners | Escuchar solo lo necesario; índice por `clienteId`/`contratoId`; debounce |
| Usuario confunde copia local con verdad | Estado visible y recibo marcado; nunca `AL DÍA` sin reconciliar |

## 9. Decisiones que necesito de Jorge

1. **Recibos:** ¿final solo con confirmación de la nube, o se permite emitir “pendiente” sin internet? (Recomendado: permitir pendiente, marcado, y reemitir al confirmar.)
2. **Entorno de pruebas:** ¿creamos un proyecto Firebase de pruebas, o usamos una rama `pruebas-v51/` en la misma base con reglas aparte?
3. **Ventana:** ¿empezamos F1 ya en una copia (`crm-pda-v5.1-pruebas.html`) sin tocar producción, y publicamos cuando esté probado?
4. **Alcance:** ¿F1 primero (elimina la carga manual) y F2 después (separa pagos), o todo junto?

## 10. Lo que NO cambia

- Sigue siendo un solo HTML, sin paso de compilación.
- Sigue el login con Google y las reglas de Firebase.
- Sigue funcionando sin internet, con la copia local y el aviso correspondiente.
- Se conservan los códigos de recibo, el historial y la papelera.
