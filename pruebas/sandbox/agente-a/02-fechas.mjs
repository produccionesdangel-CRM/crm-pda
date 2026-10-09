/* 02-fechas.mjs — FAMILIA 1: FECHAS.
   Ejecutar: node pruebas\sandbox\agente-a\02-fechas.mjs
   Ataca fechas imposibles, años absurdos, fechas invertidas y fechas vacías por
   los formularios y por el motor que usa el asistente de campañas. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Fechas' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');

const A = (def) => ataque(caja, def);

/* ── Tareas: la fecha es un <input type="date"> ── */
await A({
  id: 'F-01', nombre: 'Tarea con año absurdo (1900-01-01)', dato: 'tarea-fecha = 1900-01-01',
  esperado: 'rechazo por fecha fuera de rango', gravedad: 'MEDIA', mirar: `var t = tareas[tareas.length-1]; return { ultima: t && t.fecha, descripcion: t && t.descripcion };`,
  js: `var n0 = tareas.length;
       var r = __R.tarea({ tipo: 'Visita', fecha: '1900-01-01', descripcion: 'REDTEAM fecha absurda 1900' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM fecha absurda 1900'; })[0];
       return t
         ? { veredicto: 'HUECO', detalle: 'Se guardó la tarea con fecha ' + JSON.stringify(t.fecha) + ' (el input date la aceptó). tareas ' + n0 + ' → ' + tareas.length }
         : { veredicto: 'CANDADO OK', detalle: 'No se creó la tarea. Leído por el input: ' + JSON.stringify(r.leido.fecha) };`
});

await A({
  id: 'F-02', nombre: 'Tarea con año absurdo (9999-12-31)', dato: 'tarea-fecha = 9999-12-31',
  esperado: 'rechazo por fecha fuera de rango', gravedad: 'MEDIA',
  js: `var n0 = tareas.length;
       __R.tarea({ tipo: 'Visita', fecha: '9999-12-31', descripcion: 'REDTEAM fecha absurda 9999' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM fecha absurda 9999'; })[0];
       return t
         ? { veredicto: 'HUECO', detalle: 'Se guardó la tarea con fecha ' + JSON.stringify(t.fecha) + '. tareas ' + n0 + ' → ' + tareas.length }
         : { veredicto: 'CANDADO OK', detalle: 'No se creó la tarea.' };`
});

await A({
  id: 'F-03', nombre: 'Tarea con fecha escrita a mano 31/02/2027', dato: 'tarea-fecha = 31/02/2027',
  esperado: 'rechazo (fecha inexistente)', gravedad: 'BAJA',
  js: `var n0 = tareas.length;
       var r = __R.tarea({ tipo: 'Visita', fecha: '31/02/2027', descripcion: 'REDTEAM dd/mm/yyyy' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: tareas.length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'El input date dejó ' + JSON.stringify(r.leido.fecha) + ' y la app respondió: ' + JSON.stringify(__R.textoNotis()) + ' · tareas ' + n0 + ' → ' + tareas.length };`
});

await A({
  id: 'F-04', nombre: 'Tarea con 2027-02-31', dato: 'tarea-fecha = 2027-02-31',
  esperado: 'rechazo (fecha inexistente)', gravedad: 'BAJA',
  js: `var n0 = tareas.length;
       var r = __R.tarea({ tipo: 'Visita', fecha: '2027-02-31', descripcion: 'REDTEAM 31 de febrero' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: tareas.length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'El input date dejó ' + JSON.stringify(r.leido.fecha) + ' · tareas ' + n0 + ' → ' + tareas.length };`
});

await A({
  id: 'F-05', nombre: 'Tarea con fecha vacía', dato: 'tarea-fecha = (vacío)',
  esperado: 'rechazo por campo obligatorio', gravedad: 'BAJA',
  js: `var n0 = tareas.length;
       __R.tarea({ tipo: 'Visita', fecha: '', descripcion: 'REDTEAM fecha vacía' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: tareas.length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'tareas ' + n0 + ' → ' + tareas.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'F-06', nombre: 'Tarea con 0000-00-00', dato: 'tarea-fecha = 0000-00-00',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = tareas.length;
       var r = __R.tarea({ tipo: 'Visita', fecha: '0000-00-00', descripcion: 'REDTEAM 0000-00-00' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: tareas.length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'input date dejó ' + JSON.stringify(r.leido.fecha) + ' · tareas ' + n0 + ' → ' + tareas.length };`
});

