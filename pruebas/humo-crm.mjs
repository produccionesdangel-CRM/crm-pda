/*
 * humo-crm.mjs — Banco de pruebas del CRM REAL (base de la v5.0).
 * ---------------------------------------------------------------------------
 * Qué hace: carga `..\index.html`, saca su JavaScript y lo EJECUTA en Node con
 * el navegador simulado (DOM, Firebase, almacenamiento). Así se detectan los
 * errores que la compilación y una revisión de sintaxis NO ven: variables que
 * no existen, funciones mal conectadas, arranques que se rompen.
 *
 * Nace de dos golpes reales de este proyecto:
 *   1. Un `ReferenceError` en el arranque dejó la app de Finanzas en blanco.
 *   2. Las pruebas de interfaz de la lite verificaban que las tarjetas se
 *      dibujan, pero NO que sus botones respondan: tres listados quedaron
 *      mudos sin que ninguna prueba lo notara.
 *
 * Cómo se corre:  node pruebas\humo-crm.mjs        (o con --verboso)
 * Sale con código 0 si todo está en verde y 1 si algo falla.
 *
 * Regla del banco: simula SOLO lo que el archivo usa de verdad. Los elementos
 * que no existen en el HTML se devuelven como `null`, igual que en el
 * navegador: ahí es donde aparecen los fallos de "elemento borrado".
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ARCHIVO = path.resolve(AQUI, '..', 'index.html');
export const HTML = fs.readFileSync(ARCHIVO, 'utf8');
/** Ids que existen de verdad en el HTML. Los demás devuelven null, como el navegador. */
export const IDS = new Set([...HTML.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

const VERBOSO = process.argv.includes('--verboso');

/* ══════════════════════════════════════════════════════════════════════
   Simulador del navegador
   ══════════════════════════════════════════════════════════════════════ */
export function crearContexto({ conIndexedDB = false } = {}) {
  const registro = { errores: [], avisos: [], escrituras: [], llamadas: {} };
  const elementos = new Map();

  function anotar(nombre) { registro.llamadas[nombre] = (registro.llamadas[nombre] || 0) + 1; }

  function hacerEl(id) {
    if (elementos.has(id)) return elementos.get(id);
    const el = {
      id, tagName: 'DIV', nodeName: 'DIV', value: '', checked: false, disabled: false,
      textContent: '', innerHTML: '', outerHTML: '', className: '', title: '', href: '',
      style: {}, dataset: {}, children: [], childNodes: [], files: [], options: [], selectedIndex: 0,
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); },
        contains(c) { return this._s.has(c); },
        toggle(c, f) { const on = f === undefined ? !this._s.has(c) : !!f; on ? this._s.add(c) : this._s.delete(c); return on; }
      },
      addEventListener(t, f) { anotar('addEventListener:' + t); if (!el._ev[t]) el._ev[t] = []; el._ev[t].push(f); },
      removeEventListener() { }, dispatchEvent() { return true; },
      appendChild(c) { el.children.push(c); return c; }, removeChild(c) { el.children = el.children.filter(x => x !== c); return c; },
      insertBefore(c) { el.children.push(c); return c; }, replaceChild() { }, remove() { },
      setAttribute() { }, getAttribute() { return null; }, removeAttribute() { }, hasAttribute() { return false; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      getElementsByClassName() { return []; }, getElementsByTagName() { return []; },
      closest() { return el; }, contains() { return false; },
      focus() { }, blur() { }, click() { anotar('click:' + id); }, scrollIntoView() { }, select() { },
      getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      insertAdjacentHTML() { }, cloneNode() { return hacerEl(id + ':clon'); },
      _ev: {}
    };
    Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
    Object.defineProperty(el, 'lastChild', { get() { return el.children[el.children.length - 1] || null; } });
    elementos.set(id, el);
    return el;
  }

  const almacen = () => {
    const m = new Map();
    return {
      getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => { m.set(String(k), String(v)); registro.escrituras.push(String(k)); },
      removeItem: k => m.delete(String(k)), clear: () => m.clear(),
      key: i => [...m.keys()][i] ?? null, get length() { return m.size; }
    };
  };

  /* --- Firebase simulado: sin sesión y sin nube (como un arranque en frío) --- */
  function refStub(ruta) {
    const ref = {
      _ruta: ruta,
      child(p) { return refStub(ruta + '/' + p); },
      parent() { return refStub(ruta); }, root() { return refStub(''); },
      key: String(ruta).split('/').pop(),
      on(_e, cb) { if (typeof cb === 'function') setTimeout(() => cb({ val: () => null, exists: () => false }), 0); return cb; },
      off() { }, once() { return Promise.resolve({ val: () => null, exists: () => false, forEach() { return false; } }); },
      get() { return Promise.resolve({ val: () => null, exists: () => false }); },
      set() { return Promise.resolve(); }, update() { return Promise.resolve(); },
      remove() { return Promise.resolve(); }, push() { const r = refStub(ruta + '/nuevo'); r.key = 'nuevo'; return r; },
      orderByChild() { return ref; }, orderByKey() { return ref; }, orderByValue() { return ref; },
      limitToLast() { return ref; }, limitToFirst() { return ref; }, startAt() { return ref; }, endAt() { return ref; },
      transaction(fn) { try { fn(null); } catch (e) { } return Promise.resolve({ committed: false }); },
      onDisconnect() { return { set() { return Promise.resolve(); }, remove() { return Promise.resolve(); }, cancel() { } }; }
    };
    return ref;
  }
  const authObj = {
    currentUser: null, languageCode: 'es',
    onAuthStateChanged(cb) { if (typeof cb === 'function') setTimeout(() => cb(null), 0); return () => { }; },
    onIdTokenChanged(cb) { if (typeof cb === 'function') setTimeout(() => cb(null), 0); return () => { }; },
    setPersistence() { return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve(null); },
    signInWithRedirect() { return Promise.resolve(); },
    signInWithPopup() { return Promise.resolve({ user: null }); },
    signOut() { return Promise.resolve(); },
    useDeviceLanguage() { }, fetchSignInMethodsForEmail() { return Promise.resolve([]); }
  };
  const dbObj = { ref: r => refStub(r), goOnline() { }, goOffline() { }, app: {} };
  const firebase = {
    initializeApp() { return { name: '[simulado]', options: {} }; },
    app: () => ({ name: '[simulado]' }),
    auth: Object.assign(() => authObj, {
      Auth: { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } },
      GoogleAuthProvider: function () { this.setCustomParameters = () => { }; this.addScope = () => { }; }
    }),
    database: Object.assign(() => dbObj, { ServerValue: { TIMESTAMP: 1 } })
  };

  /* --- documento simulado --- */
  const documento = {
    getElementById(id) { return IDS.has(id) ? hacerEl(id) : null; },
    querySelector(sel) { anotar('querySelector'); return hacerEl('sel:' + sel); },
    querySelectorAll() { return []; },
    getElementsByClassName() { return []; }, getElementsByTagName() { return []; },
    createElement(tag) { const e = hacerEl('creado:' + tag + ':' + Math.random().toString(36).slice(2, 7)); e.tagName = String(tag).toUpperCase(); return e; },
    createTextNode(t) { return { textContent: t, nodeType: 3 }; },
    createDocumentFragment() { return hacerEl('fragmento:' + Math.random().toString(36).slice(2, 7)); },
    addEventListener(t, f) { anotar('document.addEventListener:' + t); if (!documento._ev[t]) documento._ev[t] = []; documento._ev[t].push(f); },
    removeEventListener() { }, dispatchEvent() { return true; },
    execCommand() { return true; }, write() { }, open() { }, close() { },
    hasFocus() { return true; },
    body: hacerEl('body'), head: hacerEl('head'), documentElement: hacerEl('html'),
    cookie: '', readyState: 'complete', hidden: false, visibilityState: 'visible', _ev: {}
  };

  const consola = {
    log: (...a) => { registro.logs = registro.logs || []; registro.logs.push(a.map(String).join(' ')); if (VERBOSO) console.log('   [log]', ...a); },
    info: (...a) => consola.log(...a),
    warn: (...a) => { registro.avisos.push(a.map(String).join(' ')); if (VERBOSO) console.log('   [aviso]', ...a); },
    error: (...a) => { registro.errores.push(a.map(String).join(' ')); if (VERBOSO) console.log('   [ERROR]', ...a); },
    debug: () => { }, trace: () => { }, table: () => { }, group: () => { }, groupEnd: () => { }, time: () => { }, timeEnd: () => { }
  };

  const ventana = {
    document: documento, console: consola,
    localStorage: almacen(), sessionStorage: almacen(),
    firebase,
    location: { href: 'https://produccionesdangel-crm.github.io/crm-pda/', origin: 'https://produccionesdangel-crm.github.io', protocol: 'https:', host: 'produccionesdangel-crm.github.io', hostname: 'produccionesdangel-crm.github.io', pathname: '/crm-pda/', search: '', hash: '', reload() { }, assign() { }, replace() { } },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', language: 'es-MX', languages: ['es-MX', 'es'], onLine: true, clipboard: { writeText: () => Promise.resolve() }, serviceWorker: undefined, maxTouchPoints: 0 },
    screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 860 },
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, scrollY: 0, scrollX: 0,
    matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } }),
    getComputedStyle: () => ({ getPropertyValue: () => '', display: 'block', visibility: 'visible' }),
    requestAnimationFrame: f => setTimeout(() => f(Date.now()), 0), cancelAnimationFrame: () => { },
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    alert() { }, confirm() { return true; }, prompt() { return null; },
    open() { return null; }, close() { }, focus() { }, print() { }, scrollTo() { }, scrollBy() { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    /* Observadores y clases del DOM que el CRM usa al arrancar o al pintar. */
    MutationObserver: class { constructor(cb) { this._cb = cb; } observe() { } disconnect() { } takeRecords() { return []; } },
    IntersectionObserver: class { constructor() { } observe() { } unobserve() { } disconnect() { } takeRecords() { return []; } },
    ResizeObserver: class { constructor() { } observe() { } unobserve() { } disconnect() { } },
    Event: class { constructor(t, o) { this.type = t; Object.assign(this, o || {}); } preventDefault() { } stopPropagation() { } },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
    HTMLElement: class { }, Element: class { }, Node: class { }, DocumentFragment: class { },
    DOMParser: class { parseFromString() { return { querySelector: () => null, querySelectorAll: () => [], documentElement: {} }; } },
    XMLSerializer: class { serializeToString() { return ''; } },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, state: null, length: 1 },
    gapi: undefined, google: undefined,
    URL: { createObjectURL: () => 'blob:simulado', revokeObjectURL() { } },
    Blob: class { constructor() { } }, File: class { constructor() { } },
    FileReader: class { readAsText() { } readAsDataURL() { } },
    Notification: class { static permission = 'denied'; static requestPermission() { return Promise.resolve('denied'); } close() { } },
    Image: class { set src(v) { } addEventListener() { } },
    crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2), getRandomValues: a => a, subtle: {} },
    performance: { now: () => Date.now() },
    Intl, JSON, Math, Date, Promise, Error, RegExp, Array, Object, String, Number, Boolean, Map, Set, Symbol,
    TextEncoder, TextDecoder, AbortController,
    addEventListener(t, f) { anotar('window.addEventListener:' + t); if (!ventana._ev[t]) ventana._ev[t] = []; ventana._ev[t].push(f); },
    removeEventListener() { }, dispatchEvent() { return true; }, _ev: {},
    indexedDB: conIndexedDB ? { open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null }) } : undefined
  };
  ventana.window = ventana; ventana.self = ventana; ventana.globalThis = ventana; ventana.top = ventana; ventana.parent = ventana; ventana.frames = ventana;
  ventana.console = consola;

  return { ventana, registro, elementos, hacerEl, IDS };
}

