/*
 * pruebas-agente-b.mjs — AGENTE B (equipo azul).
 * ---------------------------------------------------------------------------
 * Comprobaciones PROPIAS de los arreglos que la batería del equipo rojo no puede
 * demostrar por cómo está escrita. Cada una abre el CRM real en la caja de arena.
 *
 *   PB-01  Un pago agregado en el formulario de un contrato YA EXISTENTE se
 *          guarda aunque se cierre sin pulsar «Guardar Contrato» (G-12 real).
 *   PB-02  Anular un pago persiste, deja nota de anulación y cuadra al recargar.
 *   PB-03  Anular un cargo persiste y el formulario del contrato sobrevive.
 *   PB-04  Confirmar un cargo alto NO pierde el cargo ni destruye el formulario.
 *   PB-05  Un prospecto con HTML importado no ejecuta nada en la lista ni en la ficha.
 *   PB-06  Un prospecto viejo sin `faseActual` (creado por campañas) no tumba la lista
 *          y los datos existentes se reparan al entrar.
 *   PB-07  El formulario rechaza teléfonos imposibles y WhatsApp no se abre con ellos.
 *   PB-08  Un contrato gemelo, uno de $0 y una fecha pasada al editar piden confirmación.
 *
 * Uso:  node pruebas\sandbox\agente-b\pruebas-agente-b.mjs
 */
