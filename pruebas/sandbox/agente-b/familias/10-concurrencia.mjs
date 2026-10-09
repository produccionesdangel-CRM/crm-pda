/* 10-concurrencia.mjs — FAMILIA 9: CONCURRENCIA Y PRISA DE PRACTICANTES. */
import { abrirCaja, ataque, guardar } from '../../agente-a/comun.mjs';

const caja = await abrirCaja({ familia: 'Concurrencia' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;
const paq = caja.base.paquetes[0].id;

await A({
  id: 'D-01', nombre: 'Doble clic en «Guardar» de prospecto (dos envíos en el mismo instante)', dato: 'nombre="REDTEAM doble prospecto"',
  esperado: 'un solo prospecto', gravedad: 'ALTA', espera: 800,
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM doble prospecto', telefono: '8785550001', email: '', fase: 'Interesado' });
       __R.reenviar('form-prospecto', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var iguales = prospectos.filter(function(p){ return p.nombre === 'REDTEAM doble prospecto'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'prospectos creados = ' + iguales.length + ' (prospectos ' + n0 + ' → ' + prospectos.length + ') · no hay bandera antirrepetición en mostrarFormularioProspecto · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'D-02', nombre: 'Doble clic en «Guardar» de prospecto con dos requestSubmit (clic real)', dato: 'dos requestSubmit() seguidos',
  esperado: 'un solo prospecto', gravedad: 'ALTA', espera: 800,
  js: `var n0 = prospectos.length;
       __R.prospecto({ nombre: 'REDTEAM doble prospecto RS', telefono: '8785550002', email: '', fase: 'Interesado' });
       __R.reenviar('form-prospecto', 'request');
       await new Promise(function(x){ setTimeout(x, 600); });
       var iguales = prospectos.filter(function(p){ return p.nombre === 'REDTEAM doble prospecto RS'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'prospectos creados = ' + iguales.length + ' (prospectos ' + n0 + ' → ' + prospectos.length + ') · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'D-03', nombre: 'Doble clic en «Guardar» de tarea (ya visto en R-02/R-03)', dato: 'dos envíos de form-tarea',
  esperado: 'una sola tarea', gravedad: 'ALTA', espera: 700,
  js: `var n0 = tareas.length;
       __R.tarea({ tipo: 'Llamar', fecha: '2027-11-11', descripcion: 'REDTEAM doble tarea', clienteId: '${cli}' });
       __R.reenviar('form-tarea', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var iguales = tareas.filter(function(t){ return t.descripcion === 'REDTEAM doble tarea'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK', detalle: 'tareas creadas = ' + iguales.length + ' (tareas ' + n0 + ' → ' + tareas.length + ')' };`
});

await A({
  id: 'D-04', nombre: 'Doble clic en «Guardar» de cliente', dato: 'dos envíos de form-crud',
  esperado: 'un solo cliente', gravedad: 'ALTA', espera: 700,
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: 'REDTEAM doble cliente 2', telefono: '8785550003', email: '', estado: 'Activo' });
       __R.reenviar('form-crud', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var iguales = clientes.filter(function(c){ return c.nombre === 'REDTEAM doble cliente 2'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'clientes creados = ' + iguales.length + ' (clientes ' + n0 + ' → ' + clientes.length + ') · la bandera guardando del CRUD se reinicia en el finally, así que no evita el segundo envío' };`
});

await A({
  id: 'D-05', nombre: 'Doble clic en «Guardar Contrato» (dos contratos de golpe)', dato: 'dos envíos de form-contrato',
  esperado: 'un solo contrato', gravedad: 'ALTA', espera: 900,
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM doble contrato', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-08-08', estado: 'Pendiente' });
       __R.reenviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var iguales = obtenerContratos().filter(function(c){ return c.festejado === 'REDTEAM doble contrato'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'contratos creados = ' + iguales.length + ' (contratos ' + n0 + ' → ' + obtenerContratos().length + ') · guardarContrato NO tiene bandera antirrepetición' };`
});

await A({
  id: 'D-06', nombre: 'Doble clic en «Registrar pago» rápido ($1,500)', dato: 'dos envíos de form-pago-rapido',
  esperado: 'un solo pago', gravedad: 'ALTA', espera: 900,
  js: `__R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM pago doble', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-09-09', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co = c.contratos.filter(function(x){ return x.festejado === 'REDTEAM pago doble'; })[0];
       var n0 = (co.pagos || []).length;
       __R.pagoRapido('${cli}', co.id, 1500, 'doble', 'dispatch');
       __R.reenviar('form-pago-rapido', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 600); });
       var c2 = clientes.filter(function(x){ return x.id === '${cli}'; })[0];
       var co2 = c2.contratos.filter(function(x){ return x.id === co.id; })[0];
       var hay = !!document.getElementById('btn-confirmar-financiero');
       return { veredicto: (co2.pagos || []).length - n0 > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'pagos creados = ' + ((co2.pagos || []).length - n0) + ' · modal de confirmación pendiente=' + hay + ' · el 2º envío se detiene en el aviso de monto repetido' };`
});

await A({
  id: 'D-07', nombre: 'Completar y borrar la misma tarea en dos acciones rápidas', dato: 'alternarCompletarTarea + eliminarTarea inmediata',
  esperado: 'sin excepciones y sin tarea fantasma', gravedad: 'MEDIA', espera: 900,
  js: `__R.tarea({ tipo: 'Otro', fecha: '2027-12-12', descripcion: 'REDTEAM completar y borrar', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM completar y borrar'; })[0];
       alternarCompletarTarea(t.id);
       eliminarTarea(t.id);
       await new Promise(function(x){ setTimeout(x, 200); });
       var boton = document.getElementById('btn-confirmar-eliminar');
       if (boton) boton.click();
       await new Promise(function(x){ setTimeout(x, 500); });
       var sigue = tareas.some(function(x){ return x.id === t.id; });
       var enPapelera = papelera.filter(function(p){ return p.tipo === 'tarea' && p.item && p.item.id === t.id; }).length;
       var otraVez = tareas.filter(function(x){ return x.descripcion === 'REDTEAM completar y borrar'; }).length;
       return { veredicto: (!sigue && enPapelera > 0) ? 'CANDADO OK' : 'HUECO',
                detalle: 'la tarea sigue en la lista=' + sigue + ' · copias restantes=' + otraVez + ' · en papelera=' + enPapelera + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'D-08', nombre: 'Importar DOS VECES el mismo prospecto desde el mismo texto', dato: 'mismo CSV dos veces seguidas',
  esperado: 'no duplicar', gravedad: 'ALTA', espera: 900,
  js: `var texto = 'Nombre\\tTelefono\\nREDTEAM import dos veces\\t8785550004';
       var n0 = prospectos.length;
       var r1 = __R.importarTexto(texto, 'doble.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var r2 = __R.importarTexto(texto, 'doble.csv');
       await new Promise(function(x){ setTimeout(x, 400); });
       var cuantos = prospectos.filter(function(p){ return p.nombre === 'REDTEAM import dos veces'; }).length;
       return { veredicto: cuantos > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: '1ª importación: ' + JSON.stringify(r1) + ' · 2ª: ' + JSON.stringify(r2) + ' · prospectos con ese nombre = ' + cuantos + ' (prospectos ' + n0 + ' → ' + prospectos.length + ') · el importador lleva firmas de fila y detecta duplicados por teléfono/nombre' };`
});

await A({
  id: 'D-09', nombre: 'Dos operaciones seguidas sin recargar: cliente → contrato → pago y comprobar el cuadre', dato: 'flujo completo en ráfaga',
  esperado: 'totales cuadrados', gravedad: 'ALTA', espera: 1200,
  js: `var inv0 = __R.invariantes();
       __R.cliente({ nombre: 'REDTEAM rafaga', telefono: '8785550005', email: 'rafaga@correo.com', estado: 'Activo' });
       await new Promise(function(x){ setTimeout(x, 300); });
       var c = clientes.filter(function(x){ return x.nombre === 'REDTEAM rafaga'; })[0];
       __R.contrato({ clienteId: c.id, festejado: 'Festejada Ráfaga', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-10-10', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var c2 = clientes.filter(function(x){ return x.id === c.id; })[0];
       var co = c2.contratos[0];
       __R.pagoRapido(c.id, co.id, 4000, 'rafaga', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       cerrarModal();
       var inv = __R.invariantes();
       var t = calcularTotalesContrato(clientes.filter(function(x){ return x.id === c.id; })[0].contratos[0]);
       return { veredicto: inv.problemas.length === 0 ? 'CANDADO OK' : 'HUECO',
                detalle: 'contrato: totalAPagar=$' + t.totalAPagar + ' pagos=$' + t.totalPagos + ' saldo=$' + t.saldoBruto + ' · igualdad saldo = total - pagos: ' + (Math.abs((t.totalAPagar - t.totalPagos) - t.saldoBruto) < 0.005) +
                         ' · problemas de integridad nuevos: ' + JSON.stringify(inv.problemas.length - inv0.problemas.length) + ' · clientes ' + inv0.clientes + '→' + inv.clientes + ', contratos ' + inv0.contratos + '→' + inv.contratos + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'D-10', nombre: 'Diferencia entre envío "pegado" (dispatchEvent) y clic real (requestSubmit) en cliente con nombre vacío', dato: 'nombre="" con los dos métodos',
  esperado: 'documentar la diferencia', gravedad: 'MEDIA', espera: 800,
  js: `var n0 = clientes.length;
       __R.cliente({ nombre: '', telefono: '8785550006', email: '', estado: 'Activo' }, 'dispatch');
       await new Promise(function(x){ setTimeout(x, 400); });
       var conDispatch = clientes.length - n0;
       var n1 = clientes.length;
       __R.cliente({ nombre: '', telefono: '8785550007', email: '', estado: 'Activo' }, 'request');
       await new Promise(function(x){ setTimeout(x, 500); });
       var conRequest = clientes.length - n1;
       return { veredicto: conDispatch > 0 ? 'HUECO' : 'CANDADO OK',
                detalle: 'con dispatchEvent (pegado/autocompletado) se crearon ' + conDispatch + ' cliente(s) vacío(s); con requestSubmit (clic real) se crearon ' + conRequest + ' · el código del CRUD NO comprueba los campos obligatorios: el único candado es el atributo required del HTML' };`
});

await A({
  id: 'D-11', nombre: 'Reenviar el formulario de contrato YA CERRADO (sigue vivo en el DOM)', dato: 'un envío normal, esperar, y volver a enviar el mismo form-contrato',
  esperado: 'el formulario cerrado no debe poder guardar otra vez', gravedad: 'ALTA', espera: 1000,
  js: `var n0 = obtenerContratos().length;
       __R.contrato({ clienteId: '${cli}', festejado: 'REDTEAM form zombi', tipo: 'paquete', paqueteId: '${paq}', fechaEvento: '2028-12-12', estado: 'Pendiente' });
       await new Promise(function(x){ setTimeout(x, 500); });
       var modalCerrado = !document.getElementById('modal').classList.contains('active');
       var formSigueEnElDom = !!document.getElementById('form-contrato');
       var trasPrimero = obtenerContratos().filter(function(c){ return c.festejado === 'REDTEAM form zombi'; }).length;
       // Un segundo envío del MISMO formulario, ya cerrado el modal:
       __R.enviar('form-contrato', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 700); });
       var trasSegundo = obtenerContratos().filter(function(c){ return c.festejado === 'REDTEAM form zombi'; }).length;
       return { veredicto: trasSegundo > trasPrimero ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'modal cerrado tras guardar=' + modalCerrado + ' · el formulario SIGUE en el DOM=' + formSigueEnElDom + ' (cerrarModal solo quita la clase active, no limpia #modal-body) · contratos con ese festejado: ' + trasPrimero + ' → ' + trasSegundo + ' · contratos ' + n0 + ' → ' + obtenerContratos().length };`
});

const res = await guardar(caja, '10-concurrencia');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
