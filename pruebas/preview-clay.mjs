/*
 * preview-clay.mjs — vistas previas del CRM para revisar el estilo (Contratos y Calendario)
 * ---------------------------------------------------------------------------
 * Qué hace, en Chrome sin ventana:
 *   1. Abre el CRM REAL desde este disco y BLOQUEA toda la red de Firebase
 *      (igual que pruebas\sandbox\sandbox.mjs): sin SDK la app queda en modo
 *      local, así que no se lee ni se escribe NADA de la base de Jorge.
 *      Además NO se llama a inicializarFirebase(): se arma la pantalla sin nube.
 *   2. Siembra datos de ejemplo y dibuja cada sección con sus componentes reales.
 *   3. Inyecta la capa de estilos que se le pase y saca una captura por tema
 *      (dark, light, otono, angel).
 *   4. Guarda copias ESTÁTICAS (sin scripts, sin Firebase) con un selector de
 *      tema, para que Jorge las abra y compare.
 *
 * NOTA IMPORTANTE (desde el 9/10/2026): la capa de arcilla (@CSS-CLAY) ya vive
 * DENTRO de index.html, así que este script NO la inyecta: se limita a abrir el
 * archivo real, dibujar la sección y guardar lo que se ve. Si algún día hay que
 * volver a iterar un diseño, se saca la capa del CRM, se edita un .css aparte y
 * se inyecta con CRM_CSS=<ruta>.
 *
 * Cómo se corre:  node pruebas\preview-clay.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PAGINA = process.env.CRM_ARCHIVO ? path.resolve(process.env.CRM_ARCHIVO) : path.join(RAIZ, 'index.html');
/* Capa de estilos a inyectar ENCIMA. Vacío = la que ya trae el CRM. */
const CSS_EXTRA = process.env.CRM_CSS ? path.resolve(process.env.CRM_CSS) : '';
const SALIDA = path.join(RAIZ, 'preview');
const PUERTO = Number(process.env.CRM_PUERTO_CDP || 9338);

const TEMAS = ['dark', 'light', 'otono', 'angel'];
const ETIQUETA_TEMA = { dark: 'Oscuro', light: 'Claro', otono: 'Otoño', angel: 'Ángel' };

/* Dominios de datos: si alguno se llegara a pedir, el script se detiene. */
const DOMINIOS_DATOS = ['firebaseio.com', 'firebasedatabase.app', 'firebaseapp.com', 'googleapis.com',
  'gstatic.com', 'firebase.com', 'googleusercontent.com'];

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function buscarChrome() {
  const candidatos = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  for (const c of candidatos) if (fs.existsSync(c)) return c;
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
  let id = 0;
  const pendientes = new Map();
  const sucesos = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { resolver, rechazar } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? rechazar(new Error(m.method + ' → ' + JSON.stringify(m.error))) : resolver(m.result);
    } else if (m.method) sucesos.push(m);
  });
  const enviar = (method, params = {}) => new Promise((resolver, rechazar) => {
    const mid = ++id;
    pendientes.set(mid, { resolver, rechazar });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { enviar, sucesos };
}

async function evaluar(cdp, expresion) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Error en la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function captura(cdp, archivo) {
  const r = await cdp.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(SALIDA, archivo), Buffer.from(r.data, 'base64'));
  const kb = Math.round(fs.statSync(path.join(SALIDA, archivo)).size / 1024);
  console.log('   captura: preview\\' + archivo + '  (' + kb + ' KB)');
}

