/* 09b-diagnostico.mjs — aclara la contradicción A-03 vs A-08. */
import { abrirCaja } from './comun.mjs';
const caja = await abrirCaja({ familia: 'Diagnóstico campañas', base: false });
const s = caja.s;
const r = await s.evaluar(`(async function(){
  function probar(etiqueta, datos) {
    var c = App.motor.crearCampania(datos);
    var viva = App.almacen.campania(c.id);
    var puede = App.motor.puedeRecibirParticipantes(viva);
    var r = App.motor.agregarParticipacion({ campaniaId: c.id, prospectoId: prospectos[0].id });
    return { etiqueta: etiqueta, estado: viva.estado, etapas: (viva.etapas||[]).length,
             primeraEtapaTieneId: !!(viva.etapas && viva.etapas[0] && viva.etapas[0].id),
             puede: puede.ok, codigo: puede.codigo, agregarOk: r.ok, err: (r.errores||[])[0], etapaId: (r.participacion||{}).etapaId };
  }
  var a = probar('sin etapas propias', { nombre: 'D-A', tipo: 'captacion', fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
  var b = probar('con etapas propias sin id', { nombre: 'D-B', tipo: 'captacion', etapas: [{ nombre: 'A', orden: 1, esInicial: true }, { nombre: 'B', orden: 2, esInicial: true }], fechaInicio: '2028-01-01', fechaFin: '2028-12-31' });
  return { a: a, b: b };
})()`);
console.log(JSON.stringify(r, null, 1));
await s.cerrar();