import { abrirCaja } from '../agente-a/comun.mjs';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const fallos = [];
const linea = (ok, texto) => { if (!ok) fallos.push(texto); console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

// abrirCaja deja la caja lista igual que el equipo rojo: instrumenta avisos y errores,
// instala los ayudantes __R.* y siembra la base mínima (2 paquetes y 3 clientes).
const caja = await abrirCaja({ familia: 'Pruebas del equipo azul' });
const s = caja.s;

try {
  const ev = (js) => s.evaluar(js);
  await ev(`(function(){
    window.__B = window.__B || { errores: [] };
    if (!window.__B.instalado) {
      window.__B.instalado = true;
      window.addEventListener('error', function (e) { window.__B.errores.push(String(e.message || e)); });
    }
    return 1;
  })()`);
  const cli = caja.base.clientes[0].id;
  const cli2 = caja.base.clientes[1].id;
  const paq = caja.base.paquetes[0].id;

  console.log('\n▶ Pruebas propias del equipo azul\n');

  /* ── PB-01 · pago dentro del formulario de un contrato existente ── */
  const pb01 = await ev(`(async function () {
    __R.limpiar();
    __R.contrato({ clienteId: '${cli}', festejado: 'PB01', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-04-20', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 600); });
    var c = clientes.filter(function (x) { return x.id === '${cli}'; })[0];
    var co = c.contratos.filter(function (x) { return x.festejado === 'PB01'; })[0];
    var coId = co.id;
    editarContrato('${cli}', coId);
    __R.pagoEnFormulario(2000);
    await new Promise(function (x) { setTimeout(x, 300); });
    cerrarModal();
    await new Promise(function (x) { setTimeout(x, 300); });
    await __R.recargarDeAlmacen();
    await new Promise(function (x) { setTimeout(x, 300); });
    var crudo = __R.contratoCrudo('${cli}', coId);
    return { pagos: (crudo.pagos || []).length, total: calcularTotalesContrato(crudo).totalPagos };
  })()`);
  linea(pb01.pagos === 1 && pb01.total === 2000, 'PB-01 un pago capturado en el formulario se guarda sin pulsar «Guardar Contrato» (G-12)');

  /* ── PB-02/PB-03 · anular un pago y un cargo ── */
  const pb02 = await ev(`(async function () {
    __R.limpiar();
    var c = clientes.filter(function (x) { return x.id === '${cli}'; })[0];
    var co = c.contratos.filter(function (x) { return x.festejado === 'PB01'; })[0];
    var coId = co.id;
    __R.pagoRapido('${cli}', coId, 3000, 'segundo pago', 'dispatch');
    await new Promise(function (x) { setTimeout(x, 400); });
    cerrarModal();
    var tAntes = calcularTotalesContrato(__R.contratoCrudo('${cli}', coId));
    window.__B.errores = [];
    var r = __R.anularPorBoton('${cli}', coId, 'pago', 0, 'pago mal capturado de prueba');
    await new Promise(function (x) { setTimeout(x, 800); });
    await __R.recargarDeAlmacen();
    await new Promise(function (x) { setTimeout(x, 400); });
    var crudo = __R.contratoCrudo('${cli}', coId);
    return {
      totalAntes: tAntes.totalPagos,
      totalDespues: calcularTotalesContrato(crudo).totalPagos,
      eliminados: (crudo.pagos || []).filter(function (p) { return p.eliminado; }).length,
      notas: (crudo.pagos || []).filter(function (p) { return p.esNotaEliminacion; }).length,
      historial: historial.filter(function (h) { return h && String(h.descripcion || '').indexOf('Se anuló pago') !== -1; }).length,
      errores: window.__B.errores.slice()
    };
  })()`);
  linea(pb02.totalAntes === 5000 && pb02.totalDespues === 3000, 'PB-02 anular un pago PERSISTE al recargar ($' + pb02.totalAntes + ' -> $' + pb02.totalDespues + ')');
  linea(pb02.eliminados >= 1 && pb02.notas >= 1 && pb02.historial >= 1, 'PB-02 la anulación deja el pago marcado, su nota y el registro en el historial');
  linea(pb02.errores.length === 0, 'PB-02 anular un pago no lanza ninguna excepción');

  const pb03 = await ev(`(async function () {
    __R.limpiar();
    __R.contrato({ clienteId: '${cli2}', festejado: 'PB03 cargo anular', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-05-05', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 700); });
    var c = clientes.filter(function (x) { return x.id === '${cli2}'; })[0];
    var co = c.contratos.filter(function (x) { return x.festejado === 'PB03 cargo anular'; })[0];
    var coId = co.id;
    editarContrato('${cli2}', coId);
    __R.cargoEnFormulario('cargo a anular', 1500);
    await new Promise(function (x) { setTimeout(x, 300); });
    var vigentesAntes = calcularTotalesContrato(__R.contratoCrudo('${cli2}', coId)).cantidadCargos;
    window.__B.errores = [];
    var r = __R.anularPorBoton('${cli2}', coId, 'cargo', 0, 'cargo mal capturado de prueba');
    await new Promise(function (x) { setTimeout(x, 800); });
    await __R.recargarDeAlmacen();
    await new Promise(function (x) { setTimeout(x, 400); });
    var crudo = __R.contratoCrudo('${cli2}', coId);
    return {
      formularioVivo: !!document.getElementById('form-contrato'),
      vigentesAntes: vigentesAntes,
      cargosEliminados: (crudo.cargos || []).filter(function (x) { return x.eliminado; }).length,
      cargosVigentes: calcularTotalesContrato(crudo).cantidadCargos,
      errores: window.__B.errores.slice()
    };
  })()`);
  linea(pb03.vigentesAntes >= 1 && pb03.cargosEliminados >= 1 && pb03.cargosVigentes === pb03.vigentesAntes - 1,
    'PB-03 anular un cargo PERSISTE y el cargo deja de contar (' + pb03.vigentesAntes + ' -> ' + pb03.cargosVigentes + ' vigentes, ' + pb03.cargosEliminados + ' anulado)');
  linea(pb03.formularioVivo === true && pb03.errores.length === 0, 'PB-03 tras anular, el formulario del contrato sigue en pie y sin excepciones');

  /* ── PB-04 · confirmar un cargo alto (en su propio contrato, para no ensuciar PB-03) ── */
  const pb04 = await ev(`(async function () {
    __R.limpiar();
    __R.contrato({ clienteId: '${cli}', festejado: 'PB04 cargo alto', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-09-09', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 700); });
    var c = clientes.filter(function (x) { return x.id === '${cli}'; })[0];
    var co = c.contratos.filter(function (x) { return x.festejado === 'PB04 cargo alto'; })[0];
    var coId = co.id;
    var cargosBase = (co.cargos || []).length;
    var totalBase = calcularTotalesContrato(co).totalAPagar;
    editarContrato('${cli}', coId);
    window.__B.errores = [];
    __R.cargoEnFormulario('cargo gigante', 9999999);
    await new Promise(function (x) { setTimeout(x, 400); });
    var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
    if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
    await new Promise(function (x) { setTimeout(x, 500); });
    var formVivo = !!document.getElementById('form-contrato');
    var envio = __R.enviar('form-contrato', 'dispatch');
    await new Promise(function (x) { setTimeout(x, 800); });
    await __R.recargarDeAlmacen();
    await new Promise(function (x) { setTimeout(x, 400); });
    var crudo = __R.contratoCrudo('${cli}', coId);
    return {
      hayConfirmar: hayConfirmar, formVivo: formVivo, envio: envio,
      cargosBase: cargosBase, totalBase: totalBase,
      cargos: (crudo.cargos || []).filter(function (x) { return !x.eliminado; }).length,
      total: calcularTotalesContrato(crudo).totalAPagar,
      errores: window.__B.errores.slice()
    };
  })()`);
  linea(pb04.hayConfirmar === true && pb04.formVivo === true, 'PB-04 confirmar un cargo alto pide confirmación y NO destruye el formulario');
  // El cargo confirmado sobrevive y suma: se compara con tolerancia de un centavo porque
  // los importes se redondean a 2 decimales en cada paso.
  // El cargo confirmado sobrevive y SUMA al total. Se comprueba que el total crezca al menos
  // el importe confirmado (puede haber más cargos del flujo) y que el cargo esté en el contrato.
  const pb04Suma = (pb04.total - pb04.totalBase) >= 9999999 - 0.02;
  linea(pb04.cargos >= 1 && pb04Suma, 'PB-04 el cargo confirmado se guarda (cargos 0->' + pb04.cargos + ' · $' + pb04.totalBase + ' + $9,999,999 = $' + pb04.total + ') y no se pierde');
  linea(pb04.envio === 'dispatchEvent', 'PB-04 el envío posterior del contrato ya no queda sin formulario (' + pb04.envio + ')');  linea(pb04.errores.length === 0, 'PB-04 confirmar un cargo alto no lanza ninguna excepción');

  /* ── PB-05 · XSS por importación ── */
  const pb05 = await ev(`(async function () {
    var texto = 'Nombre\\tTelefono\\tEmail\\n<img src=x onerror=window.__B.xss=7>\\t8789990011\\txss@correo.com';
    __R.importarTexto(texto, 'xss.csv');
    await new Promise(function (x) { setTimeout(x, 400); });
    var p = prospectos.filter(function (x) { return x.telefono === '8789990011' || x.telefono === '8789990011'; })[0];
    guardarVista('prospectos', 'lista');
    renderizarProspectos();
    await new Promise(function (x) { setTimeout(x, 500); });
    var cont = document.getElementById('lista-prospectos');
    var imgLista = !!cont.querySelector('img[src="x"]');
    if (p) verDetalleProspecto(p.id);
    await new Promise(function (x) { setTimeout(x, 500); });
    var imgFicha = !!document.getElementById('modal-body').querySelector('img[src="x"]');
    return { guardado: p ? p.nombre : null, imgLista: imgLista, imgFicha: imgFicha, xss: window.__B.xss || 0 };
  })()`);
  linea(pb05.guardado !== null && String(pb05.guardado).indexOf('<') === -1, 'PB-05 un nombre con HTML importado se guarda saneado (' + JSON.stringify(String(pb05.guardado).slice(0, 50)) + ')');
  linea(!pb05.imgLista && !pb05.imgFicha && !pb05.xss, 'PB-05 no se inyecta HTML ni se ejecuta código en la lista ni en la ficha (P-11, P-12)');

  /* ── PB-06 · prospecto viejo sin faseActual ── */
  const pb06 = await ev(`(async function () {
    // Se simula un prospecto como los que dejó el motor de campañas viejo: sin faseActual.
    prospectos.push({ id: 'pro_viejo_pb', nombre: 'Prospecto Viejo', telefono: '8780000000', email: '', faseComercial: 'Cotización', historialFases: [], fechaRegistro: '2027-01-01', notasGenerales: '', clienteId: null });
    guardarVista('prospectos', 'lista');
    var excepcion = null;
    try { renderizarProspectos(); } catch (e) { excepcion = String(e.message || e); }
    await new Promise(function (x) { setTimeout(x, 300); });
    var filas = document.querySelectorAll('#lista-prospectos .lista-fila').length;
    // Y la reparación al entrar los datos: normalizarRegistros le pone faseActual.
    normalizarRegistros();
    var p = prospectos.filter(function (x) { return x.id === 'pro_viejo_pb'; })[0];
    return { excepcion: excepcion, filas: filas, faseActual: p ? p.faseActual : null };
  })()`);
  linea(pb06.excepcion === null && pb06.filas > 0, 'PB-06 un prospecto sin faseActual no tumba la lista de Prospectos (' + pb06.filas + ' filas)');
  linea(pb06.faseActual === 'Cotización', 'PB-06 los datos existentes se reparan al entrar: faseActual = ' + JSON.stringify(pb06.faseActual) + ' (P-15)');

  /* ── PB-07 · teléfonos ── */
  const pb07 = await ev(`(function () {
    var casos = ['abc', '1', '1111111111', '\\uD83D\\uDCDE\\uD83D\\uDCDE', '+', '1234567890123456789012345678901234567890'];
    var rechazados = casos.filter(function (v) { return !validarTelefonoCapturado(v).ok; }).length;
    var buenos = ['8781234567', '878-123-4567', '5218781234567', ''].filter(function (v) { return validarTelefonoCapturado(v).ok; }).length;
    return { casos: casos.length, rechazados: rechazados, buenos: buenos };
  })()`);
  linea(pb07.rechazados === pb07.casos, 'PB-07 el candado rechaza los ' + pb07.casos + ' teléfonos imposibles (letras, 1 dígito, repetido, emoji, +, 40 dígitos)');
  linea(pb07.buenos === 4, 'PB-07 y sigue aceptando los teléfonos legítimos (10 dígitos, con guiones, con lada, y el vacío opcional)');

  const pb07b = await ev(`(async function () {
    __R.limpiar();
    // Se fuerza un cliente con teléfono basura para probar el botón de WhatsApp.
    clientes.push({ id: 'cli_pb_wa', nombre: 'Cliente WhatsApp PB', telefono: '1', email: '', estado: 'Activo', fechaRegistro: '2027-01-01', contratos: [] });
    var capturada = null;
    var original = window.open;
    window.open = function (u) { capturada = u; return null; };
    try { enviarWhatsAppCliente('cli_pb_wa'); } finally { window.open = original; }
    clientes = clientes.filter(function (c) { return c.id !== 'cli_pb_wa'; });
    return { url: capturada, aviso: (document.querySelector('.notificacion') || {}).textContent || '' };
  })()`);
  linea(!pb07b.url, 'PB-07 la app se NIEGA a abrir WhatsApp con un teléfono basura (no abre wa.me/1)');

  /* ── PB-08 · confirmaciones de contrato ── */
  const pb08 = await ev(`(async function () {
    // Contrato de referencia.
    __R.limpiar();
    __R.contrato({ clienteId: '${cli2}', festejado: 'PB08 gemelo', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-06-06', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 600); });
    var antes = obtenerContratos().filter(function (c) { return c.festejado === 'PB08 gemelo'; }).length;
    // Se intenta el gemelo: debe aparecer la ventana de confirmación y no guardar nada.
    __R.contrato({ clienteId: '${cli2}', festejado: 'PB08 gemelo', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-06-06', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 500); });
    var hayGemelo = !!document.getElementById('btn-confirmar-financiero');
    var formVivo = !!document.getElementById('form-contrato');
    var durante = obtenerContratos().filter(function (c) { return c.festejado === 'PB08 gemelo'; }).length;
    cerrarModal();
    await new Promise(function (x) { setTimeout(x, 400); });
    // Contrato de $0 con el paquete en cero.
    __R.paquete({ nombre: 'PB08 paquete cero', descripcion: 'sin precio', precio: 0, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo' }, 'dispatch');
    await new Promise(function (x) { setTimeout(x, 400); });
    var pq0 = paquetes.filter(function (p) { return p.nombre === 'PB08 paquete cero'; })[0];
    __R.contrato({ clienteId: '${cli2}', festejado: 'PB08 cero', tipo: 'paquete', paqueteId: pq0.id, fechaEvento: '2028-06-07', estado: 'Pendiente' });
    await new Promise(function (x) { setTimeout(x, 500); });
    var hayCero = !!document.getElementById('btn-confirmar-financiero');
    cerrarModal();
    await new Promise(function (x) { setTimeout(x, 400); });
    return {
      antes: antes, durante: durante, hayGemelo: hayGemelo, formVivo: formVivo, hayCero: hayCero,
      ceroGuardado: obtenerContratos().filter(function (c) { return c.festejado === 'PB08 cero'; }).length
    };
  })()`);
  linea(pb08.hayGemelo === true && pb08.durante === pb08.antes, 'PB-08 un contrato gemelo pide confirmación y no se guarda solo (K-06)');
  linea(pb08.formVivo === true, 'PB-08 la ventana de confirmación devuelve el formulario del contrato intacto');
  linea(pb08.hayCero === true && pb08.ceroGuardado === 0, 'PB-08 un contrato de $0 avisa y pide confirmación antes de guardarlo (K-09)');

  const pb08b = await ev(`(async function () {
    var c = clientes.filter(function (x) { return x.id === '${cli2}'; })[0];
    var co = c.contratos.filter(function (x) { return x.festejado === 'PB08 gemelo'; })[0];
    __R.editarContrato('${cli2}', co.id, { 'contrato-fecha-evento': '2020-05-05' }, 'dispatch');
    await new Promise(function (x) { setTimeout(x, 600); });
    var hay = !!document.getElementById('btn-confirmar-financiero');
    var titulo = (document.getElementById('modal-titulo') || {}).textContent || '';
    cerrarModal();
    await new Promise(function (x) { setTimeout(x, 300); });
    var despues = __R.contratoCrudo('${cli2}', co.id);
    return { hay: hay, titulo: titulo, fecha: despues.fechaEvento };
  })()`);
  linea(pb08b.hay === true && pb08b.fecha === '2028-06-06', 'PB-08 poner la fecha del evento en el pasado al editar avisa y no se guarda solo (K-12)');
} finally {
  const red = await s.cerrar();
  console.log('\n   Red: ' + red.peticiones + ' peticiones · a los datos reales: ' + (red.prohibidas.filter((h) => h !== 'gstatic.com').length ? 'REVISAR' : 'ninguna'));
}

console.log('\n' + (fallos.length === 0 ? 'TODO EN VERDE: los ' + 8 + ' arreglos del equipo azul quedaron demostrados.' : fallos.length + ' comprobaciones fallaron.'));
fallos.forEach((f) => console.log('   · ' + f));
process.exitCode = fallos.length === 0 ? 0 : 1;
