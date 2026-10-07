/*
 * servir.mjs — Servidor local mínimo para probar el CRM en el navegador.
 * ---------------------------------------------------------------------------
 * Para qué: Firebase Auth (login con Google) NO funciona abriendo el archivo
 * con doble clic (origen `file://`): necesita http(s). Este servidor sirve la
 * carpeta del repositorio para poder entrar desde la PC y, sobre todo, para
 * probar el comportamiento en un móvil de la misma red.
 *
 * Uso:
 *   node pruebas\servir.mjs            -> puerto 8095, escucha en toda la red
 *   node pruebas\servir.mjs 9000       -> otro puerto
 *
 * Nota: `localhost` ya está autorizado en Firebase por defecto; si entras desde
 * el teléfono por IP de la red, esa IP debe estar autorizada en Firebase
 * (Authentication -> Settings -> Authorized domains).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2] || 8095);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

const servidor = http.createServer((peticion, respuesta) => {
  let ruta = decodeURIComponent(peticion.url.split('?')[0]);

  // El teléfono manda aquí el resultado de la medición de arranque y se guarda como texto.
  if (peticion.method === 'POST' && ruta === '/medicion') {
    let cuerpo = '';
    peticion.on('data', t => { cuerpo += t; });
    peticion.on('end', () => {
      try {
        const destino = path.join(RAIZ, 'pruebas', 'mediciones-movil.json');
        let previas = [];
        try { previas = JSON.parse(fs.readFileSync(destino, 'utf8')); } catch (e) { previas = []; }
        if (!Array.isArray(previas)) previas = [];
        previas.push(JSON.parse(cuerpo));
        fs.writeFileSync(destino, JSON.stringify(previas, null, 2), 'utf8');
        console.log('Medición recibida del teléfono: ' + cuerpo.slice(0, 300));
      } catch (e) { console.warn('No se pudo guardar la medición: ' + e.message); }
      respuesta.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('ok');
    });
    return;
  }

  if (ruta === '/' || ruta.endsWith('/')) ruta += 'index.html';
  const destino = path.resolve(RAIZ, '.' + ruta);
  // Nunca salir de la carpeta del proyecto.
  if (!destino.startsWith(RAIZ)) { respuesta.writeHead(403).end('Fuera del proyecto'); return; }
  fs.readFile(destino, (err, datos) => {
    if (err) {
      // Ruta sin extensión -> se intenta el index (comodidad para /pruebas/).
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('No encontrado: ' + ruta);
      return;
    }
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      // Sin caché: al editar se ve el cambio con recargar, sin trucos.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    respuesta.end(datos);
  });
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log('CRM en este equipo:  http://127.0.0.1:' + PUERTO + '/index.html');
  const redes = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  redes.forEach(ip => console.log('Desde el móvil:      http://' + ip + ':' + PUERTO + '/index.html'));
  console.log('\nCerrar: Ctrl+C\n');
});