/* ── Los datos de ejemplo: contratos reales de un estudio de foto/video ──── */
function guionDatos() {
  return `
    var HOY = new Date();
    function iso(anio, mes, dia) { return anio + '-' + ('0' + mes).slice(-2) + '-' + ('0' + dia).slice(-2); }
    var A = HOY.getFullYear();

    /* Los paquetes llevan sus "Items incluidos" (los que se capturan en Catálogo →
       Paquetes): son los que alimentan la lista de entregas del contrato. */
    paquetes = [
      { id: 'paq-boda', nombre: 'Boda Diamante', items: [
        { tipo: 'personalizado', nombre: 'Cobertura completa del evento', cantidad: 1 },
        { tipo: 'personalizado', nombre: 'Álbum 30x30', cantidad: 1 },
        { tipo: 'personalizado', nombre: 'Sesión de compromiso', cantidad: 1 },
        { tipo: 'personalizado', nombre: 'Galería en línea', cantidad: 1 } ] },
      { id: 'paq-xv', nombre: 'XV Años Platino', items: [
        { tipo: 'personalizado', nombre: 'Cobertura de la misa y la fiesta', cantidad: 1 },
        { tipo: 'personalizado', nombre: 'Álbum 25x25', cantidad: 1 } ] },
      { id: 'paq-corp', nombre: 'Corporativo Ejecutivo' }
    ];
    serviciosAdicionales = [
      { id: 'srv-dron', nombre: 'Dron' },
      { id: 'srv-cabina', nombre: 'Cabina 360' },
      { id: 'srv-album', nombre: 'Álbum fine art' }
    ];

    function pago(n, monto, fecha, por, nota, codigo) {
      return { id: 'pag-' + n, monto: monto, fecha: fecha + 'T11:20:00', registradoPor: por, nota: nota, codigo: codigo };
    }
    function cargo(n, monto, fecha, por, nota) {
      return { id: 'car-' + n, monto: monto, fecha: fecha + 'T17:05:00', registradoPor: por, nota: nota };
    }
    function contrato(o) {
      return {
        id: o.id, clienteId: o.clienteId, clienteNombre: o.clienteNombre, festejado: o.festejado,
        tipo: o.tipo || 'paquete', paqueteId: o.paqueteId, serviciosIds: o.serviciosIds || [],
        precioBase: o.precioBase, precioFinal: o.precioFinal, descuentoMonto: o.descuentoMonto || 0,
        cargos: o.cargos || [], pagos: o.pagos || [], estado: o.estado,
        entregas: o.entregas || {},
        fechaEvento: o.fechaEvento, horaEvento: o.horaEvento, horaRecepcion: o.horaRecepcion || '',
        direccionEvento: o.direccionEvento, direccionRecepcion: o.direccionRecepcion || '',
        fechaRegistro: o.fechaRegistro || iso(A, 8, 14)
      };
    }
    function cliente(o) {
      return { id: o.id, nombre: o.nombre, telefono: o.telefono, email: o.email, estado: o.estado,
        fechaRegistro: o.fechaRegistro || iso(A, 8, 14), contratos: o.contratos };
    }

    clientes = [
      cliente({ id: 'cli-1', nombre: 'Familia Mendoza Ríos', telefono: '8781234567', email: 'mendoza@correo.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Familia Mendoza Ríos', festejado: 'Mariana y Diego',
          paqueteId: 'paq-boda', serviciosIds: ['srv-album'], precioBase: 45000, precioFinal: 45000, estado: 'Pendiente',
          /* Dos cosas ya entregadas, para que la lista se vea con los dos estados. */
          entregas: { 'Sesión de compromiso': { fecha: iso(A, 8, 30), por: 'Jorge Rosas' },
                      'Galería en línea': { fecha: iso(A, 9, 28), por: 'Ana (asistente)' } },
          fechaEvento: iso(A, 11, 21), horaEvento: '17:00', horaRecepcion: '20:30',
          direccionEvento: 'Parroquia San José, Piedras Negras', direccionRecepcion: 'Salón Real, Blvd. Juárez',
          cargos: [ cargo(1, 3500, iso(A, 9, 2), 'Jorge Rosas', 'Dron para la ceremonia al aire libre') ],
          pagos: [ pago(1, 20000, iso(A, 8, 15), 'Jorge Rosas', 'Anticipo para apartar la fecha', 'PDA-4821'),
                   pago(2, 15000, iso(A, 9, 20), 'Ana (asistente)', 'Segundo abono', 'PDA-5137') ] }) ] }),

      cliente({ id: 'cli-2', nombre: 'Fernanda Ruiz', telefono: '8782345678', email: 'fer.ruiz@correo.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-2', clienteId: 'cli-2', clienteNombre: 'Fernanda Ruiz', festejado: 'Fernanda',
          paqueteId: 'paq-xv', serviciosIds: ['srv-cabina'], precioBase: 38000, precioFinal: 38000, estado: 'Completado',
          /* Este contrato ya entregó todo: su tarjeta debe salir en VERDE. */
          entregas: { 'Cobertura de la misa y la fiesta': { fecha: iso(A, 9, 27), por: 'Jorge Rosas' },
                      'Álbum 25x25': { fecha: iso(A, 9, 30), por: 'Jorge Rosas' },
                      'Cabina 360': { fecha: iso(A, 9, 27), por: 'Ana (asistente)' } },
          fechaEvento: iso(A, 9, 27), horaEvento: '19:00', direccionEvento: 'Quinta Los Ángeles',
          pagos: [ pago(3, 20000, iso(A, 5, 10), 'Jorge Rosas', 'Anticipo', 'PDA-4410'),
                   pago(4, 18000, iso(A, 9, 26), 'Jorge Rosas', 'Liquidación antes del evento', 'PDA-5290') ] }) ] }),

      cliente({ id: 'cli-3', nombre: 'Grupo Industrial del Norte', telefono: '8783456789', email: 'eventos@gin.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-3', clienteId: 'cli-3', clienteNombre: 'Grupo Industrial del Norte', festejado: 'Convención anual',
          paqueteId: 'paq-corp', precioBase: 62000, precioFinal: 62000, estado: 'Pendiente',
          fechaEvento: iso(A + 1, 2, 12), horaEvento: '09:00', direccionEvento: 'Hotel Camino Real, Saltillo',
          cargos: [ cargo(2, 6000, iso(A, 9, 30), 'Jorge Rosas', 'Cabina 360 para la recepción') ],
          pagos: [ pago(5, 25000, iso(A, 9, 5), 'Jorge Rosas', 'Primer pago por transferencia', 'PDA-5002') ] }) ] }),

      cliente({ id: 'cli-4', nombre: 'Ana y Luis', telefono: '8784567890', email: 'anayluis@correo.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-4', clienteId: 'cli-4', clienteNombre: 'Ana y Luis', festejado: 'Ana y Luis',
          paqueteId: 'paq-boda', precioBase: 52000, precioFinal: 52000, estado: 'Pendiente',
          fechaEvento: iso(A + 1, 4, 18), horaEvento: '16:30', direccionEvento: 'Hacienda San Miguel',
          pagos: [ pago(6, 12000, iso(A, 9, 28), 'Ana (asistente)', 'Apartado de fecha', 'PDA-5310') ] }) ] }),

      cliente({ id: 'cli-5', nombre: 'Camila Ortega', telefono: '8785678901', email: 'camila.o@correo.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-5', clienteId: 'cli-5', clienteNombre: 'Camila Ortega', festejado: 'Camila',
          tipo: 'solo-servicio', serviciosIds: ['srv-cabina', 'srv-album'], precioBase: 34000, precioFinal: 34000, estado: 'Completado',
          fechaEvento: iso(A, 8, 30), horaEvento: '20:00', direccionEvento: 'Salón Diamante',
          pagos: [ pago(7, 34000, iso(A, 8, 29), 'Jorge Rosas', 'Pago único', 'PDA-4970') ] }) ] }),

      cliente({ id: 'cli-6', nombre: 'Sofía Herrera', telefono: '8786789012', email: 'sofia.h@correo.com', estado: 'Activo',
        contratos: [ contrato({ id: 'con-6', clienteId: 'cli-6', clienteNombre: 'Sofía Herrera', festejado: 'Sofía',
          tipo: 'solo-servicio', serviciosIds: ['srv-album'], precioBase: 9500, precioFinal: 9500, estado: 'Pendiente',
          fechaEvento: iso(A, 10, 12), horaEvento: '12:00', direccionEvento: 'Jardín Las Palmas', pagos: [] }) ] })
    ];

    tareas = [
      { id: 'tar-1', tipo: 'Llamada', descripcion: 'Confirmar la hora de la sesión de fotos previa', fecha: iso(A, 10, 20),
        completada: false, clienteId: 'cli-1', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, 9, 1) + 'T10:00:00' },
      { id: 'tar-2', tipo: 'Entrega', descripcion: 'Entregar el álbum fine art', fecha: iso(A, 11, 5),
        completada: false, clienteId: 'cli-1', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, 9, 3) + 'T09:30:00' },
      { id: 'tar-3', tipo: 'Pago', descripcion: 'Recordar el abono pendiente', fecha: iso(A, 9, 15),
        completada: true, clienteId: 'cli-1', creadaPor: 'Ana (asistente)', fechaCreacion: iso(A, 9, 1) + 'T12:00:00',
        fechaCompletada: iso(A, 9, 16) + 'T18:40:00' }
    ];
  `;
}

/* Arma la pantalla: datos de ejemplo + entrar sin nube + sección Contratos +
   panel lateral del primer contrato. Se usa dos veces (PC y teléfono) porque en
   el teléfono la app se tiene que acomodar desde que carga, no al cambiar de ancho. */
