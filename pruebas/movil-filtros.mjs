/*
 * movil-filtros.mjs — ¿abren los filtros en un TELÉFONO? (y siguen viéndose en la PC)
 * ---------------------------------------------------------------------------
 * Qué hace: abre el CRM REAL (`..\index.html`) en Chrome sin ventana, con la
 * pantalla y el tacto de un teléfono (390 x 844, táctil, 3x), entra saltándose
 * el login de Google (el acceso no se prueba aquí) y TOCA el botón "Filtros"
 * de cada sección con un toque de verdad (Input.dispatchTouchEvent).
 *
 * Mide TRES escenarios:
 *   1. Teléfono, entrando UNA vez.
 *   2. Teléfono, entrando DOS veces (pasa cuando el regreso de Google y el
 *      arranque normal coinciden: cada entrada vuelve a conectar los botones).
 *   3. Escritorio (1280 px): el botón queda oculto y los filtros se ven solos.
 *
 * Para qué: en la PC los filtros se ven siempre, así que un fallo que solo pasa
 * en el teléfono NO se ve a ojo en el escritorio.
 *
 * Cómo se corre:  node pruebas\movil-filtros.mjs
 * Sale con código 0 si todo está en verde.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAGINA = process.env.CRM_ARCHIVO
  ? path.resolve(process.env.CRM_ARCHIVO)
  : path.resolve(AQUI, '..', 'index.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9333);

const SECCIONES = [
  ['informes', 'filtros-informes'],
  ['prospectos', 'filtros-prospectos'],
  ['campanias', 'filtros-campanias'],
  ['clientes', 'filtros-clientes'],
  ['contratos', 'filtros-contratos'],
  ['paquetes', 'filtros-paquetes'],
  ['servicios', 'filtros-servicios'],
  ['calendario', 'filtros-calendario']
];

/* Rutas de Chrome que se han visto en las PCs de Jorge. */
function buscarChrome() {
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  throw new Error('No encontré Chrome. Rutas probadas:\n' + candidatos.join('\n'));
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function esperarCDP(msMax = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < msMax) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
      const lista = await r.json();
      const pagina = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pagina) return pagina;
    } catch (e) { /* todavía no levanta */ }
    await dormir(250);
  }
  throw new Error('Chrome no abrió el puerto de depuración ' + PUERTO);
}

function crearCliente(ws) {
  let id = 0;
  const pendientes = new Map();
  const sucesos = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id);
      pendientes.delete(m.id);
      if (m.error) rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error)));
      else resolver(m.result);
    } else if (m.method) {
      sucesos.push(m);
    }
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id;
    pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { enviar, sucesos };
}

/* Un toque REAL en el centro del elemento (no un .click() de JavaScript). */
async function tocar(cdp, x, y) {
  const punto = [{ x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8, force: 1, id: 1 }];
  await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto });
  await dormir(60);
  await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await dormir(350);
}

async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', {
    expression: expresion, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

