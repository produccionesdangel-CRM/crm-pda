# Plan F2 — Contratos y pagos separados, append-only

> **Estado:** diseño técnico. No se ha tocado producción.
> **Base:** v5.1.0 (F1 en tiempo real), commit `7d6de1e`.
> **Objetivo:** que un pago sea un registro propio y no pueda perderse ni bloquearse por un conflicto en el cliente.

---

## 1. Por qué F2

En la v5.1.0 los cambios ya llegan solos, pero el pago sigue viviendo **dentro del cliente** (`clientes/{id}/contratos[]/pagos[]`). Si el cliente tiene un conflicto de versión, el pago que se acaba de capturar no puede subir. F2 saca contratos y pagos a colecciones propias.

## 2. Modelo nuevo

| Nodo | Campos principales | Regla |
|---|---|---|
| `clientes/{id}` | Los datos actuales, **sin** `contratos` anidados | Editable con `_version`; borrado lógico |
| `contratos/{id}` | `id`, `clienteId`, todos los campos actuales del contrato, `_version`, `_eliminado` | Editable con `_version`; borrado lógico |
| `movimientos/{id}` | `id`, `tipo` (`pago`/`cargo`), `monto`, `fecha`, `codigo`, `contratoId`, `clienteId`, `estado` (`vigente`/`anulado`), `anuladoPor`, `fechaAnulacion`, `creadoPor`, `_opId`, `firma` | **Append-only**: crear y anular; nunca borrar |
| `historial/{id}` | Como hoy | Append-only |

Los totales se calculan sumando los movimientos vigentes del contrato. No se guarda un saldo que pueda quedar viejo.

## 3. Adaptador para no reescribir la UI

La UI sigue leyendo `cliente.contratos` y `contrato.pagos/cargos`. Un adaptador arma esa forma en memoria:

1. Lee `clientes`, `contratos` y `movimientos`.
2. Agrupa contratos por `clienteId`.
3. Agrupa movimientos por `contratoId` y los separa en `pagos`/`cargos`.
4. Asigna `cliente.contratos` y `contrato.pagos/cargos`.
5. La UI y `calcularTotalesContrato` no cambian.

Al escribir, el adaptador hace el camino inverso: guarda en las colecciones nuevas y actualiza la vista local.

## 4. Lectura en tiempo real

- Escuchar `clientes`, `contratos` y `movimientos`.
- En cada evento, reconstruir la vista del cliente afectado (o todo, si es más simple).
- Mantener la regla de F1: si un cliente tiene cambios locales pendientes, no se pisa.
- La carga completa inicial lee las tres colecciones y arma la vista.

## 5. Escritura

### Pago o cargo nuevo
1. Generar `id` único (`pag_...`/`car_...`) y `codigo`.
2. `movimientos/{id}.set(...)` con `contratoId`, `clienteId`, `estado: 'vigente'`.
3. Si no hay conexión, queda en el outbox; al reconectar se reintenta con el mismo `id` (idempotente).
4. Actualizar la vista local y el historial.

### Anulación
- `movimientos/{id}.update({ estado: 'anulado', anuladoPor, fechaAnulacion })`.
- No se borra: el historial y la auditoría quedan.

### Contrato o cliente
- `contratos/{id}` y `clientes/{id}` con transacción y `_version`.
- Para ediciones de campos sueltos, `update` parcial cuando sea posible.

## 6. Migración

1. **Respaldo:** export completo de Firebase y copia del HTML/tag.
2. **Simulación:** contar clientes, contratos y movimientos; sumar pagos por contrato y comparar con los totales actuales. Si no cuadra, no se migra.
3. **Escritura idempotente:** para cada cliente, crear `contratos/{id}` y `movimientos/{id}` si no existen. No borrar los anidados.
4. **Marcador:** `migracion/v51` con fecha, usuario, conteos y estado.
5. **Doble escritura:** durante la transición, escribir en ambos lados y leer de los nuevos.
6. **Corte:** apagar la lectura de los anidados; conservar el respaldo.
7. **Rollback:** bandera `v51` apagada; los datos viejos siguen intactos.

## 7. Entorno de pruebas

- **Recomendado:** una rama `pruebas-v51/` en la misma base, con reglas propias y un build de prueba que prefije todas las rutas (`database.ref` envuelto).
- Copiar los datos de producción a `pruebas-v51/` (solo lectura desde producción).
- Ejecutar la migración y comparar conteos/saldos.
- No se toca producción hasta que la simulación cuadre.

## 8. Pruebas obligatorias

- Conteos: clientes, contratos, pagos y cargos idénticos antes/después.
- Saldos por contrato idénticos.
- Pago nuevo en una PC aparece en la otra casi al instante.
- Anulación: baja el saldo, queda en historial, no se borra el movimiento.
- Cobro sin internet: queda pendiente y sube al reconectar.
- Conflicto en una nota del cliente: no bloquea un pago nuevo.
- Rollback: apagar `v51` devuelve la lectura a los datos anidados.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración parcial | Simulación, lotes, marcador, reintento idempotente |
| Movimientos duplicados | `id` único = código; `set` idempotente |
| Totales distintos | Comparar suma por contrato antes de cortar |
| Reglas nuevas bloquean | Probar en `pruebas-v51/`; publicar después |
| UI rota por el adaptador | Pruebas en los dos formatos (PC y móvil) |
| Pérdida de datos anidados | No borrarlos hasta una semana después del corte |

## 10. Orden de trabajo

1. Crear el build de pruebas con el prefijo `pruebas-v51/`.
2. Copiar los datos actuales a ese prefijo.
3. Implementar el adaptador de lectura y comprobar que la UI se ve igual.
4. Implementar la migración y comparar.
5. Implementar la escritura de pagos/contratos en las colecciones nuevas.
6. Pruebas de dos dispositivos, offline y anulación.
7. Publicar la v5.2.0 (o v5.1.1) con bandera; doble escritura una semana.
8. Cortar la lectura anidada y conservar el respaldo.
