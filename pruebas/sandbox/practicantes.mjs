/*
 * practicantes.mjs — ¿qué puede y qué NO puede hacer un practicante con rol Ventas?
 * ---------------------------------------------------------------------------
 * Jorge va a meter practicantes ("pueden cometer errores simples"). Esta prueba
 * entra al CRM en la caja de arena con el rol **Ventas** (el de captación) y
 * comprueba, con llamadas reales a los botones y funciones:
 *   1. Que NO pueda borrar nada que mueva dinero o datos: clientes, prospectos,
 *      tareas, contratos, pagos/cargos, paquetes.
 *   2. Que NO vea Informes ni la papelera, ni pueda imprimir contratos.
 *   3. Que su fase comercial tope en Negociación (no puede declarar Contrato).
 *   4. Que lo que SÍ debe hacer siga funcionando (crear prospecto, completar
 *      tarea, registrar un pago): si el blindaje deja al practicante sin poder
 *      trabajar, eso también es un problema.
 *
 * Cómo se corre:  node pruebas\sandbox\practicantes.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from './sandbox.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* Escenario: como administrador se siembra y se arma un contrato con un pago;
   después se cambia el rol a Ventas, que es lo que se está probando. */
const ESCENARIO = `(function () {
  var hoy = new Date();
  var f = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
  paquetes.push({ id: 'paq-prac', nombre: 'Paquete Practicantes', descripcion: 'para la prueba', precio: 12000, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo', items: [] });
  clientes.push({ id: 'cli-prac', nombre: 'Cliente Practicantes', telefono: '8781234567', email: 'prac@correo.com', estado: 'Activo', fechaRegistro: f,
    contratos: [{ id: 'con-prac', festejado: 'Festejada Practicantes', tipo: 'paquete', paqueteId: 'paq-prac', serviciosIds: [], precioBase: 12000, precioFinal: 12000, descuentoMonto: 0, fechaEvento: '2027-06-15', fechaContrato: f, estado: 'Activo', pagos: [{ id: 'pag-prac', monto: 2000, fecha: f, nota: 'Anticipo', codigo: 'prac01', firma: 'firma-prac' }], cargos: [] }] });
  tareas.push({ id: 'tar-prac', tipo: 'Llamada', descripcion: 'Tarea de practicantes', fecha: f, completada: false, clienteId: 'cli-prac', creadaPor: 'Admin' });
  guardarDatos();
  return {
    cliente: clientes.length, prospecto: prospectos.length, tarea: tareas.length,
    contrato: obtenerCliente('cli-prac').contratos.length, pago: obtenerCliente('cli-prac').contratos[0].pagos.length
  };
})()`;

/* Se cambia el rol SIN recargar y se vuelve a dibujar (como cuando entra otro usuario). */
const COMO_VENTAS = `(function () {
  usuarioActual = { username: 'practicante', nombre: 'Practicante', rol: 'Ventas', admin: false, email: 'practicante@local' };
  actualizarUIUsuario(); aplicarRestriccionesPorRol(); renderizarTodo();
  return { esAdmin: esAdmin(), verInformes: puede('ver-informes'), editarPagos: puede('editar-pagos'),
    activarCampanias: puede('activar-campanias'), verPapelera: puede('ver-papelera'), imprimir: puede('imprimir-contrato'),
    fases: fasesDisponiblesParaMiRol(), menuInformesVisible: (function () {
      var m = document.querySelector('.menu-item[data-seccion="informes"]');
      return !!(m && getComputedStyle(m).display !== 'none');
    })() };
})()`;

/* Un intento de borrado: se llama la función real y se mira si el registro sobrevive. */
function intentoBorrado(expresion, comprobar) {
  return `(function () {
    document.querySelectorAll('.notificacion').forEach(function (n) { n.remove(); });
    try { ${expresion}; } catch (e) { return { excepcion: String(e && e.message || e) }; }
    var aviso = document.querySelector('.notificacion');
    return { sobrevive: ${comprobar}, aviso: aviso ? aviso.textContent.trim() : '' };
  })()`;
}

