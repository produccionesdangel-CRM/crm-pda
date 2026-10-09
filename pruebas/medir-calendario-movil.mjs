/*
 * medir-calendario-movil.mjs — la rejilla del calendario y el encabezado del teléfono
 * ---------------------------------------------------------------------------
 * Qué mide, en Chrome sin ventana con pantalla y tacto de teléfono (390 x 844):
 *   1. La rejilla del calendario: que las 7 columnas midan lo mismo, que quepan en
 *      la pantalla (sin scroll horizontal) y que no se deformen por el texto.
 *   2. El encabezado de CADA sección: que el título no quede debajo del botón de
 *      menú (FAB), que no sobre espacio vacío arriba y que los botones no sean enormes.
 *   3. La vista del día: al tocar un día con tareas/eventos debe abrir la LISTA de
 *      ese día con las opciones de crear tarea o contrato; un día vacío se abre
 *      vacío, con las mismas opciones.
 * Lo mismo se revisa en la PC (1280 px), donde no debe haber regresión.
 *
 * Cómo se corre:  node pruebas\medir-calendario-movil.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.resolve(AQUI, '..', 'index.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9334);

const SECCIONES = ['informes', 'panel', 'prospectos', 'campanias', 'clientes', 'contratos', 'paquetes', 'servicios', 'calendario', 'configuracion'];

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

/* Capturas de pantalla (opcional: `node pruebas\medir-calendario-movil.mjs --capturas`).
   Sirven para revisar la estética a ojo, que es justo lo que ningún número mide. */
const CAPTURAS = process.argv.includes('--capturas');
async function captura(cdp, nombre) {
  if (!CAPTURAS) return;
  const r = await cdp.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const carpeta = path.join(AQUI, 'capturas');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, nombre + '.png'), Buffer.from(r.data, 'base64'));
  console.log('   (captura: pruebas\\capturas\\' + nombre + '.png)');
}

/* Entra al CRM sin Google (el acceso no se prueba aquí) y siembra un día con datos. */
async function entrarConDatos(cdp) {
  return await evaluar(cdp, `(function () {
    try {
      usuarioActual = { nombre: 'Prueba', rol: 'Administrador', admin: true, email: 'prueba@local' };
      var hoy = new Date();
      var f = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
      clientes.length = 0; tareas.length = 0;
      clientes.push({ id: 'cli-cal', nombre: 'Cliente del calendario', telefono: '5551234567', estado: 'Activo', fechaRegistro: f,
        contratos: [{ id: 'con-cal', fechaEvento: f, festejado: 'Festejada de prueba', clienteNombre: 'Cliente del calendario', tipo: 'paquete', total: 1000, pagos: [], cargos: [] }] });
      tareas.push({ id: 'tar-cal', tipo: 'Llamada', descripcion: 'Confirmar la fecha', fecha: f, completada: false, clienteId: 'cli-cal', creadaPor: 'Prueba' });
      window.__hoyCal = f;
      iniciarAplicacion();
      App.seleccionarSeccion('calendario');
      return 'ok';
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`);
}

/* Rejilla del calendario. */
async function medirRejilla(cdp) {
  await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('calendario'); } catch (e) {} return 1; })()`);
  await dormir(250);
  const m = await evaluar(cdp, `(function () {
    var cont = document.querySelector('#seccion-calendario .calendario-container');
    var grid = document.getElementById('calendario-grid');
    var celdas = [].slice.call(grid.querySelectorAll('.dia'));
    var nombres = [].slice.call(grid.querySelectorAll('.dia-nombre'));
    var anchos = celdas.map(function (c) { return Math.round(c.getBoundingClientRect().width * 10) / 10; });
    var min = Math.min.apply(null, anchos), max = Math.max.apply(null, anchos);
    var rGrid = grid.getBoundingClientRect(), rCont = cont.getBoundingClientRect();
    return {
      contW: Math.round(rCont.width), gridW: Math.round(rGrid.width),
      desborde: Math.max(Math.round(grid.scrollWidth - grid.clientWidth), Math.round(cont.scrollWidth - cont.clientWidth)),
      celdas: celdas.length,
      visibles: nombres.filter(function (n) { var r = n.getBoundingClientRect(); return r.width > 0 && r.right <= rCont.right + 1 && r.left >= rCont.left - 1; }).length,
      anchoMin: min, anchoMax: max, uniforme: (max - min) <= 1
    };
  })()`);
  console.log('   rejilla: contenedor ' + m.contW + 'px · rejilla ' + m.gridW + 'px · desborde ' + m.desborde + 'px · ' +
    m.celdas + ' celdas · columnas visibles ' + m.visibles + '/7 · ancho ' + m.anchoMin + '–' + m.anchoMax + 'px ' + (m.uniforme ? '(uniformes)' : '(DISTINTAS)'));
  return m;
}

/* Encabezado de cada sección: carril del FAB, espacio de arriba y tamaño de los botones. */
async function medirEncabezados(cdp, anchoVentana) {
  const filas = [];
  for (const seccion of SECCIONES) {
    await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('${seccion}'); } catch (e) {} return 1; })()`);
    await dormir(120);
    const m = await evaluar(cdp, `(function () {
      var sec = document.getElementById('seccion-${seccion}');
      var h1 = sec.querySelector('.seccion-header h1');
      var fab = document.getElementById('btn-mobile-menu');
      var rFab = (fab && getComputedStyle(fab).display !== 'none') ? fab.getBoundingClientRect() : null;
      var rH1 = h1 ? h1.getBoundingClientRect() : null;
      var botones = [].slice.call(sec.querySelectorAll('.seccion-header button, .seccion-header .btn-primario, .seccion-header .btn-secundario, .seccion-header .btn-verde, .seccion-header .btn-azul'))
        .filter(function (b) { return b.getBoundingClientRect().width > 0; });
      var anchos = botones.map(function (b) { return Math.round(b.getBoundingClientRect().width); });
      return {
        h1Top: rH1 ? Math.round(rH1.top) : null,
        h1Left: rH1 ? Math.round(rH1.left) : null,
        fabRight: rFab ? Math.round(rFab.right) : null,
        fabBottom: rFab ? Math.round(rFab.bottom) : null,
        nBotones: botones.length, maxBoton: anchos.length ? Math.max.apply(null, anchos) : 0,
        solapa: (rFab && rH1) ? !(rH1.left >= rFab.right || rH1.top >= rFab.bottom || rH1.bottom <= rFab.top) : false,
        botonesSolapan: (rFab && botones.length) ? botones.some(function (b) { var r = b.getBoundingClientRect(); return !(r.left >= rFab.right || r.top >= rFab.bottom || r.bottom <= rFab.top); }) : false
      };
    })()`);
    filas.push(Object.assign({ seccion }, m));
  }
  return filas;
}

