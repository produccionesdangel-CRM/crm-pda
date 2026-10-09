/*
 * sandbox.mjs — el CRM COMPLETO en una caja de arena, SIN NUBE.
 * ---------------------------------------------------------------------------
 * POR QUÉ EXISTE
 *   Las pruebas con datos incongruentes necesitan el CRM de verdad (sus
 *   formularios, sus validaciones y su almacén), pero NUNCA deben poder tocar la
 *   base real de Firebase de Jorge ni su IndexedDB.
 *
 * CÓMO LO GARANTIZA (tres capas, ninguna opcional)
 *   1. La copia de `index.html` lleva la configuración de Firebase CAMBIADA por
 *      una inventada: aunque algo intentara hablar con la nube, iría a un
 *      proyecto que no existe.
 *   2. El navegador arranca con la red BLOQUEADA hacia firebaseio.com,
 *      firebaseapp.com, googleapis.com y gstatic.com. Sin gstatic no se descarga
 *      el SDK, así que `firebase` no existe y la app arranca en **modo local**
 *      (un modo que ya existe y está probado).
 *   3. `preparar()` REVISA la copia antes de dejarla usar: si quedara la apiKey,
 *      el projectId o la databaseURL reales, no la escribe y avisa.
 *   Además `abrir()` guarda la bitácora de red y `cerrar()` avisa si hubo
 *   cualquier intento contra esos dominios.
 *
 * CÓMO SE USA (desde otro script)
 *   import { preparar, abrir, entrar, sembrar } from './sandbox.mjs';
 *   const caja = await preparar();
 *   const s = await abrir({ ancho: 390, alto: 844, movil: true });
 *   await entrar(s.userData ? s : s);            // entra sin Google (sandbox)
 *   ...
 *   await s.cerrar();
 *
 * O POR LÍNEA DE COMANDOS
 *   node pruebas\sandbox\sandbox.mjs preparar   -> prepara la copia y la revisa
 *   node pruebas\sandbox\sandbox.mjs probar     -> prepara, abre, entra y reporta
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, '..', '..');

export const FUENTE = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(REPO, 'index.html');
export const CAJA = process.env.CRM_SANDBOX || path.join(os.tmpdir(), 'crm-sandbox');
export const ARCHIVO_CAJA = path.join(CAJA, 'index.html');

/* Dominios de DATOS de producción: nunca deben tocarse desde la caja. */
export const HOSTS_DATOS = ['firebaseio.com', 'firebaseapp.com', 'googleapis.com', 'firebase.com'];
/* El SDK (gstatic) también se bloquea: sin él la app arranca en modo local. */
export const HOSTS_SDK = ['gstatic.com'];
export const HOSTS_PROHIBIDOS = [...HOSTS_DATOS, ...HOSTS_SDK];

const REEMPLAZOS = [
  [/apiKey:\s*"[^"]*"/, 'apiKey: "sandbox-sin-nube"'],
  [/authDomain:\s*"[^"]*"/, 'authDomain: "sandbox-sin-nube.firebaseapp.com"'],
  [/databaseURL:\s*"[^"]*"/, 'databaseURL: "https://sandbox-sin-nube-default-rtdb.firebaseio.com"'],
  [/projectId:\s*"[^"]*"/, 'projectId: "sandbox-sin-nube"'],
  [/storageBucket:\s*"[^"]*"/, 'storageBucket: "sandbox-sin-nube.firebasestorage.app"'],
  [/messagingSenderId:\s*"[^"]*"/, 'messagingSenderId: "0"'],
  [/appId:\s*"[^"]*"/, 'appId: "1:0:web:sandbox"']
];

/* Lo que NO puede quedar en la copia (si queda, no se usa la caja). */
const VENENOS = [
  /AIzaSy[A-Za-z0-9_-]{20,}/,
  /crm-pda-default-rtdb\.firebaseio\.com/,
  /crm-pda\.firebaseapp\.com/,
  /projectId:\s*"crm-pda"/
];

const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

/* ─────────────────────────── 1. Preparar la copia ─────────────────────────── */

