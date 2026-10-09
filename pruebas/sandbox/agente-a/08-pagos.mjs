/* 08-pagos.mjs — FAMILIA 7: PAGOS Y CARGOS (lo más importante para Jorge). */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Pagos y cargos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const cli3 = caja.base.clientes[2].id;
const paq = caja.base.paquetes[0].id;

/* Contrato base limpio para la familia (paquete de $25,000) */
const BASE = await A({
  id: 'G-00', nombre: 'Base: contrato limpio de $25,000 sin pagos', dato: 'paquete de $25,000',
  esperado: 'contrato listo', gravedad: 'BAJA', espera: 700,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'Festejada Pagos', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-01-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Pagos'; })[0];
       window.__co = co.id;
       var t = calcularTotalesContrato(co);
       return { veredicto: co ? 'CANDADO OK' : 'ROTO', detalle: 'contratoId=' + co.id + ' totalAPagar=' + t.totalAPagar + ' saldo=' + t.saldoBruto };`
});
const CO = BASE.crudo.coId || (BASE.crudo && BASE.crudo.contratoId);
const contratoId = await caja.s.evaluar('window.__co');

await A({
  id: 'G-01', nombre: 'Pago MAYOR al saldo del contrato ($99,999 sobre un saldo de $25,000)', dato: 'pago-rapido-monto = 99999',
  esperado: 'advertencia explícita y confirmación', gravedad: 'ALTA', espera: 900,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       var t0 = calcularTotalesContrato(co);
       __R.pagoRapido('${cli}', '${contratoId}', 99999, 'pago excedido', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); });
       var avisosModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim();
       var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
       if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
       await new Promise(function(x){ setTimeout(x, 600); });
       cerrarModal();
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       var t = calcularTotalesContrato(co2);
       var pago = (co2.pagos || [])[0] || {};
       var historialAlertas = (historial || []).filter(function(h){ return h && String(h.descripcion || '').indexOf('CONFIRMADO CON AVISO') !== -1; }).length;
       return { veredicto: hayConfirmar ? 'CANDADO OK' : 'HUECO',
                detalle: 'saldo antes=$' + t0.saldoBruto + ' · se pidió confirmación=' + hayConfirmar + ' · el modal decía: "' + avisosModal.slice(0, 230) + '" · quedó pagos=' + t.cantidadPagos + ' totalPagos=$' + t.totalPagos + ' saldo=$' + t.saldoBruto + ' · aceitadoConAviso=' + pago.aceptadoConAviso + ' · registros "CONFIRMADO CON AVISO" en el historial=' + historialAlertas + ' · alertas=' + JSON.stringify(t.alertas.map(function(a){ return a.tipo; })) };`
});

