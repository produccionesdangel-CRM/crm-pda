/*
 * invariantes.mjs — lo que NUNCA se puede romper: clientes, contratos y pagos.
 * ---------------------------------------------------------------------------
 * Para qué: Jorge va a meter practicantes y dinámicas. Antes de tocar nada hay
 * que tener un instrumento que diga, con números, si el dinero sigue cuadrando.
 * Esta prueba:
 *   1. Levanta el CRM completo en la caja de arena (sin nube).
 *   2. Arma un escenario real: un cliente con un contrato y dos pagos, hechos por
 *      las MISMAS funciones que usan los formularios (`agregarPagoRapido`, que a
 *      su vez pasa por `validarMovimientoFinanciero` y `calcularTotalesContrato`).
 *   3. Revisa los invariantes financieros después de CADA paso. Si alguno falla,
 *      la prueba truena: eso sería dinero descuadrado.
 *   4. Intenta tres cosas que un practicante con prisa haría (pago mayor al
 *      saldo, pago repetido, monto con letras) y anota si la app BLOQUEA, PIDE
 *      CONFIRMACIÓN o REGISTRA en silencio.
 *   5. Deja una huella (hash) del estado financiero para comparar antes/después
 *      de cualquier cambio del CRM.
 *
 * Cómo se corre:  node pruebas\sandbox\invariantes.mjs
 * Sale con 0 si los invariantes se cumplen y con 1 si algo se descuadró.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparar, abrir, entrar, sembrar, revisarAislamiento } from './sandbox.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/* Revisión de invariantes + foto del estado financiero. Se evalúa DENTRO de la página. */
const FOTO = `(function () {
  var problemas = [];
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function cerca(a, b) { return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005; }
  var detalle = [], pagos = 0, cargos = 0, sumaPagos = 0, sumaAPagar = 0, sumaSaldos = 0;
  var codigos = {}, idsClientes = {};

  clientes.forEach(function (cli) {
    if (!cli || !cli.id) { problemas.push('Cliente sin id'); return; }
    if (idsClientes[cli.id]) problemas.push('Cliente duplicado: ' + cli.id);
    idsClientes[cli.id] = true;
    if (typeof cli.nombre !== 'string' || !cli.nombre.trim()) problemas.push('Cliente sin nombre: ' + cli.id);
    (cli.contratos || []).forEach(function (co) {
      if (!co || !co.id) { problemas.push('Contrato sin id en ' + cli.nombre); return; }
      var t = calcularTotalesContrato(co);
      var etiqueta = cli.nombre + ' / ' + (co.festejado || co.id);
      // ── Invariantes del dinero ──
      if (!cerca(t.totalAPagar, r2(t.precioEfectivo + t.totalCargos - t.descuento))) problemas.push('totalAPagar descuadrado en ' + etiqueta);
      if (!cerca(t.saldoBruto, r2(t.totalAPagar - t.totalPagos))) problemas.push('saldoBruto descuadrado en ' + etiqueta);
      if (!cerca(r2(t.saldoPendiente - t.saldoAFavor), t.saldoBruto)) problemas.push('saldo pendiente/a favor no cuadra con el bruto en ' + etiqueta);
      var suma = r2((t.pagosValidos || []).reduce(function (s, p) { return s + (Number(p.monto) || 0); }, 0));
      if (!cerca(suma, t.totalPagos)) problemas.push('la suma de pagos no da el total de pagos en ' + etiqueta);
      if (t.cantidadPagos !== (t.pagosValidos || []).length) problemas.push('cuenta de pagos distinta al arreglo en ' + etiqueta);
      [t.totalAPagar, t.totalPagos, t.saldoBruto, t.precioBase, t.descuento].forEach(function (n) {
        if (!isFinite(Number(n))) problemas.push('número inválido en ' + etiqueta + ': ' + n);
      });
      (t.pagosValidos || []).forEach(function (p) {
        if (p.codigo) { if (codigos[p.codigo]) problemas.push('Código de pago repetido: ' + p.codigo); codigos[p.codigo] = true; }
        if (!(Number(p.monto) > 0)) problemas.push('Pago con monto no positivo en ' + etiqueta + ': ' + p.monto);
      });
      // ── Invariantes de referencia ──
      (co.pagos || []).forEach(function (p) { if (p && !p.eliminado) pagos++; });
      (co.cargos || []).forEach(function (c) { if (c && !c.eliminado) cargos++; });

      detalle.push({
        clave: cli.nombre + '|' + (co.festejado || '') + '|' + co.id,
        totalAPagar: t.totalAPagar, totalPagos: t.totalPagos, saldoBruto: t.saldoBruto,
        precioBase: t.precioBase, descuento: t.descuento,
        cantidadPagos: t.cantidadPagos, cantidadCargos: t.cantidadCargos,
        alertas: (t.alertas || []).map(function (a) { return a.tipo; }).sort().join(',')
      });
      sumaPagos = r2(sumaPagos + t.totalPagos); sumaAPagar = r2(sumaAPagar + t.totalAPagar); sumaSaldos = r2(sumaSaldos + t.saldoBruto);
    });
  });
  detalle.sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });

  return {
    problemas: problemas,
    clientes: clientes.length, contratos: detalle.length, pagos: pagos, cargos: cargos,
    prospectos: (typeof prospectos !== 'undefined' ? prospectos.length : 0),
    campanias: (typeof campanias !== 'undefined' ? campanias.length : 0),
    participaciones: (typeof participaciones !== 'undefined' ? participaciones.length : 0),
    tareas: (typeof tareas !== 'undefined' ? tareas.length : 0),
    sumaAPagar: sumaAPagar, sumaPagos: sumaPagos, sumaSaldos: sumaSaldos,
    detalle: detalle
  };
})()`;