export function preparar(opciones = {}) {
  const destino = opciones.destino || CAJA;
  if (!fs.existsSync(FUENTE)) throw new Error('No encuentro el CRM: ' + FUENTE);
  const original = fs.readFileSync(FUENTE, 'utf8');
  let copia = original;

  const aplicados = [];
  for (const [patron, valor] of REEMPLAZOS) {
    if (patron.test(copia)) { copia = copia.replace(patron, valor); aplicados.push(valor.split(':')[0]); }
  }
  /* Marca de caja: se nota en el título y queda una bandera para las pruebas. */
  copia = copia.replace(/<html([^>]*)>/, '<html$1 data-sandbox="1">');
  copia = copia.replace(/<title>([^<]*)<\/title>/, '<title>SANDBOX · $1</title>');
  copia = copia.replace(/(var BUILD_APP = '[^']+';)/, '$1\n        var SANDBOX = true;   // caja de arena: sin nube, datos de prueba');

  /* Revisión de seguridad: sin venenos, se escribe; con venenos, se aborta. */
  const encontrados = VENENOS.filter(re => re.test(copia)).map(re => String(re));
  if (encontrados.length) {
    throw new Error('ABORTADO: la copia de la caja todavía trae datos reales de Firebase: ' + encontrados.join(' | '));
  }
  if (!/data-sandbox="1"/.test(copia)) throw new Error('ABORTADO: no se pudo marcar la copia como caja de arena.');

  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'index.html'), copia, 'utf8');
  /* Recursos que el HTML referencia por nombre. */
  for (const recurso of ['pda logo.jpg']) {
    const desde = path.join(REPO, recurso);
    if (fs.existsSync(desde)) fs.copyFileSync(desde, path.join(destino, recurso));
  }

  const info = {
    fuente: FUENTE, destino, archivo: path.join(destino, 'index.html'),
    sha256Fuente: sha256(original), sha256Caja: sha256(copia),
    bytes: copia.length, reemplazos: aplicados,
    sello: (original.match(/var BUILD_APP = '([^']+)'/) || [])[1] || 'sin sello',
    igualSalvoConfig: sha256(copia.replace(/\n?\s*var SANDBOX = true;[^\n]*/, '')) !== null
  };
  return info;
}

/* ─────────────────────────── 2. Servidor local ─────────────────────────── */

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

function servir(carpeta, puerto) {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = decodeURIComponent((peticion.url || '/').split('?')[0]);
    const archivo = path.join(carpeta, ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, ''));
    if (!archivo.startsWith(carpeta) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); respuesta.end('no está'); return;
    }
    respuesta.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(archivo).pipe(respuesta);
  });
  return new Promise((resolver) => servidor.listen(puerto, '127.0.0.1', () => resolver(servidor)));
}

function puertoLibre(base) {
  return new Promise((resolver) => {
    const s = http.createServer();
    s.listen(base, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolver(p)); });
  });
}

function buscarChrome() {
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome'
  ];
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  throw new Error('No encontré Chrome.');
}

/* ─────────────────────────── 3. Abrir la caja ─────────────────────────── */

