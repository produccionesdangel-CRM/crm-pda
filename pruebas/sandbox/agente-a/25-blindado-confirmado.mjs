/* 25-blindado-confirmado.mjs — SEGUNDA PASADA: comprobar que los 55 HUECO / 5 ROTO / 9 DUPLICA
   de la primera pasada (.24) YA NO SE PUEDEN REPRODUCIR en el sello .25.
   Ejecutar: node pruebas\sandbox\agente-a\25-blindado-confirmado.mjs
   Un CANDADO OK aquí significa "ya está blindado". Un HUECO/ROTO/DUPLICA es una regresión. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Blindado confirmado' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'B-01', nombre: '[P-11/P-12] XSS almacenado por importar un archivo con HTML en el nombre', dato: 'CSV: nombre = <img src=x onerror=window.__A.xss=7>',
  esperado: 'el HTML no debe llegar al DOM ni ejecutarse', gravedad: 'ALTA', espera: 1000,
  js: `window.__A.xss = 0;
       var texto = 'Nombre\\tTelefono\\tEmail\\n<img src=x onerror=window.__A.xss=7>\\t8781400011\\txss@correo.com';
       var r = __R.importarTexto(texto, 'xss.csv');
       await new Promise(function(x){ setTimeout(x, 500); });
       var p = prospectos.filter(function(x){ return x.telefono === '8781400011'; })[0];
       if (!p) return { veredicto: 'CANDADO OK', detalle: 'la fila se rechazó · análisis=' + JSON.stringify(r.analisis) };
       __R.verLista('prospectos');
       await new Promise(function(x){ setTimeout(x, 700); });
       var cont = document.getElementById('lista-prospectos');
       var img = cont.querySelector('img[src="x"]');
       verDetalleProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 600); });
       var imgDetalle = document.getElementById('modal-body').querySelector('img[src="x"]');
       return { veredicto: (img || imgDetalle || window.__A.xss) ? 'HUECO' : 'CANDADO OK',
                detalle: 'nombre guardado=' + JSON.stringify(p.nombre) + ' · <img> en la lista=' + !!img + ' · <img> en la ficha=' + !!imgDetalle + ' · onerror ejecutado=' + (window.__A.xss || 0) };`
});

await A({
  id: 'B-02', nombre: '[P-16] HTML almacenado por el motor de campañas', dato: 'motor.crearProspecto({ nombre: "<div onclick=window.__A.xss=9>toca</div>" })',
  esperado: 'sanear igual que el formulario', gravedad: 'ALTA', espera: 700,
  js: `var payload = '<div onclick=window.__A.xss=9>toca</div>';
       var r = App.motor.crearProspecto({ nombre: payload });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.telefono === '' && x.nombre && x.nombre.indexOf('div') !== -1; })[0];
       return { veredicto: (p && p.nombre.indexOf('<') !== -1) ? 'HUECO' : 'CANDADO OK',
                detalle: 'ok=' + r.ok + ' · nombre guardado=' + JSON.stringify(p ? p.nombre : null) + ' · (si se saneó, ya no quedan etiquetas)' };`
});

await A({
  id: 'B-03', nombre: '[P-15 ROTO] Prospecto del motor de campañas: la lista de Prospectos ya no debe caerse', dato: 'crearProspecto desde el motor + vista de lista',
  esperado: 'la lista se pinta sin excepción', gravedad: 'ALTA', espera: 900,
  js: `var r = App.motor.crearProspecto({ nombre: 'REDTEAM motor lista', telefono: '8781410001' });
       await new Promise(function(x){ setTimeout(x, 400); });
       guardarVista('prospectos', 'lista');
       window.__A.errores = [];
       var excepcion = null;
       try { renderizarProspectos(); } catch (e) { excepcion = String(e.message || e); }
       await new Promise(function(x){ setTimeout(x, 400); });
       var filas = document.querySelectorAll('#lista-prospectos .lista-fila').length;
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM motor lista'; })[0];
       return { veredicto: excepcion ? 'ROTO' : 'CANDADO OK',
                detalle: 'faseActual del prospecto del motor=' + JSON.stringify(p ? p.faseActual : null) + ' · excepción=' + JSON.stringify(excepcion) +
                         ' · filas pintadas=' + filas + ' · errores JS=' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'B-04', nombre: '[I-01] Borrar un prospecto con participaciones: no deben quedar huérfanas', dato: 'eliminarProspecto(prospecto con participación)',
  esperado: 'la participación se va con él', gravedad: 'ALTA', espera: 1200,
  js: `var par = participaciones[0];
       var p = prospectos.filter(function(x){ return x.id === par.prospectId; })[0];
       eliminarProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       document.getElementById('btn-confirmar-papelera').click();
       await new Promise(function(x){ setTimeout(x, 700); });
       var huerfanas = participaciones.filter(function(x){ return !prospectos.some(function(y){ return y.id === x.prospectId; }); }).length;
       var enPapelera = papelera.filter(function(x){ return x.tipo === 'participacion'; }).length;
       return { veredicto: huerfanas === 0 ? 'CANDADO OK' : 'HUECO',
                detalle: 'participaciones huérfanas=' + huerfanas + ' · participaciones en papelera=' + enPapelera };`
});

await A({
  id: 'B-05', nombre: '[R-05/I-02] Tarea apuntando a un cliente que no existe', dato: 'tarea-cliente = "no-existe-9999"',
  esperado: 'rechazo', gravedad: 'MEDIA', espera: 700,
  js: `var n0 = tareas.length;
       __R.tarea({ tipo: 'Llamar', fecha: '2030-06-06', descripcion: 'REDTEAM huerfana 2', clienteId: 'no-existe-9999' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM huerfana 2'; })[0];
       return { veredicto: t ? 'HUECO' : 'CANDADO OK', detalle: 'creada=' + !!t + ' · tareas ' + n0 + ' → ' + tareas.length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'B-06', nombre: '[F-01/F-02] Tarea con año absurdo (1900 y 9999)', dato: 'tarea-fecha = 1900-01-01 y 9999-12-31',
  esperado: 'rechazo en los dos casos', gravedad: 'MEDIA', espera: 900,
  js: `var n0 = tareas.length;
       __R.tarea({ tipo: 'Visita', fecha: '1900-01-01', descripcion: 'REDTEAM 1900 otra vez', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var a = tareas.filter(function(x){ return x.descripcion === 'REDTEAM 1900 otra vez'; }).length;
       __R.tarea({ tipo: 'Visita', fecha: '9999-12-31', descripcion: 'REDTEAM 9999 otra vez', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var b = tareas.filter(function(x){ return x.descripcion === 'REDTEAM 9999 otra vez'; }).length;
       return { veredicto: (a === 0 && b === 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'con 1900-01-01 creadas=' + a + ' · con 9999-12-31 creadas=' + b + ' · tareas ' + n0 + ' → ' + tareas.length };`
});

await A({
  id: 'B-07', nombre: '[C-03/C-04/C-06/C-11] Cliente con estado vacío, nombre vacío o correo basura (pegado)', dato: 'dispatchEvent con estado="" / nombre="" / email="no-es-correo"',
  esperado: 'rechazo en los tres', gravedad: 'ALTA', espera: 900,
  js: `var n0 = clientes.length;
       var r1 = __R.cliente({ nombre: 'REDTEAM estado vacio', telefono: '8781420001', email: '', estado: 'EstadoInventado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.cliente({ nombre: '', telefono: '8781420002', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.cliente({ nombre: 'REDTEAM correo malo 2', telefono: '8781420003', email: 'no-es-un-correo', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var creados = clientes.length - n0;
       var vacios = clientes.filter(function(c){ return c.nombre === '' || c.estado === ''; }).length;
       return { veredicto: (creados === 0 && vacios === 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'clientes creados con datos malos=' + creados + ' · clientes vacíos en la base=' + vacios + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'B-08', nombre: '[G-12] Pago capturado dentro del formulario del contrato: debe guardarse de inmediato', dato: 'pago de $2,000 dentro del formulario y cerrar sin «Guardar Contrato»',
  esperado: 'el pago queda guardado', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM pago inmediato', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-07-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM pago inmediato'; })[0];
       __R.editarContrato('${cli}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pagoEnFormulario(2000);
       await new Promise(function(x){ setTimeout(x, 450); });
       if (__R.hayConfirmacion()) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       cerrarModal();
       await new Promise(function(x){ setTimeout(x, 400); });
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 450); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: t.totalPagos === 2000 ? 'CANDADO OK' : 'HUECO',
                detalle: 'totalPagos en disco=$' + t.totalPagos + ' (esperado 2000) · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'B-09', nombre: '[T-01..T-09] Teléfonos basura en el prospecto: letras, 1 dígito, 40 dígitos, +, emoji', dato: '5 valores basura en prospecto-telefono',
  esperado: 'rechazo en los cinco', gravedad: 'ALTA', espera: 1200,
  js: `var basura = ['abc', '1', '1234567890123456789012345678901234567890', '+', '\uD83D\uDCDE\uD83D\uDCDE'];
       var creados = 0;
       for (var i = 0; i < basura.length; i++) {
         var n0 = prospectos.length;
         __R.prospecto({ nombre: 'REDTEAM basura ' + i, telefono: basura[i], email: '', fase: 'Interesado' });
         await new Promise(function(x){ setTimeout(x, 220); });
         if (prospectos.length > n0) creados++;
       }
       return { veredicto: creados === 0 ? 'CANDADO OK' : 'HUECO', detalle: 'prospectos creados con teléfono basura=' + creados + ' de 5 · avisos: ' + JSON.stringify(__R.textoNotis().slice(-3)) };`
});

await A({
  id: 'B-10', nombre: '[T-12] WhatsApp con teléfono basura de un dato viejo', dato: 'cliente legado telefono="1" → enviarWhatsAppCliente',
  esperado: 'no abrir el enlace', gravedad: 'ALTA', espera: 600,
  js: `var c = __R.legacyCliente({ nombre: 'REDTEAM wa legado', telefono: '1' });
       var url = __R.waUrl(c.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: url ? 'HUECO' : 'CANDADO OK', detalle: 'URL abierta=' + JSON.stringify(url) + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'B-11', nombre: '[K-09/K-12] Contrato de $0 y fecha pasada al editar: deben AVISAR (confirmación), no colarse', dato: 'paquete de $0 y edición con fecha 2020',
  esperado: 'confirmación explícita', gravedad: 'ALTA', espera: 2200,
  js: `__R.paquete({ nombre: 'REDTEAM cero blindado', descripcion: 'x', precio: 0, descuento: 0, vigencia: '2030-12-31', estatus: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var pq = paquetes.filter(function(p){ return p.nombre === 'REDTEAM cero blindado'; })[0];
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM cero blindado', tipo: 'paquete', paqueteId: pq.id, fechaEvento: '2030-08-08', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 550); });
       var avisoCero = __R.hayConfirmacion();
       if (avisoCero) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       // Ahora fecha pasada al editar
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM cero blindado'; })[0];
       __R.limpiarNotis();
       __R.editarContrato('${cli2}', co.id, { 'contrato-fecha-evento': '2020-05-05' }, 'dispatch');
       await new Promise(function(x){ setTimeout(x, 550); });
       var avisoPasado = __R.hayConfirmacion();
       if (avisoPasado) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       return { veredicto: (avisoCero && avisoPasado) ? 'CANDADO OK' : 'HUECO',
                detalle: 'aviso con contrato de $0=' + avisoCero + ' · aviso con fecha pasada al editar=' + avisoPasado + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'B-12', nombre: '[A-01..A-11] Campañas basura por el motor: sin nombre, sin etapa inicial, metas negativas, criterio inventado', dato: '4 campañas incongruentes',
  esperado: 'ninguna debe guardarse', gravedad: 'ALTA', espera: 1400,
  js: `var n0 = campanias.length;
       var intentos = [
         { nombre: '', tipo: 'captacion', fechaInicio: '2030-01-01', fechaFin: '2030-12-31' },
         { nombre: 'REDTEAM sin inicial', tipo: 'captacion', etapas: [{ nombre: 'A', orden: 1, esInicial: false, esFinal: true }], fechaInicio: '2030-01-01', fechaFin: '2030-12-31' },
         { nombre: 'REDTEAM metas negativas', tipo: 'captacion', fechaInicio: '2030-01-01', fechaFin: '2030-12-31', metas: { prospectos: -50 } },
         { nombre: 'REDTEAM criterio inventado', tipo: 'captacion', fechaInicio: '2030-01-01', fechaFin: '2030-12-31', criteriosElegibilidad: [{ id: 'c1', tipo: 'signo-zodiacal', valor: 'escorpio' }] },
         { nombre: 'REDTEAM fechas invertidas', tipo: 'captacion', fechaInicio: '2030-12-31', fechaFin: '2030-01-01' }
       ];
       var guardadas = [];
       intentos.forEach(function(d){
         var c = App.motor.crearCampania(d);
         if (campanias.some(function(x){ return x.id === c.id; })) guardadas.push(d.nombre || '(sin nombre)');
       });
       await new Promise(function(x){ setTimeout(x, 400); });
       return { veredicto: guardadas.length === 0 ? 'CANDADO OK' : 'HUECO',
                detalle: 'campañas incongruentes que SÍ se guardaron=' + JSON.stringify(guardadas) + ' · campanias ' + n0 + ' → ' + campanias.length };`
});

await A({
  id: 'B-13', nombre: '[A-09/A-10] Participación cerrada a etapa inicial y estado inventado', dato: 'cambiarEtapa(cerrada→inicial) y cambiarEstadoParticipacion("estadoInventado")',
  esperado: 'rechazo en los dos', gravedad: 'MEDIA', espera: 900,
  js: `var camp = App.almacen.campania('${caja.semb.campanias[0].id}');
       var par = participaciones.filter(function(x){ return x.campaignId === camp.id; })[0];
       var estados = App.motor.etapasOrdenadas(camp);
       App.motor.cambiarEtapa(par.id, estados[estados.length - 1].id);
       await new Promise(function(x){ setTimeout(x, 250); });
       var inicial = App.motor.etapaInicial(camp);
       var r1 = App.motor.cambiarEtapa(par.id, inicial.id);
       var r2 = App.motor.cambiarEstadoParticipacion(par.id, 'estadoInventado');
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.participacion(par.id);
       return { veredicto: (!r1.ok && !r2.ok) ? 'CANDADO OK' : 'HUECO',
                detalle: 'volver a la inicial ok=' + r1.ok + ' codigo=' + r1.codigo + ' · estado inventado ok=' + r2.ok + ' · estado final=' + JSON.stringify(viva.estado) + ' etapa=' + JSON.stringify(viva.etapaId === inicial.id ? inicial.nombre : viva.etapaId) };`
});

await A({
  id: 'B-14', nombre: '[D-01..D-05/D-11] Doble envío (duplicados) en prospecto, tarea, cliente y contrato', dato: 'dos envíos en el mismo instante en los cuatro formularios',
  esperado: 'un registro en cada uno', gravedad: 'ALTA', espera: 2600,
  js: `var res = {};
       var p0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM dup prospecto', telefono: '8781430001', email: '', fase: 'Interesado' });
       __R.reenviar('form-prospecto', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       res.prospectos = prospectos.filter(function(x){ return x.nombre === 'REDTEAM dup prospecto'; }).length;
       var t0 = tareas.length;
       __R.tarea({ tipo: 'Confirmar', fecha: '2030-09-09', descripcion: 'REDTEAM dup tarea', clienteId: '${cli}' });
       __R.reenviar('form-tarea', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       res.tareas = tareas.filter(function(x){ return x.descripcion === 'REDTEAM dup tarea'; }).length;
       var c0 = clientes.length;
       __R.cliente({ nombre: 'REDTEAM dup cliente', telefono: '8781430002', email: '', estado: 'Activo' });
       __R.reenviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       res.clientes = clientes.filter(function(x){ return x.nombre === 'REDTEAM dup cliente'; }).length;
       var co0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM dup contrato', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-10-10', estado: 'Pendiente' });
       __R.reenviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 800); });
       if (__R.hayConfirmacion()) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       res.contratos = __R.contratosConFestejado('REDTEAM dup contrato').length;
       var malos = Object.keys(res).filter(function(k){ return res[k] > 1; });
       return { veredicto: malos.length ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'registros creados por cada doble envío: ' + JSON.stringify(res) + ' (cada uno debe ser 1) · duplicados=' + JSON.stringify(malos) };`
});

await A({
  id: 'B-15', nombre: '[I-06/I-07] Cuadre final del dinero tras todo lo anterior', dato: 'revisión global de contratos, pagos y saldos',
  esperado: 'todo cuadrado y sin referencias colgadas', gravedad: 'ALTA', espera: 700,
  js: `var inv = __R.invariantes();
       var cuadre = inv.problemas.filter(function(p){ return ['suma_pagos_no_cuadra','total_no_cuadra','saldo_no_cuadra'].indexOf(p.tipo) !== -1; });
       var otros = inv.problemas.filter(function(p){ return ['suma_pagos_no_cuadra','total_no_cuadra','saldo_no_cuadra'].indexOf(p.tipo) === -1; });
       return { veredicto: (!cuadre.length && !otros.length) ? 'CANDADO OK' : (cuadre.length ? 'ROTO' : 'HUECO'),
                detalle: 'contratos=' + inv.contratos + ' · sumaAPagar=$' + inv.sumaAPagar + ' · sumaPagos=$' + inv.sumaPagos + ' · sumaSaldos=$' + inv.sumaSaldos +
                         ' · fallos de cuadre=' + JSON.stringify(cuadre) + ' · referencias colgadas=' + JSON.stringify(otros) };`
});

const res = await guardar(caja, '25-blindado-confirmado');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
