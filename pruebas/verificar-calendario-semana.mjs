/*
 * verificar-calendario-semana.mjs — la vista semanal conserva el alto del mes (13/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge: "en la vista semanal del calendario se mantenga la medida en alto del calendario pero
 * ahora solo mostrando los días… el espacio que muestras las tareas dentro de la tarjeta del día
 * está del mismo tamaño que cuando estaban el resto de los días del mes; quiero que los días se
 * vean más largos para mostrar una lista de tareas más extensa… que el tamaño que ocupa el
 * calendario completo se mantenga igual incluso cuando cambias a la vista semanal".
 *
 * Comprueba en PC y en móvil:
 *   1. El alto TOTAL del calendario es el mismo en la vista de mes y en la de semana.
 *   2. La casilla de un día en la semana es mucho más alta que en el mes (se estira).
 *   3. En esa casilla se ven MÁS tareas que en el mes (el tope de etiquetas crece solo).
 *   4. Los botones Mes/Semana cambian de vista y el mes sigue funcionando igual.
 *   5. En móvil no hay desbordamiento horizontal (lo vigila también medir-calendario-movil).
 *
 * Cómo se corre:  node pruebas\verificar-calendario-semana.mjs
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
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9375);
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
const PREPARAR = `(function () {
  usuarioActual = { nombre: 'Jorge', rol: 'Administrador', admin: true, email: 'p@local' };
  ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
  paquetes = []; serviciosAdicionales = []; historial = []; papelera = [];
  prospectos = [{ id: 'pro-1', nombre: 'Alissa Mota', telefono: '8781234567', email: 'a@x.com', faseActual: 'Interesado',
    historialFases: [], etiquetas: [], tareasRelacionadas: [], notasGenerales: '' }];
  campanias = []; participaciones = [];
  /* Un día con MUCHAS tareas (ocho) para ver cuántas caben en cada vista. */
  tareas = [];
  var hoy = new Date();
  var iso = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var dia = iso(hoy);
  for (var i = 1; i <= 8; i++) {
    tareas.push({ id: 'tar-' + i, tipo: 'Llamada', descripcion: 'Tarea numero ' + i + ' del dia', fecha: dia, hora: '1' + i + ':00',
      completada: i === 8, todoElDia: false, fechaCreacion: dia, clienteId: null });
  }
  /* Una tarea de campaña (con prospecto) y un contrato, para ver la información detallada. */
  clientes = [{ id: 'cli-1', nombre: 'Luz Ashen', telefono: '8781112233', email: 'l@x.com', estado: 'Activo', fechaRegistro: dia,
    contratos: [{ id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Luz Ashen', festejado: 'XV Años Luz', tipo: 'paquete',
      paqueteId: '', serviciosIds: [], precioBase: 8950, precioFinal: 8950, descuentoMonto: 0, cargos: [], pagos: [],
      estado: 'Pendiente', fechaEvento: dia, horaEvento: '17:00', fechaContrato: dia, notas: '' }] }];
  /* La tarea de campaña va PRIMERO: así entra siempre en el cupo de renglones visibles. */
  tareas.unshift({ id: 'tar-camp', tipo: 'Seguimiento', titulo: 'Llamar para agendar cita', fecha: dia, hora: '09:30',
    estado: 'pendiente', prospectoId: 'pro-1', campaniaId: 'camp-x', participacionId: 'part-x', creadaEn: dia });
  cambiarSeccion('calendario');
  mesActualCal = hoy.getMonth(); anoActualCal = hoy.getFullYear();
  return JSON.stringify({ dia: dia });
})()`;

const MEDIR = `(function (vista, ancho, alto) {
  var grid = document.getElementById('calendario-grid');
  vistaCalActual = vista;
  if (vista === 'semana') { inicioSemanaCal = inicioDeSemanaDe(obtenerFechaActual()); }
  renderizarCalendario();
  var celdas = document.querySelectorAll('.calendario-grid .dia:not(.otro-mes)');
  var primera = celdas[0];
  var altoCelda = primera ? Math.round(primera.getBoundingClientRect().height) : 0;
  /* Cuántas etiquetas de tarea se ven en la celda del día con 8 tareas. */
  var conTareas = null;
  for (var i = 0; i < celdas.length; i++) {
    var n = celdas[i].querySelectorAll('.evento').length;
    if (!conTareas || n > conTareas.querySelectorAll('.evento').length) conTareas = celdas[i];
  }
  var eventos = conTareas ? conTareas.querySelectorAll('.evento').length : 0;
  var mas = conTareas ? (conTareas.querySelector('.evento-mas') ? conTareas.querySelector('.evento-mas').textContent.trim() : '') : '';
  /* ¿Se ve la información detallada? (solo en la semana) */
  var ricos = conTareas ? conTareas.querySelectorAll('.evento-rico').length : 0;
  var textoCelda = conTareas ? conTareas.textContent.replace(/\\s+/g, ' ').trim() : '';
  var traeHora = /\\d{1,2}:\\d{2}/.test(textoCelda);
  var traeTipo = textoCelda.indexOf('Llamada') !== -1;
  var traeProspecto = textoCelda.indexOf('Alissa Mota') !== -1;
  var traeTituloCamp = textoCelda.indexOf('Llamar para agendar cita') !== -1;
  var traeContrato = textoCelda.indexOf('XV Años Luz') !== -1 && textoCelda.indexOf('Luz Ashen') !== -1;
  /* ¿Algún renglón se sale de la casilla de su día? (comparación con su propia celda) */
  var desborda = 0;
  if (conTareas) {
    var caja = conTareas.getBoundingClientRect();
    conTareas.querySelectorAll('.evento').forEach(function (ev) {
      var r2 = ev.getBoundingClientRect();
      if (r2.right > caja.right + 1 || r2.left < caja.left - 1) desborda++;
    });
  }
  /* Alto del calendario COMPLETO: de la primera celda de nombre a la última celda. */
  var nombres = document.querySelectorAll('.calendario-grid .dia-nombre');
  var primeraNombre = nombres[0];
  var ultima = celdas[celdas.length - 1];
  var altoTotal = 0;
  if (primeraNombre && ultima) {
    altoTotal = Math.round(ultima.getBoundingClientRect().bottom - primeraNombre.getBoundingClientRect().top);
  }
  return JSON.stringify({ vista: vista, altoGrid: Math.round(grid.getBoundingClientRect().height),
    altoTotal: altoTotal, celdas: celdas.length, altoCelda: altoCelda, eventos: eventos, mas: mas,
    ricos: ricos, traeHora: traeHora, traeTipo: traeTipo, traeProspecto: traeProspecto,
    traeTituloCamp: traeTituloCamp, traeContrato: traeContrato, desborda: desborda,
    ancho: ancho, alto: alto });
})`;

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
    '--disable-extensions', '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-calsem'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });

    for (const caso of [{ nombre: 'PC', ancho: 1500, alto: 950 }, { nombre: 'móvil', ancho: 390, alto: 844 }]) {
      await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: caso.ancho, height: caso.alto, deviceScaleFactor: 1, mobile: caso.nombre !== 'PC' });
      await cdp.enviar('Page.navigate', { url: 'http://127.0.0.1:' + puertoHttp + '/' + path.basename(PAGINA) + '?v=' + caso.nombre });
      await dormir(4200);
      console.log('\n=== ' + caso.nombre + ' (' + caso.ancho + 'x' + caso.alto + ') ===');
      await evaluar(cdp, PREPARAR);
      const mes = JSON.parse(await evaluar(cdp, MEDIR + "('mes', " + caso.ancho + ", " + caso.alto + ")"));
      const sem = JSON.parse(await evaluar(cdp, MEDIR + "('semana', " + caso.ancho + ", " + caso.alto + ")"));
      console.log('   mes:    alto total ' + mes.altoTotal + ' px · celdas ' + mes.celdas + ' · casilla ' + mes.altoCelda + ' px · etiquetas visibles ' + mes.eventos + ' ' + mes.mas);
      console.log('   semana: alto total ' + sem.altoTotal + ' px · celdas ' + sem.celdas + ' · casilla ' + sem.altoCelda + ' px · etiquetas visibles ' + sem.eventos + ' ' + sem.mas);
      revisar(sem.celdas === 7, 'la semana dibuja 7 días');
      revisar(Math.abs(sem.altoTotal - mes.altoTotal) <= 4, 'el calendario mide LO MISMO en las dos vistas (' + mes.altoTotal + ' px contra ' + sem.altoTotal + ' px)');
      revisar(sem.altoCelda >= mes.altoCelda * 3, 'la casilla del día en la semana es al menos 3 veces más alta (' + sem.altoCelda + ' px contra ' + mes.altoCelda + ' px)');
      revisar(sem.eventos > mes.eventos, 'se ven MÁS tareas en la semana (' + sem.eventos + ' contra ' + mes.eventos + ')');
      revisar(sem.eventos >= 6, 'con 8 tareas en el día, la semana muestra al menos 6 (' + sem.eventos + ')');
      /* @JS-SEMANA-DETALLADA: en la semana cada renglón muestra hora, título, tipo y a quién
         pertenece. En el mes la etiqueta sigue compacta (no hay espacio). */
      console.log('   detalle en la semana: hora ' + sem.traeHora + ' · tipo ' + sem.traeTipo + ' · prospecto ' + sem.traeProspecto +
        ' · título de campaña ' + sem.traeTituloCamp + ' · contrato ' + sem.traeContrato + ' · renglones ricos ' + sem.ricos + ' · desbordes ' + sem.desborda);
      revisar(sem.ricos >= 6, 'la semana dibuja los renglones detallados (' + sem.ricos + ')');
      revisar(sem.traeHora === true, 'la semana muestra la HORA de cada tarea');
      revisar(sem.traeTipo === true && sem.traeProspecto === true, 'y el TIPO junto con el nombre del prospecto');
      revisar(sem.traeTituloCamp === true, 'y el TÍTULO real de la tarea de campaña');
      revisar(sem.traeContrato === true, 'y el contrato con su festejado y su cliente');
      revisar(sem.desborda === 0, 'ningún renglón se sale de la casilla de su día');
      revisar(mes.ricos === 0, 'en el MES se conserva la etiqueta compacta de siempre (' + mes.ricos + ' renglones ricos)');

      /* Con MUCHAS tareas (20) la casilla no debe cortar un renglón a medias: se ve el "+N más". */
      const saturado = JSON.parse(await evaluar(cdp, `(function () {
        var hoy = new Date();
        var dia = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
        for (var i = 9; i <= 20; i++) {
          tareas.push({ id: 'tar-extra-' + i, tipo: 'Llamada', descripcion: 'Tarea extra ' + i + ' con un titulo largo para probar', fecha: dia,
            hora: '0' + (i % 10) + ':00', completada: false, todoElDA: false, fechaCreacion: dia, clienteId: null });
        }
        vistaCalActual = 'semana'; inicioSemanaCal = inicioDeSemanaDe(obtenerFechaActual());
        renderizarCalendario();
        var celda = null;
        document.querySelectorAll('.calendario-grid .dia-semana').forEach(function (c) {
          if (!celda || c.querySelectorAll('.evento').length > celda.querySelectorAll('.evento').length) celda = c;
        });
        var eventos = celda.querySelectorAll('.evento').length;
        var mas = celda.querySelector('.evento-mas');
        var desbordaV = celda.scrollHeight - celda.clientHeight;
        return JSON.stringify({ eventos: eventos, hayMas: !!mas, textoMas: mas ? mas.textContent.trim() : '',
          desbordaV: desbordaV, tope: topeEtiquetasSemanaCal });
      })()`));
      console.log('   con 21 movimientos en el día: se ven ' + saturado.eventos + ' renglones · cupo ' + saturado.tope +
        ' · "' + saturado.textoMas + '" · desborde vertical ' + saturado.desbordaV + ' px');
      revisar(saturado.hayMas === true, 'cuando no caben todas, avisa con el "+N más"');
      revisar(saturado.desbordaV <= 4, 'y ningún renglón queda cortado a medias (desborde ' + saturado.desbordaV + ' px)');

      /* El mes sigue funcionando igual después de volver de la semana. */
      const vuelta = JSON.parse(await evaluar(cdp, `(function () {
        vistaCalActual = 'semana'; renderizarCalendario();
        vistaCalActual = 'mes'; renderizarCalendario();
        var grid = document.getElementById('calendario-grid');
        var celdas = document.querySelectorAll('.calendario-grid .dia:not(.otro-mes)');
        var nombres = document.querySelectorAll('.calendario-grid .dia-nombre');
        var alto = (nombres[0] && celdas[celdas.length - 1])
          ? Math.round(celdas[celdas.length - 1].getBoundingClientRect().bottom - nombres[0].getBoundingClientRect().top) : 0;
        var desborde = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return JSON.stringify({ alto: alto, filas: celdas.length, altoGridPx: grid.style.height, filasPlantilla: grid.style.gridTemplateRows,
          desbordeH: desborde });
      })()`));
      revisar(vuelta.altoGridPx === '' && vuelta.filasPlantilla === '', 'al volver al mes se quita la medida de la semana (el mes queda como estaba)');
      revisar(Math.abs(vuelta.alto - mes.altoTotal) <= 4, 'el mes recupera su alto (' + vuelta.alto + ' px)');
      revisar(vuelta.desbordeH <= 1, 'sin desbordamiento horizontal (' + vuelta.desbordeH + ' px)');
    }

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
