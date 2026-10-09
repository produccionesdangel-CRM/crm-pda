/* 06-clientes.mjs — FAMILIA 5: CLIENTES. */
import { abrirCaja, ataque, guardar } from '../../agente-a/comun.mjs';

const caja = await abrirCaja({ familia: 'Clientes' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli1 = caja.base.clientes[0].id;
const cli2 = caja.base.clientes[1].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'C-01', nombre: 'Dos clientes con el MISMO teléfono', dato: 'campo-telefono = "8781112233" (el de Cliente Base Uno)',
  esperado: 'aviso de cliente duplicado', gravedad: 'ALTA',
  js: `var antes = clientes.filter(function(c){ return c.telefono === '8781112233'; }).length;
       __R.cliente({ nombre: 'Cliente Distinto Nombre', telefono: '8781112233', email: 'copia@correo.com', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var ahora = clientes.filter(function(c){ return c.telefono === '8781112233'; }).length;
       return { veredicto: ahora > antes ? 'HUECO' : 'CANDADO OK',
                detalle: 'clientes con ese teléfono: ' + antes + ' → ' + ahora + ' · avisos: ' + JSON.stringify(__R.textoNotis()) + ' · la búsqueda de clientes no avisa de teléfonos repetidos' };`
});

await A({
  id: 'C-02', nombre: 'Dos clientes con el MISMO nombre exacto', dato: 'campo-nombre = "Cliente Base Dos"',
  esperado: 'aviso de nombre duplicado', gravedad: 'MEDIA',
  js: `var antes = clientes.filter(function(c){ return c.nombre === 'Cliente Base Dos'; }).length;
       __R.cliente({ nombre: 'Cliente Base Dos', telefono: '8780000099', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var ahora = clientes.filter(function(c){ return c.nombre === 'Cliente Base Dos'; }).length;
       return { veredicto: ahora > antes ? 'HUECO' : 'CANDADO OK', detalle: 'clientes con ese nombre: ' + antes + ' → ' + ahora };`
});

await A({
  id: 'C-03', nombre: 'Cliente con estado fuera del catálogo', dato: 'campo-estado = "EstadoInventado"',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = clientes.length;
       var r = __R.cliente({ nombre: 'REDTEAM estado malo', telefono: '8780000100', email: '', estado: 'EstadoInventado' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM estado malo'; })[0];
       if (!c) return { veredicto: 'CANDADO OK', detalle: 'no se guardó · select dejó ' + JSON.stringify(r.leido.estado) + ' · app: ' + JSON.stringify(__R.textoNotis()) };
       return { veredicto: c.estado === '' || c.estado === 'EstadoInventado' ? 'HUECO' : 'CANDADO OK',
                detalle: 'guardado con estado=' + JSON.stringify(c.estado) + ' (el CRUD de clientes NO valida campos obligatorios en el código: solo confía en el atributo required del HTML) · clientes ' + n0 + ' → ' + clientes.length };`
});

await A({
  id: 'C-04', nombre: 'Cliente con NOMBRE VACÍO por envío tipo pegado/autocompletado (dispatchEvent)', dato: 'campo-nombre = "", campo-telefono = ""',
  esperado: 'rechazo', gravedad: 'ALTA',
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: '', telefono: '', email: '', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var c = clientes.filter(function(x){ return x.nombre === '' ; })[0];
       return { veredicto: c ? 'HUECO' : 'CANDADO OK',
                detalle: c ? ('cliente guardado con nombre="" y telefono="" · id=' + c.id + ' · clientes ' + n0 + ' → ' + clientes.length + ' · app: ' + JSON.stringify(__R.textoNotis())) : ('no se guardó · clientes ' + n0 + ' → ' + clientes.length + ' · app: ' + JSON.stringify(__R.textoNotis())) };`
});

await A({
  id: 'C-05', nombre: 'Cliente con NOMBRE VACÍO por clic real de botón (requestSubmit)', dato: 'campo-nombre = "", envío real',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: '', telefono: '8780000101', email: '', estado: 'Activo' }, 'request');
       await new Promise(function(x){ setTimeout(x, 500); });
       return { veredicto: clientes.length > n0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'clientes ' + n0 + ' → ' + clientes.length + ' · con requestSubmit() el navegador SÍ frena el required; con dispatchEvent no (ver C-04) · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'C-06', nombre: 'Cliente con correo sin formato válido (dispatchEvent)', dato: 'campo-email = "no-es-un-correo"',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: 'REDTEAM correo cliente', telefono: '8780000102', email: 'no-es-un-correo', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 400); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM correo cliente'; })[0];
       return { veredicto: c ? 'HUECO' : 'CANDADO OK',
                detalle: c ? ('guardado con email=' + JSON.stringify(c.email) + ' · el CRUD no usa esCorreoValido; solo el atributo type=email del navegador') : ('no se guardó · clientes ' + n0 + ' → ' + clientes.length) };`
});

await A({
  id: 'C-07', nombre: 'Doble envío seguido en «Guardar» de cliente (bandera guardando)', dato: 'dos form-crud submit en el mismo tick',
  esperado: 'un solo cliente', gravedad: 'MEDIA',
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: 'REDTEAM doble cliente', telefono: '8780000103', email: '', estado: 'Activo' });
       __R.reenviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var iguales = clientes.filter(function(c){ return c.nombre === 'REDTEAM doble cliente'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'clientes creados = ' + iguales.length + ' (clientes ' + n0 + ' → ' + clientes.length + ') · la bandera interna guardando NO evita el segundo envío: se pone en true al entrar y se limpia en el finally del primer manejador, que corre completo antes del segundo' };`
});

