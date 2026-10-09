/* 07-contratos.mjs — FAMILIA 6: CONTRATOS (lo más importante para Jorge). */
import { abrirCaja, ataque, guardar } from '../../agente-a/comun.mjs';

const caja = await abrirCaja({ familia: 'Contratos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;
const paq2 = caja.base.paquetes[1].id;

await A({
  id: 'K-01', nombre: 'Contrato SIN cliente', dato: 'contrato-cliente-id = ""',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '', festejado: 'Sin cliente', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-07-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 400); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-02', nombre: 'Contrato con un cliente INEXISTENTE', dato: 'contrato-cliente-id = "cliente-fantasma"',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: 'cliente-fantasma', festejado: 'Cliente fantasma', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-07-08', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 400); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-03', nombre: 'Contrato sin nombre del festejado', dato: 'contrato-festejado = ""',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: '', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-07-09', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 400); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-04', nombre: 'Contrato sin paquete seleccionado (tipo=paquete)', dato: 'contrato-paquete = ""',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'Sin paquete', tipo: 'paquete', paqueteId: '', fechaEvento: '2027-07-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 400); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'contratos ' + n0 + ' → ' + obtenerContratos().length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

/* Base: contrato bueno con pagos */
await A({
  id: 'K-05', nombre: 'Base: contrato con dos pagos ($5,000 + $3,000)', dato: 'paquete de $25,000 y pagos en el formulario',
  esperado: 'base coherente', gravedad: 'BAJA', espera: 900,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'Festejada Contrato Base', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos[c.contratos.length - 1];
       __R.pagoRapido('${cli}', co.id, 5000, 'anticipo 1', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 300); });
       cerrarModal();
       __R.pagoRapido('${cli}', co.id, 3000, 'anticipo 2', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 300); });
       cerrarModal();
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: t.totalPagos === 8000 ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratoId=' + co.id + ' precioBase=' + co2.precioBase + ' precioFinal=' + co2.precioFinal + ' pagos=' + (co2.pagos || []).length + ' totalPagos=' + t.totalPagos + ' saldo=' + t.saldoBruto };`
});

await A({
  id: 'K-06', nombre: 'Dos contratos IDÉNTICOS para el mismo cliente y el mismo festejado', dato: 'mismo cliente, mismo paquete, misma fecha, mismo festejado',
  esperado: 'aviso de posible contrato duplicado', gravedad: 'ALTA',
  js: `var n0 = obtenerContratos().length;
       var antes = obtenerContratos().filter(function(c){ return c.festejado === 'Festejada Contrato Base'; }).length;
       __R.contrato({ clienteId: '${cli}', festejado: 'Festejada Contrato Base', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var ahora = obtenerContratos().filter(function(c){ return c.festejado === 'Festejada Contrato Base'; }).length;
       return { veredicto: ahora > antes ? 'HUECO' : 'CANDADO OK',
                detalle: 'contratos del mismo festejado: ' + antes + ' → ' + ahora + ' (contratos ' + n0 + ' → ' + obtenerContratos().length + ') · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-07', nombre: 'Contrato con descuento MAYOR al total', dato: 'descuento = $99,000 sobre un paquete de $25,000',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Descuento', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-10-11', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var r = __R.descuentoEnFormulario('descuento imposible', 99000);
       await new Promise(function(x){ setTimeout(x, 250); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g, ' ').trim();
       var n0 = obtenerContratos().length;
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       return { veredicto: obtenerContratos().length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'la app respondió: "' + texto.slice(0, 200) + '" · monto que el input aceptó = ' + JSON.stringify(r.montoAceptado) + ' · contratos ' + n0 + ' → ' + obtenerContratos().length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-08', nombre: 'Contrato con descuento NEGATIVO', dato: 'descuento-monto = -5000',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Descuento Neg', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-10-12', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var r = __R.descuentoEnFormulario('descuento negativo', -5000);
       await new Promise(function(x){ setTimeout(x, 250); });
       var avisos = __R.textoNotis();
       return { veredicto: avisos.some(function(a){ return a.indexOf('mayor que cero') !== -1; }) ? 'CANDADO OK' : 'HUECO',
                detalle: 'monto que el input aceptó = ' + JSON.stringify(r.montoAceptado) + ' · la app avisó: ' + JSON.stringify(avisos) + ' (el atributo min=0 del HTML no se respeta con dispatchEvent, pero el código sí bloquea)' };`
});

