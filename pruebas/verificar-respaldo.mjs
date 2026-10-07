/*
 * verificar-respaldo.mjs — Revisa que los respaldos de Jorge sirvan de verdad.
 * ---------------------------------------------------------------------------
 * Comprueba, sin imprimir datos de clientes:
 *   1. Que el JSON abra entero (no truncado).
 *   2. Qué colecciones trae y cuántos registros de cada una.
 *   3. Que el respaldo del CRM NO traiga credenciales (PIN, hash, salt).
 *   4. Del volcado de Firebase: qué nodos existen de verdad, cómo están
 *      guardadas las claves de 'usuarios' (UID vs u_<username>) y si existe
 *      el nodo 'arranque' — los dos datos que faltaban para las reglas.
 *
 * No escribe nada: solo lee e informa.
 */
import fs from 'node:fs';

function abrir(ruta) {
  if (!fs.existsSync(ruta)) return { ruta, error: 'no existe' };
  const txt = fs.readFileSync(ruta, 'utf8');
  try {
    const datos = JSON.parse(txt);
    return { ruta, datos, bytes: fs.statSync(ruta).size };
  } catch (e) { return { ruta, error: 'JSON inválido o truncado: ' + e.message, bytes: fs.statSync(ruta).size }; }
}
const cuenta = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);

console.log('════════ 1. Respaldo del CRM (el que se puede reimportar) ════════');
const app = abrir('C:\\Users\\noman\\Downloads\\registro_pda_2026-10-06.json');
if (app.error) { console.log('  ✗ ' + app.error); }
else {
  const d = app.datos;
  console.log('  archivo: ' + (app.bytes / 1024).toFixed(1) + ' KB · JSON completo: sí');
  console.log('  versión: ' + (d.version || '(sin campo)') + '   fecha de exportación: ' + (d.fechaExportacion || '(sin campo)'));
  const claves = Object.keys(d).filter(k => k !== 'version' && k !== 'fechaExportacion');
  claves.forEach(k => console.log('    ' + k.padEnd(24) + cuenta(d[k]) + ' registro(s)'));
  // Credenciales: el export debe salir SIN PIN ni hashes.
  const texto = JSON.stringify(d.usuarios || []);
  const sospechosas = ['pin', 'hash', 'salt', 'credencial', 'password', 'secreto'].filter(p => new RegExp('"' + p, 'i').test(texto));
  console.log('  credenciales dentro del respaldo: ' + (sospechosas.length ? '⚠️ ' + sospechosas.join(', ') : 'ninguna (correcto)'));
  const usuarios = Array.isArray(d.usuarios) ? d.usuarios : [];
  console.log('  usuarios en el respaldo: ' + usuarios.map(u => u.username + (u.admin ? ' (admin)' : '')).join(', '));
  // Contratos: en este CRM viven dentro de cada cliente.
  const clientes = Array.isArray(d.clientes) ? d.clientes : [];
  const contratos = clientes.reduce((a, c) => a + ((c && Array.isArray(c.contratos)) ? c.contratos.length : 0), 0);
  const pagos = clientes.reduce((a, c) => a + ((c && Array.isArray(c.contratos)) ? c.contratos.reduce((b, k) => b + ((k && Array.isArray(k.pagos)) ? k.pagos.length : 0), 0) : 0), 0);
  console.log('  contratos (dentro de los clientes): ' + contratos + '   ·   pagos registrados: ' + pagos);
}

console.log('\n════════ 2. Volcado completo de Firebase (para restaurar la base) ════════');
const fb = abrir('C:\\Users\\noman\\Downloads\\crm-pda-default-rtdb-export.json');
if (fb.error) { console.log('  ✗ ' + fb.error); }
else {
  const d = fb.datos;
  console.log('  archivo: ' + (fb.bytes / 1024).toFixed(1) + ' KB · JSON completo: sí');
  Object.keys(d).forEach(k => console.log('    ' + k.padEnd(24) + cuenta(d[k]) + ' registro(s)'));
  // Lo que faltaba para las reglas:
  const us = d.usuarios || {};
  const llaves = Object.keys(us);
  const tipoUid = llaves.filter(k => !/^u_/.test(k) && k !== 'arranque');
  console.log('\n  ── claves de "usuarios" (lo que hacía fallar el candado de las reglas) ──');
  console.log('     total: ' + llaves.length);
  console.log('     con formato u_<username>: ' + llaves.filter(k => /^u_/.test(k)).length);
  console.log('     con formato de UID: ' + tipoUid.length + (tipoUid.length ? '  (solo el del último que publicó)' : ''));
  console.log('     nodo "arranque" presente: ' + (('arranque' in us) ? 'SÍ' : 'no'));
  const admins = llaves.map(k => us[k]).filter(u => u && u.admin === true).length;
  console.log('     administradores en la base: ' + admins);
  console.log('     los registros traen campo uid: ' + llaves.filter(k => us[k] && us[k].uid).length + ' de ' + llaves.length);
  // Colecciones nuevas: ¿ya existen?
  console.log('\n  ── colecciones de campañas ──');
  console.log('     campanias: ' + (('campanias' in d) ? cuenta(d.campanias) + ' registro(s)' : 'todavía no existe (correcto: se crea con la v5.0)'));
  console.log('     participaciones: ' + (('participaciones' in d) ? cuenta(d.participaciones) + ' registro(s)' : 'todavía no existe (correcto)'));
  console.log('     nodo "admins" (el índice nuevo): ' + (('admins' in d) ? cuenta(d.admins) + ' casilla(s)' : 'no existe todavía (lo crea la v5.0)'));
}
