/*
 * verificar-orden.mjs — arrastrar para ordenar (items incluidos y sugerencias del catálogo)
 * ---------------------------------------------------------------------------
 * Comprueba, en Chrome sin ventana y contra una copia SIN el SDK de Firebase:
 *   1. Los items incluidos se pueden arrastrar desde el asa y quedan en el orden
 *      que se suelta; al guardar el paquete, ESE orden queda en `items`.
 *   2. Las sugerencias del catálogo se reordenan arrastrando y el orden se guarda
 *      en el campo `orden` de cada servicio (que es lo que viaja a la nube).
 *   3. Un TOQUE sin arrastrar sigue agregando el servicio a la lista (no se rompió
 *      el clic por haber agregado el arrastre).
 *   4. Al volver a abrir el formulario, el orden se respeta.
 *
 * El arrastre se simula con eventos de RATÓN por CDP (Input.dispatchMouseEvent),
 * que es lo que genera eventos de PUNTERO de verdad, igual que el dedo en el
 * teléfono: no se llaman las funciones a mano.
 *
 * Cómo se corre:  node pruebas\verificar-orden.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9343);
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function buscarChrome() {
  for (const c of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')]) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No encontré Chrome');
}

async function esperarCDP(msMax = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < msMax) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const p = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) { }
    await dormir(250);
  }
  throw new Error('Chrome no abrió el puerto');
}

function crearCliente(ws) {
  let id = 0; const pendientes = new Map(); const sucesos = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id); pendientes.delete(m.id);
      m.error ? rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error))) : resolver(m.result);
    } else if (m.method) sucesos.push(m);
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id; pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { enviar, sucesos };
}

async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* Centro de un elemento, en coordenadas de la ventana.
   SIEMPRE se busca dentro de #modal-body: el CRM "aparca" el formulario anterior en
   #modal-aparcadero cuando una ventana se abre encima, y si no se acota, el selector
   encuentra los nodos viejos (que no están a la vista) y el arrastre no hace nada. */
