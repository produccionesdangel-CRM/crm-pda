/* 23-evasiones-fechas-campanias.mjs — SEGUNDA PASADA: fechas límite y campañas.
   Ejecutar: node pruebas\sandbox\agente-a\23-evasiones-fechas-campanias.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Evasion fechas y campanias' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

/* ── FECHAS LÍMITE EN TAREAS ── */
const FECHAS = [
  ['F-01', '2027-02-28', true, 'fin de febrero normal'],
  ['F-02', '2028-02-29', true, '29 de febrero bisiesto'],
  ['F-03', '2027-02-29', false, '29 de febrero NO bisiesto'],
  ['F-04', '2100-12-31', true, 'año tope del candado (2100)'],
  ['F-05', '2101-01-01', false, 'año tope + 1 (2101)'],
  ['F-06', '1999-12-31', false, 'año por debajo del mínimo'],
  ['F-07', '2000-01-01', true, 'año mínimo exacto']
];

for (const [id, fecha, debeEntrar, etiqueta] of FECHAS) {
  await A({
    id, nombre: 'Tarea con fecha ' + fecha + ' (' + etiqueta + ')', dato: 'tarea-fecha = ' + fecha,
    esperado: debeEntrar ? 'guardar' : 'rechazar con mensaje', gravedad: 'MEDIA', espera: 700,
    js: `var marca = 'REDTEAM fecha ${id}';
         var n0 = tareas.length;
         __R.limpiarNotis();
         __R.tarea({ tipo: 'Visita', fecha: '${fecha}', descripcion: marca, clienteId: '${cli}' });
         await new Promise(function(x){ setTimeout(x, 400); });
         var t = tareas.filter(function(x){ return x.descripcion === marca; })[0];
         return { veredicto: (!!t === ${debeEntrar}) ? 'CANDADO OK' : (${debeEntrar} ? 'EXCESO' : 'HUECO'),
                  detalle: 'entró=' + !!t + ' (se esperaba ' + ${debeEntrar} + ') · tareas ' + n0 + ' → ' + tareas.length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

/* ── FECHAS LÍMITE EN CONTRATOS ── */
for (const [id, fecha, debeEntrar, etiqueta] of [
  ['F-08', '2100-12-31', true, 'año tope del candado'],
  ['F-09', '2101-01-01', false, 'año tope + 1'],
  ['F-10', '2099-02-28', true, 'fecha futura normal']
]) {
  await A({
    id, nombre: 'Contrato con fecha de evento ' + fecha + ' (' + etiqueta + ')', dato: 'contrato-fecha-evento = ' + fecha,
    esperado: debeEntrar ? 'guardar' : 'rechazar', gravedad: 'MEDIA', espera: 900,
    js: `var n0 = obtenerContratos().length;
         __R.limpiarNotis();
         __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM fecha ${id}', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '${fecha}', estado: 'Pendiente' });
         await new Promise(function(x){ setTimeout(x, 500); });
         if (__R.hayConfirmacion()) { __R.cancelarFinanciero(); await new Promise(function(x){ setTimeout(x, 300); }); }
         var entro = obtenerContratos().some(function(c){ return c.festejado === 'REDTEAM fecha ${id}'; });
         return { veredicto: (entro === ${debeEntrar}) ? 'CANDADO OK' : (${debeEntrar} ? 'EXCESO' : 'HUECO'),
                  detalle: 'entró=' + entro + ' (se esperaba ' + ${debeEntrar} + ') · contratos ' + n0 + ' → ' + obtenerContratos().length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

/* ── CAMPAÑAS ── */
await A({
  id: 'F-11', nombre: 'Campaña con etapas vacías (etapas: [])', dato: 'etapas = []',
  esperado: 'rechazar con mensaje', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM etapas vacias', tipo: 'captacion', etapas: [], fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: (!enBase && c.ok === false) ? 'CANDADO OK' : 'HUECO',
                detalle: 'guardada en la base=' + enBase + ' · ok=' + c.ok + ' · guardada=' + c.guardada + ' · errores=' + JSON.stringify(c.errores || []).slice(0, 300) };`
});

await A({
  id: 'F-12', nombre: 'Campaña con metas en CERO (debe permitirse)', dato: 'metas = { prospectos: 0, conversiones: 0 }',
  esperado: 'crear la campaña (0 no es una meta inválida)', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM metas cero', tipo: 'captacion', fechaInicio: '2029-01-01', fechaFin: '2029-12-31', metas: { prospectos: 0, conversiones: 0 } });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: enBase ? 'CANDADO OK' : 'EXCESO',
                detalle: 'creada=' + enBase + ' · ok=' + c.ok + ' · metas=' + JSON.stringify(c.metas) + ' · errores=' + JSON.stringify(c.errores || []) };`
});

await A({
  id: 'F-13', nombre: 'Campaña con metas escritas con TEXTO («muchas»)', dato: 'metas = { prospectos: "muchas" }',
  esperado: 'rechazar o limpiar el dato', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM metas texto', tipo: 'captacion', fechaInicio: '2029-01-01', fechaFin: '2029-12-31', metas: { prospectos: 'muchas' } });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       // ¿Lo aceptaría el otro camino?
       var r2 = App.motor.actualizarCampania(c.id, { metas: { prospectos: 'muchas' } });
       return { veredicto: enBase ? 'HUECO' : 'CANDADO OK',
                detalle: 'creada con meta de texto=' + enBase + ' · metas guardadas=' + JSON.stringify(viva ? viva.metas : null) +
                         ' · por el otro camino (actualizarCampania) la misma meta da ok=' + r2.ok + ' errores=' + JSON.stringify(r2.errores || []) };`
});

await A({
  id: 'F-14', nombre: 'Campaña con un criterio de elegibilidad VÁLIDO pero con el valor vacío', dato: 'criteriosElegibilidad = [{ tipo: <válido>, valor: "" }]',
  esperado: 'rechazar o pedir el valor', gravedad: 'BAJA',
  js: `var tipos = (Catalogos.tiposCriterio || []);
       if (!tipos.length) return { veredicto: 'CANDADO OK', detalle: 'no hay catálogo de criterios en este build' };
       var elegido = tipos.filter(function(t){ return t.tipoValor !== 'rango-edad'; })[0] || tipos[0];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM criterio vacio', tipo: 'captacion', fechaInicio: '2029-01-01', fechaFin: '2029-12-31',
                                         criteriosElegibilidad: [{ id: 'cr1', tipo: elegido.id, valor: '', valor2: '' }] });
       await new Promise(function(x){ setTimeout(x, 300); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       var v = App.motor.validarCampania(App.almacen.campania(c.id) || c, { paraActivar: false });
       return { veredicto: enBase ? 'HUECO' : 'CANDADO OK',
                detalle: 'criterio usado=' + JSON.stringify(elegido.id) + ' (tipoValor=' + JSON.stringify(elegido.tipoValor) + ') · creada=' + enBase +
                         ' · validarCampania errores=' + JSON.stringify(v.errores || []) + ' · (un criterio sin valor no filtra a nadie)' };`
});

await A({
  id: 'F-15', nombre: 'Campaña VÁLIDA de punta a punta (no debe bloquearse)', dato: 'nombre, tipo, objetivo, fechas válidas, etapas por defecto',
  esperado: 'crear la campaña', gravedad: 'ALTA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM campaña valida', tipo: 'captacion', objetivoPrincipal: 'Cerrar 5 eventos',
                                         fechaInicio: '2029-01-01', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       return { veredicto: enBase ? 'CANDADO OK' : 'EXCESO',
                detalle: 'creada=' + enBase + ' · ok=' + c.ok + ' · etapas=' + ((viva && viva.etapas) || []).length + ' · se puede activar=' + v.ok + ' errores=' + JSON.stringify(v.errores || []) };`
});

await A({
  id: 'F-16', nombre: 'Campaña válida con etapas propias válidas (una inicial, una final)', dato: 'etapas = [{A inicial}, {B final}]',
  esperado: 'crear la campaña con ESAS etapas', gravedad: 'MEDIA',
  js: `var etapas = [
         { nombre: 'Entrada', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' },
         { nombre: 'Cerrado', orden: 2, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }
       ];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM etapas propias', tipo: 'captacion', objetivoPrincipal: 'x', fechaInicio: '2029-01-01', fechaFin: '2029-12-31', etapas: etapas });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       return { veredicto: (viva && (viva.etapas || []).length === 2) ? 'CANDADO OK' : 'EXCESO',
                detalle: 'creada=' + !!viva + ' · ok=' + c.ok + ' · etapas guardadas=' + JSON.stringify((viva ? viva.etapas : []).map(function(e){ return e.nombre + (e.id ? '(con id)' : '(SIN id)'); })) + ' · errores=' + JSON.stringify(c.errores || []) };`
});

await A({
  id: 'F-17', nombre: 'Campaña con fecha de fin IGUAL a la de inicio', dato: 'fechaInicio = fechaFin = 2029-06-06',
  esperado: 'permitir (una campaña de un día)', gravedad: 'BAJA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM un dia', tipo: 'captacion', objetivoPrincipal: 'x', fechaInicio: '2029-06-06', fechaFin: '2029-06-06' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: campanias.some(function(x){ return x.id === c.id; }) ? 'CANDADO OK' : 'EXCESO',
                detalle: 'creada=' + campanias.some(function(x){ return x.id === c.id; }) + ' · errores=' + JSON.stringify(c.errores || []) };`
});

await A({
  id: 'F-18', nombre: 'Campaña con fecha de inicio IMPOSIBLE (2029-02-31)', dato: 'fechaInicio = 2029-02-31',
  esperado: 'rechazar', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM fecha imposible', tipo: 'captacion', fechaInicio: '2029-02-31', fechaFin: '2029-12-31' });
       await new Promise(function(x){ setTimeout(x, 250); });
       // ¿Y el asistente? Su validación es la que decide si llega al motor.
       var v = App.motor.validarCampania({ nombre: 'x', tipo: 'captacion', objetivoPrincipal: 'y', fechaInicio: '2029-02-31', fechaFin: '2029-12-31' }, { paraActivar: true });
       return { veredicto: campanias.some(function(x){ return x.id === c.id; }) ? 'HUECO' : 'CANDADO OK',
                detalle: 'creada=' + campanias.some(function(x){ return x.id === c.id; }) + ' · errores del motor=' + JSON.stringify(c.errores || []) +
                         ' · OJO: validarCampania (lo que usa el asistente) dice ok=' + v.ok + ' errores=' + JSON.stringify(v.errores || []) };`
});

await A({
  id: 'F-19', nombre: 'Campaña: el asistente creería creada una campaña que el motor rechaza', dato: 'misma fecha imposible, comparando las dos validaciones',
  esperado: 'las dos puertas deben coincidir', gravedad: 'MEDIA',
  js: `var borrador = { nombre: 'REDTEAM divergencia', tipo: 'captacion', objetivoPrincipal: 'y', fechaInicio: '2029-02-31', fechaFin: '2029-12-31' };
       var vAsistente = App.motor.validarCampania(borrador, { paraActivar: true });
       var c = App.motor.crearCampania(borrador);
       var enBase = campanias.some(function(x){ return x.id === c.id; });
       return { veredicto: (vAsistente.ok === true && enBase === false) ? 'HUECO' : 'CANDADO OK',
                detalle: 'validarCampania (asistente) ok=' + vAsistente.ok + ' errores=' + JSON.stringify(vAsistente.errores || []) +
                         ' · crearCampania ok=' + c.ok + ' guardada=' + c.guardada + ' enBase=' + enBase +
                         ' · (el asistente hace asi.campaniaId = nueva.id y avisa "Campaña creada en borrador" sin mirar guardada: index.html ~13027)' };`
});

/* ── Participaciones y ofertas ── */
await A({
  id: 'F-20', nombre: 'Participación con fechaRegistro imposible y valorPotencial negativo', dato: 'fechaRegistro=2029-02-31, valorPotencial=-3000',
  esperado: 'corregir a hoy y a 0', gravedad: 'MEDIA', espera: 700,
  js: `var camp = __R.campaniaActiva();
       var nuevo = App.motor.crearProspecto({ nombre: 'REDTEAM participacion corregida' });
       if (!nuevo.ok) return { veredicto: 'ROTO', detalle: 'no se pudo crear el prospecto: ' + JSON.stringify(nuevo.errores) };
       var r = App.motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: nuevo.prospecto.id, fechaRegistro: '2029-02-31', valorPotencial: -3000 });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = r.participacion || {};
       return { veredicto: (r.ok && p.fechaRegistro !== '2029-02-31' && p.valorPotencial >= 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'ok=' + r.ok + ' · fechaRegistro=' + JSON.stringify(p.fechaRegistro) + ' · valorPotencial=' + JSON.stringify(p.valorPotencial) + ' · errores=' + JSON.stringify(r.errores || []) };`
});

await A({
  id: 'F-21', nombre: 'Oferta con precio negativo: asignarla a una participación', dato: 'oferta precioEspecial = -3000',
  esperado: 'rechazar', gravedad: 'MEDIA', espera: 600,
  js: `var camp = App.almacen.campania('${caja.semb.campanias[0].id}');
       var r = App.motor.actualizarCampania(camp.id, { ofertas: [{ id: 'of1', nombre: 'Oferta negativa', paqueteId: '${paq}', precioEspecial: -3000 }] });
       var part = participaciones.filter(function(x){ return x.campaignId === camp.id; })[0];
       var rp = App.motor.asignarOferta(part.id, 'of1');
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.participacion(part.id);
       return { veredicto: rp.ok ? 'HUECO' : 'CANDADO OK',
                detalle: 'actualizarCampania ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · asignarOferta ok=' + rp.ok + ' errores=' + JSON.stringify(rp.errores || []) +
                         ' · valorPotencial quedó=' + JSON.stringify(viva.valorPotencial) };`
});

const res = await guardar(caja, '23-evasiones-fechas-campanias');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
