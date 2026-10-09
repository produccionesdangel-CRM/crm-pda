/* 99b-resumen-p2.mjs — junta la segunda pasada: originales (.25) + scripts nuevos.
   Ejecutar: node pruebas\sandbox\agente-a\99b-resumen-p2.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/* Conteos de la PRIMERA pasada (sello .24), tal como quedaron en HALLAZGOS.md y resumen.json. */
const ANTES = {
  '1. Fechas': [15, 9, 6, 0, 0], '2. Teléfonos': [15, 1, 14, 0, 0], '3. Tareas': [9, 4, 3, 0, 2],
  '4. Prospectos': [14, 6, 7, 1, 0], '5. Clientes': [12, 4, 7, 0, 1], '6. Contratos': [15, 12, 3, 0, 0],
  '7. Pagos y cargos': [17, 12, 1, 4, 0], '8. Campañas': [13, 4, 9, 0, 0], '9. Concurrencia': [11, 4, 1, 0, 6],
  '10. Integridad': [8, 4, 4, 0, 0]
};

const ORIGINALES = [
  ['02-fechas', '1. Fechas'], ['03-telefonos', '2. Teléfonos'], ['04-tareas', '3. Tareas'],
  ['05-prospectos', '4. Prospectos'], ['06-clientes', '5. Clientes'], ['07-contratos', '6. Contratos'],
  ['08-pagos', '7. Pagos y cargos'], ['09-campanias', '8. Campañas'], ['10-concurrencia', '9. Concurrencia'],
  ['11-integridad', '10. Integridad']
];

const NUEVOS = [
  ['20-evasiones-telefonos', 'Evasión teléfonos'], ['21-evasiones-duplicados', 'Evasión duplicados'],
  ['22-evasiones-antirrepeticion-modales', 'Evasión antirrepetición + modales'], ['23-evasiones-fechas-campanias', 'Evasión fechas y campañas'],
  ['24-no-bloquear-de-mas', 'No bloquear de más'], ['25-blindado-confirmado', 'Blindado confirmado'],
  ['26-originales-corregidos', 'Originales corregidos (artefactos)'], ['27-correcciones-y-casos-nuevos', 'Correcciones y casos nuevos'],
  ['28-diagnostico-final', 'Diagnóstico final'], ['29-antirrepeticion-contrato', 'Antirrepetición contrato'],
  ['31-antirrepeticion-limpio', 'Antirrepetición caja limpia']
];

function leer(dir, archivo) {
  const p = path.join(AQUI, dir, archivo + '.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

console.log('=== FAMILIAS ORIGINALES: antes (.24) vs ahora (.25) ===');
console.log('FAMILIA                      antes(ata/ok/hueco/roto/dup)     ahora(ata/ok/hueco/roto/dup)');
const totA = [0, 0, 0, 0, 0], totB = [0, 0, 0, 0, 0];
const malosAhora = [];
for (const [archivo, titulo] of ORIGINALES) {
  const j = leer('resultados-p2-originales', archivo);
  const a = ANTES[titulo];
  const c = j ? j.conteo : {};
  const b = [j ? j.ataques.length : 0, c['CANDADO OK'] || 0, c.HUECO || 0, c.ROTO || 0, c.DUPLICA || 0];
  for (let i = 0; i < 5; i++) { totA[i] += a[i]; totB[i] += b[i]; }
  console.log(titulo.padEnd(28) + JSON.stringify(a).padEnd(33) + JSON.stringify(b));
  if (j) j.ataques.filter((x) => x.veredicto !== 'CANDADO OK').forEach((x) => malosAhora.push({ ...x, familia: titulo }));
}
console.log('-'.repeat(100));
console.log('TOTAL'.padEnd(28) + JSON.stringify(totA).padEnd(33) + JSON.stringify(totB));

console.log('\n=== SCRIPTS NUEVOS DE LA SEGUNDA PASADA ===');
const totalN = {};
const malosN = [];
const buenosN = [];
for (const [archivo, titulo] of NUEVOS) {
  const j = leer('resultados-p2-nuevos', archivo);
  if (!j) { console.log(titulo.padEnd(40) + 'FALTA'); continue; }
  for (const k of Object.keys(j.conteo)) totalN[k] = (totalN[k] || 0) + j.conteo[k];
  totalN.__ataques = (totalN.__ataques || 0) + j.ataques.length;
  console.log(titulo.padEnd(40) + String(j.ataques.length).padStart(4) + '  ' + JSON.stringify(j.conteo));
  j.ataques.forEach((x) => { (x.veredicto === 'CANDADO OK' ? buenosN : malosN).push({ ...x, familia: titulo }); });
}
console.log('-'.repeat(70));
console.log('TOTAL NUEVOS'.padEnd(40) + String(totalN.__ataques).padStart(4) + '  ' + JSON.stringify(totalN));

console.log('\n\n================ HALLAZGOS DE LA SEGUNDA PASADA (no CANDADO OK) ================');
for (const a of malosN) {
  console.log(`\n[${a.veredicto}] ${a.id} · ${a.familia} · ${a.gravedad} · ${a.nombre}`);
  console.log('  dato:     ' + JSON.stringify(a.dato));
  console.log('  esperado: ' + a.esperado);
  console.log('  qué pasó: ' + String(a.detalle).replace(/\s+/g, ' ').slice(0, 700));
}

console.log('\n\n================ 12 VEREDICTOS MALOS DE LAS FAMILIAS ORIGINALES (¿artefacto?) ================');
for (const a of malosAhora) {
  console.log(`\n[${a.veredicto}] ${a.id} · ${a.familia} — ${a.nombre}`);
  console.log('  qué pasó: ' + String(a.detalle).replace(/\s+/g, ' ').slice(0, 420));
}

console.log('\n\n================ BLINDADO CONFIRMADO (CANDADO OK de los scripts nuevos) ================');
for (const a of buenosN) console.log(`${a.id} · ${a.familia} — ${String(a.detalle).replace(/\s+/g, ' ').slice(0, 200)}`);

fs.writeFileSync(path.join(AQUI, 'resumen-p2.json'), JSON.stringify({ antes: ANTES, ahora: totB, originales: malosAhora, nuevosTotales: totalN, hallazgosNuevos: malosN, blindado: buenosN }, null, 2), 'utf8');
console.log('\n(resumen-p2.json escrito)');
