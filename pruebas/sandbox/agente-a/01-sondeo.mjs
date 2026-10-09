/* 01-sondeo.mjs — sondea incógnitas del arnés antes de atacar en serio. */
import { abrirCaja } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Sondeo' });
const s = caja.s;
const ev = (js) => s.evaluar(`(async function(){ try { ${js} } catch(e){ return 'EXC: ' + (e && e.message); } })()`);

console.log('== Motor de campañas vs arreglos globales ==');
console.log(JSON.stringify(await ev(`
  var antes = campanias.length;
  var c = App.motor.crearCampania({ nombre: 'Sondeo fechas', tipo: 'captacion', fechaInicio: '2027-12-31', fechaFin: '2027-01-01' });
  var enGlobal = campanias.some(function(x){ return x.id === c.id; });
  var enAlmacen = !!App.almacen.campania(c.id);
  var p0 = participaciones.length;
  var r = App.motor.agregarParticipacion({ campaniaId: c.id, prospectoId: prospectos[0].id, fechaRegistro: '2027-02-31' });
  return { campaniasAntes: antes, campaniasDespues: campanias.length, enGlobal: enGlobal, enAlmacen: enAlmacen,
           estado: c.estado, fechas: c.fechaInicio + ' → ' + c.fechaFin,
           participacion: r.ok, participacionesDespues: participaciones.length, enGlobalParticipacion: participaciones.some(function(x){return x.id === (r.participacion||{}).id;}) };
`), null, 1));

console.log('== Persistencia (IndexedDB) ==');
console.log(JSON.stringify(await ev(`
  var alm = { listo: (typeof almacenListo !== 'undefined') ? almacenListo : null, fallback: (typeof almacenFallback !== 'undefined') ? almacenFallback : null };
  var nuevo = { id: 'pro_sonda_persist', nombre: 'Sonda persistencia', telefono: '8780000000', email: '', faseActual: 'Interesado', historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: obtenerFechaActual() };
  prospectos.push(nuevo);
  var guardado = await guardarDatos();
  var enMemoria = prospectos.filter(function(p){return p.id==='pro_sonda_persist';}).length;
  // simular recarga: volver a leer del almacén
  await cargarDatosLocal();
  var trasRecarga = prospectos.filter(function(p){return p.id==='pro_sonda_persist';}).length;
  prospectos = prospectos.filter(function(p){return p.id!=='pro_sonda_persist';});
  await guardarDatos();
  return { almacen: alm, guardado: guardado, enMemoria: enMemoria, trasRecarga: trasRecarga };
`), null, 1));

console.log('== Modal de confirmación financiera ==');
console.log(JSON.stringify(await ev(`
  var cl = clientes[0], pq = paquetes[0];
  __R.contrato({ clienteId: cl.id, festejado: 'Sonda Contrato', tipo: 'paquete', paqueteId: pq.id, fechaEvento: '2027-06-15', estado: 'Pendiente' });
  await new Promise(function(r){ setTimeout(r, 400); });
  var co = clientes[0].contratos[0];
  var tot = calcularTotalesContrato(co);
  // pago mayor al saldo
  var res = __R.pagoEnFormulario(999999);
  await new Promise(function(r){ setTimeout(r, 200); });
  var boton = !!document.getElementById('btn-confirmar-financiero');
  var abierto = document.getElementById('modal').classList.contains('active');
  if (boton) document.getElementById('btn-confirmar-financiero').click();
  await new Promise(function(r){ setTimeout(r, 300); });
  var co2 = clientes[0].contratos[0];
  var tot2 = calcularTotalesContrato(co2);
  return { contratoId: co.id, precioFinalBase: co.precioFinal, totalAPagar: tot.totalAPagar, saldo: tot.saldoBruto,
           botonConfirmar: boton, modalAbierto: abierto, pagosTrasConfirmar: (co2.pagos||[]).length, totalPagos: tot2.totalPagos,
           notis: __R.textoNotis() };
`), null, 1));

console.log('== Anulación de pago y persistencia ==');
console.log(JSON.stringify(await ev(`
  var cl = clientes[0], co = cl.contratos[0];
  var pago = (co.pagos||[])[0];
  editarContrato(cl.id, co.id);
  await new Promise(function(r){ setTimeout(r, 200); });
  var hayFn = typeof (window.PDA && window.PDA.eliminarMovimientoContrato);
  var totAntes = calcularTotalesContrato(clientes[0].contratos[0]);
  window.PDA.eliminarMovimientoContrato('pago', pago.id);
  await new Promise(function(r){ setTimeout(r, 150); });
  document.getElementById('motivo-anulacion').value = 'prueba de anulación agente A';
  document.getElementById('btn-confirmar-anulacion').click();
  await new Promise(function(r){ setTimeout(r, 400); });
  var totDespues = calcularTotalesContrato(clientes[0].contratos[0]);
  var enMemoriaEliminado = (clientes[0].contratos[0].pagos||[]).filter(function(p){return p.id===pago.id;})[0].eliminado;
  var notas = (clientes[0].contratos[0].pagos||[]).filter(function(p){return p.esNotaEliminacion;}).length;
  await cargarDatosLocal();
  var trasRecarga = (clientes[0].contratos[0].pagos||[]).filter(function(p){return p.id===pago.id;})[0];
  return { hayFn: hayFn, pagosAntes: totAntes.totalPagos, pagosDespues: totDespues.totalPagos,
           enMemoriaEliminado: enMemoriaEliminado, notasAnulacion: notas,
           trasRecargaEliminado: trasRecarga ? trasRecarga.eliminado : 'no-existe',
           trasRecargaNotas: (clientes[0].contratos[0].pagos||[]).filter(function(p){return p.esNotaEliminacion;}).length };
`), null, 1));

console.log('== Importador: ¿inyecta HTML sin sanear? ==');
console.log(JSON.stringify(await ev(`
  var texto = 'Nombre\\tTelefono\\tEmail\\n<img src=x onerror="window.__A.xss=1">\\t8781234567\\timg@correo.com\\n<div onclick="window.__A.xss2=1">TOCA</div>\\t8787654321\\tdiv@correo.com';
  var a = window.ImportarProspectos.analizarTexto(texto, 'sondeo.csv');
  var antes = prospectos.length;
  var r = window.ImportarProspectos.importar(a.analisis.nuevas);
  var guardados = prospectos.filter(function(p){ return p.nombre.indexOf('<') !== -1; }).map(function(p){ return p.nombre; });
  // ver la vista de lista (donde renderizarProspectos NO escapa)
  guardarVista('prospectos', 'lista');
  renderizarProspectos();
  await new Promise(function(res){ setTimeout(res, 500); });
  var cont = document.getElementById('lista-prospectos');
  var imgInyectado = !!cont.querySelector('img[src="x"]');
  var divInyectado = cont.querySelectorAll('div[onclick]').length;
  var xss = window.__A.xss || 0;
  return { nuevas: a.analisis.nuevas.length, creados: r.creados.length, prospectosAntes: antes, prospectosDespues: prospectos.length,
           guardadosSinSanear: guardados, imgInyectado: imgInyectado, divOnclickInyectado: divInyectado, xssEjecutado: xss };
`), null, 1));

console.log('== window.open disponible para WhatsApp ==');
console.log(JSON.stringify(await ev(`return { open: typeof window.open, wa: typeof window.open === 'function' };`), null, 1));

await s.cerrar();