async function centro(cdp, selector) {
  const c = await evaluar(cdp, `(function () {
    var el = document.querySelector('#modal-body ' + ${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!c) throw new Error('No encontré ' + selector);
  return c;
}

/* Arrastre de verdad: presiona, mueve en pasos y suelta. */
async function arrastrar(cdp, selector, dy) {
  const c = await centro(cdp, selector);
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, buttons: 0 });
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', buttons: 1, clickCount: 1 });
  const pasos = 12;
  for (let i = 1; i <= pasos; i++) {
    const y = Math.round(c.y + (dy * i) / pasos);
    await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: y, button: 'left', buttons: 1 });
    await dormir(25);
  }
  const yFinal = Math.round(c.y + dy);
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: yFinal, button: 'left', buttons: 0, clickCount: 1 });
  await dormir(250);
}

/* Un toque simple (sin mover): presionar y soltar en el mismo punto. */
async function tocar(cdp, selector) {
  const c = await centro(cdp, selector);
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y, buttons: 0 });
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', buttons: 0, clickCount: 1 });
  await dormir(250);
}

/* Arrastre con el DEDO (eventos táctiles de verdad, como en el teléfono). */
async function arrastrarTacto(cdp, selector, dy, dx = 0) {
  const c = await centro(cdp, selector);
  const punto = (x, y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }];
  await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(c.x, c.y) });
  await dormir(40);
  for (let i = 1; i <= 12; i++) {
    await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(Math.round(c.x + (dx * i) / 12), Math.round(c.y + (dy * i) / 12)) });
    await dormir(30);
  }
  await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await dormir(350);
}

const SEMILLA = `
  paquetes = [ { id: 'paq-1', nombre: 'Paquete de prueba', descripcion: 'Para probar el orden',
    precio: 10000, descuento: 0, vigencia: '2026-12-31', fechaRegistro: '2026-10-01',
    items: [ { tipo: 'personalizado', nombre: 'Uno', cantidad: 1 },
             { tipo: 'personalizado', nombre: 'Dos', cantidad: 1 },
             { tipo: 'personalizado', nombre: 'Tres', cantidad: 1 },
             { tipo: 'personalizado', nombre: 'Cuatro', cantidad: 1 },
             { tipo: 'personalizado', nombre: 'Cinco', cantidad: 1 } ] } ];
  serviciosAdicionales = [
    { id: 'srv-1', nombre: 'Alfa', precio: 100, vigencia: '2026-12-31' },
    { id: 'srv-2', nombre: 'Beta', precio: 100, vigencia: '2026-12-31' },
    { id: 'srv-3', nombre: 'Gamma', precio: 100, vigencia: '2026-12-31' },
    { id: 'srv-4', nombre: 'Delta', precio: 100, vigencia: '2026-12-31' },
    { id: 'srv-5', nombre: 'Epsilon', precio: 100, vigencia: '2026-12-31' }
  ];
  clientes = []; prospectos = []; tareas = []; campanias = []; participaciones = []; historial = []; papelera = [];
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-orden'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'file:///' + PAGINA.replace(/\\/g, '/') });
    await dormir(4500);

    const montar = await evaluar(cdp, `(function () {
      try {
        if (typeof firebase !== 'undefined') return 'ABORTADO: firebase se cargó';
        ${SEMILLA}
        usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'prueba@local' };
        ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
        mostrarFormularioPaquete(paquetes[0]);
        return 'ok';
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    console.log('Archivo: ' + PAGINA);
    if (montar !== 'ok') throw new Error('No se pudo montar: ' + montar);

    const leerOrden = `(function () {
      return JSON.stringify({
        items: [].slice.call(document.querySelectorAll('#modal-body .paquete-item-fila .item-nombre')).map(function (n) { return n.textContent; }),
        chips: [].slice.call(document.querySelectorAll('#modal-body .sugerido-chip')).map(function (c) { return c.getAttribute('data-nombre'); }),
        asas: document.querySelectorAll('#modal-body .paquete-item-fila .asa-arrastrar').length,
        formularios: document.querySelectorAll('#modal-body #form-paquete').length,
        aparcados: document.querySelectorAll('#modal-aparcadero #form-paquete').length
      });
    })()`;

    console.log('\n1) Estado inicial');
    const inicial = JSON.parse(await evaluar(cdp, leerOrden));
    console.log('   items: ' + inicial.items.join(' · '));
    console.log('   sugerencias: ' + inicial.chips.join(' · '));
    revisar(inicial.asas === 5, 'cada item trae su asa para arrastrar (5)');
    revisar(inicial.formularios === 1 && inicial.aparcados === 0, 'hay UN solo formulario abierto (nada aparcado)');
    revisar(inicial.items.join(',') === 'Uno,Dos,Tres,Cuatro,Cinco', 'los items salen en su orden');
    revisar(inicial.chips.join(',') === 'Alfa,Beta,Gamma,Delta,Epsilon', 'las sugerencias salen en el orden del catálogo');

    console.log('\n2) Arrastrar el 3er item (Tres) hasta arriba');
    const altoFila = await evaluar(cdp, `(function () {
      var f = document.querySelectorAll('#modal-body .paquete-item-fila');
      return f.length > 1 ? Math.round(f[1].getBoundingClientRect().top - f[0].getBoundingClientRect().top) : 40;
    })()`);
    await arrastrar(cdp, '.paquete-item-fila:nth-child(3) .asa-arrastrar', -(altoFila * 3));
    const trasArrastre = JSON.parse(await evaluar(cdp, leerOrden));
    console.log('   items: ' + trasArrastre.items.join(' · '));
    revisar(trasArrastre.items[0] === 'Tres', 'el item arrastrado quedó primero');
    revisar(trasArrastre.items.indexOf('Uno') === 1, 'los demás corrieron su lugar (Uno quedó segundo)');

    console.log('\n3) Al guardar el paquete, el orden queda guardado');
    await evaluar(cdp, `(function () { document.getElementById('form-paquete').requestSubmit(); return 1; })()`);
    await dormir(700);
    const guardado = JSON.parse(await evaluar(cdp, `(function () {
      return JSON.stringify({
        items: (paquetes[0].items || []).map(function (i) { return i.nombre; }),
        cerrado: !document.getElementById('form-paquete')
      });
    })()`));
    console.log('   guardado: ' + guardado.items.join(' · '));
    revisar(guardado.items.join(',') === 'Tres,Uno,Dos,Cuatro,Cinco', 'el paquete quedó con el orden nuevo en `items`');

    console.log('\n4) Arrastrar una sugerencia (Gamma) hasta el principio');
    await evaluar(cdp, `(function () { mostrarFormularioPaquete(paquetes[0]); return 1; })()`);
    await dormir(400);
    const anchoChip = await evaluar(cdp, `(function () {
      var cs = document.querySelectorAll('#modal-body .sugerido-chip');
      return cs.length > 1 ? Math.round(cs[1].getBoundingClientRect().left - cs[0].getBoundingClientRect().left) : 80;
    })()`);
    /* Las sugerencias se acomodan en varias columnas: se arrastra hacia ARRIBA con un
       movimiento lateral para caer antes que la primera. */
    const c3 = await centro(cdp, '.sugerido-chip:nth-child(3)');
    const c1 = await centro(cdp, '.sugerido-chip:nth-child(1)');
    await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c3.x, y: c3.y, buttons: 0 });
    await cdp.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: c3.x, y: c3.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 12; i++) {
      const x = Math.round(c3.x + ((c1.x - c3.x) * i) / 12);
      const y = Math.round(c3.y + ((c1.y - c3.y) * i) / 12);
      await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
      await dormir(25);
    }
    await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1.x, y: c1.y, button: 'left', buttons: 0, clickCount: 1 });
    await dormir(500);
    const chips = JSON.parse(await evaluar(cdp, `(function () {
      return JSON.stringify({
        enPantalla: [].slice.call(document.querySelectorAll('#modal-body .sugerido-chip')).map(function (c) { return c.getAttribute('data-nombre'); }),
        catalogo: serviciosAdicionales.map(function (s) { return s.nombre + ':' + s.orden; }),
        pendientes: typeof contarEntidadesSucias === 'function' ? contarEntidadesSucias() : -1
      });
    })()`));
    console.log('   sugerencias en pantalla: ' + chips.enPantalla.join(' · '));
    console.log('   catálogo guardado: ' + chips.catalogo.join(' · '));
    revisar(chips.enPantalla[0] === 'Gamma', 'la sugerencia arrastrada quedó primera');
    revisar(chips.catalogo[0].indexOf('Gamma') === 0, 'el CATÁLOGO quedó con ese orden (viaja a la nube)');
    revisar(/Gamma:10/.test(chips.catalogo.join(' ')), 'el campo `orden` quedó guardado (10, 20, 30…)');
    revisar(chips.pendientes > 0, 'el cambio quedó marcado para subir a la nube');

    console.log('\n5) Un TOQUE en una sugerencia sigue agregando el servicio');
    const antes = await evaluar(cdp, 'document.querySelectorAll("#modal-body .paquete-item-fila").length');
    await tocar(cdp, '.sugerido-chip:nth-child(2)');
    const despues = await evaluar(cdp, `(function () {
      return JSON.stringify({
        filas: document.querySelectorAll('#modal-body .paquete-item-fila').length,
        ultimo: (function () { var f = document.querySelectorAll('#modal-body .paquete-item-fila .item-nombre'); return f.length ? f[f.length - 1].textContent : ''; })()
      });
    })()`);
    const d = JSON.parse(despues);
    console.log('   items: ' + antes + ' → ' + d.filas + ' (agregado: "' + d.ultimo + '")');
    revisar(d.filas === antes + 1, 'el toque agregó el servicio a la lista de items');

    console.log('\n6) Al reabrir, el orden se respeta');
    await evaluar(cdp, `(function () { cerrarModal(); mostrarFormularioPaquete(paquetes[0]); return 1; })()`);
    await dormir(400);
    const reabierto = JSON.parse(await evaluar(cdp, leerOrden));
    console.log('   items: ' + reabierto.items.join(' · '));
    console.log('   sugerencias: ' + reabierto.chips.join(' · '));
    revisar(reabierto.items[0] === 'Tres', 'los items conservan el orden nuevo');
    revisar(reabierto.chips[0] === 'Gamma', 'las sugerencias conservan el orden nuevo');

    console.log('\n7) En el TELÉFONO no se arrastra: el gesto queda para hacer scroll');
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await dormir(500);
    await evaluar(cdp, `(function () { cerrarModal(); mostrarFormularioPaquete(paquetes[0]); return 1; })()`);
    await dormir(500);
    const movil = JSON.parse(await evaluar(cdp, `(function () {
      var a = document.querySelector('#modal-body .asa-arrastrar');
      var chip = document.querySelector('#modal-body .sugerido-chip');
      return JSON.stringify({
        asa: a ? getComputedStyle(a).display : '(no hay)',
        chipTouchAction: chip ? getComputedStyle(chip).touchAction : '(no hay)',
        items: [].slice.call(document.querySelectorAll('#modal-body .paquete-item-fila .item-nombre')).map(function (n) { return n.textContent; }),
        chips: [].slice.call(document.querySelectorAll('#modal-body .sugerido-chip')).map(function (c) { return c.getAttribute('data-nombre'); })
      });
    })()`));
    console.log('   asa: ' + movil.asa + ' · touch-action del chip: ' + movil.chipTouchAction);
    revisar(movil.asa === 'none', 'en el teléfono el asa no se ve (no estorba)');
    revisar(movil.chipTouchAction !== 'none', 'el chip deja hacer scroll con el dedo (no se atora)');

    const altoMovil = await evaluar(cdp, `(function () {
      var f = document.querySelectorAll('#modal-body .paquete-item-fila');
      return f.length > 1 ? Math.round(f[1].getBoundingClientRect().top - f[0].getBoundingClientRect().top) : 40;
    })()`);
    await arrastrarTacto(cdp, '.paquete-item-fila:nth-child(2)', -(altoMovil * 2));
    await arrastrarTacto(cdp, '.sugerido-chip:nth-child(4)', 0, -140);
    const trasMovil = JSON.parse(await evaluar(cdp, `(function () {
      return JSON.stringify({
        items: [].slice.call(document.querySelectorAll('#modal-body .paquete-item-fila .item-nombre')).map(function (n) { return n.textContent; }),
        chips: [].slice.call(document.querySelectorAll('#modal-body .sugerido-chip')).map(function (c) { return c.getAttribute('data-nombre'); }),
        catalogo: serviciosAdicionales.map(function (s) { return s.nombre; })
      });
    })()`));
    revisar(trasMovil.items.join(',') === movil.items.join(','), 'deslizar el dedo sobre los items NO los reordena');
    revisar(trasMovil.chips.join(',') === movil.chips.join(','), 'deslizar el dedo sobre las sugerencias NO las reordena');
    revisar(trasMovil.catalogo.join(',') === 'Gamma,Alfa,Beta,Delta,Epsilon', 'el catálogo queda intacto');

    const antesTacto = await evaluar(cdp, 'document.querySelectorAll("#modal-body .paquete-item-fila").length');
    await tocar(cdp, '.sugerido-chip:nth-child(1)');
    const despuesTacto = await evaluar(cdp, 'document.querySelectorAll("#modal-body .paquete-item-fila").length');
    console.log('   toque en una sugerencia: ' + antesTacto + ' → ' + despuesTacto + ' item(s)');
    revisar(despuesTacto === antesTacto + 1, 'en el teléfono, TOCAR una sugerencia sí la agrega');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 4).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