await A({
  id: 'G-02', nombre: 'Pago NEGATIVO', dato: 'pago-rapido-monto = -500',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var n0 = (clientes.filter(function(x){return x.id==='${cli}';})[0].contratos.filter(function(x){return x.id==='${contratoId}';})[0].pagos || []).length;
       var r = __R.pagoRapido('${cli}', '${contratoId}', -500, 'negativo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       var t = calcularTotalesContrato(co);
       return { veredicto: (co.pagos || []).length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'el input numérico dejó ' + JSON.stringify(r.montoAceptadoPorInput) + ' · pagos ' + n0 + ' → ' + (co.pagos || []).length + ' · totalPagos=$' + t.totalPagos + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'G-03', nombre: 'Pago en CERO', dato: 'pago-rapido-monto = 0',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = (clientes.filter(function(x){return x.id==='${cli}';})[0].contratos.filter(function(x){return x.id==='${contratoId}';})[0].pagos || []).length;
       __R.pagoRapido('${cli}', '${contratoId}', 0, 'cero', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       return { veredicto: (co.pagos || []).length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'pagos ' + n0 + ' → ' + (co.pagos || []).length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

for (const [id, etiqueta, valor] of [['G-04', 'con letras ("mil")', 'mil'], ['G-05', 'con formato "1,000.50"', '1,000.50'], ['G-06', 'con formato "1.000,50"', '1.000,50']]) {
  await A({
    id, nombre: 'Pago ' + etiqueta, dato: 'pago-rapido-monto = ' + JSON.stringify(valor),
    esperado: 'rechazo', gravedad: 'MEDIA',
    js: `var c0 = clientes.filter(function(x){return x.id==='${cli}';})[0].contratos.filter(function(x){return x.id==='${contratoId}';})[0];
         var n0 = (c0.pagos || []).length;
         var r = __R.pagoRapido('${cli}', '${contratoId}', ${JSON.stringify(valor)}, 'texto', 'dispatch');
         await new Promise(function(x){ setTimeout(x, 350); });
         var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
         var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
         return { veredicto: (co.pagos || []).length > n0 ? 'HUECO' : 'CANDADO OK',
                  detalle: 'el input numérico dejó ' + JSON.stringify(r.montoAceptadoPorInput) + ' · pagos ' + n0 + ' → ' + (co.pagos || []).length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

await A({
  id: 'G-07', nombre: 'Dos pagos IDÉNTICOS seguidos (doble clic en «Registrar»)', dato: 'dos form-pago-rapido submit con $1,000 en el mismo tick',
  esperado: 'un solo pago (o confirmación explícita)', gravedad: 'ALTA', espera: 900,
  js: `var c0 = clientes.filter(function(x){return x.id==='${cli}';})[0].contratos.filter(function(x){return x.id==='${contratoId}';})[0];
       var n0 = (c0.pagos || []).length;
       __R.pagoRapido('${cli}', '${contratoId}', 1000, 'doble clic', 'dispatch');
       __R.reenviar('form-pago-rapido', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       var creados = (co.pagos || []).length - n0;
       var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
       var t = calcularTotalesContrato(co);
       return { veredicto: creados > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'pagos creados = ' + creados + ' (' + n0 + ' → ' + (co.pagos || []).length + ') · quedó un modal de confirmación abierto=' + hayConfirmar + ' · totalPagos=$' + t.totalPagos + ' · alertas=' + JSON.stringify(t.alertas.map(function(a){ return a.tipo; })) + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'G-08', nombre: 'Segundo pago por el mismo monto, con calma (dos registros reales)', dato: 'dos pagos de $1,000 en acciones separadas',
  esperado: 'aviso y confirmación explícita', gravedad: 'MEDIA', espera: 900,
  js: `cerrarModal();
       var c0 = clientes.filter(function(x){return x.id==='${cli}';})[0].contratos.filter(function(x){return x.id==='${contratoId}';})[0];
       var n0 = (c0.pagos || []).length;
       __R.pagoRapido('${cli}', '${contratoId}', 1000, 'segundo igual', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var avisosModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim();
       var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
       if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
       await new Promise(function(x){ setTimeout(x, 500); });
       cerrarModal();
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${contratoId}'; })[0];
       return { veredicto: hayConfirmar ? 'CANDADO OK' : 'HUECO',
                detalle: 'pagos ' + n0 + ' → ' + (co.pagos || []).length + ' · pidió confirmación=' + hayConfirmar + ' · el modal decía: "' + avisosModal.slice(0, 180) + '"' };`
});

await A({
  id: 'G-09', nombre: 'Cargo extra SIN descripción', dato: 'cargo-descripcion = "", cargo-monto = 1500',
  esperado: 'rechazo', gravedad: 'MEDIA', espera: 800,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Cargos', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-02-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var r = __R.cargoEnFormulario('', 1500);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Cargos'; })[0];
       var cargos = co ? (co.cargos || []).length : -1;
       return { veredicto: cargos > 0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'cargos guardados = ' + cargos + ' · monto aceptado por el input = ' + JSON.stringify(r.montoAceptado) + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'G-10', nombre: 'Cargo extra NEGATIVO', dato: 'cargo-monto = -800',
  esperado: 'rechazo', gravedad: 'MEDIA', espera: 700,
  js: `var r = __R.cargoEnFormulario('cargo negativo', -800);
       await new Promise(function(x){ setTimeout(x, 300); });
       var avisos = __R.textoNotis();
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Cargos'; })[0];
       var negativos = (co.cargos || []).filter(function(x){ return Number(x.monto) < 0; }).length;
       return { veredicto: negativos ? 'HUECO' : 'CANDADO OK',
                detalle: 'monto aceptado por el input = ' + JSON.stringify(r.montoAceptado) + ' · cargos negativos en el formulario = ' + negativos + ' · app: ' + JSON.stringify(avisos) };`
});

await A({
  id: 'G-11', nombre: 'Anular un pago con el CLIC REAL y ver si se guarda y si cuadra', dato: 'botón de basura del pago de $5,000 (contrato con $5,000 + $3,000)',
  esperado: 'la anulación debe persistir y quedar auditada', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli3}', festejado: 'Festejada Anulación', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-03-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli3}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Anulación'; })[0];
       var coId = co.id;
       __R.pagoRapido('${cli3}', coId, 5000, 'anticipo A', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); }); cerrarModal();
       __R.pagoRapido('${cli3}', coId, 3000, 'anticipo B', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); }); cerrarModal();
       var cA = clientes.filter(function(x){ return x.id === '${cli3}'; })[0];
       var coA = cA.contratos.filter(function(x){ return x.id === coId; })[0];
       var tAntes = calcularTotalesContrato(coA);
       window.__A.errores = [];
       var r = __R.anularPorBoton('${cli3}', coId, 'pago', 0, 'pago duplicado de prueba');
       await new Promise(function(x){ setTimeout(x, 700); });
       var cB = clientes.filter(function(x){ return x.id === '${cli3}'; })[0];
       var coB = cB.contratos.filter(function(x){ return x.id === coId; })[0];
       var tDespues = calcularTotalesContrato(coB);
       var memEliminados = (coB.pagos || []).filter(function(p){ return p.eliminado; }).length;
       var memNotas = (coB.pagos || []).filter(function(p){ return p.esNotaEliminacion; }).length;
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 400); });
       var cC = clientes.filter(function(x){ return x.id === '${cli3}'; })[0];
       var coC = cC.contratos.filter(function(x){ return x.id === coId; })[0];
       var tTras = calcularTotalesContrato(coC);
       var discoEliminados = (coC.pagos || []).filter(function(p){ return p.eliminado; }).length;
       var discoNotas = (coC.pagos || []).filter(function(p){ return p.esNotaEliminacion; }).length;
       return { veredicto: (discoEliminados > 0 && discoNotas > 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'botones de anular en el listado=' + r.botones + ' · el formulario del contrato seguía existiendo al confirmar=' + r.formContratoAntesDeConfirmar +
                         ' · después de confirmar: formulario=' + r.formContratoDespuesDeConfirmar + ', modal abierto=' + r.modalSigueAbierto +
                         ' ||| EN MEMORIA: totalPagos $' + tAntes.totalPagos + ' → $' + tDespues.totalPagos + ', pagos marcados eliminados=' + memEliminados + ', notas de anulación=' + memNotas +
                         ' ||| TRAS RECARGAR DEL ALMACÉN: totalPagos $' + tTras.totalPagos + ', pagos eliminados=' + discoEliminados + ', notas de anulación=' + discoNotas +
                         ' ||| excepciones de la página: ' + JSON.stringify(r.errores) + ' ||| avisos de la app: ' + JSON.stringify(r.notis) };`
});

await A({
  id: 'G-12', nombre: 'Pago agregado en el formulario y modal cerrado sin «Guardar Contrato»', dato: 'btn-agregar-pago con $2,000 y luego cerrar',
  esperado: 'no debería decir «Pago agregado» si no se guardó', gravedad: 'MEDIA', espera: 900,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Pago Sin Guardar', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-04-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Pago Sin Guardar'; })[0];
       var coId = co.id;
       var n0 = (co.pagos || []).length;
       __R.pagoEnFormulario(2000);
       await new Promise(function(x){ setTimeout(x, 300); });
       var avisos = __R.textoNotis();
       cerrarModal();
       await new Promise(function(x){ setTimeout(x, 400); });
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 300); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === coId; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: (co2.pagos || []).length === n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'pagos antes=' + n0 + ' después de cerrar y recargar=' + (co2.pagos || []).length + ' · totalPagos=$' + t.totalPagos + ' · la app dijo al agregarlo: ' + JSON.stringify(avisos) + ' (dice que se agregó, pero no se guarda hasta pulsar «Guardar Contrato»)' };`
});

