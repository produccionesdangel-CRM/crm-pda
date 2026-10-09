/* 09-campanias.mjs — FAMILIA 8: CAMPAÑAS Y DINÁMICAS. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Campañas' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const campActiva = caja.semb.campanias[0].id;
const campActiva2 = caja.semb.campanias[1].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'A-01', nombre: 'Campaña SIN nombre creada por el motor (lo que llama el asistente)', dato: 'nombre = ""',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = campanias.length;
       var c = App.motor.crearCampania({ nombre: '', tipo: 'captacion', fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       return { veredicto: (viva && viva.nombre === 'Campaña sin nombre') ? 'HUECO' : 'CANDADO OK',
                detalle: 'la campaña quedó guardada como ' + JSON.stringify(viva.nombre) + ' (el motor la renombra en silencio; el asistente sí avisa porque llama a validarCampania antes: errores=' + JSON.stringify(v.errores) + ') · campanias ' + n0 + ' → ' + campanias.length };`
});

await A({
  id: 'A-02', nombre: 'Campaña con etapas SIN etapa inicial', dato: 'etapas sin esInicial:true',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var etapas = [{ nombre: 'Uno', orden: 1, esInicial: false, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: 'Dos', orden: 2, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM sin etapa inicial', tipo: 'captacion', etapas: etapas, fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       var r = App.motor.agregarParticipacion({ campaniaId: c.id, prospectoId: prospectos[0].id });
       return { veredicto: viva ? 'HUECO' : 'CANDADO OK',
                detalle: 'quedó guardada con etapas=' + (viva.etapas || []).length + ' · validarCampania ok=' + v.ok + ' errores=' + JSON.stringify(v.errores) + ' · intento de agregar participante: ok=' + r.ok + ' codigo=' + r.codigo + ' errores=' + JSON.stringify(r.errores) };`
});

await A({
  id: 'A-03', nombre: 'Campaña con DOS etapas marcadas como iniciales', dato: 'dos esInicial:true',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var etapas = [{ nombre: 'A', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: 'B', orden: 2, esInicial: true, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM dos iniciales', tipo: 'captacion', etapas: etapas, fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       var r = App.motor.agregarParticipacion({ campaniaId: c.id, prospectoId: prospectos[1].id });
       var par = r.participacion || {};
       return { veredicto: (viva && (viva.etapas || []).filter(function(e){ return e.esInicial; }).length > 1) ? 'HUECO' : 'CANDADO OK',
                detalle: 'la campaña quedó GUARDADA con ' + (viva.etapas || []).filter(function(e){ return e.esInicial; }).length + ' etapas iniciales · validarCampania errores=' + JSON.stringify(v.errores) + ' · agregar participante ok=' + r.ok + ' (' + r.codigo + ') porque la campaña está en borrador' };`
});

await A({
  id: 'A-04', nombre: 'Campaña con metas negativas y con texto', dato: 'metas = { prospectos: -50, conversiones: "muchas" }',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM metas', tipo: 'captacion', fechaInicio: '2028-01-01', fechaFin: '2028-12-31', metas: { prospectos: -50, conversiones: 'muchas' } });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania(c.id);
       var r = App.motor.actualizarCampania(c.id, { metas: { prospectos: -50, conversiones: 'muchas' } });
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva2 = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva2, { paraActivar: true });
       return { veredicto: (r.ok && viva2.metas && viva2.metas.prospectos < 0) ? 'HUECO' : 'CANDADO OK',
                detalle: 'metas guardadas = ' + JSON.stringify(viva2.metas) + ' · actualizarCampania ok=' + r.ok + ' · validarCampania NO revisa metas: errores=' + JSON.stringify(v.errores) };`
});

await A({
  id: 'A-05', nombre: 'Campaña con un criterio de elegibilidad inventado', dato: 'criteriosElegibilidad = [{ tipo: "signo-zodiacal", valor: "escorpio" }]',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM criterio', tipo: 'captacion', fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var r = App.motor.actualizarCampania(c.id, { criteriosElegibilidad: [{ id: 'cr1', tipo: 'signo-zodiacal', valor: 'escorpio' }] });
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       return { veredicto: (r.ok && (viva.criteriosElegibilidad || []).length) ? 'HUECO' : 'CANDADO OK',
                detalle: 'actualizarCampania ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · criterio guardado=' + JSON.stringify(viva.criteriosElegibilidad) + ' · validarCampania SÍ lo detecta: ' + JSON.stringify(v.errores) };`
});

await A({
  id: 'A-06', nombre: 'Oferta con precio NEGATIVO dentro de la campaña', dato: 'ofertas = [{ nombre: "Oferta mala", paqueteId: paquete, precioEspecial: -3000 }]',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var r = App.motor.actualizarCampania('${campActiva}', { ofertas: [{ id: 'of1', nombre: 'Oferta mala', paqueteId: '${paq}', precioEspecial: -3000 }] });
       await new Promise(function(x){ setTimeout(x, 300); });
       var viva = App.almacen.campania('${campActiva}');
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       var p = App.motor.participacionDe ? null : null;
       var rp = App.motor.asignarOferta(participaciones.filter(function(x){ return x.campaignId === '${campActiva}'; })[0].id, 'of1');
       var part = participaciones.filter(function(x){ return x.campaignId === '${campActiva}'; })[0];
       return { veredicto: (r.ok && rp.ok && part.ofertaAsignada && part.ofertaAsignada.precioEspecial < 0) ? 'HUECO' : 'CANDADO OK',
                detalle: 'actualizarCampania ok=' + r.ok + ' · oferta guardada con precioEspecial=' + ((viva.ofertas || [])[0] || {}).precioEspecial + ' · validarCampania SÍ lo detecta: ' + JSON.stringify(v.errores) + ' · asignarOferta ok=' + rp.ok + ' · valorPotencial de la participación quedó = ' + JSON.stringify(part.valorPotencial) };`
});

await A({
  id: 'A-07', nombre: 'Agregar el MISMO prospecto DOS veces a la MISMA campaña', dato: 'mismo prospectoId dos veces',
  esperado: 'rechazo del duplicado', gravedad: 'ALTA',
  js: `var camp = App.almacen.campania('${campActiva}');
       var libre = prospectos.filter(function(p){ return !participaciones.some(function(x){ return x.campaignId === camp.id && x.prospectId === p.id; }); })[0];
       var n0 = participaciones.filter(function(x){ return x.campaignId === camp.id; }).length;
       var r1 = App.motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: libre.id });
       await new Promise(function(x){ setTimeout(x, 200); });
       var r2 = App.motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: libre.id });
       await new Promise(function(x){ setTimeout(x, 250); });
       var n1 = participaciones.filter(function(x){ return x.campaignId === camp.id; }).length;
       return { veredicto: n1 > n0 + 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: '1ª vez ok=' + r1.ok + ' · 2ª vez ok=' + r2.ok + ' codigo=' + r2.codigo + ' errores=' + JSON.stringify(r2.errores) + ' · participaciones de la campaña ' + n0 + ' → ' + n1 };`
});

await A({
  id: 'A-08', nombre: 'Agregar participantes a una campaña que NO está activa (borrador)', dato: 'campaña en borrador',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var c = App.motor.crearCampania({ nombre: 'REDTEAM borrador', tipo: 'captacion', objetivoPrincipal: 'probar', fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var r = App.motor.agregarParticipacion({ campaniaId: c.id, prospectoId: prospectos[3].id });
       await new Promise(function(x){ setTimeout(x, 250); });
       var cuantas = participaciones.filter(function(x){ return x.campaignId === c.id; }).length;
       return { veredicto: r.ok ? 'HUECO' : 'CANDADO OK',
                detalle: 'estado de la campaña=' + App.almacen.campania(c.id).estado + ' · ok=' + r.ok + ' codigo=' + r.codigo + ' errores=' + JSON.stringify(r.errores) + ' · participaciones creadas=' + cuantas };`
});

await A({
  id: 'A-09', nombre: 'Cambiar de etapa una participación ya CERRADA (convertida)', dato: 'participación con estado convertida → cambiar a la etapa inicial',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var camp = App.almacen.campania('${campActiva}');
       var par = participaciones.filter(function(x){ return x.campaignId === camp.id; })[0];
       var etapas = App.motor.etapasOrdenadas(camp);
       var ultima = etapas[etapas.length - 1];
       App.motor.cambiarEtapa(par.id, ultima.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       var antes = App.almacen.participacion(par.id);
       var inicial = App.motor.etapaInicial(camp);
       var r = App.motor.cambiarEtapa(par.id, inicial.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.participacion(par.id);
       var incoherente = (antes.estado === 'convertida' && viva.etapaId === inicial.id);
       return { veredicto: incoherente ? 'HUECO' : 'CANDADO OK',
                detalle: 'etapa final=' + JSON.stringify(ultima.nombre) + ' (deja estado ' + antes.estado + ') · luego cambiarEtapa a la etapa inicial "' + inicial.nombre + '": ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) +
                         ' · resultado: etapa=' + JSON.stringify((App.motor.etapaDe(camp, viva.etapaId) || {}).nombre) + ' pero estado=' + JSON.stringify(viva.estado) + ' · cambiosEstado=' + JSON.stringify(r.cambiosEstado || []) };`
});

await A({
  id: 'A-10', nombre: 'Cambiar el estado de una participación a un valor inventado', dato: 'estadoNuevo = "estadoInventado"',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var par = participaciones[0];
       var r = App.motor.cambiarEstadoParticipacion(par.id, 'estadoInventado');
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.participacion(par.id);
       return { veredicto: (r.ok && viva.estado === 'estadoInventado') ? 'HUECO' : 'CANDADO OK',
                detalle: 'ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · estado guardado=' + JSON.stringify(viva.estado) };`
});

await A({
  id: 'A-11', nombre: 'Campaña con etapas de nombre vacío y órdenes repetidos', dato: 'etapas = 3 sin nombre y todas con orden 1',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var etapas = [{ nombre: '', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }, { nombre: '   ', orden: 1, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }];
       var c = App.motor.crearCampania({ nombre: 'REDTEAM etapas vacías', tipo: 'captacion', etapas: etapas, fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.campania(c.id);
       var v = App.motor.validarCampania(viva, { paraActivar: true });
       return { veredicto: viva ? 'HUECO' : 'CANDADO OK',
                detalle: 'quedó guardada con ' + (viva.etapas || []).length + ' etapas · validarCampania errores=' + JSON.stringify(v.errores) + ' avisos=' + JSON.stringify(v.avisos) };`
});

await A({
  id: 'A-12', nombre: 'Activar una campaña con datos incongruentes (¿la frena la validación?)', dato: 'activar "REDTEAM sin etapa inicial"',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var mala = campanias.filter(function(c){ return c.nombre === 'REDTEAM sin etapa inicial'; })[0];
       if (!mala) return { veredicto: 'CANDADO OK', detalle: 'no existe la campaña mala' };
       var r = App.motor.activarCampania(mala.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = App.almacen.campania(mala.id);
       return { veredicto: r.ok ? 'HUECO' : 'CANDADO OK',
                detalle: 'activar ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · estado final=' + viva.estado };`
});

await A({
  id: 'A-13', nombre: 'Prospecto eliminado con participaciones activas (desde el motor)', dato: 'motor.eliminarProspecto con participaciones',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var par = participaciones[0];
       var r = App.motor.eliminarProspecto(par.prospectId);
       await new Promise(function(x){ setTimeout(x, 250); });
       var existe = prospectos.some(function(p){ return p.id === par.prospectId; });
       return { veredicto: (r.ok && !existe) ? 'HUECO' : 'CANDADO OK',
                detalle: 'ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · el prospecto sigue existiendo=' + existe + ' · (el motor SÍ protege; la función de la interfaz eliminarProspecto NO: ver familia 10)' };`
});

const res = await guardar(caja, '09-campanias');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
