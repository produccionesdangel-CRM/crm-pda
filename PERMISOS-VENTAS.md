# Rol de Ventas — matriz de permisos (decidida por Jorge el 6/10/2026)

> Fuente: respuestas de Jorge a las 5 decisiones importantes y a las 9 de detalle.
> Este documento manda. Si el código dice algo distinto, el código está mal.

## 1. Los tres roles

| Rol | Quién | Nota |
|---|---|---|
| **Administrador** | Jorge y su cuenta principal | todo, incluidos usuarios, papelera y respaldos |
| **Operador** | los que ya estaban | **conservan los permisos que ya tenían** (no se les cambia nada) |
| **Ventas** *(nuevo)* | captación y cobro en mostrador | la matriz de abajo |

## 2. Qué puede hacer el rol Ventas

| Función | Permitido | Detalle |
|---|---|---|
| Prospectos | ✅ total | ver, crear, editar, borrar (va a **papelera**, recuperable por un admin), convertir a cliente |
| Campañas | ✅ operar | ver y trabajar las campañas; agregar participantes, mover etapas, registrar contactos y resultados |
| **Activar/pausar/finalizar campañas** | ❌ | **solo Administrador** (el motor tiene la regla "solo una campaña activa opera") |
| Tareas de campaña | ✅ | crear, completar, reabrir, editar |
| Tareas manuales asignadas | ✅ | **solo las suyas**; no ve las de los demás usuarios |
| Clientes | ✅ ver y editar | **no puede borrar** (ya está así en el CRM) |
| Contratos | ✅ crear y editar datos | **no puede borrar**; **el precio sale del catálogo y no se edita a mano** |
| Contrato nuevo | ⚠️ nace **"Por autorizar"** | un administrador lo valida; hasta entonces no cuenta como cerrado |
| Pagos | ✅ **agregar** | ❌ **no puede editar ni borrar** un pago ya registrado |
| **Comprobantes de pago** | ✅ **imprimir y enviar** | *corrección de Jorge*: los necesita cuando un cliente llega a pagar |
| Imprimir contrato | ❌ | solo Administrador (lleva el desglose completo del precio) |
| WhatsApp | ✅ | mensajes **individuales** al cliente o prospecto; nada masivo |
| Calendario | ✅ | tareas de clientes y eventos de campaña |
| Panel (campañas) | ✅ **solo lo suyo** | sus campañas y sus asignaciones; **sin cifras globales de dinero** |
| Informes | ❌ | no ve la sección |
| Paquetes y Servicios | ❌ | no ve las secciones ni puede crear/editar/borrar |
| Papelera | ❌ | no la ve en Configuración |
| Usuarios | ❌ | no puede agregar, editar ni eliminar usuarios |
| Exportar / Importar respaldo | ❌ | **no puede sacar respaldos de los datos** |
| Tema del CRM | ✅ | puede cambiar los colores a su gusto |
| Bloqueo al abrir | ❌ sin PIN | **solo cuenta de Google** (decisión de Jorge) |
| Fases comerciales | ✅ hasta **Negociación** | la fase *Contrato* la pone el sistema al crear el contrato |

## 3. Cómo se implementa (para no repetir el error del CRM completo)

1. **Una sola tabla de capacidades** (`CAPACIDADES[rol] = { ... }`) y un único `puede('accion')`.
   Nada de repartir `if (rol === 'ventas')` por el archivo: así, cuando se agregue un cuarto rol,
   se toca un solo lugar.
2. Se conservan los candados que **ya existen** y funcionan (`esAdmin()`, la clase `solo-admin`,
   los permisos validados contra la base en cada operación): el rol nuevo se suma, no los reemplaza.
3. **Guardas dobles**: la interfaz oculta la sección y la operación vuelve a validar el permiso.
   Ocultar un botón no es seguridad.

## 4. Dos límites honestos, para que no se prometa de más

1. **Hoy el CRM se descarga TODO al entrar.** Un usuario de Ventas tendría en su navegador los
   paquetes, los servicios y los informes aunque no los vea. Para que "no los vea" sea de verdad hay
   que **dejar de cargar esas colecciones según el rol** y **negarlas también en las reglas de
   Firebase**. Jorge ya autorizó tocar las reglas; el orden correcto es:
   respaldo exportado y verificado → reglas → código → probar.
2. **Tensión a resolver (necesita su respuesta):** si Ventas no puede ver el catálogo, ¿cómo elige el
   paquete al crear un contrato? Dos caminos:
   - **(a) Recomendado:** el formulario de contrato de Ventas **no muestra el catálogo**. Escribe el
     monto y el concepto a mano, y el admin asigna después el paquete y el precio definitivo.
     Coherente con "el contrato nace Por autorizar".
   - **(b)** Ventas ve una **lista de precios de solo lectura** (nombre y precio) dentro del formulario
     de contrato, pero no entra a la sección Paquetes ni edita nada del catálogo.
   Con (a) las reglas pueden negar la lectura de `/paquetes` y `/serviciosAdicionales`; con (b) deben
   permitirla solo para lectura.

## 5. Reglas de Firebase: qué tienen que lograr

- Que un usuario con rol **Ventas** **no pueda escribir** en `paquetes`, `serviciosAdicionales`,
  `usuarios`, `papelera` ni en el campo de precio de un contrato ya autorizado.
- Que **no pueda borrar** clientes ni contratos (aunque la interfaz ya lo impide).
- Que **nadie** pueda alterar `historial` (es la auditoría) ni los campos de auditoría
  (`creadoPor`, `actualizadoPor`, `fechaCreacion`).
- Que una participación no pueda existir sin su campaña y su prospecto
  (`root.child('campanias').child($id).exists()`).
- Que los precios y condiciones **guardados dentro de una participación** (la oferta que se le hizo al
  cliente) no se puedan reescribir desde el cliente.
- El rol se lee de `/usuarios/<username>` en el servidor, **no** de lo que diga el navegador.