function expresionMontar() {
  return `(function () {
    try {
      ${guionDatos()}
      usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'vista-previa@local' };
      ocultarPantallaLogin();
      actualizarUIUsuario();
      aplicarRestriccionesPorRol();
      conectarEventListenersApp();
      renderizarTodo();
      if (typeof App !== 'undefined' && App.seleccionarSeccion) App.seleccionarSeccion('contratos');
      else { cambiarSeccion('contratos'); renderizarSeccion('contratos'); }
      verDetalleContrato('cli-1', 'con-1');
      return JSON.stringify({ contratos: document.querySelectorAll('#lista-contratos .mosaico-card').length,
        panel: document.getElementById('panel-lateral-global').style.display,
        modo: (typeof estadoSync !== 'undefined' && estadoSync) ? estadoSync.modo : '?' });
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`;
}

/* ── Los datos del CALENDARIO ─────────────────────────────────────────────
   El calendario es la sección más cargada del CRM: dibuja en la misma rejilla
   los contratos/eventos, las tareas pendientes y completadas, las tareas de
   campaña y los seguimientos de campaña. Aquí se siembra todo eso repartido en
   el mes, con un día cargado a propósito (el de hoy) para ver la etiqueta
   "+N más" y la lista del día. */
function guionDatosCalendario() {
  return `
    var HOY = new Date();
    var A = HOY.getFullYear(), M = HOY.getMonth() + 1;
    function iso(anio, mes, dia) { return anio + '-' + ('0' + mes).slice(-2) + '-' + ('0' + dia).slice(-2); }
    function f(d) { return iso(A, M, d); }
    var dHoy = HOY.getDate();
    var HOYISO = f(dHoy);
    /* Días repartidos por el mes, sin chocar con el día de hoy. */
    var otros = [3, 5, 12, 15, 17, 21, 24, 27, 30].filter(function (d) { return d !== dHoy; });
    var D1 = otros[0], D2 = otros[1], D3 = otros[2], D4 = otros[3], D5 = otros[4], D6 = otros[5], D7 = otros[6], D8 = otros[7], D9 = otros[8];

    paquetes = [
      { id: 'paq-boda', nombre: 'Boda Diamante' },
      { id: 'paq-xv', nombre: 'XV Años Platino' },
      { id: 'paq-corp', nombre: 'Corporativo Ejecutivo' }
    ];
    serviciosAdicionales = [
      { id: 'srv-dron', nombre: 'Dron' },
      { id: 'srv-cabina', nombre: 'Cabina 360' },
      { id: 'srv-album', nombre: 'Álbum fine art' }
    ];

    function contrato(o) {
      return {
        id: o.id, clienteId: o.clienteId, clienteNombre: o.clienteNombre, festejado: o.festejado,
        tipo: o.tipo || 'paquete', paqueteId: o.paqueteId, serviciosIds: o.serviciosIds || [],
        precioBase: o.precioBase, precioFinal: o.precioFinal, descuentoMonto: 0,
        cargos: [], pagos: o.pagos || [], estado: o.estado || 'Pendiente',
        fechaEvento: o.fechaEvento, horaEvento: o.horaEvento || '17:00', horaRecepcion: o.horaRecepcion || '',
        direccionEvento: o.direccionEvento || 'Salón por confirmar', direccionRecepcion: '',
        fechaRegistro: iso(A, M, 1)
      };
    }
    function cliente(o) {
      return { id: o.id, nombre: o.nombre, telefono: o.telefono, email: o.email, estado: 'Activo',
        fechaRegistro: iso(A, M, 1), contratos: o.contratos };
    }
    function pago(n, monto, dia) { return { id: 'pag-' + n, monto: monto, fecha: f(dia) + 'T11:20:00', registradoPor: 'Jorge Rosas', codigo: 'PDA-' + (5000 + n) }; }

    clientes = [
      cliente({ id: 'cli-1', nombre: 'Familia Mendoza Ríos', telefono: '8781234567', email: 'mendoza@correo.com',
        contratos: [ contrato({ id: 'con-1', clienteId: 'cli-1', clienteNombre: 'Familia Mendoza Ríos', festejado: 'Mariana y Diego',
          paqueteId: 'paq-boda', serviciosIds: ['srv-album'], precioBase: 45000, precioFinal: 45000, estado: 'Pendiente',
          fechaEvento: f(D6), horaEvento: '17:00', horaRecepcion: '20:30', pagos: [pago(1, 20000, D1), pago(2, 15000, D2)] }),
          contrato({ id: 'con-1b', clienteId: 'cli-1', clienteNombre: 'Familia Mendoza Ríos', festejado: 'Sesión de fotos previa',
            tipo: 'solo-servicio', serviciosIds: ['srv-dron'], precioBase: 6500, precioFinal: 6500,
            fechaEvento: HOYISO, horaEvento: '10:00', pagos: [pago(3, 6500, D1)] }) ] }),

      cliente({ id: 'cli-2', nombre: 'Fernanda Ruiz', telefono: '8782345678', email: 'fer.ruiz@correo.com',
        contratos: [ contrato({ id: 'con-2', clienteId: 'cli-2', clienteNombre: 'Fernanda Ruiz', festejado: 'Fernanda',
          paqueteId: 'paq-xv', serviciosIds: ['srv-cabina'], precioBase: 38000, precioFinal: 38000, estado: 'Completado',
          fechaEvento: f(D8), horaEvento: '19:00', pagos: [pago(4, 38000, D3)] }) ] }),

      cliente({ id: 'cli-3', nombre: 'Grupo Industrial del Norte', telefono: '8783456789', email: 'eventos@gin.com',
        contratos: [ contrato({ id: 'con-3', clienteId: 'cli-3', clienteNombre: 'Grupo Industrial del Norte', festejado: 'Convención anual',
          paqueteId: 'paq-corp', precioBase: 62000, precioFinal: 62000, fechaEvento: HOYISO, horaEvento: '09:00',
          direccionEvento: 'Hotel Camino Real, Saltillo', pagos: [pago(5, 25000, D4)] }) ] }),

      cliente({ id: 'cli-4', nombre: 'Ana y Luis', telefono: '8784567890', email: 'anayluis@correo.com',
        contratos: [ contrato({ id: 'con-4', clienteId: 'cli-4', clienteNombre: 'Ana y Luis', festejado: 'Ana y Luis',
          paqueteId: 'paq-boda', precioBase: 52000, precioFinal: 52000, fechaEvento: HOYISO, horaEvento: '16:30',
          direccionEvento: 'Hacienda San Miguel', pagos: [pago(6, 12000, D5)] }) ] }),

      cliente({ id: 'cli-5', nombre: 'Camila Ortega', telefono: '8785678901', email: 'camila.o@correo.com',
        contratos: [ contrato({ id: 'con-5', clienteId: 'cli-5', clienteNombre: 'Camila Ortega', festejado: 'Camila',
          tipo: 'solo-servicio', serviciosIds: ['srv-cabina'], precioBase: 34000, precioFinal: 34000, estado: 'Completado',
          fechaEvento: f(D4), horaEvento: '20:00', pagos: [pago(7, 34000, D2)] }),
          contrato({ id: 'con-5b', clienteId: 'cli-5', clienteNombre: 'Camila Ortega', festejado: 'Bautizo de su hermano',
            tipo: 'solo-servicio', serviciosIds: ['srv-album'], precioBase: 9500, precioFinal: 9500,
            fechaEvento: f(D1), horaEvento: '12:00', pagos: [] }) ] }),

      cliente({ id: 'cli-6', nombre: 'Sofía Herrera', telefono: '8786789012', email: 'sofia.h@correo.com',
        contratos: [ contrato({ id: 'con-6', clienteId: 'cli-6', clienteNombre: 'Sofía Herrera', festejado: 'Sofía',
          tipo: 'solo-servicio', serviciosIds: ['srv-album'], precioBase: 9500, precioFinal: 9500,
          fechaEvento: f(D5), horaEvento: '12:00', pagos: [] }) ] })
    ];

    /* Tareas: sueltas, de cliente, completadas y de campaña (con campaniaId). */
    tareas = [
      { id: 'tar-1', tipo: 'Llamada', descripcion: 'Confirmar la hora de la sesión de fotos', fecha: HOYISO,
        completada: false, clienteId: 'cli-1', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 1) + 'T10:00:00' },
      { id: 'tar-2', tipo: 'Entrega', descripcion: 'Entregar el álbum fine art', fecha: HOYISO,
        completada: false, clienteId: 'cli-1', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 1) + 'T09:30:00' },
      { id: 'tar-3', tipo: 'Pago', descripcion: 'Recordar el abono pendiente de la boda', fecha: f(D1),
        completada: false, clienteId: 'cli-1', creadaPor: 'Ana (asistente)', fechaCreacion: iso(A, M, 1) + 'T12:00:00' },
      { id: 'tar-4', tipo: 'Sesión', descripcion: 'Sesión de fotos previa con Dron', fecha: HOYISO,
        completada: true, clienteId: 'cli-1', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 2) + 'T12:00:00',
        fechaCompletada: f(D3) + 'T18:40:00' },
      { id: 'tar-5', tipo: 'Revisión', descripcion: 'Revisar el material del XV de Fernanda', fecha: f(D2),
        completada: true, clienteId: 'cli-2', creadaPor: 'Ana (asistente)', fechaCreacion: iso(A, M, 2) + 'T12:00:00',
        fechaCompletada: f(D2) + 'T19:10:00' },
      { id: 'tar-6', tipo: 'Cobranza', descripcion: 'Llamar al corporativo por el anticipo', fecha: f(D3),
        completada: false, clienteId: 'cli-3', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 3) + 'T09:00:00' },
      { id: 'tar-7', tipo: 'Seguimiento', descripcion: 'Seguimiento de campaña de bodas 2027', fecha: f(D3),
        completada: false, campaniaId: 'camp-1', participacionId: 'part-1', prospectoId: 'pro-1',
        creadaPor: 'Ana (asistente)', fechaCreacion: iso(A, M, 3) + 'T09:00:00' },
      { id: 'tar-8', tipo: 'Cotización', descripcion: 'Enviar la cotización del paquete corporativo', fecha: f(D6),
        completada: false, clienteId: 'cli-4', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 4) + 'T09:00:00' },
      { id: 'tar-9', tipo: 'Entrega', descripcion: 'Subir la galería en línea del bautizo', fecha: f(D9),
        completada: false, clienteId: 'cli-5', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M, 6) + 'T09:00:00' },
      { id: 'tar-10', tipo: 'Llamada', descripcion: 'Confirmar la fecha de la entrega del álbum', fecha: iso(A, M - 1, 28),
        completada: true, clienteId: 'cli-6', creadaPor: 'Jorge Rosas', fechaCreacion: iso(A, M - 1, 20) + 'T09:00:00' }
    ];

    /* Prospectos, campañas y participaciones: de aquí salen los SEGUIMIENTOS que
       el calendario pinta en color cian. */
    prospectos = [
      { id: 'pro-1', nombre: 'Mariana López', faseActual: 'Interesado', fechaRegistro: iso(A, M, 1) },
      { id: 'pro-2', nombre: 'Karla y Andrés', faseActual: 'Cotización', fechaRegistro: iso(A, M, 1) },
      { id: 'pro-3', nombre: 'Diego Ramírez', faseActual: 'Negociación', fechaRegistro: iso(A, M, 2) }
    ];
    campanias = [
      { id: 'camp-1', nombre: 'Bodas 2027', estado: 'activa' },
      { id: 'camp-2', nombre: 'XV años verano', estado: 'activa' }
    ];
    participaciones = [
      { id: 'part-1', prospectoId: 'pro-1', campaniaId: 'camp-1', estado: 'enCurso', etapaId: 'et-1', fechaProximoSeguimiento: HOYISO },
      { id: 'part-2', prospectoId: 'pro-2', campaniaId: 'camp-1', estado: 'enCurso', etapaId: 'et-1', fechaProximoSeguimiento: f(D4) },
      { id: 'part-3', prospectoId: 'pro-3', campaniaId: 'camp-2', estado: 'enCurso', etapaId: 'et-1', fechaProximoSeguimiento: f(D7) }
    ];
  `;
}

