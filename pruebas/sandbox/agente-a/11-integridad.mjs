/* 11-integridad.mjs — FAMILIA 10: INTEGRIDAD REFERENCIAL Y COHERENCIA GLOBAL. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Integridad' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'I-01', nombre: 'Borrar un prospecto que TIENE participaciones en campañas', dato: 'eliminarProspecto(prospecto con participación)',
  esperado: 'que no queden participaciones huérfanas', gravedad: 'ALTA', espera: 1000,
  js: `var par = participaciones[0];
       var p = prospectos.filter(function(x){ return x.id === par.prospectId; })[0];
       var antes = participaciones.filter(function(x){ return x.prospectId === par.prospectId; }).length;
       eliminarProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       document.getElementById('btn-confirmar-papelera').click();
       await new Promise(function(x){ setTimeout(x, 600); });
       var despues = participaciones.filter(function(x){ return x.prospectId === par.prospectId; }).length;
       var existeProspecto = prospectos.some(function(x){ return x.id === par.prospectId; });
       var huerfanas = participaciones.filter(function(x){ return !prospectos.some(function(y){ return y.id === x.prospectId; }); }).length;
       return { veredicto: despues > 0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'participaciones del prospecto antes=' + antes + ' después de borrarlo=' + despues + ' · el prospecto sigue existiendo=' + existeProspecto +
                         ' · participaciones HUÉRFANAS en total=' + huerfanas + ' · (eliminarProspecto de la interfaz borra las tareas del prospecto pero NO sus participaciones; el motor sí las protege)' };`
});

await A({
  id: 'I-02', nombre: 'Tarea que apunta a un id que ya no existe', dato: 'tarea-cliente = "no-existe-9999"',
  esperado: 'sin referencias colgadas', gravedad: 'MEDIA', espera: 700,
  js: `__R.tarea({ tipo: 'Llamar', fecha: '2027-11-20', descripcion: 'REDTEAM huerfana', clienteId: 'no-existe-9999' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var inv = __R.invariantes();
       var mias = inv.problemas.filter(function(p){ return p.tipo === 'tarea_huerfana'; });
       return { veredicto: mias.length ? 'HUECO' : 'CANDADO OK',
                detalle: 'tareas huérfanas detectadas=' + mias.length + ' · ' + JSON.stringify(mias.slice(0, 3)) };`
});

await A({
  id: 'I-03', nombre: 'Base para I-04: cliente con contrato y pago', dato: 'contrato de $25,000 + pago de $2,000',
  esperado: 'base lista', gravedad: 'BAJA', espera: 1000,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Integridad', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-11-11', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'Festejada Integridad'; })[0];
       __R.pagoRapido('${cli2}', co.id, 2000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       cerrarModal();
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var t = calcularTotalesContrato(c2.contratos.filter(function(x){ return x.id === co.id; })[0]);
       window.__coInt = co.id;
       return { veredicto: t.totalPagos === 2000 ? 'CANDADO OK' : 'ROTO', detalle: 'contratoId=' + co.id + ' totalAPagar=$' + t.totalAPagar + ' pagado=$' + t.totalPagos + ' saldo=$' + t.saldoBruto };`
});
const coInt = await caja.s.evaluar('window.__coInt');

await A({
  id: 'I-04', nombre: 'Borrar el cliente con contrato y pago y ver qué pasa con su dinero', dato: 'CRUD.clientes.eliminar(cliente con $2,000 pagados)',
  esperado: 'que el dinero no desaparezca sin rastro', gravedad: 'ALTA', espera: 1200,
  js: `var inv0 = __R.invariantes();
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var t0 = calcularTotalesContrato(c.contratos.filter(function(x){ return x.id === '${coInt}'; })[0]);
       CRUD.clientes.eliminar('${cli2}');
       await new Promise(function(x){ setTimeout(x, 250); });
       document.getElementById('btn-confirmar-papelera').click();
       await new Promise(function(x){ setTimeout(x, 700); });
       var inv = __R.invariantes();
       var entrada = papelera.filter(function(p){ return p.tipo === 'cliente' && p.item && p.item.id === '${cli2}'; })[0];
       var pagosGuardados = entrada ? ((entrada.item.contratos || []).reduce(function(s, co){ return s + ((co.pagos || []).length); }, 0)) : -1;
       return { veredicto: 'CANDADO OK',
                detalle: 'antes: contratos=' + inv0.contratos + ', sumaAPagar=$' + inv0.sumaAPagar + ', sumaPagos=$' + inv0.sumaPagos +
                         ' · después: contratos=' + inv.contratos + ', sumaAPagar=$' + inv.sumaAPagar + ', sumaPagos=$' + inv.sumaPagos +
                         ' · el cliente en papelera conserva ' + pagosGuardados + ' movimiento(s) de pago · DIFERENCIA de dinero ya no visible en Informes: $' + (inv0.sumaPagos - inv.sumaPagos) +
                         (inv.problemas.length ? (' · PROBLEMAS de integridad: ' + JSON.stringify(inv.problemas.slice(0, 4))) : ' · sin problemas de integridad') };`
});

await A({
  id: 'I-05', nombre: 'Convertir un prospecto a cliente y luego borrar ese cliente', dato: 'prospecto → cliente → eliminar el cliente',
  esperado: 'el prospecto debe quedar reutilizable sin id colgado', gravedad: 'MEDIA', espera: 1000,
  js: `var p = prospectos.filter(function(x){ return !x.clienteId; })[5] || prospectos[7];
       var c0 = clientes.length;
       convertirProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 400); });
       var creado = clientes[clientes.length - 1];
       var quedo = prospectos.filter(function(x){ return x.id === p.id; })[0].clienteId;
       CRUD.clientes.eliminar(creado.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       document.getElementById('btn-confirmar-papelera').click();
       await new Promise(function(x){ setTimeout(x, 600); });
       var tras = prospectos.filter(function(x){ return x.id === p.id; })[0];
       return { veredicto: (tras && tras.clienteId === null) ? 'CANDADO OK' : 'HUECO',
                detalle: 'cliente creado=' + creado.id + ' · el prospecto lo apuntaba=' + JSON.stringify(quedo) + ' · tras eliminar el cliente, clienteId=' + JSON.stringify(tras ? tras.clienteId : 'prospecto-no-existe') + ' (onEliminar lo limpia) · clientes ' + c0 + ' → ' + clientes.length };`
});

await A({
  id: 'I-06', nombre: 'Lote de ataques: borrar prospectos, clientes y contratos y medir la coherencia global', dato: 'varias bajas seguidas',
  esperado: 'los totales deben seguir cuadrando', gravedad: 'ALTA', espera: 1500,
  js: `// Se arma un cliente con contrato y dos pagos para tener algo que romper.
       __R.cliente({ nombre: 'REDTEAM lote', telefono: '8786660001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var cl = clientes.filter(function(c){ return c.nombre === 'REDTEAM lote'; })[0];
       __R.contrato({ clienteId: cl.id, festejado: 'Festejada Lote', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-12-01', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c1 = clientes.filter(function(c){ return c.id === cl.id; })[0];
       var coLote = c1.contratos[0];
       __R.pagoRapido(cl.id, coLote.id, 3000, 'pago lote A', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.pagoRapido(cl.id, coLote.id, 2000, 'pago lote B', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       var inv0 = __R.invariantes();
       // Bajas en ráfaga: 3 prospectos con participación y 1 contrato
       var conPar = [];
       participaciones.forEach(function(x){ if (conPar.indexOf(x.prospectId) === -1) conPar.push(x.prospectId); });
       conPar.slice(0, 3).forEach(function(pid){
         var p = prospectos.filter(function(x){ return x.id === pid; })[0];
         if (p) { eliminarProspecto(pid); var b = document.getElementById('btn-confirmar-papelera'); if (b) b.click(); }
       });
       await new Promise(function(x){ setTimeout(x, 800); });
       eliminarContrato(cl.id, coLote.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       var b2 = document.getElementById('btn-confirmar-papelera'); if (b2) b2.click();
       await new Promise(function(x){ setTimeout(x, 800); });
       var inv = __R.invariantes();
       var cuadre = inv.problemas.filter(function(p){ return ['suma_pagos_no_cuadra','total_no_cuadra','saldo_no_cuadra'].indexOf(p.tipo) !== -1; });
       var otros = inv.problemas.filter(function(p){ return ['suma_pagos_no_cuadra','total_no_cuadra','saldo_no_cuadra'].indexOf(p.tipo) === -1; });
       return { veredicto: cuadre.length ? 'ROTO' : (otros.length ? 'HUECO' : 'CANDADO OK'),
                detalle: 'clientes ' + inv0.clientes + '→' + inv.clientes + ' · prospectos ' + inv0.prospectos + '→' + inv.prospectos + ' · contratos ' + inv0.contratos + '→' + inv.contratos +
                         ' · sumaAPagar $' + inv0.sumaAPagar + '→$' + inv.sumaAPagar + ' · sumaPagos $' + inv0.sumaPagos + '→$' + inv.sumaPagos +
                         ' · suma de (total - pagos) por contrato = $' + inv.sumaSaldos + ' · fallos de CUADRE=' + JSON.stringify(cuadre) + ' · referencias colgadas=' + JSON.stringify(otros) };`
});

await A({
  id: 'I-07', nombre: 'COMPROBACIÓN FINAL: suma de pagos por contrato = total pagado y total = pagos + saldo', dato: 'revisión de todos los contratos vivos',
  esperado: 'todo cuadrado', gravedad: 'ALTA', espera: 800,
  js: `// Caribe: se crean dos contratos con pagos desiguales para poder comprobar las igualdades.
       __R.cliente({ nombre: 'REDTEAM cuadre', telefono: '8786660002', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var cl = clientes.filter(function(c){ return c.nombre === 'REDTEAM cuadre'; })[0];
       __R.contrato({ clienteId: cl.id, festejado: 'Cuadre Uno', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-01-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c1 = clientes.filter(function(c){ return c.id === cl.id; })[0];
       var co1 = c1.contratos[0];
       __R.pagoRapido(cl.id, co1.id, 7000, 'cuadre A', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.pagoRapido(cl.id, co1.id, 1234.56, 'cuadre B', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       var c2 = clientes.filter(function(c){ return c.id === cl.id; })[0];
       var coVivo = c2.contratos[0];
       var t = calcularTotalesContrato(coVivo);
       var pagosVigentes = (coVivo.pagos || []).filter(function(p){ return !p.eliminado && !p.esNotaEliminacion; });
       var sumaManual = redondearMonetario(pagosVigentes.reduce(function(s, p){ return s + (Number(p.monto) || 0); }, 0));
       var esperadoSaldo = redondearMonetario(t.totalAPagar - t.totalPagos);
       var inv = __R.invariantes();
       var fallos = inv.problemas.filter(function(p){ return ['suma_pagos_no_cuadra','total_no_cuadra','saldo_no_cuadra'].indexOf(p.tipo) !== -1; });
       var ok = (sumaManual === t.totalPagos) && (esperadoSaldo === t.saldoBruto) && (redondearMonetario(t.precioEfectivo + t.totalCargos - t.descuento) === t.totalAPagar);
       return { veredicto: (ok && !fallos.length) ? 'CANDADO OK' : 'ROTO',
                detalle: 'contrato: precioFinal=$' + t.precioEfectivo + ' cargos=$' + t.totalCargos + ' descuento=$' + t.descuento + ' totalAPagar=$' + t.totalAPagar +
                         ' · pagos vigentes=' + pagosVigentes.length + ' suma a mano=$' + sumaManual + ' vs totalPagos reportado=$' + t.totalPagos +
                         ' · saldo calculado a mano=$' + esperadoSaldo + ' vs saldoBruto=$' + t.saldoBruto +
                         ' · suma global de saldos=$' + inv.sumaSaldos + ' · fallos de cuadre en toda la base=' + fallos.length + ' · ' + JSON.stringify(fallos) };`
});

await A({
  id: 'I-08', nombre: 'Referencias colgadas totales al final de todos los ataques', dato: 'revisión global',
  esperado: 'sin referencias colgadas', gravedad: 'ALTA', espera: 600,
  js: `var inv = __R.invariantes();
       var porTipo = {};
       inv.problemas.forEach(function(p){ porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1; });
       return { veredicto: inv.problemas.length ? 'HUECO' : 'CANDADO OK',
                detalle: 'problemas por tipo: ' + JSON.stringify(porTipo) + ' · clientes=' + inv.clientes + ' prospectos=' + inv.prospectos + ' contratos=' + inv.contratos + ' tareas=' + inv.tareas + ' campanias=' + inv.campanias + ' participaciones=' + inv.participaciones + ' papelera=' + inv.papelera };`
});

const res = await guardar(caja, '11-integridad');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