export async function abrir(opciones = {}) {
  const info = opciones.info || preparar({ destino: opciones.destino });
  const ancho = opciones.ancho || 390, alto = opciones.alto || 844;
  const movil = opciones.movil !== false, tactil = opciones.tactil !== false;

  const puertoWeb = await puertoLibre(18000 + Math.floor(Math.random() * 500));
  const puertoCdp = await puertoLibre(19000 + Math.floor(Math.random() * 500));
  /* El perfil de Chrome lleva el puerto en el nombre: si dos pruebas (o dos agentes)
     corren la caja al mismo tiempo, Chrome NO puede compartir la carpeta de perfil y
     la segunda corrida fallaría al abrir. Cada corrida usa la suya y la borra al cerrar. */
  const perfil = path.join(os.tmpdir(), 'crm-sandbox-perfil-' + puertoCdp);
  if (opciones.limpiarPerfil !== false) { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { } }
  const servidor = await servir(path.dirname(info.archivo), puertoWeb);

  const chrome = spawn(buscarChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--metrics-recording-only',
    '--remote-debugging-port=' + puertoCdp, '--user-data-dir=' + perfil, 'about:blank'
  ], { stdio: 'ignore' });

  let pagina = null;
  for (let i = 0; i < 100 && !pagina; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${puertoCdp}/json/list`)).json();
      pagina = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl) || null;
    } catch (e) { }
    if (!pagina) await dormir(250);
  }
  if (!pagina) { chrome.kill(); servidor.close(); throw new Error('Chrome no abrió el puerto de depuración.'); }

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });

  let id = 0;
  const pendientes = new Map();
  const sucesos = [];
  const red = { peticiones: [], prohibidas: [], bloqueadas: [] };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error))) : resolver(m.result);
      return;
    }
    if (!m.method) return;
    sucesos.push(m);
    if (m.method === 'Network.requestWillBeSent') {
      const url = String(m.params.request.url);
      red.peticiones.push(url);
      const host = HOSTS_PROHIBIDOS.find(h => url.includes(h));
      if (host) (red.prohibidas.includes(host) ? null : red.prohibidas.push(host));
    }
    if (m.method === 'Network.loadingFailed') {
      const motivo = String((m.params && m.params.blockedReason) || '');
      if (motivo) red.bloqueadas.push(m.params.blockedReason);
    }
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id;
    pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Log.enable');
  await enviar('Network.enable');
  /* Capa 2: la red hacia la nube, cortada de raíz. */
  await enviar('Network.setBlockedURLs', { urls: HOSTS_PROHIBIDOS.flatMap(h => [`*${h}*`, `*://*.${h}/*`]) });
  await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: movil ? 3 : 1, mobile: movil });
  await enviar('Emulation.setTouchEmulationEnabled', { enabled: tactil, maxTouchPoints: tactil ? 5 : 1 });

  const url = `http://127.0.0.1:${puertoWeb}/index.html`;
  await enviar('Page.navigate', { url });
  await dormir(opciones.espera || 4000);

  async function evaluar(expresion) {
    const r = await enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }

  const api = {
    info, url, red, sucesos,
    enviar,
    evaluar,
    async esperar(ms) { await dormir(ms); },
    /* Un toque de verdad, como el de un dedo. */
    async tocar(x, y) {
      const punto = [{ x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8, force: 1, id: 1 }];
      await enviar('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto });
      await dormir(50);
      await enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await dormir(250);
    },
    async captura(nombre, carpeta) {
      const r = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const destino = path.join(carpeta || path.join(REPO, 'pruebas', 'capturas'), nombre + '.png');
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(r.data, 'base64'));
      return destino;
    },
    async cerrar() {
      try { chrome.kill(); } catch (e) { }
      try { servidor.close(); } catch (e) { }
      /* Se borra SU perfil (solo si es una carpeta de la caja dentro de temporales). */
      try {
        const base = path.basename(perfil);
        if (base.indexOf('crm-sandbox-perfil-') === 0 && path.resolve(perfil).startsWith(path.resolve(os.tmpdir()))) {
          fs.rmSync(perfil, { recursive: true, force: true });
        }
      } catch (e) { }
      return { peticiones: red.peticiones.length, prohibidas: red.prohibidas, bloqueadas: red.bloqueadas.length };
    }
  };
  return api;
}

/* Entrar sin Google: el acceso no es lo que se prueba en la caja. */
export async function entrar(s, usuario) {
  const u = usuario || { nombre: 'Sandbox', rol: 'Administrador', admin: true, email: 'sandbox@local' };
  const r = await s.evaluar(`(function () {
    try {
      if (typeof SANDBOX === 'undefined' || SANDBOX !== true) return 'NO ES SANDBOX';
      usuarioActual = ${JSON.stringify(u)};
      iniciarAplicacion();
      return 'ok';
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`);
  await dormir(500);
  return r;
}

/* Revisión inmediata de que la caja está aislada. */
export async function revisarAislamiento(s) {
  const dentro = await s.evaluar(`(function () {
    var cfg = (typeof firebaseConfig !== 'undefined') ? firebaseConfig : {};
    return {
      sandbox: (typeof SANDBOX !== 'undefined' && SANDBOX === true),
      databaseURL: cfg.databaseURL || '', projectId: cfg.projectId || '',
      firebaseListo: (typeof firebaseListo !== 'undefined') ? firebaseListo : null,
      database: (typeof database !== 'undefined' && database) ? true : false,
      auth: (typeof auth !== 'undefined' && auth) ? true : false
    };
  })()`);
  const fugasDatos = s.red.peticiones.filter(u => HOSTS_DATOS.some(h => u.includes(h)));
  const sdkIntentos = s.red.peticiones.filter(u => HOSTS_SDK.some(h => u.includes(h)));
  return {
    ...dentro,
    peticiones: s.red.peticiones.length,
    fugasDatos, sdkIntentos: sdkIntentos.length,
    /* Aislado = es la caja, no hay sesión ni base, y NADIE intentó los datos reales. */
    aislado: dentro.sandbox && fugasDatos.length === 0 && !dentro.database && !dentro.auth
  };
}

/* ─────────────────────────── 4. Datos de prueba ─────────────────────────── */

/* 20 prospectos y 2 campañas, creados por el CAMINO REAL de la app.
   Los prospectos entran por el formulario de la sección Prospectos
   (`mostrarFormularioProspecto` + submit) y las campañas por el motor de
   campañas (`crearCampania` + `activarCampania`), que es lo que usa el asistente. */
