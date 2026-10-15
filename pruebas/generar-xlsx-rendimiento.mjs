/* generar-xlsx-rendimiento.mjs — Excel de prueba para verificar-rendimiento.mjs
 * ---------------------------------------------------------------------------
 * El arnés de rendimiento lee Excel DE VERDAD, así que necesita dos archivos:
 *     %TEMP%\formulario-500.xlsx    (500 filas)
 *     %TEMP%\formulario-5000.xlsx   (5,000 filas)
 *
 * Hasta el 14/10/2026 esos archivos los generaba un script que vivía SOLO en %TEMP%
 * (se perdía al limpiar temporales y no estaba en el repositorio), así que en una PC
 * nueva el arnés no podía correr. Este es el generador versionado.
 *
 * Uso:
 *     node pruebas\generar-xlsx-rendimiento.mjs 500
 *     node pruebas\generar-xlsx-rendimiento.mjs 5000
 *     (o los dos de una vez: node pruebas\generar-xlsx-rendimiento.mjs)
 *
 * Arma el .xlsx a mano (ZIP + deflate, sin dependencias) igual que
 * `generar-xlsx-prueba.js`, con las columnas del formulario de captación y —esto es
 * importante— con la columna de fecha como NÚMERO DE SERIE de Excel con formato de
 * fecha, que es como la exporta una hoja de cálculo de verdad. Ese detalle es el que
 * destapó el fallo de `fechaDeSerie` en el hilo aparte (@JS-LECTOR-EN-HILO-FECHAS).
 *
 * NOTA: las filas no son idénticas a las del generador perdido del 12/10, así que los
 * milisegundos medidos no se comparan uno a uno con los de aquella medición; lo que se
 * comprueba (que el hilo aparte lee bien, que la pantalla no se bloquea, que el arranque
 * hace una sola lectura) no depende del contenido exacto.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zip(archivos) {
  const locales = [], central = [];
  let offset = 0;
  archivos.forEach(function (a) {
    const nombre = Buffer.from(a.nombre, 'utf8');
    const datos = Buffer.from(a.contenido, 'utf8');
    const comp = zlib.deflateRawSync(datos);
    const crc = crc32(datos);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0, 6);
    cab.writeUInt16LE(8, 8); cab.writeUInt16LE(0, 10); cab.writeUInt16LE(0, 12);
    cab.writeUInt32LE(crc, 14); cab.writeUInt32LE(comp.length, 18); cab.writeUInt32LE(datos.length, 22);
    cab.writeUInt16LE(nombre.length, 26); cab.writeUInt16LE(0, 28);
    locales.push(cab, nombre, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(datos.length, 24);
    cen.writeUInt16LE(nombre.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36); cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nombre);
    offset += cab.length + nombre.length + comp.length;
  });
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(0, 4); fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16); fin.writeUInt16LE(0, 20);
  return Buffer.concat([Buffer.concat(locales), cd, fin]);
}

/* Tabla de textos compartidos, como la arma Excel (se llena conforme se usa). */
const compartidas = []; const idx = {};
function S(t) { if (idx[t] === undefined) { idx[t] = compartidas.length; compartidas.push(t); } return idx[t]; }
function COL(i) { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function fila(numero, valores) {
  return '<row r="' + numero + '">' + valores.map(function (v, i) {
    if (v === null || v === undefined || v === '') return '';
    const ref = COL(i) + numero;
    if (typeof v === 'object' && v.fecha) return '<c r="' + ref + '" s="1"><v>' + v.fecha + '</v></c>';
    if (typeof v === 'number') return '<c r="' + ref + '"><v>' + v + '</v></c>';
    return '<c r="' + ref + '" t="s"><v>' + S(v) + '</v></c>';
  }).join('') + '</row>';
}

function generar(filas) {
  const eventos = ['XV años', 'Boda', 'Corporativo', 'Bautizo'];
  const cuerpo = [fila(1, ['Marca temporal', 'Nombre completo', 'Teléfono', 'Correo electrónico', '¿Qué evento es?', 'Fecha del evento', 'Presupuesto', 'Comentarios'])];
  for (let i = 0; i < filas; i++) {
    const n = i + 1;
    cuerpo.push(fila(i + 2, [
      '2026-10-07 09:15:00',
      'Prospecto de prueba ' + n,
      '55 ' + String(1000 + (n % 9000)).padStart(4, '0') + ' ' + String(2000 + (n % 8000)).padStart(4, '0'),
      'prospecto' + n + '@correo.com',
      eventos[n % eventos.length],
      { fecha: 46345 + (n % 700) },       /* número de serie de Excel, con formato de fecha */
      15000 + (n % 40) * 1000,
      n % 5 === 0 ? null : 'Comentario de la fila ' + n
    ]));
  }
  const hoja1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + cuerpo.join('') + '</sheetData></worksheet>';
  const hoja2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + fila(1, ['Otra hoja']) + fila(2, ['sin datos']) + '</sheetData></worksheet>';
  const libro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Respuestas de formulario 1" sheetId="1" r:id="rId1"/><sheet name="Hoja 2" sheetId="2" r:id="rId2"/></sheets></workbook>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>';
  const estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/>' +
    '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>';
  const cadenas = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + compartidas.length + '" uniqueCount="' + compartidas.length + '">' +
    compartidas.map(function (t) { return '<si><t>' + t + '</t></si>'; }).join('') + '</sst>';

  const contenido = [
    { nombre: '[Content_Types].xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { nombre: '_rels/.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nombre: 'xl/workbook.xml', contenido: libro },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: rels },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja1 },
    { nombre: 'xl/worksheets/sheet2.xml', contenido: hoja2 },
    { nombre: 'xl/sharedStrings.xml', contenido: cadenas },
    { nombre: 'xl/styles.xml', contenido: estilos }
  ];

  const destino = path.join(os.tmpdir(), 'formulario-' + filas + '.xlsx');
  const buf = zip(contenido);
  fs.writeFileSync(destino, buf);
  console.log('escrito: ' + destino + '  (' + filas + ' filas, ' + buf.length + ' bytes)');
}

const pedidos = process.argv.slice(2).map(Number).filter(n => n > 0);
(pedidos.length ? pedidos : [500, 5000]).forEach(generar);