async function probarDia(cdp) {
  const abrirDia = async (selector) => await evaluar(cdp, `(function () {
    var celda = document.querySelector(${JSON.stringify(selector)});
    if (!celda) return { falta: true };
    celda.click();
    var modal = document.getElementById('modal');
    var cuerpo = document.getElementById('modal-body');
    var abierto = !!(modal && modal.classList.contains('active'));
    var texto = abierto ? cuerpo.textContent.replace(/\\s+/g, ' ').trim() : '';
    var r = { falta: false, abierto: abierto,
      titulo: (document.getElementById('modal-titulo') || {}).textContent || '',
      texto: texto, items: abierto ? cuerpo.querySelectorAll('.dia-item').length : 0,
      btnTarea: !!(abierto && document.getElementById('btn-crear-tarea-dia')),
      btnContrato: !!(abierto && document.getElementById('btn-crear-contrato-dia')) };
    return r;
  })()`);

  const conDatos = await abrirDia('.dia[data-fecha="' + (await evaluar(cdp, 'window.__hoyCal')) + '"]');
  await evaluar(cdp, 'cerrarModal(); 1');
  const vacioSel = await evaluar(cdp, `(function () {
    var celdas = [].slice.call(document.querySelectorAll('#calendario-grid .dia[data-fecha]'));
    for (var i = 0; i < celdas.length; i++) if (!celdas[i].querySelector('.evento')) return '.dia[data-fecha="' + celdas[i].getAttribute('data-fecha') + '"]';
    return null;
  })()`);
  const vacio = vacioSel ? await abrirDia(vacioSel) : { falta: true };
  await evaluar(cdp, 'cerrarModal(); 1');

  /* Tocar una etiqueta de evento debe abrir SU ficha, no la lista del día. */
  const chipDe = async (clase) => await evaluar(cdp, `(function () {
    var el = document.querySelector('#calendario-grid .dia .${clase}');
    if (!el) return { falta: true };
    el.click();
    var modal = document.getElementById('modal');
    var activo = !!(modal && modal.classList.contains('active'));
    var titulo = (document.getElementById('modal-titulo') || {}).textContent || '';
    var esListaDia = /^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/.test(titulo);
    var r = { falta: false, titulo: titulo, abiertoTarea: activo && /tarea/i.test(titulo) && !!document.getElementById('tarea-descripcion'),
      abiertoAlgo: activo || !!document.querySelector('.panel-lateral.visible, #panel-lateral.visible'), esListaDia: esListaDia };
    return r;
  })()`);
  const chipTarea = await chipDe('evento-tarea');
  await evaluar(cdp, 'cerrarModal(); 1');
  const chipContrato = await chipDe('evento-contrato');
  await evaluar(cdp, 'cerrarModal(); 1');
  return { conDatos, vacio, chipTarea, chipContrato };
}

