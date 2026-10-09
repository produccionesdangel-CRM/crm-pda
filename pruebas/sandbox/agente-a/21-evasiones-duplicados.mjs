/* 21-evasiones-duplicados.mjs — SEGUNDA PASADA: burlar la detección de duplicados.
   Ejecutar: node pruebas\sandbox\agente-a\21-evasiones-duplicados.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Evasion duplicados' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

/* ── Preparación de bases (por los formularios reales) ── */
await A({
  id: 'D-00', nombre: 'Base: 4 prospectos y 4 clientes de referencia', dato: 'bases con teléfono, con guiones, con doble espacio y con acento',
  esperado: 'bases listas', gravedad: 'BAJA', espera: 2600,
  js: `var basesP = [
         ['Duplicado Uno', '8781110001'],
         ['José Ramírez', '8781110002'],
         ['Marta  Solís', '8781110003'],
         ['Ana Tres', '878-111-0004']
       ];
       basesP.forEach(function(b){ __R.prospecto({ nombre: b[0], telefono: b[1], email: '', fase: 'Interesado' }); });
       await new Promise(function(x){ setTimeout(x, 900); });
       var basesC = [
         ['Cliente Dup Uno', '8782220001'],
         ['Cliente Dup Úno', '8782220002'],
         ['Cliente  Dup Dos', '8782220003'],
         ['Cliente Dup Cuatro', '878-222-0004']
       ];
       basesC.forEach(function(b){ __R.cliente({ nombre: b[0], telefono: b[1], email: '', estado: 'Activo' }); });
       await new Promise(function(x){ setTimeout(x, 1100); });
       return { veredicto: 'CANDADO OK',
                detalle: 'prospectos: ' + JSON.stringify(basesP.map(function(b){ return b[0]; })) + ' · clientes: ' + JSON.stringify(basesC.map(function(b){ return b[0]; })) };`
});

/* ── PROSPECTOS ── */
const CASOS_P = [
  ['D-01', 'mismo nombre en MAYÚSCULAS', 'DUPLICADO UNO', '8781110001', true],
  ['D-02', 'mismo nombre sin acentos ("JOSE RAMIREZ" contra "José Ramírez")', 'JOSE RAMIREZ', '8781110002', false],
  ['D-03', 'mismo nombre con UN espacio donde había DOBLE ("Marta Solís" contra "Marta  Solís")', 'Marta Solís', '8781110003', false],
  ['D-04', 'mismo teléfono pero ESCRITO CON GUIONES ("878-111-0001" contra "8781110001")', 'Duplicado Uno', '878-111-0001', false],
  ['D-05', 'al revés: el que ya existe tiene guiones y el nuevo no ("8781110004")', 'Ana Tres', '8781110004', true],
  ['D-06', 'mismo nombre con espacios SOBRANTES al inicio y al final', '   Duplicado Uno   ', '8781110001', true],
  ['D-07', 'mismo nombre con teléfono DISTINTO (puede ser otra persona)', 'Duplicado Uno', '8789990009', false]
];

for (const [id, etiqueta, nombre, telefono, esperaAviso] of CASOS_P) {
  await A({
    id, nombre: 'Prospecto duplicado: ' + etiqueta, dato: 'nombre=' + JSON.stringify(nombre) + ', telefono=' + JSON.stringify(telefono),
    esperado: esperaAviso ? 'aviso de posible duplicado (confirmación)' : 'decisión consciente del CRM', gravedad: 'ALTA', espera: 900,
    js: `__R.limpiarNotis();
         __R.prospecto({ nombre: ${JSON.stringify(nombre)}, telefono: ${JSON.stringify(telefono)}, email: '', fase: 'Interesado' });
         await new Promise(function(x){ setTimeout(x, 300); });
         var hayConfirmacion = __R.hayConfirmacion();
         var textoModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 160);
         if (hayConfirmacion) __R.cancelarFinanciero();
         await new Promise(function(x){ setTimeout(x, 300); });
         var cuantos = prospectos.filter(function(x){ return String(x.nombre||'').trim().toLowerCase() === ${JSON.stringify(nombre)}.trim().toLowerCase(); }).length;
         var mismoTel = prospectos.filter(function(x){ return soloDigitosTelefono(x.telefono) === soloDigitosTelefono(${JSON.stringify(telefono)}); }).length;
         return { veredicto: (hayConfirmacion === ${esperaAviso}) ? 'CANDADO OK' : 'HUECO',
                  detalle: 'el CRM pidió confirmación=' + hayConfirmacion + ' (se esperaba ' + ${esperaAviso} + ') · prospectos con ese nombre=' + cuantos + ' · prospectos con ese teléfono=' + mismoTel +
                           ' · el modal decía: "' + textoModal + '" · SIN aviso, el practicante puede acabar de crear el duplicado con un clic más' };`
  });
}

