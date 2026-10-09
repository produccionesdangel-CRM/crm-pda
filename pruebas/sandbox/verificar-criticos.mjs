/*
 * verificar-criticos.mjs — verificación INDEPENDIENTE de los arreglos del equipo azul.
 * ---------------------------------------------------------------------------
 * El equipo rojo (A) encontró los huecos y el azul (B) los reparó. Esta prueba NO
 * usa los arneses de ninguno de los dos: reproduce a mano los casos más delicados,
 * con el flujo correcto, para no caer en un falso "ya quedó".
 *
 * Casos:
 *   1. G-12 · pago capturado DENTRO del formulario de un contrato YA EXISTENTE y
 *      modal cerrado sin «Guardar Contrato» → debe quedar guardado.
 *   2. R1/G-11 · anular un pago → debe persistir la anulación (no revivir al
 *      recargar), dejar rastro y no romper el formulario.
 *   3. R2/G-13 · confirmar un cargo con aviso → el cargo debe guardarse.
 *   4. A-01..A-11 · campañas inválidas por el motor → no deben guardarse, y una
 *      campaña válida debe seguir creándose.
 *   5. P-11/P-12 · nombre con HTML → saneado y sin ejecutarse al dibujar.
 *   6. P-15 · prospecto sin faseActual → la lista se dibuja igual.
 *
 * Cómo se corre:  node pruebas\sandbox\verificar-criticos.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from './sandbox.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const info = preparar();
  const s = await abrir({ info, ancho: 1280, alto: 900, movil: false, tactil: false });
  const fallos = [];
  const linea = (ok, texto) => { if (!ok) fallos.push(texto); console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };

  try {
    console.log('entrar: ' + await entrar(s));
    const a = await revisarAislamiento(s);
    linea(a.aislado, 'caja aislada (0 peticiones a los datos reales)');
    const sembrado = await sembrar(s);
    linea(sembrado.prospectos === 20 && sembrado.campanias.length === 2, 'sembrado: 20 prospectos y 2 campañas');

    // Escenario base: un paquete, un cliente y un contrato de $25,000 con un pago de $5,000.
    const base = await s.evaluar(`(function () {
      var f = '2027-09-09';
      paquetes.push({ id: 'paq-vc', nombre: 'Paquete Verificación', descripcion: 'prueba', precio: 25000, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo', items: [] });
      clientes.push({ id: 'cli-vc', nombre: 'Cliente Verificación', telefono: '8781234567', email: 'vc@correo.com', estado: 'Activo', fechaRegistro: f,
        contratos: [{ id: 'con-vc', festejado: 'Festejada Verificación', tipo: 'paquete', paqueteId: 'paq-vc', serviciosIds: [], precioBase: 25000, precioFinal: 25000, descuentoMonto: 0, fechaEvento: '2027-11-20', fechaContrato: f, estado: 'Activo',
          pagos: [{ id: 'pag-vc', monto: 5000, fecha: f, nota: 'Anticipo', codigo: 'vc0001', firma: 'firma-vc' }], cargos: [] }] });
      guardarDatos();
      return { pagos: obtenerCliente('cli-vc').contratos[0].pagos.length, saldo: calcularTotalesContrato(obtenerCliente('cli-vc').contratos[0]).saldoBruto };
    })()`);
    console.log('   base: ' + JSON.stringify(base));

    /* ── 1. G-12: pago en el formulario de un contrato existente, cierro sin guardar ── */
    const g12 = await s.evaluar(`(function () {
      var co = obtenerCliente('cli-vc').contratos[0];
      mostrarFormularioContrato('cli-vc', 'Verificación G-12', co);   // el formulario del contrato, abierto
      var campo = document.getElementById('contrato-nuevo-pago');
      if (!campo) return { error: 'no hay campo de pago en el formulario' };
      campo.value = '2000';
      document.getElementById('btn-agregar-pago').click();
      var aviso = document.querySelector('.notificacion');
      var enPantalla = (document.getElementById('contrato-pagos-lista') || {}).innerText || '';
      return { aviso: aviso ? aviso.textContent.trim() : '', enPantalla: enPantalla.slice(0, 60) };
    })()`);
    await dormir(500);
    const cerrado = await s.evaluar(`(function () { cerrarModal(); return 1; })()`);
    await dormir(300);
    const trasG12 = await s.evaluar(`(function () {
      var co = obtenerCliente('cli-vc').contratos[0];
      return { pagos: co.pagos.filter(function (p) { return !p.eliminado; }).length, totalPagos: calcularTotalesContrato(co).totalPagos };
    })()`);
    console.log('   1) G-12 · aviso al agregar: "' + (g12.aviso || g12.error) + '" · pagos tras cerrar sin guardar: ' + trasG12.pagos + ' ($' + trasG12.totalPagos + ')');
    linea(trasG12.pagos === 2 && trasG12.totalPagos === 7000, 'un pago capturado en el formulario de un contrato existente QUEDA GUARDADO aunque se cierre sin «Guardar Contrato»');

    /* ── 2. Anular ese pago y comprobar que la anulación persiste ── */
    const anulacion = await s.evaluar(`(function () {
      var co = obtenerCliente('cli-vc').contratos[0];
      var pago = co.pagos.filter(function (p) { return !p.eliminado; })[0];
      mostrarFormularioContrato('cli-vc', 'Verificación anulación', co);
      PDA.eliminarMovimientoContrato('pago', pago.id);           // abre el modal de anulación
      var motivo = document.getElementById('motivo-anulacion');
      if (!motivo) return { error: 'no pidió motivo' };
      motivo.value = 'Pago duplicado de prueba';
      document.getElementById('btn-confirmar-anulacion').click();
      var co2 = obtenerCliente('cli-vc').contratos[0];
      var p2 = co2.pagos.filter(function (p) { return p.id === pago.id; })[0];
      return {
        eliminadoEnMemoria: !!(p2 && p2.eliminado), motivo: p2 && p2.motivoAnulacion, nota: !!(p2 && p2.esNotaEliminacion),
        totalEnMemoria: calcularTotalesContrato(co2).totalPagos,
        formularioVivo: !!document.getElementById('form-contrato')
      };
    })()`);
    await dormir(400);
    // Recargar del almacén (lo que hace la app al volver a entrar).
    const trasRecargar = await s.evaluar(`(async function () {
      if (typeof cargarDatosLocal === 'function') { await cargarDatosLocal(); }
      var co = obtenerCliente('cli-vc').contratos[0];
      var p = co.pagos.filter(function (x) { return x.id === 'pag-vc'; })[0];
      var hist = (typeof historial !== 'undefined' ? historial : []).filter(function (h) { return h && /anul/i.test(String(h.descripcion || '')); }).length;
      return { eliminadoEnDisco: !!(p && p.eliminado), totalEnDisco: calcularTotalesContrato(co).totalPagos, historialAnulaciones: hist };
    })()`);
    console.log('   2) anulación: ' + JSON.stringify(anulacion) + ' · tras recargar: ' + JSON.stringify(trasRecargar));
    linea(anulacion.eliminadoEnMemoria === true && anulacion.motivo === 'Pago duplicado de prueba', 'la anulación se registra con su motivo');
    linea(anulacion.formularioVivo === true, 'el formulario del contrato sobrevive a la ventana de anulación (sin excepción)');
    linea(trasRecargar.eliminadoEnDisco === true && trasRecargar.totalEnDisco === 2000, 'la anulación PERSISTE: al recargar el pago sigue anulado y el total baja a $2,000 (no revive)');

    /* ── 3. Cargo alto: confirmar y comprobar que se guarda ── */
    const cargo = await s.evaluar(`(function () {
      var co = obtenerCliente('cli-vc').contratos[0];
      mostrarFormularioContrato('cli-vc', 'Verificación cargo', co);
      document.getElementById('cargo-descripcion').value = 'Cargo alto de prueba';
      document.getElementById('cargo-monto').value = '30000';
      document.getElementById('btn-agregar-cargo').click();
      var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
      if (hayConfirmar) document.getElementById('btn-confirmar-financiero').click();
      var co2 = obtenerCliente('cli-vc').contratos[0];
      return { pidioConfirmacion: hayConfirmar, cargos: (co2.cargos || []).filter(function (c) { return !c.eliminado; }).length,
        totalCargos: calcularTotalesContrato(co2).totalCargos, formularioVivo: !!document.getElementById('form-contrato') };
    })()`);
    await dormir(400);
    const cargoDisco = await s.evaluar(`(async function () {
      if (typeof cargarDatosLocal === 'function') { await cargarDatosLocal(); }
      var co = obtenerCliente('cli-vc').contratos[0];
      return { cargos: (co.cargos || []).filter(function (c) { return !c.eliminado; }).length, totalCargos: calcularTotalesContrato(co).totalCargos };
    })()`);
    console.log('   3) cargo alto: ' + JSON.stringify(cargo) + ' · tras recargar: ' + JSON.stringify(cargoDisco));
    linea(cargo.pidioConfirmacion === true, 'un cargo por encima del tope avisa y pide confirmación');
    linea(cargoDisco.cargos === 1 && cargoDisco.totalCargos === 30000, 'el cargo confirmado QUEDA GUARDADO (no se pierde)');

    /* ── 4. Campañas inválidas por el motor ── */
    const campanias = await s.evaluar(`(function () {
      var antes = App.almacen.db.campanias.length;
      var pruebas = [
        ['sin nombre', { nombre: '' }],
        ['fechas invertidas', { nombre: 'Invertida', fechaInicio: '2027-12-31', fechaFin: '2027-01-01' }],
        ['sin etapa inicial', { nombre: 'Sin inicial', etapas: [{ id: 'e1', nombre: 'Una', orden: 1, esInicial: false, esFinal: false }] }],
        ['dos iniciales', { nombre: 'Dos iniciales', etapas: [{ id: 'a', nombre: 'A', orden: 1, esInicial: true, esFinal: false }, { id: 'b', nombre: 'B', orden: 2, esInicial: true, esFinal: false }] }],
        ['metas basura', { nombre: 'Metas', metas: { prospectos: -50, conversiones: 'muchas' } }],
        ['etapas sin nombre', { nombre: 'Sin nombre etapas', etapas: [{ id: 'x', nombre: '', orden: 1, esInicial: true, esFinal: false }, { id: 'y', nombre: '   ', orden: 1, esInicial: false, esFinal: true }] }]
      ];
      var resultados = [];
      pruebas.forEach(function (par) {
        var r = null;
        try { r = App.motor.crearCampania(par[1]); } catch (e) { r = 'EXCEPCION: ' + e.message; }
        resultados.push({ caso: par[0], devuelve: (r && r.id) ? 'campaña' : (r && r.ok === false ? 'ok:false' : String(r).slice(0, 40)) });
      });
      var despues = App.almacen.db.campanias.length;
      var valida = App.motor.crearCampania({ nombre: 'Campaña válida de verificación', fechaInicio: '2027-01-01', fechaFin: '2027-06-30' });
      return { antes: antes, despues: despues, resultados: resultados, validaOk: !!(valida && valida.id), total: App.almacen.db.campanias.length };
    })()`);
    console.log('   4) campañas inválidas: ' + JSON.stringify(campanias.resultados));
    linea(campanias.despues === campanias.antes, 'NINGUNA campaña inválida se guarda (' + campanias.antes + ' → ' + campanias.despues + ')');
    linea(campanias.validaOk === true && campanias.total === campanias.despues + 1, 'una campaña válida sí se crea (el candado no estorba)');

    /* ── 5 y 6. HTML en el nombre y prospecto sin faseActual ── */
    const datos = await s.evaluar(`(function () {
      var r = App.motor.crearProspecto({ nombre: '<img src=x onerror=window.__XSS=1>', telefono: '8789998877' });
      var p = (r && r.prospecto) || null;
      window.__XSS = 0;
      App.seleccionarSeccion('prospectos');
      try { renderizarProspectos(); } catch (e) { return { error: 'la lista lanzó: ' + e.message }; }
      var cont = document.getElementById('lista-prospectos');
      // Un prospecto sin faseActual (como los que crea el motor de campañas viejo).
      prospectos.push({ id: 'pro-sinfase', nombre: 'Prospecto sin fase', telefono: '', email: '', notasGenerales: '', clienteId: null, fechaRegistro: '2027-01-01' });
      try { renderizarProspectos(); } catch (e) { return { error: 'la lista lanzó con un prospecto sin fase: ' + e.message }; }
      return {
        guardado: p ? String(p.nombre) : '(no se creó)',
        imagenesInyectadas: cont.querySelectorAll('img').length,
        xssEjecutado: window.__XSS === 1,
        listaSeDibujo: cont.innerHTML.length > 0,
        filas: cont.querySelectorAll('.mosaico-card, .lista-fila').length
      };
    })()`);
    console.log('   5/6) ' + JSON.stringify(datos));
    linea(!datos.error, 'la lista de Prospectos se dibuja con un prospecto sin faseActual' + (datos.error ? ' — ' + datos.error : ''));
    linea(!/[<>]/.test(datos.guardado), 'las etiquetas del nombre se neutralizan al guardar ("' + String(datos.guardado).slice(0, 40) + '")');
    linea(datos.imagenesInyectadas === 0 && datos.xssEjecutado === false, 'no se inyecta ni se ejecuta HTML al dibujar la lista');

    /* ── 7. Cancelar un aviso de confirmación y volver a intentar Guardar ──
       Trampa posible de la antirrepetición: si la marca de "ya enviado" no se
       libera al cancelar, el segundo intento de guardar no hace NADA (en silencio). */
    const reintento = await s.evaluar(`(function () {
      mostrarFormularioContrato('cli-vc', 'Reintento de guardado', obtenerCliente('cli-vc').contratos[0]);
      var form = document.getElementById('form-contrato');
      if (!form) return { error: 'no abrió el formulario' };
      document.getElementById('contrato-fecha-evento').value = '2020-05-05';   // dispara el aviso de fecha pasada al editar
      form.requestSubmit();
      var primerAviso = !!document.getElementById('btn-confirmar-financiero');
      if (primerAviso) cerrarModal();                                  // el practicante CANCELA el aviso
      var formVivo = !!document.getElementById('form-contrato');
      document.getElementById('form-contrato').requestSubmit();        // lo intenta otra vez
      var segundoAviso = !!document.getElementById('btn-confirmar-financiero');
      if (segundoAviso) document.getElementById('btn-confirmar-financiero').click();
      var co = obtenerCliente('cli-vc').contratos[0];
      return { primerAviso: primerAviso, formVivo: formVivo, segundoAviso: segundoAviso, fechaEventoGuardada: co.fechaEvento };
    })()`);
    console.log('   7) cancelar el aviso y reintentar: ' + JSON.stringify(reintento));
    linea(reintento.primerAviso === true, 'el aviso de confirmación aparece la primera vez');
    linea(reintento.formVivo === true, 'al cancelar, el formulario sigue vivo');
    linea(reintento.segundoAviso === true, 'al reintentar, el aviso vuelve a aparecer (el botón no queda mudo)');
    linea(reintento.fechaEventoGuardada === '2020-05-05', 'y al confirmar, el cambio se guarda de verdad');

    /* ── 8. Pago rápido: error de monto y corrección EN LA MISMA ventana (V-02) ──
       Trampa de la antirrepetición: si la marca no se libera al avisar un error,
       el practicante corrige el monto y «Registrar» no hace nada (en silencio). */
    const mutePago = await s.evaluar(`(function () {
      document.querySelectorAll('.notificacion').forEach(function (n) { n.remove(); });
      var antes = obtenerCliente('cli-vc').contratos[0].pagos.filter(function (p) { return !p.eliminado; }).length;
      agregarPagoRapido('cli-vc', 'con-vc');
      document.getElementById('pago-rapido-monto').value = '0';
      document.getElementById('form-pago-rapido').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var aviso = document.querySelector('.notificacion');
      var form = document.getElementById('form-pago-rapido');
      if (!form) return { error: 'la ventana de pago desapareció tras el error' };
      document.getElementById('pago-rapido-monto').value = '1500';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var despues = obtenerCliente('cli-vc').contratos[0].pagos.filter(function (p) { return !p.eliminado; }).length;
      try { cerrarModal(); } catch (e) { }
      return { aviso: aviso ? aviso.textContent.trim() : '', antes: antes, despues: despues };
    })()`);
    console.log('   8) pago con error y corrección: ' + JSON.stringify(mutePago));
    linea(mutePago.despues === mutePago.antes + 1, 'tras un monto inválido, el pago se puede corregir y registrar (' + mutePago.antes + ' → ' + mutePago.despues + ')');

    /* ── 9. Un aviso de error no debe llevarse el formulario ni lo escrito (Z-01) ── */
    const dialogo = await s.evaluar(`(function () {
      document.querySelectorAll('.notificacion').forEach(function (n) { n.remove(); });
      mostrarFormularioProspecto(null);
      document.getElementById('prospecto-nombre').value = 'Prospecto con teléfono malo';
      document.getElementById('prospecto-telefono').value = 'abc';
      document.getElementById('prospecto-notas').value = 'notas que no se deben perder';
      document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var form = document.getElementById('form-prospecto');
      var cuerpo = (document.getElementById('modal-body') || {}).textContent || '';
      var aviso = document.querySelector('.notificacion');
      return {
        formVivo: !!form,
        nombre: form ? document.getElementById('prospecto-nombre').value : null,
        notas: form ? document.getElementById('prospecto-notas').value : null,
        aviso: aviso ? aviso.textContent.trim() : '',
        textoModal: cuerpo.replace(/\\s+/g, ' ').trim().slice(0, 80)
      };
    })()`);
    await s.evaluar('(function () { try { cerrarModal(); } catch (e) { } return 1; })()');
    console.log('   9) aviso de error: ' + JSON.stringify(dialogo));
    linea(dialogo.formVivo === true, 'el aviso de error NO destruye el formulario de prospecto');
    linea(dialogo.nombre === 'Prospecto con teléfono malo' && dialogo.notas === 'notas que no se deben perder',
      'y lo que el practicante ya había escrito sigue ahí');

    /* ── 10. Dato VIEJO con teléfono basura: poder corregir otro campo (Y-07) ── */
    const viejo = await s.evaluar(`(function () {
      prospectos.push({ id: 'pro-viejo', nombre: 'Prospecto viejo', telefono: 'abc', email: '', faseActual: 'Interesado',
        historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2027-01-01' });
      editarProspecto('pro-viejo');
      document.getElementById('prospecto-nombre').value = 'Prospecto viejo corregido';
      document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var p = obtenerProspecto('pro-viejo');
      try { cerrarModal(); } catch (e) { }
      return { nombre: p ? p.nombre : null, telefono: p ? p.telefono : null };
    })()`);
    console.log('   10) dato viejo con teléfono basura: ' + JSON.stringify(viejo));
    linea(viejo.nombre === 'Prospecto viejo corregido', 'se puede corregir el nombre de un registro viejo con teléfono basura');

    /* ── 11 y 12. Duplicados de prospecto que hay que detectar (Y-11 acentos, Y-12 guiones) ── */
    const dupAcento = await s.evaluar(`(function () {
      prospectos.push({ id: 'pro-acento', nombre: 'Jose Unico', telefono: '5550008888', email: '', faseActual: 'Interesado',
        historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2027-01-01' });
      mostrarFormularioProspecto(null);
      document.getElementById('prospecto-nombre').value = 'JOSÉ ÚNICO';
      document.getElementById('prospecto-telefono').value = '5550008888';
      document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var avisa = !!document.getElementById('btn-confirmar-financiero');
      var texto = ((document.getElementById('modal-body') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70);
      try { cerrarModal(); } catch (e) { }
      return { avisa: avisa, texto: texto };
    })()`);
    await s.evaluar('(function () { try { cerrarModal(); } catch (e) { } return 1; })()');
    const dupGuion = await s.evaluar(`(function () {
      prospectos.push({ id: 'pro-guion', nombre: 'Prospecto Guiones', telefono: '5550009999', email: '', faseActual: 'Interesado',
        historialFases: [], notasGenerales: '', clienteId: null, fechaRegistro: '2027-01-01' });
      mostrarFormularioProspecto(null);
      document.getElementById('prospecto-nombre').value = 'PROSPECTO GUIONES';
      document.getElementById('prospecto-telefono').value = '555-000-9999';
      document.getElementById('form-prospecto').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var avisa = !!document.getElementById('btn-confirmar-financiero');
      var texto = ((document.getElementById('modal-body') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70);
      try { cerrarModal(); } catch (e) { }
      return { avisa: avisa, texto: texto };
    })()`);
    console.log('   11) duplicado con acentos: ' + JSON.stringify(dupAcento));
    console.log('   12) duplicado con guiones en el teléfono: ' + JSON.stringify(dupGuion));
    linea(dupAcento.avisa === true, 'el duplicado por ACENTOS avisa (mismo nombre sin acentos y mismo teléfono)');
    linea(dupGuion.avisa === true, 'el duplicado con GUIONES en el teléfono nuevo avisa');

    const foto = await s.evaluar(`(function () {
      var problemas = [];
      clientes.forEach(function (c) { (c.contratos || []).forEach(function (co) {
        var t = calcularTotalesContrato(co);
        if (Math.abs((t.totalAPagar - t.totalPagos) - t.saldoBruto) > 0.005) problemas.push('descuadre ' + c.nombre);
      }); });
      var co = obtenerCliente('cli-vc').contratos[0];
      return { problemas: problemas, total: calcularTotalesContrato(co).totalAPagar, pagado: calcularTotalesContrato(co).totalPagos, saldo: calcularTotalesContrato(co).saldoBruto };
    })()`);
    linea(foto.problemas.length === 0, 'el dinero sigue cuadrado: total ' + foto.total + ' · pagado ' + foto.pagado + ' · saldo ' + foto.saldo);
  } finally {
    const red = await s.cerrar();
    console.log('   Red: ' + red.peticiones + ' peticiones · a los datos reales: ' + (red.prohibidas.filter(h => h !== 'gstatic.com').length ? 'REVISAR' : 'ninguna'));
  }

  console.log('\n' + (fallos.length === 0 ? 'TODO EN VERDE: los arreglos críticos se comprueban de forma independiente.' : fallos.length + ' comprobaciones fallaron.'));
  process.exitCode = fallos.length === 0 ? 0 : 1;
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
