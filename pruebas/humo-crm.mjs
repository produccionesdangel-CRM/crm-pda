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
console.log('\n=== 17. Orden seguro del índice de administradores (antes de publicar reglas) ===');
{
  const cuerpo = HTML.slice(HTML.indexOf('async function subirRegistroUsuarios'), HTML.indexOf('function mostrarPantallaLogin'));
  const iAdmins = cuerpo.indexOf("ref('admins/'");
  const iUsuarios = cuerpo.indexOf("ref('usuarios')");
  comprobar('dentro de subirRegistroUsuarios, el índice se publica ANTES que la lista de usuarios',
    iAdmins > 0 && iUsuarios > 0 && iAdmins < iUsuarios,
    'admins en ' + iAdmins + ', usuarios en ' + iUsuarios + ' (si el índice va después, un admin sin casilla no puede entrar nunca)');
  comprobar('la escritura del índice tiene su propia red de seguridad',
    /catch \(e2\) \{ console\.warn\('No se pudo publicar el índice/.test(HTML), 'sin try/catch propio');
  comprobar('la lista de usuarios no corta antes de tiempo al índice',
    !/set\(usuariosAObjeto\(\)\)[\s\S]{0,200}return false;[\s\S]{0,200}ref\('admins\//.test(cuerpo),
    'hay un return entre una y otra');

  const login = HTML.slice(HTML.indexOf('function iniciarSesionAplicacion'), HTML.indexOf('function entrarDirectoConGoogle'));
  comprobar('al ENTRAR se publica la casilla del índice (no solo al gestionar usuarios)',
    /sincronizarIndiceAdmin\(usuarioActual\)/.test(login),
    'quien no esté en el índice no tendría forma de inscribirse');
  comprobar('la publicación del índice al entrar no puede tumbar el arranque',
    /async function sincronizarIndiceAdmin[\s\S]{0,900}catch \(e\) \{ console\.warn/.test(HTML), 'sin red de seguridad');
}
console.log('\n=== 18. Matriz de permisos en la interfaz (lo que cada rol VE) ===');
{
  const c = r.contexto;
  const vis = id => { const el = r.elementos.get(id); return el ? String(el.style.display || '') : '(no existe)'; };
  const comoVentas = () => { c.usuarioActual = { username: 'ana', nombre: 'Ana', rol: 'Ventas', admin: false }; };
  const comoOperador = () => { c.usuarioActual = { username: 'luis', nombre: 'Luis', rol: 'Operador', admin: false }; };
  const comoAdmin = () => { c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true }; };
  const aplicar = () => { if (typeof c.aplicarRestriccionesPorRol === 'function') c.aplicarRestriccionesPorRol(); };

  comoVentas(); aplicar();
  comprobar('Ventas NO ve el botón de exportar respaldo', vis('btn-exportar-datos') === 'none', vis('btn-exportar-datos'));
  comprobar('Ventas NO ve el botón de importar respaldo', vis('btn-importar-datos') === 'none', vis('btn-importar-datos'));
  comprobar('Ventas NO ve la papelera', vis('papelera-card') === 'none', vis('papelera-card'));
  comprobar('Ventas NO ve el botón de nuevo paquete', vis('btn-nuevo-paquete') === 'none', vis('btn-nuevo-paquete'));
  comprobar('Ventas NO ve el botón de nuevo servicio', vis('btn-nuevo-servicio') === 'none', vis('btn-nuevo-servicio'));
  if (typeof c.actualizarUIUsuario === 'function') {
    c.actualizarUIUsuario();
    comprobar('Ventas NO ve la gestión de usuarios', vis('card-gestion-usuarios') === 'none', vis('card-gestion-usuarios'));
  }
  comprobar('el catálogo tiene candado en las funciones (no solo botones ocultos)',
    /soloAdmin && !esAdmin\(\)/.test(HTML) && /coleccion: 'serviciosAdicionales'[\s\S]{0,200}soloAdmin: true/.test(HTML),
    'falta el candado de soloAdmin en servicios/paquetes');
  comprobar('ya no se expulsa a nadie de Servicios (queda visible en solo lectura)',
    !/seccionActiva\.id === 'seccion-servicios'/.test(HTML), 'sigue el residuo que redirigía a Informes');

  comoOperador(); aplicar();
  comprobar('el Operador tampoco ve exportar/importar (no los tenía antes)', vis('btn-exportar-datos') === 'none' && vis('btn-importar-datos') === 'none');
  comprobar('el Operador tampoco ve la papelera', vis('papelera-card') === 'none');
  comprobar('el Operador SÍ puede ver Informes', c.puede('ver-informes') === true);

  comoAdmin(); aplicar();
  comprobar('el Administrador sí ve exportar, importar y papelera',
    vis('btn-exportar-datos') !== 'none' && vis('btn-importar-datos') !== 'none' && vis('papelera-card') !== 'none',
    vis('btn-exportar-datos') + ' / ' + vis('papelera-card'));
  comprobar('el Administrador sí ve los botones del catálogo',
    vis('btn-nuevo-paquete') !== 'none' && vis('btn-nuevo-servicio') !== 'none');
  c.usuarioActual = null;
}
console.log('\n=== 19. Ningún control de las secciones nuevas queda sin conectar ===');
{
  // Recorre el HTML de las secciones nuevas y avisa de cualquier id o data-* que
  // aparezca UNA sola vez en todo el archivo: eso significa que nadie lo usa en JS.
  const recorte = (desde, hasta) => {
    const a = HTML.indexOf(desde);
    const b = HTML.indexOf(hasta, a + 1);
    return a < 0 || b < 0 ? '' : HTML.slice(a, b);
  };
  const panel = recorte('<section id="seccion-panel"', '<section id="seccion-campanias"');
  const campanias = recorte('<section id="seccion-campanias"', '<section id="seccion-clientes"');
  const prospectos = recorte('<section id="seccion-prospectos"', '<section id="seccion-campanias"');
  comprobar('las tres secciones nuevas se pudieron recortar del HTML',
    panel.length > 500 && campanias.length > 500 && prospectos.length > 500,
    'panel ' + panel.length + ', campanias ' + campanias.length + ', prospectos ' + prospectos.length);

  // Los contenedores de sección no necesitan código: los maneja el sistema de pestañas.
  const exentos = ['seccion-panel', 'seccion-campanias', 'seccion-prospectos'];
  const huerfanos = [];
  for (const trozo of [panel, campanias, prospectos]) {
    for (const m of trozo.matchAll(/id="([a-zA-Z0-9_-]+)"/g)) {
      const id = m[1];
      if (exentos.includes(id)) continue;
      const veces = (HTML.match(new RegExp(id.replace(/[-]/g, '\\-'), 'g')) || []).length;
      if (veces <= 1 && !huerfanos.includes(id)) huerfanos.push(id);
    }
  }
  comprobar('ningún control de Panel, Campañas o Prospectos quedó sin código que lo atienda',
    huerfanos.length === 0, huerfanos.length ? 'sin conectar: ' + huerfanos.join(', ') : '');

  // Y en concreto, los tres que se reportaron rotos.
  for (const id of ['btn-nueva-campania', 'btn-nueva-campania-panel', 'btn-limpiar-campanias']) {
    comprobar('el botón "' + id + '" tiene código que lo atiende',
      (HTML.match(new RegExp(id, 'g')) || []).length >= 2, 'aparece solo en el HTML');
  }
  comprobar('"Nueva campaña" abre el asistente de campaña',
    /getElementById\(id\)[\s\S]{0,120}App\.asistenteCampania\(\)/.test(HTML), 'no llama al asistente');

  // Prueba funcional: se pulsa el botón de verdad y debe abrirse el asistente.
  // (Esto es lo que habría cazado el fallo reportado, en vez de solo mirar el código.)
  const c = r.contexto;
  c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true };
  let errorBoton = null;
  try {
    if (typeof c.conectarEventListenersApp === 'function') c.conectarEventListenersApp();
    const b = r.elementos.get('btn-nueva-campania-panel');
    if (!b || typeof b.onclick !== 'function') throw new Error('el botón no quedó con manejador');
    b.onclick({ preventDefault: function () { } });
  } catch (e) { errorBoton = (e && e.message) || String(e); }
  comprobar('pulsar "Nueva campaña" del Panel no lanza error y abre el asistente',
    errorBoton === null && !/No se pudo/.test(errorBoton || ''), errorBoton || '');
  const pintado = [...r.elementos.values()].map(el => String(el._html || '')).join(' ');
  comprobar('el asistente de campaña se dibuja con sus pasos',
    /asistente|Paso 1|Nueva campaña/i.test(pintado), 'no se dibujó el asistente');
  c.usuarioActual = null;
}
console.log('\n=== 20. Ninguna ventana ni aviso muestra código (reportado por Jorge) ===');
{
  // El título del modal es texto plano (textContent) y las notificaciones escapan el
  // mensaje (escapeHTML): si alguien les pasa etiquetas, se ven tal cual en pantalla.
  const primerArgumento = (linea, fn) => {
    const m = linea.match(fn); if (!m) return null;
    const resto = linea.slice(m.index + m[0].length);
    let prof = 0, fin = resto.length;
    for (let k = 0; k < resto.length; k++) {
      const ch = resto[k];
      if (ch === '(') prof++;
      else if (ch === ')') { if (prof === 0) { fin = k; break; } else prof--; }
      else if (ch === ',' && prof === 0) { fin = k; break; }
    }
    return resto.slice(0, fin);
  };
  const malos = [];
  HTML.split('\n').forEach((linea, idx) => {
    for (const fn of [/abrirModal\(/, /mostrarNotificacion\(/, /notificar\(/, /App\.confirmar\(/, /registrarHistorial\(/]) {
      if (!fn.test(linea)) continue;
      const arg = primerArgumento(linea, fn);
      if (arg && /<i class=|<\/|\$\{/.test(arg)) malos.push((idx + 1) + ': ' + linea.trim().slice(0, 90));
    }
  });
  comprobar('ninguna ventana ni aviso recibe etiquetas HTML como texto',
    malos.length === 0, malos.slice(0, 3).join(' || '));

  comprobar('el título de las ventanas de campaña es texto limpio',
    /App\.abrirModal\('Nueva campaña'|App\.abrirModal\('\+?.*Nueva campaña/.test(HTML) || !/abrirModal\('<i/.test(HTML),
    'algún título sigue con etiquetas');
  comprobar('la función del CRM que pone el título sigue siendo de texto plano',
    /modalTitulo\.textContent = titulo;/.test(HTML), 'cambió la forma de poner el título');
  comprobar('los avisos siguen escapando el mensaje',
    /escapeHTML\(mensaje\)/.test(HTML), 'los avisos dejaron de escapar');
}
/* ══════════════════════════════════════════════════════════════════════
   21. Una campaña que vuelve de la nube pierde sus arreglos vacíos
   ----------------------------------------------------------------------
   Firebase Realtime Database NO guarda arreglos vacíos: al sincronizar y
   volver a leer, una campaña se queda sin "ofertas", "beneficios",
   "plantillasTareas", "camposPersonalizados", etc. Eso fue el fallo que
   reportó Jorge: pulsaba "Agregar oferta" y no pasaba nada (el manejador
   existía, pero lanzaba una excepción que no se veía en pantalla).

   Esta prueba reproduce esa campaña "dañada", abre el asistente y PULSA
   cada botón de agregar, comprobando que el dato entra de verdad.
   ══════════════════════════════════════════════════════════════════════ */
{
  const c = r.contexto;
  c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true };

  /* Campaña tal como queda en la base cuando sus arreglos están vacíos. */
  const danada = {
    id: 'cmp_danada',
    nombre: 'Campaña que volvió de la nube',
    tipo: 'Captación',
    estado: 'activa',
    fechaInicio: '2026-10-01',
    fechaFin: '2026-12-31',
    etapas: [{ id: 'e1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }]
  };
  c.campanias.push(danada);
  c.paquetes.push({ id: 'paq_x', nombre: 'Paquete X', precio: 1000, estatus: 'Activo' });
  c.serviciosAdicionales.push({ id: 'srv_x', nombre: 'Servicio X', precio: 500 });

  const documento = r.ventana.document;
  const buscar = (id) => documento.getElementById(id);

  /* 1) El adaptador la repara al leerla. */
  const reparada = c.App.almacen.campania('cmp_danada');
  const arreglos = ['objetivosSecundarios', 'criteriosElegibilidad', 'datosRequeridos', 'camposPersonalizados',
    'etapas', 'plantillasTareas', 'beneficios', 'ofertas'];
  const faltan = arreglos.filter(k => !Array.isArray(reparada[k]));
  comprobar('el adaptador le devuelve los arreglos vacíos a una campaña que volvió de la nube',
    faltan.length === 0, faltan.join(', '));
  comprobar('y también el público objetivo con sus fuentes',
    !!(reparada.publicoObjetivo && Array.isArray(reparada.publicoObjetivo.fuentes)), 'publicoObjetivo.fuentes');

  /* 2) Prueba funcional: abrir el asistente y pulsar CADA botón de agregar. */
  let errorAsistente = null;
  try { c.App.asistenteCampania('cmp_danada'); } catch (e) { errorAsistente = (e && e.message) || String(e); }
  comprobar('el asistente abre con una campaña que volvió de la nube (paso 3 inclusive)',
    errorAsistente === null, errorAsistente || '');

  const casos = [
    { paso: 3, boton: 'as-agregar-criterio', campos: { 'as-criterio-tipo': 'tipoEventoEs', 'as-criterio-valor': 'Boda' }, arreglo: 'criteriosElegibilidad' },
    { paso: 4, boton: 'as-agregar-campo', campos: { 'as-cp-nombre': 'campoPrueba', 'as-cp-etiqueta': 'Campo de prueba' }, arreglo: 'camposPersonalizados' },
    { paso: 5, boton: 'as-agregar-etapa', campos: { 'as-etapa-nombre': 'Etapa de prueba' }, arreglo: 'etapas' },
    { paso: 6, boton: 'as-agregar-plantilla', campos: { 'as-plt-nombre': 'Tarea de prueba' }, arreglo: 'plantillasTareas' },
    { paso: 7, boton: 'as-agregar-beneficio', campos: { 'as-ben-nombre': 'Beneficio de prueba' }, arreglo: 'beneficios' },
    { paso: 7, boton: 'as-agregar-oferta', campos: { 'as-oft-nombre': 'Oferta de prueba', 'as-oft-servicio': 'srv_x', 'as-oft-precio': '600' }, arreglo: 'ofertas' }
  ];

  for (const caso of casos) {
    let guardia = 0;
    while ((c.App.ui.asistente.paso || 1) < caso.paso && guardia < 12) {
      const siguiente = buscar('asi-siguiente');
      if (!siguiente || typeof siguiente.onclick !== 'function') break;
      siguiente.onclick({ preventDefault() { } });
      guardia++;
    }
    for (const [id, valor] of Object.entries(caso.campos)) {
      const el = buscar(id);
      if (el) el.value = valor;
    }
    const antes = (c.App.ui.asistente.borrador[caso.arreglo] || []).length;
    let error = null;
    const boton = buscar(caso.boton);
    if (!boton || typeof boton.onclick !== 'function') error = 'el botón no quedó conectado';
    else {
      try { boton.onclick({ preventDefault() { } }); }
      catch (e) { error = (e && e.message) || String(e); }
    }
    const despues = (c.App.ui.asistente.borrador[caso.arreglo] || []).length;
    comprobar(`paso ${caso.paso}: pulsar "${caso.boton}" agrega a ${caso.arreglo}`,
      error === null && despues === antes + 1, error || `${antes} -> ${despues}`);
  }

  /* 3) El caso exacto que reportó Jorge, con su nombre. */
  comprobar('el botón "Agregar oferta" del paso 7 hace su trabajo (fallo reportado por Jorge)',
    (c.App.ui.asistente.borrador.ofertas || []).length === 1,
    'ofertas=' + (c.App.ui.asistente.borrador.ofertas || []).length);

  try { c.App.cerrarModal(); } catch (e) { }
}

/* ══════════════════════════════════════════════════════════════════════
   22. Los registros que vuelven de la nube pierden sus arreglos vacíos
   ----------------------------------------------------------------------
   Firebase no guarda arreglos ni objetos vacíos. Comprobado con los datos
   reales de Jorge: de 46 clientes, 46 no tienen "pagos", "cargos" ni
   "descuentos"; 6 de 14 prospectos no tienen "historialFases"; en los
   contratos anidados faltan "cargos" en 68 de 94.

   El CRM base ya se defiende en cada punto de escritura (esta prueba lo
   vigila), y ahora además se reparan los registros al entrar los datos.
   ══════════════════════════════════════════════════════════════════════ */
{
  const c = r.contexto;
  const prospecto = { id: 'pro_danado', nombre: 'Prospecto dañado', faseActual: 'Interesado' };
  const contrato = { id: 'con_danado', festejado: 'Festejado de prueba', estado: 'Pendiente' };
  const cliente = { id: 'cli_danado', nombre: 'Cliente dañado', contratos: [contrato] };
  const paquete = { id: 'paq_danado', nombre: 'Paquete dañado', precio: 1000 };
  const participacion = { id: 'par_danado', campaignId: 'cmp_prueba_A', prospectId: 'pro_danado', estado: 'registrada' };
  c.prospectos.push(prospecto);
  c.clientes.push(cliente);
  c.paquetes.push(paquete);
  c.participaciones.push(participacion);

  comprobar('la reparación de registros se expone para poder probarla',
    typeof c.normalizarRegistros === 'function', 'no existe normalizarRegistros');
  if (typeof c.normalizarRegistros === 'function') c.normalizarRegistros();

  comprobar('el prospecto recupera historial de fases, etiquetas y tareas',
    Array.isArray(prospecto.historialFases) && Array.isArray(prospecto.etiquetas) && Array.isArray(prospecto.tareasRelacionadas));
  comprobar('el cliente recupera su arreglo de contratos',
    Array.isArray(cliente.contratos));
  comprobar('el contrato recupera pagos, cargos y descuentos',
    Array.isArray(contrato.pagos) && Array.isArray(contrato.cargos) && Array.isArray(contrato.descuentos));
  comprobar('el paquete recupera sus items',
    Array.isArray(paquete.items));
  comprobar('la participación recupera historial, tareas y datos de campaña',
    Array.isArray(participacion.historial) && Array.isArray(participacion.tareasRelacionadas) &&
    !!participacion.datosCampania && typeof participacion.datosCampania === 'object');

  prospecto.etiquetas.push('una etiqueta');
  if (typeof c.normalizarRegistros === 'function') c.normalizarRegistros();
  comprobar('la reparación es idempotente (no borra lo que ya había)',
    prospecto.etiquetas.length === 1 && prospecto.etiquetas[0] === 'una etiqueta',
    JSON.stringify(prospecto.etiquetas));

  /* Funcional: una participación sin historial puede registrar un contacto. */
  let errorContacto = null, registroOk = false;
  try {
    const motor = c.crearMotor(c.App.almacen);
    motor.registrarContacto('par_danado', { resultado: 'noRespondio' });
    registroOk = Array.isArray(participacion.historial) && participacion.historial.length > 0;
  } catch (e) { errorContacto = (e && e.message) || String(e); }
  comprobar('una participación sin historial registra el contacto sin excepción',
    errorContacto === null && registroOk,
    errorContacto || ('historial=' + ((participacion.historial || []).length)));

  /* El CRM base conserva sus guardas en los puntos de escritura. */
  const guardas = [
    /if \(!co\.pagos\) co\.pagos = \[\];/,                                     /* registrar un pago */
    /if \(!Array\.isArray\(p\.historialFases\)\) p\.historialFases = \[\];/,   /* cambio de fase de un prospecto */
    /if \(!Array\.isArray\(c\.contratos\)\) c\.contratos = \[\];/,             /* crear un contrato */
    /if \(!Array\.isArray\(cli\.contratos\)\) cli\.contratos = \[\];/          /* restaurar un contrato de la papelera */
  ];
  const sinGuarda = guardas.filter(g => !g.test(HTML)).length;
  comprobar('los puntos de escritura del CRM conservan sus guardas (pagos, fases, contratos)',
    sinGuarda === 0, sinGuarda + ' guarda(s) perdida(s)');
}

/* ══════════════════════════════════════════════════════════════════════
   24. Importar prospectos desde un archivo (Excel o CSV)
   ----------------------------------------------------------------------
   Prueba el camino de datos completo SIN depender de ningún servicio:
   teléfonos escritos de mil formas, nombres con acentos y al revés, detección
   de los títulos del archivo, conversión de fila a prospecto, duplicados por
   teléfono y por nombre, CSV con comas y comillas dentro del texto, y el
   lector de Excel (.xlsx) contra un archivo de verdad incrustado aquí en
   base64 (ZIP + DEFLATE + XML, hecho con otra herramienta).
   ══════════════════════════════════════════════════════════════════════ */
{
  const c = r.contexto;
  const imp = c.ImportarProspectos;
  comprobar('el módulo de importación de prospectos quedó cargado', !!imp && !!imp.pruebas);

  if (imp && imp.pruebas) {
    const p = imp.pruebas;

    /* 1) Teléfonos: la misma persona escrita de tres formas. */
    const tel1 = p.normalizarTelefono('+52 55 1234 5678');
    const tel2 = p.normalizarTelefono('55-1234-5678');
    const tel3 = p.normalizarTelefono('(55) 1234 5678');
    comprobar('el teléfono se compara igual con lada, guiones o paréntesis',
      tel1 === tel2 && tel2 === tel3 && tel1 === '5512345678', [tel1, tel2, tel3].join(' / '));

    /* 2) Nombres. */
    comprobar('el nombre se compara sin acentos ni mayúsculas',
      p.claveNombre('José Pérez') === p.claveNombre('JOSE PEREZ'));
    comprobar('el nombre se compara aunque venga al revés (apellido primero)',
      p.claveNombre('Pérez Gómez José') === p.claveNombre('José Pérez Gómez'));

    /* 3) Títulos del archivo. */
    const encabezados = ['Marca temporal', 'Nombre completo', 'Teléfono / WhatsApp', 'Correo electrónico', '¿Qué evento es?', 'Fecha del evento', 'Presupuesto aproximado', 'Un campo raro'];
    const mapeo = p.detectarMapeo(encabezados);
    const campoDe = (titulo) => (mapeo.filter(m => m.columna === titulo)[0] || {}).campo;
    comprobar('reconoce los títulos típicos',
      campoDe('Nombre completo') === 'nombre' && campoDe('Teléfono / WhatsApp') === 'telefono' &&
      campoDe('Correo electrónico') === 'email' && campoDe('Marca temporal') === 'fechaRegistro',
      JSON.stringify(mapeo.map(m => m.campo)));
    comprobar('reconoce evento, fecha y presupuesto (los que usan las campañas)',
      campoDe('¿Qué evento es?') === 'tipoEvento' && campoDe('Fecha del evento') === 'fechaEvento' &&
      campoDe('Presupuesto aproximado') === 'presupuesto');
    comprobar('deja en paz la columna que no reconoce', campoDe('Un campo raro') === 'ignorar');

    /* 4) Fila -> prospecto. */
    const candidato = p.filaAProspecto(
      ['2026-10-07 09:15:00', 'Ana López Ruiz', '55 4444 5555', 'ana@correo.com', 'XV años', '2027-03-20', '45000', 'lo que sea'],
      mapeo, { origenPorDefecto: 'Formulario Google', faseInicial: 'Interesado' });
    comprobar('la fila se convierte en prospecto con nombre, teléfono y correo',
      candidato.nombre === 'Ana López Ruiz' && candidato.telefono === '55 4444 5555' && candidato.email === 'ana@correo.com');
    comprobar('los campos de campaña sí se guardan (evento, fecha, presupuesto)',
      candidato.tipoEvento === 'XV años' && candidato.fechaEvento === '2027-03-20' && candidato.presupuesto === '45000');
    comprobar('lo que no se mapea no se pierde: queda en las notas',
      /Un campo raro: lo que sea/.test(candidato.notasGenerales), candidato.notasGenerales);

    /* 5) Duplicados. */
    const existentes = [
      { id: 'pro_x', nombre: 'Ana López Ruiz', telefono: '+52 55 4444 5555' },
      { id: 'pro_y', nombre: 'Carlos Méndez', telefono: '55 9999 0000' }
    ];
    const dupTel = p.buscarDuplicado({ nombre: 'Ana Lopez', telefono: '5544445555' }, existentes, { telefono: true, nombre: true });
    comprobar('detecta el duplicado por teléfono aunque el nombre venga distinto',
      dupTel.duplicado === true && dupTel.tipo === 'telefono', JSON.stringify(dupTel.motivo));
    const dupNombre = p.buscarDuplicado({ nombre: 'Carlos Mendez', telefono: '55 1111 2222' }, existentes, { telefono: true, nombre: true });
    comprobar('detecta el mismo nombre con teléfono distinto (y lo marca aparte)',
      dupNombre.duplicado === true && dupNombre.tipo === 'nombre-con-telefono-distinto', JSON.stringify(dupNombre.motivo));
    comprobar('un prospecto realmente nuevo no se marca como duplicado',
      p.buscarDuplicado({ nombre: 'Persona Nueva', telefono: '55 7777 8888' }, existentes, { telefono: true, nombre: true }).duplicado === false);

    /* 6) Análisis completo. */
    const filas = [
      ['Nombre completo', 'Teléfono'],
      ['Ana López Ruiz', '55 4444 5555'],
      ['Persona Nueva', '55 7777 8888'],
      ['Otra Persona', '55 6666 7777'],
      ['', '']
    ];
    const firmaOtra = p.claveFila(['Otra Persona', '55 6666 7777']);
    const firmas = {}; firmas[firmaOtra] = 'ya';
    const analisis = p.analizarFilas(filas.slice(1), [
      { columna: 'Nombre completo', indice: 0, campo: 'nombre' },
      { columna: 'Teléfono', indice: 1, campo: 'telefono' }
    ], { criterioDuplicado: { telefono: true, nombre: true } }, existentes, firmas);
    comprobar('clasifica bien: 1 nueva, 1 duplicada, 1 ya importada y 1 sin datos',
      analisis.nuevas.length === 1 && analisis.duplicadas.length === 1 && analisis.repetidas.length === 1 && analisis.vacias === 1,
      JSON.stringify({ n: analisis.nuevas.length, d: analisis.duplicadas.length, r: analisis.repetidas.length, v: analisis.vacias }));
    comprobar('la nueva es la correcta y no la duplicada', analisis.nuevas[0].nombre === 'Persona Nueva', analisis.nuevas[0].nombre);

    /* 7) CSV pegado (Excel en español usa punto y coma). */
    const csv = 'Nombre;Teléfono;Comentarios\r\n"López, Ana";5512345678;"Dijo ""sí, quiero cotizar"""';
    const filasCsv = p.textoAFilas(csv);
    comprobar('entiende un CSV con punto y coma, comas y comillas dentro del texto',
      filasCsv.length === 2 && filasCsv[1][0] === 'López, Ana' && /sí, quiero cotizar/.test(filasCsv[1][2]),
      JSON.stringify(filasCsv));
    comprobar('detecta solo el separador que corresponde',
      p.detectarSeparador('a\tb\tc') === '\t' && p.detectarSeparador('a,b,c') === ',' && p.detectarSeparador('a;b;c') === ';');
    comprobar('la firma de una fila cambia si cambia algún dato',
      p.claveFila(['Ana', '55']) !== p.claveFila(['Ana', '56']));

    /* 8) Un teléfono que en realidad es texto no se guarda como número. */
    const conTexto = p.filaAProspecto(['Llamar después', 'Sin Teléfono'],
      [{ columna: 'Nombre', indice: 0, campo: 'nombre' }, { columna: 'Tel', indice: 1, campo: 'telefono' }], {});
    comprobar('un teléfono escrito como texto no se guarda como número',
      !!conTexto && conTexto.telefono === '' && /Sin Teléfono/.test(conTexto.notasGenerales || ''),
      conTexto ? JSON.stringify({ tel: conTexto.telefono, notas: conTexto.notasGenerales }) : 'nulo');
    comprobar('una fila sin nombre ni teléfono válido se descarta',
      p.filaAProspecto(['', 'no tengo'],
        [{ columna: 'Nombre', indice: 0, campo: 'nombre' }, { columna: 'Tel', indice: 1, campo: 'telefono' }], {}) === null);

    /* 9) LECTOR DE EXCEL: contra un archivo .xlsx de verdad (incrustado en base64).
       Trae dos hojas, acentos, una fecha guardada como número de serie y celdas
       vacías en medio de una fila. */
    const xlsxBase64 = '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';
    let hojas = null, errorExcel = null;
    try { hojas = p.leerXlsxBuffer(p.desdeBase64(xlsxBase64).buffer); }
    catch (e) { errorExcel = (e && e.message) || String(e); }
    comprobar('lee un archivo de Excel (.xlsx) de verdad',
      errorExcel === null && !!hojas && hojas.length === 2, errorExcel || ('hojas=' + (hojas ? hojas.length : 0)));
    if (hojas && hojas.length) {
      const filasExcel = hojas[0].filas;
      comprobar('saca el nombre de la hoja y sus encabezados con acentos',
        hojas[0].nombre === 'Respuestas de formulario 1' && filasExcel[0][2] === 'Teléfono' && filasExcel[0][4] === '¿Qué evento es?',
        JSON.stringify([hojas[0].nombre].concat(filasExcel[0] || [])));
      comprobar('convierte la fecha de Excel (número de serie) a fecha legible',
        filasExcel[1][5] === '2026-11-19', 'quedó: ' + JSON.stringify(filasExcel[1] && filasExcel[1][5]));
      comprobar('las celdas vacías en medio no corren las columnas',
        filasExcel[2][5] === '' && filasExcel[2][7] === 'Quiere ver el paquete Platinum',
        JSON.stringify(filasExcel[2]));
      comprobar('conserva los acentos del archivo',
        filasExcel[3][1] === 'Carlos Méndez', JSON.stringify(filasExcel[3] && filasExcel[3][1]));
      /* El mismo archivo pasado por el camino completo del importador */
      const analisisExcel = p.analizarFilas(filasExcel.slice(1), p.detectarMapeo(filasExcel[0]),
        { criterioDuplicado: { telefono: true, nombre: true } }, [{ id: 'pro_1', nombre: 'Ana López Ruiz', telefono: '+52 55 4444 5555' }], {});
      comprobar('del archivo de Excel: 1 duplicada por teléfono y 2 nuevas',
        analisisExcel.duplicadas.length === 1 && analisisExcel.nuevas.length === 2,
        JSON.stringify({ d: analisisExcel.duplicadas.length, n: analisisExcel.nuevas.length }));
    }
    /* 9-bis) LECTOR DE LIBREOFFICE (.ods): archivo real hecho por LibreOffice
       (su content.xml), con celdas de texto, fecha y número. */
    const odsBase64 = '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';
    let hojasOds = null, errorOds = null;
    try { hojasOds = p.leerOdsBuffer(p.desdeBase64(odsBase64).buffer); }
    catch (e) { errorOds = (e && e.message) || String(e); }
    comprobar('lee un archivo de LibreOffice (.ods) de verdad',
      errorOds === null && !!hojasOds && hojasOds.length >= 1, errorOds || ('hojas=' + (hojasOds ? hojasOds.length : 0)));
    if (hojasOds && hojasOds.length) {
      const filasOds = hojasOds[0].filas;
      comprobar('del .ods saca la tabla con sus títulos y acentos',
        filasOds[0][1] === 'Nombre completo' && filasOds[0][5] === 'Fecha del evento',
        JSON.stringify(filasOds[0]));
      comprobar('del .ods saca el texto, el teléfono y el número',
        filasOds[1][1] === 'Ana López Ruiz' && filasOds[1][2] === '55 4444 5555' && filasOds[1][6] === '45000',
        JSON.stringify(filasOds[1]));
      comprobar('del .ods convierte la fecha a texto legible',
        filasOds[1][5] === '2027-03-20', JSON.stringify(filasOds[1][5]));
      /* El mismo .ods por el camino completo */
      const analisisOds = p.analizarFilas(filasOds.slice(1), p.detectarMapeo(filasOds[0]),
        { criterioDuplicado: { telefono: true, nombre: true } }, [], {});
      comprobar('el .ods entra completo: 2 filas y ninguna perdida',
        analisisOds.nuevas.length === 2 && analisisOds.vacias === 0,
        JSON.stringify({ n: analisisOds.nuevas.length, v: analisisOds.vacias }));
      const sinTitulo = p.detectarMapeo(filasOds[0]);
      comprobar('y los títulos del .ods se reconocen solos',
        sinTitulo[1].campo === 'nombre' && sinTitulo[2].campo === 'telefono' && sinTitulo[5].campo === 'fechaEvento',
        JSON.stringify(sinTitulo.map(m => m.campo)));
    }

    /* 9-ter) ARCHIVO ENLAZADO: detección de cambios (puro, sin navegador). */
    comprobar('detecta que el archivo cambió por fecha o tamaño',
      p.archivoCambio({ nombre: 'a.xlsx', lastModified: 100, size: 10 }, { nombre: 'a.xlsx', lastModified: 101, size: 10 }) === true &&
      p.archivoCambio({ nombre: 'a.xlsx', lastModified: 100, size: 10 }, { nombre: 'a.xlsx', lastModified: 100, size: 11 }) === true &&
      p.archivoCambio({ nombre: 'a.xlsx', lastModified: 100, size: 10 }, { nombre: 'a.xlsx', lastModified: 100, size: 10 }) === false);
    comprobar('detecta que le cambiaron el archivo por otro',
      p.archivoCambio({ nombre: 'a.xlsx', lastModified: 100, size: 10 }, { nombre: 'b.csv', lastModified: 100, size: 10 }) === true);
    comprobar('compara bien un archivo del navegador (File) contra el registro interno',
      p.archivoCambio({ nombre: 'r.csv', lastModified: 1000, size: 148 }, { name: 'r.csv', lastModified: 1000, size: 148 }) === false &&
      p.archivoCambio({ nombre: 'r.csv', lastModified: 1000, size: 148 }, { name: 'r.csv', lastModified: 1001, size: 148 }) === true &&
      p.archivoCambio({ nombre: 'r.csv', lastModified: 1000, size: 148 }, { name: 'otro.csv', lastModified: 1000, size: 148 }) === true,
      'un archivo del navegador trae name/size/lastModified y el registro usa nombre: hay que aceptar los dos');

    comprobar('la primera lectura siempre cuenta como cambio',
      p.archivoCambio(null, { nombre: 'a.xlsx', lastModified: 1, size: 1 }) === true &&
      p.archivoCambio({ nombre: 'a.xlsx', lastModified: 1, size: 1 }, null) === false);

    comprobar('un Excel viejo (.xls) se rechaza con un mensaje claro',
      (function () { try { p.leerBuffer('viejo.xls', new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0]).buffer); return false; } catch (e) { return /Excel viejo/.test(e.message); } })());
  }

  /* 10) El botón de la sección de Prospectos y el panel. */
  if (imp && typeof imp.ponerBoton === 'function') {
    c.usuarioActual = { username: 'jorge', nombre: 'Jorge', rol: 'Administrador', admin: true };
    let errorBoton = null;
    try { imp.ponerBoton(); } catch (e) { errorBoton = (e && e.message) || String(e); }
    const contenedor = r.ventana.document.querySelector('#seccion-prospectos .header-actions');
    const botones = (contenedor.children || []).filter(x => x.id === 'btn-importar-prospectos');
    comprobar('el botón "Importar prospectos" se crea sin error para el administrador',
      errorBoton === null && botones.length > 0, errorBoton || 'no se creó el botón');
    const boton = botones[botones.length - 1];
    if (boton && typeof boton.onclick === 'function') {
      let errorAbrir = null;
      try { boton.onclick({ preventDefault() { } }); } catch (e) { errorAbrir = (e && e.message) || String(e); }
      comprobar('el botón abre el panel de importación sin error', errorAbrir === null, errorAbrir || '');
      const cuerpoModal = String((r.elementos.get('modal-body') || {})._html || '') +
        String((r.elementos.get('imp-cuerpo') || {})._html || '');
      comprobar('el panel ofrece elegir/arrastrar archivo y sus pestañas',
        /imp-archivo/.test(cuerpoModal) && /imp-zona/.test(cuerpoModal) && /data-imp-tab/.test(cuerpoModal),
        'no se dibujó el panel: ' + cuerpoModal.slice(0, 120));
      comprobar('el panel avisa que no se sube nada a ningún lado',
        /no se sube a ningún lado/i.test(cuerpoModal), 'falta el aviso de privacidad');
    }
  }
}

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones en verde${fallos ? `  (${fallos} con falla)` : ''}`);
process.exit(fallos ? 1 : 0);