/* ── CLIENTES ── */
const CASOS_C = [
  ['D-08', 'mismo nombre en MAYÚSCULAS', 'CLIENTE DUP UNO', '8783330001', true],
  ['D-09', 'mismo nombre sin acentos ("CLIENTE DUP UNO" contra "Cliente Dup Úno")', 'CLIENTE DUP UNO', '8783330002', false],
  ['D-10', 'mismo nombre con UN espacio donde había DOBLE ("Cliente Dup Dos" contra "Cliente  Dup Dos")', 'Cliente Dup Dos', '8783330003', false],
  ['D-11', 'mismo teléfono pero escrito distinto (con guiones contra sin guiones)', 'Otro Cliente Distinto', '878222-0001', true]
];

for (const [id, etiqueta, nombre, telefono, esperaAviso] of CASOS_C) {
  await A({
    id, nombre: 'Cliente duplicado: ' + etiqueta, dato: 'nombre=' + JSON.stringify(nombre) + ', telefono=' + JSON.stringify(telefono),
    esperado: esperaAviso ? 'aviso (confirmación)' : 'decisión consciente', gravedad: 'ALTA', espera: 1000,
    js: `__R.limpiarNotis();
         __R.cliente({ nombre: ${JSON.stringify(nombre)}, telefono: ${JSON.stringify(telefono)}, email: '', estado: 'Activo' });
         await new Promise(function(x){ setTimeout(x, 350); });
         var hayConfirmacion = __R.hayConfirmacion();
         var textoModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 180);
         if (hayConfirmacion) __R.cancelarFinanciero();
         await new Promise(function(x){ setTimeout(x, 300); });
         var cuantos = clientes.filter(function(x){ return String(x.nombre||'').trim().toLowerCase() === ${JSON.stringify(nombre)}.trim().toLowerCase(); }).length;
         return { veredicto: (hayConfirmacion === ${esperaAviso}) ? 'CANDADO OK' : 'HUECO',
                  detalle: 'el CRM pidió confirmación=' + hayConfirmacion + ' (se esperaba ' + ${esperaAviso} + ') · clientes con ese nombre=' + cuantos + ' · modal: "' + textoModal + '"' };`
  });
}

/* ── TAREAS ── */
await A({
  id: 'D-12', nombre: 'Base de tarea para las pruebas de repetición', dato: 'tarea Llamar 2029-05-05 «Redteam repetida»',
  esperado: 'base lista', gravedad: 'BAJA', espera: 700,
  js: `__R.tarea({ tipo: 'Llamar', fecha: '2029-05-05', descripcion: 'Redteam repetida', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 500); });
       return { veredicto: tareas.filter(function(t){ return t.descripcion === 'Redteam repetida'; }).length ? 'CANDADO OK' : 'ROTO',
                detalle: 'tareas creadas=' + tareas.filter(function(t){ return t.descripcion === 'Redteam repetida'; }).length };`
});

const CASOS_T = [
  ['D-13', 'descripción en MAYÚSCULAS', 'REDTEAM REPETIDA', true],
  ['D-14', 'mismo texto sin acentos («Redteam repetida» contra «Redteam répètida»)', 'Redteam répètida', false],
  ['D-15', 'mismo texto con espacio DOBLE («Redteam  repetida»)', 'Redteam  repetida', false]
];

