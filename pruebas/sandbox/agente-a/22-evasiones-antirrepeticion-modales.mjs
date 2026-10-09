/* 22-evasiones-antirrepeticion-modales.mjs — SEGUNDA PASADA:
   (a) burlar la antirrepetición nueva, (b) comprobar el aparcado de modales.
   Ejecutar: node pruebas\sandbox\agente-a\22-evasiones-antirrepeticion-modales.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Evasion antirrepeticion y modales' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

/* ══════════════ (a) ANTIRREPETICIÓN ══════════════ */

await A({
  id: 'A-01', nombre: 'Dos requestSubmit() seguidos en el prospecto', dato: 'nombre="REDTEAM anti 1" y dos envíos reales',
  esperado: 'un solo prospecto', gravedad: 'ALTA', espera: 900,
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM anti 1', telefono: '8781234001', email: '', fase: 'Interesado' });
       __R.reenviar('form-prospecto', 'request');
       await new Promise(function(x){ setTimeout(x, 600); });
       var cuantos = prospectos.filter(function(p){ return p.nombre === 'REDTEAM anti 1'; }).length;
       return { veredicto: cuantos > 1 ? 'DUPLICA' : 'CANDADO OK', detalle: 'prospectos creados=' + cuantos + ' (prospectos ' + n0 + ' → ' + prospectos.length + ')' };`
});

await A({
  id: 'A-02', nombre: 'Un requestSubmit() y luego un dispatchEvent del submit', dato: 'envío real + envío tipo pegado',
  esperado: 'un solo prospecto', gravedad: 'ALTA', espera: 900,
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM anti 2', telefono: '8781234002', email: '', fase: 'Interesado' });
       __R.reenviar('form-prospecto', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var cuantos = prospectos.filter(function(p){ return p.nombre === 'REDTEAM anti 2'; }).length;
       return { veredicto: cuantos > 1 ? 'DUPLICA' : 'CANDADO OK', detalle: 'prospectos creados=' + cuantos + ' (prospectos ' + n0 + ' → ' + prospectos.length + ')' };`
});