async function main() {
  const chrome = spawn(buscarChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-medir-ui'), 'about:blank'
  ], { stdio: 'ignore' });

  const URL = 'file:///' + PAGINA.replace(/\\/g, '/');
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable');
    console.log('Archivo: ' + PAGINA + '\n');

    // ── TELÉFONO ──
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4000);
    const entrada = await entrarConDatos(cdp);
    await dormir(400);
    console.log('── TELÉFONO 390x844');
    revisar(entrada === 'ok', 'la app entró y dibujó el calendario (' + entrada + ')');
    const g = await medirRejilla(cdp);
    await captura(cdp, 'calendario-movil');
    revisar(g.desborde <= 1, 'la rejilla no se desborda (nada de scroll horizontal)');
    revisar(g.uniforme, 'las 7 columnas miden lo mismo (' + g.anchoMin + '–' + g.anchoMax + 'px)');
    revisar(g.visibles === 7, 'se ven las 7 columnas completas (' + g.visibles + '/7)');
    await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('prospectos'); } catch (e) {} return 1; })()`);
    await dormir(250);
    await captura(cdp, 'encabezado-movil-prospectos');
    await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('informes'); } catch (e) {} return 1; })()`);
    await dormir(250);
    await captura(cdp, 'encabezado-movil-informes');
    await evaluar(cdp, `(function(){ try { App.seleccionarSeccion('calendario'); } catch (e) {} return 1; })()`);
    await dormir(250);

    const enc = await medirEncabezados(cdp, 390);
    console.log('   encabezados (título arriba/izquierda · botones · choques con el FAB):');
    for (const f of enc) {
      console.log('     ' + (f.seccion + '             ').slice(0, 14) + 'y=' + f.h1Top + ' x=' + f.h1Left +
        ' · ' + f.nBotones + ' botón(es), el mayor ' + f.maxBoton + 'px' + (f.solapa ? ' · TÍTULO DEBAJO DEL FAB' : '') + (f.botonesSolapan ? ' · BOTÓN DEBAJO DEL FAB' : ''));
      revisar(!f.solapa, '[' + f.seccion + '] el título no queda debajo del botón de menú');
      revisar(!f.botonesSolapan, '[' + f.seccion + '] ningún botón queda debajo del botón de menú');
      revisar(f.h1Top !== null && f.h1Top <= 24, '[' + f.seccion + '] el título arranca arriba (y=' + f.h1Top + ')');
      revisar(f.maxBoton <= Math.round(390 * 0.62), '[' + f.seccion + '] los botones no ocupan todo el ancho (mayor ' + f.maxBoton + 'px)');
    }

    console.log('   vista del día:');
    const d = await probarDia(cdp);
    await evaluar(cdp, `(function(){ document.querySelector('.dia[data-fecha="' + window.__hoyCal + '"]').click(); return 1; })()`);
    await dormir(300);
    await captura(cdp, 'dia-con-datos-movil');
    await evaluar(cdp, 'cerrarModal(); 1');
    console.log('     · día con datos → "' + d.conDatos.titulo + '" · ' + d.conDatos.items + ' elemento(s) · botones ' + d.conDatos.btnTarea + '/' + d.conDatos.btnContrato);
    console.log('       ' + (d.conDatos.texto || '').slice(0, 140));
    revisar(d.conDatos.abierto, 'el día con datos abre su vista');
    revisar(d.conDatos.items >= 2, 'lista los elementos del día (evento + tarea)');
    revisar(/Festejada de prueba/.test(d.conDatos.texto), 'aparece el evento del día');
    revisar(/Confirmar la fecha/.test(d.conDatos.texto), 'aparece la tarea con su descripción');
    revisar(d.conDatos.btnTarea && d.conDatos.btnContrato, 'mantiene crear tarea y crear contrato');
    console.log('     · día vacío → "' + d.vacio.titulo + '" · ' + d.vacio.items + ' elemento(s)');
    console.log('       ' + (d.vacio.texto || '').slice(0, 140));
    revisar(d.vacio.abierto, 'el día vacío también abre su vista');
    revisar(d.vacio.items === 0, 'el día vacío se abre vacío');
    revisar(/sin (tareas|nada)/i.test(d.vacio.texto), 'el día vacío lo dice con un mensaje claro');
    revisar(d.vacio.btnTarea && d.vacio.btnContrato, 'el día vacío ofrece crear tarea y crear contrato');
    revisar(d.chipTarea.falta || (d.chipTarea.abiertoTarea && !d.chipTarea.esListaDia),
      'tocar la etiqueta de una TAREA abre esa tarea ("' + d.chipTarea.titulo + '") y no la lista del día');
    revisar(d.chipContrato.falta || !d.chipContrato.esListaDia,
      'tocar la etiqueta de un EVENTO abre el evento ("' + d.chipContrato.titulo + '") y no la lista del día');

    // ── PC ──
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4000);
    await entrarConDatos(cdp);
    await dormir(400);
    console.log('── PC 1280x900');
    const gp = await medirRejilla(cdp);
    revisar(gp.desborde <= 1, 'en la PC tampoco se desborda');
    revisar(gp.uniforme && gp.visibles === 7, 'en la PC las 7 columnas siguen uniformes y completas (' + gp.anchoMin + '–' + gp.anchoMax + 'px)');
    const dp = await probarDia(cdp);
    revisar(dp.conDatos.abierto && dp.conDatos.items >= 2, 'en la PC el día también abre su lista');
    revisar(dp.vacio.abierto && dp.vacio.items === 0, 'en la PC el día vacío se abre vacío');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 6).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
