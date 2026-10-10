/*
 * calendario-mes.mjs — navegación por meses del calendario (el salto de un mes)
 * ---------------------------------------------------------------------------
 * Qué comprueba, en Chrome sin ventana con pantalla de teléfono (390 x 844):
 *   1. Cuántos escuchas de clic quedan pegados en cada botón cableado.
 *   2. Cuánto avanza el calendario con UN clic en "siguiente" y "anterior".
 *   3. Que el salto de año siga funcionando (Diciembre → Enero y Enero → Diciembre).
 *   4. Que el resto del cableado siga VIVO (menú del teléfono, tema, nueva campaña,
 *      filtros plegables y "ver todos" del historial): son los botones que el mismo
 *      defecto dejaba mudos o invertidos, y los que toca el arreglo.
 *
 * Por qué dos escenarios: el arranque del CRM puede entrar DOS veces a
 * iniciarAplicacion() (así está documentado en el propio código, pasa en el
 * teléfono al volver de Google). Con el cableado por addEventListener, la
 * segunda entrada deja DOS escuchas en el mismo botón y un solo clic avanza
 * dos meses. El primer escenario (una entrada) reproduce la PC; el segundo
 * (dos entradas) reproduce el teléfono: es el caso que reportó Jorge.
 *
 * Cómo se corre:  node pruebas\calendario-mes.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.resolve(AQUI, '..', 'index.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9337);

/* Botones del HTML fijo que cablea conectarEventListenersApp(): cada uno debe
   quedar con UN solo escucha, entre una y dos entradas al arranque. */
const CABLEADOS = ['btn-mes-anterior', 'btn-mes-siguiente', 'btn-mes-actual', 'btn-mobile-menu',
  'btn-colapsar', 'historial-toggle-ver-todos', 'btn-nueva-campania', 'btn-limpiar-campanias',
  'btn-nuevo-prospecto', 'btn-nuevo-cliente', 'btn-limpiar-informes'];

function buscarChrome() {
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  throw new Error('No encontré Chrome');
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

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
  let id = 0;
  const pendientes = new Map();
  const sucesos = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error))) : resolver(m.result);
    } else if (m.method) sucesos.push(m);
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id;
    pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { enviar, sucesos };
}

async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* Deja la página lista: contador de escuchas (por id) + la app entrando N veces.
   Se cuentan DOS formas de cablear un clic, porque el CRM usa las dos:
     · addEventListener('click', …)  → se acumula si la función de cableado corre dos veces
     · elemento.onclick = …          → REEMPLAZA al anterior (no se puede acumular)
   Un botón bien cableado tiene UNO de los dos, nunca los dos ni dos del mismo tipo. */
async function preparar(cdp, entradas) {
  return await evaluar(cdp, `(function () {
    try {
      window.__escuchas = {};
      window.__onclicks = {};
      if (!window.__addEventListenerOriginal) {
        window.__addEventListenerOriginal = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (tipo, fn, opts) {
          if (tipo === 'click' && this && this.id) {
            window.__escuchas[this.id] = (window.__escuchas[this.id] || 0) + 1;
          }
          return window.__addEventListenerOriginal.call(this, tipo, fn, opts);
        };
      }
      if (!window.__onclickDescriptor) {
        window.__onclickDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onclick');
        Object.defineProperty(HTMLElement.prototype, 'onclick', {
          configurable: true,
          get: function () { return window.__onclickDescriptor.get.call(this); },
          set: function (fn) {
            if (this && this.id) window.__onclicks[this.id] = (window.__onclicks[this.id] || 0) + 1;
            return window.__onclickDescriptor.set.call(this, fn);
          }
        });
      }
      usuarioActual = { nombre: 'Prueba', rol: 'Administrador', admin: true, email: 'prueba@local' };
      for (var i = 0; i < ${entradas}; i++) iniciarAplicacion();
      App.seleccionarSeccion('calendario');
      return 'ok';
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`);
}

/* El mes que se ve en el título, como número absoluto (año * 12 + mes). */
async function mesVisible(cdp) {
  return await evaluar(cdp, `(function () {
    var t = (document.getElementById('calendario-mes-ano') || {}).textContent || '';
    var p = t.trim().split(/\\s+/);
    var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var m = meses.indexOf(p[0]);
    return { texto: t.trim(), absoluto: (m < 0 || !p[1]) ? null : (parseInt(p[1], 10) * 12 + m) };
  })()`);
}

