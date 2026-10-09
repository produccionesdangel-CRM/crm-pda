/*
 * comun.mjs — arnés del AGENTE A (equipo rojo) para la auditoría del CRM PDA v5.0.
 * ---------------------------------------------------------------------------
 * NO toca index.html ni sandbox.mjs. Solo usa la caja de arena.
 *
 * Qué aporta:
 *   1. abrirCaja()      -> prepara + abre + entra + revisa aislamiento + siembra
 *   2. instrumentar()   -> graba notificaciones y errores de JavaScript de la app
 *   3. baseMinima()     -> crea 2 paquetes y 3 clientes por los formularios REALES
 *   4. ataque()         -> ejecuta un ataque, captura veredicto + evidencia
 *   5. guardar()        -> deja el resultado en resultados/<familia>.json
 *
 * Uso típico (un script por familia):
 *   import { abrirCaja, ataque, guardar, foto } from './comun.mjs';
 *   const c = await abrirCaja();
 *   await ataque(c, { id:'F1', nombre:'...', dato:'...', esperado:'...',
 *                     gravedad:'ALTA', js:`... return {veredicto:'HUECO', detalle:'...'};` });
 *   await guardar(c, 'fechas');
 *   await c.s.cerrar();
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from '../sandbox.mjs';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
/* Segunda pasada: la carpeta de salida se puede cambiar con la variable de entorno
   AGENTE_A_RESULTADOS para no pisar las corridas anteriores (resultados/ y
   resultados-024-antes/ las escribió el equipo azul con copias corregidas de mis scripts). */
export const RESULTADOS = path.join(AQUI, process.env.AGENTE_A_RESULTADOS || 'resultados');
fs.mkdirSync(RESULTADOS, { recursive: true });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─────────────────────────── Instrumentación ─────────────────────────── */

const JS_INSTRUMENTAR = `(function () {
  window.__A = window.__A || { notis: [], errores: [], marcas: [] };
  if (!window.__A.instalado) {
    window.__A.instalado = true;
    var orig = window.mostrarNotificacion;
    if (typeof orig === 'function') {
      window.mostrarNotificacion = function (m, t) {
        try { window.__A.notis.push({ m: String(m), t: t || 'info' }); } catch (e) {}
        return orig.apply(this, arguments);
      };
    }
    window.addEventListener('error', function (e) {
      try { window.__A.errores.push(String((e && e.message) || e)); } catch (x) {}
    });
    window.addEventListener('unhandledrejection', function (e) {
      try {
        var r = e && e.reason;
        window.__A.errores.push('promesa: ' + String((r && r.message) || r));
      } catch (x) {}
    });
  }
  return { notificacionInstrumentada: typeof window.mostrarNotificacion === 'function', sandbox: (typeof SANDBOX !== 'undefined' && SANDBOX === true) };
})()`;