for (const [id, etiqueta, desc, esperaAviso] of CASOS_T) {
  await A({
    id, nombre: 'Tarea repetida: ' + etiqueta, dato: 'tipo=Llamar, fecha=2029-05-05, desc=' + JSON.stringify(desc),
    esperado: esperaAviso ? 'aviso de tarea repetida' : 'decisión consciente', gravedad: 'MEDIA', espera: 900,
    js: `__R.limpiarNotis();
         __R.tarea({ tipo: 'Llamar', fecha: '2029-05-05', descripcion: ${JSON.stringify(desc)}, clienteId: '${cli}' });
         await new Promise(function(x){ setTimeout(x, 320); });
         var hayConfirmacion = __R.hayConfirmacion();
         if (hayConfirmacion) __R.cancelarFinanciero();
         await new Promise(function(x){ setTimeout(x, 300); });
         var cuantas = tareas.filter(function(t){ return t.fecha === '2029-05-05' && t.tipo === 'Llamar' && String(t.descripcion||'').toLowerCase() === ${JSON.stringify(desc)}.toLowerCase(); }).length;
         return { veredicto: (hayConfirmacion === ${esperaAviso}) ? 'CANDADO OK' : 'HUECO',
                  detalle: 'pidió confirmación=' + hayConfirmacion + ' (se esperaba ' + ${esperaAviso} + ') · tareas iguales guardadas=' + cuantas + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
  });
}

/* ── CONTRATOS: mismo festejado ── */
await A({
  id: 'D-16', nombre: 'Contrato con el MISMO festejado y la MISMA fecha y paquete', dato: 'festejado «Festejada Dup» 2029-03-03 paquete base',
  esperado: 'aviso de contrato gemelo', gravedad: 'ALTA', espera: 1800,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'Festejada Dup', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-03-03', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 600); });
       var antes = __R.contratosConFestejado('Festejada Dup').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'Festejada Dup', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-03-03', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var hayConfirmacion = __R.hayConfirmacion();
       var textoModal = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 180);
       if (hayConfirmacion) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 400); });
       var despues = __R.contratosConFestejado('Festejada Dup').length;
       return { veredicto: hayConfirmacion ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratos con ese festejado: ' + antes + ' → ' + despues + ' · pidió confirmación=' + hayConfirmacion + ' · modal: "' + textoModal + '"' };`
});

await A({
  id: 'D-17', nombre: 'Contrato con el MISMO festejado pero FECHA DISTINTA', dato: 'festejado «Festejada Dup» 2029-04-04 (misma persona, otra fecha)',
  esperado: 'al menos avisar (una fecha mal tecleada esquiva el aviso de gemelo)', gravedad: 'ALTA', espera: 1200,
  js: `var antes = __R.contratosConFestejado('Festejada Dup').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'Festejada Dup', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2029-04-04', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var hayConfirmacion = __R.hayConfirmacion();
       if (hayConfirmacion) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 400); });
       var despues = __R.contratosConFestejado('Festejada Dup').length;
       return { veredicto: hayConfirmacion ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratos con ese festejado: ' + antes + ' → ' + despues + ' · pidió confirmación=' + hayConfirmacion + ' · avisos: ' + JSON.stringify(__R.textoNotis()) +
                         ' · (el aviso de gemelo exige misma fecha Y mismo paquete: una fecha distinta lo esquiva)' };`
});

/* ── IMPORTADOR: el contraste (sí dobla acentos) ── */
await A({
  id: 'D-18', nombre: 'Importador: el mismo prospecto con el nombre en MAYÚSCULAS y sin acentos', dato: 'CSV «JOSE RAMIREZ» con el teléfono de «José Ramírez»',
  esperado: 'debe detectar el duplicado (como ya sabe hacer el importador)', gravedad: 'MEDIA', espera: 900,
  js: `var texto = 'Nombre\\tTelefono\\nJOSE RAMIREZ\\t8781110002';
       var r = __R.importarTexto(texto, 'dup.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var cuantos = prospectos.filter(function(x){ return soloDigitosTelefono(x.telefono) === '8781110002'; }).length;
       return { veredicto: (r.creados === 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'creados=' + r.creados + ' · análisis=' + JSON.stringify(r.analisis) + ' · prospectos con ese teléfono=' + cuantos +
                         ' · (el importador usa sinAcentos()+claveNombre() y SÍ lo detecta; el formulario compara texto crudo y NO lo detecta: D-02)' };`
});

const res = await guardar(caja, '21-evasiones-duplicados');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
