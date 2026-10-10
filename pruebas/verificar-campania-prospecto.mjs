/*
 * verificar-campania-prospecto.mjs — campaña en los prospectos (10/10/2026)
 * ---------------------------------------------------------------------------
 * Jorge: "Los prospectos quiero poder separarlos por campañas también, agregame ese
 * campo en la creación de prospectos". Eligió que sea la campaña REAL (participación),
 * la misma que usan la importación y los tableros de Campañas, para que no haya dos
 * verdades.
 *
 * Comprueba, en Chrome sin ventana y contra una copia SIN el SDK de Firebase:
 *   1. El formulario de prospecto trae el campo Campaña con las campañas del CRM.
 *   2. Al crear un prospecto con campaña, se crea la PARTICIPACIÓN (no una etiqueta):
 *      el prospecto queda contado en la campaña.
 *   3. Al editar y elegir otra campaña, se agrega la nueva participación (y se avisa).
 *   4. Al dejar "Sin campaña", se PIDE CONFIRMACIÓN antes de quitar y, al confirmar,
 *      la participación desaparece (sin borrar el prospecto).
 *   5. La tarjeta del prospecto muestra la etiqueta con el nombre de la campaña.
 *   6. El filtro por campaña deja solo los de esa campaña, y "Sin campaña" los otros.
 *
 * Cómo se corre:  node pruebas\verificar-campania-prospecto.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9351);
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

const SEMILLA = `
  campanias = [
    { id: 'camp-1', nombre: 'Bodas Noviembre', estado: 'activa', configuracion: { permiteMultiplesParticipaciones: false, permitirParticipacionFinalizada: false },
      etapas: [ { id: 'et-1', nombre: 'Contacto inicial', orden: 1 }, { id: 'et-2', nombre: 'Cotización', orden: 2 } ] },
    { id: 'camp-2', nombre: 'XV Años 2027', estado: 'activa', configuracion: { permiteMultiplesParticipaciones: false, permitirParticipacionFinalizada: false },
      etapas: [ { id: 'et-3', nombre: 'Contacto inicial', orden: 1 } ] },
    { id: 'camp-3', nombre: 'Corporativos 2026', estado: 'finalizada', configuracion: { permiteMultiplesParticipaciones: false, permitirParticipacionFinalizada: false },
      etapas: [ { id: 'et-4', nombre: 'Contacto inicial', orden: 1 } ] }
  ];
  prospectos = [ { id: 'pro-1', nombre: 'Allison Garza', telefono: '8781160964', email: 'a@correo.com', faseActual: 'Interesado',
    historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2026-10-01' } ];
  participaciones = []; clientes = []; paquetes = []; serviciosAdicionales = [];
  tareas = []; historial = []; papelera = []; prospectosImportados = [];
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-campania'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'file:///' + PAGINA.replace(/\\/g, '/') });
    await dormir(4500);

    const montar = await evaluar(cdp, `(function () {
      try {
        if (typeof firebase !== 'undefined') return 'ABORTADO: firebase se cargó';
        ${SEMILLA}
        usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'prueba@local' };
        ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
        return 'ok';
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    console.log('Archivo: ' + PAGINA);
    if (montar !== 'ok') throw new Error('No se pudo montar: ' + montar);

    console.log('\n1) El formulario de prospecto trae el campo Campaña');
    const form = JSON.parse(await evaluar(cdp, `(function () {
      mostrarFormularioProspecto(null);
      var s = document.getElementById('prospecto-campania');
      return JSON.stringify({
        hay: !!s,
        opciones: s ? [].slice.call(s.options).map(function (o) { return o.textContent; }) : [],
        trasNombre: (function () {
          var campos = [].slice.call(document.querySelectorAll('#form-prospecto .form-grupo label')).map(function (l) { return l.textContent.trim(); });
          return campos;
        })()
      });
    })()`));
    console.log('   opciones: ' + form.opciones.join(' | '));
    revisar(form.hay === true, 'el desplegable de campaña existe');
    revisar(form.opciones.length === 4, 'trae "Sin campaña" + las 3 campañas del CRM');
    revisar(/Bodas Noviembre/.test(form.opciones.join(' ')) && /Corporativos 2026 \(finalizada\)/.test(form.opciones.join(' ')),
      'las campañas salen con su nombre, y las cerradas marcadas como tales');
    revisar(form.trasNombre.indexOf('Campaña (opcional)') !== -1, 'el campo va en el formulario, después de la fase');

    console.log('\n2) Crear un prospecto CON campaña crea la participación');
    const creado = JSON.parse(await evaluar(cdp, `(function () {
      document.getElementById('prospecto-nombre').value = 'Karla Medina';
      document.getElementById('prospecto-telefono').value = '8787001020';
      document.getElementById('prospecto-campania').value = 'camp-1';
      document.getElementById('form-prospecto').requestSubmit();
      var nuevos = prospectos.filter(function (p) { return p.nombre === 'Karla Medina'; });
      var n = nuevos[0];
      var partes = n ? participaciones.filter(function (x) { return x.prospectId === n.id; }) : [];
      return JSON.stringify({
        creado: !!n,
        campaniaEnProspecto: n ? !!n.campaniaId : null,
        participaciones: partes.length,
        campaniaDeLaParticipacion: partes.length ? partes[0].campaignId : null,
        estado: partes.length ? partes[0].estado : null,
        etapa: partes.length ? !!partes[0].etapaId : null,
        origen: partes.length ? partes[0].origen : null
      });
    })()`));
    console.log('   participación: ' + creado.participaciones + ' · campaña ' + creado.campaniaDeLaParticipacion + ' · estado ' + creado.estado + ' · origen ' + creado.origen);
    revisar(creado.creado === true, 'el prospecto se creó');
    revisar(creado.campaniaEnProspecto === false, 'la campaña NO se guarda como etiqueta suelta en el prospecto');
    revisar(creado.participaciones === 1 && creado.campaniaDeLaParticipacion === 'camp-1', 'se creó la PARTICIPACIÓN real en la campaña elegida');
    revisar(creado.etapa === true, 'la participación quedó en la etapa inicial de la campaña (cuenta en el tablero)');

    console.log('\n3) La tarjeta y el filtro muestran la campaña');
    const tarjeta = JSON.parse(await evaluar(cdp, `(function () {
      renderizarProspectos();
      var tarjetas = [].slice.call(document.querySelectorAll('#lista-prospectos .mosaico-card, #lista-prospectos .lista-fila'));
      var conNombre = tarjetas.filter(function (t) { return (t.textContent || '').indexOf('Karla Medina') !== -1; })[0];
      return JSON.stringify({
        etiqueta: conNombre ? (function () { var e = conNombre.querySelector('.etiqueta-campania'); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })() : null,
        filtroOpciones: (function () { var s = document.getElementById('filtro-campania-prospecto'); return s ? [].slice.call(s.options).map(function (o) { return o.textContent; }) : []; })()
      });
    })()`));
    console.log('   etiqueta en la tarjeta: "' + tarjeta.etiqueta + '"');
    console.log('   filtro: ' + tarjeta.filtroOpciones.join(' | '));
    revisar(tarjeta.etiqueta !== null && /Bodas Noviembre/.test(tarjeta.etiqueta), 'la tarjeta del prospecto trae la etiqueta con la campaña');
    revisar(tarjeta.filtroOpciones.indexOf('Sin campaña') !== -1, 'el filtro de campaña tiene "Todas", las campañas y "Sin campaña"');

    const filtrado = JSON.parse(await evaluar(cdp, `(function () {
      var s = document.getElementById('filtro-campania-prospecto');
      function visibles() {
        renderizarProspectos();
        return [].slice.call(document.querySelectorAll('#lista-prospectos .mosaico-card, #lista-prospectos .lista-fila')).map(function (t) {
          var tit = t.querySelector('.mosaico-titulo, .lista-titulo');
          return tit ? tit.textContent.trim() : '';
        }).filter(Boolean);
      }
      s.value = 'camp-1'; var enCamp1 = visibles();
      s.value = 'camp-2'; var enCamp2 = visibles();
      s.value = 'sin'; var sinCamp = visibles();
      s.value = 'todas'; var todas = visibles();
      return JSON.stringify({ enCamp1: enCamp1, enCamp2: enCamp2, sinCamp: sinCamp, todas: todas });
    })()`));
    console.log('   campaña 1: ' + filtrado.enCamp1.join(', ') + ' · campaña 2: [' + filtrado.enCamp2.join(', ') + '] · sin campaña: ' + filtrado.sinCamp.join(', '));
    revisar(filtrado.enCamp1.length === 1 && filtrado.enCamp1[0] === 'Karla Medina', 'filtrando por la campaña 1 sale solo el que participa en ella');
    revisar(filtrado.enCamp2.length === 0, 'filtrando por otra campaña no sale');
    revisar(filtrado.sinCamp.length === 1 && filtrado.sinCamp[0] === 'Allison Garza', '"Sin campaña" deja solo a los que no participan en ninguna');

    console.log('\n4) Cambiar de campaña agrega la nueva participación');
    const cambiado = JSON.parse(await evaluar(cdp, `(function () {
      var n = prospectos.filter(function (p) { return p.nombre === 'Karla Medina'; })[0];
      editarProspecto(n.id);
      var s = document.getElementById('prospecto-campania');
      var preseleccion = s.value;
      s.value = 'camp-2';
      document.getElementById('form-prospecto').requestSubmit();
      var partes = participaciones.filter(function (x) { return x.prospectId === n.id; }).map(function (x) { return x.campaignId; });
      return JSON.stringify({ preseleccion: preseleccion, participaciones: partes });
    })()`));
    console.log('   al abrir salía elegida: ' + cambiado.preseleccion + ' · participaciones ahora: ' + cambiado.participaciones.join(', '));
    revisar(cambiado.preseleccion === 'camp-1', 'al editar, la campaña actual sale ya elegida');
    revisar(cambiado.participaciones.length === 2 && cambiado.participaciones.indexOf('camp-2') !== -1,
      'se agregó la participación en la campaña nueva (ya participa en las dos)');

    console.log('\n5) Dejar "Sin campaña" pide confirmación y solo entonces quita');
    const quitar = JSON.parse(await evaluar(cdp, `(function () {
      var n = prospectos.filter(function (p) { return p.nombre === 'Karla Medina'; })[0];
      editarProspecto(n.id);
      document.getElementById('prospecto-campania').value = '';
      document.getElementById('form-prospecto').requestSubmit();
      var boton = document.getElementById('btn-confirmar-financiero');
      var antes = participaciones.filter(function (x) { return x.prospectId === n.id; }).length;
      var texto = boton ? (document.querySelector('#modal-body .advertencia-eliminar') || {}).textContent : '';
      if (boton) boton.click();
      var despues = participaciones.filter(function (x) { return x.prospectId === n.id; }).length;
      return JSON.stringify({
        pidioConfirmacion: !!boton,
        texto: (texto || '').replace(/\\s+/g, ' ').trim().substring(0, 150),
        antes: antes, despues: despues,
        prospectoExiste: prospectos.some(function (p) { return p.nombre === 'Karla Medina'; })
      });
    })()`));
    console.log('   aviso: "' + quitar.texto + '"');
    console.log('   participaciones: ' + quitar.antes + ' → ' + quitar.despues + ' · prospecto sigue existiendo: ' + quitar.prospectoExiste);
    revisar(quitar.pidioConfirmacion === true, 'pide confirmación antes de quitar (nada se quita en silencio)');
    revisar(/no se borra|NO se borra/.test(quitar.texto) || /solo deja de participar/.test(quitar.texto), 'el aviso explica que el prospecto NO se borra');
    revisar(quitar.antes === 2 && quitar.despues === 0, 'al confirmar se quitaron las participaciones');
    revisar(quitar.prospectoExiste === true, 'el prospecto sigue existiendo');

    console.log('\n6) Los borrados del módulo de campañas SÍ borran (bug del 10/10/2026)');
    const borrados = JSON.parse(await evaluar(cdp, `(function () {
      /* Antes, db() devolvía un objeto nuevo y "db().x = ..." no cambiaba nada: las
         funciones decían { ok: true } sin borrar. Se encontró al conectar la campaña
         del prospecto. Se prueban las tres que estaban rotas en el motor. */
      var m = App.motor;
      var r = { antes: {}, despues: {} };

      /* Participación: se crea una nueva y se borra. */
      var p2 = prospectos.filter(function (p) { return p.nombre === 'Allison Garza'; })[0];
      m.agregarParticipacion({ campaniaId: 'camp-1', prospectoId: p2.id });
      r.antes.participaciones = participaciones.length;
      var part = participaciones[0];
      var rp = m.eliminarParticipacion(part.id);
      r.participacionesOk = !!(rp && rp.ok);
      r.despues.participaciones = participaciones.length;

      /* Prospecto del motor (sin participaciones ni cliente). */
      prospectos.push({ id: 'pro-borrar', nombre: 'Para Borrar', faseActual: 'Interesado', historialFases: [], clienteId: null, fechaRegistro: '2026-10-01' });
      r.antes.prospectos = prospectos.length;
      var rpr = m.eliminarProspecto('pro-borrar');
      r.prospectoOk = !!(rpr && rpr.ok);
      r.prospectoFuera = !prospectos.some(function (p) { return p.id === 'pro-borrar'; });
      r.despues.prospectos = prospectos.length;

      /* Campaña sin participaciones. */
      campanias.push({ id: 'camp-borrar', nombre: 'Campaña Desechable', estado: 'activa',
        configuracion: { permiteMultiplesParticipaciones: false, permitirParticipacionFinalizada: false },
        etapas: [{ id: 'et-9', nombre: 'Inicio', orden: 1 }] });
      r.antes.campanias = campanias.length;
      var rc = m.eliminarCampania('camp-borrar');
      r.campaniaOk = !!(rc && rc.ok);
      r.campaniaFuera = !campanias.some(function (c) { return c.id === 'camp-borrar'; });
      r.despues.campanias = campanias.length;

      return JSON.stringify(r);
    })()`));
    console.log('   participaciones: ' + borrados.antes.participaciones + ' → ' + borrados.despues.participaciones + ' (ok: ' + borrados.participacionesOk + ')');
    console.log('   prospectos: ' + borrados.antes.prospectos + ' → ' + borrados.despues.prospectos + ' (ok: ' + borrados.prospectoOk + ')');
    console.log('   campañas: ' + borrados.antes.campanias + ' → ' + borrados.despues.campanias + ' (ok: ' + borrados.campaniaOk + ')');
    revisar(borrados.participacionesOk === true && borrados.despues.participaciones === borrados.antes.participaciones - 1,
      'eliminarParticipacion borra de verdad (antes decía que sí y no borraba)');
    revisar(borrados.prospectoOk === true && borrados.prospectoFuera === true, 'eliminarProspecto borra de verdad');
    revisar(borrados.campaniaOk === true && borrados.campaniaFuera === true, 'eliminarCampania borra de verdad');

    console.log('\n7) El detalle del prospecto: la campaña con ETIQUETA (no código) y la fecha del evento');
    const detalle = JSON.parse(await evaluar(cdp, `(function () {
      /* Una participación como la del pantallazo de Jorge: pendiente de validación y con
         seguimiento. Y un prospecto con fecha de evento capturada. */
      participaciones.push({ id: 'par-x', campaignId: 'camp-1', prospectId: 'pro-1', estado: 'pendienteValidacion', etapaId: 'et-1', fechaProximoSeguimiento: '2026-11-11' });
      var p1 = prospectos.filter(function (p) { return p.id === 'pro-1'; })[0];
      p1.fechaEvento = '2027-03-15';
      verDetalleProspecto('pro-1');
      var cuerpo = document.getElementById('panel-lateral-body') || document.getElementById('modal-body');
      var texto = cuerpo ? (cuerpo.textContent || '') : '';
      var etiqueta = cuerpo ? cuerpo.querySelector('.detalle-seccion .etiqueta-part') : null;
      var bloqueFecha = null;
      if (cuerpo) {
        var campos = [].slice.call(cuerpo.querySelectorAll('.detalle-campo'));
        bloqueFecha = campos.filter(function (c) { return /Fecha del evento/.test(c.textContent || ''); })[0];
      }
      return JSON.stringify({
        hayEtiqueta: !!etiqueta,
        etiquetaTexto: etiqueta ? (etiqueta.textContent || '').trim() : null,
        etiquetaClase: etiqueta ? etiqueta.className : null,
        textoConHTML: /<span|&lt;span/.test(texto),
        textoConId: /etp_|et-1/.test(texto),
        muestraEtapa: /Contacto inicial/.test(texto),
        fecha: bloqueFecha ? (bloqueFecha.textContent || '').replace(/\\s+/g, ' ').trim() : null
      });
    })()`));
    console.log('   etiqueta: "' + detalle.etiquetaTexto + '"  [' + detalle.etiquetaClase + ']');
    console.log('   fecha del evento en la ficha: "' + detalle.fecha + '"');
    revisar(detalle.hayEtiqueta === true, 'la etiqueta de estado se dibuja como ETIQUETA (no como código)');
    revisar(detalle.etiquetaTexto === 'Pendiente de validación', 'y dice "Pendiente de validación"');
    revisar(detalle.textoConHTML === false, 'ya NO se ve el HTML en pantalla (era el bug del pantallazo)');
    revisar(detalle.textoConId === false && detalle.muestraEtapa === true, 'muestra el NOMBRE de la etapa, no su identificador');
    revisar(/15\/03\/2027/.test(detalle.fecha || ''), 'la ficha muestra la fecha del evento capturada');

    console.log('\n7b) La fecha del evento en el formulario (opcional) y en la tarjeta');
    const fechaForm = JSON.parse(await evaluar(cdp, `(function () {
      editarProspecto('pro-1');
      var inp = document.getElementById('prospecto-fecha-evento');
      var prellenado = inp ? inp.value : null;
      /* Sin fecha: se puede guardar igual (es opcional). */
      inp.value = '';
      document.getElementById('form-prospecto').requestSubmit();
      var p1 = prospectos.filter(function (p) { return p.id === 'pro-1'; })[0];
      var sinFecha = p1.fechaEvento;
      /* Con fecha nueva: se guarda y queda en el historial. */
      editarProspecto('pro-1');
      document.getElementById('prospecto-fecha-evento').value = '2027-04-20';
      document.getElementById('form-prospecto').requestSubmit();
      var conFecha = prospectos.filter(function (p) { return p.id === 'pro-1'; })[0].fechaEvento;
      renderizarProspectos();
      var tarjetas = [].slice.call(document.querySelectorAll('#lista-prospectos .mosaico-card, #lista-prospectos .lista-fila'));
      var t = tarjetas.filter(function (x) { return (x.textContent || '').indexOf('Allison Garza') !== -1; })[0];
      var enTarjeta = t ? /Evento: 20\\/04\\/2027/.test(t.textContent || '') : false;
      var enHistorial = historial.some(function (h) { return h && h.entidad === 'prospecto' && /Fecha del evento/i.test(JSON.stringify(h.cambios || [])); });
      return JSON.stringify({ campo: !!inp, prellenado: prellenado, sinFecha: sinFecha, conFecha: conFecha, enTarjeta: enTarjeta, enHistorial: enHistorial });
    })()`));
    console.log('   campo: ' + fechaForm.campo + ' · prellenado: "' + fechaForm.prellenado + '" · vacío → "' + fechaForm.sinFecha + '" · nueva → "' + fechaForm.conFecha + '"');
    console.log('   en la tarjeta: ' + fechaForm.enTarjeta + ' · anotada en el historial: ' + fechaForm.enHistorial);
    revisar(fechaForm.campo === true, 'el formulario trae el campo de fecha del evento');
    revisar(fechaForm.prellenado === '2027-03-15', 'al editar sale la fecha que ya tenía');
    revisar(fechaForm.sinFecha === '', 'es OPCIONAL: se puede dejar vacía y guardar');
    revisar(fechaForm.conFecha === '2027-04-20', 'y se guarda la fecha nueva');
    revisar(fechaForm.enTarjeta === true, 'la tarjeta del prospecto muestra la fecha del evento');
    revisar(fechaForm.enHistorial === true, 'el cambio de fecha queda anotado en el historial');

    console.log('\n7c) Fechas importadas como "8/10/2027" (el caso del pantallazo)');
    const fechas = JSON.parse(await evaluar(cdp, `(function () {
      return JSON.stringify({
        importada: formatearFecha('8/10/2027'),
        iso: formatearFecha('2027-10-08'),
        conHoraT: formatearFecha('2027-10-08T12:00:00'),
        conHoraEspacio: formatearFecha('2027-10-08 12:00'),
        textoRaro: formatearFecha('en marzo'),
        vacia: formatearFecha(''),
        norm1: normalizarFechaISO('8/10/2027'),
        norm2: normalizarFechaISO('2027-10-08'),
        norm3: normalizarFechaISO('2027/10/08'),
        norm4: normalizarFechaISO('08-10-2027'),
        norm5: normalizarFechaISO('en marzo'),
        norm6: normalizarFechaISO('2027-13-45'),
        hora: formatearFechaHora('2026-03-15 12:00')
      });
    })()`));
    console.log('   importada "8/10/2027" → "' + fechas.importada + '" · ISO → "' + fechas.iso + '" · con hora → "' + fechas.conHoraT + '"');
    console.log('   normalizadas: 8/10/2027 → ' + fechas.norm1 + ' · 2027/10/08 → ' + fechas.norm3 + ' · 08-10-2027 → ' + fechas.norm4);
    revisar(fechas.importada === '08/10/2027', 'una fecha importada "8/10/2027" se muestra "08/10/2027" (ya no "undefined/undefined")');
    revisar(fechas.iso === '08/10/2027' && fechas.conHoraT === '08/10/2027' && fechas.conHoraEspacio === '08/10/2027',
      'el formato ISO y el que trae hora se muestran bien');
    revisar(fechas.textoRaro === 'en marzo', 'si no es una fecha, se muestra TAL CUAL (nunca "undefined/undefined")');
    revisar(fechas.vacia === 'No especificada', 'vacío sigue diciendo "No especificada"');
    revisar(fechas.norm1 === '2027-10-08' && fechas.norm3 === '2027-10-08' && fechas.norm4 === '2027-10-08',
      'el normalizador entiende día/mes/año, año/mes/día y con guiones');
    revisar(fechas.norm5 === '' && fechas.norm6 === '', 'y rechaza lo que no es fecha (incluido el 45 de mes)');
    revisar(fechas.hora === '15/03/2026 12:00', 'una fecha de pago con hora se muestra "15/03/2026 12:00"');

    console.log('\n7d) Un prospecto importado con la fecha en formato de la hoja se ve y se corrige solo');
    const importado = JSON.parse(await evaluar(cdp, `(function () {
      /* Como llegan hoy los prospectos de la hoja de Google. */
      prospectos.push({ id: 'pro-imp', nombre: 'Importada de la Hoja', telefono: '8781110000', email: '',
        faseActual: 'Interesado', historialFases: [], notasGenerales: '', clienteId: null,
        fechaRegistro: '2026-10-10', fechaEvento: '8/10/2027', fechaNacimiento: '2/2/1998' });
      verDetalleProspecto('pro-imp');
      var cuerpo = document.getElementById('panel-lateral-body') || document.getElementById('modal-body');
      var campos = [].slice.call(cuerpo.querySelectorAll('.detalle-campo'));
      var f = campos.filter(function (c) { return /Fecha del evento/.test(c.textContent || ''); })[0];
      var enFicha = f ? (f.textContent || '').replace(/\\s+/g, ' ').trim() : '';
      editarProspecto('pro-imp');
      var enFormulario = document.getElementById('prospecto-fecha-evento').value;
      document.getElementById('form-prospecto').requestSubmit();
      var guardado = prospectos.filter(function (p) { return p.id === 'pro-imp'; })[0].fechaEvento;
      return JSON.stringify({ enFicha: enFicha, enFormulario: enFormulario, guardado: guardado });
    })()`));
    console.log('   ficha: "' + importado.enFicha + '" · formulario: ' + importado.enFormulario + ' → guardado: ' + importado.guardado);
    revisar(/08\/10\/2027/.test(importado.enFicha) && importado.enFicha.indexOf('undefined') === -1,
      'la ficha muestra la fecha importada correctamente');
    revisar(importado.enFormulario === '2027-10-08', 'el formulario la abre ya normalizada');
    revisar(importado.guardado === '2027-10-08', 'al guardar queda en ISO (se corrige sola, sin tocar nada más)');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 4).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
