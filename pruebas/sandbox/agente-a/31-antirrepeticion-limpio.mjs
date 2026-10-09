/* 31-antirrepeticion-limpio.mjs — SEGUNDA PASADA: la antirrepetición del contrato y del pago
   rápido medidas en una caja RECIÉN ABIERTA (sin estado de pruebas anteriores).
   Ejecutar: node pruebas\sandbox\agente-a\31-antirrepeticion-limpio.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Antirrepeticion limpio' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'V-01', nombre: 'CONTRATO: error de captura del código (sin cliente) y luego corregido, en caja limpia', dato: 'contrato-cliente-id="" → dispatch → «Selecciona un cliente» → poner cliente → dispatch',
  esperado: 'el segundo intento debe guardar', gravedad: 'ALTA', espera: 1400,
  js: `var n0 = obtenerContratos().length;
       __R.limpiar();
       mostrarFormularioContrato(null);
       await new Promise(function(x){ setTimeout(x, 250); });
       // No se usa "mostrarFormularioContrato(cliente)" sino el camino del modal nuevo:
       __R.pon('contrato-cliente-id', '');
       __R.pon('contrato-festejado', 'REDTEAM v01');
       __R.pon('contrato-fecha-evento', '2033-05-05');
       __R.limpiarNotis();
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var avisos1 = __R.textoNotis();
       // El practicante elige el cliente y vuelve a guardar
       __R.pon('contrato-cliente-id', '${cli}');
       __R.limpiarNotis();
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var creados = obtenerContratos().length - n0;
       return { veredicto: creados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er intento dijo: ' + JSON.stringify(avisos1) + ' · tras corregir el cliente: contratos creados=' + creados +
                         ' · avisos del 2º intento=' + JSON.stringify(__R.textoNotis()) + ' · (si no hay aviso ni contrato, el formulario quedó muerto en silencio)' };`
});

await A({
  id: 'V-02', nombre: 'PAGO RÁPIDO: monto inválido y luego bueno, en caja limpia', dato: 'monto 0 → dispatch → aviso → monto 1500 → dispatch',
  esperado: 'el segundo intento debe registrar', gravedad: 'ALTA', espera: 1400,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM v02', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-06-06', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM v02'; })[0];
       var n0 = (co.pagos || []).length;
       __R.limpiarNotis();
       __R.pagoRapido('${cli}', co.id, 0, 'cero', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var avisos1 = __R.textoNotis();
       __R.pon('pago-rapido-monto', 1500);
       __R.limpiarNotis();
       __R.enviar('form-pago-rapido', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 650); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var registrados = (co2.pagos || []).length - n0;
       return { veredicto: registrados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er intento dijo: ' + JSON.stringify(avisos1) + ' · tras poner 1500: pagos registrados=' + registrados + ' · avisos del 2º=' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'V-03', nombre: 'Ids duplicados en el DOM por formularios cerrados que no se limpian', dato: 'abrir, guardar y cerrar el formulario de prospecto tres veces',
  esperado: 'un solo nodo por id', gravedad: 'MEDIA', espera: 1600,
  js: `var cuentas = [];
       for (var i = 0; i < 3; i++) {
         __R.prospecto({ nombre: 'REDTEAM v03 ' + i, telefono: '555003000' + i, email: '', fase: 'Interesado' });
         await new Promise(function(x){ setTimeout(x, 450); });
         cuentas.push({
           vuelta: i + 1,
           forms: document.querySelectorAll('[id="form-prospecto"]').length,
           nombres: document.querySelectorAll('[id="prospecto-nombre"]').length,
           enModalBody: document.querySelectorAll('#modal-body [id="form-prospecto"]').length,
           enAparcadero: document.querySelectorAll('#modal-aparcadero [id="form-prospecto"]').length
         });
       }
       var creados = prospectos.filter(function(p){ return String(p.nombre).indexOf('REDTEAM v03') === 0; }).length;
       return { veredicto: cuentas.every(function(c){ return c.forms === 1; }) ? 'CANDADO OK' : 'HUECO',
                detalle: 'nodos por vuelta: ' + JSON.stringify(cuentas) + ' · prospectos creados=' + creados + ' (deben ser 3, uno por vuelta)' };`
});

await A({
  id: 'V-04', nombre: 'Doble envío en el mismo tick en el contrato (gemelo), en caja limpia', dato: 'contrato gemelo + segundo dispatch inmediato',
  esperado: 'un solo contrato', gravedad: 'ALTA', espera: 2200,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM v04', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-07-07', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var n0 = __R.contratosConFestejado('REDTEAM v04').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM v04', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-07-07', estado: 'Pendiente' });
       __R.reenviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 800); });
       var avisos = __R.hayConfirmacion();
       if (avisos) { __R.confirmarFinanciero(); await new Promise(function(x){ setTimeout(x, 800); }); }
       var n1 = __R.contratosConFestejado('REDTEAM v04').length;
       return { veredicto: (n1 === n0 + 1) ? 'CANDADO OK' : 'DUPLICA',
                detalle: 'contratos ' + n0 + ' → ' + n1 + ' (debe subir 1) · aviso de gemelo=' + avisos + ' · errores JS=' + JSON.stringify(window.__A.errores) };`
});

const res = await guardar(caja, '31-antirrepeticion-limpio');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
