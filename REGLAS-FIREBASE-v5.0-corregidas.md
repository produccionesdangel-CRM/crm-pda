# Reglas de Firebase — corrección del 7/10/2026 (esto causaba el "Error de red")

## Qué pasaba (no era la red de Jorge)

El CRM mostraba **"Error de red"** con el internet perfecto, no sincronizaba nada y todo lo demás
funcionaba (podía cambiar de sesión y trabajar en local).

**La causa:** el candado de **`participaciones`** en las reglas que se publicaron el 7/10 exigía los campos
**`campaniaId`** y **`prospectoId`**, pero el motor de campañas del CRM escribe **`campaignId`** y
**`prospectId`** (nombres en inglés, heredados del CRM Lite):

```
Reglas (antes):  newData.hasChildren(['id','campaniaId','prospectoId','estado'])
App escribe:     id, campaignId, prospectId, estado, etapaId, historial, ...
```

Firebase **rechazaba cada participación**. Como el guardado sube todo junto (colecciones + historial +
participaciones), **una sola participación rechazada hacía fallar el guardado completo** → y el CRM lo
mostraba como *"Error de red"*, un mensaje que despistaba porque la red estaba bien.

> Comprobado además que **todo lo demás coincidía**: prospectos, clientes, tareas, campañas, historial,
> papelera, paquetes, servicios, versiones y usuarios ✅. El único desajuste era `participaciones`.

## La corrección

Un solo candado, y **acepta las dos formas** (así funciona con lo que la app escribe hoy y con lo que ya
haya guardado):

```
Reglas (ahora):  newData.exists() === false ||
                 (newData.hasChildren(['id','estado']) === true &&
                  (newData.child('campaignId').exists() === true || newData.child('campaniaId').exists() === true) &&
                  (newData.child('prospectId').exists() === true || newData.child('prospectoId').exists() === true))
```

**Es un cambio que solo afloja un candado; no cierra nada ni toca los datos.** No borra, no migra y no
modifica ningún registro.

## SEGUNDA corrección: las "lápidas" de borrado

Al probar después de publicar la primera corrección, el CRM siguió rechazando guardados, y el mensaje nuevo
(ya más honesto) lo dejó claro: una transacción en **/prospectos/…** falló con **permission_denied**.

**La causa:** el CRM **borra marcando el registro** con `_eliminado: true` en el mismo nodo (borrado suave,
para poder recuperarlo). Pero el candado de cada colección exige campos como `['id','nombre','faseActual']`…
que **una lápida no tiene**:

    lápida = { id, _eliminado: true, _eliminadoPor, _fechaEliminacion, _version, _nombreOriginal }

Resultado: **Firebase rechazaba cada borrado**, el cambio quedaba pendiente para siempre y **atascaba toda la
sincronización** (la cola tenía 21 cambios y la carga desde la nube se bloqueaba sola para no perder datos).

**El arreglo:** los candados ahora **aceptan la lápida** y siguen exigiendo los campos normales en cualquier
otro caso:

    newData.exists() === false || newData.child('_eliminado').val() === true || newData.hasChildren([...]) === true

Se aplicó a: `prospectos`, `clientes`, `tareas`, `paquetes`, `serviciosAdicionales`, `campanias`,
`participaciones`, `historial` y `papelera`. **La seguridad no se relaja**: sigue siendo imposible crear un
registro sin sus campos obligatorios, y un registro ya eliminado **no se puede volver a escribir** (esa regla
no se tocó).

**Y el CRM ahora se destranca solo:** si un cambio pendiente es de un registro que ya está eliminado en la
nube, lo **descarta** (avisa cuántos) y sigue subiendo los demás, en lugar de quedarse atorado.

## Cómo publicarlo (2 minutos)

> ⚠️ **Antes de tocar las reglas**: tener a mano la versión anterior para volver atrás.
> Ya está guardada en el repositorio: **`REGLAS-FIREBASE-v4.8-actuales.txt`** (las de la v4.8) y
> **`REGLAS-FIREBASE-v5.0-propuesta.json`** (las que están publicadas ahora, con el candado roto).
> El respaldo de datos del 6/10 también existe. Si algo saliera mal, se pega cualquiera de esos dos y se
> publica: queda como estaba.

1. Firebase → **Realtime Database** → pestaña **Reglas**.
2. Abre el archivo **`REGLAS-FIREBASE-v5.0-corregidas.json`**, selecciona **todo** el contenido y cópialo.
3. En la consola, **borra** lo que hay en el editor de reglas y **pega** el contenido nuevo completo.
4. Pulsa **Publicar**.
5. **Recarga el CRM** (`Ctrl + F5`) y haz una prueba que antes fallaba: abre una campaña y **agrega un
   prospecto** (o mueve a alguien de etapa).
6. Mirando el indicador de la esquina superior derecha: debe pasar de *"Error de red"* / *"Sin permiso en
   la nube"* a **"Guardado"** / **"Conectado"** en pocos segundos.

**Si algo sale mal** (por ejemplo deja de guardar otra cosa): vuelve a pegar
`REGLAS-FIREBASE-v5.0-propuesta.json` (lo que está publicado hoy) y publica. Nada de datos se pierde.

## Cómo comprobarlo desde el CRM (sin abrir la consola de Firebase)

- El aviso de la esquina dice **"Guardado"** o **"Conectado"** ✅.
- Si dice **"Sin permiso en la nube"**, es un problema de reglas (ya no dirá *"Error de red"* para
  despistar: ese mensaje se reserva para problemas reales de conexión).
- En la consola del navegador (F12 → Consola) el detalle aparece como
  `⛔ Firebase rechazó el guardado por PERMISOS (revisa las reglas)`.

## Lo que se agregó para que no vuelva a pasar

- El CRM **distingue** un problema de permisos de uno de red al mostrar el estado.
- El banco de pruebas tiene una **sección nueva (25)** que **evalúa los candados de las reglas** contra los
  objetos reales que crea el motor: se probó que **falla** con las reglas rotas y **pasa** con las
  corregidas (antes esta prueba aceptaba sinónimos y no servía de nada).
