/*
 * verificar-importar.mjs — comprueba los dos arreglos del 9/10/2026 en el módulo
 * de importación de prospectos, en Chrome sin ventana:
 *   1. Que el panel AVISE que una hoja de Google no se puede enlazar (no es un archivo).
 *   2. Que cuando el navegador no puede leer el contenido, el mensaje diga QUÉ falló
 *      (nombre del error) y qué hacer con un archivo que está en la nube.
 * Se corre contra la copia sin el SDK de Firebase (modo local): no toca la nube.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = 9339;
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

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA + ' (generala con node pruebas\\preview-clay.mjs)');
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-importar'), 'about:blank'], { stdio: 'ignore' });
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
        usuarioActual = { nombre: 'Prueba', rol: 'Administrador', admin: true, email: 'prueba@local' };
        ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
        if (App && App.seleccionarSeccion) App.seleccionarSeccion('prospectos');
        return 'ok';
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    console.log('Archivo: ' + PAGINA);
    console.log('Montaje: ' + montar);
    if (montar !== 'ok') throw new Error('No se pudo montar: ' + montar);

    console.log('\n1) El panel avisa que una hoja de Google no se puede enlazar');
    const panel = await evaluar(cdp, `(function () {
      try {
        ImportarProspectos.abrirPanel('archivo');
        var cuerpo = document.getElementById('modal-body');
        var t = cuerpo ? cuerpo.innerText : '';
        return JSON.stringify({
          abierto: !!cuerpo && t.length > 0,
          mencionaSheets: t.indexOf('Google Sheets no se puede enlazar') !== -1,
          mencionaGsheet: t.indexOf('.gsheet') !== -1,
          mencionaDescarga: t.indexOf('Descargar') !== -1,
          mencionaNube: /Disponible sin conexi[oó]n|solo en la nube/.test(t)
        });
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    if (String(panel).indexOf('error:') === 0) throw new Error(panel);
    const p = JSON.parse(panel);
    revisar(p.abierto, 'el panel de importación abre');
    revisar(p.mencionaSheets, 'dice en claro que una hoja de Google no se puede enlazar');
    revisar(p.mencionaGsheet, 'explica que en la PC es un acceso directo .gsheet');
    revisar(p.mencionaDescarga, 'indica bajarla como .xlsx o CSV');
    revisar(p.mencionaNube, 'avisa del archivo que solo está en la nube');

    console.log('\n2) Cuando el navegador no puede leer el contenido, el mensaje dice por qué');
    const err = JSON.parse(await evaluar(cdp, `(function () {
      /* Se reemplaza FileReader por uno que falla como falla Chrome con un archivo
         que está solo en la nube (NotReadableError), para poder comprobar el texto
         sin depender de tener un Drive montado. Se entra por procesarArchivo(),
         que es la función real que lee el archivo elegido a mano. */
      var Original = window.FileReader;
      window.FileReader = function () {
        var self = this;
        this.readAsArrayBuffer = function () {
          setTimeout(function () {
            self.error = { name: 'NotReadableError', message: 'simulado' };
            if (self.onerror) self.onerror({ target: self });
          }, 0);
        };
      };
      return ImportarProspectos.procesarArchivo(new Blob(['x'], { type: 'text/plain' })).then(function () {
        window.FileReader = Original;
        return JSON.stringify({ fallo: false });
      }).catch(function (e) {
        window.FileReader = Original;
        return JSON.stringify({ fallo: true, mensaje: e.message });
      });
    })()`));
    console.log('   mensaje: ' + err.mensaje);
    revisar(err.fallo === true, 'se rechaza la lectura (no se queda colgado)');
    revisar(/NotReadableError/.test(err.mensaje), 'el mensaje incluye el nombre del error del navegador');
    revisar(/Drive|OneDrive/.test(err.mensaje), 'explica que pasa con un archivo que está solo en la nube');
    revisar(/Disponible sin conexi/.test(err.mensaje), 'dice qué hacer (descargarlo)');

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
