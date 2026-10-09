/* 28-diagnostico-final.mjs — SEGUNDA PASADA: diagnóstico fino de los hallazgos nuevos.
   Ejecutar: node pruebas\sandbox\agente-a\28-diagnostico-final.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Diagnostico final' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

/* ═══ (1) ¿El diálogo de error se lleva el formulario y lo que el practicante escribió? ═══ */

await A({
  id: 'Z-01', nombre: 'Diálogo de error en PROSPECTO: ¿sobrevive el formulario y lo ya escrito?', dato: 'nombre/notas válidos + teléfono "abc" → Guardar',
  esperado: 'que el practicante pueda corregir sin volver a escribir todo', gravedad: 'ALTA', espera: 900,
  js: `__R.prospecto({ nombre: 'REDTEAM escrito a mano', telefono: 'abc', email: '', fase: 'Interesado', notas: 'NOTA IMPORTANTE QUE NO SE DEBE PERDER' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 170);
       var formSigue = !!document.getElementById('form-prospecto');
       var nombreSigue = (document.getElementById('prospecto-nombre') || {}).value;
       return { veredicto: formSigue ? 'CANDADO OK' : 'HUECO',
                detalle: 'el formulario sigue existiendo=' + formSigue + ' · el nombre que había escrito=' + JSON.stringify(nombreSigue) + ' · la pantalla dice: "' + texto + '"' +
                         ' · (mostrarErroresFinancieros usa abrirModal: reemplaza TODO #modal-body)' };`
});

await A({
  id: 'Z-02', nombre: 'Diálogo de error en TAREA: ¿sobrevive el formulario?', dato: 'descripción válida + fecha 1900-01-01 → Guardar',
  esperado: 'poder corregir sin perder lo escrito', gravedad: 'ALTA', espera: 900,
  js: `__R.tarea({ tipo: 'Visita', fecha: '1900-01-01', descripcion: 'REDTEAM tarea escrita a mano', clienteId: '${cli}', notas: 'NOTA DE LA TAREA' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var formSigue = !!document.getElementById('form-tarea');
       var descSigue = (document.getElementById('tarea-descripcion') || {}).value;
       return { veredicto: formSigue ? 'CANDADO OK' : 'HUECO',
                detalle: 'el formulario sigue existiendo=' + formSigue + ' · la descripción escrita=' + JSON.stringify(descSigue) };`
});

await A({
  id: 'Z-03', nombre: 'Diálogo de error en CLIENTE: ¿sobrevive el formulario?', dato: 'nombre/teléfono válidos + correo basura (pegado) → Guardar',
  esperado: 'poder corregir sin perder lo escrito', gravedad: 'ALTA', espera: 900,
  js: `__R.cliente({ nombre: 'REDTEAM cliente escrito', telefono: '5550010001', email: 'no-es-correo', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var formSigue = !!document.getElementById('form-crud');
       var nombreSigue = (document.getElementById('campo-nombre') || {}).value;
       return { veredicto: formSigue ? 'CANDADO OK' : 'HUECO',
                detalle: 'el formulario sigue existiendo=' + formSigue + ' · el nombre escrito=' + JSON.stringify(nombreSigue) };`
});

/* ═══ (2) Antirrepetición en el CONTRATO: ¿se recupera al cerrar y reabrir? (diagnóstico) ═══ */

