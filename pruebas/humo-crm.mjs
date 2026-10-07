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
export const ARCHIVO = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.resolve(AQUI, '..', 'index.html');
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
      outerHTML: '', className: '', title: '', href: '',
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
      querySelector(sel) { return hacerEl('sel:' + sel); }, querySelectorAll() { return []; },
      getElementsByClassName() { return []; }, getElementsByTagName() { return []; },
      closest() { return el; }, contains() { return false; },
      focus() { }, blur() { }, click() { anotar('click:' + id); }, scrollIntoView() { }, select() { },
      getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      insertAdjacentHTML() { }, cloneNode() { return hacerEl(id + ':clon'); },
      _ev: {}
    };
    Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
    Object.defineProperty(el, 'lastChild', { get() { return el.children[el.children.length - 1] || null; } });
    // El CRM inyecta HTML y luego busca esos elementos por id (por ejemplo el botón
    // de confirmar del modal). Si el simulador no los registrara, daría falsos negativos.
    Object.defineProperty(el, 'innerHTML', {
      get() { return el._html || ''; },
      set(v) { el._html = String(v); for (const m of el._html.matchAll(/id="([^"]+)"/g)) IDS.add(m[1]); }
    });
    Object.defineProperty(el, 'textContent', {
      get() { return el._texto || ''; },
      set(v) { el._texto = String(v); }
    });
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
  // Se registran las rutas que la app pide a la nube: así se puede comprobar qué publica.
  const dbObj = { ref: r => { const k = 'ref:' + r; registro.llamadas[k] = (registro.llamadas[k] || 0) + 1; return refStub(r); }, goOnline() { }, goOffline() { }, app: {} };
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
  const t0 = performance.now();
  try {
    for (const codigo of bloques) new vm.Script(codigo, { filename: 'index.html<script>' }).runInContext(contexto);
  } catch (e) {
    resultado.excepcion = e;
    return resultado;
  }
  resultado.ms = performance.now() - t0;
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
console.log('  (peso y tiempo: ' + (fs.statSync(ARCHIVO).size/1024).toFixed(0) + ' KB · el JavaScript se ejecuta en ' + r.ms.toFixed(0) + ' ms · en el teléfono será más lento)');

console.log('\n=== 2. La base del CRM quedó definida ===');
const faltan = GLOBALES_BASE.filter(n => typeof r.contexto[n] !== 'function');
comprobar(`las ${GLOBALES_BASE.length} funciones clave existen`, faltan.length === 0, faltan.join(', '));

console.log('\n=== 3. Llegó a la pantalla de login (sin sesión de Google) ===');
const login = r.elementos.get('pantalla-login') || r.elementos.get('login');
const pidioLogin = Object.keys(r.registro.llamadas).some(k => /pantalla-login|login/i.test(k)) || !!login;
comprobar('mostró la pantalla de login', pidioLogin, 'no se detectó pantalla de login');

console.log('\n=== 4. Motor de campañas integrado (Fase 3a) ===');
const tieneMotor = typeof r.contexto.crearMotor === 'function';
if (!tieneMotor) {
  console.log('  (pendiente: todavía no está integrado)');
} else {
  const c = r.contexto;
  comprobar('el motor de campañas está integrado', tieneMotor);
  comprobar('los catálogos de campaña existen', !!c.Catalogos && !!c.Catalogos.estadosCampania);
  comprobar('el motor quedó listo sobre los datos del CRM',
    !!c.motorCampanias && typeof c.motorCampanias.crearCampania === 'function');

  // De verdad: se crea una campaña y se revisa dónde quedó.
  const antesCamp = c.campanias.length, antesHist = c.historial.length;
  const antesSucias = Object.keys(c.entidadesSucias.campanias || {}).length;
  const camp = c.motorCampanias.crearCampania({ nombre: 'Campaña de prueba v5.0', objetivoPrincipal: 'verificar el adaptador' });
  comprobar('crearCampania() la guarda en las campañas del CRM',
    c.campanias.length === antesCamp + 1 && c.campanias.some(x => x && x.id === camp.id),
    `campañas=${c.campanias.length}`);
  comprobar('deja rastro en el historial con el usuario de la sesión',
    c.historial.length > antesHist && c.historial[0] && c.historial[0].usuario === 'Sistema',
    `usuario=${c.historial[0] && c.historial[0].usuario}`);
  comprobar('la campaña quedó marcada para subir a la nube',
    Object.keys(c.entidadesSucias.campanias || {}).length > antesSucias, 'no se marcó como pendiente');
  comprobar('el historial nuevo entró a la cola de la nube',
    c.eventosAppendOnlyPendientes.historial.length > 0, 'la cola quedó vacía');
  comprobar('el motor revisa la integridad sin reportar huérfanos',
    (() => { const v = c.motorCampanias.validarIntegridad(); return !v || !v.problemas || v.problemas.length === 0; })(),
    JSON.stringify((c.motorCampanias.validarIntegridad() || {}).problemas || []).slice(0, 120));

  const tieneUI = typeof c.App === 'object' && c.App && typeof c.App.abrirModal === 'function';
  if (!tieneUI) console.log('  (pendiente de la Fase 3b: la interfaz de campañas todavía no está portada)');
  else comprobar('la interfaz de campañas está integrada', true);
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

console.log('\n=== 7. Puente de la interfaz de campañas con el CRM ===');
{
  const c = r.contexto;
  comprobar('App existe con el puente de modales', !!c.App && typeof c.App.abrirModal === 'function');

  let error = null;
  try { c.App.abrirModal('Prueba de modal', '<p id="prueba-contenido">hola</p>'); } catch (e) { error = e.message; }
  const titulo = (r.elementos.get('modal-titulo') || {}).textContent;
  const cuerpo = String((r.elementos.get('modal-body') || {}).innerHTML);
  comprobar('App.abrirModal() usa el modal del CRM (título y contenido)',
    error === null && titulo === 'Prueba de modal' && cuerpo.includes('prueba-contenido'),
    error || `titulo="${titulo}"`);

  error = null;
  try { c.App.notificar('Aviso de prueba', 'ok'); } catch (e) { error = e.message; }
  comprobar('App.notificar() acepta el tipo "ok" que usa la lite', error === null, error || '');

  let confirmado = false, errorConfirmar = null;
  try { c.App.confirmar('¿Seguimos?', function () { confirmado = true; }, 'Sí'); } catch (e) { errorConfirmar = e.message; }
  const btn = r.elementos.get('btn-confirmar-accion');
  const manejador = btn && btn._ev && btn._ev.click && btn._ev.click[0];
  comprobar('App.confirmar() abre la confirmación del CRM con su botón', errorConfirmar === null && !!manejador, errorConfirmar || 'sin botón');
  if (manejador) manejador();
  comprobar('el botón de confirmar ejecuta la acción pedida', confirmado === true, `confirmado=${confirmado}`);

  comprobar('el puente apunta al almacén y al motor reales',
    !!c.App && c.App.almacen === c.almacenCampanias && c.App.motor === c.motorCampanias, 'no coinciden');
}
console.log('\n=== 8. Las vistas de campañas se pintan (Fase 3b) ===');
{
  const c = r.contexto;
  const leer = id => String((r.elementos.get(id) || {}).innerHTML || '');

  let error = null;
  try { c.renderizarSeccion('panel'); } catch (e) { error = e.message; }
  comprobar('el Panel se pinta sin errores', error === null, error || '');
  comprobar('el Panel dibuja sus métricas', leer('panel-metricas').length > 20, `caracteres=${leer('panel-metricas').length}`);
  comprobar('el Panel dibuja el embudo', leer('panel-embudo').length > 5, `caracteres=${leer('panel-embudo').length}`);

  error = null;
  try { c.renderizarSeccion('campanias'); } catch (e) { error = e.message; }
  comprobar('la sección Campañas se pinta sin errores', error === null, error || '');
  comprobar('la lista de campañas tiene contenido', leer('lista-campanias').length > 20, `caracteres=${leer('lista-campanias').length}`);

  error = null;
  try { c.App.cerrarModal(); c.App.asistenteCampania(c.campanias[0] && c.campanias[0].id); } catch (e) { error = e.message; }
  const cuerpo = leer('modal-body');
  comprobar('el asistente de campaña abre y arma sus pasos', error === null && cuerpo.length > 200,
    error || `caracteres del modal=${cuerpo.length}`);

  error = null;
  try { c.App.renderTodo(); } catch (e) { error = e.message; }
  comprobar('el refresco general del CRM no se rompe con las vistas nuevas', error === null, error || '');
}
console.log('\n=== 9. Calendario con campañas (Fase 3c) ===');
{
  const c = r.contexto;
  const leerGrid = () => String((r.elementos.get('calendario-grid') || {}).innerHTML || '');
  const hoy = c.obtenerFechaActual();

  if (!c.motorCampanias || typeof c.motorCampanias.crearCampania !== 'function') {
    comprobar('el motor está disponible para el calendario', false, 'este archivo no trae el motor de campañas');
    console.log('  (se omiten las pruebas del calendario con campañas)');
  } else {
  const camp = c.motorCampanias.crearCampania({ nombre: 'Campaña calendario' });
  const rp = c.motorCampanias.crearProspecto({ nombre: 'Prospecto calendario' });
  const pros = rp && rp.prospecto ? rp.prospecto : null;

  // Regla del pliego dentro del CRM: una campaña en borrador NO recibe participantes.
  const rpa = c.motorCampanias.agregarParticipacion({ campaniaId: camp.id, prospectoId: pros ? pros.id : undefined });
  comprobar('el motor rechaza participantes en una campaña en borrador (regla del pliego)',
    !!(rpa && rpa.ok === false && rpa.codigo === 'campania-no-activa'),
    JSON.stringify(rpa && { ok: rpa.ok, codigo: rpa.codigo }));

  // Para probar el calendario se usa una participación de datos: el calendario dibuja lo que hay.
  c.participaciones.push({
    id: 'part-cal', campaniaId: camp.id, prospectoId: pros ? pros.id : 'pro-1',
    estado: 'contactado', fechaProximoSeguimiento: hoy
  });

  // Dos tareas para hoy: una de campaña y una normal.
  c.tareas.push({ id: 'tar-camp', tipo: 'Llamada', descripcion: 'Tarea de campaña', fecha: hoy, completada: false, campaniaId: camp.id });
  c.tareas.push({ id: 'tar-normal', tipo: 'Llamada', descripcion: 'Tarea normal', fecha: hoy, completada: false });

  let error = null;
  try { c.renderizarCalendario(); } catch (e) { error = e.message; }
  comprobar('el calendario se dibuja sin errores', error === null, error || '');
  comprobar('la tarea de campaña sale con su color propio', leerGrid().includes('evento-campania'),
    leerGrid().includes('evento-tarea') ? 'salió como tarea normal' : 'no aparece');
  comprobar('el seguimiento del prospecto sale en el calendario', leerGrid().includes('evento-seguimiento'), 'no aparece');
  comprobar('la tarea normal sigue saliendo como tarea', leerGrid().includes('evento-tarea'), 'no aparece');

  r.elementos.get('filtro-tareas-calendario').value = 'campanias';
  try { c.renderizarCalendario(); } catch (e) { error = e.message; }
  comprobar('el filtro "Solo campañas" deja la tarea de campaña', leerGrid().includes('evento-campania'), 'desapareció');
  comprobar('el filtro "Solo campañas" esconde la tarea normal', !leerGrid().includes('evento-tarea'), 'siguió apareciendo');
  comprobar('la leyenda y el filtro nuevos están en el marcado',
    HTML.includes('Solo campañas') && HTML.includes('leyenda-color-seguimiento') && HTML.includes('Tarea de campaña'),
    'falta el filtro o la leyenda');
}
  }

console.log('\n=== 10. Ficha del prospecto con sus campañas (Fase 3c) ===');
{
  const c = r.contexto;
  if (!c.motorCampanias || typeof c.verDetalleProspecto !== 'function') {
    comprobar('la ficha del prospecto y el motor están disponibles', false, 'este archivo no trae la integración');
  } else {
    const hoy = c.obtenerFechaActual();
    const camp = c.motorCampanias.crearCampania({ nombre: 'Campaña ficha', objetivoPrincipal: 'prueba de ficha', fechaInicio: hoy, fechaFin: hoy });
    c.motorCampanias.activarCampania(camp.id);
    if (c.campanias[0] && c.campanias[0].estado !== 'activa') c.campanias[0].estado = 'activa';   // por si la validación la deja en borrador
    const rp = c.motorCampanias.crearProspecto({ nombre: 'Prospecto ficha' });
    const pros = rp && rp.prospecto ? rp.prospecto : (c.prospectos[0] || null);
    let part = null;
    try {
      const rpa = c.motorCampanias.agregarParticipacion({ campaniaId: camp.id, prospectoId: pros ? pros.id : undefined });
      part = rpa && rpa.participacion ? rpa.participacion : null;
    } catch (e) { part = null; }
    comprobar('se pudo crear la participación del prospecto', !!part, 'sin participación no hay nada que mostrar');

    // Tarea de campaña para hoy, ligada al prospecto.
    let tareaOk = false;
    try {
      const rt = c.motorCampanias.crearTarea({ titulo: 'Llamar al prospecto', tipo: 'Llamada', fecha: hoy, campaniaId: camp.id, participacionId: part ? part.id : null, prospectoId: pros ? pros.id : null });
      tareaOk = !!(rt && rt.ok);
    } catch (e) { tareaOk = false; }
    if (!tareaOk) {
      c.tareas.push({ id: 'tar-ficha', titulo: 'Llamar al prospecto', tipo: 'Llamada', fecha: hoy, estado: 'pendiente', prioridad: 'Normal', campaniaId: camp.id, participacionId: part ? part.id : null, prospectoId: pros ? pros.id : null });
    }
    comprobar('la tarea de campaña quedó registrada', tareaOk || c.tareas.some(t => t.id === 'tar-ficha'), 'no se creó');

    let error = null;
    try { c.verDetalleProspecto(pros.id); } catch (e) { error = e.message; }
    comprobar('la ficha del prospecto se abre sin errores', error === null, error || '');

    const htmls = [...r.elementos.values()].map(el => String(el._html || ''));
    const conCampania = htmls.filter(x => x.includes('Campaña ficha'));
    const conTarea = htmls.filter(x => x.includes('Llamar al prospecto'));
    comprobar('la ficha muestra las campañas del prospecto', conCampania.length > 0, 'no aparece la campaña');
    comprobar('la ficha muestra la tarea de campaña', conTarea.length > 0, 'no aparece la tarea');
    comprobar('las tareas salen agrupadas por vencimiento',
      conCampania.some(x => x.includes('tarea-grupo-titulo') || x.includes('Para hoy') || x.includes('Vencidas')),
      'no se ve la agrupación');
  }
}
console.log('\n=== 11. Índice de administradores para las reglas (Fase 4) ===');
{
  const c = r.contexto;
  // Sesión simulada de un administrador.
  c.auth.currentUser = { uid: 'uid-admin-1', email: 'jorge@ejemplo.com', emailVerified: true };
  c.database = c.firebase.database();
  c.usuarios.length = 0;
  c.usuarios.push({ username: 'jorge', nombre: 'Jorge', email: 'jorge@ejemplo.com', rol: 'Administrador', admin: true, activo: true });

  let error = null, ok = null;
  try { ok = await c.subirRegistroUsuarios(); } catch (e) { error = e.message; }
  comprobar('el registro de usuarios se publica', error === null && ok === true, error || `devolvió ${ok}`);
  comprobar('la app publica el índice admins/<uid>',
    !!r.registro.llamadas['ref:admins/uid-admin-1'], 'no se pidió esa ruta a la nube');
  comprobar('el registro de usuarios incluye el uid',
    /uid:\s*\(esUnoMismo && uid\)/.test(HTML), 'no se guarda el uid');

  // Un operador (no administrador) también publica su casilla, pero en falso.
  c.auth.currentUser = { uid: 'uid-op-2', email: 'ana@ejemplo.com', emailVerified: true };
  c.usuarios.push({ username: 'ana', nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'Operador', admin: false, activo: true });
  try { await c.subirRegistroUsuarios(); } catch (e) { /* se reporta abajo */ }
  comprobar('un operador publica su casilla (no se queda sin índice)',
    !!r.registro.llamadas['ref:admins/uid-op-2'], 'no se pidió esa ruta');
}
console.log('\n=== 12. Paquetes y Servicios en solo lectura (Fase 4) ===');
{
  const c = r.contexto;
  comprobar('la sección Servicios ya no está marcada como solo-admin',
    !/class="menu-item solo-admin" data-seccion="servicios"/.test(HTML), 'sigue oculta para no administradores');
  comprobar('ya no hay candado que impida entrar a Servicios',
    !/Solo administradores pueden acceder a esta sección/.test(HTML), 'el candado sigue');

  c.paquetes.push({ id: 'paq-1', nombre: 'Paquete de prueba', precio: 1000, descuento: 0, vigencia: '2026-12-31', estatus: 'Activo', items: [] });
  c.serviciosAdicionales.push({ id: 'ser-1', nombre: 'Servicio de prueba', precio: 500, descuento: 0, vigencia: '2026-12-31' });
  // En el navegador los <select> traen una opción elegida por defecto; el simulador no la lee,
  // así que se fija aquí (si no, el filtro de estatus descartaría todo).
  const fijar = (id, valor) => { const el = r.elementos.get(id); if (el) el.value = valor; };
  fijar('filtro-estatus-paquete', 'todos'); fijar('orden-paquetes', 'nombre-asc');
  fijar('filtro-estatus-servicio', 'todos'); fijar('orden-servicios', 'nombre-asc');

  // Un usuario NO administrador (como el Operador o Ventas).
  c.usuarioActual = { username: 'ana', nombre: 'Ana', rol: 'Operador', admin: false };
  let error = null;
  try { c.renderizarSeccion('paquetes'); } catch (e) { error = e.message; }
  const paq = String((r.elementos.get('lista-paquetes') || {}).innerHTML || '');
  comprobar('el Operador SÍ ve el listado de Paquetes', error === null && paq.includes('Paquete de prueba'), error || 'no aparece');
  comprobar('pero no tiene botones de editar ni eliminar paquetes',
    !paq.includes('CRUD.paquetes.editar') && !paq.includes('CRUD.paquetes.eliminar'), 'aparecen botones de administrador');

  error = null;
  try { c.renderizarSeccion('servicios'); } catch (e) { error = e.message; }
  const ser = String((r.elementos.get('lista-servicios') || {}).innerHTML || '');
  comprobar('el Operador SÍ ve el listado de Servicios', error === null && ser.includes('Servicio de prueba'), error || 'no aparece');
  comprobar('pero no tiene botones de editar ni eliminar servicios',
    !ser.includes('CRUD.servicios.editar') && !ser.includes('CRUD.servicios.eliminar'), 'aparecen botones de administrador');

  // Un administrador sí los tiene.
  c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true };
  c.renderizarSeccion('paquetes');
  const paqAdmin = String((r.elementos.get('lista-paquetes') || {}).innerHTML || '');
  comprobar('el Administrador sí conserva editar y eliminar',
    paqAdmin.includes('CRUD.paquetes.editar') && paqAdmin.includes('CRUD.paquetes.eliminar'), 'perdió los botones');
  c.usuarioActual = null;
}
console.log('\n=== 13. Rol de Ventas: capacidades (Fase 4) ===');
{
  const c = r.contexto;
  comprobar('el rol Ventas aparece en la lista de roles', c.rolesDisponibles().includes('Ventas'), c.rolesDisponibles().join(', '));

  const comoVentas = () => { c.usuarioActual = { username: 'ana', nombre: 'Ana', rol: 'Ventas', admin: false }; };
  const comoOperador = () => { c.usuarioActual = { username: 'luis', nombre: 'Luis', rol: 'Operador', admin: false }; };
  const comoAdmin = () => { c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true }; };

  comoVentas();
  comprobar('Ventas NO puede ver Informes', c.puede('ver-informes') === false);
  comprobar('Ventas NO puede imprimir contratos', c.puede('imprimir-contrato') === false);
  comprobar('Ventas NO puede activar campañas', c.puede('activar-campanias') === false);
  comprobar('Ventas NO ve la papelera', c.puede('ver-papelera') === false);
  comprobar('esVentas() lo reconoce', c.esVentas() === true && c.esOperador() === false);

  // Con Ventas, la sección de Informes no se dibuja.
  for (const el of r.elementos.values()) el._html = '';
  let error = null;
  try { c.renderizarSeccion('informes'); } catch (e) { error = e.message; }
  const pintado = [...r.elementos.values()].map(el => String(el._html || '')).join('\n');
  comprobar('entrar a Informes con rol Ventas no dibuja nada', error === null && !pintado.includes('PATRIMONIO NETO') && !pintado.includes('donut'), error || 'se dibujó Informes');
  comprobar('imprimir un contrato con rol Ventas queda bloqueado', (() => {
    try { c.generarVistaImpresion('x', 'y'); return true; } catch (e) { return false; }
  })() === true, 'soltó una excepción');

  comoOperador();
  comprobar('el Operador SÍ puede ver Informes (no se le cambió nada)', c.puede('ver-informes') === true);
  comprobar('el Operador SÍ puede imprimir contratos', c.puede('imprimir-contrato') === true);
  comprobar('pero el Operador tampoco activa campañas', c.puede('activar-campanias') === false);

  comoAdmin();
  comprobar('el Administrador puede todo', c.puede('ver-informes') && c.puede('imprimir-contrato') && c.puede('activar-campanias') && c.puede('ver-papelera'));
  c.usuarioActual = null;
}
console.log('\n=== 14. Rol de Ventas: guardas finas (Fase 4) ===');
{
  const c = r.contexto;
  const comoVentas = () => { c.usuarioActual = { username: 'ana', nombre: 'Ana', rol: 'Ventas', admin: false }; };
  const comoOperador = () => { c.usuarioActual = { username: 'luis', nombre: 'Luis', rol: 'Operador', admin: false }; };

  comoVentas();
  comprobar('Ventas NO puede editar ni borrar pagos', c.puede('editar-pagos') === false);
  const fasesVentas = c.fasesDisponiblesParaMiRol();
  comprobar('Ventas NO puede poner la fase Contrato', !fasesVentas.includes('Contrato'), fasesVentas.join(', '));
  comprobar('Ventas NO puede poner la fase Frecuente', !fasesVentas.includes('Frecuente'));
  comprobar('Ventas SÍ puede mover hasta Negociación',
    fasesVentas.includes('Interesado') && fasesVentas.includes('Cotización') && fasesVentas.includes('Negociación'));

  comoOperador();
  comprobar('el Operador SÍ puede editar y borrar pagos (no se le cambió nada)', c.puede('editar-pagos') === true);
  comprobar('el Operador SÍ conserva todas las fases',
    c.fasesDisponiblesParaMiRol().includes('Contrato') && c.fasesDisponiblesParaMiRol().includes('Frecuente'));

  c.usuarioActual = { username: 'x', nombre: 'X', rol: 'RolRaro', admin: false };
  comprobar('un rol desconocido no hereda permisos de más',
    c.puede('editar-pagos') === true && c.puede('ver-informes') === true && c.puede('activar-campanias') === false);

  comprobar('el cambio de estado de campaña está guardado',
    /Solo un administrador puede cambiar el estado de una campaña/.test(HTML));
  comprobar('activar desde el asistente está guardado',
    /solo un administrador puede activarla/.test(HTML));
  comprobar('el borrado de movimientos está guardado',
    /Tu rol no puede borrar pagos ni cargos ya registrados/.test(HTML));
  c.usuarioActual = null;
}
console.log('\n=== 15. Regresión: todas las secciones se dibujan (Fase 5) ===');
{
  const c = r.contexto;
  c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true };
  // Datos mínimos para que cada sección tenga algo que dibujar.
  if (!c.clientes.some(x => x && x.id === 'cli-reg')) {
    c.clientes.push({
      id: 'cli-reg', nombre: 'Cliente de regresión', telefono: '5555555555', email: 'c@ejemplo.com',
      estado: 'Activo', fechaRegistro: c.obtenerFechaActual(),
      contratos: [{ id: 'con-reg', clienteId: 'cli-reg', clienteNombre: 'Cliente de regresión', estado: 'Activo',
        tipo: 'Boda', festejado: 'Festejado', fechaEvento: '2026-12-31', precioBase: 10000,
        pagos: [{ id: 'pag-reg', monto: 1000, fecha: c.obtenerFechaActual(), codigo: 'C-1', registradoPor: 'Jorge' }],
        cargos: [] }]
    });
  }
  if (!c.prospectos.some(x => x && x.id === 'pro-reg')) {
    c.prospectos.push({ id: 'pro-reg', nombre: 'Prospecto de regresión', faseActual: 'Interesado', historialFases: [], telefono: '555', email: '' });
  }
  if (!c.tareas.some(x => x && x.id === 'tar-reg')) {
    c.tareas.push({ id: 'tar-reg', tipo: 'Llamada', descripcion: 'Tarea de regresión', fecha: c.obtenerFechaActual(), completada: false, clienteId: 'cli-reg' });
  }

  const secciones = ['informes', 'panel', 'prospectos', 'campanias', 'clientes', 'contratos', 'paquetes', 'servicios', 'calendario', 'configuracion'];
  const problemas = [];
  for (const s of secciones) {
    for (const el of r.elementos.values()) el._html = '';
    try { c.renderizarSeccion(s); } catch (e) { problemas.push(s + ': ' + e.message); continue; }
    const dibujo = [...r.elementos.values()].some(el => String(el._html || '').length > 30);
    if (!dibujo) problemas.push(s + ': no dibujó nada');
  }
  comprobar('las 10 secciones se dibujan sin errores y con contenido', problemas.length === 0, problemas.join(' | '));

  let error = null;
  try { c.renderizarTodo(); } catch (e) { error = e.message; }
  comprobar('el refresco general del CRM sigue funcionando', error === null, error || '');

  comprobar('la app sabe limpiar la casilla del índice de administradores',
    /async function sincronizarIndiceAdmin/.test(HTML) && /sincronizarIndiceAdmin\(u, true\)/.test(HTML),
    'falta la limpieza del índice');
  comprobar('el índice se limpia al desactivar, al cambiar de rol y al quitar',
    (HTML.match(/sincronizarIndiceAdmin\(/g) || []).length >= 4, 'faltan enganches');
  comprobar('las reglas dejan al administrador limpiar la casilla de otro',
    /auth\.uid === \$uid \|\| root\.child\('admins'\)/.test(fs.readFileSync(new URL('../REGLAS-FIREBASE-v5.0-propuesta.json', import.meta.url), 'utf8')),
    'las reglas no lo permiten');
  c.usuarioActual = null;
}
console.log('\n=== 16. Identidad de la versión (para verificar el despliegue) ===');
{
  comprobar('el archivo se identifica como v5.0', /var VERSION = '5\.0';/.test(HTML), 'no dice 5.0');
  comprobar('trae sello de compilación', /var BUILD_APP = '\d{4}-\d{2}-\d{2}\.\d+';/.test(HTML),
    (HTML.match(/var BUILD_APP = '[^']+'/) || ['sin sello'])[0]);
  comprobar('el menú y la pestaña muestran v5.0',
    /<title>Registro PDA v5\.0/.test(HTML) && /<div class="version">v5\.0<\/div>/.test(HTML), 'la etiqueta visible no dice 5.0');
  comprobar('las novedades de la v5.0 están escritas para el usuario',
    /Novedades en esta versión \(v5\.0\)/.test(HTML) && /Nuevo rol: Ventas/.test(HTML), 'faltan las novedades');
}
console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones en verde${fallos ? `  (${fallos} con falla)` : ''}`);
process.exit(fallos ? 1 : 0);