/* Crea el escenario crítico dentro de la caja (cliente + TRES contratos + tarea y prospecto).
   Cada ataque usa su propio contrato para que el resultado sea limpio y comparable. */
const ESCENARIO = `(function () {
  var hoy = new Date();
  var f = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
  function contrato(id, festejada, precio) {
    return {
      id: id, festejado: festejada, tipo: 'paquete', paqueteId: 'paq-inv', serviciosIds: [],
      precioBase: precio, precioFinal: precio, descuentoMonto: 0,
      fechaEvento: '2027-03-20', fechaContrato: f, estado: 'Activo', pagos: [], cargos: [], notas: 'Escenario de invariantes'
    };
  }
  clientes.push({
    id: 'cli-inv', nombre: 'Cliente Invariantes', telefono: '8781112233', email: 'invariantes@correo.com',
    estado: 'Activo', fechaRegistro: f,
    contratos: [contrato('con-inv', 'Festejada Invariantes', 20000), contrato('con-dup', 'Festejada Duplicados', 10000)]
  });
  prospectos.push({ id: 'pro-inv', nombre: 'Prospecto Invariantes', telefono: '8789998877', email: '', faseActual: 'Interesado', historialFases: [], fechaRegistro: f, notasGenerales: '', clienteId: null });
  tareas.push({ id: 'tar-inv', tipo: 'Llamada', descripcion: 'Tarea de invariantes', fecha: f, completada: false, clienteId: 'cli-inv', creadaPor: 'Prueba' });
  // Un paquete del catálogo, para poder editar el contrato como lo haría Jorge (el formulario exige paquete).
  paquetes.push({ id: 'paq-inv', nombre: 'Paquete Invariantes', descripcion: 'Paquete de la prueba', precio: 20000, descuento: 0, vigencia: '2027-12-31', estatus: 'Activo', items: [] });
  guardarDatos();
  return { ok: true, fecha: f };
})()`;

/* Un pago por el camino real del CRM. Devuelve qué hizo la app y el mensaje que mostró:
   'registrado' | 'confirmacion' | 'bloqueado'. */
function pagar(monto, contratoId) {
  return `(function () {
    var cid = ${JSON.stringify(contratoId || 'con-inv')};
    var co = obtenerCliente('cli-inv').contratos.filter(function (c) { return c.id === cid; })[0];
    var antes = co.pagos.length;
    agregarPagoRapido('cli-inv', cid);
    var campo = document.getElementById('pago-rapido-monto');
    if (!campo) return { resultado: 'sin-formulario' };
    campo.value = ${JSON.stringify(String(monto))};
    document.getElementById('form-pago-rapido').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    var despues = co.pagos.length;
    var titulo = (document.getElementById('modal-titulo') || {}).textContent || '';
    var aviso = document.querySelector('.notificacion');
    var hayConfirmar = !!document.getElementById('btn-confirmar-financiero');
    var resultado = 'registrado';
    if (hayConfirmar) resultado = 'confirmacion';
    else if (despues === antes) resultado = 'bloqueado';
    var avisos = [].slice.call(document.querySelectorAll('.notificacion')).map(function (n) { return n.textContent.trim(); });
    return { resultado: resultado, tituloModal: titulo, aviso: avisos.length ? avisos[avisos.length - 1] : '', pagosAntes: antes, pagosDespues: despues };
  })()`;
}