await A({
  id: 'G-13', nombre: 'Cargo extra con monto absurdo ($9,999,999 sobre un contrato de $25,000)', dato: 'cargo-monto = 9999999',
  esperado: 'advertencia explícita', gravedad: 'MEDIA', espera: 900,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Cargo Bruto', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-05-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       __R.cargoEnFormulario('cargo absurdo', 9999999);
       await new Promise(function(x){ setTimeout(x, 350); });
       var avisosModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim();
       var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
       if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
       await new Promise(function(x){ setTimeout(x, 400); });
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Cargo Bruto'; })[0];
       var t = co ? calcularTotalesContrato(co) : null;
       return { veredicto: hayConfirmar ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hayConfirmar + ' · el modal decía: "' + avisosModal.slice(0, 220) + '" · cargos guardados=' + (co ? (co.cargos||[]).length : -1) + ' · totalAPagar=$' + (t ? t.totalAPagar : 'n/a') + ' · alertas=' + JSON.stringify(t ? t.alertas.map(function(a){ return a.tipo; }) : []) };`
});

await A({
  id: 'G-15', nombre: 'Anular un CARGO con el clic real (misma ruta que el pago)', dato: 'botón de basura del cargo extra de $1,500',
  esperado: 'persistir y avisar', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Cargo Anular', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-06-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Cargo Anular'; }).slice(-1)[0];
       var coId = co.id;
       // Se abre la EDICIÓN real de ese contrato y se agrega el cargo ahí dentro.
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.cargoEnFormulario('cargo a anular', 1500);
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c1 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co1 = c1.contratos.filter(function(x){ return x.id === coId; })[0];
       var cargosAntes = (co1.cargos || []).length;
       var tAntes = calcularTotalesContrato(co1);
       window.__A.errores = [];
       var r = __R.anularPorBoton('${cli2}', coId, 'cargo', 0, 'cargo mal capturado');
       await new Promise(function(x){ setTimeout(x, 700); });
       var cB = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var coB = cB.contratos.filter(function(x){ return x.id === coId; })[0];
       var memEliminados = (coB.cargos || []).filter(function(x){ return x.eliminado; }).length;
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 400); });
       var cC = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var coC = cC.contratos.filter(function(x){ return x.id === coId; })[0];
       var tTras = calcularTotalesContrato(coC);
       var discoEliminados = (coC.cargos || []).filter(function(x){ return x.eliminado; }).length;
       return { veredicto: discoEliminados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: 'cargos antes=' + cargosAntes + ' (botones de anular=' + r.botones + ') · totalAPagar $' + tAntes.totalAPagar + ' → en memoria $' + calcularTotalesContrato(coB).totalAPagar + ' (eliminados en memoria=' + memEliminados + ') → tras recargar $' + tTras.totalAPagar + ' (eliminados en disco=' + discoEliminados + ') · excepciones: ' + JSON.stringify(r.errores) + ' · avisos: ' + JSON.stringify(r.notis) };`
});