/* ─────────── Biblioteca de ataque dentro de la página (usa lo REAL) ───────────
   Todas las funciones abren el modal real, escriben en el campo real y disparan
   el envío real. 'modo' elige cómo se envía:
     'dispatch' -> form.dispatchEvent(new Event('submit'))  (simula pegado/autocompletado)
     'request'  -> form.requestSubmit()                     (lo que hace un clic real)
     'click'    -> botón submit .click()                    (clic real de botón)
*/
const JS_BIBLIOTECA = `(function () {
  var R = {};
  R.modal = function () { return document.getElementById('modal-body'); };
  R.limpiar = function () {
    try { cerrarModal(); } catch (e) {}
    var b = R.modal(); if (b) b.innerHTML = '';
    // v5.0.25: el "aparcadero" de modales. Si quedara algo aparcado, un cerrarModal()
    // posterior lo devolvería y ensuciaría la prueba siguiente.
    try {
      var caja = document.getElementById('modal-aparcadero');
      if (caja) { while (caja.firstChild) caja.removeChild(caja.firstChild); caja.dataset.aparcado = '0'; caja.dataset.titulo = ''; }
      if (typeof retornoModalPendiente !== 'undefined') retornoModalPendiente = false;
    } catch (e) {}
  };
  R.el = function (id) { return document.getElementById(id); };
  R.v = function (id) { var e = R.el(id); return e ? e.value : null; };
  R.pon = function (id, valor) {
    var e = R.el(id); if (!e) return 'no-existe:' + id;
    if (e.tagName === 'INPUT' && e.type === 'number') { e.value = String(valor); }
    else if (e.tagName === 'INPUT' && e.type === 'date') { e.value = String(valor); }
    else { e.value = String(valor); }
    return e.value;   // devuelve lo que el navegador ACEPTÓ (clave para fechas y números)
  };
  R.ponSelect = function (id, valor) {
    var e = R.el(id); if (!e) return 'no-existe:' + id;
    e.value = String(valor);
    if (e.value !== String(valor)) return 'RECHAZADO(quedo=' + e.value + ')';
    return e.value;
  };
  R.enviar = function (formId, modo) {
    var f = R.el(formId); if (!f) return 'no-existe:' + formId;
    modo = modo || 'dispatch';
    if (modo === 'request') { if (typeof f.requestSubmit === 'function') { f.requestSubmit(); return 'requestSubmit'; } return 'sin-requestSubmit'; }
    if (modo === 'click') { var b = f.querySelector('button[type=submit]'); if (b) { b.click(); return 'click'; } return 'sin-boton'; }
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return 'dispatchEvent';
  };
  R.notis = function () { return (window.__A && window.__A.notis) || []; };
  R.textoNotis = function () { return R.notis().map(function (n) { return n.t + ': ' + n.m; }); };
  R.limpiarNotis = function () { if (window.__A) { window.__A.notis = []; window.__A.errores = []; } };

  /* ── Alta de registros por los formularios REALES ── */
  R.prospecto = function (d, modo) {
    R.limpiar(); mostrarFormularioProspecto(null);
    R.pon('prospecto-nombre', d.nombre === undefined ? '' : d.nombre);
    R.pon('prospecto-telefono', d.telefono === undefined ? '' : d.telefono);
    R.pon('prospecto-email', d.email === undefined ? '' : d.email);
    if (d.fase !== undefined) R.ponSelect('prospecto-fase', d.fase);
    R.pon('prospecto-notas', d.notas === undefined ? '' : d.notas);
    var leido = { nombre: R.v('prospecto-nombre'), telefono: R.v('prospecto-telefono'), email: R.v('prospecto-email'), fase: R.v('prospecto-fase') };
    var como = R.enviar('form-prospecto', modo || 'dispatch');
    return { leido: leido, envio: como };
  };

  R.cliente = function (d, modo) {
    R.limpiar(); CRUD.clientes.nuevo();
    R.pon('campo-nombre', d.nombre === undefined ? '' : d.nombre);
    R.pon('campo-telefono', d.telefono === undefined ? '' : d.telefono);
    R.pon('campo-email', d.email === undefined ? '' : d.email);
    if (d.estado !== undefined) R.ponSelect('campo-estado', d.estado);
    R.pon('campo-notasGenerales', d.notasGenerales === undefined ? '' : d.notasGenerales);
    var leido = { nombre: R.v('campo-nombre'), telefono: R.v('campo-telefono'), email: R.v('campo-email'), estado: R.v('campo-estado') };
    var como = R.enviar('form-crud', modo || 'dispatch');
    return { leido: leido, envio: como };
  };

  /* Cliente rápido: el botón "Nuevo" dentro del formulario de contrato. */
  R.clienteRapido = function (d, modo) {
    R.limpiar();
    abrirModalNuevoClienteRapido(null);
    R.pon('nc-nombre', d.nombre === undefined ? '' : d.nombre);
    R.pon('nc-telefono', d.telefono === undefined ? '' : d.telefono);
    R.pon('nc-email', d.email === undefined ? '' : d.email);
    if (d.estado !== undefined) R.ponSelect('nc-estado', d.estado);
    var como = R.enviar('form-nuevo-cliente-rapido', modo || 'dispatch');
    return { envio: como };
  };

  R.paquete = function (d, modo) {
    R.limpiar(); mostrarFormularioPaquete(null);
    R.pon('paquete-nombre', d.nombre === undefined ? '' : d.nombre);
    R.pon('paquete-descripcion', d.descripcion === undefined ? 'x' : d.descripcion);
    R.pon('paquete-precio', d.precio === undefined ? 0 : d.precio);
    R.pon('paquete-descuento', d.descuento === undefined ? 0 : d.descuento);
    R.pon('paquete-vigencia', d.vigencia === undefined ? '2027-12-31' : d.vigencia);
    if (d.estatus !== undefined) R.ponSelect('paquete-estatus', d.estatus);
    var como = R.enviar('form-paquete', modo || 'dispatch');
    return { envio: como, precioLeido: R.v('paquete-precio'), vigenciaLeida: R.v('paquete-vigencia') };
  };

  R.tarea = function (d, modo) {
    R.limpiar();
    var pre = (d.clienteId === undefined ? null : d.clienteId);
    mostrarFormularioTarea(null, pre, null);
    R.pon('tarea-tipo', d.tipo === undefined ? 'Llamar' : d.tipo);
    R.pon('tarea-cliente', d.clienteId === undefined ? '' : d.clienteId);
    R.pon('tarea-fecha', d.fecha === undefined ? '' : d.fecha);
    R.pon('tarea-descripcion', d.descripcion === undefined ? '' : d.descripcion);
    R.pon('tarea-notas', d.notas === undefined ? '' : d.notas);
    var leido = { tipo: R.v('tarea-tipo'), clienteId: R.v('tarea-cliente'), fecha: R.v('tarea-fecha'), descripcion: R.v('tarea-descripcion') };
    var como = R.enviar('form-tarea', modo || 'dispatch');
    return { leido: leido, envio: como };
  };

  /* Contrato por el formulario real. */
  R.contrato = function (d, modo) {
    R.limpiar();
    mostrarFormularioContrato(d.clienteId || null);
    R.pon('contrato-cliente-id', d.clienteId === undefined ? '' : d.clienteId);
    R.pon('contrato-festejado', d.festejado === undefined ? '' : d.festejado);
    R.ponSelect('contrato-tipo', d.tipo || 'paquete');
    if ((d.tipo || 'paquete') === 'paquete' && d.paqueteId) {
      R.ponSelect('contrato-paquete', d.paqueteId);
    }
    var fechaPedida = d.fechaEvento === undefined ? '' : d.fechaEvento;
    R.pon('contrato-fecha-evento', fechaPedida);
    var fechaAceptada = R.v('contrato-fecha-evento');
    if (d.direccionEvento !== undefined) R.pon('contrato-direccion-evento', d.direccionEvento);
    if (d.notas !== undefined) R.pon('contrato-notas', d.notas);
    if (d.estado !== undefined) R.ponSelect('contrato-estado', d.estado);
    var como = R.enviar('form-contrato', modo || 'dispatch');
    return { fechaPedida: fechaPedida, fechaAceptada: fechaAceptada, envio: como };
  };

  /* Contrato ya existente: abrir su EDICIÓN real y volver a guardar. */
  R.editarContrato = function (clienteId, contratoId, cambios, modo) {
    R.limpiar();
    editarContrato(clienteId, contratoId);
    cambios = cambios || {};
    Object.keys(cambios).forEach(function (k) { R.pon(k, cambios[k]); });
    var como = R.enviar('form-contrato', modo || 'dispatch');
    return { envio: como };
  };

  /* Pago rápido (botón de monedas del listado de contratos). */
  R.pagoRapido = function (clienteId, contratoId, monto, nota, modo) {
    R.limpiar();
    agregarPagoRapido(clienteId, contratoId);
    var puesto = R.pon('pago-rapido-monto', monto);
    if (nota !== undefined) R.pon('pago-rapido-nota', nota);
    var como = R.enviar('form-pago-rapido', modo || 'dispatch');
    return { montoPedido: monto, montoAceptadoPorInput: puesto, envio: como };
  };

  /* Pago/cargo/descuento DENTRO del formulario de contrato. */
  R.pagoEnFormulario = function (monto, modo) {
    R.pon('contrato-nuevo-pago', monto);
    var aceptado = R.v('contrato-nuevo-pago');
    var b = R.el('btn-agregar-pago'); if (b) b.click();
    return { montoPedido: monto, montoAceptado: aceptado };
  };
  R.cargoEnFormulario = function (desc, monto) {
    R.pon('cargo-descripcion', desc === undefined ? '' : desc);
    R.pon('cargo-monto', monto);
    var aceptado = R.v('cargo-monto');
    var b = R.el('btn-agregar-cargo'); if (b) b.click();
    return { montoPedido: monto, montoAceptado: aceptado };
  };
  R.descuentoEnFormulario = function (desc, monto) {
    R.pon('descuento-descripcion', desc === undefined ? '' : desc);
    R.pon('descuento-monto', monto);
    var b = R.el('btn-aplicar-descuento'); if (b) b.click();
    return { montoPedido: monto, montoAceptado: R.v('descuento-monto') };
  };
  R.confirmarPagoOFondos = function () {
    /* Los avisos financieros abren un modal de confirmación. */
    var b = R.el('btn-confirmar-financiero') || R.el('btn-confirmar-operacion') || R.el('btn-confirmar');
    if (b) { b.click(); return 'confirmado'; }
    return 'sin-boton-confirmar';
  };

  /* ── Lecturas del almacén ── */
  R.prospectos = function () { return prospectos.map(function (p) { return { id: p.id, nombre: p.nombre, telefono: p.telefono, email: p.email, fase: p.faseActual, clienteId: p.clienteId, notas: p.notasGenerales }; }); };
  R.clientes = function () { return clientes.map(function (c) { return { id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email, estado: c.estado, contratos: (c.contratos || []).length }; }); };
  R.contratos = function () {
    var out = [];
    clientes.forEach(function (c) {
      (c.contratos || []).forEach(function (co) {
        var t = calcularTotalesContrato(co);
        out.push({
          clienteId: c.id, cliente: c.nombre, id: co.id, festejado: co.festejado, tipo: co.tipo,
          fechaEvento: co.fechaEvento, precioBase: co.precioBase, precioFinal: co.precioFinal,
          descuentoMonto: co.descuentoMonto, totalAPagar: t.totalAPagar, totalPagos: t.totalPagos,
          cantidadPagos: t.cantidadPagos, cantidadCargos: t.cantidadCargos, saldoBruto: t.saldoBruto,
          pagos: (co.pagos || []).length, cargos: (co.cargos || []).length,
          alertas: t.alertas.map(function (a) { return a.tipo; })
        });
      });
    });
    return out;
  };
  R.contratoCrudo = function (clienteId, contratoId) {
    var c = obtenerCliente(clienteId); if (!c) return null;
    var co = (c.contratos || []).filter(function (x) { return x.id === contratoId; })[0];
    return co ? JSON.parse(JSON.stringify(co)) : null;
  };
  R.tareas = function () { return tareas.map(function (t) { return { id: t.id, tipo: t.tipo, fecha: t.fecha, descripcion: t.descripcion, clienteId: t.clienteId, completada: t.completada }; }); };
  R.campanias = function () { return campanias.map(function (c) { return { id: c.id, nombre: c.nombre, estado: c.estado, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, etapas: (c.etapas || []).length }; }); };
  R.participaciones = function () { return participaciones.map(function (p) { return { id: p.id, campaignId: p.campaignId, prospectId: p.prospectId, etapaId: p.etapaId, estado: p.estado }; }); };
  R.papelera = function () { return papelera.map(function (x) { return { tipo: x.tipo, nombre: (x.item && (x.item.nombre || x.item.festejado)) || '' }; }); };

  R.cauntos = function (q) { return prospectos.filter(function (p) { return (p.nombre || '').indexOf(q) !== -1; }).length; };
  R.clientesCon = function (q) { return clientes.filter(function (c) { return (c.nombre || '').indexOf(q) !== -1; }).length; };

  /* Coherencia global pedida en la familia 10. */
  R.invariantes = function () {
    var filas = [], problemas = [];
    var sumaAPagar = 0, sumaPagos = 0, sumaSaldos = 0;
    clientes.forEach(function (c) {
      (c.contratos || []).forEach(function (co) {
        var t = calcularTotalesContrato(co);
        sumaAPagar += t.totalAPagar; sumaPagos += t.totalPagos; sumaSaldos += t.saldoBruto;
        var pagosVigentes = (co.pagos || []).filter(function (p) { return p && !p.eliminado && !p.esNotaEliminacion; });
        var sumaManual = pagosVigentes.reduce(function (s, p) { return s + (Number(p.monto) || 0); }, 0);
        if (Math.abs(Number(sumaManual.toFixed(2)) - t.totalPagos) > 0.004) {
          problemas.push({ tipo: 'suma_pagos_no_cuadra', cliente: c.nombre, contrato: co.id, manual: Number(sumaManual.toFixed(2)), calculado: t.totalPagos });
        }
        var calculo = Number((t.precioEfectivo + t.totalCargos - t.descuento).toFixed(2));
        if (Math.abs(calculo - t.totalAPagar) > 0.004) {
          problemas.push({ tipo: 'total_no_cuadra', cliente: c.nombre, contrato: co.id, calculo: calculo, totalAPagar: t.totalAPagar });
        }
        var recalc = Number((t.totalAPagar - t.totalPagos).toFixed(2));
        if (Math.abs(recalc - t.saldoBruto) > 0.004) {
          problemas.push({ tipo: 'saldo_no_cuadra', cliente: c.nombre, contrato: co.id, recalc: recalc, saldo: t.saldoBruto });
        }
        filas.push({ cliente: c.nombre, contrato: co.id, totalAPagar: t.totalAPagar, totalPagos: t.totalPagos, saldoBruto: t.saldoBruto });
      });
    });
    /* Referencias colgadas */
    tareas.forEach(function (t) {
      if (!t.clienteId) return;
      var id = String(t.clienteId).indexOf('pro_') === 0 ? String(t.clienteId).slice(4) : t.clienteId;
      var esProspecto = String(t.clienteId).indexOf('pro_') === 0;
      var existe = esProspecto
        ? prospectos.some(function (p) { return p.id === id; })
        : clientes.some(function (c) { return c.id === id; });
      if (!existe) problemas.push({ tipo: 'tarea_huerfana', tarea: t.id, clienteId: t.clienteId });
    });
    participaciones.forEach(function (p) {
      if (!prospectos.some(function (x) { return x.id === p.prospectId; })) problemas.push({ tipo: 'participacion_huerfana_prospecto', participacion: p.id, prospectId: p.prospectId });
      if (!campanias.some(function (x) { return x.id === p.campaignId; })) problemas.push({ tipo: 'participacion_huerfana_campania', participacion: p.id, campaignId: p.campaignId });
    });
    clientes.forEach(function (c) {
      (c.contratos || []).forEach(function (co) {
        if (co.paqueteId && !paquetes.some(function (p) { return p.id === co.paqueteId; })) problemas.push({ tipo: 'contrato_paquete_huerfano', contrato: co.id, paqueteId: co.paqueteId });
        if (co.servicioId && !serviciosAdicionales.some(function (s) { return s.id === co.servicioId; })) problemas.push({ tipo: 'contrato_servicio_huerfano', contrato: co.id });
      });
    });
    return {
      sumaAPagar: Number(sumaAPagar.toFixed(2)), sumaPagos: Number(sumaPagos.toFixed(2)), sumaSaldos: Number(sumaSaldos.toFixed(2)),
      clientes: clientes.length, prospectos: prospectos.length, contratos: obtenerContratos().length,
      tareas: tareas.length, campanias: campanias.length, participaciones: participaciones.length, papelera: papelera.length,
      problemas: problemas, filas: filas
    };
  };

  /* ── Utilidades de apoyo ── */
  /* Recarga los datos desde el almacén (IndexedDB) para ver si algo se guardó de verdad. */
  R.recargarDeAlmacen = function () { return cargarDatosLocal(); };

  /* WhatsApp: se intercepta window.open para capturar la URL que la app ABRIRÍA,
     sin salir a internet. */
  R.waUrl = function (clienteId) {
    var capturada = null;
    var original = window.open;
    window.open = function (u) { capturada = u; return null; };
    try { enviarWhatsAppCliente(clienteId); } finally { window.open = original; }
    return capturada;
  };

  /* Anula un pago con el flujo real: abrir el contrato y usar el botón de anular. */
  R.anularPago = function (clienteId, contratoId, pagoId, motivo, confirmar) {
    R.limpiar();
    editarContrato(clienteId, contratoId);
    if (!window.PDA || typeof window.PDA.eliminarMovimientoContrato !== 'function') return { error: 'sin-funcion-anular' };
    window.PDA.eliminarMovimientoContrato('pago', pagoId);
    var campo = document.getElementById('motivo-anulacion');
    if (!campo) return { error: 'sin-campo-motivo' };
    campo.value = motivo === undefined ? 'prueba de anulación agente A' : motivo;
    var boton = document.getElementById('btn-confirmar-anulacion');
    if (!boton) return { error: 'sin-boton-anular' };
    if (confirmar !== false) boton.click();
    return { ok: true };
  };

  /* Segundo disparo del mismo formulario ya cerrado (simula pegado/autocompletado o
     un envío repetido antes de que el modal desaparezca). */
  R.reenviar = function (formId, modo) { return R.enviar(formId, modo || 'dispatch'); };

  R.campaniaActiva = function () { return campanias.filter(function (c) { return c.estado === 'activa'; })[0] || null; };

  /* Importa texto por el mismo camino que el botón de importar del CRM. */
  R.importarTexto = function (texto, nombre) {
    var a = window.ImportarProspectos.analizarTexto(texto, nombre || 'red-team.csv');
    var r = window.ImportarProspectos.importar(a.analisis.nuevas);
    return { analisis: { nuevas: a.analisis.nuevas.length, duplicadas: a.analisis.duplicadas.length, repetidas: a.analisis.repetidas.length }, creados: r.creados.length };
  };

  R.verLista = function (seccion) {
    guardarVista(seccion || 'prospectos', 'lista');
    if (seccion === 'clientes') renderizarClientes();
    else if (seccion === 'contratos') renderizarContratos();
    else renderizarProspectos();
  };

  /* Anula un movimiento con el CLIC REAL del botón de basura del listado del
     contrato (el mismo que usa un practicante), y devuelve todo lo observable. */
  R.anularPorBoton = function (clienteId, contratoId, tipo, indice, motivo) {
    R.limpiar();
    editarContrato(clienteId, contratoId);
    var sel = tipo === 'cargo' ? '#cargos-lista .btn-eliminar-item' : '#pagos-lista .btn-eliminar-item';
    var botones = document.querySelectorAll(sel);
    if (!botones.length) return { error: 'sin-botones-anular', cuantos: 0 };
    var objetivo = botones[indice || 0];
    if (!objetivo) return { error: 'indice-fuera', cuantos: botones.length };
    objetivo.click();
    var campo = document.getElementById('motivo-anulacion');
    if (!campo) return { error: 'sin-campo-motivo' };
    campo.value = motivo === undefined ? 'motivo de prueba del agente A' : motivo;
    var conf = document.getElementById('btn-confirmar-anulacion');
    if (!conf) return { error: 'sin-boton-confirmar' };
    var formAntes = !!document.getElementById('form-contrato');
    conf.click();
    return {
      ok: true, botones: botones.length, formContratoAntesDeConfirmar: formAntes,
      formContratoDespuesDeConfirmar: !!document.getElementById('form-contrato'),
      modalSigueAbierto: document.getElementById('modal').classList.contains('active'),
      notis: R.textoNotis(), errores: (window.__A.errores || []).slice()
    };
  };

  /* ══════════════════ Utilidades de la SEGUNDA PASADA ══════════════════ */

  /* Estado de la pila de modales: cuántos nodos hay aparcados y si el modal
     sigue abierto. Sirve para comprobar el "aparcadero" nuevo. */
  R.estadoModal = function () {
    var modal = document.getElementById('modal');
    var caja = document.getElementById('modal-aparcadero');
    var body = document.getElementById('modal-body');
    return {
      abierto: !!(modal && modal.classList.contains('active')),
      titulo: (document.getElementById('modal-titulo') || {}).textContent || '',
      aparcados: caja ? caja.childNodes.length : -1,
      datosAparcados: caja ? Array.prototype.slice.call(caja.querySelectorAll('form, input, textarea, select')).map(function (n) { return n.id || n.tagName; }) : [],
      retornoPendiente: (typeof retornoModalPendiente !== 'undefined') ? retornoModalPendiente : 'no-expuesta',
      formContrato: !!document.getElementById('form-contrato'),
      formProspecto: !!document.getElementById('form-prospecto'),
      formTarea: !!document.getElementById('form-tarea'),
      formCrud: !!document.getElementById('form-crud'),
      formPagoRapido: !!document.getElementById('form-pago-rapido'),
      botonGuardar: !!document.querySelector('#modal-body button[type="submit"]'),
      valores: {
        festejado: (document.getElementById('contrato-festejado') || {}).value,
        fechaEvento: (document.getElementById('contrato-fecha-evento') || {}).value,
        nuevoPago: (document.getElementById('contrato-nuevo-pago') || {}).value,
        prospectoNombre: (document.getElementById('prospecto-nombre') || {}).value,
        tareaDescripcion: (document.getElementById('tarea-descripcion') || {}).value
      }
    };
  };

  /* Clic real en el botón «Guardar» del modal (lo que hace un practicante). */
  R.pulsaGuardar = function (formId) {
    var f = formId ? document.getElementById(formId) : document.querySelector('#modal-body form');
    if (!f) return 'sin-formulario';
    var b = f.querySelector('button[type="submit"]') || document.querySelector('#modal-body button[type="submit"]');
    if (!b) return 'sin-boton';
    b.click();
    return 'click';
  };

  /* Cancela la ventana de confirmación financiera (botón Cancelar). */
  R.cancelarFinanciero = function () {
    var b = document.getElementById('btn-cancelar-financiero');
    if (!b) return 'sin-boton-cancelar';
    b.click();
    return 'cancelado';
  };
  R.hayConfirmacion = function () { return !!document.getElementById('btn-confirmar-financiero'); };
  R.confirmarFinanciero = function () {
    var b = document.getElementById('btn-confirmar-financiero');
    if (!b) return 'sin-boton-confirmar';
    b.click();
    return 'confirmado';
  };

  /* ── Datos VIEJOS (anteriores a v5.0.25): se insertan crudos en el almacén para
     reproducir lo que ya está guardado en la base de Jorge. No son un ataque al
     formulario, son el punto de partida real. ── */
  R.legacyProspecto = function (datos) {
    var p = Object.assign({
      id: 'legacy_pro_' + Math.random().toString(36).slice(2, 8),
      nombre: 'Prospecto viejo', telefono: '', email: '', faseActual: 'Interesado',
      historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: obtenerFechaActual()
    }, datos || {});
    prospectos.push(p);
    return p;
  };
  R.legacyCliente = function (datos) {
    var c = Object.assign({
      id: 'legacy_cli_' + Math.random().toString(36).slice(2, 8),
      nombre: 'Cliente viejo', telefono: '', email: '', estado: 'Activo',
      contratos: [], notasGenerales: '', fechaRegistro: obtenerFechaActual()
    }, datos || {});
    clientes.push(c);
    return c;
  };
  R.guardarYAislar = function () { return guardarDatos(); };

  /* ── Lecturas puntuales ── */
  R.prospectosCon = function (nombre) { return prospectos.filter(function (p) { return p && p.nombre === nombre; }).map(function (p) { return { id: p.id, nombre: p.nombre, telefono: p.telefono, fase: p.faseActual }; }); };
  R.clientesConNombre = function (nombre) { return clientes.filter(function (c) { return c && c.nombre === nombre; }).map(function (c) { return { id: c.id, nombre: c.nombre, telefono: c.telefono, estado: c.estado }; }); };
  R.contratosConFestejado = function (festejado) {
    var out = [];
    clientes.forEach(function (c) { (c.contratos || []).forEach(function (co) { if (co && co.festejado === festejado) out.push({ cliente: c.nombre, id: co.id, festejado: co.festejado, fechaEvento: co.fechaEvento, precioFinal: co.precioFinal, pagos: (co.pagos || []).length }); }); });
    return out;
  };
  R.tareasCon = function (desc) { return tareas.filter(function (t) { return t && t.descripcion === desc; }).map(function (t) { return { id: t.id, descripcion: t.descripcion, fecha: t.fecha, clienteId: t.clienteId, completada: t.completada }; }); };
  R.datosTareaFormulario = function () {
    return {
      descripcion: (document.getElementById('tarea-descripcion') || {}).value,
      fecha: (document.getElementById('tarea-fecha') || {}).value,
      tipo: (document.getElementById('tarea-tipo') || {}).value,
      clienteId: (document.getElementById('tarea-cliente') || {}).value
    };
  };
  R.datosContratoFormulario = function () {
    return {
      clienteId: (document.getElementById('contrato-cliente-id') || {}).value,
      festejado: (document.getElementById('contrato-festejado') || {}).value,
      fechaEvento: (document.getElementById('contrato-fecha-evento') || {}).value,
      tipo: (document.getElementById('contrato-tipo') || {}).value,
      paqueteId: (document.getElementById('contrato-paquete') || {}).value,
      direccion: (document.getElementById('contrato-direccion-evento') || {}).value,
      notas: (document.getElementById('contrato-notas') || {}).value
    };
  };
  R.prospectoFormularioVisible = function () { return !!document.getElementById('prospecto-nombre'); };

  window.__R = R;
  return { ok: true, claves: Object.keys(R).length };
})()`;