/* Arma la pantalla del CALENDARIO: datos + entrar sin nube + la sección.
   No se usa renderizarTodo() a propósito: aquí solo importa el calendario (con
   su lista de tareas), y así no se depende de que las otras secciones toleren
   datos de ejemplo a medias. */
function expresionMontarCalendario() {
  return `(function () {
    try {
      ${guionDatosCalendario()}
      usuarioActual = { nombre: 'Jorge Rosas', rol: 'Administrador', admin: true, email: 'vista-previa@local' };
      ocultarPantallaLogin();
      actualizarUIUsuario();
      aplicarRestriccionesPorRol();
      conectarEventListenersApp();
      if (typeof App !== 'undefined' && App.seleccionarSeccion) App.seleccionarSeccion('calendario');
      else { cambiarSeccion('calendario'); renderizarSeccion('calendario'); }
      renderizarCalendario();
      var celdas = document.querySelectorAll('#calendario-grid .dia:not(.otro-mes)');
      var hoy = document.querySelector('#calendario-grid .dia[data-fecha="' + HOYISO + '"]');
      /* El botón "Hoy" lleva el color de acento del CRM: si una capa de estilo le
         pinta un degradado por encima, el texto (oscuro) queda sobre oscuro. */
      var bh = getComputedStyle(document.getElementById('btn-mes-actual'));
      return JSON.stringify({
        celdas: celdas.length,
        mes: (document.getElementById('calendario-mes-ano') || {}).textContent,
        hoy: HOYISO,
        etiquetasHoy: hoy ? hoy.querySelectorAll('.evento').length : -1,
        masHoy: hoy ? ((hoy.querySelector('.evento-mas') || {}).textContent || '') : '',
        tareasLista: document.querySelectorAll('#lista-tareas .tarjeta-registro').length,
        btnHoyColor: bh.backgroundColor,
        btnHoyImagen: bh.backgroundImage,
        modo: (typeof estadoSync !== 'undefined' && estadoSync) ? estadoSync.modo : '?'
      });
    } catch (e) { return 'error: ' + (e && e.message ? e.message : e); }
  })()`;
}

