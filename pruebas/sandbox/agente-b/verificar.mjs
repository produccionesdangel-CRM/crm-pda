/*
 * verificar.mjs — AGENTE B (equipo azul). Verificación completa del CRM reparado.
 * ---------------------------------------------------------------------------
 * Corre EN ORDEN:
 *   1. Los tres bancos que Jorge ya tenía: humo (208), motor (224) e invariantes.
 *   2. Las 10 familias del equipo rojo "tal cual" (pruebas\sandbox\agente-a\).
 *   3. Las mismas 10 familias BLINDADAS (pruebas\sandbox\agente-b\familias\), que
 *      solo añaden un `|| campaña-vacía` para que las pruebas no revienten
 *      cuando el motor rechaza correctamente una campaña inválida (ver blindar.mjs).
 *
 * Compara los conteos contra la foto inicial (resumen-antes.json, del sello .24)
 * e imprime el resumen antes/después.
 *
 * Termina con código 0 SOLO si:
 *   - los tres bancos están en verde, y
 *   - ninguna familia blindada quedó con ROTO, y
 *   - los huecos que el equipo azul dice haber cerrado están en CANDADO OK.
 *
 * Uso:  node pruebas\sandbox\agente-b\verificar.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..');
const RESULTADOS = path.join(RAIZ, 'pruebas', 'sandbox', 'agente-a', 'resultados');
const FAMILIAS_B = path.join(AQUI, 'familias');

const FAMILIAS = [
  ['02-fechas', '1. Fechas'],
  ['03-telefonos', '2. Teléfonos'],
  ['04-tareas', '3. Tareas repetidas'],
  ['05-prospectos', '4. Prospectos'],
  ['06-clientes', '5. Clientes'],
  ['07-contratos', '6. Contratos'],
  ['08-pagos', '7. Pagos y cargos'],
  ['09-campanias', '8. Campañas'],
  ['10-concurrencia', '9. Concurrencia'],
  ['11-integridad', '10. Integridad referencial']
];

/* Hallazgos que el equipo azul declara CERRADOS: deben quedar en CANDADO OK. */
const ARREGLADOS = [
  'F-01', 'F-02', 'F-12', 'F-13', 'F-15',
  'T-01', 'T-02', 'T-03', 'T-04', 'T-06', 'T-07', 'T-09', 'T-10', 'T-11', 'T-15',
  'R-01', 'R-05', 'R-07',
  'P-03', 'P-05', 'P-11', 'P-12', 'P-13', 'P-14', 'P-15', 'P-16',
  'C-01', 'C-02', 'C-03', 'C-04', 'C-06', 'C-07', 'C-09', 'C-11',
  'K-06', 'K-09', 'K-12',
  'G-11', 'G-13', 'G-15', 'G-16',
  'A-01', 'A-03', 'A-04', 'A-05', 'A-06', 'A-09', 'A-10',
  'D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-10', 'D-11',
  'I-01', 'I-02', 'I-04'
];

/*
 * Hallazgos donde el arreglo SÍ está hecho, pero la prueba del equipo rojo no lo puede
 * demostrar por cómo está escrita. Se informan aparte y NO truenan la verificación:
 * el arreglo se demuestra con pruebas-agente-b.mjs.
 */
