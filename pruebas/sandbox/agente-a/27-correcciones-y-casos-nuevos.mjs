/* 27-correcciones-y-casos-nuevos.mjs — SEGUNDA PASADA, ronda corregida.
   Aquí van (a) las comprobaciones de 20/21/22 cuyo veredicto salió mal por un defecto de MI
   prueba (teléfonos que chocaban entre casos, expectativas invertidas, nombres repetidos)
   y (b) casos nuevos que faltaban.
   Ejecutar: node pruebas\sandbox\agente-a\27-correcciones-y-casos-nuevos.mjs */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Correcciones y casos nuevos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

/* ── (1) Los que salieron EXCESO/HUECO por choque de teléfonos entre mis propios casos ──
   Ahora cada uno usa un número que no existe en ninguna otra parte de la prueba. ── */

await A({
  id: 'Y-01', nombre: '[E-11 corregido] Cliente con teléfono internacional único (+52 ...)', dato: 'campo-telefono = "+52 555 000 1111"',
  esperado: 'guardar el formato', gravedad: 'MEDIA', espera: 900,
  js: `__R.limpiarNotis();
       __R.cliente({ nombre: 'REDTEAM cliente intl unico', telefono: '+52 555 000 1111', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var hay = __R.hayConfirmacion();
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 130);
       if (hay) __R.confirmarFinanciero();
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM cliente intl unico'; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO',
                detalle: 'guardado=' + !!c + ' con telefono=' + JSON.stringify(c ? c.telefono : null) + ' · ¿pidió confirmación por teléfono repetido?=' + hay + (hay ? (' ("' + texto + '")') : '') };`
});

await A({
  id: 'Y-02', nombre: '[E-12 corregido] Cliente con 11 dígitos único', dato: 'campo-telefono = "55500022222"',
  esperado: 'guardar', gravedad: 'MEDIA', espera: 900,
  js: `__R.limpiarNotis();
       __R.cliente({ nombre: 'REDTEAM cliente 11 unico', telefono: '55500022222', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.confirmarFinanciero();
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM cliente 11 unico'; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO', detalle: 'guardado=' + !!c + ' con telefono=' + JSON.stringify(c ? c.telefono : null) + ' · confirmación=' + hay };`
});

await A({
  id: 'Y-03', nombre: '[E-21/E-22 corregido] Importador con 11 dígitos y con +52 únicos', dato: 'CSV con 55500033333 y "+52 555 000 4444"',
  esperado: 'las dos filas entran', gravedad: 'MEDIA', espera: 900,
  js: `var texto = 'Nombre\\tTelefono\\nREDTEAM imp once unico\\t55500033333\\nREDTEAM imp intl unico\\t+52 555 000 4444';
       var r = __R.importarTexto(texto, 'unicos.csv');
       await new Promise(function(x){ setTimeout(x, 450); });
       var a = prospectos.filter(function(x){ return x.nombre === 'REDTEAM imp once unico'; })[0];
       var b = prospectos.filter(function(x){ return x.nombre === 'REDTEAM imp intl unico'; })[0];
       return { veredicto: (a && b) ? 'CANDADO OK' : 'EXCESO',
                detalle: 'creados=' + r.creados + ' · 11 dígitos entró=' + !!a + ' (' + JSON.stringify(a ? a.telefono : null) + ') · +52 entró=' + !!b + ' (' + JSON.stringify(b ? b.telefono : null) + ') · análisis=' + JSON.stringify(r.analisis) };`
});

/* ── (2) Importador con teléfono basura: la pregunta correcta es si queda guardado COMO TELÉFONO ── */

