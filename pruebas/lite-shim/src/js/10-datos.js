/* Imita a la lite: carga su 10-datos.js de verdad (Util, Catalogos, SemillaDemo y crearAlmacen).
   Ese archivo es el que arma los datos de prueba y el almacen que el motor espera.

   La carpeta del CRM Lite vive en lugares distintos en cada PC, asi que aqui se
   buscan varias rutas. Se puede forzar con la variable de entorno CRM_LITE:
       set CRM_LITE=C:\ruta\a\CRM Lite Campanas
*/
const fs = require('fs');
const path = require('path');
const os = require('os');

const candidatos = [];
if (process.env.CRM_LITE) candidatos.push(process.env.CRM_LITE);
/* Junto al repositorio del CRM (mismo padre que crm-pda). */
candidatos.push(path.join(__dirname, '..', '..', '..', '..', 'CRM Lite Campanas'));
/* En Documentos del usuario (como quedaron las dos PCs). */
candidatos.push(path.join(os.homedir(), 'Documents', 'CRM Lite Campanas'));
candidatos.push(path.join(os.homedir(), 'Documents', 'DeepSeek', 'CRM Lite Campanas'));
candidatos.push(path.join(os.homedir(), 'Documentos', 'CRM Lite Campanas'));

let encontrado = null;
for (const base of candidatos) {
    const archivo = path.join(base, 'src', 'js', '10-datos.js');
    if (fs.existsSync(archivo)) { encontrado = archivo; break; }
}

if (!encontrado) {
    console.error('');
    console.error('  No encontre la carpeta del CRM Lite (necesito su src\\js\\10-datos.js).');
    console.error('  Busque en:');
    candidatos.forEach(function (c) { console.error('    - ' + c); });
    console.error('');
    console.error('  Solucion: define la ruta a mano, por ejemplo:');
    console.error('    set CRM_LITE=C:\\Users\\tu_usuario\\Documents\\CRM Lite Campanas');
    console.error('');
    process.exit(1);
}

require(encontrado);
