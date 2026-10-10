/*
 * verificar-homogeneizar-fechas.mjs — dejar todas las fechas en el mismo formato
 * ---------------------------------------------------------------------------
 * Jorge pidió homogeneizar las fechas (ya tenía respaldos hechos). Esta herramienta
 * vive dentro del CRM (Configuración → Sincronización y datos → "Homogeneizar fechas").
 *
 * Este arnés comprueba, contra una copia SIN el SDK de Firebase:
 *   1. Convierte a AAAA-MM-DD las fechas que llegan como las escribe la gente o una hoja
 *      de cálculo (8/10/2027, 2027/10/08, 08-10-2027), en TODAS las colecciones y dentro
 *      de lo que tengan anidado (contratos, pagos, cargos, tareas...).
 *   2. Lo que YA está en formato correcto NO se toca (ni un byte).
 *   3. Los campos de HORA conservan su hora (fecha + hora).
 *   4. NO toca nada que no sea una fecha: montos, pagos, notas, teléfonos... y el dinero
 *      sigue cuadrando igual (invariante).
 *   5. Lo que no se puede leer como fecha se deja tal cual y se reporta.
 *   6. La SIMULACIÓN no cambia nada (solo cuenta).
 *   7. Aplica de verdad, marca lo cambiado para subir a la nube, y el historial NO se toca.
 *
 * Cómo se corre:  node pruebas\verificar-homogeneizar-fechas.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9359);
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

/* Datos con fechas "como llegan de una hoja de Google", mezcladas con otras ya correctas. */
const SEMILLA = `
  paquetes = [ { id: 'paq-1', nombre: 'Paquete con fecha rara', descripcion: 'x', precio: 8950, descuento: 0,
    vigencia: '31/12/2026', fechaRegistro: '2026-01-01', items: [] } ];
  serviciosAdicionales = [ { id: 'srv-1', nombre: 'Servicio', precio: 1000, descuento: 0, vigencia: '2026/12/31', fechaRegistro: '1/1/2026' } ];
  prospectos = [
    { id: 'pro-1', nombre: 'Importada Uno', telefono: '8781110001', email: '', faseActual: 'Interesado',
      historialFases: [ { fase: 'Interesado', fecha: '8/10/2027', notas: 'alta' } ], notasGenerales: '',
      clienteId: null, fechaRegistro: '8/10/2027', fechaEvento: '8/10/2027', fechaNacimiento: '2027/10/08' },
    { id: 'pro-2', nombre: 'Ya estaba bien', telefono: '8781110002', email: '', faseActual: 'Interesado',
      historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2026-05-05', fechaEvento: '2027-03-15' },
    { id: 'pro-3', nombre: 'Fecha ilegible', telefono: '8781110003', email: '', faseActual: 'Interesado',
      historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2026-05-05', fechaEvento: 'en marzo' }
  ];
  clientes = [ { id: 'cli-1', nombre: 'Cliente Uno', telefono: '8781110004', email: '', estado: 'Activo',
    fechaRegistro: '15-03-2026', contratos: [ { id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Cliente Uno', festejado: 'Festejada',
      tipo: 'paquete', paqueteId: 'paq-1', serviciosIds: [], precioBase: 8950, precioFinal: 6900, descuentoMonto: 0,
      cargos: [ { id: 'car-1', monto: 3500, fecha: '2/2/2026 17:05', nota: 'cargo' } ],
      pagos: [ { id: 'pag-1', monto: 6900, fecha: '2026-08-25 18:50', codigo: 'PDA-1', nota: 'pago bueno' },
               { id: 'pag-2', monto: 2050, fecha: '8/10/2026 12:00', codigo: 'PDA-2', nota: 'pago con fecha rara' } ],
      estado: 'Completado', fechaEvento: '8/10/2027', fechaContrato: '10/1/2026', notas: 'no tocar esta nota' } ] } ];
  tareas = [ { id: 'tar-1', descripcion: 'Llamar', tipo: 'Llamada', completada: false, fecha: '11/10/2026', hora: '10:00',
    clienteId: 'pro_pro-1', fechaCreacion: '2026-10-10 09:00', notas: 'nota intacta' } ];
  campanias = [ { id: 'camp-1', nombre: 'Campaña', estado: 'activa', fechaInicio: '1/9/2026', fechaFin: '31/12/2026',
    configuracion: {}, etapas: [ { id: 'e1', nombre: 'Inicio', orden: 1 } ] } ];
  participaciones = [ { id: 'par-1', campaignId: 'camp-1', prospectId: 'pro-1', estado: 'registrada', etapaId: 'e1',
    fechaRegistro: '8/10/2026', fechaProximoSeguimiento: '11/10/2026' } ];
  historial = [ { id: 'h1', fecha: '8/10/2026 10:00', entidad: 'prospecto', accion: 'crear', descripcion: 'no se debe tocar' } ];
  papelera = [];
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-fechas'), 'about:blank'], { stdio: 'ignore' });
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

    console.log('\n1) El botón existe en Configuración y la simulación no cambia nada');
    const sim = JSON.parse(await evaluar(cdp, `(function () {
      var hayBoton = !!document.getElementById('btn-homogeneizar-fechas');
      var antes = JSON.stringify({ prospectos: prospectos, clientes: clientes, paquetes: paquetes, tareas: tareas, campanias: campanias, participaciones: participaciones });
      var r = homogeneizarTodasLasFechas(false);          /* simulación */
      var despues = JSON.stringify({ prospectos: prospectos, clientes: clientes, paquetes: paquetes, tareas: tareas, campanias: campanias, participaciones: participaciones });
      return JSON.stringify({ hayBoton: hayBoton, reporte: r, sinCambios: antes === despues });
    })()`));
    console.log('   botón: ' + sim.hayBoton + ' · simulación: ' + sim.reporte.fechas + ' fecha(s) en ' + sim.reporte.entidades + ' registro(s)');
    console.log('   por colección: ' + JSON.stringify(sim.reporte.porColeccion));
    revisar(sim.hayBoton === true, 'el botón está en Configuración');
    revisar(sim.sinCambios === true, 'la simulación NO cambia nada (solo cuenta)');
    revisar(sim.reporte.fechas >= 12, 'la simulación encuentra las fechas mal formateadas (' + sim.reporte.fechas + ')');

    console.log('\n2) Se aplica de verdad');
    const aplicado = JSON.parse(await evaluar(cdp, `(function () {
      var dineroAntes = (function () {
        var c = clientes[0].contratos[0];
        var tot = calcularTotalesContrato(c);
        return { totalAPagar: tot.totalAPagar, totalPagos: tot.totalPagos, saldo: tot.saldoPendiente, cantidadPagos: c.pagos.length };
      })();
      var r = homogeneizarTodasLasFechas(true);
      var dineroDespues = (function () {
        var c = clientes[0].contratos[0];
        var tot = calcularTotalesContrato(c);
        return { totalAPagar: tot.totalAPagar, totalPagos: tot.totalPagos, saldo: tot.saldoPendiente, cantidadPagos: c.pagos.length };
      })();
      var c = clientes[0].contratos[0];
      var p1 = prospectos.filter(function (x) { return x.id === 'pro-1'; })[0];
      var p2 = prospectos.filter(function (x) { return x.id === 'pro-2'; })[0];
      var p3 = prospectos.filter(function (x) { return x.id === 'pro-3'; })[0];
      return JSON.stringify({
        reporte: r,
        dineroIgual: JSON.stringify(dineroAntes) === JSON.stringify(dineroDespues),
        dinero: dineroDespues,
        prospectoEvento: p1.fechaEvento, prospectoNacimiento: p1.fechaNacimiento, prospectoRegistro: p1.fechaRegistro,
        historialFase: p1.historialFases[0].fecha,
        yaEstaba: { registro: p2.fechaRegistro, evento: p2.fechaEvento },
        ilegible: p3.fechaEvento,
        contratoEvento: c.fechaEvento, contratoFecha: c.fechaContrato,
        pagoConHora: c.pagos.filter(function (x) { return x.id === 'pag-2'; })[0].fecha,
        pagoBueno: c.pagos.filter(function (x) { return x.id === 'pag-1'; })[0].fecha,
        cargoConHora: c.cargos[0].fecha,
        notaIntacta: c.notas, notaTarea: tareas[0].notas,
        vigenciaPaquete: paquetes[0].vigencia, vigenciaServicio: serviciosAdicionales[0].vigencia,
        campaniaInicio: campanias[0].fechaInicio, campaniaFin: campanias[0].fechaFin,
        tareaFecha: tareas[0].fecha, tareaCreacion: tareas[0].fechaCreacion,
        participacion: participaciones[0].fechaProximoSeguimiento,
        historialIntacto: historial[0].fecha,
        sucios: contarEntidadesSucias()
      });
    })()`));
    console.log('   ' + aplicado.reporte.fechas + ' fecha(s) en ' + aplicado.reporte.entidades + ' registro(s) · ' + JSON.stringify(aplicado.reporte.porColeccion));
    console.log('   prospecto: evento ' + aplicado.prospectoEvento + ' · nacimiento ' + aplicado.prospectoNacimiento + ' · registro ' + aplicado.prospectoRegistro + ' · fase ' + aplicado.historialFase);
    console.log('   contrato: evento ' + aplicado.contratoEvento + ' · contrato ' + aplicado.contratoFecha + ' · pago con hora ' + aplicado.pagoConHora + ' · cargo con hora ' + aplicado.cargoConHora);
    revisar(aplicado.prospectoEvento === '2027-10-08' && aplicado.prospectoNacimiento === '2027-10-08' && aplicado.prospectoRegistro === '2027-10-08',
      'las fechas importadas quedaron en AAAA-MM-DD (8/10/2027 → 2027-10-08)');
    revisar(aplicado.historialFase === '2027-10-08', 'también dentro de las listas anidadas (historial de fases)');
    revisar(aplicado.contratoEvento === '2027-10-08' && aplicado.contratoFecha === '2026-01-10', 'los contratos quedaron normalizados');
    revisar(aplicado.pagoConHora === '2026-10-08 12:00', 'un pago con fecha rara y hora conserva su hora (' + aplicado.pagoConHora + ')');
    revisar(aplicado.cargoConHora === '2026-02-02 17:05', 'un cargo también conserva su hora (' + aplicado.cargoConHora + ')');
    revisar(aplicado.vigenciaPaquete === '2026-12-31' && aplicado.vigenciaServicio === '2026-12-31', 'la vigencia de paquetes y servicios quedó normalizada');
    revisar(aplicado.campaniaInicio === '2026-09-01' && aplicado.campaniaFin === '2026-12-31', 'las fechas de las campañas quedaron normalizadas');
    revisar(aplicado.tareaFecha === '2026-10-11' && aplicado.tareaCreacion === '2026-10-10 09:00', 'las tareas quedaron normalizadas (y su hora se conserva)');
    revisar(aplicado.participacion === '2026-10-11', 'las participaciones quedaron normalizadas');

    console.log('\n3) Nada más se toca');
    revisar(aplicado.yaEstaba.registro === '2026-05-05' && aplicado.yaEstaba.evento === '2027-03-15', 'lo que ya estaba en formato correcto no se tocó');
    revisar(aplicado.pagoBueno === '2026-08-25 18:50', 'un pago ya correcto (con hora) sigue igual');
    revisar(aplicado.ilegible === 'en marzo' && aplicado.reporte.sinLeerTotal === 1, 'lo que no es fecha se deja tal cual y se reporta');
    revisar(aplicado.notaIntacta === 'no tocar esta nota' && aplicado.notaTarea === 'nota intacta', 'las notas quedaron intactas');
    revisar(aplicado.dineroIgual === true && aplicado.dinero.totalAPagar === 10400 && aplicado.dinero.totalPagos === 8950 && aplicado.dinero.cantidadPagos === 2,
      'EL DINERO NO SE TOCÓ: mismo total (6,900 + 3,500 de cargo), mismos pagos, mismo saldo');
    revisar(aplicado.historialIntacto === '8/10/2026 10:00', 'el historial NO se toca (es la bitácora del CRM)');
    revisar(aplicado.sucios > 0, 'lo cambiado quedó marcado para subir a la nube');

    console.log('\n4) Segunda pasada: no queda nada por hacer');
    const segunda = JSON.parse(await evaluar(cdp, `(function () {
      var r = homogeneizarTodasLasFechas(false);
      return JSON.stringify({ fechas: r.fechas, sinLeer: r.sinLeerTotal });
    })()`));
    revisar(segunda.fechas === 0, 'al repetirlo no encuentra nada que cambiar (es idempotente)');
    revisar(segunda.sinLeer === 1, 'y sigue reportando el valor que no es fecha');

    console.log('\n5) La ficha ya muestra bien las fechas');
    const ficha = JSON.parse(await evaluar(cdp, `(function () {
      verDetalleProspecto('pro-1');
      var cuerpo = document.getElementById('panel-lateral-body') || document.getElementById('modal-body');
      var campos = [].slice.call(cuerpo.querySelectorAll('.detalle-campo'));
      var f = campos.filter(function (c) { return /Fecha del evento/.test(c.textContent || ''); })[0];
      var t = (f ? f.textContent : '').replace(/\\s+/g, ' ').trim();
      return JSON.stringify({ texto: t });
    })()`));
    console.log('   ' + ficha.texto);
    revisar(/08\/10\/2027/.test(ficha.texto) && ficha.texto.indexOf('undefined') === -1, 'la ficha muestra 08/10/2027 (sin undefined)');

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
