/* 29-antirrepeticion-contrato.mjs — SEGUNDA PASADA: aislar la antirrepetición del contrato
   del "candado nativo" del navegador (required/type), y contar los eventos submit reales.
   Ejecutar: node pruebas\sandbox\agente-a\29-antirrepeticion-contrato.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Antirrepeticion contrato' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'W-00', nombre: 'Base: contrato para las pruebas de antirrepetición + contador de envíos', dato: 'contrato «REDTEAM w00» de $25,000',
  esperado: 'base lista', gravedad: 'BAJA', espera: 900,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM w00', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-01-01', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       window.__conteoSubmit = 0;
       window.__contarSubmit = function () {
         var f = document.getElementById('form-contrato');
         if (f && !f.dataset.contado) { f.dataset.contado = '1'; f.addEventListener('submit', function(){ window.__conteoSubmit++; }); }
         var g = document.getElementById('form-pago-rapido');
         if (g && !g.dataset.contado) { g.dataset.contado = '1'; g.addEventListener('submit', function(){ window.__conteoSubmit++; }); }
       };
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM w00'; })[0];
       window.__coId = co.id;
       return { veredicto: co ? 'CANDADO OK' : 'ROTO', detalle: 'contratoId=' + co.id };`
});
const coId = await caja.s.evaluar('window.__coId');

/* ¿El navegador bloquea el envío real cuando un campo required está vacío? */
await A({
  id: 'W-01', nombre: 'Clic real con un campo required VACÍO: ¿lo frena el navegador antes de llegar al código?', dato: 'festejado vacío + clic real en «Guardar Contrato»',
  esperado: 'documentar quién frena', gravedad: 'MEDIA', espera: 1000,
  js: `__R.editarContrato('${cli}', '${coId}', {});
       await new Promise(function(x){ setTimeout(x, 300); });
       window.__contarSubmit();
       window.__conteoSubmit = 0;
       __R.limpiarNotis();
       __R.pon('contrato-festejado', '');
       var validez = null;
       try { validez = document.getElementById('form-contrato').checkValidity(); } catch (e) { validez = 'error: ' + e.message; }
       var r = __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 500); });
       return { veredicto: 'CANDADO OK',
                detalle: 'el formulario es válido según el navegador=' + validez + ' · eventos submit que llegaron=' + window.__conteoSubmit +
                         ' · avisos de la app=' + JSON.stringify(__R.textoNotis()) + ' · modal abierto=' + __R.estadoModal().abierto +
                         ' · (si el navegador frena, el candado nuevo del código ni se entera)' };`
});

/* El mismo escenario pero forzando el submit (pegado/autocompletado): aquí SÍ corre el código. */
await A({
  id: 'W-02', nombre: 'Envío forzado con un campo required vacío + corrección en el MISMO formulario', dato: 'festejado vacío (dispatchEvent) → aviso → festejado bueno → envío forzado',
  esperado: 'el segundo intento debe guardar', gravedad: 'ALTA', espera: 1400,
  js: `__R.editarContrato('${cli}', '${coId}', {});
       await new Promise(function(x){ setTimeout(x, 300); });
       window.__contarSubmit();
       window.__conteoSubmit = 0;
       __R.limpiarNotis();
       __R.pon('contrato-festejado', '');
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var avisos1 = __R.textoNotis();
       var submits1 = window.__conteoSubmit;
       __R.pon('contrato-festejado', 'REDTEAM w02 EDITADO');
       __R.limpiarNotis();
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var viva = c.contratos.filter(function(x){ return x.id === '${coId}'; })[0];
       return { veredicto: (viva.festejado === 'REDTEAM w02 EDITADO') ? 'CANDADO OK' : 'HUECO',
                detalle: '1er envío: llegó al código (submits=' + submits1 + ') y dijo ' + JSON.stringify(avisos1) +
                         ' · 2º envío (ya corregido): festejado quedó=' + JSON.stringify(viva.festejado) + ' · avisos del 2º=' + JSON.stringify(__R.textoNotis()) };`
});

/* El aviso de contrato gemelo: cancelar y volver a intentar (con envío forzado). */
await A({
  id: 'W-03', nombre: 'Aviso de contrato GEMELO: cancelar y reintentar (envío forzado)', dato: 'segundo contrato idéntico → Cancelar → Guardar otra vez',
  esperado: 'el segundo intento debe volver a avisar o guardar', gravedad: 'ALTA', espera: 2000,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM w03', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-03-03', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM w03', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2033-03-03', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var aviso1 = __R.hayConfirmacion();
       if (aviso1) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 400); });
       var formVivo = !!document.getElementById('form-contrato');
       __R.limpiarNotis();
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var aviso2 = __R.hayConfirmacion();
       var notis2 = __R.textoNotis();
       if (aviso2) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var n = __R.contratosConFestejado('REDTEAM w03').length;
       return { veredicto: aviso2 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er aviso=' + aviso1 + ' → Cancelar · formulario vivo=' + formVivo + ' · 2º intento: aviso=' + aviso2 + ' avisos=' + JSON.stringify(notis2) + ' · contratos=' + n };`
});

/* Pago rápido: envío forzado inválido y luego bueno (ya confirmado en A-06/Y-16; aquí con contador). */
await A({
  id: 'W-04', nombre: 'Pago rápido: envío forzado con monto 0 y luego monto bueno, con contador de envíos', dato: 'monto 0 (dispatchEvent) → monto 1500 (envío forzado)',
  esperado: 'el segundo intento debe registrar', gravedad: 'ALTA', espera: 1600,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.id === '${coId}'; })[0];
       var n0 = (co.pagos || []).length;
       window.__conteoSubmit = 0;
       __R.pagoRapido('${cli}', '${coId}', 0, 'cero', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 350); });
       window.__contarSubmit();
       var submits1 = window.__conteoSubmit;
       var avisos1 = __R.textoNotis();
       __R.pon('pago-rapido-monto', 1500);
       __R.limpiarNotis();
       __R.pulsaGuardar('form-pago-rapido');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === '${coId}'; })[0];
       var registrados = (co2.pagos || []).length - n0;
       return { veredicto: registrados > 0 ? 'CANDADO OK' : 'HUECO',
                detalle: '1er envío forzado: avisos=' + JSON.stringify(avisos1) + ' · luego se puso 1500 y se pulsó Registrar (clic real): pagos registrados=' + registrados +
                         ' · avisos del 2º=' + JSON.stringify(__R.textoNotis()) + ' · (el 2º envío real se pierde en silencio por la marca del formulario)' };`
});

const res = await guardar(caja, '29-antirrepeticion-contrato');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
