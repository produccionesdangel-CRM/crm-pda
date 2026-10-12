/*
 * verificar-saldo-contrato.mjs — el precio pactado manda (caso real del 10/10/2026)
 * ---------------------------------------------------------------------------
 * El 10/10/2026 Jorge reportó: en el contrato de Paola Peña (Paquete Princesa) la
 * tarjeta decía LIQUIDADO con $6,900 pagados, pero la ventana de edición mostraba un
 * "Saldo pendiente" de $2,050, porque sumaba el precio de lista del paquete ($8,950)
 * en vez del precio pactado del contrato ($6,900).
 *
 * Este arnés comprueba, contra una copia SIN el SDK de Firebase:
 *   1. Con precio pactado ($6,900) y paquete de lista a $8,950, la ventana muestra
 *      $6,900 / saldo $0 y AVISA de la diferencia con el catálogo.
 *   2. Lo que muestra la ventana COINCIDE con lo que dice la tarjeta
 *      (`calcularTotalesContrato`): no puede haber dos verdades.
 *   3. Guardar sin tocar nada NO le cambia el precio al contrato (antes lo pisaba con
 *      el del catálogo y le creaba una deuda inexistente).
 *   4. Si de verdad se cambia el paquete, el precio SÍ se recalcula con el catálogo.
 *   5. Un contrato NUEVO sigue tomando el precio del catálogo.
 *   6. Un contrato sin precio capturado ($0) no se queda en $0 al guardarlo.
 *
 * Cómo se corre:  node pruebas\verificar-saldo-contrato.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9349);
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function buscarChrome() {
  for (const c of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')]) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No encontré Chrome');
}

async function esperarCDP(msMax = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < msMax) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const p = lista.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch (e) { }
    await dormir(250);
  }
  throw new Error('Chrome no abrió el puerto');
}

function crearCliente(ws) {
  let id = 0; const pendientes = new Map(); const sucesos = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id); pendientes.delete(m.id);
      m.error ? rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error))) : resolver(m.result);
    } else if (m.method) sucesos.push(m);
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id; pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { enviar, sucesos };
}

async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* Lee lo que la VENTANA de edición está mostrando, más lo que dice el contrato guardado. */
const LEER_modal = `(function () {
  var t = function (id) { var e = document.getElementById(id); return e ? (e.textContent || '').trim() : null; };
  var filas = document.getElementById('resumen-precios-filas');
  return JSON.stringify({
    base: t('resumen-precio-base'),
    cargos: t('resumen-cargos-total'),
    descuento: t('resumen-descuento'),
    total: t('resumen-total'),
    pagado: t('resumen-pagado'),
    saldo: t('resumen-saldo'),
    saldoColor: (function () { var e = document.getElementById('resumen-saldo'); return e ? e.style.color : ''; })(),
    notaCatalogo: filas ? /El catálogo hoy lo tiene en/.test(filas.textContent) : false,
    textoPrecios: filas ? filas.textContent.replace(/\\s+/g, ' ').trim() : ''
  });
})()`;