/* La copia del CRM SIN el SDK de Firebase: es la que se le pasa a los arneses de
   navegador (`medir-calendario-movil.mjs`, `movil-filtros.mjs`, `calendario-mes.mjs`)
   para poder medir sin que la app pueda tocar la base real. Sin SDK la app entra
   en modo local. Si se está iterando un diseño (CRM_CSS), la capa se agrega aquí. */
function escribirIndexParaArnes(css) {
  const original = fs.readFileSync(PAGINA, 'utf8');
  const sinNube = original.replace(/[ \t]*<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>\r?\n?/g, '');
  const quitados = (original.match(/gstatic\.com\/firebasejs/g) || []).length - (sinNube.match(/gstatic\.com\/firebasejs/g) || []).length;
  if (quitados !== 3) throw new Error('Se esperaban quitar 3 etiquetas del SDK de Firebase y se quitaron ' + quitados);
  const copia = css ? sinNube.replace('</head>', '    <style id="clay-preview">\n' + css + '\n    </style>\n</head>') : sinNube;
  if (!copia.includes('@CSS-CLAY') && !css) throw new Error('La copia del arnés quedó sin la capa de arcilla.');
  const destino = path.join(SALIDA, 'index-sin-sdk.html');
  fs.writeFileSync(destino, copia, 'utf8');
  console.log('\nCopia para los arneses: preview\\index-sin-sdk.html (' +
    Math.round(fs.statSync(destino).size / 1024) + ' KB, sin SDK de Firebase → modo local)');
  return destino;
}

/* La copia estática que Jorge abre: se quitan los scripts del CRM (sin Firebase
   y sin nada que se reconecte solo), se agrega la barra para cambiar de tema y
   se devuelve el HTML completo. Se usa para Contratos y para Calendario. */
async function serializarVista(cdp, nota) {
  return await evaluar(cdp, `(function () {
    document.querySelectorAll('script').forEach(function (s) { s.remove(); });
    var barra = document.createElement('div');
    barra.id = 'barra-preview';
    barra.innerHTML = '<span class="bp-titulo">Vista previa · Claymorphism</span>' +
      '<span class="bp-nota">' + ${JSON.stringify(nota)} + '</span>' +
      ['dark', 'light', 'otono', 'angel'].map(function (t) {
        return '<button data-tema="' + t + '">' + ({ dark: 'Oscuro', light: 'Claro', otono: 'Otoño', angel: 'Ángel' })[t] + '</button>';
      }).join('');
    document.body.appendChild(barra);
    var est = document.createElement('style');
    est.textContent = '#barra-preview{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;' +
      'display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;font-family:Segoe UI,sans-serif;' +
      'background:rgba(20,20,22,.92);color:#e8e8e8;box-shadow:0 18px 40px -18px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.10);' +
      'border:1px solid rgba(255,255,255,.10);font-size:12px}' +
      '#barra-preview .bp-titulo{font-weight:700;letter-spacing:.3px}' +
      '#barra-preview .bp-nota{color:#a8a8a8}' +
      '#barra-preview button{cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 14px;' +
      'background:rgba(255,255,255,.06);color:#e8e8e8;font:inherit;font-weight:600}' +
      '#barra-preview button:hover{background:rgba(201,168,76,.22)}' +
      '#barra-preview button.activo{background:#c9a84c;color:#0d0d0d;border-color:#c9a84c}';
    document.head.appendChild(est);
    var sc = document.createElement('script');
    sc.textContent = "var bs=document.querySelectorAll('#barra-preview button');" +
      "function pinta(t){document.documentElement.setAttribute('data-theme',t);" +
      "bs.forEach(function(b){b.classList.toggle('activo',b.getAttribute('data-tema')===t);});}" +
      "bs.forEach(function(b){b.onclick=function(){pinta(b.getAttribute('data-tema'));};});pinta('dark');";
    document.body.appendChild(sc);
    return '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
  })()`);
}

/* Abre una copia estática y comprueba que sirve: que traiga los botones de tema,
   que el tema cambie de verdad, que el contenido esté dibujado y que NO haya
   quedado nada de Firebase. */
async function comprobarCopia(cdp, archivo, queContar) {
  await cdp.enviar('Page.navigate', { url: 'file:///' + path.join(SALIDA, archivo).replace(/\\/g, '/') });
  await dormir(2600);
  const chk = JSON.parse(await evaluar(cdp, `(function () {
    var botones = document.querySelectorAll('#barra-preview button');
    var claro = document.querySelector('#barra-preview button[data-tema="light"]');
    if (claro) claro.click();
    return JSON.stringify({
      botones: botones.length,
      cambioTema: document.documentElement.getAttribute('data-theme'),
      contenido: document.querySelectorAll(${JSON.stringify(queContar)}).length,
      scripts: document.querySelectorAll('script').length,
      firebase: typeof firebase !== 'undefined',
      /* La capa de arcilla puede venir DENTRO del CRM (@CSS-CLAY) o inyectada
         aparte mientras se itera un diseño: se acepta cualquiera de las dos. */
      fuenteArcilla: document.documentElement.outerHTML.indexOf('@CSS-CLAY') !== -1 ||
        !!document.getElementById('clay-preview')
    });
  })()`));
  const bien = chk.botones === 4 && chk.cambioTema === 'light' && chk.contenido > 0 &&
    !chk.firebase && chk.fuenteArcilla;
  console.log('   ' + archivo + ': ' + chk.botones + ' botones de tema · al pulsar "Claro" queda en "' + chk.cambioTema +
    '" · elementos dibujados (' + queContar + '): ' + chk.contenido);
  console.log('     scripts: ' + chk.scripts + ' (solo el del selector) · firebase definido: ' + chk.firebase +
    ' · capa de arcilla: ' + chk.fuenteArcilla);
  console.log('     → ' + (bien ? 'EL ARCHIVO ABRE Y FUNCIONA' : 'REVISAR: el archivo no cumple lo esperado'));
  if (!bien) throw new Error('La copia ' + archivo + ' no pasó su comprobación.');
}

