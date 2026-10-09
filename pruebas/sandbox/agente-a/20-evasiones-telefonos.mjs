/* 20-evasiones-telefonos.mjs — SEGUNDA PASADA: intentar burlar el candado de teléfonos.
   Ejecutar: node pruebas\sandbox\agente-a\20-evasiones-telefonos.mjs
   Veredictos: CANDADO OK (rechazó con mensaje) · HUECO (aceptó algo incongruente en silencio)
             · ROTO (excepción) · DUPLICA (dos veces) · EXCESO (bloqueó de más: dejó sin trabajo
             al practicante con un dato que sí es legítimo). */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Evasion telefonos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);

/* ── Formatos que un practicante SÍ escribe: no deben bloquearse ── */
const LEGITIMOS = [
  ['E-01', '11 dígitos', '87812345678'],
  ['E-02', '12 dígitos con 52', '528781234567'],
  ['E-03', '13 dígitos con 521', '5218781234567'],
  ['E-04', 'formato internacional con + y espacios', '+52 878 123 4567'],
  ['E-05', 'formato con paréntesis y guiones', '(878) 123-4567'],
  ['E-07', '12 dígitos "525512345678"', '525512345678'],
  ['E-08', 'dígitos repetidos pero 10 (8787878787)', '8787878787']
];

for (const [id, etiqueta, valor] of LEGITIMOS) {
  await A({
    id, nombre: 'Teléfono legítimo: ' + etiqueta, dato: 'prospecto-telefono = ' + JSON.stringify(valor),
    esperado: 'debe guardarse tal como se escribió', gravedad: 'MEDIA',
    js: `var marca = 'REDTEAM tel ${id}';
         var r = __R.prospecto({ nombre: marca, telefono: ${JSON.stringify(valor)}, email: '', fase: 'Interesado' });
         await new Promise(function(x){ setTimeout(x, 350); });
         var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
         return { veredicto: p ? 'CANDADO OK' : 'EXCESO',
                  detalle: p ? ('guardado con telefono=' + JSON.stringify(p.telefono) + ' (formato conservado) · WhatsApp usaría ' + JSON.stringify(normalizarTelefonoWhatsApp(p.telefono)))
                             : ('NO se guardó: ' + JSON.stringify(__R.textoNotis()) + ' · el campo quedó en ' + JSON.stringify(r.leido.telefono)) };`
  });
}