/* ── Contratos: fecha del evento ── */
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'F-07', nombre: 'Contrato con fecha de evento 1900-01-01', dato: 'contrato-fecha-evento = 1900-01-01',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = obtenerContratos().length;
       var r = __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM 1900', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '1900-01-01', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'input date dejó ' + JSON.stringify(r.fechaAceptada) + ' · contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'F-08', nombre: 'Contrato con fecha de evento 9999-12-31', dato: 'contrato-fecha-evento = 9999-12-31',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM 9999', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '9999-12-31', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'F-09', nombre: 'Contrato NUEVO con fecha de evento en el pasado', dato: 'contrato-fecha-evento = 2020-05-05',
  esperado: 'rechazo (evento ya ocurrió)', gravedad: 'MEDIA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM pasado', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2020-05-05', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'F-10', nombre: 'Contrato con fecha de evento vacía', dato: 'contrato-fecha-evento = (vacío)',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM sin fecha', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'F-11', nombre: 'Contrato con fecha 2027-02-31 (imposible)', dato: 'contrato-fecha-evento = 2027-02-31',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = obtenerContratos().length;
       var r = __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM 31feb', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-02-31', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'input date dejó ' + JSON.stringify(r.fechaAceptada) + ' · contratos ' + n0 + ' → ' + obtenerContratos().length };`
});

/* ── Campañas ── */
await A({
  id: 'F-12', nombre: 'Campaña con fecha de fin ANTES de la de inicio (crearCampania)', dato: 'fechaInicio=2027-12-31, fechaFin=2027-01-01',
  esperado: 'rechazo al crear', gravedad: 'MEDIA',
  js: `var n0 = campanias.length;
       var c = App.motor.crearCampania({ nombre: 'REDTEAM fechas invertidas', tipo: 'captacion', fechaInicio: '2027-12-31', fechaFin: '2027-01-01' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       return { veredicto: (viva && campanias.length > n0) ? 'HUECO' : 'CANDADO OK',
                detalle: 'campaña creada en estado ' + viva.estado + ' con ' + viva.fechaInicio + ' → ' + viva.fechaFin +
                         ' · campanias ' + n0 + ' → ' + campanias.length +
                         ' · validarCampania dice ok=' + v.ok + ' errores=' + JSON.stringify(v.errores) };`
});

await A({
  id: 'F-13', nombre: 'Editar campaña y dejar las fechas invertidas (actualizarCampania)', dato: 'fechaInicio=2030-12-31, fechaFin=2029-01-01',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var c = campanias[0];
       var r = App.motor.actualizarCampania(c.id, { fechaInicio: '2030-12-31', fechaFin: '2029-01-01' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       return { veredicto: (r.ok && viva.fechaInicio > viva.fechaFin) ? 'HUECO' : 'CANDADO OK',
                detalle: 'ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · quedó ' + viva.fechaInicio + ' → ' + viva.fechaFin };`
});

await A({
  id: 'F-14', nombre: 'Participación con fechaRegistro imposible (2027-02-31)', dato: 'fechaRegistro=2027-02-31',
  esperado: 'rechazo o normalización de la fecha', gravedad: 'BAJA',
  js: `var camp = __R.campaniaActiva();
       var nuevo = App.motor.crearProspecto({ nombre: 'REDTEAM fecha participación' });
       var r = App.motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: nuevo.prospecto.id, fechaRegistro: '2027-02-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = r.participacion || {};
       return { veredicto: (r.ok && p.fechaRegistro === '2027-02-31') ? 'HUECO' : 'CANDADO OK',
                detalle: 'ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · fechaRegistro guardada=' + JSON.stringify(p.fechaRegistro) };`
});

await A({
  id: 'F-15', nombre: 'Prospecto con fechaEvento imposible (2027-13-01) desde el motor de campañas', dato: 'fechaEvento=2027-13-01',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var r = App.motor.crearProspecto({ nombre: 'REDTEAM mes 13', fechaEvento: '2027-13-01', fechaNacimiento: '0000-00-00' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM mes 13'; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: p ? ('guardado con fechaEvento=' + JSON.stringify(p.fechaEvento) + ' fechaNacimiento=' + JSON.stringify(p.fechaNacimiento)) : 'no se creó' };`
});

const res = await guardar(caja, '02-fechas');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO ? 1 : 0;
