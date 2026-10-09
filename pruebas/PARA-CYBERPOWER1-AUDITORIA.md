# Para CyberPower1 — auditoría del CRM v5.0 (8/10/2026)

Jorge pidió una auditoría de congruencia del CRM con **20 prospectos y 2 campañas** en un **sandbox** (el CRM
completo sin nube), con dos equipos: uno que ataca y otro que repara. Esto es lo que se sube al grupo:

| Archivo | Qué es |
|---|---|
| `AUDITORIA-CONGUENCIA-v5.0.25.md` | **El reporte simple**: qué se encontró, cómo quedó y qué falta. Empieza por aquí. |
| `HERRAMIENTAS-AUDITORIA-v5.0.25.zip` | La caja de arena y **todas** las pruebas: `sandbox.mjs` (levanta el CRM sin tocar la base real), `invariantes.mjs` (dinero), `practicantes.mjs` (rol Ventas), `verificar-criticos.mjs` (12 casos) y las 10 familias del equipo rojo + sus reportes (`agente-a/`, `agente-b/`). |
| `index.html` | La versión blindada exacta (sello `2026-10-08.25`, `sha256 96684c1f…`). También está en GitHub (commit `84ecca3`). |

## Lo que hay que saber

1. **La versión ya está en GitHub** (`produccionesdangel-CRM/crm-pda`, rama `main`, commit `84ecca3`, sello
   `2026-10-08.25`) y GitHub Pages la sirve **idéntica byte por byte**. Esta PC ya hizo `git pull`; la de trabajo
   solo necesita `git pull` también.
2. **La auditoría NO tocó la base real de Firebase.** Todo corrió en la caja de arena: copia con la configuración
   inventada, **red bloqueada** hacia `firebaseio.com`/`firebaseapp.com`/`googleapis.com`/`gstatic.com`, y modo local.
   En 61 corridas: **0 peticiones a los dominios de datos**.
3. **Cómo se corre la verificación** (desde `crm-pda`, con Node y Chrome instalados):
   ```powershell
   node pruebas\humo-crm.mjs                      # 208/208
   cmd /c pruebas\motor-v5.cmd                    # 224/224
   node pruebas\sandbox\invariantes.mjs           # el dinero: en verde
   node pruebas\sandbox\practicantes.mjs          # el rol Ventas: en verde
   node pruebas\sandbox\verificar-criticos.mjs    # 12 casos críticos: en verde
   node pruebas\sandbox\agente-a\08-pagos.mjs     # la familia del dinero del equipo rojo
   ```
   El ZIP no trae los resultados crudos (pesan y se regeneran): salen en `pruebas\sandbox\agente-*\resultados*\`
   cada vez que se corre un script.
4. **Lo más importante que se arregló:** anular un pago o un cargo **no persistía y el movimiento revivía al
   recargar**; confirmar un cargo alto **perdía el cargo**; un doble clic creaba **2 contratos de $25,000**; se podía
   **ejecutar código** con un archivo importado; un prospecto creado desde Campañas **rompía la lista de Prospectos**;
   y los teléfonos no tenían ningún candado (WhatsApp abría `wa.me/1`).
5. **Antes de una pasada de verificación, congelar el archivo o subirle el sello.** El equipo rojo documentó que
   `index.html` cambió cinco veces mientras probaba (por los arreglos en paralelo) y que **el sello no basta para
   saber qué revisión se auditó**: hay que anotar el **sha256**.