/* ══════════════════════════════════════════════════════════════════════
   Ejecución del archivo real
   ══════════════════════════════════════════════════════════════════════ */
export async function ejecutar(opciones = {}) {
  const { ventana, registro, elementos } = crearContexto(opciones);
  const contexto = vm.createContext(ventana);
  // Los scripts externos (Firebase desde CDN) no se cargan: ya está el simulador.
  const bloques = [...HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const resultado = { bloques: bloques.length, excepcion: null, ventana, registro, elementos, contexto };
  try {
    for (const codigo of bloques) new vm.Script(codigo, { filename: 'index.html<script>' }).runInContext(contexto);
  } catch (e) {
    resultado.excepcion = e;
    return resultado;
  }
  // El arranque es asíncrono: se le da tiempo a que se asienten las promesas.
  for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 12));
  return resultado;
}

/* ══════════════════════════════════════════════════════════════════════
   Comprobaciones
   ══════════════════════════════════════════════════════════════════════ */
let pruebas = 0, fallos = 0;
function comprobar(titulo, condicion, detalle = '') {
  pruebas++;
  if (condicion) console.log(`  OK    ${titulo}`);
  else { fallos++; console.log(`  FALLA ${titulo}${detalle ? '  -> ' + detalle : ''}`); }
}

const GLOBALES_BASE = [
  'cambiarSeccion', 'esAdmin', 'mostrarPantallaLogin', 'iniciarAplicacion',
  'inicializarAlmacen', 'almacenGuardar', 'almacenCargar', 'guardarDatosLocal', 'cargarDatosLocal',
  'renderizarCalendario', 'mostrarFormularioTarea', 'verDetalleProspecto', 'eliminarProspecto'
];