/* ─────────────────────────── Apertura de la caja ─────────────────────────── */

export async function abrirCaja(opciones = {}) {
  const info = preparar();
  const s = await abrir({ info, ancho: opciones.ancho || 390, alto: opciones.alto || 844, movil: opciones.movil !== false });
  const entrada = await entrar(s);
  const inst = await s.evaluar(JS_INSTRUMENTAR);
  const aislamiento = await revisarAislamiento(s);
  const bib = await s.evaluar(JS_BIBLIOTECA);
  const base = opciones.base === false ? null : await baseMinima(s);
  const semb = opciones.semilla === false ? null : await sembrar(s);
  return { s, info, aislamiento, entrada, inst, bib, base, semb, familia: opciones.familia || 'general', ataques: [] };
}

/* Crea por los formularios reales 2 paquetes y 3 clientes: hacen falta para
   probar contratos y pagos (la siembra de sandbox.mjs no los trae). */
export async function baseMinima(s) {
  return await s.evaluar(`(function () {
    var r = { paquetes: [], clientes: [], errores: [] };
    var paquetes = [
      { nombre: 'Paquete Boda Clásica', descripcion: 'Cobertura de boda', precio: 25000, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo' },
      { nombre: 'Paquete XV Años', descripcion: 'Cobertura de XV años', precio: 18000, descuento: 1000, vigencia: '2027-12-31', estatus: 'Activo' }
    ];
    paquetes.forEach(function (p) {
      try { __R.paquete(p, 'dispatch'); } catch (e) { r.errores.push('paquete: ' + e.message); }
      var ult = paquetes_ultimo();
      if (ult) r.paquetes.push({ id: ult.id, nombre: ult.nombre, precio: ult.precio });
    });
    function paquetes_ultimo() { return window.paquetes[window.paquetes.length - 1]; }
    var clientesBase = [
      { nombre: 'Cliente Base Uno', telefono: '8781112233', email: 'uno@correo.com', estado: 'Activo' },
      { nombre: 'Cliente Base Dos', telefono: '8782223344', email: 'dos@correo.com', estado: 'Activo' },
      { nombre: 'Cliente Base Tres', telefono: '8783334455', email: 'tres@correo.com', estado: 'Activo' }
    ];
    clientesBase.forEach(function (c) {
      try { __R.cliente(c, 'dispatch'); } catch (e) { r.errores.push('cliente: ' + e.message); }
      var ult = clientes_ultimo();
      if (ult) r.clientes.push({ id: ult.id, nombre: ult.nombre, telefono: ult.telefono });
    });
    function clientes_ultimo() { return window.clientes[window.clientes.length - 1]; }
    __R.limpiar();
    return r;
  })()`);
}

