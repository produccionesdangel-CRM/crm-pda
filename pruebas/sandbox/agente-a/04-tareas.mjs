/* 04-tareas.mjs — FAMILIA 3: TAREAS REPETIDAS / DUPLICADAS. */
import { abrirCaja, ataque, guardar } from './comun.mjs';

const caja = await abrirCaja({ familia: 'Tareas' });
console.log('Caja aislada: ' + (caja.aislamiento.aislado ? 'SÍ' : 'NO') + ' · sello ' + caja.info.sello + '\n');
const A = (def) => ataque(caja, def);
const cli = caja.base.clientes[0].id;

await A({
  id: 'R-01', nombre: 'La misma tarea dos veces el mismo día (dos envíos separados)', dato: 'tipo=Llamar, fecha=2027-05-10, desc="REDTEAM duplicada"',
  esperado: 'aviso de tarea repetida', gravedad: 'MEDIA',
  js: `var antes = tareas.length;
       __R.tarea({ tipo: 'Llamar', fecha: '2027-05-10', descripcion: 'REDTEAM duplicada', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 250); });
       __R.tarea({ tipo: 'Llamar', fecha: '2027-05-10', descripcion: 'REDTEAM duplicada', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var iguales = tareas.filter(function(t){ return t.descripcion === 'REDTEAM duplicada'; });
       return { veredicto: iguales.length > 1 ? 'HUECO' : 'CANDADO OK',
                detalle: 'tareas iguales creadas = ' + iguales.length + ' (' + tareas.length + ' en total, antes ' + antes + ') · avisos: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'R-02', nombre: 'Doble clic seguido en «Guardar» de tarea (mismo instante)', dato: 'dos form-tarea submit en el mismo tick',
  esperado: 'un solo registro', gravedad: 'ALTA',
  js: `var antes = tareas.length;
       var r = __R.tarea({ tipo: 'Confirmar', fecha: '2027-06-01', descripcion: 'REDTEAM doble guardar', clienteId: '${cli}' });
       __R.reenviar('form-tarea', 'dispatch');
       await new Promise(function(x){ setTimeout(x, 500); });
       var iguales = tareas.filter(function(t){ return t.descripcion === 'REDTEAM doble guardar'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'tareas creadas = ' + iguales.length + ' (tareas ' + antes + ' → ' + tareas.length + ') · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'R-03', nombre: 'Doble clic seguido en «Guardar» de tarea con dos requestSubmit (clic real)', dato: 'dos requestSubmit() seguidos',
  esperado: 'un solo registro', gravedad: 'ALTA',
  js: `var antes = tareas.length;
       __R.tarea({ tipo: 'Confirmar', fecha: '2027-06-02', descripcion: 'REDTEAM requestSubmit x2', clienteId: '${cli}' });
       __R.reenviar('form-tarea', 'request');
       await new Promise(function(x){ setTimeout(x, 600); });
       var iguales = tareas.filter(function(t){ return t.descripcion === 'REDTEAM requestSubmit x2'; });
       return { veredicto: iguales.length > 1 ? 'DUPLICA' : 'CANDADO OK',
                detalle: 'tareas creadas = ' + iguales.length + ' (tareas ' + antes + ' → ' + tareas.length + ') · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'R-04', nombre: 'Completar dos veces la misma tarea', dato: 'alternarCompletarTarea(id) dos veces',
  esperado: 'la segunda vez no debería reabrirla sin avisar', gravedad: 'BAJA',
  js: `__R.tarea({ tipo: 'Visita', fecha: '2027-05-11', descripcion: 'REDTEAM completar x2', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM completar x2'; })[0];
       alternarCompletarTarea(t.id);
       await new Promise(function(x){ setTimeout(x, 120); });
       var trasPrimera = tareas.filter(function(x){ return x.id === t.id; })[0].completada;
       alternarCompletarTarea(t.id);
       await new Promise(function(x){ setTimeout(x, 200); });
       var trasSegunda = tareas.filter(function(x){ return x.id === t.id; })[0].completada;
       var avisos = __R.textoNotis();
       var avisoReabrir = avisos.some(function(a){ return a.indexOf('reabierta') !== -1; });
       return { veredicto: (trasPrimera === true && trasSegunda === false && !avisoReabrir) ? 'HUECO' : 'CANDADO OK',
                detalle: 'tras 1er completar = ' + trasPrimera + ' · tras 2do = ' + trasSegunda + ' (la segunda acción REABRE la tarea: comportamiento de interruptor, la app SÍ avisa con "Tarea reabierta") · avisos: ' + JSON.stringify(avisos) };`
});

await A({
  id: 'R-05', nombre: 'Tarea asignada a un cliente/prospecto INEXISTENTE', dato: 'tarea-cliente = "no-existe-1234"',
  esperado: 'rechazo o limpieza de la referencia', gravedad: 'MEDIA',
  js: `var antes = tareas.length;
       __R.tarea({ tipo: 'Llamar', fecha: '2027-05-12', descripcion: 'REDTEAM cliente fantasma', clienteId: 'no-existe-1234' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM cliente fantasma'; })[0];
       if (!t) return { veredicto: 'CANDADO OK', detalle: 'no se creó · app: ' + JSON.stringify(__R.textoNotis()) };
       var existe = clientes.some(function(c){ return c.id === t.clienteId; }) || prospectos.some(function(p){ return 'pro_' + p.id === t.clienteId; });
       return { veredicto: 'HUECO',
                detalle: 'tarea guardada con clienteId=' + JSON.stringify(t.clienteId) + ' que NO existe (existe=' + existe + ') · tareas ' + antes + ' → ' + tareas.length + ' · el detalle del cliente nunca la mostrará' };`
});

await A({
  id: 'R-06', nombre: 'Tarea con tipo fuera del catálogo', dato: 'tarea-tipo = "Invitación a la luna"',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var antes = tareas.length;
       var r = __R.tarea({ tipo: 'Invitación a la luna', fecha: '2027-05-13', descripcion: 'REDTEAM tipo malo', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 300); });
       return { veredicto: tareas.length > antes ? 'HUECO' : 'CANDADO OK',
                detalle: 'tipo leído por el select = ' + JSON.stringify(r.leido.tipo) + ' · tareas ' + antes + ' → ' + tareas.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

await A({
  id: 'R-07', nombre: 'Tarea con descripción de 5000 caracteres', dato: 'tarea-descripcion = "x" * 5000',
  esperado: 'tope de longitud', gravedad: 'BAJA',
  js: `var antes = tareas.length;
       var larga = new Array(5001).join('x');
       __R.tarea({ tipo: 'Otro', fecha: '2027-05-14', descripcion: larga, clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 350); });
       var t = tareas.filter(function(x){ return x.descripcion && x.descripcion.length > 4000; })[0];
       return { veredicto: t ? 'HUECO' : 'CANDADO OK', detalle: t ? ('guardada con descripción de ' + t.descripcion.length + ' caracteres sin tope') : ('no se guardó · tareas ' + antes + ' → ' + tareas.length) };`
});

await A({
  id: 'R-08', nombre: 'Editar / completar / borrar una tarea que ya no existe', dato: 'ids inexistentes',
  esperado: 'no debe haber excepción', gravedad: 'BAJA',
  js: `var salida = {};
       try { editarTarea('no-existe-1'); salida.editar = 'sin excepción'; } catch (e) { salida.editar = 'EXC: ' + e.message; }
       try { alternarCompletarTarea('no-existe-2'); salida.alternar = 'sin excepción'; } catch (e) { salida.alternar = 'EXC: ' + e.message; }
       try { eliminarTarea('no-existe-3'); salida.eliminar = 'sin excepción'; } catch (e) { salida.eliminar = 'EXC: ' + e.message; }
       await new Promise(function(x){ setTimeout(x, 250); });
       var malo = Object.keys(salida).some(function(k){ return salida[k].indexOf('EXC') === 0; });
       return { veredicto: malo ? 'ROTO' : 'CANDADO OK', detalle: JSON.stringify(salida) + ' · errores JS: ' + JSON.stringify(window.__A.errores) };`
});

await A({
  id: 'R-09', nombre: 'Dos tareas idénticas por importación no aplica: tarea con fecha vacía desde el formulario', dato: 'tarea-fecha = "" (ya visto en F-05)',
  esperado: 'rechazo', gravedad: 'BAJA',
  js: `var antes = tareas.length;
       __R.tarea({ tipo: 'Otro', fecha: '', descripcion: 'REDTEAM tarea sin fecha', clienteId: '${cli}' });
       await new Promise(function(x){ setTimeout(x, 250); });
       var t = tareas.filter(function(x){ return x.descripcion === 'REDTEAM tarea sin fecha'; })[0];
       return { veredicto: t ? 'HUECO' : 'CANDADO OK', detalle: 'tareas ' + antes + ' → ' + tareas.length + ' · app: ' + JSON.stringify(__R.textoNotis()) };`
});

const res = await guardar(caja, '04-tareas');
process.exitCode = res.conteo.HUECO || res.conteo.ROTO || res.conteo.DUPLICA ? 1 : 0;