export const PROSPECTOS_PRUEBA = [
  ['Ana López Ruiz', '8781234567', 'ana.lopez@correo.com', 'Boda'],
  ['Beatriz Núñez Salas', '8782345678', 'bea.nunez@correo.com', 'XV años'],
  ['Carlos Méndez Ríos', '8783456789', 'carlos.mendez@correo.com', 'Corporativo'],
  ['Diana Ferrer Luna', '8784567890', 'diana.ferrer@correo.com', 'Boda'],
  ['Eduardo Salas Ponce', '', 'eduardo.salas@correo.com', 'Bautizo'],
  ['Fernanda Ortiz Vidal', '8785678901', '', 'XV años'],
  ['Gabriel Ibarra Cruz', '8786789012', 'gabriel.ibarra@correo.com', 'Corporativo'],
  ['Helena Vargas Soto', '8787890123', 'helena.vargas@correo.com', 'Boda'],
  ['Iván Ramírez Peña', '8788901234', '', 'Cumpleaños'],
  ['Julia Cepeda Mora', '8789012345', 'julia.cepeda@correo.com', 'XV años'],
  ['Kevin Domínguez Ayala', '8780123456', 'kevin.dominguez@correo.com', 'Boda'],
  ['Laura Estrada Blanco', '', '', 'Bautizo'],
  ['Manuel Cordero Reyes', '8781357924', 'manuel.cordero@correo.com', 'Corporativo'],
  ['Nadia Fuentes Ríos', '8782468013', 'nadia.fuentes@correo.com', 'Boda'],
  ['Oscar Delgado Cano', '8783579135', 'oscar.delgado@correo.com', 'XV años'],
  ['Patricia Herrera Lira', '8784680246', 'patricia.herrera@correo.com', 'Cumpleaños'],
  ['Quetzal Moreno Ávila', '8785791357', '', 'Boda'],
  ['Rosa Aguirre Tapia', '8786802468', 'rosa.aguirre@correo.com', 'XV años'],
  ['Sergio Palacios Nava', '8787913579', 'sergio.palacios@correo.com', 'Corporativo'],
  ['Teresa Zamora Gil', '8788024680', 'teresa.zamora@correo.com', 'Boda']
];

export async function sembrar(s, opciones = {}) {
  const cuantos = opciones.prospectos === undefined ? 20 : opciones.prospectos;
  const campanias = opciones.campanias === undefined ? 2 : opciones.campanias;
  const lista = PROSPECTOS_PRUEBA.slice(0, cuantos);
  return await s.evaluar(`(function () {
    var lista = ${JSON.stringify(lista)};
    var cuantasCampanias = ${campanias};
    var res = { prospectos: 0, campanias: [], participaciones: 0, omitidas: [], errores: [] };
    try {
      // 1) Los prospectos, por el formulario real de la sección Prospectos.
      lista.forEach(function (fila, i) {
        try {
          mostrarFormularioProspecto(null);
          document.getElementById('prospecto-nombre').value = fila[0];
          document.getElementById('prospecto-telefono').value = fila[1];
          document.getElementById('prospecto-email').value = fila[2];
          document.getElementById('prospecto-notas').value = 'Prospecto de prueba ' + (i + 1) + ' · ' + fila[3];
          document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          if (document.getElementById('modal').classList.contains('active')) cerrarModal();
        } catch (e) { res.errores.push('prospecto ' + (i + 1) + ': ' + (e && e.message ? e.message : e)); }
      });
      res.prospectos = (typeof prospectos !== 'undefined' ? prospectos.length : 0);

      // 2) Dos campañas por el motor (es lo que usa el asistente al terminar).
      //    El tipo y las fechas se dejan en el catálogo/la fecha local de la app:
      //    si se inventara un tipo fuera del catálogo, las pruebas reportarían
      //    incongruencias que en realidad las metió el propio sembrador.
      var hoyLocal = new Date();
      var fLocal = hoyLocal.getFullYear() + '-' + ('0' + (hoyLocal.getMonth() + 1)).slice(-2) + '-' + ('0' + hoyLocal.getDate()).slice(-2);
      var definiciones = [
        { nombre: 'Bodas 2027', objetivoPrincipal: 'Cerrar 5 bodas para 2027',
          fechaInicio: fLocal, fechaFin: '2027-12-31' },
        { nombre: 'XV años verano', objetivoPrincipal: 'Captar 8 XV años de junio a agosto',
          fechaInicio: fLocal, fechaFin: '2027-08-31' }
      ];
      for (var c = 0; c < cuantasCampanias && c < definiciones.length; c++) {
        try {
          var camp = App.motor.crearCampania(definiciones[c]);
          if (camp && camp.id) {
            var activada = null;
            try { activada = App.motor.activarCampania(camp.id); } catch (e) { res.errores.push('activar ' + camp.nombre + ': ' + e.message); }
            var viva = App.almacen.campania(camp.id) || camp;
            res.campanias.push({ id: camp.id, nombre: camp.nombre, estado: viva.estado, etapas: (viva.etapas || []).length, activacion: activada ? (activada.ok === false ? 'rechazada' : 'ok') : 'sin dato' });
          } else { res.errores.push('campaña ' + (c + 1) + ': no devolvió id'); }
        } catch (e) { res.errores.push('campaña ' + (c + 1) + ': ' + (e && e.message ? e.message : e)); }
      }

      // 3) Los prospectos entran a las campañas (es la dinámica real de trabajo).
      if (res.campanias.length && typeof prospectos !== 'undefined' && prospectos.length) {
        var ids = prospectos.map(function (p) { return p.id; });
        var reparto = [[0, Math.min(12, ids.length)], [Math.max(0, ids.length - 12), ids.length]];
        res.campanias.forEach(function (camp, i) {
          var rango = reparto[i] || reparto[0];
          var r = App.motor.agregarParticipaciones(camp.id, ids.slice(rango[0], rango[1]), { origen: 'Prueba de sandbox' });
          camp.participantes = r.creadas.length;
          res.participaciones += r.creadas.length;
          r.omitidas.forEach(function (o) { res.omitidas.push(camp.nombre + ': ' + o.motivo); });
        });
      }
      if (typeof guardarDatos === 'function') { try { guardarDatos(); } catch (e) { } }
    } catch (e) { res.errores.push('general: ' + (e && e.message ? e.message : e)); }
    return res;
  })()`);
}

