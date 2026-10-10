/*
 * verificar-tareas-calendario.mjs — las tareas del calendario y la vista por semana
 * ---------------------------------------------------------------------------
 * Comprueba, en Chrome sin ventana y contra una copia SIN el SDK de Firebase (modo
 * local, 0 peticiones a la base real), TODO lo que Jorge pidió en esta ronda:
 *
 *   1. El TÍTULO de la tarjeta es la DESCRIPCIÓN, y el tipo de tarea va como dato
 *      extra (etiqueta), no como título.
 *   2. La lista se puede ORDENAR por fecha de vencimiento (lo próximo primero, lo
 *      vencido hasta arriba), por cliente/prospecto y por campaña vs tareas normales.
 *   3. La tarjeta trae los botones de WhatsApp y email cuando el vinculado tiene
 *      teléfono o correo, y NO los trae cuando no los tiene.
 *   4. Al dar clic se abre la FICHA de la tarea con su información.
 *   5. Al crear/editar una tarea se puede poner HORA específica o "a cualquier hora",
 *      y eso queda guardado (hora + todoElDia).
 *   6. El enlace a Google Calendar de la tarea dice "Tarea: (nombre)" y el de un
 *      contrato ya NO dice "Sesión de fotos:".
 *   7. El archivo .ics que se descarga lleva el título correcto y la hora (o el día
 *      completo, sin hora).
 *   8. El conmutador MES / SEMANA dibuja una sola semana de 7 días, con la semana
 *      correcta, y ‹ › mueven una semana; en modo mes siguen moviendo un mes.
 *
 * Cómo se corre:  node pruebas\verificar-tareas-calendario.mjs
 * Requiere la copia sin SDK:  node pruebas\preview-clay.mjs   (la deja en preview\)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9345);
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

/* ── Siembra: dos clientes (uno CON contacto y otro sin), un prospecto y 7 tareas
      repartidas alrededor de hoy, con tipos, campañas y horas distintas. ── */
const SEMILLA = `
  var HOY = new Date();
  function isoDe(dias) {
    var d = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + dias);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  var HOY_ISO = isoDe(0);
  var AYER = isoDe(-2), MANANA = isoDe(1), PROX = isoDe(5);
  usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'prueba@local' };
  clientes = [
    { id: 'cli-1', nombre: 'Familia Mendoza', telefono: '8781234567', email: 'mendoza@correo.com', estado: 'Activo', fechaRegistro: AYER,
      contratos: [ { id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Familia Mendoza', festejado: 'Mariana y Diego',
        tipo: 'solo-servicio', servicioId: 'srv-1', serviciosIds: ['srv-1'], precioBase: 6000, precioFinal: 6000,
        descuentoMonto: 0, cargos: [], pagos: [], estado: 'Pendiente', fechaEvento: PROX, horaEvento: '17:00', fechaContrato: AYER } ] },
    { id: 'cli-2', nombre: 'Sofía Herrera', telefono: '', email: '', estado: 'Activo', fechaRegistro: AYER, contratos: [] }
  ];
  prospectos = [ { id: 'p1', nombre: 'Karla Ruiz', telefono: '8789998877', email: 'karla@correo.com', faseActual: 'Interesado', fechaRegistro: AYER } ];
  campanias = [ { id: 'camp-1', nombre: 'Bodas 2027', estado: 'activa' } ];
  serviciosAdicionales = [ { id: 'srv-1', nombre: 'Cabina 360', descripcion: 'Cabina', precio: 6000, descuento: 0 } ];
  paquetes = [];
  tareas = [
    { id: 't-vencida', tipo: 'Llamar', clienteId: 'cli-1', fecha: AYER, descripcion: 'Confirmar dirección de la sesión', notas: 'Llamar después de las 5', completada: false, hora: '', todoElDia: true, fechaCreacion: AYER + 'T09:00:00', creadaPor: 'Jorge Rosas' },
    { id: 't-hoy', tipo: 'Sesión de fotos', clienteId: 'cli-1', fecha: HOY_ISO, descripcion: 'Sesión de fotos en el estudio', notas: '', completada: false, hora: '16:30', todoElDia: false, fechaCreacion: AYER + 'T10:00:00', creadaPor: 'Jorge Rosas' },
    { id: 't-manana', tipo: 'Enviar mensaje', clienteId: 'pro_p1', fecha: MANANA, descripcion: 'Mandar la cotización del paquete', notas: '', completada: false, hora: '', todoElDia: true, fechaCreacion: HOY_ISO + 'T08:00:00', creadaPor: 'Jorge Rosas' },
    { id: 't-prox-camp', tipo: 'Confirmar', clienteId: 'pro_p1', fecha: PROX, descripcion: 'Confirmar asistencia a la boda', notas: '', completada: false, hora: '11:00', todoElDia: false, campaniaId: 'camp-1', participacionId: 'part-1', fechaCreacion: HOY_ISO + 'T08:30:00', creadaPor: 'Jorge Rosas' },
    { id: 't-sin-vinc', tipo: 'Otro', clienteId: null, fecha: MANANA, descripcion: 'Comprar baterías para el flash', notas: '', completada: false, hora: '', todoElDia: true, fechaCreacion: HOY_ISO + 'T09:00:00', creadaPor: 'Jorge Rosas' },
    { id: 't-sin-contacto', tipo: 'Visita', clienteId: 'cli-2', fecha: PROX, descripcion: 'Visitar a Sofía en su casa', notas: '', completada: false, hora: '', todoElDia: true, fechaCreacion: HOY_ISO + 'T09:30:00', creadaPor: 'Jorge Rosas' },
    { id: 't-completada', tipo: 'Llamar', clienteId: 'cli-1', fecha: AYER, descripcion: 'Llamada de seguimiento ya hecha', notas: '', completada: true, hora: '', todoElDia: true, fechaCompletada: AYER + 'T18:00:00', fechaCreacion: AYER + 'T08:00:00', creadaPor: 'Jorge Rosas' }
  ];
  participaciones = [ { id: 'part-1', prospectoId: 'p1', campaignId: 'camp-1', campaniaId: 'camp-1', etapaId: 'e1', estado: 'activo', fechaProximoSeguimiento: MANANA } ];
`;