const r = await ejecutar();
console.log('\n=== 1. El archivo carga y arranca sin errores ===');
comprobar('se encontraron bloques de JavaScript en el HTML', r.bloques > 0, `bloques=${r.bloques}`);
comprobar('el JavaScript corre sin excepciones', !r.excepcion, r.excepcion ? (r.excepcion.message + ' | ' + String(r.excepcion.stack || '').split('\n')[1]) : '');
comprobar('el arranque no reportó "Error en boot"',
  !r.registro.errores.some(e => /Error en boot/i.test(e)),
  r.registro.errores.filter(e => /Error en boot/i.test(e)).join(' | '));
comprobar('no hubo errores en consola', r.registro.errores.length === 0, r.registro.errores.slice(0, 3).join(' | '));

console.log('\n=== 2. La base del CRM quedó definida ===');
const faltan = GLOBALES_BASE.filter(n => typeof r.contexto[n] !== 'function');
comprobar(`las ${GLOBALES_BASE.length} funciones clave existen`, faltan.length === 0, faltan.join(', '));

console.log('\n=== 3. Llegó a la pantalla de login (sin sesión de Google) ===');
const login = r.elementos.get('pantalla-login') || r.elementos.get('login');
const pidioLogin = Object.keys(r.registro.llamadas).some(k => /pantalla-login|login/i.test(k)) || !!login;
comprobar('mostró la pantalla de login', pidioLogin, 'no se detectó pantalla de login');