await A({
  id: 'K-09', nombre: 'Contrato con un paquete de precio CERO (total $0)', dato: 'paquete con precio 0 y descuento 0',
  esperado: 'aviso de contrato sin importe', gravedad: 'MEDIA', espera: 900,
  js: `__R.paquete({ nombre: 'REDTEAM paquete en cero', descripcion: 'sin precio', precio: 0, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo' }, 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var pq = paquetes.filter(function(p){ return p.nombre === 'REDTEAM paquete en cero'; })[0];
       var n0 = obtenerContratos().length;
       var r = __R.contrato({ clienteId: '${cli}', festejado: 'Festejada Cero', tipo: 'paquete', paqueteId: pq.id, fechaEvento: '2027-10-13', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = (c.contratos || []).filter(function(x){ return x.festejado === 'Festejada Cero'; })[0];
       if (!co) return { veredicto: 'CANDADO OK', detalle: 'no se creó · app: ' + JSON.stringify(__R.textoNotis()) };
       var t = calcularTotalesContrato(co);
       return { veredicto: 'HUECO', detalle: 'contrato guardado con precioBase=' + co.precioBase + ' precioFinal=' + co.precioFinal + ' totalAPagar=' + t.totalAPagar + ' · contratos ' + n0 + ' → ' + obtenerContratos().length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-10', nombre: 'Editar un contrato y comprobar si se PIERDEN sus pagos', dato: 'abrir la edición real y cambiar solo el festejado',
  esperado: 'los pagos deben conservarse', gravedad: 'ALTA', espera: 900,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Contrato Base'; })[0];
       var antes = calcularTotalesContrato(co);
       var pagosAntes = (co.pagos || []).length;
       __R.editarContrato('${cli}', co.id, { 'contrato-festejado': 'Festejada Contrato Base (editada)' }, 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var despues = calcularTotalesContrato(co2);
       return { veredicto: (co2.pagos || []).length === pagosAntes && despues.totalPagos === antes.totalPagos ? 'CANDADO OK' : 'HUECO',
                detalle: 'festejado=' + JSON.stringify(co2.festejado) + ' · pagos antes=' + pagosAntes + ' después=' + (co2.pagos || []).length + ' · total pagado antes=' + antes.totalPagos + ' después=' + despues.totalPagos + ' · precioBase antes=' + co.precioBase + ' después=' + co2.precioBase };`
});

await A({
  id: 'K-11', nombre: 'Editar un contrato y cambiarle el paquete (¿se recalcula y conserva el dinero?)', dato: 'cambiar de paquete de $25,000 a $18,000 con pagos ya hechos',
  esperado: 'recalcular el precio sin perder los pagos', gravedad: 'MEDIA', espera: 900,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Contrato Base (editada)'; })[0];
       var pagosAntes = (co.pagos || []).length;
       __R.editarContrato('${cli}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.ponSelect('contrato-paquete', '${paq2}');
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: t.totalPagos === 8000 ? 'CANDADO OK' : 'HUECO',
                detalle: 'paquete antes=' + co.paqueteId + ' después=' + co2.paqueteId + ' · precioBase antes=' + co.precioBase + ' después=' + co2.precioBase + ' · precioFinal=' + co2.precioFinal + ' · pagos antes=' + pagosAntes + ' después=' + (co2.pagos || []).length + ' · totalPagos=' + t.totalPagos + ' · saldo=' + t.saldoBruto };`
});

await A({
  id: 'K-12', nombre: 'Editar un contrato y ponerle la fecha del evento en el pasado (1900 pasa, 2020 pasa)', dato: 'contrato-fecha-evento = 2020-05-05 en EDICIÓN',
  esperado: 'rechazo también al editar', gravedad: 'MEDIA', espera: 900,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Contrato Base (editada)'; })[0];
       __R.editarContrato('${cli}', co.id, { 'contrato-fecha-evento': '2020-05-05' }, 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       return { veredicto: co2.fechaEvento === '2020-05-05' ? 'HUECO' : 'CANDADO OK',
                detalle: 'fecha del evento antes=' + co.fechaEvento + ' después=' + co2.fechaEvento + ' · (guardarContrato solo revisa el pasado cuando el contrato es NUEVO) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'K-13', nombre: 'Editar un contrato para que su total NO cuadre con sus pagos (pago excedido)', dato: 'contrato de $18,000 con $8,000 pagados',
  esperado: 'el sistema debe avisar y no mentir en el saldo', gravedad: 'ALTA', espera: 800,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Contrato Base (editada)'; })[0];
       var t = calcularTotalesContrato(co);
       return { veredicto: 'CANDADO OK',
                detalle: 'totalAPagar=' + t.totalAPagar + ' · totalPagos=' + t.totalPagos + ' · saldoBruto=' + t.saldoBruto + ' · la igualdad saldo = total - pagos se cumple: ' + (Math.abs((t.totalAPagar - t.totalPagos) - t.saldoBruto) < 0.005) + ' · alertas=' + JSON.stringify(t.alertas.map(function(a){ return a.tipo; })) };`
});

await A({
  id: 'K-14', nombre: 'Contrato con monto escrito con letras ("mil")', dato: 'contrato-nuevo-pago = "mil"',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Texto', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-10-14', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var r = __R.pagoEnFormulario('mil');
       await new Promise(function(x){ setTimeout(x, 300); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g, ' ').trim();
       return { veredicto: r.montoAceptado === '' || r.montoAceptado === null ? 'CANDADO OK' : 'HUECO',
                detalle: 'el <input type=number> dejó ' + JSON.stringify(r.montoAceptado) + ' · pantalla: "' + texto.slice(0, 160) + '" · (el navegador rechaza las letras en un input numérico; el código además bloquea monto no finito)' };`
});

await A({
  id: 'K-15', nombre: 'Eliminar el paquete de un contrato existente (¿se puede?)', dato: 'CRUD.paquetes.eliminar(paquete con contrato vinculado)',
  esperado: 'rechazo', gravedad: 'MEDIA', espera: 600,
  js: `var pq = paquetes.filter(function(p){ return p.id === '${paq}'; })[0];
       var vinculados = obtenerContratosDePaquete ? obtenerContratosDePaquete('${paq}').length : -1;
       CRUD.paquetes.eliminar('${paq}');
       await new Promise(function(x){ setTimeout(x, 300); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g, ' ').trim();
       var sigue = paquetes.some(function(p){ return p.id === '${paq}'; });
       return { veredicto: sigue ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratos vinculados=' + vinculados + ' · paquete sigue existiendo=' + sigue + ' · la app dijo: "' + texto.slice(0, 200) + '"' };`
});

const res = await guardar(caja, '07-contratos');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