async function main() {
  /* La capa de arcilla ya vive dentro del CRM, así que por lo general no hay
     nada que inyectar. Con CRM_CSS=<ruta> se inyecta una capa aparte (modo
     iteración de diseño) y entonces sí se pueden sacar capturas del "antes". */
  if (CSS_EXTRA && !fs.existsSync(CSS_EXTRA)) throw new Error('No encontré la capa indicada en CRM_CSS: ' + CSS_EXTRA);
  const css = CSS_EXTRA ? fs.readFileSync(CSS_EXTRA, 'utf8') : '';
  if (css) console.log('Iterando diseño: se inyecta ' + CSS_EXTRA + '\n');
  else console.log('La capa de arcilla vive dentro de index.html: no se inyecta nada.\n');
  fs.mkdirSync(SALIDA, { recursive: true });

  const chrome = spawn(buscarChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files', '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + path.join(os.tmpdir(), 'crm-preview-clay'), 'about:blank'
  ], { stdio: 'ignore' });

  const URL = 'file:///' + PAGINA.replace(/\\/g, '/');

  try {
    const pagina = await esperarCDP();
    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = crearCliente(ws);
    await cdp.enviar('Page.enable');
    await cdp.enviar('Runtime.enable');
    await cdp.enviar('Network.enable');

    // ── CAPA 1: la red de datos, bloqueada (firebase, googleapis, gstatic) ──
    await cdp.enviar('Network.setBlockedURLs', {
      urls: ['*firebaseio.com*', '*firebasedatabase.app*', '*firebaseapp.com*', '*firebase.com*',
        '*googleapis.com*', '*gstatic.com*', '*googleusercontent.com*']
    });

    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);

    // ── CAPA 2: comprobar que el SDK NO cargó y que no salió ninguna petición
    const aislado = await evaluar(cdp, `(function () {
      return JSON.stringify({
        firebaseDefinido: typeof firebase !== 'undefined',
        sdkCargado: typeof window.firebase !== 'undefined',
        listo: !!document.getElementById('lista-contratos')
      });
    })()`);
    const iso = JSON.parse(aislado);
    const esDato = (u) => DOMINIOS_DATOS.some(d => String(u).indexOf(d) !== -1);
    /* Chrome reporta también las peticiones BLOQUEADAS como "intento": por eso
       lo que se mide es que ninguna haya llegado a RESPONDER. Si hubo respuesta
       de un dominio de datos, la vista previa se aborta. */
    const intentos = cdp.sucesos.filter(s => s.method === 'Network.requestWillBeSent').map(s => s.params.request.url).filter(esDato);
    const respuestas = cdp.sucesos.filter(s => s.method === 'Network.responseReceived').map(s => s.params.response.url).filter(esDato);
    const bloqueados = cdp.sucesos.filter(s => s.method === 'Network.loadingFailed' && s.params.blockedReason).length;
    console.log('Aislamiento:');
    console.log('   firebase definido en la página: ' + iso.firebaseDefinido + '  (debe ser false → modo local)');
    console.log('   intentos a dominios de datos: ' + intentos.length + ' · bloqueados por el navegador: ' + bloqueados);
    if (intentos.length) intentos.slice(0, 4).forEach(u => console.log('      intento: ' + u.slice(0, 90)));
    console.log('   RESPUESTAS de dominios de datos: ' + respuestas.length + '  (deben ser 0)');
    if (iso.firebaseDefinido || respuestas.length) {
      throw new Error('ABORTADO: la página pudo tocar la nube. No se genera ninguna vista previa.');
    }

    // ── CAPA 3: los datos de ejemplo y la pantalla, SIN llamar a Firebase ──
    const montar = await evaluar(cdp, expresionMontar());
    console.log('Montaje: ' + montar);
    if (String(montar).indexOf('error:') === 0) throw new Error('No se pudo montar la vista previa: ' + montar);
    const info = JSON.parse(montar);
    if (info.contratos !== 6) throw new Error('Se esperaban 6 contratos dibujados y hay ' + info.contratos);

    // ── El "antes" (solo al iterar un diseño): la pantalla SIN la capa nueva ──
    if (css) {
      console.log('\nCapturas del ANTES (con el CRM como está, sin la capa nueva):');
      for (const tema of ['dark', 'light']) {
        await evaluar(cdp, `(function () { document.documentElement.setAttribute('data-theme', '${tema}'); return 1; })()`);
        await dormir(400);
        await captura(cdp, 'antes-' + tema + '.png');
      }
    } else {
      console.log('\n(Sin capturas del ANTES: la capa de arcilla ya vive dentro de index.html.)');
    }

    // ── CAPA 4: el CSS de arcilla, ENCIMA del CRM (el archivo real no cambia) ──
    await evaluar(cdp, `(function () {
      var s = document.createElement('style');
      s.id = 'clay-preview';
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
      document.documentElement.setAttribute('data-theme', 'dark');
      return 1;
    })()`);
    await dormir(600);

    console.log('\nCapturas (1512 x 950):');
    for (const tema of TEMAS) {
      await evaluar(cdp, `(function () { document.documentElement.setAttribute('data-theme', '${tema}'); return 1; })()`);
      await dormir(450);
      await captura(cdp, 'contratos-' + tema + '.png');
    }

    /* La lista de "qué se ha entregado", desplegada, para poder revisarla
       (es la funcionalidad que Jorge pidió el 9/10/2026). */
    const entregas = JSON.parse(await evaluar(cdp, `(function () {
      document.documentElement.setAttribute('data-theme', 'dark');
      var s = document.querySelector('.entrega-caja > summary');
      if (s) s.click();
      /* La tarjeta queda abajo del panel: se lleva a la vista antes de la captura. */
      var caja = document.querySelector('.entrega-caja');
      if (caja && caja.scrollIntoView) caja.scrollIntoView({ block: 'center' });
      var resumen = document.querySelector('.entrega-caja > summary');
      return JSON.stringify({
        hay: !!s,
        resumen: resumen ? resumen.innerText.replace(/\\s+/g, ' ').trim() : '',
        filas: document.querySelectorAll('[data-entrega]').length,
        entregadas: document.querySelectorAll('.entrega-fila.hecha').length
      });
    })()`));
    await dormir(600);
    await captura(cdp, 'contrato-entregas-dark.png');
    console.log('   lista de entregas: ' + entregas.filas + ' elemento(s), ' + entregas.entregadas + ' entregado(s) · "' + entregas.resumen + '"');
    if (!entregas.hay || entregas.filas === 0) throw new Error('La lista de entregas no apareció en el detalle del contrato.');
    await evaluar(cdp, `(function () { var s = document.querySelector('.entrega-caja > summary'); if (s) s.click(); return 1; })()`);
    await dormir(300);

    /* ── Lo que Jorge pidió, medido y no a ojo ────────────────────────────────
       1. Que las tarjetas de dentro del panel derecho NO tengan barra lateral.
       2. Que en Otoño (y en los demás) los textos del menú de la izquierda se
          lean: se calcula el contraste WCAG entre el texto del menú y el color
          de la barra lateral. Menos de 3 ya es ilegible; de 4.5 para arriba es
          el mínimo recomendado para texto normal.
       Se mide tema por tema y CON ESPERA: el CRM tiene transiciones de color de
       0.25 s, así que leer el color en el mismo instante del cambio devuelve el
       color anterior (y todos los temas darían el mismo número). */
    console.log('\nLo que pidió Jorge (comprobado en la página, tema por tema):');
    console.log('   tema     barra izq. sección   tarea   aviso   menú (texto / fondo / contraste)');
    let fallosJorge = 0;
    for (const tema of TEMAS) {
      await evaluar(cdp, `(function () {
        document.documentElement.setAttribute('data-theme', '${tema}');
        /* Aviso de prueba: los datos de ejemplo no generan alertas, así que se
           inserta uno temporal para comprobar que tampoco trae barra lateral. */
        var cuerpo = document.getElementById('panel-lateral-body');
        if (cuerpo && !document.getElementById('aviso-de-prueba')) {
          var d = document.createElement('div');
          d.id = 'aviso-de-prueba';
          d.className = 'lista-avisos';
          d.textContent = 'aviso de prueba';
          cuerpo.appendChild(d);
        }
        return 1;
      })()`);
      await dormir(420);
      const f = JSON.parse(await evaluar(cdp, `(function () {
        function rgb(s) { var m = String(s).match(/[0-9.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }
        function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        function lum(s) { var a = rgb(s); return 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]); }
        function contraste(f, b) { var l1 = lum(f), l2 = lum(b); var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
        var sec = document.querySelector('.detalle-seccion');
        var tar = document.querySelector('.tarea-vinculada');
        var avi = document.getElementById('aviso-de-prueba');
        var menu = document.querySelector('.menu-item span');
        var sidebar = document.getElementById('sidebar');
        var colorMenu = getComputedStyle(menu).color;
        var colorBarra = getComputedStyle(sidebar).backgroundColor;
        return JSON.stringify({
          seccion: sec ? getComputedStyle(sec).borderLeftWidth : 'sin sección',
          tarea: tar ? getComputedStyle(tar).borderLeftWidth : 'sin tareas',
          aviso: avi ? getComputedStyle(avi).borderLeftWidth : 'sin aviso',
          colorMenu: colorMenu, colorBarra: colorBarra,
          contraste: +contraste(colorMenu, colorBarra).toFixed(2)
        });
      })()`));
      const limpio = f.seccion === '0px' && (f.tarea === '0px' || f.tarea === 'sin tareas') && (f.aviso === '0px' || f.aviso === 'sin aviso');
      const legible = f.contraste >= 4.5;
      if (!limpio || !legible) fallosJorge++;
      console.log('   ' + (tema + '      ').slice(0, 8) +
        (f.seccion + '             ').slice(0, 20) +
        (f.tarea + '        ').slice(0, 8) +
        (f.aviso + '        ').slice(0, 8) +
        '  ' + f.colorMenu + ' / ' + f.colorBarra + ' = ' + f.contraste +
        (legible ? '' : '  ← ILEGIBLE') + (limpio ? '' : '  ← QUEDA BARRA LATERAL'));
    }
    await evaluar(cdp, `(function () { var d = document.getElementById('aviso-de-prueba'); if (d) d.remove(); return 1; })()`);
    console.log('   → ' + (fallosJorge === 0 ? 'sin barras laterales y con texto legible en los 4 temas' : 'REVISAR: ' + fallosJorge + ' tema(s)'));
    if (fallosJorge) throw new Error('Las tarjetas del panel o el menú lateral no cumplen lo pedido.');

    /* Capturas SOLO del fondo: se esconden las tarjetas y el panel para poder
       MEDIR las manchas de degradado sin que las tape nada. No son para mirar.
       Van ANTES de pasar al teléfono: después de cargar la página en ancho de
       teléfono, la maqueta ya no es la de PC. */
    await evaluar(cdp, `(function () {
      var s = document.createElement('style');
      s.id = 'clay-solo-fondo';
      s.textContent = '#lista-contratos,.filtros-container,.seccion-header,#panel-lateral-global{display:none !important;}';
      document.head.appendChild(s);
      return 1;
    })()`);
    console.log('\nCapturas del fondo (sin tarjetas, solo para medir las manchas):');
    for (const tema of TEMAS) {
      await evaluar(cdp, `(function () { document.documentElement.setAttribute('data-theme', '${tema}'); return 1; })()`);
      await dormir(400);
      await captura(cdp, 'fondo-' + tema + '.png');
    }
    await evaluar(cdp, `(function () {
      var s = document.getElementById('clay-solo-fondo'); if (s) s.remove();
      document.documentElement.setAttribute('data-theme', 'dark');
      return 1;
    })()`);

    /* El teléfono: se CARGA la página ya con el ancho de teléfono, que es como la
       abre Jorge. Cambiar el ancho a media sesión deja la maqueta a medias (la
       barra lateral y el contenido se quedan donde estaban) y la captura sale mal. */
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);
    await evaluar(cdp, `(function () {
      var s = document.createElement('style');
      s.id = 'clay-preview';
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
      document.documentElement.setAttribute('data-theme', 'dark');
      return 1;
    })()`);
    const movil = await evaluar(cdp, expresionMontar());
    if (String(movil).indexOf('error:') === 0) throw new Error('No se pudo montar el teléfono: ' + movil);
    await evaluar(cdp, `(function () { cerrarModal(); cerrarPanelLateral(); return 1; })()`);
    await dormir(600);
    await captura(cdp, 'contratos-movil.png');
    await evaluar(cdp, `(function () { verDetalleContrato('cli-1', 'con-1'); return 1; })()`);
    await dormir(600);
    await captura(cdp, 'contrato-detalle-movil.png');
    await evaluar(cdp, `(function () { cerrarModal(); return 1; })()`);

    /* ══════════════════ CALENDARIO ══════════════════
       Es la sección más cargada del CRM: en la MISMA rejilla van los contratos,
       las tareas pendientes y completadas, las tareas de campaña y los
       seguimientos; abajo va la lista de tareas; y NO tiene panel lateral. */
    console.log('\n════ CALENDARIO ════');
    const inyectarArcilla = `(function () {
      var s = document.createElement('style');
      s.id = 'clay-preview';
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
      document.documentElement.setAttribute('data-theme', 'dark');
      return 1;
    })()`;

    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);
    await evaluar(cdp, inyectarArcilla);
    const cal = await evaluar(cdp, expresionMontarCalendario());
    if (String(cal).indexOf('error:') === 0) throw new Error('No se pudo montar el calendario: ' + cal);
    const infoCal = JSON.parse(cal);
    console.log('Montaje: ' + cal);
    console.log('   botón "Hoy": color ' + infoCal.btnHoyColor + ' · degradado encima: ' + infoCal.btnHoyImagen);
    if (infoCal.btnHoyImagen !== 'none' || /rgba\(0, 0, 0, 0\)/.test(infoCal.btnHoyColor)) {
      throw new Error('El botón "Hoy" perdió su color de acento (quedaría texto oscuro sobre fondo oscuro).');
    }

    /* El "antes" del calendario (solo al iterar un diseño): se apaga la capa
       inyectada un momento —un <style> se puede desactivar— para ver la misma
       pantalla sin ella. Cuando la capa vive dentro del CRM no se puede apagar
       sola, así que no se saca. */
    if (css) {
      await evaluar(cdp, `(function () {
        document.getElementById('clay-preview').disabled = true;
        document.documentElement.setAttribute('data-theme', 'light');
        return 1;
      })()`);
      await dormir(450);
      await captura(cdp, 'calendario-antes-light.png');
      await evaluar(cdp, `(function () { document.documentElement.setAttribute('data-theme', 'dark'); return 1; })()`);
      await dormir(400);
      await captura(cdp, 'calendario-antes-dark.png');
      await evaluar(cdp, `(function () {
        document.getElementById('clay-preview').disabled = false;
        return 1;
      })()`);
      await dormir(350);
    }

    console.log('\nCapturas del calendario (1512 x 950):');
    for (const tema of TEMAS) {
      await evaluar(cdp, `(function () { document.documentElement.setAttribute('data-theme', '${tema}'); return 1; })()`);
      await dormir(430);
      await captura(cdp, 'calendario-' + tema + '.png');
    }

    // La vista del día: al tocar un día cargado se abre la lista de ese día.
    await evaluar(cdp, `(function () {
      document.documentElement.setAttribute('data-theme', 'dark');
      cerrarModal();
      mostrarOpcionesDia('${infoCal.hoy}');
      return 1;
    })()`);
    await dormir(600);
    await captura(cdp, 'calendario-dia-dark.png');
    await evaluar(cdp, `(function () { cerrarModal(); return 1; })()`);

    // El teléfono: se carga la página ya con ancho de teléfono.
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);
    await evaluar(cdp, inyectarArcilla);
    const calMovil = await evaluar(cdp, expresionMontarCalendario());
    if (String(calMovil).indexOf('error:') === 0) throw new Error('No se pudo montar el calendario en el teléfono: ' + calMovil);
    const infoCalMovil = JSON.parse(calMovil);
    console.log('   teléfono: ' + calMovil);
    await dormir(500);
    await captura(cdp, 'calendario-movil.png');
    await evaluar(cdp, `(function () { mostrarOpcionesDia('${infoCalMovil.hoy}'); return 1; })()`);
    await dormir(600);
    await captura(cdp, 'calendario-dia-movil.png');
    await evaluar(cdp, `(function () { cerrarModal(); return 1; })()`);

    // ── La copia estática para que Jorge la abra y cambie de tema ──
    //    Se recarga en ancho de PC y se vuelve a montar, para que el DOM que se
    //    guarda sea el de la maqueta de escritorio, con el panel lateral abierto.
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);
    await evaluar(cdp, `(function () {
      var s = document.createElement('style');
      s.id = 'clay-preview';
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
      document.documentElement.setAttribute('data-theme', 'dark');
      return 1;
    })()`);
    const pc = await evaluar(cdp, expresionMontar());
    if (String(pc).indexOf('error:') === 0) throw new Error('No se pudo montar la copia estática: ' + pc);
    await dormir(500);

    const html = await serializarVista(cdp, 'Contratos + panel lateral · el CRM real no está modificado');
    fs.writeFileSync(path.join(SALIDA, 'preview-contratos.html'), html, 'utf8');
    console.log('\nArchivo para abrir: preview\\preview-contratos.html (' +
      Math.round(fs.statSync(path.join(SALIDA, 'preview-contratos.html')).size / 1024) + ' KB, sin scripts del CRM y sin Firebase)');

    console.log('\nComprobación de las copias entregadas:');
    await comprobarCopia(cdp, 'preview-contratos.html', '#lista-contratos .mosaico-card');

    /* La copia del CALENDARIO: se recarga en ancho de PC y se monta el
       calendario, porque la copia guarda el DOM tal como está en ese momento. */
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1512, height: 950, deviceScaleFactor: 2, mobile: false });
    await cdp.enviar('Page.navigate', { url: URL });
    await dormir(4500);
    await evaluar(cdp, inyectarArcilla);
    const calPc = await evaluar(cdp, expresionMontarCalendario());
    if (String(calPc).indexOf('error:') === 0) throw new Error('No se pudo montar el calendario para la copia: ' + calPc);
    await dormir(500);
    const htmlCal = await serializarVista(cdp, 'Calendario · el CRM real no está modificado');
    fs.writeFileSync(path.join(SALIDA, 'preview-calendario.html'), htmlCal, 'utf8');
    console.log('\nArchivo para abrir: preview\\preview-calendario.html (' +
      Math.round(fs.statSync(path.join(SALIDA, 'preview-calendario.html')).size / 1024) + ' KB, sin scripts del CRM y sin Firebase)');
    await comprobarCopia(cdp, 'preview-calendario.html', '#calendario-grid .dia');

    /* La copia del CRM con la capa puesta y SIN el SDK de Firebase: es la que se
       le pasa al arnés del calendario (pruebas\medir-calendario-movil.mjs) para
       comprobar que la arcilla no rompe la rejilla que ya estaba medida. */
    escribirIndexParaArnes(css);

    const errores = cdp.sucesos.filter(s => s.method === 'Runtime.exceptionThrown')
      .map(s => s.params.exceptionDetails.exception?.description || s.params.exceptionDetails.text);
    if (errores.length) { console.log('\nErrores en la página (' + errores.length + '):'); errores.slice(0, 5).forEach(e => console.log('  · ' + String(e).split('\n')[0])); }
    console.log('\nLISTO');
  } finally {
    chrome.kill();
  }
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