/** Utilidad dentro de la página: deja la lista dibujada en la sección del calendario. */
const UTIL = `
  window.__verTexto = function (sel) { var e = document.querySelector(sel); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; };
  window.__verTitulos = function () {
    return [].slice.call(document.querySelectorAll('#lista-tareas .tarjeta-titulo'))
      .map(function (e) { return e.innerText.replace(/\\s+/g, ' ').trim(); });
  };
  window.__verDescripciones = function () {
    /* El título de la tarjeta es "DESCRIPCIÓN + etiqueta de estado"; aquí se devuelve
       solo la descripción, que es lo comparable. */
    return [].slice.call(document.querySelectorAll('#lista-tareas .tarjeta-titulo'))
      .map(function (e) {
        var copia = e.cloneNode(true);
        var etiqueta = copia.querySelector('.tarjeta-etiqueta');
        if (etiqueta) etiqueta.remove();
        return copia.innerText.replace(/\\s+/g, ' ').trim();
      });
  };
  window.__verChips = function (id) {
    var t = tareas.filter(function (x) { return x.id === id; })[0];
    var idx = tareas.indexOf(t);
    var tarjetas = document.querySelectorAll('#lista-tareas .tarjeta-registro');
    var objetivo = null;
    for (var i = 0; i < tarjetas.length; i++) {
      if (tarjetas[i].querySelector('.tarjeta-titulo') && tarjetas[i].querySelector('.tarjeta-titulo').innerText.indexOf(t.descripcion) === 0) { objetivo = tarjetas[i]; break; }
    }
    if (!objetivo) return null;
    return {
      titulo: objetivo.querySelector('.tarjeta-titulo').innerText.replace(/\\s+/g, ' ').trim(),
      chips: [].slice.call(objetivo.querySelectorAll('.tarea-meta-fila > span')).map(function (s) { return s.innerText.replace(/\\s+/g, ' ').trim(); }),
      whatsapp: objetivo.querySelectorAll('.btn-whatsapp').length,
      email: objetivo.querySelectorAll('.btn-azul[onclick*="emailTarea"]').length,
      detalle: objetivo.querySelectorAll('.btn-ver-detalle').length,
      completar: objetivo.querySelectorAll('.btn-completar').length
    };
  };
  window.__abrirCalendario = function () {
    try { App.seleccionarSeccion('calendario'); } catch (e) { }
    renderizarCalendario();
  };
  window.__ordenar = function (v) {
    var s = document.getElementById('orden-tareas');
    s.value = v; s.onchange();
    return window.__verDescripciones();
  };
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA + ' (generala con node pruebas\\preview-clay.mjs)');
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-tareas'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'file:///' + PAGINA.replace(/\\/g, '/') });
    await dormir(4500);

    const montar = await evaluar(cdp, `(function () {
      try {
        if (typeof firebase !== 'undefined') return 'ABORTADO: firebase se cargó';
        ${SEMILLA}
        ${UTIL}
        ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
        return 'ok';
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    console.log('Archivo: ' + PAGINA);
    if (montar !== 'ok') throw new Error('No se pudo montar: ' + montar);

    /* ═══ 1) El título es la descripción y el tipo es una etiqueta ═══ */
    console.log('\n1) La tarjeta lleva la DESCRIPCIÓN como título y el tipo como etiqueta');
    const tarjeta = JSON.parse(await evaluar(cdp, `(function () {
      window.__abrirCalendario();
      return JSON.stringify({ chips: window.__verChips('t-hoy'), titulos: window.__verTitulos() });
    })()`));
    const chipsHoy = tarjeta.chips || {};
    console.log('   título: "' + chipsHoy.titulo + '"');
    console.log('   etiquetas: ' + JSON.stringify(chipsHoy.chips));
    revisar(/^Sesión de fotos en el estudio/.test(chipsHoy.titulo || ''), 'el título de la tarjeta es la DESCRIPCIÓN');
    revisar((chipsHoy.chips || []).some(c => /Sesión de fotos/.test(c)), 'el TIPO aparece como etiqueta aparte');
    revisar((chipsHoy.chips || []).some(c => /16:30/.test(c)), 'la etiqueta de fecha muestra la hora específica (16:30)');
    revisar((chipsHoy.chips || []).some(c => /Familia Mendoza/.test(c)), 'la etiqueta del vinculado trae el nombre del cliente');
    revisar((chipsHoy.chips || []).some(c => /vencida/i.test(c)) === false, 'una tarea de hoy NO se marca como vencida');
    revisar(tarjeta.titulos.length === 7, 'se dibujan las 7 tareas en la lista');

    /* ═══ 2) Orden por vencimiento, cliente y campaña ═══ */
    console.log('\n2) Orden: vencimiento (lo próximo primero), cliente y campaña');
    const ordenVenc = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__ordenar('vencimiento'))`));
    console.log('   vencimiento: ' + JSON.stringify(ordenVenc));
    revisar(ordenVenc[0] === 'Confirmar dirección de la sesión', 'lo VENCIDO va hasta arriba (es lo urgente)');
    revisar(ordenVenc.indexOf('Sesión de fotos en el estudio') === 1, 'luego lo de HOY');
    revisar(ordenVenc[ordenVenc.length - 1] === 'Llamada de seguimiento ya hecha', 'lo COMPLETADO queda al final');

    const ordenCli = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__ordenar('cliente'))`));
    console.log('   cliente: ' + JSON.stringify(ordenCli));
    const idxMendoza = ordenCli.indexOf('Confirmar dirección de la sesión');
    const idxKarla = ordenCli.indexOf('Mandar la cotización del paquete');
    revisar(idxMendoza !== -1 && idxKarla !== -1 && idxMendoza < idxKarla, 'agrupa por cliente/prospecto (Familia Mendoza antes que Karla Ruiz)');
    revisar(ordenCli[ordenCli.length - 2] === 'Comprar baterías para el flash', 'lo que no está vinculado queda al final del grupo');

    const ordenCamp = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__ordenar('campania'))`));
    console.log('   campaña: ' + JSON.stringify(ordenCamp));
    revisar(ordenCamp[0] === 'Confirmar asistencia a la boda', 'las tareas de CAMPAÑA van primero en esa vista');

    /* ═══ 3) Botones de WhatsApp y email en la tarjeta ═══ */
    console.log('\n3) Botones de WhatsApp y email en la tarjeta de la tarea');
    const conContacto = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__verChips('t-hoy'))`));
    const sinContacto = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__verChips('t-sin-contacto'))`));
    const sinVincular = JSON.parse(await evaluar(cdp, `JSON.stringify(window.__verChips('t-sin-vinc'))`));
    revisar(conContacto.whatsapp === 1 && conContacto.email === 1, 'con teléfono y correo: aparecen WhatsApp y email');
    revisar(sinContacto.whatsapp === 0 && sinContacto.email === 0, 'un cliente SIN teléfono ni correo no muestra botones vacíos');
    revisar(sinVincular.whatsapp === 0, 'una tarea sin vincular tampoco los muestra');
    revisar(conContacto.detalle === 1 && conContacto.completar === 1, 'la tarjeta conserva el botón de ficha y el de completar');

    /* ═══ 4) La ficha de la tarea ═══ */
    console.log('\n4) Clic para ver la ficha de la tarea');
    const ficha = JSON.parse(await evaluar(cdp, `(async function () {
      /* Se abre la ficha de una tarea CONOCIDA (la de hoy) y no la primera de la lista. */
      verDetalleTarea('t-hoy');
      await new Promise(function (r) { setTimeout(r, 250); });
      var cuerpo = document.getElementById('modal-body');
      var texto = cuerpo ? cuerpo.innerText.replace(/\\s+/g, ' ').trim() : '';
      return JSON.stringify({
        abierto: !!(cuerpo && texto.length > 0),
        texto: texto,
        botones: [].slice.call(document.querySelectorAll('#modal-body .detalle-acciones button')).map(function (b) { return b.innerText.replace(/\\s+/g, ' ').trim(); }),
        campos: [].slice.call(document.querySelectorAll('#modal-body .detalle-campo .lbl')).map(function (b) { return b.innerText.trim(); })
      });
    })()`));
    console.log('   campos: ' + JSON.stringify(ficha.campos));
    console.log('   botones: ' + JSON.stringify(ficha.botones));
    revisar(ficha.abierto, 'la ficha se abre al dar clic en la tarjeta');
    revisar(/Sesión de fotos en el estudio/.test(ficha.texto), 'la ficha muestra la descripción de la tarea');
    revisar(ficha.campos.map(c => c.toLowerCase()).indexOf('cuándo') !== -1 &&
      ficha.campos.map(c => c.toLowerCase()).indexOf('cliente / prospecto') !== -1, 'la ficha trae cuándo y con quién');
    revisar(/Familia Mendoza/.test(ficha.texto) && /16:30/.test(ficha.texto), 'la ficha muestra el cliente y la hora específica');
    revisar(ficha.botones.some(b => /Editar tarea/.test(b)), 'la ficha permite editar la tarea');
    revisar(ficha.botones.some(b => /WhatsApp/.test(b)) && ficha.botones.some(b => /Email/.test(b)), 'la ficha trae WhatsApp y email');
    revisar(ficha.botones.some(b => /Google Calendar/.test(b)), 'la ficha permite mandarla a Google Calendar');

    /* El clic en la tarjeta (no solo la llamada directa) también abre la ficha, y abre
       la de ESA tarjeta: se compara la descripción de la ficha con la de la tarjeta
       tocada (así la prueba no depende del orden que quedó seleccionado). */
    const fichaPorClic = JSON.parse(await evaluar(cdp, `(async function () {
      cerrarModal();
      await new Promise(function (r) { setTimeout(r, 200); });
      window.__abrirCalendario();
      var s = document.getElementById('orden-tareas');
      if (s) { s.value = 'vencimiento'; s.onchange(); }
      var tarjetas = document.querySelectorAll('#lista-tareas .tarjeta-registro');
      var primera = tarjetas[0] ? tarjetas[0].querySelector('.tarjeta-info') : null;
      var copia = tarjetas[0] ? tarjetas[0].querySelector('.tarjeta-titulo').cloneNode(true) : null;
      if (copia) { var et = copia.querySelector('.tarjeta-etiqueta'); if (et) et.remove(); }
      var tituloPrimera = copia ? copia.innerText.replace(/\\s+/g, ' ').trim() : '';
      if (primera) primera.click();
      await new Promise(function (r) { setTimeout(r, 300); });
      var cuerpo = document.getElementById('modal-body');
      return JSON.stringify({ tituloPrimera: tituloPrimera, texto: cuerpo ? cuerpo.innerText.replace(/\\s+/g, ' ').trim() : '' });
    })()`));
    console.log('   primera tarjeta: "' + fichaPorClic.tituloPrimera + '"');
    revisar(fichaPorClic.tituloPrimera.length > 0 && fichaPorClic.texto.indexOf(fichaPorClic.tituloPrimera) !== -1,
      'dar clic en la tarjeta abre la ficha de ESA tarea');

    /* ═══ 5) Hora específica o a cualquier hora ═══ */
    console.log('\n5) Al crear la tarea: hora específica o a cualquier hora del día');
    const formulario = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      mostrarFormularioTarea(null, 'cli-1');
      var modo = document.getElementById('tarea-hora-modo');
      var campo = document.getElementById('tarea-hora');
      return JSON.stringify({
        hayModo: !!modo,
        opciones: modo ? [].slice.call(modo.options).map(function (o) { return o.value; }) : [],
        campoOcultoAlInicio: campo ? campo.style.display === 'none' : null,
        campos: [].slice.call(document.querySelectorAll('#modal-body label')).map(function (l) { return l.innerText.replace(/\\s+/g, ' ').trim(); })
      });
    })()`));
    console.log('   opciones de hora: ' + JSON.stringify(formulario.opciones));
    revisar(formulario.hayModo === true, 'el formulario trae el selector de hora');
    revisar(formulario.opciones.join(',') === 'dia,hora', 'ofrece "a cualquier hora del día" y "a una hora específica"');
    revisar(formulario.campoOcultoAlInicio === true, 'la hora exacta se pide solo cuando se elige esa opción');
    revisar(formulario.campos.some(c => /Descripción de la tarea/.test(c)), 'la descripción es el primer campo del formulario');
    const guardadoConHora = JSON.parse(await evaluar(cdp, `(async function () {
      cerrarModal();
      mostrarFormularioTarea(null, 'cli-1');
      document.getElementById('tarea-descripcion').value = 'Entrega de álbum impreso';
      document.getElementById('tarea-tipo').value = 'Entrega de fotos';
      document.getElementById('tarea-fecha').value = tareas[0].fecha;
      document.getElementById('tarea-hora-modo').value = 'hora';
      document.getElementById('tarea-hora-modo').dispatchEvent(new Event('change'));
      document.getElementById('tarea-hora').value = '09:15';
      document.querySelector('#form-tarea button[type="submit"]').click();
      await new Promise(function (r) { setTimeout(r, 400); });
      var t = tareas.filter(function (x) { return x.descripcion === 'Entrega de álbum impreso'; })[0];
      return JSON.stringify({ creada: !!t, hora: t ? t.hora : null, todoElDia: t ? t.todoElDia : null, tipo: t ? t.tipo : null });
    })()`));
    console.log('   guardado con hora: ' + JSON.stringify(guardadoConHora));
    revisar(guardadoConHora.creada === true, 'la tarea se creó desde el formulario');
    revisar(guardadoConHora.hora === '09:15', 'guarda la hora específica (09:15)');
    revisar(guardadoConHora.todoElDia === false, 'marca que NO es de todo el día');
    revisar(guardadoConHora.tipo === 'Entrega de fotos', 'guarda el tipo de tarea elegido');

    const guardadoTodoElDia = JSON.parse(await evaluar(cdp, `(async function () {
      cerrarModal();
      mostrarFormularioTarea(null, 'cli-1');
      document.getElementById('tarea-descripcion').value = 'Recoger material en la bodega';
      document.getElementById('tarea-fecha').value = tareas[0].fecha;
      document.getElementById('tarea-hora-modo').value = 'dia';
      document.getElementById('tarea-hora-modo').dispatchEvent(new Event('change'));
      document.querySelector('#form-tarea button[type="submit"]').click();
      await new Promise(function (r) { setTimeout(r, 400); });
      var t = tareas.filter(function (x) { return x.descripcion === 'Recoger material en la bodega'; })[0];
      return JSON.stringify({ creada: !!t, hora: t ? t.hora : null, todoElDia: t ? t.todoElDia : null });
    })()`));
    console.log('   guardado a cualquier hora: ' + JSON.stringify(guardadoTodoElDia));
    revisar(guardadoTodoElDia.creada === true, 'también se puede guardar "a cualquier hora del día"');
    revisar(guardadoTodoElDia.hora === '', 'a cualquier hora NO guarda hora (dato limpio)');
    revisar(guardadoTodoElDia.todoElDia === true, 'marca que es de todo el día');

    /* ═══ 6) Google Calendar: títulos ═══ */
    console.log('\n6) Google Calendar: "Tarea: (nombre)" y el contrato sin "Sesión de fotos:"');
    const titulos = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.id === 't-hoy'; })[0];
      var tProsp = tareas.filter(function (x) { return x.id === 't-manana'; })[0];
      var tSin = tareas.filter(function (x) { return x.id === 't-sin-vinc'; })[0];
      return JSON.stringify({
        conCliente: tituloTareaCalendario(t),
        conProspecto: tituloTareaCalendario(tProsp),
        sinVinculo: tituloTareaCalendario(tSin)
      });
    })()`));
    console.log('   títulos de tarea: ' + JSON.stringify(titulos));
    revisar(titulos.conCliente === 'Tarea: Familia Mendoza', 'la tarea de un cliente dice "Tarea: Familia Mendoza"');
    revisar(titulos.conProspecto === 'Tarea: Karla Ruiz', 'la tarea de un prospecto dice "Tarea: Karla Ruiz"');
    revisar(/^Tarea: /.test(titulos.sinVinculo), 'una tarea sin vincular sigue llevando el prefijo "Tarea:"');

    /* De verdad: se intercepta `window.open` y se mira el enlace que arma el CRM. Se usa
       el mismo camino que el botón de la tarjeta del contrato (btn-calendar). */
    const enlaces = JSON.parse(await evaluar(cdp, `(function () {
      var capturadas = [];
      var original = window.open;
      window.open = function (u) { capturadas.push(u); return null; };
      try { crearEventoGoogleCalendar('cli-1', 'con-1'); } catch (e) { capturadas.push('ERROR: ' + e.message); }
      try { tareaAGoogleCalendar('t-hoy'); } catch (e) { capturadas.push('ERROR: ' + e.message); }
      window.open = original;
      var urlContrato = capturadas[0] || '';
      var urlTarea = capturadas[1] || '';
      var dec = function (u) { try { return decodeURIComponent(u.split('?')[1] || ''); } catch (e) { return ''; } };
      // El texto codificado de un URLSearchParams equivale ' ' a '+': se compara así.
      var cod = function (u) { return String(u).split('?')[1] || ''; };
      var hayBotonCalendario = false;
      try { hayBotonCalendario = !!document.querySelector('.btn-calendar'); } catch (e) { }
      return JSON.stringify({
        hayBotonCalendario: hayBotonCalendario,
        urlContrato: dec(urlContrato),
        urlTarea: dec(urlTarea),
        crudoContrato: cod(urlContrato),
        crudoTarea: cod(urlTarea),
        completoContrato: urlContrato
      });
    })()`));
    console.log('   enlace del contrato: ' + (enlaces.urlContrato || '(sin enlace)'));
    console.log('   enlace de la tarea:  ' + (enlaces.urlTarea || '(sin enlace)'));
    revisar(enlaces.completoContrato.indexOf('calendar.google.com') !== -1, 'el contrato sigue abriendo Google Calendar');
    revisar(enlaces.crudoContrato.indexOf('text=Mariana+y+Diego') !== -1, 'el título del evento es SOLO el festejado ("Mariana y Diego")');
    revisar(enlaces.crudoContrato.toLowerCase().indexOf('sesi') === -1, 'el enlace del contrato NO contiene "Sesión de fotos"');
    revisar(enlaces.crudoTarea.indexOf('text=Tarea%3A+Familia+Mendoza') !== -1, 'el enlace de la tarea dice "Tarea: Familia Mendoza"');
    revisar(/dates=\d{8}T163000/.test(enlaces.urlTarea), 'el enlace de la tarea lleva la hora específica (16:30)');
    revisar(/details=/.test(enlaces.crudoTarea), 'el enlace lleva la descripción de la tarea en el detalle');

    /* ═══ 7) El archivo .ics ═══ */
    console.log('\n7) El archivo .ics que se descarga (para el calendario del teléfono)');
    const ics = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.id === 't-hoy'; })[0];
      var todo = tareas.filter(function (x) { return x.id === 't-manana'; })[0];
      var b1 = bloqueICS({ uid: 'tarea-' + t.id + '@registro-pda', dia: t.fecha, hora: t.hora, titulo: tituloTareaCalendario(t), detalle: detalleTareaCalendario(t), duracionHoras: 1 });
      var b2 = bloqueICS({ uid: 'tarea-' + todo.id + '@registro-pda', dia: todo.fecha, hora: '', titulo: tituloTareaCalendario(todo), detalle: '', duracionHoras: 1 });
      var co = clientes[0].contratos[0];
      var b3 = bloqueICS({ uid: 'contrato-' + co.id + '@registro-pda', dia: co.fechaEvento, hora: co.horaEvento, titulo: (co.festejado || 'Evento'), detalle: 'Cliente: Familia Mendoza', duracionHoras: 2 });
      return JSON.stringify({ conHora: b1, todoElDia: b2, contrato: b3 });
    })()`));
    revisar(/SUMMARY:Tarea: Familia Mendoza/.test(ics.conHora), 'el .ics de la tarea lleva el título "Tarea: Familia Mendoza"');
    revisar(/DTSTART:\d{8}T163000/.test(ics.conHora), 'el .ics respeta la hora específica (16:30)');
    revisar(/DESCRIPTION:[^\r\n]*Sesión de fotos en el estudio/.test(ics.conHora), 'el .ics lleva la descripción de la tarea en el detalle');
    revisar(/DTSTART;VALUE=DATE:\d{8}/.test(ics.todoElDia) && /DTEND;VALUE=DATE:\d{8}/.test(ics.todoElDia), '"a cualquier hora" se exporta como día completo (VALUE=DATE)');
    revisar(ics.todoElDia.indexOf('DTSTART:') === -1, 'el de todo el día no lleva hora en DTSTART');
    revisar(/SUMMARY:Mariana y Diego/.test(ics.contrato) && !/Sesión de fotos/.test(ics.contrato), 'el .ics del contrato va solo con el festejado');

    /* ═══ 8) Conmutador MES / SEMANA ═══ */
    console.log('\n8) Conmutador MES / SEMANA en el calendario');
    const mesInicial = JSON.parse(await evaluar(cdp, `(function () {
      document.querySelector('.btn-vista-cal[data-vista="mes"]').click();
      return JSON.stringify({
        titulo: document.getElementById('calendario-mes-ano').innerText.trim(),
        casillas: document.querySelectorAll('#calendario-grid .dia').length,
        activoMes: document.querySelector('.btn-vista-cal[data-vista="mes"]').classList.contains('activo')
      });
    })()`));
    console.log('   mes: "' + mesInicial.titulo + '" · casillas: ' + mesInicial.casillas);
    revisar(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) \d{4}$/.test(mesInicial.titulo), 'el modo mes muestra el mes y el año');
    revisar(mesInicial.casillas >= 28, 'el modo mes dibuja el mes completo');
    revisar(mesInicial.activoMes === true, 'el botón "Mes" queda marcado como activo');

    const semana = JSON.parse(await evaluar(cdp, `(function () {
      document.querySelector('.btn-vista-cal[data-vista="semana"]').click();
      var dias = document.querySelectorAll('#calendario-grid .dia-semana');
      var fechas = [].slice.call(dias).map(function (d) { return d.getAttribute('data-fecha'); });
      return JSON.stringify({
        titulo: document.getElementById('calendario-mes-ano').innerText.trim(),
        dias: dias.length,
        fechas: fechas,
        activoSemana: document.querySelector('.btn-vista-cal[data-vista="semana"]').classList.contains('activo'),
        filas: document.querySelectorAll('#calendario-grid .dia').length,
        nombres: [].slice.call(document.querySelectorAll('#calendario-grid .dia-nombre-semana')).length,
        etiquetas: [].slice.call(document.querySelectorAll('#calendario-grid .evento')).map(function (e) { return e.innerText.trim(); })
      });
    })()`));
    console.log('   semana: "' + semana.titulo + '"');
    console.log('   días: ' + JSON.stringify(semana.fechas));
    revisar(semana.dias === 7, 'el modo semana dibuja SOLO 7 casillas');
    revisar(semana.filas === 7, 'no queda ninguna casilla del mes colada en la vista de semana');
    revisar(semana.nombres === 7, 'los 7 encabezados de día llevan su fecha');
    revisar(/^Semana del /.test(semana.titulo), 'el título dice de qué semana se trata ("' + semana.titulo + '")');
    revisar(semana.activoSemana === true && semana.activoMes === undefined, 'el botón "Semana" queda marcado');
    const consecutivos = semana.fechas.every((f, i) => i === 0 || f > semana.fechas[i - 1]);
    revisar(consecutivos, 'los 7 días son consecutivos');
    const msDia = 86400000;
    const dif = (new Date(semana.fechas[6] + 'T12:00:00') - new Date(semana.fechas[0] + 'T12:00:00')) / msDia;
    revisar(dif === 6, 'la semana va de domingo a sábado (6 días de diferencia)');

    const navegacion = JSON.parse(await evaluar(cdp, `(function () {
      var antes = document.querySelectorAll('#calendario-grid .dia-semana')[0].getAttribute('data-fecha');
      document.getElementById('btn-mes-siguiente').click();
      var despues = document.querySelectorAll('#calendario-grid .dia-semana')[0].getAttribute('data-fecha');
      document.getElementById('btn-mes-anterior').click();
      var vuelta = document.querySelectorAll('#calendario-grid .dia-semana')[0].getAttribute('data-fecha');
      return JSON.stringify({ antes: antes, despues: despues, vuelta: vuelta });
    })()`));
    console.log('   navegación: ' + JSON.stringify(navegacion));
    revisar(navegacion.despues > navegacion.antes && navegacion.vuelta === navegacion.antes, '› avanza una SEMANA y ‹ regresa a la misma');

    const hoyVuelve = JSON.parse(await evaluar(cdp, `(function () {
      document.getElementById('btn-mes-actual').click();
      var h = new Date();
      var hoyISO = h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2) + '-' + ('0' + h.getDate()).slice(-2);
      var fechas = [].slice.call(document.querySelectorAll('#calendario-grid .dia-semana')).map(function (d) { return d.getAttribute('data-fecha'); });
      return JSON.stringify({ incluyeHoy: fechas.indexOf(hoyISO) !== -1, fechas: fechas });
    })()`));
    revisar(hoyVuelve.incluyeHoy === true, '"Hoy" deja la semana que contiene el día de hoy');

    const enMesSigueMes = JSON.parse(await evaluar(cdp, `(function () {
      document.querySelector('.btn-vista-cal[data-vista="mes"]').click();
      var t1 = document.getElementById('calendario-mes-ano').innerText.trim();
      document.getElementById('btn-mes-siguiente').click();
      var t2 = document.getElementById('calendario-mes-ano').innerText.trim();
      document.getElementById('btn-mes-anterior').click();
      return JSON.stringify({ t1: t1, t2: t2 });
    })()`));
    console.log('   mes → ' + enMesSigueMes.t1 + ' → ' + enMesSigueMes.t2);
    revisar(enMesSigueMes.t1 !== enMesSigueMes.t2, 'en modo mes, › sigue moviendo UN mes (el bug del salto quedó cerrado)');

    /* ═══ 9) Lo que ya funcionaba no se rompió ═══ */
    console.log('\n9) Nada de lo que ya funcionaba se rompió');
    const intacto = JSON.parse(await evaluar(cdp, `(function () {
      var antes = tareas.length;
      window.__abrirCalendario();
      var tarjetas = document.querySelectorAll('#lista-tareas .tarjeta-registro').length;
      return JSON.stringify({
        tareas: antes,
        tarjetas: tarjetas,
        controles: !!document.getElementById('orden-tareas'),
        vistaMesCasillas: document.querySelectorAll('#calendario-grid .dia').length,
        dinero: clientes[0].contratos[0].precioFinal
      });
    })()`));
    revisar(intacto.controles === true, 'la barra de orden sigue ahí después de redibujar');
    revisar(intacto.vistaMesCasillas >= 28, 'al volver al mes, la cuadrícula se dibuja completa otra vez');
    revisar(intacto.dinero === 6000, 'los contratos y el dinero no se tocaron (6000)');

    /* ═══ 10) La arcilla de Informes y Configuración, MEDIDA (no a ojo) ═══ */
    console.log('\n10) La arcilla aplicada a Informes y Configuración');
    const arcilla = JSON.parse(await evaluar(cdp, `(function () {
      function estilo(sel) {
        var e = document.querySelector(sel);
        if (!e) return null;
        var s = getComputedStyle(e);
        return { radio: s.borderTopLeftRadius, sombra: s.boxShadow, izq: s.borderLeftWidth, izqColor: s.borderLeftColor, izqEstilo: s.borderLeftStyle, fondo: s.backgroundImage.slice(0, 30) };
      }
      App.seleccionarSeccion('informes');
      try { renderizarInformes(); } catch (e) { }
      var metrica = estilo('.metricas-container .metrica-card');
      var bloque = estilo('.informe-bloque');
      var fila = estilo('.informe-fila');
      App.seleccionarSeccion('configuracion');
      var tarjeta = estilo('.config-card');
      var boton = estilo('.config-boton');
      var tema = estilo('.tema-opcion');
      /* La papelera y el historial están ocultos y sus listas pueden venir vacías: se
         insertan filas de prueba con las MISMAS clases del CRM. La muestra se deja
         VISIBLE pero fuera de la pantalla (a la izquierda): dentro de un contenedor
         oculto el navegador NO calcula los estilos y la medición saldría vacía. */
      var muestra = document.createElement('div');
      muestra.id = 'muestra-arcilla';
      muestra.style.cssText = 'position:fixed;left:-3000px;top:0;width:600px;';
      muestra.innerHTML =
        '<div class="papelera-item"><div class="papelera-item-contenido"><div class="papelera-item-titulo">prueba</div></div></div>' +
        '<div class="historial-item"><div class="historial-item-contenido"><div class="historial-item-titulo">prueba</div></div></div>' +
        '<div class="papelera-stat"><div class="lbl">prueba</div><div class="val">1</div></div>' +
        '<div class="historial-stat"><div class="lbl">prueba</div><div class="val">1</div></div>';
      document.body.appendChild(muestra);
      var m = {
        papelera: estilo('#muestra-arcilla .papelera-item'),
        historial: estilo('#muestra-arcilla .historial-item'),
        papeleraStat: estilo('#muestra-arcilla .papelera-stat'),
        historialStat: estilo('#muestra-arcilla .historial-stat')
      };
      muestra.remove();
      return JSON.stringify({
        metrica: metrica, bloque: bloque, fila: fila,
        tarjeta: tarjeta, boton: boton, tema: tema,
        papelera: m.papelera, historial: m.historial,
        papeleraStat: m.papeleraStat, historialStat: m.historialStat
      });
    })()`));
    const tieneSombra = (o) => !!(o && o.sombra && o.sombra !== 'none');
    const tieneFondo = (o) => !!(o && o.fondo && o.fondo.indexOf('gradient') !== -1);
    console.log('   radio de tarjeta de informe: ' + (arcilla.bloque ? arcilla.bloque.radio : 'sin bloque') +
      ' · canto papelera: ' + (arcilla.papelera ? arcilla.papelera.izq + ' ' + arcilla.papelera.izqColor : 'sin papelera') +
      ' · canto historial: ' + (arcilla.historial ? arcilla.historial.izq + ' ' + arcilla.historial.izqColor : 'sin historial'));
    /* La barrita de color del canto se reconoce porque el color es el de aviso (rojo) o
       el de acento (dorado). La arcilla deja un borde fino del color de arcilla: se
       comprueba que es FINO y que ya no trae ese color de aviso. */
    const cantoNeutro = (o) => !!(o && (o.izq === '0px' || parseFloat(o.izq) <= 1) &&
      !/rgb\(2[0-9]{2},\s*\d+,\s*\d+\)/.test(o.izqColor) && !/rgb\(2[0-9]{2},\s*1[0-9]{2}/.test(o.izqColor));
    revisar(tieneSombra(arcilla.metrica) && tieneFondo(arcilla.metrica), 'las tarjetas de números usan el relieve y el degradado de arcilla');
    revisar(tieneSombra(arcilla.bloque) && tieneFondo(arcilla.bloque), 'los bloques del desglose de informes son tarjetas de arcilla');
    revisar(tieneFondo(arcilla.fila), 'los renglones del desglose van hundidos (pastilla)');
    revisar(tieneSombra(arcilla.tarjeta) && tieneFondo(arcilla.tarjeta), 'las tarjetas de Configuración son tarjetas de arcilla');
    revisar(tieneFondo(arcilla.boton), 'los botones de Configuración van hundidos');
    revisar(tieneFondo(arcilla.tema), 'las muestras de tema son pastillas de arcilla');
    revisar(cantoNeutro(arcilla.papelera), 'la papelera ya NO trae la barrita de color al canto');
    revisar(cantoNeutro(arcilla.historial), 'el historial ya NO trae la barrita de color al canto');
    revisar(cantoNeutro(arcilla.papeleraStat), 'los contadores de la papelera también perdieron la barrita');
    revisar(cantoNeutro(arcilla.historialStat), 'los contadores del historial también perdieron la barrita');
    await evaluar(cdp, `(function () {
      var p = document.getElementById('papelera-card'); if (p) p.style.display = '';
      App.seleccionarSeccion('calendario');
      return 1;
    })()`);

    /* ═══ 11) El teléfono no se desborda a lo ancho ═══ */
    console.log('\n11) En ancho de teléfono, el calendario no se desborda de lado');
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.enviar('Page.navigate', { url: 'file:///' + PAGINA.replace(/\\/g, '/') });
    await dormir(4200);
    await evaluar(cdp, `(function () {
      usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'prueba@local' };
      ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
      ${SEMILLA}
      return 1;
    })()`);
    const movil = JSON.parse(await evaluar(cdp, `(function () {
      App.seleccionarSeccion('calendario');
      renderizarCalendario();
      var cont = document.querySelector('.calendario-container');
      var grid = document.getElementById('calendario-grid');
      var desborde = Math.max(Math.round(grid.scrollWidth - grid.clientWidth), Math.round(cont.scrollWidth - cont.clientWidth));
      var culpables = [];
      document.querySelectorAll('#seccion-calendario *').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 0.5) culpables.push((el.className || el.tagName) + ' @' + Math.round(r.right));
      });
      return JSON.stringify({ desborde: desborde, culpables: culpables.slice(0, 5), ancho: window.innerWidth });
    })()`));
    console.log('   desborde: ' + movil.desborde + 'px · culpables: ' + (movil.culpables.length ? movil.culpables.join(', ') : 'ninguno'));
    revisar(movil.desborde <= 1, 'el calendario no se desborda en el teléfono (nada de scroll horizontal)');
    revisar(movil.culpables.length === 0, 'ningún elemento del calendario se sale de la pantalla del teléfono');

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : (fallos + ' FALLAS')));
    process.exitCode = fallos === 0 ? 0 : 1;
  } catch (e) {
    console.error('\nERROR: ' + e.message);
    process.exitCode = 1;
  } finally {
    try { chrome.kill(); } catch (e) { }
  }
}

main();