await A({
  id: 'A-03', nombre: 'Reenviar el MISMO formulario ya cerrado (sin reabrirlo)', dato: 'guardar «REDTEAM anti 3», esperar, y reenviar el form que quedó en el DOM',
  esperado: 'el formulario cerrado no debe volver a guardar (D-11)', gravedad: 'ALTA', espera: 1000,
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM anti 3', telefono: '8781234003', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var modalCerrado = !document.getElementById('modal').classList.contains('active');
       var formSigue = !!document.getElementById('form-prospecto');
       __R.reenviar('form-prospecto', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var cuantos = prospectos.filter(function(p){ return p.nombre === 'REDTEAM anti 3'; }).length;
       return { veredicto: cuantos > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'modal cerrado=' + modalCerrado + ' · el form sigue en el DOM=' + formSigue + ' · prospectos creados=' + cuantos + ' (prospectos ' + n0 + ' → ' + prospectos.length + ')' };`
});

await A({
  id: 'A-04', nombre: 'Cerrar el prospecto y VOLVER A ABRIR el formulario: ¿se puede guardar?', dato: 'guardar, reabrir «Nuevo Prospecto» y guardar otro',
  esperado: 'el formulario nuevo debe guardar sin estorbos (no bloquear de más)', gravedad: 'ALTA', espera: 1100,
  js: `__R.prospecto({ nombre: 'REDTEAM anti 4a', telefono: '8781234004', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 500); });
       __R.prospecto({ nombre: 'REDTEAM anti 4b', telefono: '8781234005', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var a = prospectos.filter(function(p){ return p.nombre === 'REDTEAM anti 4a'; }).length;
       var b = prospectos.filter(function(p){ return p.nombre === 'REDTEAM anti 4b'; }).length;
       return { veredicto: (a === 1 && b === 1) ? 'CANDADO OK' : (b === 0 ? 'EXCESO' : 'DUPLICA'),
                detalle: 'primero=' + a + ' · segundo=' + b + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

/* ── El candado deja el formulario bloqueado tras un error de captura ── */
await A({
  id: 'A-05', nombre: 'CONTRATO: primer intento con error (sin cliente) y luego corregido', dato: 'Guardar sin cliente → «Selecciona un cliente» → poner cliente → Guardar otra vez',
  esperado: 'el segundo intento debe guardar', gravedad: 'ALTA', espera: 1400,
  js: `var n0 = obtenerContratos().length;
       __R.limpiar();
       mostrarFormularioContrato('${cli}');
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.pon('contrato-cliente-id', '');
       __R.pon('contrato-festejado', 'REDTEAM anti 5');
       __R.pon('contrato-fecha-evento', '2029-06-06');
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 400); });
       var primerAviso = JSON.stringify(__R.textoNotis());
       __R.limpiarNotis();
       // El practicante corrige: elige el cliente en el buscador (campo oculto) y vuelve a guardar.
       __R.pon('contrato-cliente-id', '${cli}');
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 600); });
       var creados = obtenerContratos().length - n0;
       return { veredicto: creados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er intento dijo: ' + primerAviso + ' · tras corregir el cliente: contratos creados=' + creados +
                         ' · avisos del 2º intento: ' + JSON.stringify(__R.textoNotis()) + ' · (si no hay aviso, el botón Guardar quedó muerto y el practicante no sabe por qué)' };`
});

await A({
  id: 'A-06', nombre: 'PAGO RÁPIDO: primer intento con monto inválido (0) y luego el monto bueno', dato: 'Registrar con monto 0 → aviso → monto 1500 → Registrar otra vez',
  esperado: 'el segundo intento debe registrar el pago', gravedad: 'ALTA', espera: 1400,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM anti 6', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-06-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM anti 6'; })[0];
       var n0 = (co.pagos || []).length;
       __R.limpiarNotis();
       __R.pagoRapido('${cli2}', co.id, 0, 'cero', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var primerAviso = JSON.stringify(__R.textoNotis());
       __R.limpiarNotis();
       __R.pon('pago-rapido-monto', 1500);
       __R.pulsaGuardar('form-pago-rapido');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var registrados = (co2.pagos || []).length - n0;
       return { veredicto: registrados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er intento dijo: ' + primerAviso + ' · tras poner 1500 y pulsar Registrar: pagos registrados=' + registrados +
                         ' · avisos del 2º intento: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'A-07', nombre: 'CONTRATO GEMELO: cancelar el aviso y volver a intentar guardar', dato: 'segundo contrato idéntico → aviso → Cancelar → Guardar otra vez',
  esperado: 'el segundo intento debe volver a avisar (o guardar)', gravedad: 'ALTA', espera: 2000,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM gemelo A', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-07-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var n0 = __R.contratosConFestejado('REDTEAM gemelo A').length;
       __R.limpiarNotis();
       // Segundo contrato idéntico: abre la ventana de confirmación.
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM gemelo A', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-07-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var aviso1 = __R.hayConfirmacion();
       __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 400); });
       var formVivo = !!document.getElementById('form-contrato');
       var datosAntes = __R.datosContratoFormulario();
       __R.limpiarNotis();
       // El practicante decide guardarlo igual y vuelve a pulsar Guardar.
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 700); });
       var aviso2 = __R.hayConfirmacion();
       var notis2 = __R.textoNotis();
       if (aviso2) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var n1 = __R.contratosConFestejado('REDTEAM gemelo A').length;
       return { veredicto: aviso2 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er aviso=' + aviso1 + ' → Cancelar · el formulario sigue vivo=' + formVivo + ' con festejado=' + JSON.stringify(datosAntes.festejado) +
                         ' · 2º intento de Guardar: volvió a avisar=' + aviso2 + ' · avisos del 2º intento=' + JSON.stringify(notis2) +
                         ' · contratos ' + n0 + ' → ' + n1 + ' (si el 2º intento no avisa NI guarda, el botón quedó muerto)' };`
});

/* ── Los que sí se liberan (no deben bloquear de más) ── */
for (const [id, tipo] of [['A-08', 'prospecto'], ['A-09', 'tarea'], ['A-10', 'cliente']]) {
  await A({
    id, nombre: 'Cancelar el aviso de duplicado/repetida en ' + tipo + ' y volver a guardar', dato: 'duplicado → Cancelar → corregir y guardar',
    esperado: 'el formulario debe seguir usable', gravedad: 'MEDIA', espera: 1500,
    js: `var marca = 'REDTEAM libera ${id}';
         if ('${tipo}' === 'prospecto') {
           __R.prospecto({ nombre: marca, telefono: '87812400${id.slice(-2)}', email: '', fase: 'Interesado' });
           await new Promise(function(x){ setTimeout(x, 550); });
           __R.limpiarNotis();
           __R.prospecto({ nombre: marca, telefono: '87812400${id.slice(-2)}', email: '', fase: 'Interesado' });
           await new Promise(function(x){ setTimeout(x, 400); });
           var aviso = __R.hayConfirmacion();
           if (aviso) __R.cancelarFinanciero();
           await new Promise(function(x){ setTimeout(x, 350); });
           // Cambia el nombre para que no sea duplicado y guarda.
           __R.pon('prospecto-nombre', marca + ' v2');
           __R.pulsaGuardar('form-prospecto');
           await new Promise(function(x){ setTimeout(x, 550); });
           var guardados = prospectos.filter(function(x){ return x.nombre === marca + ' v2'; }).length;
           return { veredicto: guardados ? 'CANDADO OK' : 'EXCESO', detalle: 'aviso=' + aviso + ' · guardados=' + guardados + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };
         }
         if ('${tipo}' === 'tarea') {
           __R.tarea({ tipo: 'Visita', fecha: '2029-08-08', descripcion: marca, clienteId: '${cli}' });
           await new Promise(function(x){ setTimeout(x, 550); });
           __R.limpiarNotis();
           __R.tarea({ tipo: 'Visita', fecha: '2029-08-08', descripcion: marca, clienteId: '${cli}' });
           await new Promise(function(x){ setTimeout(x, 400); });
           var aviso2 = __R.hayConfirmacion();
           if (aviso2) __R.cancelarFinanciero();
           await new Promise(function(x){ setTimeout(x, 350); });
           __R.pon('tarea-descripcion', marca + ' v2');
           __R.pulsaGuardar('form-tarea');
           await new Promise(function(x){ setTimeout(x, 550); });
           var guardadas = tareas.filter(function(x){ return x.descripcion === marca + ' v2'; }).length;
           return { veredicto: guardadas ? 'CANDADO OK' : 'EXCESO', detalle: 'aviso=' + aviso2 + ' · guardadas=' + guardadas + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };
         }
         __R.cliente({ nombre: marca, telefono: '87812410${id.slice(-2)}', email: '', estado: 'Activo' });
         await new Promise(function(x){ setTimeout(x, 550); });
         __R.limpiarNotis();
         __R.cliente({ nombre: marca, telefono: '87812410${id.slice(-2)}', email: '', estado: 'Activo' });
         await new Promise(function(x){ setTimeout(x, 450); });
         var aviso3 = __R.hayConfirmacion();
         if (aviso3) __R.cancelarFinanciero();
         await new Promise(function(x){ setTimeout(x, 350); });
         __R.pon('campo-nombre', marca + ' v2');
         __R.pulsaGuardar('form-crud');
         await new Promise(function(x){ setTimeout(x, 550); });
         var guardadosC = clientes.filter(function(x){ return x.nombre === marca + ' v2'; }).length;
         return { veredicto: guardadosC ? 'CANDADO OK' : 'EXCESO', detalle: 'aviso=' + aviso3 + ' · guardados=' + guardadosC + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

await A({
  id: 'A-11', nombre: 'DOS envíos en el mismo instante en un formulario que abre confirmación (prospecto duplicado)', dato: 'prospecto duplicado + segundo submit en el mismo tick',
  esperado: 'un solo aviso y el formulario conservado', gravedad: 'ALTA', espera: 2000,
  js: `__R.prospecto({ nombre: 'REDTEAM doble aviso', telefono: '8781250000', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.prospecto({ nombre: 'REDTEAM doble aviso', telefono: '8781250000', email: '', fase: 'Interesado' });
       // Segundo envío inmediato del mismo formulario (doble toque del practicante).
       __R.reenviar('form-prospecto', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var estado = __R.estadoModal();
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 140);
       var formVisible = !!document.getElementById('form-prospecto');
       // ¿Se puede confirmar y guardar todavía?
       var guardo = false;
       if (__R.hayConfirmacion()) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       guardo = prospectos.filter(function(x){ return x.nombre === 'REDTEAM doble aviso'; }).length;
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: (formVisible && guardo >= 1) ? 'CANDADO OK' : 'ROTO',
                detalle: 'estado del modal: ' + JSON.stringify(estado) + ' · formulario visible=' + formVisible + ' · el modal de arriba decía: "' + texto + '"' +
                         ' · prospectos con ese nombre al final=' + guardo + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'A-12', nombre: 'DOS envíos en el mismo instante en un contrato que abre confirmación (gemelo)', dato: 'contrato gemelo + segundo submit en el mismo tick',
  esperado: 'un solo aviso y el formulario conservado', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM doble contrato', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-09-09', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var n0 = __R.contratosConFestejado('REDTEAM doble contrato').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM doble contrato', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-09-09', estado: 'Pendiente' });
       __R.reenviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 800); });
       var formVisible = !!document.getElementById('form-contrato');
       var estado = __R.estadoModal();
       if (__R.hayConfirmacion()) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       var n1 = __R.contratosConFestejado('REDTEAM doble contrato').length;
       return { veredicto: (formVisible && n1 === n0 + 1) ? 'CANDADO OK' : 'ROTO',
                detalle: 'formulario visible=' + formVisible + ' · estado=' + JSON.stringify(estado) + ' · contratos ' + n0 + ' → ' + n1 + ' (debe subir exactamente 1) · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

/* ══════════════ (b) APARCADO DE MODALES ══════════════ */

await A({
  id: 'M-01', nombre: 'Cargo grande confirmado: el formulario del contrato debe seguir vivo y con sus datos', dato: 'festejado «REDTEAM aparcado», dirección «Calle Falsa 123», cargo de $9,999,999 → confirmar',
  esperado: 'el formulario sobrevive con sus datos y el cargo se guarda', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM aparcado', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM aparcado'; })[0];
       var coId = co.id;
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', 'REDTEAM aparcado EDITADO');
       __R.pon('contrato-direccion-evento', 'Calle Falsa 123');
       __R.cargoEnFormulario('cargo gigante aparcado', 9999999);
       await new Promise(function(x){ setTimeout(x, 450); });
       var aviso = __R.hayConfirmacion();
       var formDuranteAviso = !!document.getElementById('form-contrato');
       var estadoAparcado = __R.estadoModal();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 700); }); }
       var despues = __R.datosContratoFormulario();
       var formVivo = !!document.getElementById('form-contrato');
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 400); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === coId; })[0];
       var cargosEnDisco = (co2.cargos || []).filter(function(x){ return !x.eliminado; }).length;
       return { veredicto: (aviso && formVivo && despues.festejado === 'REDTEAM aparcado EDITADO' && despues.direccion === 'Calle Falsa 123' && cargosEnDisco > 0) ? 'CANDADO OK' : 'ROTO',
                detalle: 'aviso=' + aviso + ' · el form existía durante el aviso=' + formDuranteAviso + ' · estado durante el aviso=' + JSON.stringify(estadoAparcado) +
                         ' · tras confirmar: form vivo=' + formVivo + ' con festejado=' + JSON.stringify(despues.festejado) + ' y dirección=' + JSON.stringify(despues.direccion) +
                         ' · cargos vigentes en disco=' + cargosEnDisco + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'M-02', nombre: 'Anular un pago: el formulario del contrato debe seguir vivo, con sus datos y la anulación guardada', dato: 'cargo/pago de $5,000 + $3,000, anular el primero y confirmar',
  esperado: 'la anulación persiste y el formulario sobrevive', gravedad: 'ALTA', espera: 2600,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM anular vivo', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-11-11', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM anular vivo'; })[0];
       var coId = co.id;
       __R.pagoRapido('${cli}', coId, 5000, 'anticipo A', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.pagoRapido('${cli}', coId, 3000, 'anticipo B', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.editarContrato('${cli}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', 'REDTEAM anular vivo EDITADO');
       window.__A.errores = [];
       var botones = document.querySelectorAll('#pagos-lista .btn-eliminar-item');
       botones[0].click();
       await new Promise(function(x){ setTimeout(x, 250); });
       document.getElementById('motivo-anulacion').value = 'pago duplicado de prueba';
       document.getElementById('btn-confirmar-anulacion').click();
       await new Promise(function(x){ setTimeout(x, 700); });
       var despues = __R.datosContratoFormulario();
       var formVivo = !!document.getElementById('form-contrato');
       var estado = __R.estadoModal();
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 400); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === coId; })[0];
       var t = calcularTotalesContrato(co2);
       var anulados = (co2.pagos || []).filter(function(p){ return p.eliminado; }).length;
       var notas = (co2.pagos || []).filter(function(p){ return p.esNotaEliminacion; }).length;
       return { veredicto: (formVivo && anulados === 1 && notas === 1 && t.totalPagos === 3000) ? 'CANDADO OK' : 'ROTO',
                detalle: 'botones de anular=' + botones.length + ' · form vivo=' + formVivo + ' con festejado=' + JSON.stringify(despues.festejado) +
                         ' · tras recargar: pagos anulados=' + anulados + ', notas de anulación=' + notas + ', totalPagos=$' + t.totalPagos + ' · estado=' + JSON.stringify(estado) +
                         ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'M-03', nombre: 'Anular un pago y CANCELAR: no debe cambiar nada y el formulario sigue vivo', dato: 'cancelar la ventana de anulación',
  esperado: 'sin cambios, formulario vivo', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM anular cancelado', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-12-12', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM anular cancelado'; })[0];
       var coId = co.id;
       __R.pagoRapido('${cli2}', coId, 4000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', 'REDTEAM anular cancelado EDITADO');
       window.__A.errores = [];
       document.querySelectorAll('#pagos-lista .btn-eliminar-item')[0].click();
       await new Promise(function(x){ setTimeout(x, 250); });
       var hayCancelar = !!document.getElementById('btn-cancelar-anulacion');
       document.getElementById('btn-cancelar-anulacion').click();
       await new Promise(function(x){ setTimeout(x, 500); });
       var despues = __R.datosContratoFormulario();
       var formVivo = !!document.getElementById('form-contrato');
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === coId; })[0];
       var t = calcularTotalesContrato(co2);
       var anulados = (co2.pagos || []).filter(function(p){ return p.eliminado; }).length;
       return { veredicto: (formVivo && anulados === 0 && t.totalPagos === 4000) ? 'CANDADO OK' : 'ROTO',
                detalle: 'botón cancelar existía=' + hayCancelar + ' · form vivo=' + formVivo + ' con festejado=' + JSON.stringify(despues.festejado) +
                         ' · pagos anulados=' + anulados + ' · totalPagos=$' + t.totalPagos + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

for (const [id, como] of [['M-04', 'la X de la ventana'], ['M-05', 'un clic en el fondo del modal']]) {
  await A({
    id, nombre: 'Cerrar la ventana de arriba con ' + como + ': el formulario de abajo debe seguir vivo con sus datos', dato: 'contrato con datos capturados + ventana de anulación cerrada con ' + como,
    esperado: 'el formulario sobrevive con sus datos', gravedad: 'ALTA', espera: 2000,
    js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM cierre ${id}', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-01-01', estado: 'Pendiente' });
         await new Promise(function(x){ setTimeout(x, 600); });
         var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
         var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM cierre ${id}'; })[0];
         __R.pagoRapido('${cli}', co.id, 2500, 'anticipo', 'dispatch');
         await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
         __R.editarContrato('${cli}', co.id, {});
         await new Promise(function(x){ setTimeout(x, 300); });
         __R.pon('contrato-festejado', 'REDTEAM cierre ${id} EDITADO');
         __R.pon('contrato-direccion-evento', 'Av. Siempre Viva 742');
         window.__A.errores = [];
         document.querySelectorAll('#pagos-lista .btn-eliminar-item')[0].click();
         await new Promise(function(x){ setTimeout(x, 250); });
         ${id === 'M-04' ? "document.getElementById('modal-cerrar').click();" : "document.getElementById('modal').click();"}
         await new Promise(function(x){ setTimeout(x, 600); });
         var despues = __R.datosContratoFormulario();
         var formVivo = !!document.getElementById('form-contrato');
         var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
         var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
         var anulados = (co2.pagos || []).filter(function(p){ return p.eliminado; }).length;
         return { veredicto: (formVivo && despues.festejado === 'REDTEAM cierre ${id} EDITADO' && despues.direccion === 'Av. Siempre Viva 742' && anulados === 0) ? 'CANDADO OK' : 'ROTO',
                  detalle: 'form vivo=' + formVivo + ' · festejado=' + JSON.stringify(despues.festejado) + ' · dirección=' + JSON.stringify(despues.direccion) +
                           ' · pagos anulados=' + anulados + ' (cerrar sin confirmar no debe anular) · errores JS: ' + JSON.stringify(window.__A.errores) };`
  });
}

await A({
  id: 'M-06', nombre: 'Dos ventanas encima: anular cancela y luego confirmar un pago grande; el formulario sobrevive', dato: 'anulación cancelada + pago grande confirmado en el mismo formulario',
  esperado: 'el formulario y sus datos sobreviven a las dos ventanas', gravedad: 'ALTA', espera: 2600,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM dos ventanas', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-02-02', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM dos ventanas'; })[0];
       var coId = co.id;
       __R.pagoRapido('${cli2}', coId, 1000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); }); cerrarModal();
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', 'REDTEAM dos ventanas EDITADO');
       __R.pon('contrato-notas', 'NOTA QUE NO SE DEBE PERDER');
       window.__A.errores = [];
       // 1ª ventana: anulación cancelada
       document.querySelectorAll('#pagos-lista .btn-eliminar-item')[0].click();
       await new Promise(function(x){ setTimeout(x, 250); });
       document.getElementById('btn-cancelar-anulacion').click();
       await new Promise(function(x){ setTimeout(x, 500); });
       // 2ª ventana: pago grande → confirmación
       __R.pagoEnFormulario(9999999);
       await new Promise(function(x){ setTimeout(x, 500); });
       var aviso = __R.hayConfirmacion();
       if (aviso) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       var d = __R.datosContratoFormulario();
       var formVivo = !!document.getElementById('form-contrato');
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === coId; })[0];
       var pagos = (co2.pagos || []).filter(function(p){ return !p.eliminado; }).length;
       return { veredicto: (formVivo && d.festejado === 'REDTEAM dos ventanas EDITADO' && d.notas === 'NOTA QUE NO SE DEBE PERDER' && pagos === 2) ? 'CANDADO OK' : 'ROTO',
                detalle: 'aviso de pago grande=' + aviso + ' · form vivo=' + formVivo + ' · festejado=' + JSON.stringify(d.festejado) + ' · notas=' + JSON.stringify(d.notas) +
                         ' · pagos vigentes en el contrato=' + pagos + ' (deben ser 2) · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

const res = await guardar(caja, '22-evasiones-antirrepeticion-modales');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