/* ─────────────────────────── Ejecutor de ataques ─────────────────────────── */

export const GRAVEDAD_ORDEN = { ALTA: 0, MEDIA: 1, BAJA: 2 };

const sinFilas = (t) => {
  if (!t) return t;
  try { const o = JSON.parse(t); delete o.filas; return o; } catch (e) { return t; }
};

export async function ataque(caja, def) {
  const s = caja.s;
  await s.evaluar('window.__A.notis = []; window.__A.errores = []; "ok"');
  const antes = sinFilas(await s.evaluar('JSON.stringify(__R.invariantes())'));

  let crudo = null;
  let excepcionFuera = null;
  try {
    crudo = await s.evaluar(`(async function () { try { ${def.js} } catch (e) { return { __excepcion: String((e && e.stack) || e) }; } })()`);
  } catch (e) {
    excepcionFuera = String((e && e.message) || e);
  }
  await dormir(def.espera === undefined ? 400 : def.espera);

  const notis = await s.evaluar('JSON.stringify(window.__A.notis)').then(JSON.parse).catch(() => []);
  const erroresJS = await s.evaluar('JSON.stringify(window.__A.errores)').then(JSON.parse).catch(() => []);
  const despues = sinFilas(await s.evaluar('JSON.stringify(__R.invariantes())'));
  let mirar = null;
  if (def.mirar) {
    try { mirar = await s.evaluar(`JSON.stringify((function(){ ${def.mirar} })())`).then((t) => (t === undefined ? null : JSON.parse(t))); }
    catch (e) { mirar = { errorMirar: String(e.message || e) }; }
  }

  let veredicto = 'INDETERMINADO';
  let detalle = '';
  if (crudo && crudo.__excepcion) {
    veredicto = 'ROTO'; detalle = 'Excepción dentro del ataque (página): ' + crudo.__excepcion;
  } else if (excepcionFuera) {
    veredicto = 'ROTO'; detalle = 'Excepción al evaluar: ' + excepcionFuera;
  } else if (crudo && crudo.veredicto) {
    veredicto = crudo.veredicto; detalle = crudo.detalle || '';
  } else {
    detalle = 'El ataque no devolvió veredicto. Crudo: ' + JSON.stringify(crudo);
  }
  if (erroresJS.length && veredicto !== 'ROTO') { veredicto = 'ROTO'; detalle = (detalle + ' | ').replace(/^\s*\|\s*/, '') + 'Error de JavaScript: ' + erroresJS.join(' ;; '); }

  const reg = {
    id: def.id, familia: caja.familia, nombre: def.nombre, dato: def.dato, esperado: def.esperado,
    gravedad: def.gravedad || 'MEDIA', veredicto, detalle,
    notificaciones: notis.map((n) => n.t + ': ' + n.m),
    erroresJS, crudo, mirar, antes, despues
  };
  caja.ataques.push(reg);

  const marca = { 'CANDADO OK': 'OK ', HUECO: 'HUECO', ROTO: 'ROTO', DUPLICA: 'DUPLICA' }[veredicto] || '?? ';
  console.log(`[${marca}] ${def.id} · ${def.nombre} · dato=${JSON.stringify(def.dato)}`);
  console.log(`        -> ${detalle}`);
  if (notis.length) console.log(`        app dijo: ${notis.map((n) => n.t + ': ' + n.m).join(' | ')}`);
  if (crudo && crudo.__excepcion) console.log(`        excepción: ${String(crudo.__excepcion).split('\n')[0]}`);
  return reg;
}