await A({
  id: 'Z-04', nombre: 'CONTRATO: error de captura → ¿se recupera cerrando y reabriendo? (diagnóstico detallado)', dato: 'sin festejado → error → corregir en el mismo form → cerrar → reabrir → guardar',
  esperado: 'documentar exactamente qué pasa', gravedad: 'ALTA', espera: 2400,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM z04', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2032-01-01', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM z04'; })[0];
       var coId = co.id;
       var pasos = {};
       // Paso 1: abrir la edición y dejar el festejado vacío
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       pasos.formAbiertoAntes = !!document.getElementById('form-contrato');
       __R.pon('contrato-festejado', '');
       __R.limpiarNotis();
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 400); });
       pasos.avisosPaso1 = __R.textoNotis();
       pasos.formSigueTrasError = !!document.getElementById('form-contrato');
       pasos.estadoTrasError = __R.estadoModal();
       // Paso 2: corregir en el MISMO formulario
       __R.pon('contrato-festejado', 'REDTEAM z04 EDITADO');
       __R.limpiarNotis();
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 500); });
       pasos.avisosPaso2 = __R.textoNotis();
       var cA = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       pasos.festejadoTrasPaso2 = cA.contratos.filter(function(x){ return x.id === coId; })[0].festejado;
       // Paso 3: cerrar y reabrir
       if (document.getElementById('form-contrato')) cerrarModal();
       await new Promise(function(x){ setTimeout(x, 300); });
       pasos.formSigueTrasCerrar = !!document.getElementById('form-contrato');
       pasos.modalAbiertoTrasCerrar = __R.estadoModal().abierto;
       __R.editarContrato('${cli2}', coId, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       pasos.formAbiertoTrasReabrir = !!document.getElementById('form-contrato');
       pasos.valorFestejadoTrasReabrir = (document.getElementById('contrato-festejado') || {}).value;
       __R.pon('contrato-festejado', 'REDTEAM z04 REABIERTO');
       __R.limpiarNotis();
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 600); });
       pasos.avisosPaso3 = __R.textoNotis();
       var cB = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       pasos.festejadoTrasPaso3 = cB.contratos.filter(function(x){ return x.id === coId; })[0].festejado;
       return { veredicto: (pasos.festejadoTrasPaso3 === 'REDTEAM z04 REABIERTO') ? 'CANDADO OK' : 'ROTO',
                detalle: JSON.stringify(pasos) };`
});

/* ═══ (3) Cargo normal confirmado: debe persistir ═══ */

await A({
  id: 'Z-05', nombre: '[N-14 corregido] Pago y cargo NORMALES en el contrato, CONFIRMANDO el cargo', dato: 'pago $2,000 + cargo $500 (confirma el aviso de cargo con pagos previos)',
  esperado: 'los dos persisten', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM z05', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2032-02-02', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM z05'; })[0];
       __R.editarContrato('${cli}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pagoEnFormulario(2000);
       await new Promise(function(x){ setTimeout(x, 450); });
       var avisoPago = __R.hayConfirmacion();
       if (avisoPago) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 600); }); }
       __R.cargoEnFormulario('cargo normal', 500);
       await new Promise(function(x){ setTimeout(x, 450); });
       var avisoCargo = __R.hayConfirmacion();
       var textoCargo = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 130);
       if (avisoCargo) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 600); }); }
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 450); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: (t.totalPagos === 2000 && t.totalCargos === 500) ? 'CANDADO OK' : 'ROTO',
                detalle: 'aviso al pago=' + avisoPago + ' · aviso al cargo=' + avisoCargo + ' ("' + textoCargo + '") · en disco: pagos=$' + t.totalPagos + ' cargos=$' + t.totalCargos + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

/* ═══ (4) Divergencia asistente/motor con etapas VÁLIDAS ═══ */

await A({
  id: 'Z-06', nombre: 'Campaña con etapas válidas y fecha IMPOSIBLE: ¿el asistente cree que se creó?', dato: 'etapas válidas + fechaInicio 2029-02-31',
  esperado: 'las dos validaciones deben coincidir', gravedad: 'MEDIA',
  js: `var etapas = [{ nombre: 'Entrada', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: 'Cerrado', orden: 2, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }];
       var borrador = { nombre: 'REDTEAM divergencia 2', tipo: 'captacion', objetivoPrincipal: 'y', fechaInicio: '2029-02-31', fechaFin: '2029-12-31', etapas: etapas, publicoObjetivo: { fuentes: ['redes'], descripcion: '' } };
       var v = App.motor.validarCampania(borrador, { paraActivar: true });
       var c = App.motor.crearCampania(borrador);
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: (v.ok === true && enBase === false) ? 'HUECO' : 'CANDADO OK',
                detalle: 'validarCampania (lo que usa el asistente) ok=' + v.ok + ' errores=' + JSON.stringify(v.errores || []) +
                         ' · crearCampania ok=' + c.ok + ' guardada=' + c.guardada + ' enBase=' + enBase +
                         ' · (si divergen, el asistente deja asi.campaniaId apuntando a una campaña que no existe y avisa que se creó)' };`
});

/* ═══ (5) Datos viejos: ¿se pueden editar? (mis pruebas Y-07/Y-08 estaban rotas por un ";" de más) ═══ */

await A({
  id: 'Z-07', nombre: 'Dato VIEJO: prospecto con teléfono "abc" editado por el formulario de Prospectos', dato: 'legacy telefono="abc" → cambiar solo el nombre → Guardar',
  esperado: 'poder corregir el nombre (o que se explique)', gravedad: 'ALTA', espera: 1000,
  js: `var p = __R.legacyProspecto({ nombre: 'Legado editable', telefono: 'abc', email: '', faseActual: 'Interesado' });
       editarProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('prospecto-nombre', 'Legado editable corregido');
       __R.pulsaGuardar('form-prospecto');
       await new Promise(function(x){ setTimeout(x, 500); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 180);
       var viva = prospectos.filter(function(x){ return x.id === p.id; })[0];
       var formSigue = !!document.getElementById('form-prospecto');
       return { veredicto: (viva.nombre === 'Legado editable corregido') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'nombre=' + JSON.stringify(viva.nombre) + ' · teléfono=' + JSON.stringify(viva.telefono) + ' · formulario vivo=' + formSigue + ' · pantalla="' + texto + '"' };`
});

await A({
  id: 'Z-08', nombre: 'Dato VIEJO: cliente con teléfono "1" editado por el CRUD', dato: 'legacy telefono="1" → cambiar solo el nombre → Guardar',
  esperado: 'poder corregir el nombre (o que se explique)', gravedad: 'ALTA', espera: 1000,
  js: `var c = __R.legacyCliente({ nombre: 'Legado cliente editable', telefono: '1', email: '', estado: 'Activo' });
       CRUD.clientes.editar(c.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('campo-nombre', 'Legado cliente corregido');
       __R.pulsaGuardar('form-crud');
       await new Promise(function(x){ setTimeout(x, 500); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 180);
       var viva = clientes.filter(function(x){ return x.id === c.id; })[0];
       var formSigue = !!document.getElementById('form-crud');
       return { veredicto: (viva.nombre === 'Legado cliente corregido') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'nombre=' + JSON.stringify(viva.nombre) + ' · formulario vivo=' + formSigue + ' · pantalla="' + texto + '"' };`
});

await A({
  id: 'Z-09', nombre: 'CLIENTE duplicado solo por ACENTOS (nombres que no chocan entre sí)', dato: 'existe «Cliente Único Acento» y se crea «CLIENTE UNICO ACENTO» con el mismo teléfono',
  esperado: 'avisar (el importador sí lo detecta)', gravedad: 'ALTA', espera: 1200,
  js: `__R.cliente({ nombre: 'Cliente Único Acento', telefono: '5550020001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.cliente({ nombre: 'CLIENTE UNICO ACENTO', telefono: '5550020001', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var hay = __R.hayConfirmacion();
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 150);
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var cuantos = clientes.filter(function(x){ return soloDigitosTelefono(x.telefono) === '5550020001'; }).length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hay + ' · clientes con ese teléfono=' + cuantos + ' · modal="' + texto + '"' };`
});

const res = await guardar(caja, '28-diagnostico-final');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