for (const [id, etiqueta, valor] of [
  ['Y-04', 'letras ("llamar al 878")', 'llamar al 878'],
  ['Y-05', 'un solo dígito ("1")', '1']
]) {
  await A({
    id, nombre: '[E-24/E-25 recasteado] Importador con teléfono ' + etiqueta, dato: 'CSV telefono = ' + JSON.stringify(valor),
    esperado: 'NO guardar eso como teléfono', gravedad: 'MEDIA', espera: 900,
    js: `var marca = 'REDTEAM imp basura ${id}';
         var texto = 'Nombre\\tTelefono\\n' + marca + '\\t' + ${JSON.stringify(valor)};
         var r = __R.importarTexto(texto, '${id}.csv');
         await new Promise(function(x){ setTimeout(x, 450); });
         var p = prospectos.filter(function(x){ return x.nombre === marca; })[0];
         var tel = p ? p.telefono : null;
         var comoTelefono = tel && soloDigitosTelefono(tel).length && !/^0*$/.test(soloDigitosTelefono(tel));
         return { veredicto: (p && !comoTelefono) ? 'CANDADO OK' : (p ? 'HUECO' : 'CANDADO OK'),
                  detalle: 'la fila entró=' + !!p + ' · teléfono guardado=' + JSON.stringify(tel) + ' · notas=' + JSON.stringify(p ? p.notasGenerales : null) +
                           ' · (el teléfono basura no se guarda como número; queda como prospecto sin teléfono y el texto crudo va a notas)' };`
  });
}

await A({
  id: 'Y-06', nombre: '[E-26 corregido] Importador con dos columnas al mismo campo (Teléfono y Celular)', dato: 'CSV con Telefono=5550005555 válido y Celular="abcdefghij"',
  esperado: 'el teléfono bueno se guarda y el basura NO', gravedad: 'MEDIA', espera: 900,
  js: `var texto = 'Nombre\\tTelefono\\tCelular\\nREDTEAM imp dos columnas\\t5550005555\\tabcdefghij';
       var r = __R.importarTexto(texto, 'doscampos.csv');
       await new Promise(function(x){ setTimeout(x, 450); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM imp dos columnas'; })[0];
       var tel = p ? p.telefono : null;
       var sano = tel === '5550005555';
       return { veredicto: (p && sano) ? 'CANDADO OK' : (p ? 'HUECO' : 'EXCESO'),
                detalle: 'entró=' + !!p + ' · teléfono=' + JSON.stringify(tel) + ' · notas=' + JSON.stringify(p ? p.notasGenerales : null) + ' · análisis=' + JSON.stringify(r.analisis) };`
});

/* ── (3) DATOS VIEJOS: ¿se pueden seguir editando? (bloqueo de más con la base histórica de Jorge) ── */

await A({
  id: 'Y-07', nombre: 'Dato VIEJO: prospecto con teléfono basura editado por el formulario de Prospectos (solo el nombre)', dato: 'legacy telefono="abc" → editarProspecto → cambiar nombre → Guardar',
  esperado: 'poder corregir el nombre (o que se explique)', gravedad: 'ALTA', espera: 1000,
  js: `var p = __R.legacyProspecto({ nombre: 'Legado editable', telefono: 'abc', email: '', faseActual: 'Interesado' });
       editarProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('prospecto-nombre', 'Legado editable corregido');
       __R.pulsaGuardar('form-prospecto');
       await new Promise(function(x){ setTimeout(x, 550); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 170);
       var viva = prospectos.filter(function(x){ return x.id === p.id; })[0];
       return { veredicto: (viva.nombre === 'Legado editable corregido') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'nombre quedó ' + JSON.stringify(viva.nombre) + ' · teléfono ' + JSON.stringify(viva.telefono) + ' · la pantalla dice: "' + texto + '"'; };`
});

await A({
  id: 'Y-08', nombre: 'Dato VIEJO: cliente con teléfono "1" editado por el CRUD (solo el nombre)', dato: 'legacy telefono="1" → CRUD.clientes.editar → cambiar nombre → Guardar',
  esperado: 'poder corregir el nombre (o que se explique)', gravedad: 'ALTA', espera: 1000,
  js: `var c = __R.legacyCliente({ nombre: 'Legado cliente editable', telefono: '1', email: '', estado: 'Activo' });
       CRUD.clientes.editar(c.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('campo-nombre', 'Legado cliente corregido');
       __R.pulsaGuardar('form-crud');
       await new Promise(function(x){ setTimeout(x, 550); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 170);
       var viva = clientes.filter(function(x){ return x.id === c.id; })[0];
       return { veredicto: (viva.nombre === 'Legado cliente corregido') ? 'CANDADO OK' : 'EXCESO',
                detalle: 'nombre quedó ' + JSON.stringify(viva.nombre) + ' · la pantalla dice: "' + texto + '"'; };`
});

/* ── (4) Duplicados: los casos que mi prueba midió al revés o con nombres chocando ── */

