/*
 * capturas-sembrado.mjs — cómo se ve el CRM en la caja con 20 prospectos y 2 campañas.
 * ---------------------------------------------------------------------------
 * Sirve de evidencia: comprueba a ojo que el sandbox es el CRM completo con datos
 * de verdad (no un simulador) y que las secciones clave dibujan bien.
 *
 * Cómo se corre:  node pruebas\sandbox\capturas-sembrado.mjs
 * Deja los PNG en pruebas\capturas\.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from './sandbox.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CAPTURAS = path.resolve(AQUI, '..', 'capturas');
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

const info = preparar();
const s = await abrir({ info, ancho: 390, alto: 844, movil: true });
try {
  console.log('entrar: ' + await entrar(s));
  const a = await revisarAislamiento(s);
  console.log('aislado: ' + a.aislado + ' · peticiones a datos reales: ' + a.fugasDatos.length);
  const sembrado = await sembrar(s);
  console.log('sembrado: ' + sembrado.prospectos + ' prospectos · ' + sembrado.campanias.length + ' campañas · ' + sembrado.participaciones + ' participaciones');
  if (sembrado.errores.length) console.log('errores: ' + sembrado.errores.join(' | '));

  for (const [seccion, nombre] of [['prospectos', 'sandbox-prospectos'], ['campanias', 'sandbox-campanias'], ['calendario', 'sandbox-calendario']]) {
    await s.evaluar(`(function () { App.seleccionarSeccion('${seccion}'); return 1; })()`);
    await dormir(600);
    console.log('captura: ' + await s.captura(nombre, CAPTURAS));
  }
  const conteo = await s.evaluar(`(function () {
    return {
      prospectos: prospectos.length,
      campanias: App.almacen.db.campanias.length,
      participaciones: App.almacen.db.participaciones.length,
      tarjetasProspecto: document.querySelectorAll('#lista-prospectos .mosaico-card').length,
      tarjetasCampania: document.querySelectorAll('#campanias-lista-vista .mosaico-card').length
    };
  })()`);
  console.log('en pantalla: ' + JSON.stringify(conteo));
} finally {
  const red = await s.cerrar();
  console.log('red: ' + red.peticiones + ' peticiones · a datos reales: ' + (red.prohibidas.filter(h => h !== 'gstatic.com').length ? 'REVISAR' : 'ninguna'));
}
