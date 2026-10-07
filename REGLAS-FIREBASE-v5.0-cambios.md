# Reglas de Firebase para la v5.0 — qué cambia y por qué

> Base: las reglas que Jorge puso en `V4.8 crm\Reglas firebase v4.8 crm.txt` (copiadas aquí como
> `REGLAS-FIREBASE-v4.8-actuales.txt`). Propuesta lista para pegar: `REGLAS-FIREBASE-v5.0-propuesta.json`.
>
> **NO se aplican todavía.** Primero: respaldo exportado y verificado desde el CRM, y una prueba con una
> cuenta de cada rol. Las reglas son lo único que de verdad protege los datos: la interfaz solo esconde botones.

## 1. Lo que ya estaba bien (no se toca)

- La raíz niega todo por defecto (`.read`/`.write` en `false`) y cada nodo abre lo mínimo.
- El `historial` es **append-only** (`data.exists() === false`): nadie puede alterar la auditoría.
- La `papelera` está reservada al dueño o a un administrador.
- Los borrados son suaves (`_eliminado`), lo que permite recuperar.

## 2. El problema de fondo que encontré (importante)

Las reglas preguntan si alguien es administrador así:

```
root.child('usuarios').child(auth.uid).child('admin').val() === true
```

Pero el CRM guarda los usuarios con **otra clave**: en `usuariosAObjeto()` (línea 6536) solo el registro
**del propio usuario conectado** se guarda con su UID; **todos los demás** se guardan como `u_<username>`:

```js
const clave = (esUnoMismo && uid) ? uid : ('u_' + u.username);
```

Consecuencia medida: ese candado **solo funciona para quien publicó la lista de usuarios al último**; para
los demás el `child(auth.uid)` no existe y la comprobación falla. Hoy no se nota porque la regla incluye
además el correo del dueño (`produccionesdangel@gmail.com`), que es la que en la práctica sostiene la papelera.

**Solución propuesta (mínima y robusta): un índice `admins/<uid>`.** Cada usuario, al publicar, escribe
**solo su propia casilla** (`auth.uid === $uid`, imposible escribir la de otro) y las reglas consultan ese
índice. No hay que rehacer el sistema de usuarios ni migrar claves.

> Requiere un cambio chico en la app: al publicar la lista (`subirRegistroUsuarios()`), escribir también
> `admins/<uid> = true|false`. Se anota como pendiente de la Fase 4.

## 3. Cambios uno por uno

| Nodo | Antes | Ahora | Por qué |
|---|---|---|---|
| **`admins`** | no existía | **nuevo**: cada quien escribe solo su casilla | arregla el candado de administrador |
| `usuarios` | escritura si tu registro (por UID) existe, no hay `arranque`, o eres el dueño | igual, pero con el índice `admins` | que el candado funcione de verdad |
| `usuarios.rol` | solo `Administrador` u `Operador` | se agrega **`Ventas`** | el rol nuevo |
| `usuarios.rol`, `admin`, `activo` | cualquiera podía cambiarlos al escribir su registro | **solo un administrador o el dueño** pueden cambiarlos (el valor igual se permite) | **cerraba una escalada de privilegios**: un usuario podía ponerse `admin: true` |
| **`paquetes`** | escritura para **cualquier usuario verificado** | **solo administrador / dueño** | Jorge: Ventas no debe editar ni borrar el catálogo |
| **`serviciosAdicionales`** | igual que paquetes | **solo administrador / dueño** | lo mismo |
| **`campanias`** | no existía | **nueva**: lectura para usuarios; **escritura solo administrador** | decisión de Jorge: activar/pausar/finalizar campañas es del administrador |
| **`participaciones`** | no existía | **nueva**: lectura y escritura para usuarios verificados | es el trabajo diario de Ventas (agregar gente, mover etapas, registrar contactos) |
| `clientes` | cualquiera podía borrar (marcar `_eliminado`) | **borrar solo administrador**; crear y editar, todos | Jorge: Ventas no elimina clientes |
| `clientes.contratos` | sin candado propio | **borrar un contrato solo administrador** | Jorge: Ventas no elimina contratos |
| `tareas` | igual | igual, más índices (`campaniaId`, `participacionId`, `responsable`) | las tareas de campaña |
| `papelera` | `usuarios/<uid>` (roto) | índice `admins` | que el candado funcione |
| `historial`, `version`, `versiones`, `datos` | — | **sin cambios** | ya estaba bien |