await A({
  id: 'G-16', nombre: 'Confirmar un cargo por encima del límite y ver si sobrevive al guardado', dato: 'cargo de $9,999,999 confirmado en el aviso y luego «Guardar Contrato»',
  esperado: 'el cargo debe quedar guardado tras confirmarlo', gravedad: 'ALTA', espera: 1500,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'Festejada Cargo Limite', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-07-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c0 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co0 = c0.contratos.filter(function(x){ return x.festejado === 'Festejada Cargo Limite'; }).slice(-1)[0];
       var coId = co0.id;
       var cargosBase = (co0.cargos || []).length;
       __R.editarContrato('${cli}', coId, {});
       await new Promise(function(x){ setTimeout(x, 250); });
       window.__A.errores = [];
       __R.cargoEnFormulario('cargo gigante', 9999999);
       await new Promise(function(x){ setTimeout(x, 350); });
       var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
       var avisosModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim();
       if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
       await new Promise(function(x){ setTimeout(x, 400); });
       var formVivo = !!document.getElementById('form-contrato');
       var errTrasConfirmar = (window.__A.errores || []).slice();
       var envio = __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 300); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === coId; })[0];
       var cargos = (co.cargos || []).length;
       return { veredicto: (hayConfirmar && cargos === cargosBase) ? 'ROTO' : (hayConfirmar ? 'CANDADO OK' : 'HUECO'),
                detalle: 'se pidió confirmación=' + hayConfirmar + ' · el aviso decía: "' + avisosModal.slice(0, 170) + '" · tras confirmar, el formulario del contrato seguía vivo=' + formVivo + ' (abrirModal lo borró) · excepciones tras confirmar: ' + JSON.stringify(errTrasConfirmar) +
                         ' · envío posterior: ' + envio + ' · cargos en el contrato: ' + cargosBase + ' antes → ' + cargos + ' después (el cargo confirmado se PERDIÓ y el formulario quedó inutilizable) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'G-14', nombre: 'Pago con fecha inválida o futura (¿existe el campo?)', dato: 'no hay campo de fecha en el pago',
  esperado: 'no aplica', gravedad: 'BAJA',
  js: `return { veredicto: 'CANDADO OK',
                detalle: 'NO PROBADO COMO ATAQUE: ni el pago rápido ni el pago dentro del contrato tienen campo de fecha. La app pone fecha = ahora (crearMovimientoFinanciero). Comprobación: el formulario de pago rápido solo tiene pago-rapido-monto y pago-rapido-nota; el del contrato, contrato-nuevo-pago. Por eso no se puede capturar una fecha de pago anterior al contrato desde la interfaz.' };`
});

const res = await guardar(caja, '08-pagos');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
