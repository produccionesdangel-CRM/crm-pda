/* 05-prospectos.mjs — FAMILIA 4: PROSPECTOS. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Prospectos' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);

await A({
  id: 'P-01', nombre: 'Prospecto con nombre vacío', dato: 'prospecto-nombre = ""',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: '', telefono: '8781234567', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: prospectos.length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'prospectos ' + n0 + ' → ' + prospectos.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'P-02', nombre: 'Prospecto con nombre de solo espacios', dato: 'prospecto-nombre = "     "',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: '     ', telefono: '8781234567', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: prospectos.length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'prospectos ' + n0 + ' → ' + prospectos.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'P-03', nombre: 'Prospecto con nombre de 500 caracteres', dato: 'prospecto-nombre = "A" * 500',
  esperado: 'tope de longitud o aviso', gravedad: 'BAJA',
  js: `var n0 = prospectos.length;
       var largo = new Array(501).join('A');
       __R.prospecto({ nombre: largo, telefono: '8789990001', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var p = prospectos.filter(function(x){ return x.nombre && x.nombre.length >= 500; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK', detalle: p ? ('guardado con nombre de ' + p.nombre.length + ' caracteres, sin maxlength ni tope en el código') : ('no se guardó (prospectos ' + n0 + ' → ' + prospectos.length + ')') };`
});

await A({
  id: 'P-04', nombre: 'Prospecto con <script> y etiquetas HTML en el nombre', dato: 'prospecto-nombre = "<script>window.__A.xss=1</script><img src=x onerror=window.__A.xss=2>"',
  esperado: 'se neutraliza el HTML', gravedad: 'ALTA', espera: 700,
  js: `var payload = '<script>window.__A.xss=1<\\/script><img src=x onerror=window.__A.xss=2>';
       __R.prospecto({ nombre: payload, telefono: '8789990002', email: '', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.telefono === '8789990002'; })[0];
       if (!p) return { veredicto: 'CANDADO OK', detalle: 'no se guardó · app: ' + JSON.stringify(__R.textoNotis()) };
       __R.verLista('prospectos');
       await new Promise(function(x){ setTimeout(x, 400); });
       var cont = document.getElementById('lista-prospectos');
       var inyectado = cont.innerHTML.indexOf('<script') !== -1 || cont.innerHTML.indexOf('<img src=x') !== -1;
       return { veredicto: inyectado ? 'HUECO' : 'CANDADO OK',
                detalle: 'nombre guardado = ' + JSON.stringify(p.nombre) + ' · HTML inyectado en la lista = ' + inyectado + ' · xss=' + (window.__A.xss || 0) + ' · (el formulario sanea con sanearCamposFormulario, que borra < > \\" \\' y backtick)' };`
});

await A({
  id: 'P-05', nombre: 'Dos prospectos EXACTAMENTE iguales (mismo nombre y teléfono)', dato: 'nombre="Ana López Ruiz", telefono="8781234567", fase="Interesado" (ya existe en la siembra)',
  esperado: 'aviso de posible duplicado', gravedad: 'ALTA',
  js: `var n0 = prospectos.length;
       var antesIguales = prospectos.filter(function(p){ return p.nombre === 'Ana López Ruiz' && p.telefono === '8781234567'; }).length;
       var r = __R.prospecto({ nombre: 'Ana López Ruiz', telefono: '8781234567', email: 'ana.lopez@correo.com', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var iguales = prospectos.filter(function(p){ return p.nombre === 'Ana López Ruiz' && p.telefono === '8781234567'; });
       return { veredicto: iguales.length > antesIguales ? 'HUECO' : 'CANDADO OK',
                detalle: 'fase leída=' + JSON.stringify(r.leido.fase) + ' · duplicados con el mismo nombre y teléfono: antes ' + antesIguales + ' → ahora ' + iguales.length + ' (prospectos ' + n0 + ' → ' + prospectos.length + ') · la app no compara contra los existentes' };`
});

await A({
  id: 'P-06', nombre: 'Prospecto con fase fuera del catálogo', dato: 'prospecto-fase = "Fase inventada"',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = prospectos.length;
       var r = __R.prospecto({ nombre: 'REDTEAM fase mala', telefono: '8789990003', email: '', fase: 'Fase inventada' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: prospectos.length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'fase leída por el select = ' + JSON.stringify(r.leido.fase) + ' · prospectos ' + n0 + ' → ' + prospectos.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'P-07', nombre: 'Prospecto con correo sin formato válido', dato: 'prospecto-email = "arroba-suelta@"',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM correo malo', telefono: '8789990004', email: 'arroba-suelta@', fase: 'Interesado' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: prospectos.length > n0 ? 'HUECO' : 'CANDADO OK', detalle: 'prospectos ' + n0 + ' → ' + prospectos.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'P-08', nombre: 'Convertir el MISMO prospecto a cliente DOS veces', dato: 'convertirProspecto(id) dos veces',
  esperado: 'no debe crear dos clientes', gravedad: 'ALTA',
  js: `var p = prospectos[5];
       var c0 = clientes.length;
       convertirProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 300); });
       var creados1 = clientes.length - c0;
       converterSegunda: convertirProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 400); });
       var creados2 = clientes.length - c0;
       var mismoTel = clientes.filter(function(c){ return c.nombre === p.nombre && c.telefono === p.telefono; });
       return { veredicto: creados2 > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'clientes creados tras 1ª = ' + creados1 + ' · tras 2ª = ' + creados2 + ' · clientes con ese nombre/teléfono = ' + mismoTel.length + ' · avisos: ' + JSON.stringify(__R.textoNotis()) + ' · (la 2ª llamada sale en SILENCIO: no avisa, simplemente no hace nada)' };`
});

await A({
  id: 'P-11', nombre: 'INYECCIÓN DE HTML ALMACENADA por importación de archivo (XSS)', dato: 'CSV: nombre = "<img src=x onerror=window.__A.xss=7>"',
  esperado: 'el HTML del archivo no debe llegar al DOM como etiqueta', gravedad: 'ALTA', espera: 800,
  js: `var texto = 'Nombre\\tTelefono\\tEmail\\n<img src=x onerror=window.__A.xss=7>\\t8789990011\\txss@correo.com';
       var r = __R.importarTexto(texto, 'xss.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.telefono === '8789990011'; })[0];
       if (!p) return { veredicto: 'CANDADO OK', detalle: 'no se creó · analisis=' + JSON.stringify(r.analisis) };
       var crudo = p.nombre;
       __R.verLista('prospectos');
       await new Promise(function(x){ setTimeout(x, 700); });
       var cont = document.getElementById('lista-prospectos');
       var img = cont.querySelector('img[src="x"]');
       var ejecutado = window.__A.xss || 0;
       return { veredicto: (crudo.indexOf('<') !== -1 || img || ejecutado) ? 'HUECO' : 'CANDADO OK',
                detalle: 'nombre guardado SIN sanear = ' + JSON.stringify(crudo) + ' · <img> real en el DOM de la vista de lista = ' + !!img + ' · onerror EJECUTADO = ' + ejecutado + ' · (el importador NO usa sanearCamposFormulario y renderizarProspectos en vista de lista no escapa)' };`
});

await A({
  id: 'P-12', nombre: 'INYECCIÓN de HTML por la ficha de detalle del prospecto (segundo punto de inyección)', dato: 'nombre importado = "<img src=x onerror=window.__A.xss=9>"',
  esperado: 'neutralizar el HTML en el detalle', gravedad: 'ALTA', espera: 900,
  js: `var texto = 'Nombre\\tTelefono\\tEmail\\n<img src=x onerror=window.__A.xss=9>\\t8789990012\\tdet@correo.com';
       __R.importarTexto(texto, 'xss2.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var p = prospectos.filter(function(x){ return x.telefono === '8789990012'; })[0];
       if (!p) return { veredicto: 'CANDADO OK', detalle: 'no se creó' };
       __R.verLista('prospectos');
       await new Promise(function(x){ setTimeout(x, 300); });
       verDetalleProspecto(p.id);
       await new Promise(function(x){ setTimeout(x, 700); });
       var cuerpo = document.getElementById('modal-body');
       var img = cuerpo.querySelector('img[src="x"]');
       var ejecutado = window.__A.xss || 0;
       return { veredicto: img ? 'HUECO' : 'CANDADO OK',
                detalle: 'nombre guardado = ' + JSON.stringify(p.nombre) + ' · <img> real dentro del detalle del prospecto = ' + !!img + ' · onerror EJECUTADO = ' + ejecutado + ' · (construirDetalleEntidad mete nombre y notas sin escapar)' };`
});

await A({
  id: 'P-13', nombre: 'Prospecto con presupuesto NEGATIVO desde el motor de campañas', dato: 'presupuesto = -5000',
  esperado: 'rechazo o cero', gravedad: 'MEDIA',
  js: `var r = App.motor.crearProspecto({ nombre: 'REDTEAM presupuesto negativo', presupuesto: -5000 });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM presupuesto negativo'; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK', detalle: p ? ('guardado con presupuesto=' + JSON.stringify(p.presupuesto)) : 'no se creó' };`
});

await A({
  id: 'P-14', nombre: 'Prospecto con presupuesto escrito con letras', dato: 'presupuesto = "mil pesos"',
  esperado: 'aviso de dato no numérico', gravedad: 'MEDIA',
  js: `var r = App.motor.crearProspecto({ nombre: 'REDTEAM presupuesto texto', presupuesto: 'mil pesos' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM presupuesto texto'; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: p ? ('se guardó en SILENCIO con presupuesto=' + JSON.stringify(p.presupuesto) + ' (el texto "mil pesos" se convirtió en 0 sin avisar)') : 'no se creó' };`
});

await A({
  id: 'P-15', nombre: 'ROTO: prospecto creado por el motor de campañas rompe la vista de lista de Prospectos', dato: 'prospecto sin campo `faseActual` (motor.crearProspecto) + vista de lista',
  esperado: 'el listado debe pintarse siempre', gravedad: 'ALTA', espera: 700,
  js: `var p = prospectos.filter(function(x){ return x.nombre === 'REDTEAM presupuesto negativo'; })[0];
       var tieneFase = p && p.faseActual !== undefined;
       guardarVista('prospectos', 'lista');
       var excepcion = null;
       try { renderizarProspectos(); } catch (e) { excepcion = String(e.message || e); }
       await new Promise(function(x){ setTimeout(x, 300); });
       var pintados = document.querySelectorAll('#lista-prospectos .lista-fila').length;
       return { veredicto: excepcion ? 'ROTO' : 'CANDADO OK',
                detalle: 'el prospecto del motor tiene faseActual=' + JSON.stringify(p ? p.faseActual : null) + ' (faseComercial=' + JSON.stringify(p ? p.faseComercial : null) + ') · renderizarProspectos() lanzó: ' + excepcion + ' · filas pintadas = ' + pintados + ' · errores JS de la página: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'P-16', nombre: 'El motor de campañas guarda HTML sin sanear en el nombre del prospecto', dato: 'nombre = "<div onclick=window.__A.xss=9>toca</div>"',
  esperado: 'sanear igual que el formulario', gravedad: 'MEDIA',
  js: `var payload = '<div onclick=window.__A.xss=9>toca</div>';
       App.motor.crearProspecto({ nombre: payload });
       await new Promise(function(x){ setTimeout(x, 300); });
       var p = prospectos.filter(function(x){ return x.nombre === payload; })[0];
       return { veredicto: p ? 'HUECO' : 'CANDADO OK',
                detalle: p ? ('guardado con el HTML intacto: ' + JSON.stringify(p.nombre) + ' · faseActual=' + JSON.stringify(p.faseActual) + ' (el motor pone faseComercial, no faseActual)') : 'no se creó' };`
});

const res = await guardar(caja, '05-prospectos');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