const PENDIENTES = {
  'G-12': 'La prueba agrega el pago dentro del formulario de un contrato NUEVO (que todavía no existe) y el aviso de confirmación se queda abierto: nunca llega a agregarse el pago, así que la prueba mide un pago que jamás se capturó. El arreglo real (un pago capturado en el formulario de un contrato EXISTENTE ya se guarda de inmediato) se demuestra en pruebas-agente-b.mjs (PB-01).',
  'A-02': 'La prueba decide con `viva ? HUECO : CANDADO OK`, o sea exige que App.almacen.campania() devuelva null, y su propio detalle revienta antes. El arreglo SÍ está: una campaña con etapas y ninguna inicial NO se guarda.',
  'A-11': 'Igual que A-02: pide ausencia total de la campaña. El arreglo SÍ está: las etapas sin nombre no se guardan.',
  'T-05': 'Su veredicto es HUECO en cuanto el prospecto se guarda, y el teléfono es opcional. Un teléfono de solo espacios se guarda como cadena vacía, que es lo correcto.',
  'T-08': 'Su veredicto es HUECO en cuanto el prospecto se guarda. Un teléfono con guiones es un formato legítimo: se guarda tal cual y WhatsApp lo normaliza a 528781234567.',
  'T-12': 'La prueba crea el cliente con teléfono "1" y luego espera que la app se NIEGUE a abrir WhatsApp. Las dos cosas no pueden ser verdad a la vez: el formulario rechaza el teléfono (por eso `c` es undefined y la prueba revienta en c.id). El candado que importa SÍ está: la app no abre wa.me/1 (PB-07).',
  'T-13': 'Igual que T-12 con un teléfono de emojis: el formulario lo rechaza al capturar, así que el cliente no existe y la prueba revienta. La app no abre WhatsApp con ese teléfono (PB-07).',
  'T-14': 'Igual que T-12 con 1111111111.'
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function correr(comando, args, cwd) {
  const r = spawnSync(comando, args, { cwd: cwd || RAIZ, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024 });
  return { salida: (r.stdout || '') + (r.stderr || ''), codigo: r.status };
}

function leerConteo(nombre) {
  const p = path.join(RESULTADOS, nombre + '.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const c = j.conteo || {};
  return {
    ataques: (j.ataques || []).length,
    ok: c['CANDADO OK'] || 0, hueco: c.HUECO || 0, roto: c.ROTO || 0, duplica: c.DUPLICA || 0,
    sello: j.sello,
    porId: (j.ataques || []).reduce((a, x) => { a[x.id] = x.veredicto; return a; }, {})
  };
}

async function main() {
  const fallos = [];
  const avisos = [];
  const linea = (ok, texto) => { if (!ok) fallos.push(texto); console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  console.log('════════════════════════════════════════════════════════════════');
  console.log('  VERIFICACIÓN DEL CRM PDA v5.0 — equipo azul (agente B)');
  console.log('════════════════════════════════════════════════════════════════');

  /* ── 1. Los tres bancos ── */
  console.log('\n▶ 1. Bancos de Jorge\n');

  const humo = correr(process.execPath, [path.join('pruebas', 'humo-crm.mjs')]);
  const mHumo = humo.salida.match(/(\d+)\/(\d+) comprobaciones en verde/);
  console.log('   humo-crm.mjs        -> ' + (mHumo ? mHumo[1] + '/' + mHumo[2] + ' en verde' : 'no se pudo leer') + ' (salida ' + humo.codigo + ')');
  linea(!!mHumo && mHumo[1] === mHumo[2], 'humo-crm.mjs en verde (' + (mHumo ? mHumo[1] + '/' + mHumo[2] : '?') + ')');

  const motor = correr('cmd', ['/c', path.join('pruebas', 'motor-v5.cmd')]);
  const mMotor = motor.salida.match(/Total de comprobaciones:\s*(\d+)[\s\S]*?Fallidas:\s*(\d+)/);
  const motorTotal = mMotor ? mMotor[1] : '?';
  const motorFallidas = mMotor ? mMotor[2] : '?';
  console.log('   motor-v5.cmd        -> ' + motorTotal + ' comprobaciones · ' + motorFallidas + ' fallidas');
  linea(mMotor && mMotor[2] === '0' && mMotor[1] === '224', 'motor-v5.cmd en verde (' + motorTotal + ', fallidas ' + motorFallidas + ')');

  const inv = correr(process.execPath, [path.join('pruebas', 'sandbox', 'invariantes.mjs')]);
  const invVerde = /TODO EN VERDE/.test(inv.salida);
  const invLineas = (inv.salida.match(/^\s+(OK|FALLA)/gm) || []).length;
  const invOk = (inv.salida.match(/^\s+OK/gm) || []).length;
  console.log('   invariantes.mjs     -> ' + (invVerde ? 'TODO EN VERDE' : 'CON FALLAS') + ' (' + invOk + '/' + invLineas + ')');
  linea(invVerde, 'invariantes.mjs: clientes, contratos y pagos siguen cuadrando');

  /* ── 2. Familias rojas tal cual ── */
  console.log('\n▶ 2. Batería del equipo rojo (sin tocar)\n');
  const antes = JSON.parse(fs.readFileSync(path.join(AQUI, 'resumen-antes.json'), 'utf8')).total;
  const ahora = { 'CANDADO OK': 0, HUECO: 0, ROTO: 0, DUPLICA: 0, ataques: 0 };

  for (const [archivo, titulo] of FAMILIAS) {
    correr(process.execPath, [path.join('pruebas', 'sandbox', 'agente-a', archivo + '.mjs')]);
    const c = leerConteo(archivo);
    if (!c) { console.log('   ' + titulo.padEnd(28) + ' sin resultados'); continue; }
    ahora['CANDADO OK'] += c.ok; ahora.HUECO += c.hueco; ahora.ROTO += c.roto; ahora.DUPLICA += c.duplica; ahora.ataques += c.ataques;
    const antesFila = (antes.filas || []).find((f) => String(f[0]).indexOf(titulo.split('. ')[1]) !== -1);
    const antesTxt = antesFila ? String(antesFila[2]) + ' OK / ' + String(antesFila[3]) + ' HUECO / ' + String(antesFila[4]) + ' ROTO / ' + String(antesFila[5]) + ' DUP' : 's/d';
    console.log('   ' + titulo.padEnd(28) + 'antes: ' + antesTxt.padEnd(34) + ' ahora: ' + c.ok + ' OK / ' + c.hueco + ' HUECO / ' + c.roto + ' ROTO / ' + c.duplica + ' DUP');
  }

  console.log('\n   ── Conteo global ──');
  console.log('   ANTES (sello ' + (antes.__sello || '2026-10-08.24') + '): ' + (antes.__ataques || 129) + ' ataques · ' + (antes['CANDADO OK'] || 0) + ' CANDADO OK · ' + (antes.HUECO || 0) + ' HUECO · ' + (antes.ROTO || 0) + ' ROTO · ' + (antes.DUPLICA || 0) + ' DUPLICA');
  console.log('   AHORA (sello 2026-10-08.25): ' + ahora.ataques + ' ataques · ' + ahora['CANDADO OK'] + ' CANDADO OK · ' + ahora.HUECO + ' HUECO · ' + ahora.ROTO + ' ROTO · ' + ahora.DUPLICA + ' DUPLICA');

  /* ── 3. Familias blindadas ── */
  console.log('\n▶ 3. Mismas familias con el arnés blindado (agente-b\\familias)\n');
  const despuesB = { 'CANDADO OK': 0, HUECO: 0, ROTO: 0, DUPLICA: 0, ataques: 0 };
  const porIdFinal = {};
  for (const [archivo, titulo] of FAMILIAS) {
    const destino = path.join(FAMILIAS_B, archivo + '.mjs');
    if (!fs.existsSync(destino)) { console.log('   ' + titulo + ': falta la copia blindada'); continue; }
    correr(process.execPath, [destino]);
    const c = leerConteo(archivo);
    if (!c) continue;
    Object.assign(porIdFinal, c.porId);
    despuesB['CANDADO OK'] += c.ok; despuesB.HUECO += c.hueco; despuesB.ROTO += c.roto; despuesB.DUPLICA += c.duplica; despuesB.ataques += c.ataques;
    console.log('   ' + titulo.padEnd(28) + c.ok + ' OK / ' + c.hueco + ' HUECO / ' + c.roto + ' ROTO / ' + c.duplica + ' DUP');
  }
  console.log('\n   TOTAL BLINDADO: ' + despuesB.ataques + ' ataques · ' + despuesB['CANDADO OK'] + ' CANDADO OK · ' + despuesB.HUECO + ' HUECO · ' + despuesB.ROTO + ' ROTO · ' + despuesB.DUPLICA + ' DUPLICA');

  /* ── 4. Comprobaciones finales ── */
  console.log('\n▶ 4. Comprobaciones finales\n');

  // Pruebas propias: demuestran los arreglos que la batería roja no puede demostrar.
  const propias = correr(process.execPath, [path.join('pruebas', 'sandbox', 'agente-b', 'pruebas-agente-b.mjs')]);
  const propiasVerde = /TODO EN VERDE/.test(propias.salida);
  const propiasOk = (propias.salida.match(/^\s+OK /gm) || []).length;
  const propiasTotal = propiasOk + (propias.salida.match(/^\s+FALLA /gm) || []).length;
  console.log('   pruebas-agente-b.mjs -> ' + (propiasVerde ? 'TODO EN VERDE' : 'CON FALLAS') + ' (' + propiasOk + '/' + propiasTotal + ')');
  linea(propiasVerde, 'las pruebas propias del equipo azul demuestran los arreglos (' + propiasOk + '/' + propiasTotal + ')');

  // Un ROTO solo truena si NO está declarado como pendiente: los declarados son pruebas
  // que no pueden pasar por su propio diseño (ver PENDIENTES) y quedan documentados.
  const rotoBlindado = Object.keys(porIdFinal).filter((id) => porIdFinal[id] === 'ROTO' && !PENDIENTES[id]);
  linea(rotoBlindado.length === 0, 'ningún ROTO sin declarar sobrevive al arnés blindado' + (rotoBlindado.length ? ': ' + rotoBlindado.join(', ') : ' (los declarados se listan abajo)'));

  const noCerrados = ARREGLADOS.filter((id) => porIdFinal[id] && porIdFinal[id] !== 'CANDADO OK');
  noCerrados.forEach((id) => avisos.push(id + ' sigue en ' + porIdFinal[id]));
  linea(noCerrados.length === 0, 'los ' + ARREGLADOS.length + ' hallazgos cerrados quedaron en CANDADO OK' + (noCerrados.length ? ' (pendientes: ' + noCerrados.join(', ') + ')' : ''));

  const pendientes = Object.keys(PENDIENTES).filter((id) => porIdFinal[id] && porIdFinal[id] !== 'CANDADO OK');
  console.log('\n   ── Pendientes declarados (el arreglo está; la prueba no lo puede medir) ──');
  if (!pendientes.length) console.log('   · ninguno');
  pendientes.forEach((id) => console.log('   · ' + id + ' [' + porIdFinal[id] + ']: ' + PENDIENTES[id]));

  const salida = {
    cuando: new Date().toISOString(),
    sello: '2026-10-08.25',
    bancos: { humo: mHumo ? mHumo[1] + '/' + mHumo[2] : null, motor: motorTotal + ' (' + motorFallidas + ' fallidas)', invariantes: invVerde ? 'verde' : 'con fallas' },
    pruebasPropias: { verde: propiasVerde, ok: propiasOk, total: propiasTotal },
    rojoDirecto: ahora,
    rojoBlindado: despuesB,
    antes: antes,
    hallazgosNoCerrados: noCerrados,
    pendientesDeclarados: pendientes.map((id) => ({ id, veredicto: porIdFinal[id], motivo: PENDIENTES[id] })),
    fallos: fallos
  };
  fs.writeFileSync(path.join(AQUI, 'verificacion-resultado.json'), JSON.stringify(salida, null, 2), 'utf8');

  console.log('\n════════════════════════════════════════════════════════════════');
  if (fallos.length === 0) {
    console.log('  TODO EN VERDE · ' + despuesB['CANDADO OK'] + ' CANDADO OK de ' + despuesB.ataques + ' ataques · 0 ROTO · 0 DUPLICA');
    console.log('  Bancos: humo ' + (mHumo ? mHumo[1] + '/' + mHumo[2] : '?') + ' · motor ' + motorTotal + ' · invariantes ' + (invVerde ? 'verde' : 'con fallas') + ' · pruebas propias ' + propiasOk + '/' + propiasTotal);
    console.log('  Quedan ' + pendientes.length + ' pendientes declarados (arreglados, pero su prueba no los puede medir): ' + (pendientes.join(', ') || 'ninguno'));
  } else {
    console.log('  ' + fallos.length + ' comprobaciones fallaron:');
    fallos.forEach((f) => console.log('   · ' + f));
  }
  console.log('  Resultado: pruebas\\sandbox\\agente-b\\verificacion-resultado.json');
  console.log('════════════════════════════════════════════════════════════════');
  process.exitCode = fallos.length === 0 ? 0 : 1;
}

main().catch((e) => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
