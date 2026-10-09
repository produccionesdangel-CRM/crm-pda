# Caja de arena del CRM — probar sin tocar la base real

Esta carpeta levanta **el CRM completo** (`index.html`) en una copia aislada, con datos de
prueba, **sin nube**. Existe porque las pruebas de datos incongruentes y de estrés tienen que
usar el software de verdad… pero no pueden acercarse a la base de producción de Jorge.

## Las tres capas que lo protegen (ninguna es opcional)

1. **Configuración inventada.** La copia de `index.html` lleva `apiKey`, `projectId`,
   `databaseURL`, etc. cambiados por valores de un proyecto que no existe.
   Si algo intentara hablar con la nube, no habría a dónde llegar.
2. **Red bloqueada.** El navegador arranca con `firebaseio.com`, `firebaseapp.com`,
   `googleapis.com` y `gstatic.com` bloqueados. Sin el SDK (gstatic) la app arranca en
   **modo local**, que es un modo que ya existe y está probado.
3. **Revisión antes de usar.** `preparar()` lee la copia y, si encontrara la apiKey real,
   el `projectId` o la `databaseURL` de producción, **no la escribe y avisa**. Después de cada
   corrida, `cerrar()` informa cuántas peticiones hubo y si alguna fue a los datos reales
   (lo esperado: **cero**).

> **Nunca** quites estas capas ni apuntes una prueba al proyecto real.
> La copia vive en `%TEMP%\crm-sandbox\` — no se guarda en el repositorio.

## Cómo se usa

```bash
cd C:\Users\noman\Documents\deepseek-harness\crm-pda

# Prepara la copia y la revisa (no abre navegador)
node pruebas\sandbox\sandbox.mjs preparar

# Prepara, abre, entra sin Google, siembra 20 prospectos + 2 campañas y saca una captura
node pruebas\sandbox\sandbox.mjs probar

# Los invariantes de clientes, contratos y pagos (lo que NUNCA se puede romper)
node pruebas\sandbox\invariantes.mjs

# Capturas del sandbox con los 20 prospectos y las 2 campañas
node pruebas\sandbox\capturas-sembrado.mjs
```

Desde otro script, el módulo se importa:

```js
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from '../sandbox.mjs';
const info = preparar();
const s = await abrir({ info, ancho: 390, alto: 844, movil: true });  // Chrome sin ventana + táctil
await entrar(s);                       // entra sin Google (usuario de prueba)
const sembrado = await sembrar(s);     // 20 prospectos, 2 campañas, 24 participaciones
// helpers: s.evaluar(js) · s.tocar(x, y) · s.esperar(ms) · s.captura('nombre') · s.red.peticiones
await s.cerrar();
```

## Qué hay en cada archivo

| Archivo | Qué es |
|---|---|
| `sandbox.mjs` | El corazón: prepara la copia aislada, la sirve por HTTP local, abre Chrome sin ventana, entra sin Google y siembra los datos. |
| `invariantes.mjs` | Revisa que el dinero cuadre (contrato = pagos + saldo) después de cada operación, y prueba los errores típicos de un practicante con prisa: pago mayor al saldo, pago repetido, monto con letras, editar un contrato con pagos. Deja `invariantes-resultado.json`. |
| `capturas-sembrado.mjs` | Capturas de Prospectos, Campañas y Calendario con los datos sembrados (evidencia de que es el CRM real). |
| `agente-a/` | Los scripts y el reporte del **equipo rojo** (el que intenta romper la congruencia a propósito). |
| `agente-b/` | Los scripts del **equipo azul** (el que repara y bloquea lo que no tenía candado). |

## Cómo se leen los resultados

- Cada script imprime una línea por comprobación: `OK` o `FALLA`, y termina con
  `TODO EN VERDE` o el número de fallas (código de salida 0 o 1).
- En los ataques, el veredicto es: **CANDADO OK** (la app rechazó con mensaje claro),
  **HUECO** (aceptó el dato incongruente en silencio), **ROTO** (excepción de JavaScript) o
  **DUPLICA** (creó dos veces el mismo registro).
- La línea final de red debe decir **«a los datos reales: ninguna»**. Si dijera otra cosa,
  hay que parar y revisar antes de seguir.