await A({
  id: 'Y-09', nombre: 'CLIENTE duplicado solo por ACENTOS, con nombres que no chocan entre sí', dato: 'existe «Cliente Único Acento» y se crea «CLIENTE UNICO ACENTO»',
  esperado: 'avisar (el importador sí lo detecta)', gravedad: 'ALTA', espera: 1200,
  js: `__R.cliente({ nombre: 'Cliente Único Acento', telefono: '5550006666', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.cliente({ nombre: 'CLIENTE UNICO ACENTO', telefono: '5550006666', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var hay = __R.hayConfirmacion();
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g,' ').trim().slice(0, 150);
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var cuantos = clientes.filter(function(x){ return soloDigitosTelefono(x.telefono) === '5550006666'; }).length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hay + ' · clientes con ese teléfono=' + cuantos + ' · modal: "' + texto + '"'; };`
});

await A({
  id: 'Y-10', nombre: '[A-10 corregido] Cliente duplicado → Cancelar → cambiar nombre Y teléfono → Guardar', dato: 'el practicante corrige los dos campos',
  esperado: 'debe guardarse', gravedad: 'MEDIA', espera: 1400,
  js: `__R.cliente({ nombre: 'REDTEAM libera cliente', telefono: '5550007777', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.cliente({ nombre: 'REDTEAM libera cliente', telefono: '5550007777', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 450); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 350); });
       __R.pon('campo-nombre', 'REDTEAM libera cliente v2');
       __R.pon('campo-telefono', '5550007778');
       __R.pulsaGuardar('form-crud');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM libera cliente v2'; })[0];
       return { veredicto: c ? 'CANDADO OK' : 'EXCESO', detalle: 'aviso=' + hay + ' · guardado=' + !!c + ' con teléfono ' + JSON.stringify(c ? c.telefono : null) + ' · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'Y-11', nombre: 'PROSPECTO: mismo nombre con acentos distintos (hueco esperado)', dato: 'existe «José Único» y se crea «JOSE UNICO» con el mismo teléfono',
  esperado: 'avisar de duplicado', gravedad: 'ALTA', espera: 1200,
  js: `__R.prospecto({ nombre: 'José Único', telefono: '5550008888', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.prospecto({ nombre: 'JOSE UNICO', telefono: '5550008888', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var cuantos = prospectos.filter(function(x){ return soloDigitosTelefono(x.telefono) === '5550008888'; }).length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hay + ' · prospectos con ese teléfono=' + cuantos + ' · avisos=' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'Y-12', nombre: 'PROSPECTO: mismo nombre y el teléfono escrito con GUIONES (hueco esperado)', dato: 'existe tel 5550009999 y se crea el mismo nombre con "555-000-9999"',
  esperado: 'avisar de duplicado', gravedad: 'ALTA', espera: 1200,
  js: `__R.prospecto({ nombre: 'Prospecto Guiones', telefono: '5550009999', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.prospecto({ nombre: 'Prospecto Guiones', telefono: '555-000-9999', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var cuantos = prospectos.filter(function(x){ return soloDigitosTelefono(x.telefono) === '5550009999'; }).length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hay + ' · prospectos con esos dígitos=' + cuantos + ' (el nombre es idéntico y los dígitos también) · avisos=' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'Y-13', nombre: 'CONTRATO: mismo festejado con la fecha cambiada (hueco esperado)', dato: 'existe «Festejada Fecha» 2031-01-15 y se crea la misma con 2031-02-15',
  esperado: 'avisar (una fecha mal tecleada esquiva el aviso)', gravedad: 'ALTA', espera: 1600,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'Festejada Fecha', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2031-01-15', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var n0 = __R.contratosConFestejado('Festejada Fecha').length;
       __R.limpiarNotis();
       __R.contrato({ clienteId: '${cli}', festejado: 'Festejada Fecha', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2031-02-15', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 550); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var n1 = __R.contratosConFestejado('Festejada Fecha').length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratos con ese festejado: ' + n0 + ' → ' + n1 + ' · pidió confirmación=' + hay + ' · avisos=' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'Y-14', nombre: 'TAREA repetida solo por ACENTOS (hueco esperado)', dato: 'existe desc «Visita rápida» y se crea «VISITA RAPIDA»',
  esperado: 'avisar', gravedad: 'MEDIA', espera: 1200,
  js: `__R.tarea({ tipo: 'Visita', fecha: '2031-03-03', descripcion: 'Visita rápida', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 550); });
       __R.limpiarNotis();
       __R.tarea({ tipo: 'Visita', fecha: '2031-03-03', descripcion: 'VISITA RAPIDA', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var hay = __R.hayConfirmacion();
       if (hay) __R.cancelarFinanciero();
       await new Promise(function(x){ setTimeout(x, 300); });
       var cuantas = tareas.filter(function(x){ return x.fecha === '2031-03-03' && x.tipo === 'Visita'; }).length;
       return { veredicto: hay ? 'CANDADO OK' : 'HUECO',
                detalle: 'pidió confirmación=' + hay + ' · tareas ese día=' + cuantas + ' · avisos=' + JSON.stringify(__R.textoNotis()) };`
});

/* ── (5) Antirrepetición: la mitigación del bloqueo (¿basta con cerrar y reabrir?) ── */

await A({
  id: 'Y-15', nombre: '[A-05/A-07 mitigación] Tras el bloqueo, ¿basta cerrar y volver a abrir el formulario del contrato?', dato: 'intento fallido, cerrar el modal, reabrir la edición y guardar',
  esperado: 'documentar la mitigación', gravedad: 'MEDIA', espera: 2000,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'REDTEAM mitigacion', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2031-04-04', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM mitigacion'; })[0];
       // 1) Intento con error (sin festejado) → deja la marca puesta
       __R.editarContrato('${cli2}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', '');
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 450); });
       // 2) Corregir y reintentar en el MISMO formulario
       __R.pon('contrato-festejado', 'REDTEAM mitigacion EDITADO');
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var trasMismoForm = c2.contratos.filter(function(x){ return x.id === co.id; })[0].festejado;
       // 3) Cerrar y reabrir
       cerrarModal();
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.editarContrato('${cli2}', co.id, {});
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pon('contrato-festejado', 'REDTEAM mitigacion REABIERTO');
       __R.pulsaGuardar('form-contrato');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c3 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var trasReabrir = c3.contratos.filter(function(x){ return x.id === co.id; })[0].festejado;
       return { veredicto: (trasMismoForm === 'REDTEAM mitigacion EDITADO' || trasReabrir === 'REDTEAM mitigacion REABIERTO') ? 'HUECO' : 'ROTO',
                detalle: 'tras corregir en el MISMO formulario quedó=' + JSON.stringify(trasMismoForm) + ' (lo esperado sería EDITADO) · tras CERRAR y REABRIR quedó=' + JSON.stringify(trasReabrir) +
                         ' · (si el segundo sí funciona, la mitigación es cerrar y reabrir; el practicante no tiene forma de saberlo)' };`
});

await A({
  id: 'Y-16', nombre: 'PAGO RÁPIDO: intento con monto inválido y luego bueno, CERRANDO Y REABRIENDO', dato: 'monto 0 → error → cerrar → reabrir → monto 1500',
  esperado: 'documentar la mitigación', gravedad: 'MEDIA', espera: 1800,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM pago mitigacion', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2031-05-05', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 650); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM pago mitigacion'; })[0];
       var n0 = (co.pagos || []).length;
       __R.pagoRapido('${cli}', co.id, 0, 'cero', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       __R.pon('pago-rapido-monto', 1500);
       __R.pulsaGuardar('form-pago-rapido');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var trasMismo = (co2.pagos || []).length - n0;
       cerrarModal();
       await new Promise(function(x){ setTimeout(x, 300); });
       __R.pagoRapido('${cli}', co.id, 1500, 'reintento', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var c3 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co3 = c3.contratos.filter(function(x){ return x.id === co.id; })[0];
       var trasReabrir = (co3.pagos || []).length - n0;
       return { veredicto: (trasMismo > 0) ? 'HUECO' : 'ROTO',
                detalle: 'en el MISMO formulario se registraron=' + trasMismo + ' · cerrando y REABRIENDO se registraron=' + trasReabrir + ' (total ' + (co3.pagos || []).length + ') · (el bloqueo silencioso del mismo formulario es el defecto; la mitigación es cerrar y reabrir)' };`
});

const res = await guardar(caja, '27-correcciones-y-casos-nuevos');
process.exitCode = (res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA || res.conteo.EXCESO) ? 1 : 0;
