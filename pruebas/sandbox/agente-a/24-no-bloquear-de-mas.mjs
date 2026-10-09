/* 24-no-bloquear-de-mas.mjs — SEGUNDA PASADA: lo que un practicante DEBE poder seguir haciendo.
   Ejecutar: node pruebas\sandbox\agente-a\24-no-bloquear-de-mas.mjs
   Un EXCESO aquí es un hallazgo: el candado dejó sin trabajo al practicante. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'No bloquear de mas' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'N-01', nombre: 'Prospecto SIN teléfono (el campo es opcional)', dato: 'prospecto-telefono = ""',
  esperado: 'guardar', gravedad: 'ALTA',
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM sin telefono', telefono: '', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM sin telefono'; })[0];
       return { veredicto: p ? 'CANDADO OK' : 'EXCESO', detalle: 'guardado=' + !!p + ' (prospectos ' + n0 + ' → ' + prospectos.length + ') · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-02', nombre: 'Prospecto con teléfono escrito con guiones (formato legítimo)', dato: 'prospecto-telefono = "878-123-4567"',
  esperado: 'guardar conservando el formato', gravedad: 'ALTA',
  js: `__R.prospecto({ nombre: 'REDTEAM guiones', telefono: '878-123-4567', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM guiones'; })[0];
       return { veredicto: (p && p.telefono === '878-123-4567') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'guardado=' + !!p + ' · teléfono=' + JSON.stringify(p ? p.telefono : null) + ' · WhatsApp usaría ' + JSON.stringify(p ? normalizarTelefonoWhatsApp(p.telefono) : null) };`
});

await A({
  id: 'N-03', nombre: 'Dos clientes con el MISMO nombre, CONFIRMANDO el aviso', dato: 'mismo nombre «REDTEAM mismo nombre» dos veces, el 2º confirmado',
  esperado: 'el segundo se guarda', gravedad: 'ALTA', espera: 1500,
  js: `__R.cliente({ nombre: 'REDTEAM mismo nombre', telefono: '8781260001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.cliente({ nombre: 'REDTEAM mismo nombre', telefono: '8781260002', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var cuantos = clientes.filter(function(x){ return x.nombre === 'REDTEAM mismo nombre'; }).length;
       return { veredicto: (aviso && cuantos === 2) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · clientes con ese nombre=' + cuantos + ' (deben ser 2) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-04', nombre: 'Tarea repetida CONFIRMANDO el aviso', dato: 'misma tarea dos veces, la 2ª confirmada',
  esperado: 'la segunda se guarda', gravedad: 'ALTA', espera: 1500,
  js: `__R.tarea({ tipo: 'Visita', fecha: '2029-09-09', descripcion: 'REDTEAM tarea repetida ok', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.tarea({ tipo: 'Visita', fecha: '2029-09-09', descripcion: 'REDTEAM tarea repetida ok', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var cuantas = tareas.filter(function(x){ return x.descripcion === 'REDTEAM tarea repetida ok'; }).length;
       return { veredicto: (aviso && cuantas === 2) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · tareas iguales=' + cuantas + ' (deben ser 2) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-05', nombre: 'Prospecto duplicado CONFIRMANDO el aviso', dato: 'mismo nombre y teléfono, el 2º confirmado',
  esperado: 'el segundo se guarda', gravedad: 'ALTA', espera: 1500,
  js: `__R.prospecto({ nombre: 'REDTEAM duplicado ok', telefono: '8781270001', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.prospecto({ nombre: 'REDTEAM duplicado ok', telefono: '8781270001', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var cuantos = prospectos.filter(function(x){ return x.nombre === 'REDTEAM duplicado ok'; }).length;
       return { veredicto: (aviso && cuantos === 2) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · prospectos con ese nombre=' + cuantos + ' (deben ser 2) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-06', nombre: 'Contrato GEMELO CONFIRMANDO el aviso', dato: 'segundo contrato idéntico, confirmado',
  esperado: 'el segundo se guarda', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM gemelo ok', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var n0 = __R.contratosConFestejado('REDTEAM gemelo ok').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM gemelo ok', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       var n1 = __R.contratosConFestejado('REDTEAM gemelo ok').length;
       return { veredicto: (aviso && n1 === n0 + 1) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · contratos ' + n0 + ' → ' + n1 + ' (debe subir 1) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-07', nombre: 'Contrato de $0 CONFIRMANDO el aviso', dato: 'paquete con precio 0, contrato confirmado',
  esperado: 'el contrato se guarda (con aviso)', gravedad: 'MEDIA', espera: 2000,
  js: `__R.paquete({ nombre: 'REDTEAM paquete cero ok', descripcion: 'sin precio', precio: 0, descuento: 0, vigencia: '2030-12-31', estatus: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var pq = paquetes.filter(function(p){ return p.nombre === 'REDTEAM paquete cero ok'; })[0];
       if (!pq) return { veredicto: 'ROTO', detalle: 'no se pudo crear el paquete' };
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM cero ok', tipo: 'paquete', paqueteId: pq.id, fechaEvento: '2029-11-11', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 550); });
       var aviso = __R.hayConfirmacion();
       var textoAviso = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 170);
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       var co = __R.contratosConFestejado('REDTEAM cero ok');
       return { veredicto: (aviso && co.length === 1) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · contratos guardados=' + co.length + ' · el aviso decía: "' + textoAviso + '"' };`
});

await A({
  id: 'N-08', nombre: 'Cliente con el mismo TELÉFONO de otro, CONFIRMANDO el aviso', dato: 'teléfono repetido, confirmado',
  esperado: 'el segundo se guarda', gravedad: 'MEDIA', espera: 1500,
  js: `__R.cliente({ nombre: 'REDTEAM tel compartido', telefono: '8781280001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.cliente({ nombre: 'REDTEAM tel compartido 2', telefono: '8781280001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var cuantos = clientes.filter(function(x){ return soloDigitosTelefono(x.telefono) === '8781280001'; }).length;
       return { veredicto: (aviso && cuantos === 2) ? 'CANDADO OK' : (aviso ? 'ROTO' : 'EXCESO'),
                detalle: 'pidió confirmación=' + aviso + ' · clientes con ese teléfono=' + cuantos + ' (deben ser 2) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-09', nombre: 'Prospecto con nombre de 200 caracteres: debe RECORTARSE, no bloquearse', dato: 'prospecto-nombre = "B" * 200',
  esperado: 'guardar recortado a 120', gravedad: 'MEDIA',
  js: `var largo = new Array(201).join('B');
       __R.prospecto({ nombre: largo, telefono: '8781290001', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var p = prospectos.filter(function(x){ return x.telefono === '8781290001'; })[0];
       return { veredicto: p ? 'CANDADO OK' : 'EXCESO', detalle: p ? ('guardado con nombre de ' + p.nombre.length + ' caracteres (tope 120)') : ('no se guardó: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'N-10', nombre: 'Tarea con descripción de 1,000 caracteres: debe recortarse', dato: 'tarea-descripcion = "C" * 1000',
  esperado: 'guardar recortada a 300', gravedad: 'MEDIA',
  js: `var largo = new Array(1001).join('C');
       __R.tarea({ tipo: 'Otro', fecha: '2029-12-01', descripcion: largo, clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var t = tareas.filter(function(x){ return x.descripcion && x.descripcion.length > 200 && x.descripcion[0] === 'C'; })[0];
       return { veredicto: t ? 'CANDADO OK' : 'EXCESO', detalle: t ? ('guardada con ' + t.descripcion.length + ' caracteres (tope 300)') : ('no se guardó: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'N-11', nombre: 'Tarea SIN vincular a nadie', dato: 'tarea-cliente = ""',
  esperado: 'guardar', gravedad: 'MEDIA',
  js: `__R.tarea({ tipo: 'Otro', fecha: '2029-12-02', descripcion: 'REDTEAM tarea suelta', clienteId: '' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM tarea suelta'; })[0];
       return { veredicto: t ? 'CANDADO OK' : 'EXCESO', detalle: 'guardada=' + !!t + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-12', nombre: 'Editar un prospecto normal (cambiar la fase)', dato: 'editarProspecto y guardar con otra fase',
  esperado: 'actualizar sin duplicar', gravedad: 'ALTA', espera: 900,
  js: `var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM sin telefono'; })[0];
       var n0 = prospectos.length;
       editarProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.ponSelect('prospecto-fase', 'Cotización');
       __R.pulsaGuardar('form-prospecto');
       await new Promise(function(x){ setTimeout(x, 600); });
       var viva = prospectos.filter(function(x){ return x.id === p.id; })[0];
       return { veredicto: (viva.faseActual === 'Cotización' && prospectos.length === n0) ? 'CANDADO OK' : 'ROTO',
                detalle: 'fase=' + JSON.stringify(viva.faseActual) + ' · prospectos ' + n0 + ' → ' + prospectos.length + ' (no debe cambiar) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-13', nombre: 'Contrato normal (sin avisos): debe guardarse sin ninguna confirmación', dato: 'contrato nuevo de $25,000 con festejado nuevo',
  esperado: 'guardar directo', gravedad: 'ALTA', espera: 1000,
  js: `__R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM contrato normal', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-03-03', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       var co = __R.contratosConFestejado('REDTEAM contrato normal');
       return { veredicto: (!aviso && co.length === 1) ? 'CANDADO OK' : (aviso ? 'EXCESO' : 'ROTO'),
                detalle: 'pidió confirmación=' + aviso + ' (no debería) · contratos=' + co.length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-14', nombre: 'Pago y cargo NORMALES dentro del formulario del contrato: se guardan sin confirmación', dato: 'pago de $2,000 y cargo de $500 en un contrato existente',
  esperado: 'guardar los dos de inmediato', gravedad: 'ALTA', espera: 1600,
  js: `var cl = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = cl.contratos.filter(function(x){ return x.festejado === 'REDTEAM contrato normal'; })[0];
       if (!co) return { veredicto: 'ROTO', detalle: 'no está el contrato base' };
       __R.editarContrato('${cli}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pagoEnFormulario(2000);
       await new Promise(function(x){ setTimeout(x, 350); });
       var avisoPago = __R.hayConfirmacion();
       if (avisoPago) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       __R.cargoEnFormulario('cargo normal', 500);
       await new Promise(function(x){ setTimeout(x, 350); });
       var avisoCargo = __R.hayConfirmacion();
       if (avisoCargo) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 400); });
       var cl2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = cl2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: (t.totalPagos === 2000 && t.totalCargos === 500) ? 'CANDADO OK' : 'ROTO',
                detalle: 'aviso al pago=' + avisoPago + ' · aviso al cargo=' + avisoCargo + ' · en disco: pagos=$' + t.totalPagos + ' (esperado 2000), cargos=$' + t.totalCargos + ' (esperado 500) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'N-15', nombre: 'Cliente con notas largas y sin correo', dato: 'notasGenerales de 1500 caracteres, email vacío',
  esperado: 'guardar', gravedad: 'BAJA',
  js: `var notas = new Array(1501).join('N');
       __R.cliente({ nombre: 'REDTEAM notas largas', telefono: '8781300001', email: '', estado: 'Activo', notasGenerales: notas });
       await new Promise(function(x){ setTimeout(x, 450); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM notas largas'; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO', detalle: c ? ('guardado con notas de ' + String(c.notasGenerales || '').length + ' caracteres') : ('no se guardó: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'N-16', nombre: 'Eliminar un cliente con contratos: el aviso debe decir cuántos y cuánto dinero', dato: 'cliente con 1 contrato y pagos',
  esperado: 'aviso con contratos y dinero', gravedad: 'ALTA', espera: 1600,
  js: `__R.cliente({ nombre: 'REDTEAM borrar con dinero', telefono: '8781310001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM borrar con dinero'; })[0];
       __R.contrato({ clienteId: c.id, festejado: 'REDTEAM festejada borrar', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-04-04', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c2 = clientes.filter(function(x){ return x.id === c.id; })[0];
       var co = c2.contratos[0];
       __R.pagoRapido(c.id, co.id, 3000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 450); }); cerrarModal();
       CRUD.clientes.eliminar(c.id);
       await new Promise(function(x){ setTimeout(x, 350); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim();
       var mencionaContratos = /contrato/i.test(texto);
       var mencionaDinero = /\\$/.test(texto);
       var b = document.getElementById('btn-confirmar-papelera');
       if (b) b.click();
       await new Promise(function(x){ setTimeout(x, 500); });
       return { veredicto: (mencionaContratos && mencionaDinero) ? 'CANDADO OK' : 'HUECO',
                detalle: 'el aviso dice: "' + texto.slice(0, 240) + '" · menciona contratos=' + mencionaContratos + ' menciona dinero=' + mencionaDinero };`
});

await A({
  id: 'N-17', nombre: 'Pago mayor al saldo: debe seguir pidiendo confirmación (no bloquearse ni colarse)', dato: 'pago de $99,999 sobre un saldo de $25,000',
  esperado: 'confirmación explícita', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM pago excedido', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-05-05', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM pago excedido'; })[0];
       __R.limpiarNotis();
       __R.pagoRapido('${cli2}', co.id, 99999, 'excedido', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var aviso = __R.hayConfirmacion();
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 150);
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       var conAviso = (co2.pagos || []).filter(function(p){ return p.aceptadoConAviso; }).length;
       return { veredicto: (aviso && t.totalPagos === 99999 && conAviso === 1) ? 'CANDADO OK' : 'ROTO',
                detalle: 'pidió confirmación=' + aviso + ' · totalPagos=$' + t.totalPagos + ' · pagos marcados aceptadoConAviso=' + conAviso + ' · el aviso decía: "' + texto + '"' };`
});

const res = await guardar(caja, '24-no-bloquear-de-mas');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