/* ── Formatos que el candado nuevo sí rechaza ── */
await A({
  id: 'E-06', nombre: 'Teléfono de oficina con extensión ("878 123 4567 ext 4")', dato: 'prospecto-telefono = "878 123 4567 ext 4"',
  esperado: 'poder registrar el conmutador de la oficina', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM tel ext';
       __R.prospecto({ nombre: marca, telefono: '878 123 4567 ext 4', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: p ? 'CANDADO OK' : 'EXCESO',
                detalle: p ? 'se guardó' : ('el prospecto NO se pudo guardar: ' + JSON.stringify(__R.textoNotis()) + ' · (el candado prohíbe cualquier letra; "ext 4" es una extensión real, no basura)') };`
});

await A({
  id: 'E-09', nombre: 'Teléfono válido con letras pegadas al final ("8781234567ok")', dato: 'prospecto-telefono = "8781234567ok"',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var marca = 'REDTEAM tel letras';
       __R.prospecto({ nombre: marca, telefono: '8781234567ok', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK', detalle: p ? ('se guardó ' + JSON.stringify(p.telefono)) : ('rechazado: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'E-10', nombre: 'Teléfono con almohadilla y extensión ("8781234567 #4")', dato: 'prospecto-telefono = "8781234567 #4"',
  esperado: 'lo mismo que "ext 4" (por coherencia)', gravedad: 'BAJA',
  js: `var marca = 'REDTEAM tel almohadilla';
       __R.prospecto({ nombre: marca, telefono: '8781234567 #4', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: p ? ('SE GUARDÓ ' + JSON.stringify(p.telefono) + ' (11 dígitos: 87812345674) — el candado solo mira letras, así que "ext 4" se rechaza pero "#4" entra: es incoherente)')
                           : ('rechazado: ' + JSON.stringify(__R.textoNotis())) };`
});

/* ── Teléfono en el CLIENTE ── */
await A({
  id: 'E-11', nombre: 'Cliente con +52 y espacios', dato: 'campo-telefono = "+52 878 123 4567"',
  esperado: 'guardar el formato', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM cliente tel intl';
       __R.cliente({ nombre: marca, telefono: '+52 878 123 4567', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO', detalle: c ? ('guardado ' + JSON.stringify(c.telefono)) : ('no se guardó: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'E-12', nombre: 'Cliente con 11 dígitos', dato: 'campo-telefono = "87812345678"',
  esperado: 'guardar', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM cliente tel 11';
       __R.cliente({ nombre: marca, telefono: '87812345678', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var c = clientes.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO', detalle: c ? ('guardado ' + JSON.stringify(c.telefono)) : ('no se guardó: ' + JSON.stringify(__R.textoNotis())) };`
});

/* ── Datos VIEJOS con teléfono basura: ¿qué pasa al pulsar WhatsApp? ── */
const VIEJOS = [
  ['E-13', 'letras ("abc")', 'abc', false],
  ['E-14', 'un dígito ("1")', '1', false],
  ['E-15', 'teléfono bueno de 10 dígitos', '8781234567', true],
  ['E-16', 'emoji', '\uD83D\uDCDE\uD83D\uDCDE', false],
  ['E-17', '40 dígitos', '1234567890123456789012345678901234567890', false]
];

for (const [id, etiqueta, valor, deberiaAbrir] of VIEJOS) {
  await A({
    id, nombre: 'Dato VIEJO con teléfono ' + etiqueta + ' → pulsar WhatsApp', dato: 'cliente legado con telefono = ' + JSON.stringify(valor),
    esperado: deberiaAbrir ? 'abrir WhatsApp con el número correcto' : 'negarse con un mensaje claro', gravedad: 'ALTA',
    js: `var c = __R.legacyCliente({ nombre: 'Legado ${id}', telefono: ${JSON.stringify(valor)} });
         var url = __R.waUrl(c.id);
         await new Promise(function(x){ setTimeout(x, 250); });
         var abrio = !!url;
         var notis = __R.textoNotis();
         return { veredicto: (abrio === ${deberiaAbrir}) ? 'CANDADO OK' : 'HUECO',
                  detalle: 'URL que la app abriría=' + JSON.stringify(url) + ' · esperado abrir=' + ${deberiaAbrir} + ' · avisos: ' + JSON.stringify(notis) };`
  });
}

/* ── Datos viejos: ¿se puede seguir trabajando con ellos? ── */
await A({
  id: 'E-18', nombre: 'Editar un CLIENTE viejo con teléfono basura, cambiando solo el nombre', dato: 'cliente legado telefono="abc", se edita el nombre',
  esperado: 'debe poder corregirse el nombre (y avisar del teléfono)', gravedad: 'MEDIA',
  js: `var c = __R.legacyCliente({ nombre: 'Legado nombre', telefono: 'abc', email: '', estado: 'Activo' });
       CRUD.clientes.editar(c.id);
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.pon('campo-nombre', 'Legado nombre corregido');
       __R.enviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 450); });
       var viva = clientes.filter(function(x){ return x.id === c.id; })[0];
       var notis = __R.textoNotis();
       return { veredicto: (viva.nombre === 'Legado nombre corregido') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'nombre quedó ' + JSON.stringify(viva.nombre) + ' · teléfono ' + JSON.stringify(viva.telefono) + ' · avisos: ' + JSON.stringify(notis) };`
});

await A({
  id: 'E-19', nombre: 'Editar un PROSPECTO viejo con teléfono basura, cambiando solo la ciudad', dato: 'prospecto legado telefono="abc", motor.actualizarProspecto({ciudad})',
  esperado: 'debe poder editarse lo demás', gravedad: 'MEDIA',
  js: `var p = __R.legacyProspecto({ nombre: 'Legado prospecto', telefono: 'abc', email: '', faseActual: 'Interesado' });
       var r = App.motor.actualizarProspecto(p.id, { ciudad: 'Colima' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var viva = prospectos.filter(function(x){ return x.id === p.id; })[0];
       return { veredicto: r.ok ? 'CANDADO OK' : 'EXCESO',
                detalle: 'ok=' + r.ok + ' errores=' + JSON.stringify(r.errores || []) + ' · ciudad quedó ' + JSON.stringify(viva.ciudad) + ' (el prospecto viejo queda congelado: no se le puede editar nada sin antes arreglar su teléfono)' };`
});

await A({
  id: 'E-20', nombre: 'Convertir a cliente un prospecto viejo con teléfono basura', dato: 'prospecto legado telefono="abc" → convertirProspecto',
  esperado: 'debe poder convertirse (o avisar)', gravedad: 'MEDIA',
  js: `var p = __R.legacyProspecto({ nombre: 'Legado convertible', telefono: 'abc', email: '', faseActual: 'Interesado' });
       var antes = clientes.length;
       convertirProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 350); });
       var creado = clientes.length - antes;
       var c = clientes.filter(function(x){ return x.nombre === 'Legado convertible'; })[0];
       return { veredicto: creado ? 'CANDADO OK' : 'EXCESO',
                detalle: 'clientes creados=' + creado + ' · teléfono del cliente nuevo=' + JSON.stringify(c ? c.telefono : null) + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

/* ── Importador de archivos ── */
const IMPORT = [
  ['E-21', '11 dígitos', '87812345678', true],
  ['E-22', 'formato +52 con espacios', '+52 878 123 4567', true],
  ['E-23', '40 dígitos', '9998887776665554443332221110009998887776', false],
  ['E-24', 'con letras', 'llamar al 878', false],
  ['E-25', 'un solo dígito', '1', false]
];

for (const [id, etiqueta, valor, deberiaEntrar] of IMPORT) {
  await A({
    id, nombre: 'Importador con teléfono ' + etiqueta, dato: 'CSV telefono = ' + JSON.stringify(valor),
    esperado: deberiaEntrar ? 'entra el prospecto' : 'la fila se rechaza', gravedad: 'MEDIA',
    js: `var marca = 'REDTEAM imp ${id}';
         var texto = 'Nombre\\tTelefono\\n' + marca + '\\t' + ${JSON.stringify(valor)};
         var r = __R.importarTexto(texto, '${id}.csv');
         await new Promise(function(x){ setTimeout(x, 400); });
         var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
         var entro = !!p;
         return { veredicto: (entro === ${deberiaEntrar}) ? 'CANDADO OK' : 'HUECO',
                  detalle: 'análisis=' + JSON.stringify(r.analisis) + ' · creados=' + r.creados + ' · entró=' + entro + ' · teléfono guardado=' + JSON.stringify(p ? p.telefono : null) + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

await A({
  id: 'E-26', nombre: 'Importador: el mismo teléfono basura no debe colarse por otra columna', dato: 'CSV con "Telefono" y "Celular" (dos columnas al mismo campo)',
  esperado: 'rechazo o al menos no guardar el basura', gravedad: 'MEDIA',
  js: `var marca = 'REDTEAM imp doble col';
       var texto = 'Nombre\\tTelefono\\tCelular\\n' + marca + '\\t8781234567\\tabcdefghij';
       var r = __R.importarTexto(texto, 'doble.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
       return { veredicto: p ? 'CANDADO OK' : 'HUECO',
                detalle: 'entró=' + !!p + ' · teléfono=' + JSON.stringify(p ? p.telefono : null) + ' · notas=' + JSON.stringify(p ? p.notasGenerales : null) + ' · (la 2ª columna al mismo campo va a notas, no al teléfono) · análisis=' + JSON.stringify(r.analisis) };`
});

/* ── Asimetría: teléfono repetido en PROSPECTOS (el cliente sí avisa) ── */
await A({
  id: 'E-27', nombre: 'Dos PROSPECTOS con el mismo teléfono y nombre distinto', dato: 'prospecto A tel 8781234599 y prospecto B tel 8781234599',
  esperado: 'avisar del teléfono repetido (como hace el cliente)', gravedad: 'MEDIA',
  js: `__R.prospecto({ nombre: 'REDTEAM tel compartido A', telefono: '8781234599', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.limpiarNotis();
       __R.prospecto({ nombre: 'REDTEAM tel compartido B', telefono: '8781234599', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var cuantos = prospectos.filter(function(x){ return x.telefono === '8781234599'; }).length;
       return { veredicto: cuantos > 1 ? 'HUECO' : 'CANDADO OK',
                detalle: 'prospectos con ese teléfono = ' + cuantos + ' · avisos al guardar el 2º: ' + JSON.stringify(__R.textoNotis()) + ' · (el formulario del cliente SÍ avisa de teléfono repetido con telefonoYaRegistrado; el del prospecto no lo usa)' };`
});

await A({
  id: 'E-28', nombre: 'Un PROSPECTO con el teléfono de un CLIENTE existente', dato: 'prospecto tel = el de Cliente Base Uno (8781112233)',
  esperado: 'avisar', gravedad: 'BAJA',
  js: `var cli = clientes[0];
       __R.prospecto({ nombre: 'REDTEAM tel de cliente', telefono: cli.telefono, email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM tel de cliente'; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: 'se guardó=' + !!p + ' · avisos: ' + JSON.stringify(__R.textoNotis()) + ' · (telefonoYaRegistrado existe y cruza prospectos y clientes, pero el formulario de prospecto no lo llama)' };`
});

const res = await guardar(caja, '20-evasiones-telefonos');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