## 4. Lo que las reglas NO pueden hacer (para no prometer de más)

1. **Los pagos y los contratos viven dentro del cliente.** En Realtime Database no se puede impedir que
   alguien añada o cambie un pago con la precisión que pides ("agregar sí, editar y borrar no"): la regla
   solo ve el nodo `clientes/<id>`, no cada pago. Eso queda como **guarda en la interfaz + rastro en el
   historial** (cada pago queda firmado con quién lo capturó). Se puede endurecer más adelante moviendo los
   pagos a su propio nodo, pero eso ya es cambiar el modelo de datos y no lo recomiendo ahora.
2. **"Que no vea Informes" no es una regla de datos.** Los informes se **calculan** con clientes, contratos y
   pagos, que Ventas sí necesita ver. Ocultar la sección es de interfaz; los datos seguirán llegando al
   navegador porque la app los descarga para trabajar.
3. **Mientras la app se descargue todo, "no ver Paquetes" es cosmético.** Para que sea real hay que dejar de
   cargar esas colecciones según el rol (cambio en el código, Fase 4). Las reglas de arriba ya permiten la
   lectura del catálogo **a propósito**, porque el formulario de contrato la necesita para cotizar.
4. **Nada de esto sustituye al respaldo**: si las reglas quedan mal, un usuario legítimo puede dejar de
   trabajar. Por eso se aplican con respaldo hecho y se prueban los tres roles.

## 5. Cómo se aplican (cuando Jorge diga que sí)

1. **Exportar un respaldo desde el CRM y verificar que abre** (regla de oro del proyecto).
2. Copiar el contenido de `REGLAS-FIREBASE-v5.0-propuesta.json`.
3. Firebase → Realtime Database → **Reglas** → pegar → **Publicar**.
4. Probar con una cuenta de cada rol: administrador (todo), operador (como antes) y ventas (prospectos,
   campañas, tareas, clientes y contratos sin borrar; sin paquetes/servicios editables, sin papelera).
5. Si algo falla: volver a pegar el contenido de `REGLAS-FIREBASE-v4.8-actuales.txt` y publicar (queda
   guardado en este repositorio justamente para eso).

> Pendiente antes de publicar las reglas: el cambio chico en la app para que escriba `admins/<uid>`.
> Sin él, el índice queda vacío y el candado de administrador vuelve a depender del correo del dueño.
## 6. Avance del índice `admins` (6/10/2026)

Ya está hecho en el código de la v5.0:

- `subirRegistroUsuarios()` publica **`admins/<uid> = true|false`** cada vez que se publica la lista de usuarios
  (bloque `@JS-INDICES-ADMINS`), y el registro de cada usuario ahora **guarda su `uid`**.
- Probado en el banco de pruebas: un administrador publica su casilla en `true` y un operador en `false`.

**Pendiente pequeño (Fase 4):** cuando un administrador **desactiva o quita** a otro usuario, hay que borrar
también su casilla del índice (`admins/<uid>`). Para eso ya se guarda el `uid` dentro del registro, así que el
administrador puede encontrarlo. Sin ese paso, un administrador degradado conservaría el permiso en las reglas
hasta que él mismo vuelva a entrar y publique.

**Pendiente antes de publicar las reglas:** el respaldo exportado y verificado, y la prueba con una cuenta de
cada rol.

## 7. Decisión del 6/10/2026: catálogo en solo lectura (sin cambios en las reglas)

Jorge decidió que **Operador y Ventas vean Paquetes y Servicios completos, en solo lectura**. Esta propuesta
**ya lo cumple tal cual**: `.read` abierto a cualquier usuario autenticado y `.write` reservado al administrador
(o al dueño) en `paquetes` y `serviciosAdicionales`. No hay que tocar las reglas por este cambio; lo único que
se ajustó fue la interfaz (la sección Servicios dejó de estar oculta y se dibuja para todos, sin botones de
editar ni eliminar).