export async function guardar(caja, nombre) {
  const destino = path.join(RESULTADOS, nombre + '.json');
  const conteo = caja.ataques.reduce((a, x) => { a[x.veredicto] = (a[x.veredicto] || 0) + 1; return a; }, {});
  const salida = {
    familia: caja.familia, cuando: new Date().toISOString(), sello: caja.info.sello,
    archivoFuente: caja.info.fuente, sha256Fuente: caja.info.sha256Fuente,
    aislamiento: caja.aislamiento, entry: caja.entrada, base: caja.base, sembrado: caja.semb,
    conteo, ataques: caja.ataques
  };
  fs.writeFileSync(destino, JSON.stringify(salida, null, 2), 'utf8');
  const red = await caja.s.cerrar();
  salida.red = red;
  fs.writeFileSync(destino, JSON.stringify(salida, null, 2), 'utf8');
  console.log(`\n== ${caja.familia}: ${caja.ataques.length} ataques · ${JSON.stringify(conteo)}`);
  console.log(`== Red: ${red.peticiones} peticiones · prohibidas: ${red.prohibidas.length ? red.prohibidas.join(', ') : 'ninguna'}`);
  console.log(`== Guardado: ${destino}`);
  return { conteo, red };
}

/* Foto rápida del almacén (para depurar). */
export async function foto(caja) {
  return await caja.s.evaluar('JSON.stringify({inv: __R.invariantes(), prospectos: __R.prospectos(), clientes: __R.clientes()})').then(JSON.parse);
}