/* Cliente con contrato y pago, para probar la eliminación */
await A({
  id: 'C-08', nombre: 'Base: cliente con contrato y dos pagos (preparación)', dato: 'contrato de $25,000 + pagos de $5,000 y $3,000',
  esperado: 'base lista para C-09', gravedad: 'BAJA', espera: 700,
  js: `__R.contrato({ clienteId: '${cli2}', festejado: 'Festejada Cliente Dos', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-08-20', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var co = c.contratos[0];
       __R.pagoRapido('${cli2}', co.id, 5000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 300); });
       cerrarModal();
       __R.pagoRapido('${cli2}', co.id, 3000, 'segundo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 300); });
       cerrarModal();
       var c2 = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var t = calcularTotalesContrato(c2.contratos[0]);
       return { veredicto: (t.totalPagos === 8000) ? 'CANDADO OK' : 'HUECO',
                detalle: 'contratos=' + c2.contratos.length + ' pagos=' + (c2.contratos[0].pagos || []).length + ' totalPagos=' + t.totalPagos };`
});

await A({
  id: 'C-09', nombre: 'Eliminar un cliente que TIENE contratos y pagos (botón real del listado)', dato: 'CRUD.clientes.eliminar(cliente con 1 contrato y $8,000 pagados)',
  esperado: 'advertencia que mencione los contratos y su dinero', gravedad: 'ALTA', espera: 700,
  js: `var c = clientes.filter(function(x){ return x.id === '${cli2}'; })[0];
       var contratos = (c.contratos || []).length;
       var pagado = contratos ? calcularTotalesContrato(c.contratos[0]).totalPagos : 0;
       var n0 = clientes.length;
       CRUD.clientes.eliminar('${cli2}');
       await new Promise(function(x){ setTimeout(x, 250); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g, ' ').trim();
       var mencionaContratos = /contrato/i.test(texto);
       var mencionaDinero = /\\$/.test(texto);
       document.getElementById('btn-confirmar-papelera').click();
       await new Promise(function(x){ setTimeout(x, 500); });
       var quedo = clientes.some(function(x){ return x.id === '${cli2}'; });
       var enPapelera = papelera.filter(function(p){ return p.tipo === 'cliente' && p.item && p.item.id === '${cli2}'; }).length;
       var contratosEnPapelera = papelera.filter(function(p){ return p.tipo === 'contrato' && p.item && p.item._clienteId === '${cli2}'; }).length;
       var entrada = papelera.filter(function(p){ return p.tipo === 'cliente' && p.item && p.item.id === '${cli2}'; })[0];
       var contratosDentro = entrada ? ((entrada.item.contratos || []).length) : -1;
       var pagosDentro = (entrada && entrada.item.contratos && entrada.item.contratos[0]) ? (entrada.item.contratos[0].pagos || []).length : -1;
       return { veredicto: (contratos > 0 && !mencionaContratos) ? 'HUECO' : 'CANDADO OK',
                detalle: 'el cliente tenía ' + contratos + ' contrato(s) y $' + pagado + ' pagados · la advertencia dice: "' + texto.slice(0, 190) + '" · menciona contratos=' + mencionaContratos + ' menciona dinero=' + mencionaDinero + ' · cliente eliminado=' + !quedo + ' · en papelera: cliente=' + enPapelera + ', entradas de contrato sueltas=' + contratosEnPapelera + ' · el cliente guardado en papelera conserva ' + contratosDentro + ' contrato(s) y ' + pagosDentro + ' pago(s) (recuperable)' };`
});

