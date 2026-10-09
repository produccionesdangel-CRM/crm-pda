/* 26-originales-corregidos.mjs — SEGUNDA PASADA: las MISMAS 12 comprobaciones que salieron
   mal en la corrida de las familias originales contra el sello .25, pero con la aserción
   CORREGIDA (el artefacto era de mis pruebas, no del CRM).
   Ejecutar: node pruebas\sandbox\agente-a\26-originales-corregidos.mjs
   Criterio: aquí un CANDADO OK significa "el CRM hizo lo correcto y mi prueba anterior medía mal". */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Originales corregidos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

/* ── F-12 / A-01..A-04 / A-11: el artefacto era leer App.almacen.campania() de una
      campaña RECHAZADA (que ya no está en la base). La aserción correcta es mirar la base. ── */

await A({
  id: 'X-01', nombre: '[F-12 original] Campaña con fechas invertidas: se rechaza y NO queda en la base', dato: 'fechaInicio=2027-12-31, fechaFin=2027-01-01',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = campanias.length;
       var c = App.motor.crearCampania({ nombre: 'REDTEAM fechas invertidas 2', tipo: 'captacion', fechaInicio: '2027-12-31', fechaFin: '2027-01-01' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       var enAlmacen = !!App.almacen.campania(c.id);
       return { veredicto: (!enBase && !enAlmacen) ? 'CANDADO OK' : 'HUECO',
                detalle: 'en la base=' + enBase + ' · en el almacén=' + enAlmacen + ' · ok=' + c.ok + ' guardada=' + c.guardada + ' · errores=' + JSON.stringify(c.errores || []) + ' · campanias ' + n0 + ' → ' + campanias.length };`
});

await A({
  id: 'X-02', nombre: '[A-01 original] Campaña sin nombre: se rechaza (ya no se renombra en silencio)', dato: 'nombre = ""',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = campanias.length;
       var c = App.motor.crearCampania({ nombre: '', tipo: 'captacion', fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: !enBase ? 'CANDADO OK' : 'HUECO',
                detalle: 'en la base=' + enBase + ' · la campaña rechazada trae nombre=' + JSON.stringify(c.nombre) + ' · errores=' + JSON.stringify(c.errores || []) + ' · campanias ' + n0 + ' → ' + campanias.length };`
});

await A({
  id: 'X-03', nombre: '[A-02 original] Campaña sin etapa inicial: se rechaza', dato: 'etapas sin esInicial',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var etapas = [{ nombre: 'Uno', orden: 1, esInicial: false, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: 'Dos', orden: 2, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM sin inicial 2', tipo: 'captacion', etapas: etapas, fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: !enBase ? 'CANDADO OK' : 'HUECO',
                detalle: 'en la base=' + enBase + ' · errores=' + JSON.stringify(c.errores || []) + ' · la intención rechazada trae etapas=' + JSON.stringify((c.etapas || []).length) };`
});

await A({
  id: 'X-04', nombre: '[A-03 original] Campaña con DOS etapas iniciales: se rechaza', dato: 'dos esInicial:true',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var etapas = [{ nombre: 'A', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: 'B', orden: 2, esInicial: true, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM dos iniciales 2', tipo: 'captacion', etapas: etapas, fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: !enBase ? 'CANDADO OK' : 'HUECO', detalle: 'en la base=' + enBase + ' · errores=' + JSON.stringify(c.errores || []) };`
});

await A({
  id: 'X-05', nombre: '[A-04 original] Campaña con metas negativas y con texto: se rechaza', dato: 'metas = { prospectos: -50, conversiones: "muchas" }',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM metas negativas 2', tipo: 'captacion', fechaInicio: '2029-01-01', fechaFin: '2029-12-31', metas: { prospectos: -50, conversiones: 'muchas' } });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: !enBase ? 'CANDADO OK' : 'HUECO', detalle: 'en la base=' + enBase + ' · errores=' + JSON.stringify(c.errores || []) + ' · metas de la intención rechazada=' + JSON.stringify(c.metas) };`
});

await A({
  id: 'X-06', nombre: '[A-11 original] Campaña con etapas sin nombre y órdenes repetidos: se rechaza', dato: 'etapas sin nombre, orden 1 repetido',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var etapas = [{ nombre: '', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: '   ', orden: 1, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM etapas vacias 2', tipo: 'captacion', etapas: etapas, fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: !enBase ? 'CANDADO OK' : 'HUECO', detalle: 'en la base=' + enBase + ' · errores=' + JSON.stringify(c.errores || []) };`
});

/* ── T-05 / T-08: mi prueba los marcaba como hueco, pero son formatos LEGÍTIMOS
      (un prospecto puede no tener teléfono; los guiones son la misma persona escribiendo).
      Aquí se comprueba que se guardan y que el teléfono sirve para marcar. ── */

await A({
  id: 'X-07', nombre: '[T-05 original] Teléfono de solo espacios: debe quedar como «sin teléfono», no como basura', dato: 'prospecto-telefono = "   "',
  esperado: 'guardar el prospecto SIN teléfono', gravedad: 'BAJA',
  js: `__R.prospecto({ nombre: 'REDTEAM solo espacios 2', telefono: '   ', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM solo espacios 2'; })[0];
       return { veredicto: (p && p.telefono === '') ? 'CANDADO OK' : 'HUECO',
                detalle: 'guardado=' + !!p + ' · teléfono=' + JSON.stringify(p ? p.telefono : null) + ' · WhatsApp=' + JSON.stringify(p ? normalizarTelefonoWhatsApp(p.telefono) : null) };`
});

await A({
  id: 'X-08', nombre: '[T-08 original] Teléfono con guiones: formato legítimo que debe conservarse', dato: 'prospecto-telefono = "878-123-4567"',
  esperado: 'guardar y poder marcar', gravedad: 'BAJA',
  js: `__R.prospecto({ nombre: 'REDTEAM guiones 2', telefono: '878-123-4567', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM guiones 2'; })[0];
       return { veredicto: (p && p.telefono === '878-123-4567' && !!normalizarTelefonoWhatsApp(p.telefono)) ? 'CANDADO OK' : 'HUECO',
                detalle: 'guardado=' + !!p + ' · teléfono=' + JSON.stringify(p ? p.telefono : null) + ' · para marcar=' + JSON.stringify(p ? normalizarTelefonoWhatsApp(p.telefono) : null) };`
});

/* ── T-12 / T-13 / T-14: el artefacto era que el formulario ya no crea el cliente con
      teléfono basura, así que mi prueba leía `c.id` de undefined. La aserción correcta es
      usar un cliente de DATOS VIEJOS (que sí existen en la base de Jorge). ── */

for (const [id, etiqueta, valor] of [
  ['X-09', 'un dígito ("1")', '1'],
  ['X-10', 'emoji', '\uD83D\uDCDE\uD83D\uDCDE'],
  ['X-11', 'repetido ("1111111111")', '1111111111']
]) {
  await A({
    id, nombre: '[T-12..T-14 original] WhatsApp con teléfono basura ' + etiqueta + ' de un dato VIEJO', dato: 'cliente legado telefono=' + JSON.stringify(valor),
    esperado: 'no abrir WhatsApp y avisar', gravedad: 'ALTA', espera: 600,
    js: `var c = __R.legacyCliente({ nombre: 'Legado corregido ${id}', telefono: ${JSON.stringify(valor)} });
         var url = __R.waUrl(c.id);
         await new Promise(function(x){ setTimeout(x, 250); });
         return { veredicto: url ? 'HUECO' : 'CANDADO OK', detalle: 'URL=' + JSON.stringify(url) + ' · avisos=' + JSON.stringify(__R.textoNotis()) };`
  });
}

/* ── G-12: el artefacto era usar el formulario YA CERRADO. La aserción correcta es abrir
      la EDICIÓN de un contrato existente y agregar el pago ahí dentro. ── */

await A({
  id: 'X-12', nombre: '[G-12 original] Pago dentro de la EDICIÓN del contrato, cerrando sin «Guardar Contrato»', dato: 'pago de $2,000 en el formulario de edición y cerrar',
  esperado: 'el pago queda guardado (ya no miente la app)', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM g12 corregido', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2030-11-11', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM g12 corregido'; })[0];
       __R.editarContrato('${cli}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.limpiarNotis();
       __R.pagoEnFormulario(2000);
       await new Promise(function(x){ setTimeout(x, 450); });
       var dijo = JSON.stringify(__R.textoNotis());
       if (__R.hayConfirmacion()) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
       cerrarModal();
       await new Promise(function(x){ setTimeout(x, 400); });
       await __R.recargarDeAlmacen();
       await new Promise(function(x){ setTimeout(x, 450); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var t = calcularTotalesContrato(co2);
       return { veredicto: t.totalPagos === 2000 ? 'CANDADO OK' : 'HUECO',
                detalle: 'la app dijo: ' + dijo + ' · totalPagos en disco=$' + t.totalPagos + ' (esperado 2000)' };`
});

const res = await guardar(caja, '26-originales-corregidos');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
