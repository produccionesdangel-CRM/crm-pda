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
      estado: 'Completado', fechaEvento: '2026-05-23', horaEvento: '17:00', fechaContrato: '2026-01-15', notas: '' } ] },
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

    console.log('\n5) Un contrato NUEVO toma el precio del catálogo');
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

    console.log('\n6) Un contrato sin precio capturado no se queda en $0');
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