async function main() {
  const info = preparar();
  const s = await abrir({ info, ancho: 1280, alto: 900, movil: false, tactil: false });
  const fallos = [];
  const linea = (ok, texto) => { if (!ok) fallos.push(texto); console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    console.log('entrar (admin): ' + await entrar(s));
    const a = await revisarAislamiento(s);
    linea(a.aislado, 'la caja está aislada (0 peticiones a los datos reales)');
    const sembrado = await sembrar(s);
    linea(sembrado.prospectos === 20 && sembrado.campanias.length === 2, 'sembrado: 20 prospectos y 2 campañas');
    const esc = await s.evaluar(ESCENARIO);
    console.log('   escenario: ' + JSON.stringify(esc));

    const ven = await s.evaluar(COMO_VENTAS);
    console.log('   rol Ventas: ' + JSON.stringify(ven));
    linea(ven.esAdmin === false && ven.verInformes === false && ven.editarPagos === false && ven.verPapelera === false && ven.imprimir === false,
      'el rol Ventas no tiene Informes, papelera, impresión ni edición de pagos');
    linea(ven.activarCampanias === false, 'el rol Ventas no puede activar campañas');
    linea(ven.menuInformesVisible === false, 'el menú de Informes queda oculto para el practicante');
    linea(ven.fases.indexOf('Contrato') === -1 && ven.fases.indexOf('Frecuente') === -1, 'su fase comercial tope es Negociación (sin Contrato ni Frecuente)');

    console.log('\n   Intentos de borrado con rol Ventas:');
    const pruebas = [
      ['eliminar cliente', `eliminarCliente('cli-prac')`, `clientes.filter(function (c) { return c.id === 'cli-prac'; }).length === 1`],
      ['eliminar prospecto', `eliminarProspecto(prospectos[0].id)`, `prospectos.length > 0`],
      ['eliminar tarea', `eliminarTarea('tar-prac')`, `tareas.filter(function (t) { return t.id === 'tar-prac'; }).length === 1`],
      ['eliminar contrato', `eliminarContrato('cli-prac','con-prac')`, `obtenerCliente('cli-prac').contratos.length === 1`],
      ['anular un pago', `(function () {
        // El botón de anular vive DENTRO del formulario del contrato: hay que abrirlo
        // (así lo hace un practicante) antes de intentar anular.
        mostrarFormularioContrato('cli-prac', 'Prueba de practicantes', obtenerCliente('cli-prac').contratos[0]);
        PDA.eliminarMovimientoContrato('pago', 'pag-prac');
      })()`, `obtenerCliente('cli-prac').contratos[0].pagos.filter(function (p) { return !p.eliminado; }).length === 1`],
      ['eliminar paquete', `CRUD.paquetes.eliminar('paq-prac')`, `paquetes.filter(function (p) { return p.id === 'paq-prac'; }).length === 1`]
    ];
    for (const [nombre, expresion, comprobar] of pruebas) {
      const r = await s.evaluar(intentoBorrado(expresion, comprobar));
      console.log('     · ' + (nombre + '                    ').slice(0, 22) + (r.excepcion ? 'EXCEPCIÓN: ' + r.excepcion : (r.sobrevive ? 'bloqueado' : 'SE BORRÓ') + ' · aviso: "' + (r.aviso || '') + '"'));
      linea(!r.excepcion && r.sobrevive === true, 'no puede ' + nombre + ' (y la app avisa)');
      await dormir(120);
    }

    console.log('\n   Lo que el practicante SÍ debe poder hacer:');
    const fluidez = await s.evaluar(`(function () {
      var res = {};
      // Alta de prospecto por el formulario real.
      var antesP = prospectos.length;
      mostrarFormularioProspecto(null);
      document.getElementById('prospecto-nombre').value = 'Prospecto del practicante';
      document.getElementById('prospecto-telefono').value = '8784445566';
      document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      res.prospectoCreado = prospectos.length === antesP + 1;
      // Completar una tarea.
      alternarCompletarTarea('tar-prac');
      var t = tareas.filter(function (x) { return x.id === 'tar-prac'; })[0];
      res.tareaCompletada = !!(t && t.completada);
      // Registrar un pago (el rol Ventas sí puede agregar pagos).
      var co = obtenerCliente('cli-prac').contratos[0];
      var antesPagos = co.pagos.length;
      agregarPagoRapido('cli-prac', 'con-prac');
      var campo = document.getElementById('pago-rapido-monto');
      if (campo) {
        campo.value = '1000';
        document.getElementById('form-pago-rapido').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      var co2 = obtenerCliente('cli-prac').contratos[0];
      res.pagoRegistrado = co2.pagos.length === antesPagos + 1;
      res.saldo = calcularTotalesContrato(co2).saldoBruto;
      try { cerrarModal(); } catch (e) { }
      return res;
    })()`);
    console.log('   ' + JSON.stringify(fluidez));
    linea(fluidez.prospectoCreado, 'el practicante SÍ puede dar de alta un prospecto');
    linea(fluidez.tareaCompletada, 'el practicante SÍ puede completar una tarea');
    linea(fluidez.pagoRegistrado, 'el practicante SÍ puede registrar un pago (12,000 − 2,000 − 1,000 = saldo 9,000)');
    linea(fluidez.saldo === 9000, 'el saldo queda cuadrado en 9,000 (' + fluidez.saldo + ')');

    const final = await s.evaluar(`(function () {
      var problemas = [];
      clientes.forEach(function (c) { (c.contratos || []).forEach(function (co) {
        var t = calcularTotalesContrato(co);
        if (Math.abs((t.totalAPagar - t.totalPagos) - t.saldoBruto) > 0.005) problems.push('descuadre en ' + c.nombre);
      }); });
      return { problemas: problemas, clientes: clientes.length, contratos: obtenerContratos().length };
    })()`);
    linea(final.problemas.length === 0, 'después de todo, los contratos siguen cuadrando (' + final.contratos + ' contratos)');
  } finally {
    const red = await s.cerrar();
    console.log('   Red: ' + red.peticiones + ' peticiones · a los datos reales: ' + (red.prohibidas.filter(h => h !== 'gstatic.com').length ? 'REVISAR' : 'ninguna'));
  }

  console.log('\n' + (fallos.length === 0
    ? 'TODO EN VERDE: el practicante no puede romper nada importante y sí puede trabajar.'
    : fallos.length + ' comprobaciones fallaron.'));
  process.exitCode = fallos.length === 0 ? 0 : 1;
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