const SEMILLA = `
  /* El paquete HOY cuesta 8,950 (lo que ve el catálogo). */
  paquetes = [ { id: 'paq-1', nombre: 'Paquete Princesa', descripcion: 'Boda', precio: 8950, descuento: 0, vigencia: '2026-12-31', fechaRegistro: '2026-01-01',
      items: [ { tipo: 'personalizado', nombre: 'Cobertura', cantidad: 1 } ] },
    { id: 'paq-2', nombre: 'Paquete Económico', descripcion: 'Básico', precio: 5000, descuento: 0, vigencia: '2026-12-31', fechaRegistro: '2026-01-01', items: [] } ];
  serviciosAdicionales = [ { id: 'srv-1', nombre: 'Cabina 360', precio: 6000, descuento: 0, vigencia: '2026-12-31' } ];
  /* EL CASO REAL de Jorge (Paola Peña / Paquete Princesa): el contrato tiene base 8,950 y
     precio final 6,900, SIN descuento capturado. Esa diferencia de 2,050 viene del campo
     "Anticipo (pago inicial)" que tenía el CRM original, que RESTABA el anticipo del total.
     Está pagado con 6,900 y por eso la tarjeta lo da por liquidado. */
  clientes = [ { id: 'cli-1', nombre: 'Paola Peña', telefono: '8781112233', email: 'paola@correo.com', estado: 'Activo', fechaRegistro: '2026-01-01',
    contratos: [ { id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Paola Peña', festejado: 'Alissa Mota XV',
      tipo: 'paquete', paqueteId: 'paq-1', serviciosIds: [], precioBase: 8950, precioFinal: 6900, descuentoMonto: 0,
      cargos: [], pagos: [ { id: 'pag-1', monto: 6900, fecha: '2026-08-25T18:50:00', codigo: 'PDA-9001', nota: 'Pago registrado por $6,900' } ],
      estado: 'Completado', fechaEvento: '2026-05-23', horaEvento: '17:00', fechaContrato: '2026-01-15', notas: '' },
      /* El MISMO caso, aparte, para probar el flujo de corrección sin que lo toquen las
         otras pruebas (botón del catálogo + registrar el anticipo con su fecha). */
      { id: 'con-3', clienteId: 'cli-1', clienteNombre: 'Paola Peña', festejado: 'Otra Fiesta XV',
      tipo: 'paquete', paqueteId: 'paq-1', serviciosIds: [], precioBase: 8950, precioFinal: 6900, descuentoMonto: 0,
      cargos: [], pagos: [ { id: 'pag-3', monto: 6900, fecha: '2026-08-25T18:50:00', codigo: 'PDA-9003', nota: 'Pago registrado por $6,900' } ],
      estado: 'Completado', fechaEvento: '2026-06-20', horaEvento: '17:00', fechaContrato: '2026-02-01', notas: '' } ] },
    /* Un contrato viejo SIN precio capturado. */
    { id: 'cli-2', nombre: 'Sin Precio', telefono: '8780000000', email: 'sp@correo.com', estado: 'Activo', fechaRegistro: '2026-01-01',
    contratos: [ { id: 'con-2', clienteId: 'cli-2', clienteNombre: 'Sin Precio', festejado: 'Prueba',
      tipo: 'paquete', paqueteId: 'paq-2', serviciosIds: [], precioBase: 0, precioFinal: 0, descuentoMonto: 0,
      cargos: [], pagos: [], estado: 'Pendiente', fechaEvento: '2026-09-09', fechaContrato: '2026-01-15', notas: '' } ] } ];
  prospectos = []; tareas = []; campanias = []; participaciones = []; historial = []; papelera = [];
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA);
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-saldo'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };
  const pesos = (s) => {
    const m = String(s || '').replace(/[^0-9.]/g, '');
    return m ? Number(m) : 0;
  };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
    await cdp.enviar('Page.navigate', { url: 'file:///' + PAGINA.replace(/\\/g, '/') });
    await dormir(4500);

    const montar = await evaluar(cdp, `(function () {
      try {
        if (typeof firebase !== 'undefined') return 'ABORTADO: firebase se cargó';
        ${SEMILLA}
        usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'prueba@local' };
        ocultarPantallaLogin(); actualizarUIUsuario(); aplicarRestriccionesPorRol(); conectarEventListenersApp();
        return 'ok';
      } catch (e) { return 'error: ' + e.message; }
    })()`);
    console.log('Archivo: ' + PAGINA);
    if (montar !== 'ok') throw new Error('No se pudo montar: ' + montar);

    console.log('\n1) Lo que dice la TARJETA (el contrato guardado)');
    const tarjeta = JSON.parse(await evaluar(cdp, `(function () {
      var c = clientes[0].contratos[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ precioBase: tot.precioBase, precioFinal: tot.precioEfectivo, totalAPagar: tot.totalAPagar, totalPagos: tot.totalPagos,
        saldoPendiente: tot.saldoPendiente, liquidado: tot.saldoPendiente === 0 && c.estado === 'Completado' });
    })()`));
    console.log('   base: ' + tarjeta.precioBase + ' · final: ' + tarjeta.precioFinal + ' · pagado: ' + tarjeta.totalPagos + ' · saldo: ' + tarjeta.saldoPendiente);
    revisar(tarjeta.precioBase === 8950 && tarjeta.precioFinal === 6900, 'el contrato guarda base 8,950 y final 6,900 (tu caso)');
    revisar(tarjeta.totalAPagar === 6900 && tarjeta.saldoPendiente === 0 && tarjeta.liquidado,
      'la tarjeta está LIQUIDADA (a pagar 6,900, pagado 6,900, saldo 0)');

    console.log('\n2) Lo que muestra la VENTANA de edición al abrir ese contrato');
    const modal = JSON.parse(await evaluar(cdp, `(function () {
      editarContrato('cli-1', 'con-1');
      return ${LEER_modal};
    })()`));
    console.log('   base: ' + modal.base + ' · total: ' + modal.total + ' · pagado: ' + modal.pagado + ' · saldo: ' + modal.saldo);
    console.log('   nota: "' + modal.textoPrecios.substring(0, 150) + '"');
    revisar(pesos(modal.base) === 8950, 'muestra la base del contrato (8,950), no la reinven­ta');
    revisar(/Ajuste registrado en este contrato/.test(modal.textoPrecios) && /2,050/.test(modal.textoPrecios),
      'muestra el AJUSTE de 2,050 con su explicación (el anticipo que antes no aparecía)');
    revisar(pesos(modal.total) === 6900, 'el total a pagar es 6,900 (no 8,950)');
    revisar(pesos(modal.saldo) === 0, 'el saldo pendiente es $0 (ya no aparece el pendiente fantasma de 2,050)');
    revisar(pesos(modal.total) - pesos(modal.pagado) === pesos(modal.saldo), 'la resta cuadra: total − pagado = saldo');
    revisar(pesos(modal.total) === tarjeta.totalAPagar && pesos(modal.saldo) === tarjeta.saldoPendiente,
      'la ventana y la tarjeta dicen LO MISMO (una sola verdad)');
    revisar(modal.notaCatalogo === false, 'no avisa del catálogo porque la base sí es la del catálogo');

    console.log('\n3) Guardar SIN tocar nada no le cambia NADA al contrato');
    await evaluar(cdp, `(function () { document.getElementById('form-contrato').requestSubmit(); return 1; })()`);
    await dormir(900);
    const tras = JSON.parse(await evaluar(cdp, `(function () {
      var c = clientes[0].contratos[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ precioBase: c.precioBase, precioFinal: c.precioFinal, pagos: c.pagos.length, saldo: tot.saldoPendiente });
    })()`));
    console.log('   después de guardar: base ' + tras.precioBase + ' · final ' + tras.precioFinal + ' · saldo ' + tras.saldo);
    revisar(tras.precioBase === 8950 && tras.precioFinal === 6900,
      'el precio y el ajuste se conservaron (antes el total habría saltado a 8,950 y creado una deuda de 2,050)');
    revisar(tras.saldo === 0, 'el contrato sigue liquidado después de guardar');
    revisar(tras.pagos === 1, 'los pagos no se tocaron (sigue el pago de 6,900)');

    console.log('\n3b) Agregar un cargo extra sube el total sin perder el ajuste');
    const conCargo = JSON.parse(await evaluar(cdp, `(function () {
      editarContrato('cli-1', 'con-1');
      /* Se agrega el cargo por la INTERFAZ, como lo haría Jorge. */
      document.getElementById('cargo-monto').value = '3500';
      document.getElementById('cargo-descripcion').value = 'Extra de prueba';
      document.getElementById('btn-agregar-cargo').click();
      return ${LEER_modal};
    })()`));
    console.log('   total con cargo de 3,500: ' + conCargo.total + ' · saldo: ' + conCargo.saldo);
    revisar(pesos(conCargo.total) === 10400, 'el total pasa a 10,400 (6,900 + 3,500): el ajuste se conserva');
    await evaluar(cdp, `(function () { cerrarModal(); return 1; })()`);
    await dormir(200);

    console.log('\n4) Si de verdad se cambia el paquete, el precio SÍ se recalcula');
    const cambio = JSON.parse(await evaluar(cdp, `(function () {
      editarContrato('cli-1', 'con-1');
      var ps = document.getElementById('contrato-paquete');
      ps.value = 'paq-2';                                  /* otro paquete, de 5,000 */
      ps.dispatchEvent(new Event('change', { bubbles: true }));
      return ${LEER_modal};
    })()`));
    console.log('   base tras cambiar el paquete: ' + cambio.base + ' · total: ' + cambio.total);
    revisar(pesos(cambio.base) === 5000, 'al cambiar el paquete toma el precio del catálogo (5,000)');
    /* El cargo de 3,500 del paso 3b sigue en el contrato (los movimientos se guardan al
       instante), así que el total es 5,000 + 3,500 = 8,500: el AJUSTE viejo ya no está. */
    revisar(pesos(cambio.total) === 8500, 'y el ajuste viejo desaparece: queda 5,000 + el cargo de 3,500');
    revisar(/Ajuste registrado/.test(cambio.textoPrecios) === false, 'ya no muestra el ajuste');

    console.log('\n5) EL FLUJO DE CORRECCIÓN: botón del catálogo + registrar el anticipo con su fecha');
    const boton = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      editarContrato('cli-1', 'con-3');
      var b = document.getElementById('btn-usar-precio-catalogo');
      return JSON.stringify({ hay: !!b, texto: b ? b.textContent.replace(/\\s+/g, ' ').trim() : '' });
    })()`));
    console.log('   botón: "' + boton.texto + '"');
    revisar(boton.hay === true, 'el botón para adoptar el precio del catálogo existe');
    revisar(/8,950/.test(boton.texto), 'dice a qué precio va a quedar');

    const aplicado = JSON.parse(await evaluar(cdp, `(function () {
      document.getElementById('btn-usar-precio-catalogo').click();
      var dialogo = document.getElementById('btn-confirmar-financiero');
      var texto = dialogo ? (document.querySelector('#modal-body .advertencia-eliminar') || {}).textContent : '';
      var pidio = !!dialogo;
      if (dialogo) dialogo.click();
      var base = JSON.parse(${LEER_modal});
      base.pidioConfirmacion = pidio;
      base.aviso = (texto || '').replace(/\\s+/g, ' ').trim().substring(0, 460);
      return JSON.stringify(base);
    })()`));
    console.log('   aviso: "' + aplicado.aviso + '"');
    console.log('   ahora: base ' + aplicado.base + ' · total ' + aplicado.total + ' · saldo ' + aplicado.saldo);
    revisar(aplicado.pidioConfirmacion === true, 'pide confirmación antes de cambiar el precio');
    revisar(/pagó el cliente|reg[íi]stralo como pago/.test(aplicado.aviso), 'el aviso explica qué hacer con el anticipo');
    revisar(pesos(aplicado.base) === 8950 && pesos(aplicado.total) === 8950 && pesos(aplicado.saldo) === 2050,
      'el precio queda en 8,950 y el saldo pendiente pasa a 2,050 (falta registrar el anticipo)');
    revisar(/Ajuste registrado/.test(aplicado.textoPrecios) === false, 'el ajuste viejo ya no se aplica');

    console.log('\n5b) Guardar el precio corregido');
    await evaluar(cdp, `(function () { document.getElementById('form-contrato').requestSubmit(); return 1; })()`);
    await dormir(800);
    /* La fecha del evento es pasada, así que el CRM pide confirmación: se confirma. */
    const guardado1 = JSON.parse(await evaluar(cdp, `(function () {
      var b = document.getElementById('btn-confirmar-financiero');
      var pidio = !!b;
      if (b) b.click();
      var c = clientes[0].contratos.filter(function (x) { return x.id === 'con-3'; })[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ pidio: pidio, precioBase: c.precioBase, precioFinal: c.precioFinal, saldo: tot.saldoPendiente, pagos: c.pagos.length });
    })()`));
    await dormir(400);
    console.log('   guardado: base ' + guardado1.precioBase + ' · final ' + guardado1.precioFinal + ' · saldo ' + guardado1.saldo + ' (pagos ' + guardado1.pagos + ')');
    revisar(guardado1.precioFinal === 8950, 'el contrato quedó guardado en 8,950 (el ajuste viejo ya no está)');
    revisar(guardado1.saldo === 2050, 'y el saldo pendiente queda en 2,050: falta registrar el anticipo');

    console.log('\n5c) Registrar el anticipo de 2,050 con su fecha real');
    const pago = JSON.parse(await evaluar(cdp, `(function () {
      editarContrato('cli-1', 'con-3');
      document.getElementById('contrato-nuevo-pago').value = '2050';
      document.getElementById('contrato-nuevo-pago-fecha').value = '2026-03-15';
      document.getElementById('btn-agregar-pago').click();
      /* Si el CRM avisa algo del pago, se confirma como lo haría Jorge. */
      var b = document.getElementById('btn-confirmar-financiero');
      var aviso = b ? (document.querySelector('#modal-body .advertencia-eliminar') || {}).textContent : '';
      if (b) b.click();
      var co = clientes[0].contratos.filter(function (x) { return x.id === 'con-3'; })[0];
      var ultimo = co.pagos[co.pagos.length - 1];
      var base = JSON.parse(${LEER_modal});
      base.pagoso = co.pagos.length;
      base.fecha = ultimo ? String(ultimo.fecha).substring(0, 10) : null;
      base.fechaCaptura = ultimo ? !!ultimo.fechaCaptura : false;
      base.monto = ultimo ? ultimo.monto : 0;
      base.pidioConfirmacion = !!b;
      base.aviso = (aviso || '').replace(/\\s+/g, ' ').trim().substring(0, 120);
      return JSON.stringify(base);
    })()`));
    console.log('   pagos: ' + pago.pagoso + ' · último: ' + pago.monto + ' del ' + pago.fecha + ' (capturado aparte: ' + pago.fechaCaptura + ')');
    console.log('   total ' + pago.total + ' · pagado ' + pago.pagado + ' · saldo ' + pago.saldo);
    revisar(pago.pagoso === 2 && pago.monto === 2050, 'el anticipo quedó registrado como pago de 2,050');
    revisar(pago.fecha === '2026-03-15', 'guardó la FECHA REAL del anticipo (no la de hoy)');
    revisar(pago.fechaCaptura === true, 'y anota aparte cuándo se capturó');
    revisar(pesos(pago.pagado) === 8950 && pesos(pago.saldo) === 0, 'el contrato queda LIQUIDADO: pagado 8,950, saldo $0');

    console.log('\n5d) Estado final del contrato corregido');
    await evaluar(cdp, `(function () { cerrarModal(); return 1; })()`);
    await dormir(300);
    const corregido = JSON.parse(await evaluar(cdp, `(function () {
      var c = clientes[0].contratos.filter(function (x) { return x.id === 'con-3'; })[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ precioBase: c.precioBase, precioFinal: c.precioFinal, pagos: c.pagos.length,
        totalPagos: tot.totalPagos, saldo: tot.saldoPendiente, liquidado: c.estado === 'Completado' && tot.saldoPendiente === 0 });
    })()`));
    console.log('   base ' + corregido.precioBase + ' · final ' + corregido.precioFinal + ' · pagos ' + corregido.pagos + ' ($' + corregido.totalPagos + ') · saldo ' + corregido.saldo);
    revisar(corregido.precioBase === 8950 && corregido.precioFinal === 8950, 'el contrato quedó en 8,950 (como lo liquidó el cliente)');
    revisar(corregido.pagos === 2 && corregido.totalPagos === 8950, 'con sus DOS pagos (2,050 + 6,900 = 8,950)');
    revisar(corregido.saldo === 0 && corregido.liquidado === true, 'y sigue liquidado');

    console.log('\n6) Un contrato NUEVO toma el precio del catálogo');
    const nuevo = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      mostrarFormularioContrato('cli-1', 'Nuevo Contrato', null);
      var ps = document.getElementById('contrato-paquete');
      ps.value = 'paq-1';
      ps.dispatchEvent(new Event('change', { bubbles: true }));
      return ${LEER_modal};
    })()`));
    console.log('   base de un contrato nuevo: ' + nuevo.base);
    revisar(pesos(nuevo.base) === 8950, 'un contrato nuevo usa el precio del catálogo (8,950)');

    console.log('\n8) Contrato NUEVO con anticipo: la revisión usa el precio del paquete (bug 12/10/2026)');
    const nuevoAnticipo = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      mostrarFormularioContrato('cli-1', 'Nuevo Contrato', null);
      document.getElementById('contrato-festejado').value = 'Festejada Nueva';
      document.getElementById('contrato-fecha-evento').value = '2027-06-15';
      var ps = document.getElementById('contrato-paquete');
      ps.value = 'paq-1';
      ps.dispatchEvent(new Event('change', { bubbles: true }));
      var totalVentana = document.getElementById('resumen-total').textContent;
      document.getElementById('contrato-nuevo-pago').value = '1500';
      document.getElementById('btn-agregar-pago').click();
      var dialogo = document.getElementById('btn-confirmar-financiero');
      var aviso = dialogo ? (document.querySelector('#modal-body .advertencia-eliminar') || {}).textContent : '';
      if (dialogo) dialogo.click();
      var r = {
        totalVentana: totalVentana,
        pidioAdvertencia: !!dialogo,
        aviso: (aviso || '').replace(/\\s+/g, ' ').trim().substring(0, 130),
        pagado: document.getElementById('resumen-pagado').textContent,
        saldo: document.getElementById('resumen-saldo').textContent
      };
      document.getElementById('form-contrato').requestSubmit();
      var b = document.getElementById('btn-confirmar-financiero'); if (b) b.click();
      return JSON.stringify(r);
    })()`));
    console.log('   ventana: total ' + nuevoAnticipo.totalVentana + ' · pagado ' + nuevoAnticipo.pagado + ' · saldo ' + nuevoAnticipo.saldo);
    console.log('   ¿avisó en falso? ' + nuevoAnticipo.pidioAdvertencia + ' ' + nuevoAnticipo.aviso);
    revisar(nuevoAnticipo.pidioAdvertencia === false, 'un anticipo de 1,500 sobre un paquete de 6,900 NO avisa en falso');
    revisar(pesos(nuevoAnticipo.saldo) === 7450, 'el saldo que muestra es el real: 8,950 - 1,500 = 7,450 (antes se revisaba contra $0)');

    console.log('\n8b) Al guardarlo, el anticipo queda bien');
    await dormir(900);
    const guardadoNuevo = JSON.parse(await evaluar(cdp, `(function () {
      var c = clientes[0].contratos.filter(function (x) { return x.festejado === 'Festejada Nueva'; })[0];
      if (!c) return JSON.stringify({ error: 'no se guardó' });
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ precioBase: c.precioBase, precioFinal: c.precioFinal, pagos: c.pagos.length,
        totalPagos: tot.totalPagos, totalAPagar: tot.totalAPagar, saldo: tot.saldoPendiente });
    })()`));
    console.log('   guardado: base ' + guardadoNuevo.precioBase + ' · final ' + guardadoNuevo.precioFinal + ' · pagos ' + guardadoNuevo.pagos + ' ($' + guardadoNuevo.totalPagos + ') · saldo ' + guardadoNuevo.saldo);
    revisar(guardadoNuevo.error === undefined, 'el contrato nuevo se guardó');
    revisar(guardadoNuevo.totalAPagar === 8950 && guardadoNuevo.totalPagos === 1500 && guardadoNuevo.saldo === 7450,
      'el contrato queda en 8,950 (el precio del paquete) con 1,500 pagados y saldo 7,450');

    console.log('\n9) Cargo y descuento se aplican UNA sola vez al guardar (bug 12/10/2026)');
    const unCargo = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      editarContrato('cli-1', 'con-3');
      document.getElementById('cargo-monto').value = '2000';
      document.getElementById('cargo-descripcion').value = 'Cargo de prueba';
      document.getElementById('btn-agregar-cargo').click();
      var b1 = document.getElementById('btn-confirmar-financiero'); if (b1) b1.click();
      var enVentana = document.getElementById('resumen-total').textContent;
      document.getElementById('form-contrato').requestSubmit();
      var b2 = document.getElementById('btn-confirmar-financiero'); if (b2) b2.click();
      var c = clientes[0].contratos.filter(function (x) { return x.id === 'con-3'; })[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ enVentana: enVentana, precioBase: c.precioBase, precioFinal: c.precioFinal,
        cargos: tot.totalCargos, totalAPagar: tot.totalAPagar });
    })()`));
    console.log('   ventana: ' + unCargo.enVentana + ' → guardado: final ' + unCargo.precioFinal + ' + cargos ' + unCargo.cargos + ' = total ' + unCargo.totalAPagar);
    revisar(pesos(unCargo.enVentana) === unCargo.totalAPagar, 'el total guardado es EL MISMO que mostró la ventana');
    revisar(unCargo.totalAPagar === 10950, 'el cargo se cuenta UNA vez (8,950 + 2,000 = 10,950; con el bug daba 12,950)');
    revisar(unCargo.precioFinal === 8950, 'el precio final NO lleva los cargos dentro');

    const unDescuento = JSON.parse(await evaluar(cdp, `(function () {
      cerrarModal();
      editarContrato('cli-1', 'con-3');
      document.getElementById('descuento-descripcion').value = 'Descuento de prueba';
      document.getElementById('descuento-monto').value = '900';
      document.getElementById('btn-aplicar-descuento').click();
      var b1 = document.getElementById('btn-confirmar-financiero'); if (b1) b1.click();
      var enVentana = document.getElementById('resumen-total').textContent;
      document.getElementById('form-contrato').requestSubmit();
      var b2 = document.getElementById('btn-confirmar-financiero'); if (b2) b2.click();
      var c = clientes[0].contratos.filter(function (x) { return x.id === 'con-3'; })[0];
      var tot = calcularTotalesContrato(c);
      return JSON.stringify({ enVentana: enVentana, precioFinal: c.precioFinal, descuento: c.descuentoMonto,
        cargos: tot.totalCargos, totalAPagar: tot.totalAPagar });
    })()`));
    console.log('   ventana: ' + unDescuento.enVentana + ' → guardado: final ' + unDescuento.precioFinal + ' − descuento ' + unDescuento.descuento + ' + cargos ' + unDescuento.cargos + ' = total ' + unDescuento.totalAPagar);
    revisar(pesos(unDescuento.enVentana) === unDescuento.totalAPagar, 'con descuento, el total guardado también es el de la ventana');
    revisar(unDescuento.totalAPagar === 10050, 'el descuento se aplica UNA vez (8,950 − 900 + 2,000 = 10,050)');

    console.log('\n10) Un pago VIEJO sin identificador se puede anular (caso del pago ficticio de $50)');
    const viejo = JSON.parse(await evaluar(cdp, `(function () {
      /* Un contrato como los de versiones muy tempranas: pagos y cargos SIN id. */
      clientes[0].contratos.push({ id: 'con-viejo', clienteId: 'cli-1', clienteNombre: 'Paola Peña', festejado: 'Contrato Viejo',
        tipo: 'paquete', paqueteId: 'paq-1', serviciosIds: [], precioBase: 8950, precioFinal: 8950, descuentoMonto: 0,
        cargos: [ { monto: 1190, fecha: '2026-09-04 21:35', nota: 'Cargo viejo sin id' } ],
        pagos: [ { monto: 3000, fecha: '2026-09-04 21:34', nota: 'Anticipo registrado por $3,000' },
                 { monto: 50, fecha: '2026-09-04 21:35', nota: 'Pago registrado por $50' } ],
        estado: 'Pendiente', fechaEvento: '2026-11-28', fechaContrato: '2026-09-04', notas: '' });
      normalizarRegistros();      /* así se cargan los datos de verdad */
      var co = clientes[0].contratos.filter(function (x) { return x.id === 'con-viejo'; })[0];
      var idsTrasNormalizar = { pagos: co.pagos.map(function (p) { return !!p.id; }), cargos: co.cargos.map(function (c) { return !!c.id; }) };
      editarContrato('cli-1', 'con-viejo');
      var filas = [].slice.call(document.querySelectorAll('#pagos-lista .pago-item, #cargos-lista .cargo-item'));
      var conBoton = filas.filter(function (f) { return !!f.querySelector('.btn-eliminar-item'); }).length;
      var p50 = clientes[0].contratos.filter(function (x) { return x.id === 'con-viejo'; })[0].pagos.filter(function (p) { return p.monto === 50; })[0];
      return JSON.stringify({
        filas: filas.length,
        conBoton: conBoton,
        idAsignado: !!p50.id,
        idsAlCargar: idsTrasNormalizar
      });
    })()`));
    console.log('   movimientos: ' + viejo.filas + ' · con botón de anular: ' + viejo.conBoton + ' · ids al cargar: ' + JSON.stringify(viejo.idsAlCargar));
    revisar(viejo.idAsignado === true, 'el pago viejo de $50 recibe identificador al cargar los datos');
    revisar(viejo.idsAlCargar.cargos.every(Boolean) === true, 'y el cargo viejo también');
    revisar(viejo.conBoton === viejo.filas, 'TODOS los movimientos muestran el botón de anular (antes los viejos no lo tenían)');

    console.log('\n10b) Se anula y el saldo se recompone');
    const anulado = JSON.parse(await evaluar(cdp, `(function () {
      var co = clientes[0].contratos.filter(function (x) { return x.id === 'con-viejo'; })[0];
      var p50 = co.pagos.filter(function (p) { return p.monto === 50; })[0];
      var saldoAntes = document.getElementById('resumen-saldo').textContent;
      PDA.eliminarMovimientoContrato('pago', p50.id);
      var btn = document.getElementById('btn-confirmar-anulacion');
      var pidio = !!btn;
      if (btn) {
        document.getElementById('motivo-anulacion').value = 'Monto ficticio de ajuste de una version vieja del CRM';
        btn.click();
      }
      var co2 = clientes[0].contratos.filter(function (x) { return x.id === 'con-viejo'; })[0];
      var anuladoPago = co2.pagos.filter(function (p) { return p.monto === 50 && p.eliminado; })[0];
      var tot2 = calcularTotalesContrato(co2);
      return JSON.stringify({
        pidioMotivo: pidio, saldoAntes: saldoAntes,
        quedoAnulado: !!anuladoPago,
        motivo: anuladoPago ? String(anuladoPago.motivoAnulacion || anuladoPago.motivo || '') : '',
        montoOriginal: anuladoPago ? anuladoPago.montoOriginal : null,
        pagosEnLista: co2.pagos.length, pagosValidos: tot2.pagosValidos.length,
        totalPagos: tot2.totalPagos, saldo: tot2.saldoPendiente
      });
    })()`));
    console.log('   saldo antes: ' + anulado.saldoAntes + ' · pagos en el contrato: ' + anulado.pagosEnLista + ' (válidos: ' + anulado.pagosValidos + ') · pagado ' + anulado.totalPagos + ' · saldo ' + anulado.saldo);
    revisar(anulado.pidioMotivo === true, 'pide el motivo de la anulación (queda registrado)');
    revisar(anulado.quedoAnulado === true, 'el pago ficticio quedó ANULADO (no se borra: conserva su monto original)');
    revisar(anulado.montoOriginal === 50 && /ficticio/i.test(anulado.motivo), 'conserva el monto original y el motivo escrito');
    revisar(anulado.pagosValidos === 1 && anulado.totalPagos === 3000, 'el saldo ya no cuenta los $50 (quedan los 3,000 reales)');
    revisar(anulado.saldo === 8950 - 3000 + 1190, 'el saldo se recompone con el cargo (8,950 + 1,190 − 3,000 = 7,140)');

    console.log('\n7) Un contrato sin precio capturado no se queda en $0');
    await evaluar(cdp, `(function () { cerrarModal(); editarContrato('cli-2', 'con-2'); return 1; })()`);
    await dormir(300);
    await evaluar(cdp, `(function () { document.getElementById('form-contrato').requestSubmit(); return 1; })()`);
    await dormir(700);
    /* Este contrato tiene la fecha del evento en el pasado, así que el CRM pide
       confirmación antes de guardar: se confirma como lo haría Jorge. */
    const confirmo = await evaluar(cdp, `(function () {
      var b = document.getElementById('btn-confirmar-financiero');
      if (!b) return 'no pidió confirmación';
      b.click();
      return 'confirmado';
    })()`);
    console.log('   ' + confirmo);
    await dormir(1000);
    const sinPrecio = JSON.parse(await evaluar(cdp, `(function () {
      var c = clientes[1].contratos[0];
      return JSON.stringify({ base: c.precioBase, final: c.precioFinal });
    })()`));
    console.log('   contrato sin precio → base ' + sinPrecio.base + ' · final ' + sinPrecio.final);
    revisar(sinPrecio.base === 5000, 'un contrato sin precio capturado toma el del catálogo (5,000), no $0');

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 4).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }

    console.log('\n' + (fallos === 0 ? 'TODO EN VERDE' : fallos + ' comprobaciones fallaron'));
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
