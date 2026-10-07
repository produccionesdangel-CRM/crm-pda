# CRM PDA v5.0 — entrega para la PC de trabajo (Cyberpower1)

**Versión:** 5.0 · **sello de compilación:** `2026-10-07.6` · **fecha:** 7 de octubre de 2026

## Qué es esto

El CRM que ya está **en producción** (https://produccionesdangel-crm.github.io/crm-pda/), con el
**motor de campañas del CRM Lite** integrado, el **rol de Ventas** y las correcciones de seguridad.
Todo lo de aquí ya está desplegado y probado. Se entrega para que puedas **revisarlo, depurarlo o ajustarlo**.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | **La aplicación completa** (un solo archivo, ~1 MB). Es lo que se publica en GitHub Pages. |
| `NOTAS-v5.0.md` | Qué cambió, qué no, cómo se probó y los límites conocidos. |
| `DESPLIEGUE-v5.0.md` | Cómo publicarlo, cómo comprobarlo y **cómo volver atrás**. |
| `PERMISOS-VENTAS.md` | La matriz de permisos del rol de Ventas, punto por punto. |
| `PLAN-v5.0.md` | El plan de integración completo, fase por fase, con lo verificado en cada una. |
| `REGLAS-FIREBASE-v5.0-propuesta.json` | Las reglas **que ya están publicadas** en Firebase (cópialas de aquí si hay que republicar). |
| `REGLAS-FIREBASE-v5.0-cambios.md` | Por qué cambió cada regla, incluida la auditoría final contra todo lo que la app escribe. |
| `REGLAS-FIREBASE-v4.8-actuales.txt` | **Las reglas anteriores.** Es el botón de regreso si algo falla. |
| `pruebas/` | Las pruebas automáticas y las herramientas de medición (abajo). |

## Las pruebas (por si tocas algo)

```bat
rem  Las 224 pruebas originales del CRM Lite, corridas contra el motor que quedó dentro del CRM
pruebas\motor-v5.cmd

rem  Las 128 comprobaciones propias del CRM (arranque, menú, datos, vistas, roles, regresión)
node pruebas\humo-crm.mjs
```

- **224/224** en verde — el motor de campañas: los 16 criterios de aceptación.
- **128/128** en verde — el CRM completo, incluidos los permisos de cada rol.

**Si cambias `index.html` y quieres regenerar la copia del motor que usan las pruebas:**
`powershell -NoProfile -ExecutionPolicy Bypass -File pruebas\preparar-motor-v5.ps1`
(necesita la carpeta del CRM Lite en `Documentos`).

### Herramientas de medición y utilidades

| Archivo | Para qué |
|---|---|
| `pruebas\medir-movil.html` | Mide en el teléfono cuánto tarda en bajar y ejecutar el CRM publicado. |
| `pruebas\servir.mjs` | Servidor local (`node pruebas\servir.mjs 8095`) para probar sin publicar. Sirve además el punto `/medicion`, donde la página de medición deja su resultado. |
| `pruebas\verificar-respaldo.mjs` | Revisa un respaldo exportado y dice cuántos registros trae, sin mostrar datos de clientes. |

## Cosas que conviene saber antes de tocar

1. **El título de las ventanas es TEXTO PLANO** (`modalTitulo.textContent`) y **los avisos escapan el mensaje**
   (`escapeHTML`). Si les pasas etiquetas HTML, **se ven escritas en pantalla**. Ya pasó una vez y está cubierto por
   una prueba; no lo reintroduzcas.
2. **Los botones del encabezado de una sección no los conecta** `conectarListadoCampanias()`: esa función solo
   alcanza lo que está dentro de la lista que se redibuja. Los botones fijos se conectan en
   `conectarEventListenersApp()`. También pasó una vez y hay prueba.
3. **El índice `admins/<uid>`** es lo que consultan las reglas. La app publica la casilla de cada quien **al iniciar
   sesión**, y **antes** de la lista de usuarios: si se invierte el orden, un administrador sin casilla **no puede
   inscribirse nunca**.
4. **El repositorio es de la cuenta `produccionesdangel-CRM`** (con `CRM` en mayúsculas). La otra cuenta
   (`jorgefrosas-dotcom`) **no tiene permiso de escritura**: si git pide credenciales, hay que entrar con la primera.
5. **El archivo se guarda en LF** (saltos de línea de Linux), no CRLF. Al escribir desde PowerShell, usa
   `-join "`n"`; `WriteAllLines` mete CRLF y rompe la comparación byte a byte con lo publicado.

## Estado

- Publicado y verificado: el archivo servido por GitHub Pages es **idéntico** al de esta carpeta.
- Reglas de Firebase: **publicadas**.
- Pendiente: las **pruebas reales de Jorge creando la campaña de diciembre** y la comprobación por rol
  (que el segundo administrador vea la papelera tras recargar, y que el operador guarde sin avisos).