/* Limpia los avisos flotantes para que el siguiente ataque lea SU mensaje y no uno viejo. */
const LIMPIAR_AVISOS = `(function () { document.querySelectorAll('.notificacion').forEach(function (n) { n.remove(); }); return 1; })()`;

const CONFIRMAR = `(function () {
  var b = document.getElementById('btn-confirmar-financiero');
  if (!b) return 'sin-boton';
  b.click();
  return 'confirmado';
})()`;

const CERRAR = `(function () { try { cerrarModal(); } catch (e) { } return 1; })()`;

async function main() {
  const info = preparar();
  const s = await abrir({ info, ancho: 1280, alto: 900, movil: false, tactil: false });
  const fallos = [];
  const linea = (ok, texto) => { if (!ok) fallos.push(texto); console.log('   ' + (ok ? 'OK   ' : 'FALLA') + '  ' + texto); };
  const revisar = async (momento) => {
    const foto = await s.evaluar(FOTO);
    const huella = crypto.createHash('sha256').update(JSON.stringify(foto.detalle)).digest('hex').slice(0, 16);
    const ok = foto.problemas.length === 0;
    console.log('   foto [' + momento + '] clientes=' + foto.clientes + ' contratos=' + foto.contratos + ' pagos=' + foto.pagos +
      ' · a pagar=' + foto.sumaAPagar + ' · pagado=' + foto.sumaPagos + ' · saldo=' + foto.sumaSaldos + ' · huella=' + huella);
    if (!ok) foto.problemas.forEach(p => console.log('        ⚠ ' + p));
    linea(ok, 'invariantes financieros intactos [' + momento + ']' + (ok ? '' : ' (' + foto.problemas.length + ' problemas)'));
    return { foto, huella };
  };

  try {
    const entrada = await entrar(s);
    const aislado = await revisarAislamiento(s);
    linea(entrada === 'ok', 'entra al CRM de la caja sin Google');
    linea(aislado.aislado, 'la caja está aislada (sin base ni sesión; 0 peticiones a los datos reales)');
    const sembrado = await sembrar(s);
    linea(sembrado.prospectos === 20 && sembrado.campanias.length === 2, 'sembrado: 20 prospectos y 2 campañas (' + sembrado.prospectos + ' y ' + sembrado.campanias.length + ')');
    console.log('   campañas: ' + sembrado.campanias.map(c => c.nombre + ' [' + c.estado + '] ' + (c.participantes || 0) + ' part.').join(' · '));

    const esc = await s.evaluar(ESCENARIO);
    linea(esc.ok === true, 'escenario crítico creado (2 contratos: $20,000 y $10,000)');
    const base = await revisar('inicio');
    const deContrato = (foto, id) => (foto.detalle.find(d => d.clave.indexOf(id) !== -1) || {});

    // Dos pagos válidos por el camino real.
    const p1 = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar(5000)); await s.evaluar(CERRAR); await dormir(250);
    console.log('   pago 1 de 5000 → ' + p1.resultado + (p1.aviso ? ' · aviso: "' + p1.aviso + '"' : ''));
    linea(p1.resultado === 'registrado', 'el primer pago se registra sin trabas');
    const d1 = await revisar('un pago');

    const p2 = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar(3000)); await s.evaluar(CERRAR); await dormir(250);
    console.log('   pago 2 de 3000 → ' + p2.resultado + (p2.aviso ? ' · aviso: "' + p2.aviso + '"' : ''));
    const d2 = await revisar('dos pagos');
    linea(deContrato(d2.foto, 'con-inv').totalPagos === 8000 && deContrato(d2.foto, 'con-inv').saldoBruto === 12000,
      'en el contrato de 20,000 van 8,000 pagados y 12,000 de saldo');

    // Practicante con prisa 1: pago MAYOR al saldo (15000 sobre 12000). Debe confirmar, no registrar en silencio.
    const p3 = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar(15000));
    console.log('   pago de 15000 (mayor al saldo de 12000) → ' + p3.resultado + (p3.tituloModal ? ' ("' + p3.tituloModal + '")' : ''));
    if (p3.resultado === 'confirmacion') { await s.evaluar(CONFIRMAR); }
    await s.evaluar(CERRAR); await dormir(250);
    const d3 = await revisar('pago excedido');
    linea(p3.resultado === 'confirmacion', 'un pago mayor al saldo PIDE CONFIRMACIÓN (no entra en silencio)');
    if (p3.resultado === 'confirmacion') {
      linea(deContrato(d3.foto, 'con-inv').saldoBruto === -3000, 'tras confirmarlo ese contrato queda con saldo a favor de 3,000 (y el CRM lo avisa)');
    }

    // Practicante con prisa 2: monto con letras (el campo es numérico, así que además el navegador lo rechaza).
    const p4 = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar('mil pesos'));
    console.log('   monto "mil pesos" → ' + p4.resultado + ' · aviso: "' + (p4.aviso || p4.tituloModal) + '"');
    await s.evaluar(CERRAR); await dormir(200);
    linea(p4.resultado === 'bloqueado', 'un monto con letras se BLOQUEA (no se registra nada)');

    // Practicante con prisa 3: dos pagos idénticos seguidos en un contrato limpio (con-dup).
    const p5a = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar(1000, 'con-dup'));
    if (p5a.resultado === 'confirmacion') await s.evaluar(CONFIRMAR);
    await s.evaluar(CERRAR); await dormir(250);
    const p5b = await s.evaluar(LIMPIAR_AVISOS + ';' + pagar(1000, 'con-dup'));
    console.log('   mismo pago de 1000 dos veces → primero ' + p5a.resultado + ', segundo ' + p5b.resultado +
      (p5b.tituloModal ? ' ("' + p5b.tituloModal + '")' : '') + (p5b.aviso ? ' · aviso: "' + p5b.aviso + '"' : ''));
    const antesDeConfirmar = p5b.pagosDespues;
    if (p5b.resultado === 'confirmacion') await s.evaluar(CONFIRMAR);
    await s.evaluar(CERRAR); await dormir(200);
    linea(p5b.resultado !== 'registrado', 'el pago repetido NO entra en silencio (la app avisa o lo bloquea: ' + p5b.resultado + ')');
    const d5 = await revisar('pago repetido');
    linea(antesDeConfirmar === 1, 'el segundo pago solo se registra si el practicante lo confirma a propósito');
    if (p5b.resultado === 'confirmacion') {
      linea(deContrato(d5.foto, 'con-dup').cantidadPagos === 2, 'tras confirmar quedan los 2 pagos (1000 + 1000) y el saldo sigue cuadrando');
    }

    // Vida diaria: completar tarea, convertir prospecto, agregar el mismo prospecto dos veces a una campaña.
    const tarea = await s.evaluar(`(function () { alternarCompletarTarea('tar-inv'); var t = tareas.filter(function (x) { return x.id === 'tar-inv'; })[0]; return t ? t.completada : null; })()`);
    linea(tarea === true, 'completar una tarea funciona (fluidez)');
    const convertido = await s.evaluar(`(function () {
      var antesClientes = clientes.length;
      convertirProspecto('pro-inv');
      var p = prospectos.filter(function (x) { return x.id === 'pro-inv'; })[0];
      return { antes: antesClientes, despues: clientes.length, convertido: !!(p && p.clienteId) };
    })()`);
    linea(convertido.despues === convertido.antes + 1, 'convertir un prospecto crea UN cliente (no lo duplica)');
    const repetido = await s.evaluar(`(function () {
      var camp = App.almacen.db.campanias[0];
      var r = App.motor.agregarParticipaciones(camp.id, ['pro-inv', 'pro-inv'], { origen: 'Invariantes' });
      return { creadas: r.creadas.length, omitidas: r.omitidas.length, motivos: r.omitidas.map(function (o) { return o.motivo; }) };
    })()`);
    linea(repetido.omitidas >= 1, 'el mismo prospecto NO entra dos veces a la misma campaña (' + repetido.creadas + ' creada(s), ' + repetido.omitidas + ' omitida(s))');

    // LO MÁS DELICADO: editar un contrato que YA tiene pagos (como cuando Jorge corrige un festejado).
    const edicion = await s.evaluar(`(function () {
      var cli = obtenerCliente('cli-inv');
      var co = cli.contratos.filter(function (c) { return c.id === 'con-inv'; })[0];
      var suma = function (lista) { return (lista || []).reduce(function (s, p) { return s + (Number(p.monto) || 0); }, 0); };
      var antes = { pagos: (co.pagos || []).length, suma: suma(co.pagos), precio: co.precioBase, festejado: co.festejado };
      mostrarFormularioContrato('cli-inv', 'Edición de prueba', co);
      var form = document.getElementById('form-contrato');
      if (!form) return { error: 'no abrió el formulario del contrato' };
      var campo = document.getElementById('contrato-festejado');
      if (!campo) return { error: 'el formulario no trae el campo del festejado' };
      campo.value = antes.festejado + ' (corregido)';
      document.querySelectorAll('.notificacion').forEach(function (n) { n.remove(); });
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      var aviso = document.querySelector('.notificacion');
      var co2 = obtenerCliente('cli-inv').contratos.filter(function (c) { return c.id === 'con-inv'; })[0];
      return {
        antes: antes,
        despues: { pagos: (co2.pagos || []).length, suma: suma(co2.pagos), precio: co2.precioBase, festejado: co2.festejado },
        aviso: aviso ? aviso.textContent.trim() : ''
      };
    })()`);
    if (edicion.error) { linea(false, 'se pudo abrir y guardar la edición del contrato (' + edicion.error + ')'); }
    else {
      console.log('   edición del contrato: pagos ' + edicion.antes.pagos + '→' + edicion.despues.pagos +
        ' · suma ' + edicion.antes.suma + '→' + edicion.despues.suma + ' · festejado "' + edicion.despues.festejado + '"' +
        (edicion.aviso ? ' · aviso: "' + edicion.aviso + '"' : ''));
      linea(edicion.despues.festejado === edicion.antes.festejado + ' (corregido)', 'la edición del contrato SÍ se guarda (cambió el festejado)');
      linea(edicion.despues.pagos === edicion.antes.pagos && edicion.despues.suma === edicion.antes.suma,
        'editar el contrato NO pierde ni altera sus pagos (' + edicion.antes.pagos + ' pagos y ' + edicion.antes.suma + ' intactos)');
      linea(edicion.despues.precio === edicion.antes.precio, 'editar el contrato NO cambia el precio base por su cuenta');
    }

    const final = await revisar('final');
    linea(final.foto.clientes === base.foto.clientes + 1, 'al final hay exactamente un cliente más (el convertido)');
    linea(final.foto.contratos === base.foto.contratos, 'los contratos NO cambiaron de cantidad por las operaciones diarias');

    const salida = {
      cuando: new Date().toISOString(), sello: info.sello, sha256Caja: info.sha256Caja,
      base: { huella: base.huella, sumaAPagar: base.foto.sumaAPagar, sumaPagos: base.foto.sumaPagos },
      final: { huella: final.huella, sumaAPagar: final.foto.sumaAPagar, sumaPagos: final.foto.sumaPagos, sumaSaldos: final.foto.sumaSaldos, detalle: final.foto.detalle },
      aislamiento: { aislado: aislado.aislado, fugasDatos: aislado.fugasDatos },
      ataques: { pagoExcedido: p3.resultado, montoConLetras: p4.resultado, pagoRepetido: p5b.resultado },
      problemas: final.foto.problemas
    };
    fs.writeFileSync(path.join(AQUI, 'invariantes-resultado.json'), JSON.stringify(salida, null, 2), 'utf8');
    console.log('\n   Resultado guardado en pruebas\\sandbox\\invariantes-resultado.json');
    console.log('   Estado financiero final: ' + JSON.stringify(final.foto.detalle[0] || {}));
  } finally {
    const red = await s.cerrar();
    console.log('   Red: ' + red.peticiones + ' peticiones · a los datos reales: ' + (red.prohibidas.filter(h => h !== 'gstatic.com').length ? 'REVISAR' : 'ninguna') + ' · SDK bloqueado: ' + red.prohibidas.includes('gstatic.com'));
  }

  console.log('\n' + (fallos.length === 0 ? 'TODO EN VERDE: clientes, contratos y pagos siguen cuadrando.' : fallos.length + ' comprobaciones fallaron.'));
  process.exitCode = fallos.length === 0 ? 0 : 1;
}

main().catch(e => { console.error('❌ ' + (e && e.stack ? e.stack : e)); process.exitCode = 1; });
