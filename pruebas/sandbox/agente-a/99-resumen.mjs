/* 99-resumen.mjs — junta los resultados de todas las familias y saca los conteos.
   Ejecutar: node pruebas\sandbox\agente-a\99-resumen.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(AQUI, 'resultados');

const FAMILIAS = [
  ['02-fechas', '1. Fechas'], ['03-telefonos', '2. Teléfonos'], ['04-tareas', '3. Tareas repetidas'],
  ['05-prospectos', '4. Prospectos'], ['06-clientes', '5. Clientes'], ['07-contratos', '6. Contratos'],
  ['08-pagos', '7. Pagos y cargos'], ['09-campanias', '8. Campañas'], ['10-concurrencia', '9. Concurrencia'],
  ['11-integridad', '10. Integridad referencial']
];

const GRAVEDAD = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const total = {};
const todo = [];
const filas = [];

for (const [archivo, titulo] of FAMILIAS) {
  const p = path.join(RES, archivo + '.json');
  if (!fs.existsSync(p)) { filas.push([titulo, 'FALTA ' + archivo + '.json', '', '', '']); continue; }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const c = j.conteo || {};
  for (const k of Object.keys(c)) total[k] = (total[k] || 0) + c[k];
  filas.push([titulo, j.ataques.length, c['CANDADO OK'] || 0, c.HUECO || 0, c.ROTO || 0, c.DUPLICA || 0]);
  for (const a of j.ataques) {
    todo.push(a);
    if (a.veredicto !== 'CANDADO OK') total.__malos = (total.__malos || 0) + 1;
  }
  total.__ataques = (total.__ataques || 0) + j.ataques.length;
}

console.log('FAMILIA                          ATAQUES  OK  HUECO  ROTO  DUPLICA');
for (const f of filas) console.log(String(f[0]).padEnd(32) + String(f[1]).padStart(5) + String(f[2]).padStart(6) + String(f[3]).padStart(7) + String(f[4]).padStart(6) + String(f[5]).padStart(9));
console.log('-'.repeat(70));
console.log('TOTAL'.padEnd(32) + String(total.__ataques).padStart(5) + String(total['CANDADO OK'] || 0).padStart(6) + String(total.HUECO || 0).padStart(7) + String(total.ROTO || 0).padStart(6) + String(total.DUPLICA || 0).padStart(9));
console.log('\nConteo crudo: ' + JSON.stringify(total));

const malos = todo.filter((a) => a.veredicto !== 'CANDADO OK')
  .sort((a, b) => (GRAVEDAD[a.gravedad] - GRAVEDAD[b.gravedad]) || a.id.localeCompare(b.id));
console.log('\n================ HALLAZGOS (HUECO / ROTO / DUPLICA) ordenados por gravedad ================');
for (const a of malos) {
  console.log(`\n[${a.veredicto}] ${a.id} · ${a.familia} · ${a.gravedad} · ${a.nombre}`);
  console.log('  dato:     ' + JSON.stringify(a.dato));
  console.log('  esperado: ' + a.esperado);
  console.log('  qué pasó: ' + String(a.detalle).slice(0, 900));
  if (a.notificaciones && a.notificaciones.length) console.log('  app dijo: ' + a.notificaciones.join(' | ').slice(0, 300));
}
console.log('\n================ CANDADOS QUE SÍ FUNCIONARON ================');
for (const a of todo.filter((x) => x.veredicto === 'CANDADO OK')) console.log(`${a.id} · ${a.familia} · ${a.nombre} — ${String(a.detalle).slice(0, 180)}`);

fs.writeFileSync(path.join(AQUI, 'resumen.json'), JSON.stringify({ total, filas, hallazgos: malos, candados: todo.filter((x) => x.veredicto === 'CANDADO OK') }, null, 2), 'utf8');
console.log('\n(resumen.json escrito)');