async function irASeccion(cdp, seccion) {
  await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('${seccion}'); } catch (e) {} return 1; })()`);
  await dormir(250);
}

/* Estado del botón y del panel de una sección. */
function guionEstado(idPanel) {
  return `(function () {
    var p = document.getElementById('${idPanel}');
    var b = document.querySelector('.btn-toggle-filtros[data-target="${idPanel}"]');
    if (!p || !b) return { falta: true, panel: !!p, boton: !!b };
    var rb = b.getBoundingClientRect();
    return {
      falta: false,
      display: getComputedStyle(p).display,
      visible: p.getBoundingClientRect().height > 0,
      alto: Math.round(p.getBoundingClientRect().height),
      clases: p.className,
      botonVisible: getComputedStyle(b).display !== 'none' && rb.height > 0,
      x: rb.left + rb.width / 2, y: rb.top + rb.height / 2
    };
  })()`;
}

/* Recorre las 8 secciones en el teléfono: abre con un toque y cierra con otro. */
async function recorrerTelefono(cdp, vecesIniciar) {
  const entrada = await evaluar(cdp, `(function () {
    try {
      usuarioActual = { nombre: 'Prueba Movil', rol: 'Administrador', admin: true, email: 'prueba@local' };
      var veces = ${vecesIniciar};
      for (var i = 0; i < veces; i++) iniciarAplicacion();
      return 'ok';
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`);

  const filas = [];
  for (const [seccion, idPanel] of SECCIONES) {
    await irASeccion(cdp, seccion);
    const antes = await evaluar(cdp, guionEstado(idPanel));

    if (antes.falta) {
      filas.push({ seccion, resultado: 'NO EXISTE', detalle: 'panel=' + antes.panel + ' boton=' + antes.boton });
      continue;
    }
    if (!antes.botonVisible) {
      filas.push({ seccion, resultado: 'sin botón (PC)', detalle: '' });
      continue;
    }

    await tocar(cdp, antes.x, antes.y);              // primer toque: abre
    const abierto = await evaluar(cdp, guionEstado(idPanel));
    await tocar(cdp, antes.x, antes.y);              // segundo toque: cierra
    const cerrado = await evaluar(cdp, guionEstado(idPanel));

    const abre = abierto.display !== 'none' && abierto.visible;
    const cierra = cerrado.display === 'none';
    filas.push({
      seccion,
      resultado: abre ? (cierra ? 'ABRE y CIERRA ✅' : 'ABRE, NO CIERRA ⚠') : 'NO ABRE ❌',
      detalle: 'antes ' + antes.display + ' → al toque ' + abierto.display + ' (' + abierto.alto + 'px) → ' +
        'otro toque ' + cerrado.display + ' · clases: "' + abierto.clases + '"'
    });
  }
  return { entrada, filas };
}

/* En la PC el botón no debe verse y los filtros deben estar visibles solos. */
async function revisarEscritorio(cdp) {
  const filas = [];
  for (const [seccion, idPanel] of SECCIONES) {
    await irASeccion(cdp, seccion);
    const e = await evaluar(cdp, guionEstado(idPanel));
    if (e.falta) { filas.push({ seccion, resultado: 'NO EXISTE', detalle: '' }); continue; }
    const botonOculto = !e.botonVisible;
    const filtrosVisibles = e.display !== 'none' && e.visible;
    filas.push({
      seccion,
      resultado: (botonOculto && filtrosVisibles) ? 'filtros visibles ✅' : 'REVISAR ❌',
      detalle: 'botón ' + (botonOculto ? 'oculto' : 'VISIBLE (no debería)') + ' · panel ' + e.display + ' (' + e.alto + 'px)'
    });
  }
  return filas;
}

async function main() {
  /* Antes de abrir el navegador: revisión estática del emparejamiento.
     En el teléfono los filtros se pliegan; un `.filtros-container` SIN su botón queda
     escondido para siempre (le pasaba a la pestaña de Participantes de una campaña). */
  const fuente = fs.readFileSync(PAGINA, 'utf8');
  const botones = [...fuente.matchAll(/class="btn-toggle-filtros"[^>]*data-target="([^"]+)"/g)].map(m => m[1]);
  const paneles = [...fuente.matchAll(/class="filtros-container"[^>]*id="([^"]+)"/g)].map(m => m[1]);
  const sinBoton = paneles.filter(p => !botones.includes(p));
  const sinPanel = botones.filter(b => !paneles.includes(b));
  console.log('EMPAREJAMIENTO botón ↔ panel: ' + paneles.length + ' paneles · ' + botones.length + ' botones');
  console.log('  ' + (sinBoton.length === 0 && sinPanel.length === 0
    ? 'todos los paneles de filtros tienen su botón ✅'
    : 'REVISAR ❌' + (sinBoton.length ? ' · sin botón: ' + sinBoton.join(', ') : '') + (sinPanel.length ? ' · sin panel: ' + sinPanel.join(', ') : '')));
  console.log('');

  const chrome = spawn(buscarChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-movil-chrome'),
    'about:blank'
  ], { stdio: 'ignore' });

  const URL = 'file:///' + PAGINA.replace(/\\/g, '/');
  let cdp;
  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    cdp = crearCliente(ws);

    await cdp.enviar('Page.enable');
    await cdp.enviar('Runtime.enable');
    await cdp.enviar('Log.enable');

    async function telefono() {
      await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    }
    async function escritorio() {
      await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: false });
    }

    console.log('Archivo:  ' + PAGINA);

    await telefono();
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4000); // que el arranque (almacén local) termine
    console.log('Ventana:  ' + await evaluar(cdp, 'window.innerWidth + " x " + window.innerHeight + " (táctil) · móvil=" + window.matchMedia("(max-width: 768px)").matches'));
    console.log('');

    let fallos = sinBoton.length + sinPanel.length;
    const escenarios = [
      [1, 'TELÉFONO · entrando UNA vez (sesión ya guardada)'],
      [2, 'TELÉFONO · entrando DOS veces (regreso de Google + arranque)']
    ];

    for (const [veces, titulo] of escenarios) {
      if (veces === 2) { await cdp.enviar('Page.navigate', { url: URL }); await dormir(4000); }
      const { entrada, filas } = await recorrerTelefono(cdp, veces);
      console.log(titulo + '   [' + entrada + ']');
      console.log('Sección        Resultado                 Qué pasó');
      console.log('─'.repeat(104));
      for (const f of filas) {
        if (!f.resultado.includes('✅')) fallos++;
        console.log((f.seccion + '               ').slice(0, 15) + (f.resultado + '                         ').slice(0, 26));
        if (f.detalle) console.log('               ↳ ' + f.detalle);
      }
      console.log('');
    }

    // 3) Escritorio: aquí Jorge nunca tuvo el problema, hay que dejarlo igual.
    await escritorio();
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4000);
    await evaluar(cdp, `(function () {
      usuarioActual = { nombre: 'Prueba PC', rol: 'Administrador', admin: true, email: 'prueba@local' };
      iniciarAplicacion(); return 'ok';
    })()`);
    console.log('ESCRITORIO · ' + await evaluar(cdp, 'window.innerWidth + " px · móvil=" + window.matchMedia("(max-width: 768px)").matches'));
    console.log('Sección        Resultado                 Qué pasó');
    console.log('─'.repeat(104));
    for (const f of await revisarEscritorio(cdp)) {
      if (!f.resultado.includes('✅')) fallos++;
      console.log((f.seccion + '               ').slice(0, 15) + (f.resultado + '                         ').slice(0, 26));
      if (f.detalle) console.log('               ↳ ' + f.detalle);
    }
    console.log('');

    const errores = cdp.sucesos
      .filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) {
      console.log('Errores en la página (' + errores.length + '):');
      errores.slice(0, 8).forEach(e => console.log('  · ' + String(e).split('\n')[0]));
      console.log('');
    }

    console.log(fallos === 0
      ? 'TODO EN VERDE: los filtros abren y cierran en el teléfono, y en la PC se siguen viendo.'
      : fallos + ' comprobaciones fallaron.');
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
