/* Arma un archivo .ods de prueba (LibreOffice) reutilizando el content.xml de un
   ODS de verdad, dentro de un ZIP mínimo (mimetype + content.xml + manifiesto).
   Sirve para regenerar el archivo que la prueba lleva incrustado en base64.

   Uso:  node pruebas/generar-ods-minimo.js <ods-de-entrada> <ods-de-salida>

   Si no se le pasa entrada, usa el .ods que haya en esta carpeta; si no hay,
   genera el content.xml a mano (estructura mínima de ODF con texto, número y fecha).
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const AQUI = __dirname;
const entrada = process.argv[2] || path.join(AQUI, 'datos-para-ods.ods');
const salida = process.argv[3] || path.join(AQUI, 'datos-ods-minimo.ods');

/* ── ZIP mínimo (con deflate real), sin dependencias ── */
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

/* ── content.xml: del ODS de entrada, o uno mínimo hecho a mano ── */
function contentDeEjemplo() {
    const fila = (n, celdas) => '<table:table-row>' + celdas + '</table:table-row>';
    const txt = t => '<table:table-cell office:value-type="string"><text:p>' + t + '</text:p></table:table-cell>';
    const num = n => '<table:table-cell office:value-type="float" office:value="' + n + '"><text:p>' + n + '</text:p></table:table-cell>';
    const fecha = f => '<table:table-cell office:value-type="date" office:date-value="' + f + '"><text:p>' + f + '</text:p></table:table-cell>';
    return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
        'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
        'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">' +
        '<office:body><office:spreadsheet>' +
        '<table:table table:name="Respuestas"><table:table-column table:number-columns-repeated="8"/>' +
        fila(1, [txt('Marca temporal'), txt('Nombre completo'), txt('Teléfono'), txt('Correo electrónico'), txt('¿Qué evento es?'), txt('Fecha del evento'), txt('Presupuesto'), txt('Comentarios')].join('')) +
        fila(2, [fecha('2026-10-07T09:15:00'), txt('Ana López Ruiz'), txt('55 4444 5555'), txt('ana@correo.com'), txt('XV años'), fecha('2027-03-20'), num(45000), txt('Ya me había escrito')].join('')) +
        fila(3, [fecha('2026-10-07T09:20:00'), txt('Beatriz Núñez'), txt('55 7777 8888'), txt('bea@correo.com'), txt('Boda'), fecha('2027-05-10'), num(85000), txt('Quiere ver el paquete Platinum')].join('')) +
        '</table:table></office:spreadsheet></office:body></office:document-content>';
    }

let content = null;
if (fs.existsSync(entrada)) {
    try {
        require(path.join(AQUI, '..', 'index.html')); /* no aplica: el módulo vive dentro del HTML */
    } catch (e) { }
    /* Se saca el content.xml con el lector del propio CRM (si está disponible como módulo). */
    const modulo = path.join(AQUI, '..', 'index.html');
    try {
        const html = fs.readFileSync(modulo, 'utf8');
        const trozo = html.slice(html.indexOf('@JS-IMPORTAR-PROSPECTOS'));
        const codigo = trozo.slice(trozo.indexOf('(function (raiz)'), trozo.indexOf('})(typeof window'));
        /* Ejecuta solo el módulo del importador dentro de este proceso. */
        const fn = new Function('raiz', 'module', 'exports', 'require', '__dirname', codigo + '})(globalThis);');
        fn(globalThis, module, exports, require, __dirname);
        const api = globalThis.ImportarProspectos;
        const b = fs.readFileSync(entrada);
        const zipEntrada = api.leerZip(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
        content = zipEntrada.texto('content.xml');
        console.log('content.xml tomado del ODS de entrada (' + content.length + ' caracteres).');
    } catch (e) {
        console.log('No pude leer el ODS de entrada (' + e.message + '): uso el contenido de ejemplo.');
    }
} else {
    console.log('No hay ODS de entrada en ' + entrada + ': uso el contenido de ejemplo.');
}
if (!content) content = contentDeEjemplo();

const manifiesto = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
    '<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>' +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    '</manifest:manifest>';

const ods = zip([
    { nombre: 'mimetype', contenido: 'application/vnd.oasis.opendocument.spreadsheet' },
    { nombre: 'content.xml', contenido: content },
    { nombre: 'META-INF/manifest.xml', contenido: manifiesto }
]);
fs.writeFileSync(salida, ods);
fs.writeFileSync(salida.replace(/\.ods$/, '.b64.txt'), ods.toString('base64'));
console.log('escrito: ' + salida + '  (' + ods.length + ' bytes) y su base64 (' + ods.toString('base64').length + ' caracteres).');

/* Comprobación con el lector del CRM, si quedó disponible */
try {
    const api = globalThis.ImportarProspectos;
    if (api) {
        const leido = api.leerBuffer(path.basename(salida), ods.buffer.slice(ods.byteOffset, ods.byteOffset + ods.byteLength));
        console.log('el lector del CRM lo abre: ' + JSON.stringify(leido.map(h => h.nombre)) + ' · primera fila: ' + JSON.stringify((leido[0].filas[0] || []).slice(0, 4)));
    }
} catch (e) { console.log('(no se pudo comprobar con el lector: ' + e.message + ')'); }