console.log('\n=== 4. Motor de campañas (a partir de la v5.0) ===');
const tieneMotor = typeof r.contexto.crearMotor === 'function';
if (!tieneMotor) {
  console.log('  (pendiente: todavía no está integrado)');
} else {
  comprobar('el motor de campañas está integrado', tieneMotor);
  comprobar('los catálogos de campaña existen', !!r.contexto.Catalogos && !!r.contexto.Catalogos.estadosCampania);
  comprobar('la interfaz de campañas está integrada', typeof r.contexto.App === 'object' && typeof r.contexto.App.abrirModal === 'function');
}

console.log('\n=== 5. Estructura: menú, secciones y estilos (Fase 1) ===');
{
  const soloMarcado = HTML.slice(0, HTML.indexOf('<script'));
  const ids = [...soloMarcado.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const repetidos = Object.entries(ids.reduce((a, i) => (a[i] = (a[i] || 0) + 1, a), {}))
    .filter(([, n]) => n > 1).map(([i, n]) => `${i} x${n}`);
  comprobar('no hay ids repetidos en el marcado', repetidos.length === 0, repetidos.join(', '));

  const orden = [...HTML.matchAll(/<li class="menu-item[^"]*" data-seccion="([^"]+)"/g)].map(m => m[1]);
  const esperado = ['informes', 'panel', 'prospectos', 'campanias', 'clientes', 'contratos',
    'paquetes', 'servicios', 'calendario', 'configuracion'];
  comprobar('el menú quedó en el orden pedido por Jorge', JSON.stringify(orden) === JSON.stringify(esperado),
    `quedó: ${orden.join(' · ')}`);

  for (const [id, nombre] of [['seccion-panel', 'Panel'], ['seccion-campanias', 'Campañas']]) {
    comprobar(`la sección ${nombre} existe y no nace activa`,
      new RegExp(`id="${id}" class="seccion"`).test(HTML));
  }
  comprobar('se portó el CSS de campañas en su propio bloque', /@CSS-CAMPANIAS v5\.0/.test(HTML) && /FIN @CSS-CAMPANIAS/.test(HTML));
  comprobar('no se coló el cartel de la versión lite', !/lite de pruebas|id="aviso-modo"/.test(HTML));
  comprobar('las clases que el CRM ya tenía no se redefinieron',
    !/^\s*\.panel-lateral-body\s*\{/m.test(HTML.slice(HTML.indexOf('@CSS-CAMPANIAS'), HTML.indexOf('FIN @CSS-CAMPANIAS'))),
    'el CSS de campañas redefine .panel-lateral-body');
}

console.log('\n=== 6. Capa de datos: las colecciones nuevas entraron al mecanismo existente (Fase 2) ===');
{
  const c = r.contexto;
  comprobar('campanias y participaciones están declaradas como arreglos',
    Array.isArray(c.campanias) && Array.isArray(c.participaciones),
    `campanias=${typeof c.campanias} participaciones=${typeof c.participaciones}`);
  comprobar('entraron a las colecciones versionadas (guardado/versión en la nube)',
    Array.isArray(c.COLECCIONES_VERSIONADAS) && c.COLECCIONES_VERSIONADAS.includes('campanias') && c.COLECCIONES_VERSIONADAS.includes('participaciones'),
    (c.COLECCIONES_VERSIONADAS || []).join(', '));
  comprobar('el outbox persistente las acepta',
    (() => { c.marcarSucia('campanias', 'prueba-1'); const hay = c.hayEntidadesSucias() && c.contarEntidadesSucias() >= 1; c.limpiarEntidadesSucias(); return hay; })(),
    'marcarSucia no las registró');

  // De verdad: se guarda y se revisa qué quedó escrito en el almacén.
  const antes = r.registro.escrituras.length;
  const ok = await c.guardarDatosLocal();
  const escritas = r.registro.escrituras.slice(antes);
  comprobar('guardarDatosLocal() guarda sin error', ok === true, `devolvió ${ok}`);
  comprobar('el guardado incluye campanias y participaciones',
    escritas.includes('campanias') && escritas.includes('participaciones'),
    `se guardaron: ${escritas.join(', ')}`);
  comprobar('lo guardado son arreglos válidos',
    Array.isArray(JSON.parse(r.ventana.localStorage.getItem('campanias') || 'null')) &&
    Array.isArray(JSON.parse(r.ventana.localStorage.getItem('participaciones') || 'null')),
    'no son arreglos');
  comprobar('el respaldo exportado incluiría las campañas',
    /tareas: tareas, campanias: campanias, participaciones: participaciones, historial/.test(HTML),
    'el export no las incluye');
}

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones en verde${fallos ? `  (${fallos} con falla)` : ''}`);
process.exit(fallos ? 1 : 0);