await A({
  id: 'C-10', nombre: 'Cliente eliminado: ¿el prospecto que lo apuntaba queda bien?', dato: 'prospecto con clienteId del cliente borrado en C-09',
  esperado: 'referencias limpias', gravedad: 'MEDIA',
  js: `var huerfanos = prospectos.filter(function(p){ return p.clienteId === '${cli2}'; });
       return { veredicto: huerfanos.length ? 'HUECO' : 'CANDADO OK',
                detalle: 'prospectos apuntando al cliente eliminado = ' + huerfanos.length + ' · (onEliminar del CRUD pone clienteId=null)' };`
});

await A({
  id: 'C-11', nombre: 'Editar un cliente para dejarle el nombre en blanco', dato: 'campo-nombre = "" (edición)',
  esperado: 'rechazo', gravedad: 'MEDIA',
  js: `CRUD.clientes.editar('${cli1}');
       await new Promise(function(x){ setTimeout(x, 200); });
       __R.pon('campo-nombre', '');
       __R.enviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 450); });
       var c = clientes.filter(function(x){ return x.id === '${cli1}'; })[0];
       return { veredicto: c.nombre === '' ? 'HUECO' : 'CANDADO OK',
                detalle: 'nombre del cliente quedó ' + JSON.stringify(c.nombre) + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'C-12', nombre: 'Eliminar un cliente con contrato por el botón de la VISTA DE LISTA (eliminarCliente)', dato: 'eliminarCliente(cliente con 1 contrato y $2,000)',
  esperado: 'que las dos vistas avisen igual', gravedad: 'MEDIA', espera: 800,
  js: `__R.contrato({ clienteId: '${caja.base.clientes[2].id}', festejado: 'Festejada Cliente Tres', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2027-09-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${caja.base.clientes[2].id}'; })[0];
       var co = c.contratos[0];
       __R.pagoRapido('${caja.base.clientes[2].id}', co.id, 2000, 'anticipo', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 300); });
       cerrarModal();
       eliminarCliente('${caja.base.clientes[2].id}');
       await new Promise(function(x){ setTimeout(x, 250); });
       var texto = document.getElementById('modal-body').innerText.replace(/\\s+/g, ' ').trim();
       cerrarModal();
       return { veredicto: /contrato/i.test(texto) ? 'CANDADO OK' : 'HUECO',
                detalle: 'esta ruta SÍ dice cuántos contratos y tareas tiene: "' + texto.slice(0, 220) + '" · menciona dinero (importe pagado)=' + /\\$/.test(texto) + ' · (el botón de la vista de MOSAICO usa CRUD.clientes.eliminar, que avisa igual pero SIN el conteo: ver C-09)' };`
});

const res = await guardar(caja, '06-clientes');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