/* Un clic de verdad, con el ratón, en el centro del elemento. */
async function clicEn(cdp, selector) {
  const caja = await evaluar(cdp, `(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!caja) throw new Error('No encontré ' + selector);
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: caja.x, y: caja.y, button: 'left', clickCount: 1 });
  await cdp.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: caja.x, y: caja.y, button: 'left', clickCount: 1 });
  await dormir(160);
}
const clic = (cdp, id) => clicEn(cdp, '#' + id);

/* El resto del cableado tiene que seguir respondiendo con dos entradas al arranque. */
async function revisarCableado(cdp, revisar) {
  console.log('   resto del cableado (con el arranque entrando dos veces):');

  const menu = await evaluar(cdp, `(function () {
    var b = document.getElementById('btn-mobile-menu');
    if (!b) return 'sin botón';
    b.click();
    var s = document.getElementById('sidebar');
    return (s && s.classList.contains('mobile-abierto')) ? 'abierto' : 'cerrado';
  })()`);
  revisar(menu === 'abierto', 'un toque en el menú del teléfono ABRE la barra lateral (' + menu + ')');
  await evaluar(cdp, `(function () { document.getElementById('btn-mobile-menu').click(); return 1; })()`);

  const tema = await evaluar(cdp, `(function () {
    var op = document.querySelector('.tema-opcion[data-tema="light"]');
    if (!op) return 'sin opción';
    op.click();
    var t = document.documentElement.getAttribute('data-theme');
    document.querySelector('.tema-opcion[data-tema="dark"]').click();
    return t;
  })()`);
  revisar(tema === 'light', 'un toque en el tema "claro" SÍ cambia el tema (' + tema + ')');

  const camp = await evaluar(cdp, `(function () {
    var b = document.getElementById('btn-nueva-campania');
    if (!b) return 'sin botón';
    b.click();
    var m = document.getElementById('modal');
    var abierto = !!(m && m.classList.contains('active'));
    try { cerrarModal(); } catch (e) {}
    return abierto ? 'abierto' : 'cerrado';
  })()`);
  revisar(camp === 'abierto', 'un toque en "Nueva campaña" abre el asistente (' + camp + ')');

  const filtro = await evaluar(cdp, `(function () {
    var b = document.querySelector('#calendario .btn-toggle-filtros') || document.querySelector('.btn-toggle-filtros');
    if (!b) return 'sin botón';
    b.click();
    var c = document.getElementById(b.dataset.target);
    return (c && c.classList.contains('mobile-visible')) ? 'abierto' : 'cerrado';
  })()`);
  revisar(filtro === 'abierto', 'un toque en "Filtros" los ABRE (no los abre y cierra) (' + filtro + ')');

  const historial = await evaluar(cdp, `(function () {
    try { App.seleccionarSeccion('configuracion'); } catch (e) { return 'error: ' + e.message; }
    var b = document.getElementById('historial-toggle-ver-todos');
    if (!b) return 'sin botón';
    var antes = b.innerHTML.trim();
    b.click();
    var despues = document.getElementById('historial-toggle-ver-todos').innerHTML.trim();
    try { App.seleccionarSeccion('calendario'); } catch (e) {}
    return antes === despues ? ('no cambió: ' + antes) : 'cambió';
  })()`);
  revisar(historial === 'cambió', '"Ver todos los movimientos" cambia con un toque (' + historial + ')');
}

async function escenario(cdp, URL, entradas, etiqueta, fallos, conCableado) {
  const revisar = (ok, texto) => { if (!ok) fallos.n++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };
  await cdp.enviar('Page.navigate', { url: URL });
  await dormir(4000);
  const prep = await preparar(cdp, entradas);
  if (prep !== 'ok') { console.log('   FALLA  no se pudo preparar: ' + prep); fallos.n++; return; }

  const esc = await evaluar(cdp, 'JSON.stringify(window.__escuchas)');
  const escuchas = JSON.parse(esc || '{}');
  const onc = await evaluar(cdp, 'JSON.stringify(window.__onclicks)');
  const onclicks = JSON.parse(onc || '{}');
  /* El total de cableados de clic de un botón = escuchas + onclicks. Sirve igual para
     detectar el bug del salto: lo que no puede pasar es que queden DOS. */
  const totalClics = (id) => (escuchas[id] || 0) + (onclicks[id] || 0);
  const conDoble = CABLEADOS.filter(id => totalClics(id) > 1);

  console.log('── ' + etiqueta + ' (' + entradas + ' entrada(s) al arranque)');
  console.log('   cableados ‹ = ' + totalClics('btn-mes-anterior') + ' · › = ' + totalClics('btn-mes-siguiente') +
    ' · menú = ' + totalClics('btn-mobile-menu') + ' · ver todos = ' + totalClics('historial-toggle-ver-todos') +
    '   (escuchas ‹ = ' + (escuchas['btn-mes-anterior'] || 0) + ' · › = ' + (escuchas['btn-mes-siguiente'] || 0) + ')');
  revisar(totalClics('btn-mes-anterior') === 1 && totalClics('btn-mes-siguiente') === 1,
    'cada botón del mes tiene UN solo cableado de clic (‹ = ' + totalClics('btn-mes-anterior') + ', › = ' + totalClics('btn-mes-siguiente') + ')');
  revisar(conDoble.length === 0, 'ningún botón cableado quedó con clics repetidos' + (conDoble.length ? ' (' + conDoble.join(', ') + ')' : ''));

  const antes = await mesVisible(cdp);
  await clic(cdp, 'btn-mes-siguiente');
  const trasSiguiente = await mesVisible(cdp);
  console.log('   "siguiente": ' + antes.texto + '  →  ' + trasSiguiente.texto);
  revisar(trasSiguiente.absoluto - antes.absoluto === 1, 'un clic en "siguiente" avanza UN mes (avanzó ' + (trasSiguiente.absoluto - antes.absoluto) + ')');

  const antes2 = await mesVisible(cdp);
  await clic(cdp, 'btn-mes-siguiente');
  const tras2 = await mesVisible(cdp);
  console.log('   "siguiente" otra vez: ' + antes2.texto + '  →  ' + tras2.texto);
  revisar(tras2.absoluto - antes2.absoluto === 1, 'el segundo clic también avanza UN mes');

  await clic(cdp, 'btn-mes-anterior');
  const trasAtras = await mesVisible(cdp);
  console.log('   "anterior": ' + tras2.texto + '  →  ' + trasAtras.texto);
  revisar(trasAtras.absoluto === antes2.absoluto, 'un clic en "anterior" retrocede UN mes');

  await clic(cdp, 'btn-mes-actual');
  const trasHoy = await mesVisible(cdp);
  console.log('   "Hoy": ' + trasAtras.texto + '  →  ' + trasHoy.texto);
  revisar(trasHoy.absoluto === antes.absoluto, '"Hoy" vuelve al mes de hoy (' + antes.texto + ')');

  /* Salto de año: se camina hasta Diciembre y se pasa a Enero. */
  let m = await mesVisible(cdp);
  for (let i = 0; i < 14 && m.absoluto % 12 !== 11; i++) { await clic(cdp, 'btn-mes-siguiente'); m = await mesVisible(cdp); }
  const dic = await mesVisible(cdp);
  await clic(cdp, 'btn-mes-siguiente');
  const ene = await mesVisible(cdp);
  console.log('   salto de año: ' + dic.texto + '  →  ' + ene.texto);
  revisar(dic.absoluto % 12 === 11, 'se llegó a Diciembre (' + dic.texto + ')');
  revisar(ene.absoluto === dic.absoluto + 1, 'Diciembre pasa a Enero del año siguiente (' + ene.texto + ')');
  await clic(cdp, 'btn-mes-anterior');
  const vuelta = await mesVisible(cdp);
  revisar(vuelta.absoluto === dic.absoluto, 'Enero regresa a Diciembre (' + vuelta.texto + ')');

  if (conCableado) await revisarCableado(cdp, revisar);
}

async function main() {
  const chrome = spawn(buscarChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-calendario-mes'), 'about:blank'
  ], { stdio: 'ignore' });

  const URL = 'file:///' + PAGINA.replace(/\\/g, '/');
  const fallos = { n: 0 };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable');
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    console.log('Archivo: ' + PAGINA + '\n');

    await escenario(cdp, URL, 1, 'PC / una sola entrada', fallos, false);
    console.log('');
    await escenario(cdp, URL, 2, 'Teléfono / dos entradas (el caso de Jorge)', fallos, true);

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 6).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos.n === 0 ? 'TODO EN VERDE' : fallos.n + ' comprobaciones fallaron'));
    process.exitCode = fallos.n === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
