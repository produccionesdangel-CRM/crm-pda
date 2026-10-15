/*
 * verificar-rendimiento.mjs — el CRM no se cuelga al volver a la pestaña (12/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge: "después de dejar un tiempo la pestaña abierta y querer usar el CRM de nuevo se cuelga
 * la página y no responde... tarda hasta un minuto". No tenía archivo enlazado.
 *
 * Comprueba, en Chrome sin ventana y contra la copia SIN el SDK de Firebase:
 *   1. La lectura de Excel va a un HILO APARTE (@JS-LECTOR-EN-HILO): con un .xlsx real de 500
 *      filas, el hilo principal queda LIBRE (se comprueba que un temporizador sigue corriendo y
 *      que la interfaz responde mientras se lee).
 *   2. El arranque NO lee las colecciones si la nube no cambió (@JS-ARRANQUE-RAPIDO): basta una
 *      lectura de la versión. Se verifica con el guardián de lecturas.
 *   3. La recarga por cambios de otro usuario NO se hace con la pestaña dormida (@JS-DESPERTAR):
 *      queda anotada y se aplica al volver.
 *   4. Al despertar se avisa en pantalla ANTES de trabajar y se deja pintar (no bloquea).
 *   5. Después de cargar de la nube se dibuja SOLO la sección activa (@JS-DIBUJO-MINIMO).
 *
 * Cómo se corre:  node pruebas\verificar-rendimiento.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9367);
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

const XLSX = path.join(os.tmpdir(), 'formulario-500.xlsx');
const XLSX_GRANDE = path.join(os.tmpdir(), 'formulario-5000.xlsx');
if (!fs.existsSync(XLSX) || !fs.existsSync(XLSX_GRANDE)) {
  /* 14/10/2026: el generador ya vive en el repositorio (antes estaba solo en %TEMP% y se perdía). */
  console.error('Faltan los Excel de prueba. Genera con:\n  node ' + path.join(AQUI, 'generar-xlsx-rendimiento.mjs'));
  process.exit(1);
}
const B64 = fs.readFileSync(XLSX).toString('base64');
const B64_GRANDE = fs.readFileSync(XLSX_GRANDE).toString('base64');

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  /* El CRM publicado se sirve por https (GitHub Pages). Aquí se sirve por http a propósito:
     en file:// Chrome NO deja crear Web Workers, así que el hilo aparte no se podría probar. */
  const puertoHttp = PUERTO + 1;
  const servidor = http.createServer(function (peticion, respuesta) {
    const archivo = path.join(path.dirname(PAGINA), path.basename(decodeURIComponent(peticion.url.split('?')[0])) || 'index-sin-sdk.html');
    fs.readFile(archivo, function (err, datos) {
      if (err) { respuesta.writeHead(404); respuesta.end('no'); return; }
      respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      respuesta.end(datos);
    });
  });
  await new Promise(function (r) { servidor.listen(puertoHttp, '127.0.0.1', r); });
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-rend'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'http://127.0.0.1:' + puertoHttp + '/' + path.basename(PAGINA) });
    await dormir(4500);

    await evaluar(cdp, `(function () {
      cliente = null;
      paquetes = [ { id: 'paq-1', nombre: 'Paquete', descripcion: 'x', precio: 8950, descuento: 0, vigencia: '2026-12-31', fechaRegistro: '2026-01-01', items: [] } ];
      serviciosAdicionales = [];
      prospectos = []; clientes = []; tareas = []; campanias = []; participaciones = []; historial = []; papelera = [];
      usuarioActual = { nombre: 'Jorge', rol: 'Administrador', admin: true, email: 'p@local' };
      ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
      return 1;
    })()`);
    console.log('Archivo: ' + PAGINA);

    console.log('\n1) La lectura del Excel va a un HILO APARTE y no bloquea la pantalla');
    const hilo = JSON.parse(await evaluar(cdp, `(async function () {
      var bin = atob(${JSON.stringify(B64)});
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var hojas = await ImportarProspectos.leerBufferEnHilo('formulario-500.xlsx', bytes.buffer);
      return JSON.stringify({
        hayHilo: ImportarProspectos.usandoHilo(),
        hojas: hojas.length, filas: hojas[0] && hojas[0].filas ? hojas[0].filas.length : 0,
        primera: hojas[0] && hojas[0].filas && hojas[0].filas[0] ? String(hojas[0].filas[0]).substring(0, 60) : ''
      });
    })()`));
    console.log('   hilo aparte en uso: ' + hilo.hayHilo + ' · filas leídas: ' + hilo.filas + ' (500 del formulario + el encabezado)');
    console.log('   primera fila: ' + hilo.primera);
    revisar(hilo.hayHilo === true, 'el navegador está usando el hilo aparte para leer archivos');
    revisar(hilo.filas === 501, 'leyó las 500 filas del Excel más el encabezado (mismo resultado que antes)');

    console.log('\n1b) Con un archivo GRANDE (5,000 filas) la pantalla sigue respondiendo');
    const bloqueo = JSON.parse(await evaluar(cdp, `(async function () {
      var bin = atob(${JSON.stringify(B64_GRANDE)});
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      /* Un reloj cada 25 ms: si la lectura bloqueara el hilo principal, quedaría un hueco. */
      var huecos = [], ultimo = performance.now(), latidos = 0;
      var reloj = setInterval(function () {
        var ahora = performance.now();
        huecos.push(Math.round(ahora - ultimo));
        ultimo = ahora; latidos++;
      }, 25);
      var t0 = performance.now();
      var hojas = await ImportarProspectos.leerBufferEnHilo('formulario-5000.xlsx', bytes.buffer);
      var msLectura = Math.round(performance.now() - t0);
      clearInterval(reloj);
      var peorHueco = huecos.length ? Math.max.apply(null, huecos) : 0;
      return JSON.stringify({ msLectura: msLectura, latidos: latidos, peorHueco: peorHueco,
        filas: hojas[0] && hojas[0].filas ? hojas[0].filas.length : 0 });
    })()`));
    console.log('   Excel de 5,000 filas leído en ' + bloqueo.msLectura + ' ms · latidos: ' + bloqueo.latidos + ' · peor hueco: ' + bloqueo.peorHueco + ' ms');
    revisar(bloqueo.filas === 5001, 'leyó las 5,000 filas');
    revisar(bloqueo.latidos >= 1, 'el hilo principal siguió latiendo durante la lectura (' + bloqueo.latidos + ' veces)');
    revisar(bloqueo.peorHueco < 250 && bloqueo.peorHueco < bloqueo.msLectura, 'NO hubo bloqueo: el peor hueco fue de ' + bloqueo.peorHueco + ' ms (la lectura tardó ' + bloqueo.msLectura + ' ms)');

    console.log('\n2) El arranque no lee las colecciones si la nube no cambió (@JS-ARRANQUE-RAPIDO)');
    const arranque = JSON.parse(await evaluar(cdp, `(async function () {
      /* Se simula: ya sincronizamos una versión y no hay cambios locales. */
      var versión = '2026-10-12T10:00:00.000Z';
      guardarVersionRemota(versión);
      var leidas = [];
      var fakeDb = {
        ref: function (ruta) {
          return {
            once: function () {
              leidas.push(ruta);
              if (ruta === 'version') return Promise.resolve({ val: function () { return { ultimaActualizacion: versión }; } });
              return Promise.resolve({ val: function () { leidas.push('DATOS:' + ruta); return null; } });
            },
            on: function () { }, off: function () { }, limitToLast: function () { return this; }, child: function () { return this; }
          };
        }
      };
      var dbReal = database;
      database = fakeDb;
      sincronizandoFirebase = false;
      limpiarEntidadesSucias();
      ultimaActualizacionRemota = null;
      var antes = performance.now();
      var ok = await cargarDesdeFirebase(false);
      var ms = Math.round(performance.now() - antes);
      database = dbReal;
      return JSON.stringify({ ok: ok, ms: ms, lecturas: leidas, versionRecordada: leerVersionRemota() });
    })()`));
    console.log('   lecturas hechas: ' + JSON.stringify(arranque.lecturas) + ' · ' + arranque.ms + ' ms');
    revisar(arranque.ok === true, 'la carga terminó bien usando los datos locales');
    revisar(arranque.lecturas.length === 1 && arranque.lecturas[0] === 'version', 'solo se leyó la VERSIÓN: ninguna colección (' + arranque.lecturas.length + ' lectura)');
    revisar(arranque.lecturas.filter(function (x) { return String(x).indexOf('DATOS:') === 0; }).length === 0, 'no se leyó ninguna colección de datos');

    console.log('\n3) Con cambios en la nube, la recarga NO se hace con la pestaña dormida (@JS-DESPERTAR)');
    const dormida = JSON.parse(await evaluar(cdp, `(function () {
      /* Se simula el listener de la versión con la pestaña oculta. */
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
      var recargas = 0;
      var original = cargarDesdeFirebase;
      cargarDesdeFirebase = function () { recargas++; return Promise.resolve(true); };
      ultimaActualizacionRemota = '2026-10-12T09:00:00.000Z';
      recargaRemotaPendiente = false;
      /* Se dispara el manejador real del listener de 'version'. */
      var manejador = null;
      var fakeDb = { ref: function (r) { return { on: function (ev, fn) { if (r === 'version' && ev === 'value') manejador = fn; }, child_added: function () { }, limitToLast: function () { return this; } }; } };
      var dbReal = database; database = fakeDb;
      escucharCambiosFirebase();
      database = dbReal;
      /* El primer aviso de 'value' es la carga inicial y se ignora a propósito: se manda dos veces. */
      manejador({ val: function () { return { ultimaActualizacion: '2026-10-12T09:30:00.000Z' }; } });
      manejador({ val: function () { return { ultimaActualizacion: '2026-10-12T11:00:00.000Z' }; } });
      var anotado = recargaRemotaPendiente;
      cargarDesdeFirebase = original;
      Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
      return JSON.stringify({ recargas: recargas, anotado: anotado });
    })()`));
    console.log('   recargas hechas con la pestaña dormida: ' + dormida.recargas + ' · ¿quedó anotada? ' + dormida.anotado);
    revisar(dormida.recargas === 0, 'no se recarga nada mientras la pestaña está en segundo plano');
    revisar(dormida.anotado === true, 'el cambio queda anotado para aplicarlo al volver');

    console.log('\n4) Al despertar se avisa ANTES de trabajar y se deja pintar');
    const despertar = JSON.parse(await evaluar(cdp, `(async function () {
      var estados = [];
      var original = actualizarEstadoSync;
      actualizarEstadoSync = function (e, t) { estados.push(String(t || e)); };
      var llamadas = 0;
      var originalCargar = cargarDesdeFirebase;
      cargarDesdeFirebase = function () { llamadas++; return Promise.resolve(true); };
      recargaRemotaPendiente = true;
      despertarUltimo = 0;
      despertarOcultoDesde = Date.now() - 120000;   /* dos minutos dormida */
      var modoReal = estadoSync.modo;
      var dbReal2 = database;
      estadoSync.modo = 'firebase';                  /* como cuando está conectado de verdad */
      database = { ref: function () { return { once: function () { return Promise.resolve({ val: function () { return {}; } }); } }; } };
      alDespertar();
      var avisoInmediato = estados.slice();          /* lo que ya se pintó, sin esperar */
      await new Promise(function (r) { setTimeout(r, 600); });
      actualizarEstadoSync = original;
      cargarDesdeFirebase = originalCargar;
      estadoSync.modo = modoReal;
      database = dbReal2;
      return JSON.stringify({ avisoInmediato: avisoInmediato, llamadas: llamadas, estados: estados });
    })()`));
    console.log('   aviso inmediato: ' + JSON.stringify(despertar.avisoInmediato) + ' · actualizaciones pedidas: ' + despertar.llamadas);
    revisar(despertar.avisoInmediato.join(' ').indexOf('Despertando') !== -1, 'avisa "Despertando…" en pantalla al instante (antes de trabajar)');
    revisar(despertar.llamadas === 1, 'después hace UNA sola actualización de la nube');

    console.log('\n5) Tras cargar de la nube se dibuja solo la sección activa (@JS-DIBUJO-MINIMO)');
    const dibujo = JSON.parse(await evaluar(cdp, `(function () {
      var contadas = { todo: 0, seccion: [] };
      var originalTodo = renderizarTodo, originalSeccion = renderizarSeccion;
      renderizarTodo = function () { contadas.todo++; };
      renderizarSeccion = function (s) { contadas.seccion.push(s); };
      cambiarSeccion('clientes');
      renderizarTrasCargarNube();
      renderizarTodo = originalTodo; renderizarSeccion = originalSeccion;
      return JSON.stringify(contadas);
    })()`));
    console.log('   ' + JSON.stringify(dibujo));
    revisar(dibujo.todo === 0, 'NO se redibuja todo el CRM');
    revisar(dibujo.seccion.length === 1 && dibujo.seccion[0] === 'clientes', 'se redibuja solo la sección activa (clientes)');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 4).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }
    /* Los avisos de la consola explican por qué el hilo aparte no se pudo crear. */
    const avisos = cdp.sucesos.filter(s => s.method === 'Runtime.consoleAPICalled' && (s.params.type === 'warning' || s.params.type === 'error'))
      .map(s => (s.params.args || []).map(a => a.value || a.description || '').join(' '));
    const delTema = avisos.filter(a => /hilo|Worker|trabajador/i.test(a));
    if (delTema.length) { console.log('\nAvisos sobre el hilo aparte:'); delTema.slice(0, 3).forEach(a => console.log('  · ' + a)); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
    try { servidor.close(); } catch (e) { }
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
