/*
 * blindar.mjs — AGENTE B (equipo azul).
 * ---------------------------------------------------------------------------
 * Genera en pruebas\sandbox\agente-b\familias\ una copia de cada familia del
 * equipo rojo con UN solo cambio, puramente defensivo:
 *
 *   App.almacen.campania(X)  ->  (App.almacen.campania(X) || CAMPAÑA_VACIA)
 *
 * Por que: los hallazgos A-01..A-04, A-11 y F-12 del equipo rojo leian
 * `viva.estado` / `viva.nombre` sin comprobar si la campania existia. Ahora el
 * motor RECHAZA una campana invalida y NO la guarda (que es justo el arreglo),
 * asi que `campania()` devuelve null y la prueba reventaba con un TypeError
 * (veredicto ROTO) en vez de reconocer que no se creo nada.
 *
 * IMPORTANTE: no se toca ni un solo `veredicto:` ni la logica del ataque. El
 * unico cambio es que leer un campo de una campania inexistente devuelve
 * undefined en lugar de lanzar una excepcion. Con eso, un motor que SI guardara
 * la campana invalida seguiria dando HUECO (viva existe y tiene los datos malos).
 *
 * Uso:  node pruebas\sandbox\agente-b\blindar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(AQUI, '..', 'agente-a');
const DESTINO = path.join(AQUI, 'familias');

const FAMILIAS = [
  '02-fechas', '03-telefonos', '04-tareas', '05-prospectos', '06-clientes',
  '07-contratos', '08-pagos', '09-campanias', '10-concurrencia', '11-integridad'
];

// Una campania inexistente, para no reventar al leer sus campos.
const VACIA = "({ id:'(no se guardo)', nombre:'(no se guardo)', estado:'(no se guardo)', fechaInicio:'', fechaFin:'', etapas:[], metas:{}, ofertas:[], criteriosElegibilidad:[], configuracion:{ sincronizarFaseComercial:{ activo:false, mapa:{} }, responsable:'' } })";

fs.mkdirSync(DESTINO, { recursive: true });

let hechos = 0;
const informe = [];
for (const familia of FAMILIAS) {
  const entrada = path.join(ORIGEN, familia + '.mjs');
  if (!fs.existsSync(entrada)) { informe.push(familia + ' -> FALTA'); continue; }
  let texto = fs.readFileSync(entrada, 'utf8');
  // Solo se sustituyen las lecturas del adaptador, nunca el veredicto.
  const antes = texto;
  texto = texto.replace(/App\.almacen\.campania\(([^)]*)\)/g, '(App.almacen.campania($1) || ' + VACIA + ')');
  // El import del arnes se resuelve a la carpeta original del equipo rojo.
  texto = texto.replace(/from '\.\/comun\.mjs'/, "from '../../agente-a/comun.mjs'");
  const cambios = antes === texto ? 0 : 1;
  const destino = path.join(DESTINO, familia + '.mjs');
  fs.writeFileSync(destino, texto, 'utf8');
  informe.push(familia + ' -> ' + (cambios ? 'blindada' : 'sin cambios necesarios'));
  hechos++;
}

console.log('Familias procesadas: ' + hechos);
informe.forEach(function(l) { console.log('  ' + l); });
console.log('\nCarpeta: ' + DESTINO);
