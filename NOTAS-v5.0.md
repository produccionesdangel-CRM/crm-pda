# CRM PDA v5.0 — notas de la versión

**Sello:** `build 2026-10-07.1` · **Archivo:** un solo `index.html` (~1 MB) · **Fecha:** 7 de octubre de 2026

## Lo que se agregó

### 1. Módulo de campañas (nuevo)
- **Panel** (nueva pestaña, después de Informes): métricas, embudo, cumplimiento de metas, participaciones por
  origen, tareas de campaña y seguimientos (vencidos · hoy · próximos 7 días · sin programar).
- **Campañas** (nueva pestaña): lista con filtros, ficha por etapas, participantes, ofertas y beneficios con
  vigencia, metas y asistente de configuración por pasos.
- **Regla del motor:** solo **una campaña activa** recibe participantes y genera tareas. Las demás quedan en
  borrador, programadas o pausadas sin afectar los informes.
- **Tareas sueltas:** las que se crean desde la ficha del prospecto no pertenecen a ninguna campaña, para no
  ensuciar sus métricas.

### 2. Calendario y ficha del prospecto
- El calendario distingue las **tareas de campaña** (color propio), muestra los **seguimientos** prometidos a
  cada prospecto y tiene un filtro **"Solo campañas"**.
- La ficha de un prospecto muestra **sus campañas** (etapa, estado, seguimiento) y **sus tareas de campaña
  agrupadas por vencimiento**, ordenadas por fecha y prioridad.

### 3. Nuevo rol: **Ventas**
| Puede | No puede |
|---|---|
| Prospectos (crear, editar, borrar, convertir a cliente) | Ver **Informes** |
| Operar campañas y sus tareas (activar/pausar/finalizar: **no**) | Entrar a la **papelera** |
| Clientes y contratos: ver, crear y editar (**borrar: no**) | Gestionar **usuarios** |
| **Agregar pagos** e **imprimir y enviar comprobantes** | **Exportar ni importar respaldos** |
| WhatsApp individual y tareas en el calendario | Editar **pagos o cargos** ya registrados |
| Cambiar el tema del CRM | Editar el catálogo (ve **paquetes y servicios en solo lectura**) |
| Avanzar la fase comercial **hasta Negociación** | Imprimir **contratos** (llevan el desglose del precio) |

El rol **Operador conserva exactamente los permisos que ya tenía**; el **Administrador** puede todo.

### 4. Seguridad
- **El catálogo (paquetes y servicios) solo lo modifica un administrador**, y ahora también en las reglas de la
  base, no solo en la pantalla.
- **Índice de administradores (`admins/<uid>`):** las reglas verifican el permiso contra la base. Antes ese
  candado **no funcionaba** —buscaba por un identificador que no coincidía con cómo se guardan los usuarios— y
  dejaba abierto un camino para que un usuario se diera permisos de administrador. Corregido y documentado.
- La app **limpia el índice** al desactivar, degradar de rol o quitar a un usuario.

### 5. Todo lo nuevo entra al respaldo y a la nube
Las campañas y participaciones usan **el mismo mecanismo** que el resto del CRM: cola de cambios pendientes,
control de versión, historial, respaldo exportado e importación. No hay un camino paralelo.

## Lo que **no** cambió
- Nada del CRM anterior se quitó: informes, clientes, contratos, paquetes, servicios, calendario, historial,
  papelera, usuarios, respaldos e impresión siguen funcionando igual.
- Los datos del CRM anterior **no se tocan**: la v5.0 solo **agrega** dos colecciones (vacías al empezar).

## Cómo se probó
- **94 comprobaciones automáticas** sobre el archivo real: arranque sin errores, menú y secciones, capa de datos,
  motor de campañas creando campañas de verdad, puente de la interfaz, vistas que se dibujan, calendario con
  campañas, ficha del prospecto, capacidades de cada rol y **regresión de las 10 secciones**.
- Verificado además en el teléfono de Jorge en versiones anteriores del CRM (login y datos reales).

## Pendiente conocido y honesto
- **Los pagos viven dentro del contrato**, así que "no editar pagos" se cumple en la interfaz y queda firmado en
  el historial, pero no se puede imponer a nivel de base de datos sin cambiar el modelo de datos.
- **"Que Ventas no vea Informes" es una vista**: los informes se calculan con datos que ese rol sí necesita.
  La sección está oculta para su rol y el acceso queda bloqueado.

## Medición en el teléfono (7 de octubre de 2026)

Medido **en el teléfono real** (Xiaomi 2412DPC0AG, Android 16, Chrome, **con datos móviles 4G**, no Wi-Fi),
sobre la página ya publicada:

| Qué se midió | Resultado |
|---|---|
| Bajar el archivo publicado | **445 ms** |
| Leerlo y ejecutarlo (incluye Firebase desde internet) | **824 ms** |
| **Total hasta tener la aplicación lista** | **1.269 ms ≈ 1,3 segundos** |
| Peso | 988 KB |

**Conclusión: no hay que aligerarlo.** El archivo creció de 614 KB a ~1 MB, pero en un teléfono real con datos
móviles abre en **1,3 segundos**, y en Wi-Fi será más rápido. La medición se hizo con
`pruebas\medir-movil.html` (baja el archivo publicado y cronometra la descarga y la lectura; repartible si se
quiere repetir).
