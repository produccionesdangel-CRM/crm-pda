/*
 * verificar-login-google.mjs — acceso con Google Identity Services (13/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge no puede entrar desde su iPhone: en iOS todos los navegadores usan WebKit, así que el
 * acceso por ventana emergente no funciona y el de redirección pierde la sesión (Safari borra los
 * datos de otro sitio: la sesión vive en `crm-pda.firebaseapp.com` y el CRM en
 * `produccionesdangel-crm.github.io`).
 *
 * La solución definitiva (@JS-GOOGLE-GIS) es el botón oficial de Google (Identity Services), que
 * devuelve el id_token DIRECTAMENTE a la página: sin redirecciones y sin cookies de terceros. Aquí
 * se cambia por una sesión de Firebase con `signInWithCredential`, y a partir de ahí el CRM sigue
 * su camino normal (`onAuthStateChanged`).
 *
 * Comprueba, con Google y Firebase SIMULADOS (no se toca nada real):
 *   0. El archivo que se publica YA trae el "Web client ID" puesto (por eso el iPhone no tiene que
 *      configurar nada: el botón oficial aparece solo, desde la pantalla de login). 14/10/2026.
 *   1. Sin cliente de Google configurado, el CRM se comporta como siempre (no rompe nada).
 *   2. Con cliente configurado: se carga el script de Google, se inicializa, se dibuja el botón
 *      oficial y se muestra la caja.
 *   3. Al recibir la credencial: se llama a GoogleAuthProvider.credential(id_token) y a
 *      signInWithCredential (sin redirección ni ventana emergente).
 *   4. Si la credencial falla, se avisa en pantalla (no se queda mudo).
 *   5. El diagnóstico del login muestra el estado de Google Identity Services.
 *
 * Cómo se corre:  node pruebas\verificar-login-google.mjs
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
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9383);
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
    '--disable-extensions', '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-gis'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    /* Se bloquea Google y Firebase de verdad, y se simulan con objetos falsos. */
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*', '*accounts.google.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 2, mobile: true });
    await cdp.enviar('Page.navigate', { url: 'http://127.0.0.1:' + puertoHttp + '/' + path.basename(PAGINA) });
    await dormir(4200);

    console.log('\n0) El archivo que se publica YA trae el cliente de Google puesto (el iPhone entra sin configurarse)');
    const traeCliente = JSON.parse(await evaluar(cdp, `(function () {
      /* Se lee del propio archivo: no se escribe aquí el identificador real (regla del sandbox:
         los arneses no llevan datos de producción escritos). */
      var c = clienteGoogleConfigurado();
      var linea = (textoDiagnosticoLogin().split('\\n').filter(function (l) { return l.indexOf('google gis') === 0; })[0] || '').trim();
      return JSON.stringify({ tiene: !!c, forma: /\\.apps\\.googleusercontent\\.com$/.test(String(c)), linea: linea });
    })()`));
    console.log('   cliente puesto en el archivo: ' + (traeCliente.tiene ? 'sí' : 'NO') + ' · con la forma correcta (*.apps.googleusercontent.com): ' + traeCliente.forma + ' · diagnóstico: ' + traeCliente.linea);
    revisar(traeCliente.tiene === true, 'el CRM trae el Web client ID puesto en el propio archivo');
    revisar(traeCliente.forma === true, 'y tiene la forma de un Web client ID (*.apps.googleusercontent.com)');

    console.log('\n1) Sin cliente de Google configurado, el CRM se comporta como siempre');
    const sinCliente = JSON.parse(await evaluar(cdp, `(function () {
      /* La app arranca en la pantalla de login (sin Firebase, sin sesión).
         Se vacía el cliente (el del archivo y el guardado) para probar el camino de siempre. */
      GOOGLE_CLIENT_ID = '';
      window.PDA_GOOGLE_CLIENT_ID = '';
      try { localStorage.removeItem('pda_google_client_id'); } catch (e) {}
      gisListo = false; gisPromesaCarga = null;
      var caja = document.getElementById('login-gis-caja');
      var btn = document.getElementById('btn-login-google');
      return JSON.stringify({
        cajaOculta: !caja || caja.style.display !== 'block',
        botonDeSiempre: !!btn && btn.style.display !== 'none',
        diagnostico: textoDiagnosticoLogin().indexOf('SIN CONFIGURAR') !== -1,
        enPantalla: document.getElementById('pantalla-login').className.indexOf('oculta') === -1
      });
    })()`));
    console.log('   caja del botón oficial oculta: ' + sinCliente.cajaOculta + ' · botón de siempre visible: ' + sinCliente.botonDeSiempre + ' · diagnóstico: ' + sinCliente.diagnostico);
    revisar(sinCliente.enPantalla === true, 'el CRM muestra la pantalla de login');
    revisar(sinCliente.cajaOculta === true, 'sin configurar, NO se muestra el botón oficial (nada cambia)');
    revisar(sinCliente.botonDeSiempre === true, 'y sigue estando el botón "Continuar con Google" de siempre');
    revisar(sinCliente.diagnostico === true, 'el diagnóstico avisa que Google Identity Services está sin configurar');

    console.log('\n2) Con cliente configurado: se carga, se inicializa y se dibuja el botón oficial');
    const conCliente = JSON.parse(await evaluar(cdp, `(async function () {
      window.PDA_GOOGLE_CLIENT_ID = '1234567890-ejemplo.apps.googleusercontent.com';
      var llamadas = { initialize: 0, render: 0, prompt: 0, clientId: null, ancho: null };
      window.google = { accounts: { id: {
        initialize: function (cfg) { llamadas.initialize++; llamadas.clientId = cfg.client_id; window.__callbackGis = cfg.callback; },
        renderButton: function (destino, opciones) { llamadas.render++; llamadas.ancho = opciones.width;
          var falso = document.createElement('div'); falso.textContent = 'Continuar con Google (oficial)'; destino.appendChild(falso); },
        prompt: function () { llamadas.prompt++; },
        disableAutoSelect: function () { }
      } } };
      prepararBotonGoogleGis();
      await new Promise(function (r) { setTimeout(r, 400); });
      var caja = document.getElementById('login-gis-caja');
      return JSON.stringify({ llamadas: llamadas, visible: caja.style.display === 'block',
        texto: document.getElementById('login-gis-boton').textContent.trim(), listo: gisListo });
    })()`));
    console.log('   initialize: ' + conCliente.llamadas.initialize + ' · renderButton: ' + conCliente.llamadas.render + ' · prompt (One Tap): ' + conCliente.llamadas.prompt + ' · cliente: ' + String(conCliente.llamadas.clientId).substring(0, 18) + '…');
    revisar(conCliente.llamadas.initialize === 1, 'se inicializa Google Identity Services UNA vez con el cliente configurado');
    revisar(conCliente.llamadas.render === 1 && conCliente.visible === true, 'se dibuja el botón oficial y se muestra la caja');
    revisar(conCliente.llamadas.prompt === 1, 'y se lanza "One Tap" (en iPhone es la vía que no abre ventanas)');
    revisar(conCliente.listo === true, 'el CRM queda marcado como listo para entrar sin redirección');

    console.log('\n3) Al recibir la credencial se cambia por una sesión de Firebase (sin redirección)');
    const credencial = JSON.parse(await evaluar(cdp, `(async function () {
      var usado = { credential: null, signInWithCredential: 0, idToken: null, popup: 0, redirect: 0 };
      /* Firebase simulado. */
      window.firebase = { auth: {
        GoogleAuthProvider: { credential: function (idToken) { usado.idToken = idToken; return { proveedor: 'google', idToken: idToken }; } },
        signInWithPopup: function () { usado.popup++; return Promise.resolve({ user: null }); },
        signInWithRedirect: function () { usado.redirect++; return Promise.resolve(); }
      } };
      auth = { signInWithCredential: function (cred) { usado.signInWithCredential++; usado.credential = cred; return Promise.resolve({ user: { email: 'produccionesdangel@gmail.com' } }); },
        currentUser: null, onAuthStateChanged: function () { } };
      var aviso = document.getElementById('login-error-google');
      alRecibirCredencialGoogle({ credential: 'ID_TOKEN_DE_PRUEBA' });
      await new Promise(function (r) { setTimeout(r, 300); });
      return JSON.stringify({ usado: usado, avisoOculto: aviso.className.indexOf('visible') === -1 });
    })()`));
    console.log('   credential() con el id_token: ' + (credencial.usado.idToken || '(nada)') + ' · signInWithCredential: ' + credencial.usado.signInWithCredential + ' · ventanas emergentes: ' + credencial.usado.popup + ' · redirecciones: ' + credencial.usado.redirect);
    revisar(credencial.usado.idToken === 'ID_TOKEN_DE_PRUEBA', 'se toma el id_token que devuelve Google');
    revisar(credencial.usado.signInWithCredential === 1, 'y se cambia por una sesión de Firebase con signInWithCredential');
    revisar(credencial.usado.popup === 0 && credencial.usado.redirect === 0, 'SIN ventana emergente y SIN redirección (lo que fallaba en iPhone)');
    revisar(credencial.avisoOculto === true, 'al entrar bien, el aviso de error se limpia');

    console.log('\n4) Si la credencial falla, se avisa en pantalla (no se queda mudo)');
    const fallo = JSON.parse(await evaluar(cdp, `(async function () {
      auth = { signInWithCredential: function () { var e = new Error('credencial invalida'); e.code = 'auth/invalid-credential'; return Promise.reject(e); },
        currentUser: null, onAuthStateChanged: function () { } };
      var aviso = document.getElementById('login-error-google');
      aviso.className = 'login-error';
      alRecibirCredencialGoogle({ credential: 'ID_TOKEN_MALO' });
      await new Promise(function (r) { setTimeout(r, 300); });
      return JSON.stringify({ visible: aviso.className.indexOf('visible') !== -1, texto: String(aviso.textContent || '').substring(0, 90) });
    })()`));
    console.log('   aviso: "' + fallo.texto + '"');
    revisar(fallo.visible === true && fallo.texto.length > 5, 'se muestra el motivo en la pantalla de login');

    console.log('\n5) El diagnóstico del login muestra el estado de Google Identity Services');
    const diag = JSON.parse(await evaluar(cdp, `(function () {
      var t = textoDiagnosticoLogin();
      return JSON.stringify({ linea: (t.split('\\n').filter(function (l) { return l.indexOf('google gis') === 0; })[0] || '').trim(), completo: t });
    })()`));
    console.log('   ' + diag.linea);
    revisar(diag.linea.indexOf('listo') !== -1 || diag.linea.indexOf('cargando') !== -1, 'el diagnóstico dice que el botón oficial está disponible');

    console.log('\n6) El cliente pegado en Configuración (localStorage) se usa y se puede borrar');
    const guardado = JSON.parse(await evaluar(cdp, `(async function () {
      window.PDA_GOOGLE_CLIENT_ID = '';
      localStorage.removeItem('pda_google_client_id');
      gisListo = false; gisPromesaCarga = null;
      var antes = clienteGoogleConfigurado();
      /* Igual que el botón "Guardar" de Configuración. */
      guardarClienteGoogle('9999-prueba.apps.googleusercontent.com');
      await new Promise(function (r) { setTimeout(r, 300); });
      var despues = clienteGoogleConfigurado();
      var enDiag = textoDiagnosticoLogin().indexOf('google gis  : listo') !== -1 || textoDiagnosticoLogin().indexOf('cargando') !== -1;
      guardarClienteGoogle('');
      var borrado = clienteGoogleConfigurado();
      return JSON.stringify({ antes: antes, despues: despues, borrado: borrado, enDiag: enDiag });
    })()`));
    console.log('   antes: "' + guardado.antes + '" · guardado: "' + String(guardado.despues).substring(0, 22) + '…" · tras borrar: "' + guardado.borrado + '"');
    revisar(guardado.antes === '', 'sin nada guardado, no hay cliente (y el CRM no cambia)');
    revisar(guardado.despues === '9999-prueba.apps.googleusercontent.com', 'el cliente pegado en Configuración queda guardado en el dispositivo');
    revisar(guardado.enDiag === true, 'y el login lo reporta como disponible');
    revisar(guardado.borrado === '', 'se puede quitar (vuelve al método de siempre)');

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
