/* 03-telefonos.mjs — FAMILIA 2: TELÉFONOS.
   Letras, 1 dígito, 40 dígitos, solo '+', espacios/guiones, repetido, emoji y el
   enlace de WhatsApp con teléfono basura. */
import { abrirCaja, ataque, guardar } from '../../agente-a/comun.mjs';

const caja = await abrirCaja({ familia: 'Teléfonos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;

const CASOS = [
  ['T-01', 'letras', 'abc'],
  ['T-02', 'un solo dígito', '1'],
  ['T-03', '40 dígitos', '1234567890123456789012345678901234567890'],
  ['T-04', 'solo el signo +', '+'],
  ['T-05', 'solo espacios', '   '],
  ['T-06', 'número repetido', '1111111111'],
  ['T-07', 'emoji', '\uD83D\uDCDE\uD83D\uDCDE'],
  ['T-08', 'con guiones y espacios', '878-123-4567'],
  ['T-09', 'letras y números mezclados', 'llamar al 878 luego 1234567']
];

for (const [id, etiqueta, valor] of CASOS) {
  await A({
    id, nombre: 'Prospecto con teléfono ' + etiqueta, dato: 'prospecto-telefono = ' + JSON.stringify(valor),
    esperado: 'rechazo o normalización del teléfono', gravedad: (id === 'T-01' || id === 'T-03' || id === 'T-06' || id === 'T-09') ? 'MEDIA' : 'BAJA',
    js: `var marca = 'REDTEAM tel ${id}';
         __R.tarea; // no-op
         var n0 = prospectos.length;
         __R.prospecto({ nombre: marca, telefono: ${JSON.stringify(valor)}, email: '', fase: 'Interesado' });
         await new Promise(function(x){ setTimeout(x, 300); });
         var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
         if (!p) return { veredicto: 'CANDADO OK', detalle: 'No se guardó. app: ' + JSON.stringify(__R.textoNotis()) };
         var wa = normalizarTelefonoWhatsApp(p.telefono);
         return { veredicto: 'HUECO',
                  detalle: 'guardado telefono=' + JSON.stringify(p.telefono) + ' · WhatsApp lo usaría como ' + JSON.stringify(wa) + ' (wa.me/' + wa + ') · prospectos ' + n0 + ' → ' + prospectos.length };`
  });
}

await A({
  id: 'T-10', nombre: 'Cliente (CRUD) con teléfono basura "abc"', dato: 'campo-telefono = "abc"',
  esperado: 'rechazo por teléfono inválido', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM cliente tel';
       __R.cliente({ nombre: marca, telefono: 'abc', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       return c ? { veredicto: 'HUECO', detalle: 'cliente guardado con telefono=' + JSON.stringify(c.telefono) + ' · botón WhatsApp del listado: ' + (normalizarTelefonoWhatsApp(c.telefono) ? 'HABILITADO' : 'deshabilitado') }
                : { veredicto: 'CANDADO OK', detalle: 'no se guardó · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'T-11', nombre: 'Editar un cliente y ponerle el teléfono en basura', dato: 'campo-telefono = "##########"',
  esperado: 'rechazo al editar', gravedad: 'MEDIA',
  js: `CRUD.clientes.editar('${cli}');
       await new Promise(function(x){ setTimeout(x, 200); });
       __R.pon('campo-telefono', '##########');
       __R.enviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       return { veredicto: c.telefono === '##########' ? 'HUECO' : 'CANDADO OK',
                detalle: 'telefono del cliente quedó ' + JSON.stringify(c.telefono) + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'T-12', nombre: 'WhatsApp con teléfono basura de 1 dígito', dato: 'telefono del cliente = "1"',
  esperado: 'la app debería negarse a abrir el enlace', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM wa basura';
       __R.cliente({ nombre: marca, telefono: '1', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 200); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       var url = __R.waUrl(c.id);
       return { veredicto: url ? 'HUECO' : 'CANDADO OK',
                detalle: 'URL que la app abriría: ' + JSON.stringify(url) + ' · app dijo: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'T-13', nombre: 'WhatsApp con teléfono emoji', dato: 'telefono del cliente = "📞📞"',
  esperado: 'bloqueo', gravedad: 'BAJA',
  js: `var marca = 'REDTEAM wa emoji';
       __R.cliente({ nombre: marca, telefono: '\uD83D\uDCDE\uD83D\uDCDE', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 200); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       var url = __R.waUrl(c.id);
       return { veredicto: url ? 'HUECO' : 'CANDADO OK',
                detalle: 'guardado telefono=' + JSON.stringify(c.telefono) + ' · URL: ' + JSON.stringify(url) + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'T-14', nombre: 'WhatsApp con teléfono "1111111111" (repetido)', dato: 'telefono = "1111111111"',
  esperado: 'bloqueo o aviso', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM wa repetido';
       __R.cliente({ nombre: marca, telefono: '1111111111', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 200); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       var url = __R.waUrl(c.id);
       return { veredicto: url ? 'HUECO' : 'CANDADO OK', detalle: 'URL: ' + JSON.stringify(url) };`
});

await A({
  id: 'T-15', nombre: 'Importar prospecto con teléfono de 40 dígitos', dato: 'CSV telefono=9998887776665554443332221110009998887776',
  esperado: 'recorte o rechazo', gravedad: 'MEDIA',
  js: `var texto = 'Nombre\\tTelefono\\nREDTEAM import tel\\t9998887776665554443332221110009998887776';
       var r = __R.importarTexto(texto, 'tel.csv');
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM import tel'; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: p ? ('creados=' + r.creados + ' · telefono guardado de ' + p.telefono.length + ' caracteres: ' + JSON.stringify(p.telefono)) : ('no se creó · analisis=' + JSON.stringify(r.analisis)) };`
});

const res = await guardar(caja, '03-telefonos');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO ? 1 : 0;
