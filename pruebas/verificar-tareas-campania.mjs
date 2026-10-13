/*
 * verificar-tareas-campania.mjs — tareas de campaña en el Calendario (12/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge, con pantallazos:
 *   1) "cuando se agrega una tarea a un prospecto automáticamente en una campaña, la tarea
 *      también aparece en la sección de calendario pero no aparece vinculada a nadie, a pesar de
 *      que en la ficha de la campaña la tarea sí está asignada a un prospecto".
 *   2) "si la tarea se cumple dentro de la ficha de la campaña, para seguir el programa de
 *      tareas de seguimiento siguen apareciendo como pendientes en la sección de calendario;
 *      quiero que independientemente de donde se realice la tarea aparezcan como completadas o
 *      como pendientes según sea el caso".
 *
 * Causas (las dos verificadas aquí):
 *   · El vínculo de las tareas de campaña va en `prospectoId`, pero el calendario lo buscaba en
 *     `clienteId` (con el prefijo 'pro_'): salían "Sin vincular".
 *   · Conviven dos formatos de estado: `completada` (tareas a mano) y `estado`
 *     ('pendiente'/'completada', motor de campañas). Cada pantalla leía el suyo.
 *
 * Cómo se corre:  node pruebas\verificar-tareas-campania.mjs
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
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9371);
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
    '--disable-extensions', '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-tarcamp'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable');
    await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'http://127.0.0.1:' + puertoHttp + '/' + path.basename(PAGINA) });
    await dormir(4500);

    console.log('\n0) Se prepara una campaña activa con tarea automática para un prospecto');
    const alta = JSON.parse(await evaluar(cdp, `(function () {
      usuarioActual = { nombre: 'Jorge', rol: 'Administrador', admin: true, email: 'p@local' };
      ocultarPantallaLogin(); actualizarUIUsuario();
      aplicarRestriccionesPorRol(); conectarEventListenersApp();
      paquetes = [ { id: 'paq-1', nombre: 'Paquete Princesa', precio: 8950, descuento: 0, fechaRegistro: '2026-01-01', items: [] } ];
      serviciosAdicionales = []; clientes = []; historial = []; papelera = []; tareas = [];
      prospectos = [ { id: 'pro-1', nombre: 'Alissa Mota', telefono: '8781234567', email: 'alissa@correo.com', faseActual: 'Interesado', historialFases: [], etiquetas: [], tareasRelacionadas: [], notasGenerales: '', fechaRegistro: '2026-09-01' } ];
      campanias = [];
      participaciones = [];
      var m = App.motor;
      var camp = m.crearCampania({ nombre: 'XV Alissa', estado: 'borrador' });
      var idCamp = (camp && camp.campania) ? camp.campania.id : (camp && camp.id);
      m.actualizarCampania(idCamp, { estado: 'activa' });
      /* Una etapa con una tarea automática (el "programa de tareas de seguimiento"). */
      var etapa = m.agregarEtapa(idCamp, { nombre: 'Primer contacto', orden: 1 });
      var idEtapa = (etapa && etapa.etapa) ? etapa.etapa.id : (etapa && etapa.id);
      m.actualizarCampania(idCamp, { plantillasTareas: [ { id: 'plt-1', nombre: 'Llamar para agendar cita', tipo: 'Llamada',
        etapaOrigen: idEtapa, activa: true, desplazamientoDias: 0, prioridad: 'Alta' } ] });
      /* Se mete al prospecto a la campaña: el motor genera la tarea solo. */
      var part = m.agregarParticipacion({ campaniaId: idCamp, prospectoId: 'pro-1', etapaId: idEtapa });
      var idPart = (part && part.participacion) ? part.participacion.id : (part && part.id);
      if (idPart) m.generarTareasDeEtapa(idPart, idEtapa);
      var generadas = (window.tareas || []).filter(function (t) { return t.participacionId; });
      return JSON.stringify({ idCamp: idCamp, idEtapa: idEtapa, idPart: idPart, tareas: generadas.length,
        campos: generadas[0] ? Object.keys(generadas[0]).join(',') : '',
        prospectoId: generadas[0] ? generadas[0].prospectoId : null,
        clienteId: generadas[0] ? generadas[0].clienteId : undefined,
        estado: generadas[0] ? generadas[0].estado : null });
    })()`));
    console.log('   tareas generadas: ' + alta.tareas + ' · prospectoId: ' + alta.prospectoId + ' · clienteId: ' + alta.clienteId + ' · estado: ' + alta.estado);
    revisar(alta.tareas === 1, 'la campaña generó la tarea automática del prospecto');
    revisar(alta.prospectoId === 'pro-1' && alta.clienteId === undefined, 'la tarea queda vinculada por prospectoId (no por clienteId): esa es la clave del bug');

    console.log('\n1) En el CALENDARIO la tarea aparece vinculada al prospecto (antes: "Sin vincular")');
    const enCalendario = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.participacionId; })[0];
      var v = entidadDeTarea(t);
      /* Se abre el Calendario en la fecha de la tarea para revisar la lista real. */
      var f = t.fecha;
      mesActualCal = Number(f.split('-')[1]) - 1; anoActualCal = Number(f.split('-')[0]);
      cambiarSeccion('calendario'); renderizarCalendario();
      var lista = document.getElementById('lista-tareas');
      var texto = lista ? lista.textContent.replace(/\\s+/g, ' ') : '';
      var chip = lista ? lista.querySelector('.tarea-chip-cliente') : null;
      var dia = document.querySelector('.dia[data-fecha="' + f + '"]');
      return JSON.stringify({
        tipoVinculo: v ? v.tipo : null, nombreVinculo: v ? v.entidad.nombre : null,
        esDeProspecto: tareaEsDeProspecto(t),
        chipCliente: chip ? chip.textContent.trim() : '(no hay chip)',
        chipSinVincular: !!(lista && lista.querySelector('.tarea-chip-cliente.sin-vincular')),
        listaTraeNombre: texto.indexOf('Alissa') !== -1,
        listaTraeTitulo: texto.indexOf('Llamar para agendar cita') !== -1,
        listaSinTitulo: texto.indexOf('sin descripción') !== -1,
        casillaTraeNombre: dia ? dia.textContent.indexOf('Alissa') !== -1 : null
      });
    })()`));
    console.log('   vínculo: ' + enCalendario.tipoVinculo + ' · ' + enCalendario.nombreVinculo + ' · chip: "' + enCalendario.chipCliente + '"');
    revisar(enCalendario.nombreVinculo === 'Alissa Mota', 'el CRM resuelve el prospecto de la tarea de campaña');
    revisar(enCalendario.chipSinVincular === false && enCalendario.chipCliente.indexOf('Alissa') !== -1, 'la tarjeta de la lista muestra al prospecto (ya no "Sin vincular")');
    revisar(enCalendario.listaTraeNombre === true, 'el nombre aparece en la lista del calendario');
    revisar(enCalendario.listaTraeTitulo === true && enCalendario.listaSinTitulo === false, 'y se ve el TÍTULO real de la tarea (antes salía "(tarea sin descripción)")');
    revisar(enCalendario.casillaTraeNombre === true, 'y también en la casilla del día');

    console.log('\n2) Se completa en la FICHA DE LA CAMPAÑA (como lo hace Jorge) y el calendario debe verlo completado');
    const desdeCampania = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.participacionId; })[0];
      var r = App.motor.completarTarea(t.id, { resultado: 'contactado', nota: 'Quedamos de vernos' });
      var t2 = tareas.filter(function (x) { return x.id === t.id; })[0];
      renderizarCalendario();
      var lista = document.getElementById('lista-tareas');
      var tarjeta = lista ? lista.querySelector('.tarjeta-registro') : null;
      return JSON.stringify({
        ok: r.ok, estado: t2.estado, completada: t2.completada,
        loVeCompletada: tareaCompletada(t2),
        etiqueta: tarjeta ? (tarjeta.querySelector('.tarjeta-etiqueta') || {}).textContent : null,
        claseCompletada: !!(lista && lista.querySelector('.tarjeta-completada')),
        dejaDeContarPendiente: tareas.filter(function (x) { return !tareaCompletada(x); }).length
      });
    })()`));
    console.log('   motor: estado=' + desdeCampania.estado + ' completada=' + desdeCampania.completada + ' · etiqueta en el calendario: "' + desdeCampania.etiqueta + '"');
    revisar(desdeCampania.ok === true, 'la ficha de la campaña completó la tarea');
    revisar(desdeCampania.completada === true, 'al completarla en la campaña se escribe TAMBIÉN el formato del calendario');
    revisar(desdeCampania.etiqueta === 'Completada' && desdeCampania.claseCompletada === true, 'el calendario la muestra COMPLETADA (antes seguía "Pendiente")');
    revisar(desdeCampania.dejaDeContarPendiente === 0, 'ya no cuenta como pendiente');

    console.log('\n3) Se reabre en la ficha de la campaña y el calendario debe verlo pendiente');
    const reabrir = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.participacionId; })[0];
      App.motor.reabrirTarea(t.id);
      var t2 = tareas.filter(function (x) { return x.id === t.id; })[0];
      renderizarCalendario();
      var lista = document.getElementById('lista-tareas');
      var tarjeta = lista ? lista.querySelector('.tarjeta-registro') : null;
      return JSON.stringify({ estado: t2.estado, completada: t2.completada, loVeCompletada: tareaCompletada(t2),
        etiqueta: tarjeta ? (tarjeta.querySelector('.tarjeta-etiqueta') || {}).textContent : null });
    })()`));
    console.log('   estado=' + reabrir.estado + ' · etiqueta: "' + reabrir.etiqueta + '"');
    revisar(reabrir.loVeCompletada === false && reabrir.etiqueta === 'Pendiente', 'al reabrirla en la campaña vuelve a "Pendiente" en el calendario');

    console.log('\n4) Y al revés: se completa desde el CALENDARIO y la campaña debe verlo completado');
    const desdeCalendario = JSON.parse(await evaluar(cdp, `(function () {
      var t = tareas.filter(function (x) { return x.participacionId; })[0];
      /* Se usa el mismo botón de la tarjeta del calendario. */
      alternarCompletarTarea(t.id);
      /* Debe abrirse EL MISMO diálogo que en la ficha de la campaña (resultado y próximo
         seguimiento): eso es lo que hace que el programa de tareas avance desde el calendario. */
      var abrioDialogo = !!document.getElementById('ct-guardar');
      if (abrioDialogo) {
        var sel = document.getElementById('ct-resultado'); if (sel) sel.value = 'contactado';
        document.getElementById('ct-guardar').click();
      }
      var t2 = tareas.filter(function (x) { return x.id === t.id; })[0];
      var part = participaciones.filter(function (x) { return x.id === t.participacionId; })[0];
      return JSON.stringify({ abrioDialogo: abrioDialogo, estado: t2.estado, completada: t2.completada,
        completadaParaElMotor: t2.estado === 'completada',
        resultadoContacto: t2.resultadoContacto || '',
        contactoEnLaParticipacion: part ? (part.fechaUltimoContacto || '') : '(sin participación)',
        resultadoEnLaParticipacion: part ? (part.resultado || '') : '' });
    })()`));
    console.log('   abrió el diálogo de la campaña: ' + desdeCalendario.abrioDialogo + ' · estado para el motor: ' + desdeCalendario.estado + ' · contacto en la participación: ' + desdeCalendario.contactoEnLaParticipacion);
    revisar(desdeCalendario.abrioDialogo === true, 'al completar una tarea de campaña desde el calendario se abre el MISMO diálogo que en la campaña');
    revisar(desdeCalendario.estado === 'completada' && desdeCalendario.completada === true, 'al confirmarlo, queda completada también para la campaña (los dos formatos)');
    revisar(String(desdeCalendario.contactoEnLaParticipacion).length === 10, 'y el programa de seguimiento registra el contacto en la participación (fechaUltimoContacto)');

    console.log('\n5) Los filtros del calendario usan el estado unificado');
    const filtros = JSON.parse(await evaluar(cdp, `(function () {
      vistaCalActual = 'mes';   /* el filtro de semana acota por fechas: aquí se prueba el estado */
      document.getElementById('filtro-tareas-calendario').value = 'pendientes';
      renderizarListaTareas();
      var l1 = document.getElementById('lista-tareas').textContent;
      document.getElementById('filtro-tareas-calendario').value = 'completadas';
      renderizarListaTareas();
      var l2 = document.getElementById('lista-tareas').textContent;
      document.getElementById('filtro-tareas-calendario').value = 'todas';
      renderizarListaTareas();
      return JSON.stringify({ pendientesLaTrae: l1.indexOf('Llamar para agendar') !== -1, completadasLaTrae: l2.indexOf('Llamar para agendar') !== -1 });
    })()`));
    revisar(filtros.pendientesLaTrae === false && filtros.completadasLaTrae === true, 'con la tarea completada, sale del filtro "Pendientes" y entra en "Completadas"');

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
