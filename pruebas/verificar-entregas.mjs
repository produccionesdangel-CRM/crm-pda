/*
 * verificar-entregas.mjs — la lista de "qué se ha entregado" del contrato
 * ---------------------------------------------------------------------------
 * Comprueba, en Chrome sin ventana y contra una copia SIN el SDK de Firebase:
 *   1. La caja desplegable aparece en la tarjeta "Paquete / Servicio" y lista lo
 *      que incluye el paquete MÁS los servicios adicionales del contrato.
 *   2. Marcar una palomita guarda QUIÉN y CUÁNDO, y el contador se actualiza.
 *   3. Desmarcar la quita.
 *   4. NO toca el dinero: precio base, precio final, cargos y pagos quedan igual.
 *   5. Al EDITAR y guardar el contrato, las palomitas NO se pierden (la invariante
 *      que importa: el guardado del CRM parte de una copia del contrato original).
 *   6. Un contrato de "solo servicio" lista los servicios, y un paquete sin items
 *      lo dice en claro en vez de mostrar una lista vacía.
 *
 * Cómo se corre:  node pruebas\verificar-entregas.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'preview', 'index-sin-sdk.html');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9341);
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

/* Siembra: un paquete con 3 items, un servicio adicional, y dos contratos. */
const SEMILLA = `
  var HOY = new Date();
  var A = HOY.getFullYear();
  function iso(d) { return A + '-11-' + ('0' + d).slice(-2); }
  paquetes = [
    { id: 'paq-1', nombre: 'Boda Diamante', descripcion: 'Cobertura completa de la boda',
      items: [ { tipo: 'personalizado', nombre: 'Cobertura completa', cantidad: 1 },
               { tipo: 'personalizado', nombre: 'Álbum 30x30', cantidad: 1 },
               { tipo: 'personalizado', nombre: 'Sesión de compromiso', cantidad: 2 } ],
      precio: 45000, descuento: 0, vigencia: iso(28), fechaRegistro: iso(1) },
    { id: 'paq-2', nombre: 'Paquete sin items', descripcion: 'Para probar el aviso',
      items: [], precio: 10000, descuento: 0, vigencia: iso(28), fechaRegistro: iso(1) }
  ];
  serviciosAdicionales = [ { id: 'srv-1', nombre: 'Cabina 360', descripcion: 'Cabina de fotos', precio: 6000, descuento: 0, vigencia: iso(28) } ];
  clientes = [
    { id: 'cli-1', nombre: 'Familia Mendoza', telefono: '8781234567', email: 'm@correo.com', estado: 'Activo', fechaRegistro: iso(1),
      contratos: [ { id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Familia Mendoza', festejado: 'Mariana y Diego',
        tipo: 'paquete', paqueteId: 'paq-1', serviciosIds: ['srv-1'], precioBase: 51000, precioFinal: 51000,
        descuentoMonto: 0, cargos: [], pagos: [ { id: 'pag-1', monto: 20000, fecha: iso(2) + 'T11:00:00', codigo: 'PDA-1' } ],
        estado: 'Pendiente', fechaEvento: iso(21), horaEvento: '17:00', fechaContrato: iso(1), notas: 'nota original' } ] },
    { id: 'cli-2', nombre: 'Sofía Herrera', telefono: '8786789012', email: 's@correo.com', estado: 'Activo', fechaRegistro: iso(1),
      contratos: [ { id: 'con-2', clienteId: 'cli-2', clienteNombre: 'Sofía Herrera', festejado: 'Sofía',
        tipo: 'solo-servicio', paqueteId: null, servicioId: 'srv-1', serviciosIds: ['srv-1'], precioBase: 6000, precioFinal: 6000,
        descuentoMonto: 0, cargos: [], pagos: [], estado: 'Pendiente', fechaEvento: iso(15), fechaContrato: iso(1) } ] },
    { id: 'cli-3', nombre: 'Prueba Sin Items', telefono: '8780000000', email: 'p@correo.com', estado: 'Activo', fechaRegistro: iso(1),
      contratos: [ { id: 'con-3', clienteId: 'cli-3', clienteNombre: 'Prueba Sin Items', festejado: 'Prueba',
        tipo: 'paquete', paqueteId: 'paq-2', serviciosIds: [], precioBase: 10000, precioFinal: 10000,
        descuentoMonto: 0, cargos: [], pagos: [], estado: 'Pendiente', fechaEvento: iso(10), fechaContrato: iso(1) } ] }
  ];
`;

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error('Falta la copia: ' + PAGINA + ' (generala con node pruebas\\preview-clay.mjs)');
  const chrome = spawn(buscarChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-verif-entregas'), 'about:blank'], { stdio: 'ignore' });
  let fallos = 0;
  const revisar = (ok, texto) => { if (!ok) fallos++; console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable'); await cdp.enviar('Network.enable');
    await cdp.enviar('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*gstatic.com*', '*googleapis.com*'] });
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
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

    console.log('\n1) La tarjeta "Paquete / Servicio" trae la lista desplegable');
    const inicial = JSON.parse(await evaluar(cdp, `(function () {
      verDetalleContrato('cli-1', 'con-1');
      var caja = document.querySelector('.entrega-caja');
      var filas = document.querySelectorAll('[data-entrega]');
      var nombres = [].slice.call(filas).map(function (f) { return f.getAttribute('data-entrega'); });
      var resumen = document.querySelector('.entrega-caja > summary');
      return JSON.stringify({
        hayCaja: !!caja,
        abierta: caja ? caja.open : null,
        filas: filas.length,
        nombres: nombres,
        contador: resumen ? resumen.innerText.replace(/\\s+/g, ' ').trim() : '',
        pendientes: document.querySelectorAll('.entrega-sello').length,
        dinero: { pb: clientes[0].contratos[0].precioBase, pf: clientes[0].contratos[0].precioFinal,
                  pagos: JSON.stringify(clientes[0].contratos[0].pagos), cargos: JSON.stringify(clientes[0].contratos[0].cargos) }
      });
    })()`));
    console.log('   filas: ' + inicial.filas + ' → ' + inicial.nombres.join(' · '));
    console.log('   resumen: "' + inicial.contador + '"');
    revisar(inicial.hayCaja, 'la caja desplegable existe dentro de la tarjeta');
    revisar(inicial.abierta === false, 'arranca cerrada (no estorba hasta que la abras)');
    revisar(inicial.filas === 4, 'lista los 3 items del paquete + 1 servicio adicional (4)');
    revisar(inicial.nombres.indexOf('Cobertura completa') !== -1 && inicial.nombres.indexOf('Cabina 360') !== -1,
      'incluye items del paquete y del servicio adicional');
    revisar(/0 de 4/.test(inicial.contador), 'el contador empieza en "0 de 4"');
    revisar(inicial.pendientes === 4, 'los 4 elementos dicen "Pendiente de entrega"');

    console.log('\n2) Abrir la lista y marcar "Álbum 30x30"');
    const marcado = JSON.parse(await evaluar(cdp, `(async function () {
      /* Se abre la lista como lo haría Jorge (clic en el resumen) y LUEGO se marca:
         así se comprueba también que la lista no se cierra sola al redibujarse. */
      document.querySelector('.entrega-caja > summary').click();
      await new Promise(function (r) { setTimeout(r, 350); });
      var abiertaAntes = document.querySelector('.entrega-caja').open;
      document.querySelector('[data-entrega="Álbum 30x30"]').click();
      await new Promise(function (r) { setTimeout(r, 350); });
      var co = clientes[0].contratos[0];
      var resumen = document.querySelector('.entrega-caja > summary');
      var fila = document.querySelector('[data-entrega="Álbum 30x30"]').closest('.entrega-fila');
      return JSON.stringify({
        abiertaAntes: abiertaAntes,
        marca: co.entregas ? co.entregas['Álbum 30x30'] : null,
        contador: resumen ? resumen.innerText.replace(/\\s+/g, ' ').trim() : '',
        sello: fila ? fila.querySelector('.entrega-sello').textContent.replace(/\\s+/g, ' ').trim() : '',
        tachada: fila ? fila.classList.contains('hecha') : null,
        abierta: document.querySelector('.entrega-caja').open,
        dinero: { pb: co.precioBase, pf: co.precioFinal, pagos: JSON.stringify(co.pagos), cargos: JSON.stringify(co.cargos) }
      });
    })()`));
    console.log('   guardado: ' + JSON.stringify(marcado.marca));
    console.log('   resumen: "' + marcado.contador + '" · sello: "' + marcado.sello + '"');
    revisar(marcado.abiertaAntes === true, 'la lista se abre con un clic en el resumen');
    revisar(!!marcado.marca, 'la palomita se guardó en el contrato');
    revisar(marcado.marca && !!marcado.marca.fecha, 'guarda la FECHA de la entrega (' + (marcado.marca && marcado.marca.fecha) + ')');
    revisar(marcado.marca && marcado.marca.por === 'Jorge Rosas', 'guarda QUIÉN la marcó (' + (marcado.marca && marcado.marca.por) + ')');
    revisar(/1 de 4/.test(marcado.contador), 'el contador sube a "1 de 4"');
    revisar(/Entregado/.test(marcado.sello), 'el sello de la fila dice "Entregado el …" ("' + marcado.sello + '")');
    revisar(marcado.tachada === true, 'la fila queda marcada como hecha');
    revisar(marcado.abierta === true, 'la lista sigue ABIERTA después de marcar (no se cierra sola)');
    revisar(marcado.dinero.pb === inicial.dinero.pb && marcado.dinero.pf === inicial.dinero.pf &&
      marcado.dinero.pagos === inicial.dinero.pagos && marcado.dinero.cargos === inicial.dinero.cargos,
      'el dinero NO se tocó: mismo precio base, precio final, cargos y pagos');
    revisar(marcado.dinero.pb === 51000 && marcado.dinero.pf === 51000, 'precio base y final intactos (51000)');

    console.log('\n3) Desmarcar');
    const desmarcado = JSON.parse(await evaluar(cdp, `(function () {
      document.querySelector('[data-entrega="Álbum 30x30"]').click();
      var co = clientes[0].contratos[0];
      var resumen = document.querySelector('.entrega-caja > summary');
      return JSON.stringify({
        quedan: co.entregas ? Object.keys(co.entregas).length : 0,
        contador: resumen ? resumen.innerText.replace(/\\s+/g, ' ').trim() : ''
      });
    })()`));
    console.log('   resumen: "' + desmarcado.contador + '"');
    revisar(desmarcado.quedan === 0, 'la marca se borró del contrato');
    revisar(/0 de 4/.test(desmarcado.contador), 'el contador vuelve a "0 de 4"');

    console.log('\n4) Al EDITAR y guardar el contrato, las palomitas NO se pierden');
    const editado = JSON.parse(await evaluar(cdp, `(async function () {
      /* Se marcan dos elementos y luego se abre el formulario de edición, se cambia
         la nota y se guarda: así se comprueba que el guardado real conserva las
         entregas (el CRM parte de una copia del contrato original). */
      document.querySelector('[data-entrega="Cobertura completa"]').click();
      document.querySelector('[data-entrega="Cabina 360"]').click();
      var antes = Object.keys(clientes[0].contratos[0].entregas).length;
      editarContrato('cli-1', 'con-1');
      await new Promise(function (r) { setTimeout(r, 700); });
      var notas = document.getElementById('contrato-notas');
      if (notas) notas.value = 'EDITADO POR LA PRUEBA';
      var form = document.getElementById('form-contrato');
      if (!form) return JSON.stringify({ error: 'no se abrió el formulario de edición' });
      form.requestSubmit();
      await new Promise(function (r) { setTimeout(r, 900); });
      var co = clientes[0].contratos[0];
      return JSON.stringify({
        antes: antes,
        despues: co.entregas ? Object.keys(co.entregas).length : 0,
        claves: co.entregas ? Object.keys(co.entregas) : [],
        notaNueva: co.notas,
        pf: co.precioFinal,
        hayConfirmacion: !!document.querySelector('.modal.active, #modal.active')
      });
    })()`));
    console.log('   marcas antes: ' + editado.antes + ' · después de guardar: ' + editado.despues + ' → ' + (editado.claves || []).join(' · '));
    console.log('   nota guardada: "' + editado.notaNueva + '"');
    revisar(editado.error === undefined, 'el formulario de edición abrió');
    revisar(editado.notaNueva === 'EDITADO POR LA PRUEBA', 'la edición sí se guardó (la nota cambió)');
    revisar(editado.despues === editado.antes && editado.despues === 2, 'las 2 palomitas siguen ahí después de editar y guardar');
    revisar(editado.pf === 51000, 'el precio final sigue intacto tras la edición');

    console.log('\n5) Contrato de SOLO SERVICIO y paquete sin items');
    const otros = JSON.parse(await evaluar(cdp, `(function () {
      verDetalleContrato('cli-2', 'con-2');
      var solo = [].slice.call(document.querySelectorAll('[data-entrega]')).map(function (f) { return f.getAttribute('data-entrega'); });
      var contadorSolo = (document.querySelector('.entrega-caja > summary') || {}).innerText || '';
      verDetalleContrato('cli-3', 'con-3');
      var vacio = document.querySelector('.entrega-caja-vacia');
      return JSON.stringify({
        solo: solo,
        contadorSolo: contadorSolo.replace(/\\s+/g, ' ').trim(),
        hayVacio: !!vacio,
        textoVacio: vacio ? vacio.innerText.replace(/\\s+/g, ' ').trim() : ''
      });
    })()`));
    console.log('   solo servicio → ' + otros.solo.join(' · ') + '  ("' + otros.contadorSolo + '")');
    console.log('   paquete sin items → "' + otros.textoVacio.substring(0, 90) + '"');
    revisar(otros.solo.length === 1 && otros.solo[0] === 'Cabina 360', 'en "solo servicio" lista el servicio del contrato');
    revisar(/0 de 1/.test(otros.contadorSolo), 'el contador del solo-servicio dice "0 de 1"');
    revisar(otros.hayVacio, 'un paquete sin items muestra un aviso en vez de una lista vacía');
    revisar(/no tiene items capturados/.test(otros.textoVacio), 'el aviso explica dónde se capturan los items');

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