/* ─────────────────────────── 5. Línea de comandos ─────────────────────────── */

const esCLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (esCLI) {
  const orden = process.argv[2] || 'probar';
  (async () => {
    if (orden === 'preparar') {
      const info = preparar();
      console.log('Caja lista:      ' + info.archivo);
      console.log('Sello:           ' + info.sello);
      console.log('sha256 fuente:   ' + info.sha256Fuente.slice(0, 16) + '…');
      console.log('sha256 caja:     ' + info.sha256Caja.slice(0, 16) + '…');
      console.log('Config cambiada: ' + info.reemplazos.join(', '));
      console.log('Sin nube:        apiKey/projectId/databaseURL inventados ✅');
      return;
    }
    const info = preparar();
    const s = await abrir({ info, ancho: 390, alto: 844, movil: true });
    try {
      const entrada = await entrar(s);
      const aislamiento = await revisarAislamiento(s);
      console.log('Caja:      ' + info.archivo);
      console.log('Sello:     ' + info.sello + '  ·  entrada: ' + entrada);
      console.log('Aislado:   ' + (aislamiento.aislado ? 'SÍ ✅' : 'REVISAR ❌') +
        '  (sandbox=' + aislamiento.sandbox + ' · database=' + aislamiento.database + ' · auth=' + aislamiento.auth + ')');
      console.log('Peticiones: ' + aislamiento.peticiones + ' · a los DATOS reales: ' + (aislamiento.fugasDatos.length ? aislamiento.fugasDatos.join(', ') : 'ninguna ✅') +
        ' · SDK (bloqueado): ' + aislamiento.sdkIntentos);
      const sembrado = await sembrar(s);
      console.log('Sembrado:  ' + sembrado.prospectos + ' prospectos · ' + sembrado.campanias.length + ' campañas · ' + sembrado.participaciones + ' participaciones');
      sembrado.campanias.forEach(c => console.log('   · ' + c.nombre + ' [' + c.estado + '] · ' + c.etapas + ' etapas · ' + (c.participantes || 0) + ' participantes · activación ' + c.activacion));
      if (sembrado.omitidas.length) console.log('   Omitidas: ' + sembrado.omitidas.slice(0, 5).join(' | '));
      if (sembrado.errores.length) console.log('Errores al sembrar: ' + sembrado.errores.join(' | '));
      const destino = await s.captura('sandbox-inicial', path.join(REPO, 'pruebas', 'capturas'));
      console.log('Captura:   ' + destino);
    } finally {
      const red = await s.cerrar();
      console.log('Red:       ' + red.peticiones + ' peticiones · prohibidas: ' + (red.prohibidas.length ? red.prohibidas.join(', ') : 'ninguna ✅'));
    }
  })().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
}
