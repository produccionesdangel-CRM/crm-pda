# Desplegar la v5.0 del CRM — guía paso a paso

> Escrita para hacerse **sin prisa y con respaldo hecho**. La v5.0 está probada (94 comprobaciones en verde)
> y el respaldo del 6/10 está verificado, así que se puede publicar; aun así, sigue el orden.

## Antes de empezar

- [x] Respaldo exportado desde el CRM (`registro_pda_2026-10-06.json`) — **verificado**.
- [x] Volcado completo de Firebase (`crm-pda-default-rtdb-export.json`) — **verificado**.
- [ ] Elegir un momento de poco movimiento (el CRM lo usa tu equipo a diario).
- [ ] Tener a mano el `index.html` **de la versión anterior** por si hay que volver atrás:
      está en `parche-v4.8.9\index.html` (y en GitHub, en el historial de commits).

## Paso 1 — Publicar el archivo

El CRM es **un solo archivo**: `C:\Users\noman\Documents\deepseek-harness\crm-pda\index.html`
(repositorio `produccionesdangel-crm/crm-pda`, rama `main`).

**Opción A — Desde el navegador (la más simple, sin instalar nada):**

1. Entra a `https://github.com/produccionesdangel-CRM/crm-pda`.
2. Botón **Add file → Upload files**.
3. Arrastra el `index.html` de la carpeta de arriba (reemplaza el que está).
4. Abajo, escribe el mensaje: *"v5.0: campañas, rol de Ventas y seguridad"* → **Commit changes**.

**Opción B — Con GitHub Desktop** (si lo tienes instalado): abrir el repositorio, pegar el archivo nuevo y
*Commit to main* → *Push origin*.

**Opción C — Con git desde una consola** (necesita tus credenciales; no las guardo ni las pido):

```
cd C:\Users\noman\Documents\deepseek-harness\crm-pda
git checkout main
git merge v5.0
git push origin main
```

## Paso 2 — Comprobar que quedó publicado

1. Espera 1 o 2 minutos (GitHub publica solo; en *Actions* se ve el proceso en verde).
2. Abre `https://produccionesdangel-crm.github.io/crm-pda/` y **recarga forzado** (`Ctrl + Shift + R`).
3. Abajo a la izquierda debe decir **v5.0**, y en Configuración → Información de la versión:
   **Versión 5.0** y sello **build 2026-10-07.1**.
4. Entra y revisa que el menú tenga, en orden:
   **Informes · Panel · Prospectos · Campañas · Clientes · Contratos · Paquetes · Servicios · Calendario · Configuración**.

## Paso 3 — Cada administrador abre el CRM una vez

Eso publica su casilla en el índice de administradores (`admins/<uid>`), que es lo que consultan las reglas.
Sin este paso, el segundo administrador perdería permisos al publicar las reglas.

## Paso 4 — Publicar las reglas de Firebase

Solo **después** del paso 3:

1. Firebase → Realtime Database → **Reglas**.
2. Pegar el contenido de `REGLAS-FIREBASE-v5.0-propuesta.json` → **Publicar**.
3. Probar con una cuenta de cada rol (abajo).

**Si algo falla:** volver a pegar `REGLAS-FIREBASE-v4.8-actuales.txt` → Publicar. Ya está en el repositorio
justamente para eso.

## Paso 5 — Probar con los tres roles

| Rol | Qué debe pasar |
|---|---|
| **Administrador** | Todo como siempre; además Panel y Campañas |
| **Operador** | Igual que antes: Informes, contratos e impresión; **no** activa campañas ni entra a la papelera |
| **Ventas** | Prospectos, campañas (operarlas), tareas, clientes y contratos sin borrar, agregar pagos e imprimir **comprobantes**; **sin** Informes, sin papelera, sin usuarios, sin respaldos; paquetes y servicios en **solo lectura** |

Y en un teléfono: abrir el CRM, entrar, y revisar que cargue con comodidad (el archivo pasó de 614 KB a ~1 MB).

## Cómo volver atrás

1. Subir otra vez el `index.html` anterior (`parche-v4.8.9\index.html`).
2. Si el problema son las reglas: volver a pegar `REGLAS-FIREBASE-v4.8-actuales.txt`.
3. Los datos no corren riesgo: la v5.0 **solo agrega** dos colecciones nuevas (`campanias` y `participaciones`);
   si se vuelve a la versión anterior, simplemente se ignoran.