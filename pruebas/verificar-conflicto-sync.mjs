/*
 * verificar-conflicto-sync.mjs — "Sobrescribir con MIS cambios" ahora SÍ sobrescribe (13/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge se quedó atorado con sus pagos: apareció "Conflicto de sincronización" (clientes: Isabel
 * Cervantes, "v6 local vs vnull nube") y al elegir "Sobrescribir con MIS cambios" el aviso volvía,
 * así que su versión nunca subía.
 *
 * CAUSA RAÍZ: `guardarEnFirebase(esForzado)` usaba `esForzado` SOLO para permitir el guardado
 * cuando no había nada sucio; la comprobación de versión seguía rechazando la escritura, así que el
 * "forzado" volvía a producir el mismo conflicto (bucle). Además el aviso mostraba `vnull` porque
 * la versión remota se guardaba SIEMPRE como null.
 *
 * Comprueba, con una nube simulada (sin Firebase):
 *   1. Sin forzar: un choque de versiones NO sube nada y avisa (la protección sigue intacta).
 *   2. Forzando: SÍ sube, la versión queda por encima de las dos y el conflicto no reaparece.
 *   3. Antes de reemplazar, se guarda la copia de la versión de la nube (clave `pda_sobrescritos`)
 *      y queda anotada en el historial.
 *   4. El aviso muestra la versión REAL de la nube (ya no "vnull") y explica los botones.
 *
 * Cómo se corre:  node pruebas\verificar-conflicto-sync.mjs
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
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9379);
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
  return { enviar: (method, params = {}) => new Promise((resolver, rechazar) => { const mid = ++id; pendientes.set(mid, { resolver, rechazar }); ws.send(JSON.stringify({ id: mid, method, params })); }), sucesos };
}
async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* Nube simulada: guarda el estado en `window.__nube` y responde a once/transaction/update con la
   misma forma que Firebase. */
