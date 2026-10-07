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

## 8. Verificación contra la base real (volcado del 6/10/2026) — dos hallazgos

Jorge exportó **dos respaldos** el 6/10/2026: el del CRM (`registro_pda_2026-10-06.json`, 151 KB) y el
**volcado completo de Firebase** (`crm-pda-default-rtdb-export.json`, 318 KB). El segundo permitió comprobar
en los datos reales lo que antes eran sospechas:

**Hallazgo 1 — el candado de administrador estaba roto, confirmado.** En `usuarios` hay **3 registros**:
**2 con la clave `u_<username>`** y **solo 1 con el UID** (el de quien publicó la lista al último). Las reglas
preguntan por `child(auth.uid)`, así que **la comprobación solo coincide con un usuario** — y cambia según quién
publique. El índice `admins/<uid>` de esta propuesta lo arregla.

**Hallazgo 2 — escalada de privilegios ABIERTA (esto es lo importante).** El nodo **`arranque` NO existe** en la
base. La regla actual permite escribir `usuarios` cuando `root.child('usuarios/arranque').exists() === false`…
y como ese nodo no existe, **la condición se cumple siempre**: cualquier usuario con correo verificado puede
escribir **su propio registro con `admin: true`** y volverse administrador. No es teórico: la puerta está abierta
hoy.

**Corrección aplicada a la propuesta:** se eliminó la cláusula `arranque` (en los 4 lugares donde estaba).
Ahora escribir `usuarios` —y cambiar `rol`, `admin` o `activo`— exige ser administrador (por el índice) o ser
el correo del dueño. El arranque inicial sigue cubierto porque la primera cuenta que siembra el CRM es la del
dueño. El JSON quedó validado después del cambio.

### Orden obligatorio para publicar (por el índice `admins`)

El índice lo escribe **la app de la v5.0**, todavía no publicada. Si se publican las reglas antes, el segundo
administrador (`jorgefrosas`) perdería sus permisos porque su registro no tiene clave de UID. Entonces:

1. Desplegar la **v5.0**.
2. Que **cada administrador abra el CRM una vez** (eso publica su casilla en `admins`).
3. **Publicar las reglas** y probar con una cuenta de cada rol.
4. Si algo falla: volver a pegar `REGLAS-FIREBASE-v4.8-actuales.txt`.

## 9. Cierre del índice `admins` (7/10/2026)

La app ya **limpia la casilla** del índice cuando un administrador **desactiva**, **cambia de rol** o **quita** a
un usuario (bloque `sincronizarIndiceAdmin`). Para que eso sea posible, la regla de escritura de `admins/$uid`
se amplió: cada quien escribe su casilla **y un administrador puede escribir la de otro** (necesario para
retirarle el permiso a alguien). Sin este paso, un administrador degradado seguiría teniendo permisos hasta que
él mismo volviera a entrar.

**Fase 4 cerrada.** Lo que falta es de la Fase 5: suites completas, medición en el teléfono y despliegue, y
después publicar estas reglas en el orden indicado en el apartado 8.