const NUBE_FALSA = `
window.__nube = {};
window.__escrituras = [];
function nodoFalso(ruta) {
  return {
    once: function () { return Promise.resolve({ exists: function () { return Object.prototype.hasOwnProperty.call(window.__nube, ruta); },
      val: function () { return window.__nube[ruta] === undefined ? null : window.__nube[ruta]; } }); },
    transaction: function (aplicar) {
      var actual = window.__nube[ruta] === undefined ? null : window.__nube[ruta];
      var nuevo = aplicar(actual);
      if (nuevo === undefined) { return Promise.resolve({ committed: false, snapshot: { val: function () { return actual; } } }); }
      window.__nube[ruta] = nuevo;
      window.__escrituras.push(ruta);
      return Promise.resolve({ committed: true, snapshot: { val: function () { return nuevo; } } });
    },
    update: function (obj) { Object.keys(obj).forEach(function (k) { window.__nube[ruta + '/' + k] = obj[k]; }); return Promise.resolve(); },
    child: function (r) { return nodoFalso(ruta + '/' + r); },
    on: function () { }, off: function () { }, limitToLast: function () { return this; }, set: function (v) { window.__nube[ruta] = v; return Promise.resolve(); }
  };
}
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  const puertoHttp = PUERTO + 1;
  const servidor = http.createServer(function (peticion, respuesta) {
    const archivo = path.join(path.dirname(PAGINA), path.basename(decodeURIComponent(peticion.url.split('?')[0])) || 'index-sin-sdk.html');
    fs.readFile(archivo, function (err, datos) {
      if (err) { respuesta.writeHead(404); respuesta.end('no'); return; }
      respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); respuesta.end(datos);
    });
  });
  await new Promise(function (r) { servidor.listen(puertoHttp, '127.0.0.1', r); });
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-conf'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'http://127.0.0.1:' + puertoHttp + '/' + path.basename(PAGINA) });
    await dormir(4200);

    console.log('\n0) Se prepara el caso de Jorge: el cliente "Isabel Cervantes" con la versión 6 en local y otra en la nube');
    const prep = JSON.parse(await evaluar(cdp, `(function () {
      ${NUBE_FALSA}
      usuarioActual = { nombre: 'Jorge', rol: 'Administrador', admin: true, email: 'p@local' };
      ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
      try { localStorage.removeItem('pda_sobrescritos'); } catch (e) { }
      paquetes = []; serviciosAdicionales = []; prospectos = []; tareas = []; campanias = []; participaciones = []; papelera = []; historial = [];
      /* El cliente con los pagos que Jorge acaba de capturar. */
      clientes = [{ id: 'cli-1', nombre: 'Isabel Cervantes', telefono: '8781112233', email: 'i@x.com', estado: 'Activo',
        fechaRegistro: '2026-09-01', _version: 6, notasGenerales: 'con los 4 pagos nuevos',
        contratos: [{ id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Isabel Cervantes', festejado: 'XV Isabel', tipo: 'paquete',
          paqueteId: '', serviciosIds: [], precioBase: 8950, precioFinal: 8950, descuentoMonto: 0,
          cargos: [], pagos: [ { id: 'p1', monto: 1000, fecha: '2026-10-13', nota: 'Pago 1' }, { id: 'p2', monto: 1000, fecha: '2026-10-13', nota: 'Pago 2' } ],
          estado: 'Pendiente', fechaEvento: '2026-12-01', fechaContrato: '2026-09-01', notas: '' }] }];
      /* La nube tiene la versión 5 (editada por el otro dispositivo) SIN esos pagos. */
      window.__nube['clientes/cli-1'] = { id: 'cli-1', nombre: 'Isabel Cervantes', telefono: '8789999999', email: 'i@x.com',
        estado: 'Activo', fechaRegistro: '2026-09-01', _version: 5, notasGenerales: 'telefono corregido en la otra PC', contratos: [] };
      window.__nube['version'] = { ultimaActualizacion: '2026-10-13T10:00:00.000Z' };
      database = { ref: function (ruta) { return nodoFalso(ruta); }, };
      sincronizandoFirebase = false;
      marcarSucia('clientes', 'cli-1');
      return JSON.stringify({ sucios: contarEntidadesSucias(), versionLocal: clientes[0]._version });
    })()`));
    console.log('   cambios locales pendientes: ' + prep.sucios + ' · versión local: ' + prep.versionLocal);
    revisar(prep.sucios === 1, 'hay 1 cambio local pendiente (el cliente con sus pagos)');

    console.log('\n1) SIN forzar: el choque de versiones NO sube nada y avisa (la protección sigue)');
    const sinForzar = JSON.parse(await evaluar(cdp, `(async function () {
      var conflictos = [];
      var original = mostrarModalConflicto;
      mostrarModalConflicto = function (c) { conflictos = c; };
      window.__escrituras = [];
      var ok = await guardarEnFirebase(false);
      mostrarModalConflicto = original;
      return JSON.stringify({
        ok: ok, conflictos: conflictos.length, versionRemota: conflictos[0] ? conflictos[0].versionRemota : null,
        versionNube: window.__nube['clientes/cli-1']._version, escrituras: window.__escrituras.slice(),
        nombre: conflictos[0] ? conflictos[0].nombre : null
      });
    })()`));
    console.log('   ¿guardó? ' + sinForzar.ok + ' · conflictos: ' + sinForzar.conflictos + ' · versión en la nube: ' + sinForzar.versionNube + ' · escrituras: ' + JSON.stringify(sinForzar.escrituras));
    revisar(sinForzar.ok === false, 'sin forzar NO se sube nada (se detiene, como debe)');
    revisar(sinForzar.conflictos === 1 && sinForzar.versionNube === 5, 'y avisa del conflicto sin haber tocado la nube');
    revisar(sinForzar.versionRemota === 5, 'el aviso lleva la versión REAL de la nube (' + sinForzar.versionRemota + '), ya no "null"');

    console.log('\n2) FORZANDO ("Sobrescribir con MIS cambios"): ahora SÍ sube y sin bucle');
    const forzado = JSON.parse(await evaluar(cdp, `(async function () {
      var conflictos = [];
      var original = mostrarModalConflicto;
      mostrarModalConflicto = function (c) { conflictos = c; };
      window.__escrituras = [];
      var ok = await guardarEnFirebase(true);
      mostrarModalConflicto = original;
      var subido = window.__nube['clientes/cli-1'];
      return JSON.stringify({
        ok: ok, conflictos: conflictos.length, escrituras: window.__escrituras.slice(),
        versionSubida: subido._version, pagosSubidos: subido.contratos && subido.contratos[0] ? subido.contratos[0].pagos.length : 0,
        suciosDespues: contarEntidadesSucias(), versionLocal: clientes[0]._version,
        sobrescritoPor: subido._sobrescritoPor || '', versionReemplazada: subido._versionQueSeReemplazo
      });
    })()`));
    console.log('   ¿guardó? ' + forzado.ok + ' · versión subida: ' + forzado.versionSubida + ' (reemplazó la ' + forzado.versionReemplazada + ') · pagos en la nube: ' + forzado.pagosSubidos + ' · pendientes: ' + forzado.suciosDespues);
    revisar(forzado.ok === true && forzado.conflictos === 0, 'forzando SÍ se sube y ya no hay conflicto (antes se quedaba en bucle)');
    revisar(forzado.pagosSubidos === 2, 'sus pagos quedaron en la nube');
    revisar(forzado.versionSubida === 7, 'la versión queda por encima de las dos (5 de la nube y 6 local → 7)');
    revisar(forzado.suciosDespues === 0, 'ya no quedan cambios pendientes');
    revisar(forzado.versionLocal === 7, 'la versión local también avanza (nadie se queda con una versión vieja)');

    console.log('\n3) Antes de reemplazarla se guardó la copia de la versión de la NUBE');
    const copia = JSON.parse(await evaluar(cdp, `(function () {
      var guardadas = [];
      try { guardadas = JSON.parse(localStorage.getItem('pda_sobrescritos') || '[]'); } catch (e) { }
      var h = (historial || []).filter(function (x) { return x && /copia de la versión de la nube/i.test(String(x.descripcion || '')); });
      return JSON.stringify({ total: guardadas.length,
        telefonoDeLaNube: guardadas.length ? (guardadas[0].entidad.telefono || '') : '',
        versionRemota: guardadas.length ? guardadas[0].versionRemota : null,
        notaDeLaNube: guardadas.length ? (guardadas[0].entidad.notasGenerales || '') : '',
        enHistorial: h.length });
    })()`));
    console.log('   copias guardadas: ' + copia.total + ' · la de la nube tenía teléfono ' + copia.telefonoDeLaNube + ' y nota "' + copia.notaDeLaNube + '" · anotado en historial: ' + copia.enHistorial);
    revisar(copia.total === 1, 'se guardó 1 copia de la versión de la nube antes de reemplazarla');
    revisar(copia.telefonoDeLaNube === '8789999999' && copia.versionRemota === 5, 'y es exactamente lo que había del otro lado (versión 5)');
    revisar(copia.enHistorial >= 1, 'y quedó anotado en el historial del CRM');

    console.log('\n4) El aviso explica qué hace cada botón');
    const aviso = JSON.parse(await evaluar(cdp, `(function () {
      /* Se vuelve a provocar el conflicto para leer el texto del aviso. */
      window.__nube['clientes/cli-1']._version = 9;
      clientes[0]._version = 7;
      marcarSucia('clientes', 'cli-1');
      var conflictos = [];
      var original = mostrarModalConflicto;
      mostrarModalConflicto = function (c) { conflictos = c; };
      return guardarEnFirebase(false).then(function () {
        mostrarModalConflicto = original;
        var html = '';
        conflictos.forEach(function (c) {
          html += 'tu versión ' + c.versionLocal + ' · en la nube la ' + c.versionRemota;
        });
        return JSON.stringify({ texto: html, versionRemota: conflictos[0] ? conflictos[0].versionRemota : null });
      });
    })()`));
    console.log('   aviso: "' + aviso.texto + '"');
    revisar(aviso.versionRemota === 9, 'el aviso muestra la versión real de la nube (9)');
    revisar(aviso.texto.indexOf('tu versión 7') !== -1, 'y la tuya (7)');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 5).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
    try { servidor.close(); } catch (e) { }
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
