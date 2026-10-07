/* ═══════════════════════════════════════════════════════════════════════
   Pruebas automatizadas del MOTOR DE CAMPAÑAS (sin navegador)
   -----------------------------------------------------------------------
   Recorre los 16 criterios de aceptación del documento
   `CRM_Campanas_Especificacion_Harness.md` (sección 51) más un bloque de
   regresión con las reglas de integridad de datos.

   Uso:   node pruebas\motor.pruebas.js
   Sale con código 0 si todo pasa, 1 si algo falla.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const path = require('path');

/* Los archivos de src/js se cuelgan de globalThis al cargarse, igual que en
   el navegador, así que basta con requerirlos en orden. */
require(path.join(__dirname, '..', 'src', 'js', '10-datos.js'));
require(path.join(__dirname, '..', 'src', 'js', '20-motor.js'));

const Util = globalThis.Util;
const Catalogos = globalThis.Catalogos;
const crearAlmacen = globalThis.crearAlmacen;
const crearMotor = globalThis.crearMotor;

/* ───────────── Marco de pruebas ───────────── */

let total = 0;
let fallos = 0;
let grupoActual = '';

function grupo(nombre) {
    grupoActual = nombre;
    console.log('\n══ ' + nombre + ' ══');
}

function ok(condicion, descripcion, detalle) {
    total++;
    if (condicion) {
        console.log('  PASS  ' + descripcion);
    } else {
        fallos++;
        console.log('  FAIL  ' + descripcion + (detalle !== undefined ? '  →  ' + JSON.stringify(detalle) : ''));
    }
}

function igual(a, b, descripcion) {
    ok(a === b, descripcion, { esperado: b, obtenido: a });
}

function incluye(lista, valor, descripcion) {
    ok(Array.isArray(lista) && lista.indexOf(valor) !== -1, descripcion, lista);
}

/* Cada prueba trabaja sobre datos limpios y reproducibles. */
function nuevo() {
    const almacen = crearAlmacen({ autoguardado: false });
    return { almacen, motor: crearMotor(almacen), db: almacen.db };
}

/* Campaña mínima lista para operar. */
function campaniaLista(motor, extras) {
    const base = Object.assign({
        nombre: 'Campaña de prueba',
        tipo: 'Captación',
        objetivoPrincipal: 'Conseguir 3 contratos',
        fechaInicio: Util.sumarDias(Util.hoy(), -1),
        fechaFin: Util.sumarDias(Util.hoy(), 30),
        etapas: [
            { id: 'et_1', nombre: 'Registrado', orden: 1, descripcion: '', esInicial: true, esFinal: false, resultadoTipo: 'ninguno' },
            { id: 'et_2', nombre: 'Contactado', orden: 2, descripcion: '', esInicial: false, esFinal: false, resultadoTipo: 'ninguno' },
            { id: 'et_3', nombre: 'Convertido', orden: 3, descripcion: '', esInicial: false, esFinal: true, resultadoTipo: 'convertido' }
        ],
        publicoObjetivo: { fuentes: ['prospectosExistentes'], descripcion: 'prueba' },
        metas: { registros: 10, contratos: 3, valorConvertido: 60000 }
    }, extras || {});
    const camp = motor.crearCampania(base);
    motor.cambiarEstadoCampania(camp.id, 'activa');
    return camp;
}

function prospectoDePrueba(motor, nombre) {
    const r = motor.crearProspecto({ nombre: nombre || 'Prospecto de prueba', telefono: '555-000-0000', ciudad: 'Ciudad de México', origen: 'Instagram', tipoEvento: 'Boda', presupuesto: 20000 });
    return r.prospecto;
}

/* ═══════════════════════════════════════════════════════════════════════ */

console.log('Pruebas del motor de campañas — CRM Lite v0.1');

/* ── Caso 1 ── */
grupo('Caso 1 · Crear una campaña en estado borrador');
{
    const { motor, db } = nuevo();
    const antes = db.campanias.length;
    const camp = motor.crearCampania({ nombre: 'Campaña nueva', tipo: 'Promoción' });
    igual(camp.estado, 'borrador', 'La campaña nace en estado borrador');
    igual(db.campanias.length, antes + 1, 'La campaña se guarda en el almacén');
    ok((camp.etapas || []).length > 0, 'La campaña trae un flujo inicial por omisión');
    ok(motor.etapaInicial(camp) !== null, 'Tiene una etapa inicial definida');
    const partes = motor.participacionesDeCampania(camp.id);
    igual(partes.length, 0, 'En borrador no genera participaciones');
    igual(motor.tareasDeCampania(camp.id).length, 0, 'En borrador no genera tareas');
}

/* ── Caso 2 ── */
grupo('Caso 2 · Configurar objetivos, fechas, etapas y metas');
{
    const { motor } = nuevo();
    const camp = motor.crearCampania({ nombre: 'Bodas 2027' });
    const r = motor.actualizarCampania(camp.id, {
        objetivoPrincipal: 'Cerrar 12 bodas',
        objetivosSecundarios: ['Posicionar el paquete Premium'],
        fechaInicio: Util.sumarDias(Util.hoy(), 1),
        fechaFin: Util.sumarDias(Util.hoy(), 90),
        etapas: [
            { id: 'e1', nombre: 'Registro', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' },
            { id: 'e2', nombre: 'Cita', orden: 2, esInicial: false, esFinal: false, resultadoTipo: 'interesado' },
            { id: 'e3', nombre: 'Cierre', orden: 3, esInicial: false, esFinal: true, resultadoTipo: 'convertido' }
        ],
        metas: { registros: 40, contratos: 12 }
    });
    ok(r.ok, 'Los cambios se aplican');
    const v = motor.validarCampania(camp, { paraActivar: true });
    ok(v.ok, 'La campaña pasa la validación para activar', v.errores);
    const activada = motor.activarCampania(camp.id);
    ok(activada.ok, 'Se puede activar');
    igual(camp.estado, 'activa', 'Queda activa');

    /* Fechas incoherentes: se detectan. */
    const mala = motor.crearCampania({ nombre: 'Fechas malas', fechaInicio: '2026-05-10', fechaFin: '2026-05-01' });
    const vm = motor.validarCampania(mala, {});
    ok(!vm.ok && vm.errores.some(function (e) { return e.indexOf('fecha de fin') !== -1; }), 'Detecta fecha fin anterior al inicio');

    /* Sin objetivo principal no se activa. */
    const sinObjetivo = motor.crearCampania({ nombre: 'Sin objetivo', fechaInicio: Util.hoy() });
    const vs = motor.validarCampania(sinObjetivo, { paraActivar: true });
    ok(!vs.ok, 'Sin objetivo principal no pasa la validación de activación');
    const na = motor.activarCampania(sinObjetivo.id);
    ok(!na.ok, 'No se puede activar una campaña incompleta');
    igual(sinObjetivo.estado, 'borrador', 'Se queda en borrador');
}

/* ── Caso 3 ── */
grupo('Caso 3 · Agregar un prospecto existente');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor);
    const p = prospectoDePrueba(motor, 'Ana Existente');
    const r = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id, origen: 'Instagram' });
    ok(r.ok, 'Se agrega el prospecto existente', r.errores);
    igual(r.participacion.etapaId, 'et_1', 'Entra en la etapa inicial');
    igual(r.participacion.estado, 'registrada', 'Queda registrada');
    igual(motor.participacionesDeCampania(camp.id).length, 1, 'La campaña tiene un participante');

    /* No se duplica accidentalmente. */
    const dup = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id });
    ok(!dup.ok && dup.codigo === 'duplicado', 'Bloquea la participación duplicada');
    const forzada = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id, forzar: true });
    ok(forzada.ok, 'Con acción explícita sí se permite una segunda participación');
    igual(motor.participacionesDeCampania(camp.id).length, 2, 'Quedan dos participaciones del mismo prospecto');

    /* Referencias inexistentes: no se crean huérfanos. */
    const fantasma = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: 'pro_que_no_existe' });
    ok(!fantasma.ok && fantasma.codigo === 'sin-prospecto', 'No crea participación de un prospecto inexistente');
    const sinCampania = motor.agregarParticipacion({ campaniaId: 'cmp_inexistente', prospectoId: p.id });
    ok(!sinCampania.ok && sinCampania.codigo === 'sin-campania', 'No crea participación en una campaña inexistente');
}

/* ── Caso 4 ── */
grupo('Caso 4 · Crear un prospecto nuevo desde la campaña');
{
    const { motor, db } = nuevo();
    const camp = campaniaLista(motor);
    const antes = db.prospectos.length;
    const r = motor.crearProspectoYparticipar(camp.id, { nombre: 'Karla Nueva', telefono: '555-111-2222', origen: 'Facebook', tipoEvento: 'XV Años' }, { origen: 'Facebook' });
    ok(r.ok, 'Crea el prospecto y su participación', r.errores);
    igual(db.prospectos.length, antes + 1, 'El prospecto se guarda una sola vez');
    igual(r.participacion.prospectId, r.prospecto.id, 'La participación apunta a ese prospecto');
    igual(motor.participacionesDeCampania(camp.id).length, 1, 'La campaña lo tiene como participante');

    /* Un prospecto sin nombre no se crea. */
    const malo = motor.crearProspectoYparticipar(camp.id, { nombre: '   ' });
    ok(!malo.ok, 'Rechaza un prospecto sin nombre');
}

/* ── Caso 5 ── */
grupo('Caso 5 · El mismo prospecto en una segunda campaña sin duplicarlo');
{
    const { motor, db } = nuevo();
    const campA = campaniaLista(motor, { nombre: 'Campaña A', etapas: [{ id: 'a1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: true, resultadoTipo: 'ninguno' }] });
    const campB = campaniaLista(motor, { nombre: 'Campaña B', etapas: [{ id: 'b1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: true, resultadoTipo: 'ninguno' }] });
    const p = prospectoDePrueba(motor, 'Ricardo Compartido');
    const antes = db.prospectos.length;

    ok(motor.agregarParticipacion({ campaniaId: campA.id, prospectoId: p.id }).ok, 'Participa en la campaña A');
    ok(motor.agregarParticipacion({ campaniaId: campB.id, prospectoId: p.id }).ok, 'Participa en la campaña B');
    igual(db.prospectos.length, antes, 'NO se duplica el prospecto');
    const partes = motor.participacionesDeProspecto(p.id);
    igual(partes.length, 2, 'Tiene dos participaciones independientes');
    ok(partes[0].id !== partes[1].id, 'Cada participación tiene su propio identificador');
    ok(!('campania' in p), 'El prospecto no guarda un campo único de campaña');
}

/* ── Caso 6 ── */
grupo('Caso 6 · Historial de campañas desde el prospecto');
{
    const { motor } = nuevo();
    const campA = campaniaLista(motor, { nombre: 'Campaña histórica A' });
    const campB = campaniaLista(motor, { nombre: 'Campaña histórica B' });
    const p = prospectoDePrueba(motor, 'Paulina Historial');
    motor.agregarParticipacion({ campaniaId: campA.id, prospectoId: p.id });
    motor.agregarParticipacion({ campaniaId: campB.id, prospectoId: p.id });

    const resumen = motor.resumenCampaniasDeProspecto(p.id);
    igual(resumen.total, 2, 'El resumen cuenta las dos participaciones');
    igual(resumen.campaniasActivas, 2, 'Cuenta las campañas activas');
    ok(resumen.ultimaCampania !== null, 'Identifica la última campaña');
    const nombres = resumen.participaciones.map(function (x) { return x.campaignId; });
    incluye(nombres, campA.id, 'El historial incluye la campaña A');
    incluye(nombres, campB.id, 'El historial incluye la campaña B');
}

/* ── Caso 7 ── */
grupo('Caso 7 · Consultar desde la campaña todos sus participantes');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor);
    const ids = [];
    for (let i = 1; i <= 4; i++) ids.push(prospectoDePrueba(motor, 'Participante ' + i).id);
    const r = motor.agregarParticipaciones(camp.id, ids);
    igual(r.creadas.length, 4, 'Se agregan los cuatro prospectos');
    igual(motor.participacionesDeCampania(camp.id).length, 4, 'La campaña los lista a todos');
    ok(motor.participacionesDeCampania(camp.id).every(function (x) { return x.campaignId === camp.id; }), 'Todas las participaciones pertenecen a la campaña');

    /* Repetir la operación no duplica ni rompe nada. */
    const r2 = motor.agregarParticipaciones(camp.id, ids);
    igual(r2.creadas.length, 0, 'No vuelve a agregar a los que ya estaban');
    igual(r2.omitidas.length, 4, 'Los reporta como omitidos explicando el motivo');
    igual(motor.participacionesDeCampania(camp.id).length, 4, 'El total sigue siendo cuatro');
}

/* ── Caso 8 ── */
grupo('Caso 8 · Cambiar de etapa NO cambia la fase comercial (salvo regla explícita)');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor);
    const p = prospectoDePrueba(motor, 'Jorge Etapas');
    p.faseComercial = 'Negociación';
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;

    const r = motor.cambiarEtapa(part.id, 'et_2');
    ok(r.ok, 'Se cambia la etapa');
    igual(part.etapaId, 'et_2', 'La participación avanza de etapa');
    igual(p.faseComercial, 'Negociación', 'La fase comercial del prospecto NO se toca');
    ok(part.historial.length >= 2, 'El cambio de etapa queda en el historial de la participación');
    const ultimo = part.historial[part.historial.length - 1];
    igual(ultimo.campo, 'etapa', 'El historial registra el campo etapa');
    igual(ultimo.valorNuevo, 'Contactado', 'El historial guarda el valor nuevo');

    /* Con la regla explícita encendida, sí se sincroniza. */
    camp.configuracion.sincronizarFaseComercial = { activo: true, mapa: { et_2: 'Cotización' } };
    motor.cambiarEtapa(part.id, 'et_1');
    const r2 = motor.cambiarEtapa(part.id, 'et_2');
    ok(r2.ok, 'Se vuelve a cambiar de etapa con la regla activada');
    igual(p.faseComercial, 'Cotización', 'Con la regla explícita la fase comercial se actualiza');

    /* La etapa con resultadoTipo convertido mueve el estado de la participación. */
    const r3 = motor.cambiarEtapa(part.id, 'et_3');
    ok(r3.ok, 'Se mueve a la etapa de conversión');
    igual(part.estado, 'convertida', 'El estado de la participación refleja el resultado de la etapa');
}

/* ── Caso 9 ── */
grupo('Caso 9 · Tarea asociada a una participación (sistema único de tareas)');
{
    const { motor, db } = nuevo();
    const camp = campaniaLista(motor, {
        plantillasTareas: [
            { id: 'plt_1', nombre: 'Llamar para confirmar', tipo: 'Contactar', descripcion: 'Confirmar datos', prioridad: 'Alta', responsable: 'Jorge', desplazamientoDias: 1, etapaOrigen: 'et_1', etapaDestino: 'et_2', activa: true }
        ]
    });
    const p = prospectoDePrueba(motor, 'Alonso Tareas');
    const antes = db.tareas.length;
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;

    const generadas = motor.tareasDeParticipacion(part.id);
    igual(generadas.length, 1, 'La plantilla de la etapa inicial generó una tarea');
    igual(db.tareas.length, antes + 1, 'La tarea vive en el sistema de tareas general');
    const t = generadas[0];
    igual(t.participacionId, part.id, 'La tarea apunta a la participación');
    igual(t.campaniaId, camp.id, 'La tarea apunta a la campaña');
    igual(t.prospectoId, p.id, 'La tarea apunta al prospecto');
    igual(t.estado, 'pendiente', 'Nace pendiente');
    igual(t.prioridad, 'Alta', 'Respeta la prioridad de la plantilla');
    igual(t.fecha, Util.sumarDias(Util.hoy(), 1), 'Respeta los días de desplazamiento');
    incluye(part.tareasRelacionadas, t.id, 'La participación guarda la referencia de la tarea');

    /* No se duplican las tareas al volver a entrar a la misma etapa. */
    motor.cambiarEtapa(part.id, 'et_2');
    motor.cambiarEtapa(part.id, 'et_1');
    igual(motor.tareasFiltradas({ participacionId: part.id, estado: 'pendiente' }).length, 1, 'No duplica la tarea pendiente de la misma plantilla');
}

/* ── Caso 10 ── */
grupo('Caso 10 · La tarea aparece en el calendario existente');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor);
    const p = prospectoDePrueba(motor, 'Carmen Calendario');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;
    const fecha = Util.sumarDias(Util.hoy(), 2);
    const t = motor.crearTarea({ titulo: 'Enviar cotización', tipo: 'Enviar cotización', fecha: fecha, participacionId: part.id, campaniaId: camp.id, prospectoId: p.id }).tarea;

    const delDia = motor.tareasFiltradas({ desde: fecha, hasta: fecha });
    ok(delDia.some(function (x) { return x.id === t.id; }), 'El calendario del día incluye la tarea');
    const deCampania = motor.tareasFiltradas({ tipo: 'campanias' });
    ok(deCampania.some(function (x) { return x.id === t.id; }), 'El filtro "solo de campañas" la incluye');
    const sueltas = motor.tareasFiltradas({ tipo: 'manuales' });
    ok(!sueltas.some(function (x) { return x.id === t.id; }), 'No aparece entre las tareas sueltas');

    /* Completar la tarea mueve el seguimiento de la participación. */
    const r = motor.completarTarea(t.id, { resultado: 'seEnvioCotizacion', nota: 'Se envió por WhatsApp', fechaProximoSeguimiento: Util.sumarDias(Util.hoy(), 5) });
    ok(r.ok, 'La tarea se completa');
    igual(t.estado, 'completada', 'Queda marcada como completada');
    igual(part.resultado, 'seEnvioCotizacion', 'El resultado del contacto llega a la participación');
    igual(part.fechaUltimoContacto, Util.hoy(), 'Se registra el último contacto');
    igual(part.fechaProximoSeguimiento, Util.sumarDias(Util.hoy(), 5), 'Se registra el próximo seguimiento');
}

/* ── Caso 11 ── */
grupo('Caso 11 · Asignar un beneficio u oferta a una participación');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor, {
        beneficios: [{ id: 'ben_1', nombre: 'Sesión de cortesía', tipo: 'Sesión', valorReferencia: 2900, condiciones: 'Al contratar', vigencia: { fechaInicio: '', fechaFin: '', diasVigencia: 30 } }],
        ofertas: [{ id: 'oft_1', nombre: 'Boda Premium de temporada', paqueteId: 'paq_boda_premium', servicioId: 'srv_dron', precioEspecial: 28500, condiciones: 'Precio de temporada', vigencia: { fechaInicio: '', fechaFin: '2027-04-30', diasVigencia: 0 } }]
    });
    const p = prospectoDePrueba(motor, 'María Ofertas');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;

    const ro = motor.asignarOferta(part.id, 'oft_1');
    ok(ro.ok, 'Se asigna la oferta', ro.errores);
    igual(part.ofertaAsignada.nombre, 'Boda Premium de temporada', 'La oferta queda en la participación');
    igual(part.ofertaAsignada.precioEspecial, 28500, 'Guarda el precio especial');
    igual(part.ofertaAsignada.precioCatalogo, 32000 + 4200, 'Guarda el precio de catálogo sumado (paquete + servicio)');
    ok(!!part.ofertaAsignada.asignadaEn, 'Guarda la fecha de asignación');
    igual(part.valorPotencial, 28500, 'El valor potencial toma el precio de la oferta');

    const rb = motor.asignarBeneficio(part.id, 'ben_1');
    ok(rb.ok, 'Se asigna el beneficio');
    igual(part.beneficioAsignado.nombre, 'Sesión de cortesía', 'El beneficio queda guardado');
    igual(part.beneficioAsignado.valorReferencia, 2900, 'Conserva el valor de referencia');

    /* Oferta o beneficio inexistente: se rechaza. */
    ok(!motor.asignarOferta(part.id, 'oft_fantasma').ok, 'Rechaza una oferta que no existe en la campaña');
}

/* ── Caso 12 ── */
grupo('Caso 12 · El historial conserva el beneficio aunque la campaña cambie después');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor, {
        beneficios: [{ id: 'ben_x', nombre: 'Beneficio X', tipo: 'Descuento', valorReferencia: 1500, condiciones: 'Condición original', vigencia: { fechaInicio: '', fechaFin: '', diasVigencia: 10 } }],
        ofertas: [{ id: 'oft_x', nombre: 'Oferta X', paqueteId: 'paq_boda_esencial', servicioId: '', precioEspecial: 17000, condiciones: 'Condición original', vigencia: { fechaInicio: '', fechaFin: '', diasVigencia: 0 } }]
    });
    const p = prospectoDePrueba(motor, 'Diego Historial');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;
    motor.asignarBeneficio(part.id, 'ben_x');
    motor.asignarOferta(part.id, 'oft_x');

    /* El administrador cambia la configuración de la campaña. */
    camp.beneficios[0].nombre = 'Beneficio Y';
    camp.beneficios[0].valorReferencia = 9000;
    camp.ofertas[0].precioEspecial = 25000;
    camp.ofertas[0].nombre = 'Oferta Y';

    igual(part.beneficioAsignado.nombre, 'Beneficio X', 'El beneficio histórico NO cambió');
    igual(part.beneficioAsignado.valorReferencia, 1500, 'El valor histórico se conserva');
    igual(part.ofertaAsignada.precioEspecial, 17000, 'El precio ofrecido se conserva');
    igual(part.ofertaAsignada.nombre, 'Oferta X', 'El nombre de la oferta entregada se conserva');

    /* Una participación nueva sí toma la configuración actual. */
    const p2 = prospectoDePrueba(motor, 'Prospecto Nuevo');
    const part2 = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p2.id }).participacion;
    motor.asignarBeneficio(part2.id, 'ben_x');
    igual(part2.beneficioAsignado.nombre, 'Beneficio Y', 'Una participación nueva toma la configuración vigente');
    igual(part2.beneficioAsignado.valorReferencia, 9000, 'Y su valor actualizado');
}

/* ── Caso 13 ── */
grupo('Caso 13 · Registrar conversión y vincularla con el cliente existente');
{
    const { motor, db } = nuevo();
    const camp = campaniaLista(motor, {
        ofertas: [{ id: 'oft_c', nombre: 'Oferta de cierre', paqueteId: 'paq_boda_premium', servicioId: '', precioEspecial: 30000, condiciones: '', vigencia: { fechaInicio: '', fechaFin: '', diasVigencia: 0 } }]
    });
    const p = prospectoDePrueba(motor, 'Alonso Conversión');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;
    motor.asignarOferta(part.id, 'oft_c');
    const clientesAntes = db.clientes.length;

    const r = motor.convertirParticipacion(part.id, { valorConvertido: 30000 });
    ok(r.ok, 'La conversión se registra', r.errores);
    igual(db.clientes.length, clientesAntes + 1, 'Se crea un cliente');
    igual(r.cliente.prospectoOrigenId, p.id, 'El cliente apunta al mismo prospecto (no se duplica la persona)');
    igual(r.cliente.participacionOrigenId, part.id, 'El cliente queda ligado a la participación');
    igual(r.cliente.campaniaOrigenId, camp.id, 'Se conserva el vínculo con la campaña');
    igual(r.cliente.paqueteId, 'paq_boda_premium', 'El paquete contratado viene de la oferta asignada');
    igual(p.clienteId, r.cliente.id, 'El prospecto queda vinculado a su cliente');
    ok(p.convertido, 'El prospecto queda marcado como convertido');
    igual(part.valorConvertido, 30000, 'La participación guarda el valor convertido');
    igual(part.estado, 'convertida', 'La participación queda convertida');
    igual(part.etapaId, 'et_3', 'Se mueve a la etapa de conversión de la campaña');

    const repetida = motor.convertirParticipacion(part.id, { valorConvertido: 999 });
    ok(!repetida.ok && repetida.codigo === 'ya-convertida', 'No se puede convertir dos veces la misma participación');

    /* Convertir otra participación del MISMO prospecto reutiliza el cliente. */
    const camp2 = campaniaLista(motor, { nombre: 'Segunda campaña', etapas: [{ id: 'z1', nombre: 'Único', orden: 1, esInicial: true, esFinal: true, resultadoTipo: 'ninguno' }] });
    const part2 = motor.agregarParticipacion({ campaniaId: camp2.id, prospectoId: p.id }).participacion;
    const r2 = motor.convertirParticipacion(part2.id, { valorConvertido: 5000 });
    ok(r2.ok, 'Se puede convertir otra participación del mismo prospecto');
    igual(r2.cliente.id, r.cliente.id, 'Se reutiliza el cliente existente');
    igual(db.clientes.length, clientesAntes + 1, 'No se crea un cliente duplicado');
}

/* ── Caso 14 ── */
grupo('Caso 14 · Finalizar una campaña sin perder información histórica');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor);
    const p = prospectoDePrueba(motor, 'Fernanda Cierre');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;
    const tarea = motor.crearTarea({ titulo: 'Tarea histórica', fecha: Util.hoy(), participacionId: part.id, campaniaId: camp.id });
    const participantesAntes = motor.participacionesDeCampania(camp.id).length;
    const entradasAntes = motor.historialDe('participacion', part.id).length;

    const r = motor.finalizarCampania(camp.id);
    ok(r.ok, 'La campaña se finaliza');
    igual(camp.estado, 'finalizada', 'Queda en estado finalizada');
    igual(motor.participacionesDeCampania(camp.id).length, participantesAntes, 'No se pierde ningún participante');
    igual(motor.tareasDeCampania(camp.id).length, 1, 'Las tareas históricas se conservan');
    ok(motor.historialDe('participacion', part.id).length >= entradasAntes, 'El historial de la participación se conserva');

    /* Ya no recibe participaciones nuevas. */
    const p2 = prospectoDePrueba(motor, 'Tarde Llegó');
    const nuevoIngreso = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p2.id });
    ok(!nuevoIngreso.ok && nuevoIngreso.codigo === 'campania-cerrada', 'Una campaña finalizada no recibe nuevas participaciones');
    const conForzar = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p2.id, forzar: true });
    ok(conForzar.ok, 'Con acción explícita sí se permite (queda registrado)');

    /* La configuración estructural queda congelada. */
    const cambio = motor.actualizarCampania(camp.id, { etapas: [] });
    ok(!cambio.ok, 'No se pueden cambiar las etapas de una campaña finalizada');
    const cambioTexto = motor.actualizarCampania(camp.id, { descripcion: 'Nota posterior al cierre' });
    ok(cambioTexto.ok, 'Sí se pueden anotar cosas que no rompen el historial');

    /* No se puede volver a activar. */
    ok(!motor.activarCampania(camp.id).ok, 'Una campaña finalizada no se reabre');

    /* Tampoco se borra: se cancela. */
    const borrar = motor.eliminarCampania(camp.id);
    ok(!borrar.ok, 'No se puede borrar una campaña con historial');
    const cancelar = motor.cancelarCampania(camp.id);
    ok(cancelar.ok, 'Se puede dejar como cancelada conservando todo');
}

/* ── Caso 15 ── */
grupo('Caso 15 · Resultados y métricas de la campaña');
{
    const { motor } = nuevo();
    const camp = campaniaLista(motor, { metas: { registros: 4, contactados: 2, contratos: 1, valorConvertido: 20000 } });
    const personas = ['Uno', 'Dos', 'Tres', 'Cuatro'].map(function (n) { return prospectoDePrueba(motor, 'Prospecto ' + n); });
    personas.forEach(function (p) { motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id, valorPotencial: 10000 }); });

    const partes = motor.participacionesDeCampania(camp.id);
    motor.cambiarEstadoParticipacion(partes[0].id, 'rechazada');
    motor.registrarContacto(partes[1].id, { resultado: 'respondioInteresado', fechaProximoSeguimiento: Util.sumarDias(Util.hoy(), 2) });
    motor.registrarContacto(partes[2].id, { resultado: 'seEnvioCotizacion' });
    motor.convertirParticipacion(partes[3].id, { valorConvertido: 19500 });

    const e = motor.estadisticasCampania(camp.id);
    igual(e.totalParticipantes, 4, 'Cuenta los cuatro participantes');
    igual(e.rechazados, 1, 'Cuenta un rechazado');
    igual(e.contratos, 1, 'Cuenta una conversión');
    igual(e.validos, 3, 'Cuenta tres participantes válidos');
    igual(e.contactados, 2, 'Cuenta dos contactados');
    igual(e.valorConvertido, 19500, 'Suma el valor convertido');
    igual(e.valorPotencial, 40000, 'Suma el valor potencial');
    igual(e.tasaConversion, 25, 'Calcula la tasa de conversión');

    const embudo = motor.embudo(camp.id);
    igual(embudo[0].cantidad, 4, 'El embudo arranca con el total de participantes');
    igual(embudo[embudo.length - 1].cantidad, 1, 'El embudo termina con las conversiones');
    ok(embudo.length >= 5, 'El embudo incluye la validación y cada etapa configurable');

    const metas = motor.metasVsResultados(camp.id);
    const metaRegistros = metas.filter(function (m) { return m.clave === 'registros'; })[0];
    igual(metaRegistros.real, 4, 'Compara la meta de registros con el resultado real');
    igual(metaRegistros.pct, 100, 'Calcula el porcentaje de cumplimiento');

    const resumen = motor.resumenGlobal();
    ok(resumen.participaciones >= 4, 'El resumen global suma las participaciones');
    ok(resumen.convertidas >= 1, 'El resumen global cuenta las conversiones');

    const seg = motor.seguimientos();
    ok(seg.proximos.some(function (f) { return f.participacion.id === partes[1].id; }), 'El seguimiento programado aparece en "próximos"');
    ok(seg.sinProgramar.length >= 1, 'Detecta participaciones sin seguimiento programado');
}

/* ── Caso 16 ── */
grupo('Caso 16 · Filtrar prospectos elegibles usando el historial de campañas');
{
    const { motor } = nuevo();
    const anterior = campaniaLista(motor, { nombre: 'Campaña anterior' });
    const nuevaCampania = campaniaLista(motor, { nombre: 'Campaña nueva' });

    const participoYConvirtio = prospectoDePrueba(motor, 'Participó y convirtió');
    const participoSinConvertir = prospectoDePrueba(motor, 'Participó sin convertir');
    const noParticipo = prospectoDePrueba(motor, 'Nunca ha participado');
    const pBoda = prospectoDePrueba(motor, 'Solo bodas'); pBoda.tipoEvento = 'Boda';
    const pXV = prospectoDePrueba(motor, 'Solo XV'); pXV.tipoEvento = 'XV Años';

    const pa = motor.agregarParticipacion({ campaniaId: anterior.id, prospectoId: participoYConvirtio.id }).participacion;
    motor.convertirParticipacion(pa.id, { valorConvertido: 1000 });
    motor.agregarParticipacion({ campaniaId: anterior.id, prospectoId: participoSinConvertir.id });

    /* Reactivación: participó antes y no convirtió. */
    const campReactivacion = motor.crearCampania({
        nombre: 'Reactivación', objetivoPrincipal: 'Recuperar', fechaInicio: Util.hoy(),
        etapas: [{ id: 'r1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }],
        publicoObjetivo: { fuentes: ['participantesAnteriores'], descripcion: '' },
        criteriosElegibilidad: [
            { id: 'c1', tipo: 'participoEnCampania', valor: anterior.id },
            { id: 'c2', tipo: 'participacionConvertida', valor: 'no' }
        ]
    });
    const candidatos = motor.candidatos(campReactivacion, { incluirYaParticipan: true, incluirNoElegibles: true });
    const elegibles = candidatos.filter(function (c) { return c.elegible; });
    ok(elegibles.some(function (c) { return c.prospecto.id === participoSinConvertir.id; }), 'El que participó y no convirtió es candidato');
    ok(!elegibles.some(function (c) { return c.prospecto.id === participoYConvirtio.id; }), 'El que ya convirtió queda fuera');
    ok(!elegibles.some(function (c) { return c.prospecto.id === noParticipo.id; }), 'El que nunca participó queda fuera de la reactivación');

    /* Captación: sin participación previa. */
    const campCaptacion = motor.crearCampania({
        nombre: 'Captación', objetivoPrincipal: 'Captar', fechaInicio: Util.hoy(),
        etapas: [{ id: 'k1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }],
        publicoObjetivo: { fuentes: ['prospectosNuevos'], descripcion: '' },
        criteriosElegibilidad: [{ id: 'c3', tipo: 'sinParticipacionPrevia', valor: '' }]
    });
    const cand2 = motor.candidatos(campCaptacion, { incluirNoElegibles: true });
    ok(cand2.some(function (c) { return c.prospecto.id === noParticipo.id && c.elegible; }), 'El que nunca participó es candidato de captación');
    ok(!cand2.some(function (c) { return c.prospecto.id === participoSinConvertir.id && c.elegible; }), 'El que ya participó no es candidato de captación');

    /* Criterio combinado: tipo de evento + historial. */
    const campBodas = motor.crearCampania({
        nombre: 'Bodas', objetivoPrincipal: 'Bodas', fechaInicio: Util.hoy(),
        etapas: [{ id: 'm1', nombre: 'Inicio', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }],
        publicoObjetivo: { fuentes: ['prospectosExistentes'], descripcion: '' },
        criteriosElegibilidad: [
            { id: 'c4', tipo: 'tipoEventoEs', valor: 'Boda' },
            { id: 'c5', tipo: 'noParticipoEnCampania', valor: anterior.id }
        ]
    });
    const cand3 = motor.candidatos(campBodas, {});
    ok(cand3.length >= 1, 'Encuentra candidatos que cumplen varios criterios a la vez');
    ok(cand3.every(function (c) { return c.prospecto.tipoEvento === 'Boda'; }), 'Todos los candidatos son de boda');
    ok(!cand3.some(function (c) { return c.prospecto.id === pBoda.id && false; }), 'La lista de candidatos es coherente');

    /* Detalle de por qué alguien no cumple. */
    const detalle = motor.evaluarElegibilidad(campBodas, pXV);
    ok(!detalle.elegible, 'Un prospecto de XV no es elegible para la campaña de bodas');
    ok(detalle.resultados.some(function (x) { return !x.cumple; }), 'Se explica cuál criterio no cumple');

    /* Criterios de edad y presupuesto. */
    const joven = prospectoDePrueba(motor, 'Joven'); joven.fechaNacimiento = Util.sumarDias(Util.hoy(), -365 * 22);
    const mayor = prospectoDePrueba(motor, 'Mayor'); mayor.fechaNacimiento = Util.sumarDias(Util.hoy(), -365 * 45);
    const campEdad = motor.crearCampania({ nombre: 'Edad', objetivoPrincipal: 'x', fechaInicio: Util.hoy(), etapas: [{ id: 'n1', nombre: 'I', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' }], criteriosElegibilidad: [{ id: 'c6', tipo: 'edadEntre', valor: 18, valor2: 30 }] });
    ok(motor.evaluarElegibilidad(campEdad, joven).elegible, 'Cumple el rango de edad');
    ok(!motor.evaluarElegibilidad(campEdad, mayor).elegible, 'Queda fuera del rango de edad');

    /* Nada de esto debe dejar registros huérfanos. */
    const integridad = motor.validarIntegridad();
    ok(integridad.ok, 'La integridad referencial se mantiene', integridad.problemas);
}

/* ── Bloque extra: reglas de integridad y de datos ── */
grupo('Regresión · reglas de integridad y protección del historial');
{
    const { motor, db } = nuevo();

    /* Duplicar campaña. */
    const original = campaniaLista(motor, {
        plantillasTareas: [{ id: 'pl', nombre: 'Tarea', tipo: 'Contactar', prioridad: 'Alta', desplazamientoDias: 1, etapaOrigen: 'et_1', etapaDestino: 'et_2', activa: true }],
        ofertas: [{ id: 'of', nombre: 'Oferta', paqueteId: 'paq_boda_esencial', servicioId: '', precioEspecial: 16000, condiciones: '', vigencia: {} }],
        beneficios: [{ id: 'be', nombre: 'Beneficio', tipo: 'Regalo', valorReferencia: 100, condiciones: '', vigencia: {} }]
    });
    const copia = motor.duplicarCampania(original.id, 'Temporada siguiente');
    ok(copia.ok, 'La campaña se puede duplicar');
    const c = copia.campania;
    igual(c.estado, 'borrador', 'La copia nace en borrador');
    igual(c.etapas.length, original.etapas.length, 'Copia todas las etapas');
    ok(c.etapas[0].id !== original.etapas[0].id, 'Las etapas de la copia tienen identificadores nuevos');
    igual(c.plantillasTareas[0].etapaOrigen, c.etapas[0].id, 'Las plantillas de la copia apuntan a las etapas de la copia');
    igual(motor.participacionesDeCampania(c.id).length, 0, 'La copia no arrastra participantes');
    const validacionCopia = motor.validarCampania(c, {});
    ok(validacionCopia.ok, 'La copia es válida (las referencias quedaron bien remapeadas)', validacionCopia.errores);

    /* Etapas: no se elimina una con participaciones sin reasignar. */
    const camp2 = campaniaLista(motor, { nombre: 'Campaña con etapas' });
    const p2 = prospectoDePrueba(motor, 'Prospecto Etapas');
    const part2 = motor.agregarParticipacion({ campaniaId: camp2.id, prospectoId: p2.id }).participacion;
    const sinReasignar = motor.eliminarEtapa(camp2.id, 'et_1');
    ok(!sinReasignar.ok, 'No elimina una etapa que tiene participaciones');
    const reasignando = motor.eliminarEtapa(camp2.id, 'et_1', 'et_2');
    ok(reasignando.ok, 'Con etapa de reemplazo sí la elimina');
    igual(part2.etapaId, 'et_2', 'La participación se movió a la etapa de reemplazo');
    ok(part2.historial.some(function (h) { return h.nota && h.nota.indexOf('Reasignada') !== -1; }), 'El movimiento quedó anotado en el historial');

    /* Borrar una participación no destruye las tareas: las desvincula. */
    const camp3 = campaniaLista(motor, { nombre: 'Campaña tareas' });
    const p3 = prospectoDePrueba(motor, 'Prospecto Tareas');
    const part3 = motor.agregarParticipacion({ campaniaId: camp3.id, prospectoId: p3.id }).participacion;
    const t3 = motor.crearTarea({ titulo: 'Tarea ligada', fecha: Util.hoy(), participacionId: part3.id }).tarea;
    const r3 = motor.eliminarParticipacion(part3.id);
    ok(r3.ok, 'La participación se elimina');
    ok(db.tareas.some(function (t) { return t.id === t3.id; }), 'La tarea se conserva');
    igual(t3.participacionId, null, 'La tarea queda sin vínculo (no se borra el historial)');

    /* Campaña sin participaciones sí se puede borrar. */
    const camp4 = motor.crearCampania({ nombre: 'Campaña vacía' });
    ok(motor.eliminarCampania(camp4.id).ok, 'Una campaña vacía sí se puede eliminar');

    /* Prospecto con participaciones no se borra. */
    const camp5 = campaniaLista(motor, { nombre: 'Campaña cinco' });
    const p5 = prospectoDePrueba(motor, 'Prospecto Protegido');
    motor.agregarParticipacion({ campaniaId: camp5.id, prospectoId: p5.id });
    const borrarP = motor.eliminarProspecto(p5.id);
    ok(!borrarP.ok, 'No se borra un prospecto con participaciones');

    /* Datos requeridos por la campaña. */
    const camp6 = campaniaLista(motor, { nombre: 'Campaña exigente', datosRequeridos: [{ campo: 'telefono', obligatorio: true }, { campo: 'fechaEvento', obligatorio: true }] });
    const sinDatos = motor.crearProspecto({ nombre: 'Sin datos' }).prospecto;
    const r6 = motor.agregarParticipacion({ campaniaId: camp6.id, prospectoId: sinDatos.id });
    ok(r6.ok, 'Se permite registrar aunque falten datos');
    igual(r6.participacion.estado, 'pendienteValidacion', 'Queda pendiente de validación');
    ok(r6.avisos.length === 1 && r6.avisos[0].indexOf('telefono') === -1, 'Avisa qué datos faltan con su etiqueta legible', r6.avisos);
    ok(r6.datosFaltantes.length === 2, 'Reporta los dos datos faltantes');

    /* Avisos de la validación de campaña. */
    const camp7 = motor.crearCampania({ nombre: 'Sin etapa inicial', etapas: [{ id: 'x1', nombre: 'A', orden: 1, esInicial: false, esFinal: false, resultadoTipo: 'ninguno' }] });
    const v7 = motor.validarCampania(camp7, {});
    ok(!v7.ok && v7.errores.some(function (e) { return e.indexOf('inicial') !== -1; }), 'Detecta que falta la etapa inicial');

    const camp8 = motor.crearCampania({
        nombre: 'Referencias rotas',
        ofertas: [{ id: 'o1', nombre: 'Oferta rota', paqueteId: 'paq_que_no_existe', servicioId: '', precioEspecial: 1, condiciones: '', vigencia: {} }],
        plantillasTareas: [{ id: 'p1', nombre: 'Plantilla rota', tipo: 'Contactar', prioridad: 'Alta', desplazamientoDias: 1, etapaOrigen: 'etapa_que_no_existe', activa: true }]
    });
    const v8 = motor.validarCampania(camp8, {});
    ok(!v8.ok, 'Detecta ofertas y plantillas que apuntan a algo inexistente', v8.errores);

    /* Integridad general del estado de ejemplo. */
    const limpio = nuevo();
    const integral = limpio.motor.validarIntegridad();
    ok(integral.ok, 'Los datos de ejemplo arrancan sin registros huérfanos', integral.problemas);

    /* El estado de la participación no se mezcla con la fase comercial. */
    const camp9 = campaniaLista(motor, { nombre: 'Independencia' });
    const p9 = prospectoDePrueba(motor, 'Independiente');
    const part9 = motor.agregarParticipacion({ campaniaId: camp9.id, prospectoId: p9.id }).participacion;
    const faseAntes = p9.faseComercial;
    motor.cambiarEstadoParticipacion(part9.id, 'noResponde');
    igual(p9.faseComercial, faseAntes, 'Cambiar el estado de la participación no toca la fase comercial');
}

/* ── Bloque extra: catálogos y utilidades ── */
grupo('Regresión · catálogos, plantillas y utilidades');
{
    const { motor, db } = nuevo();
    igual(Catalogos.tiposTarea.filter(function (t) { return t === 'Sesión de fotos'; }).length, 1, 'El catálogo de tareas incluye los tipos comerciales de la especificación');
    ok(Catalogos.estadosParticipacion.length >= 14, 'El catálogo de estados de participación está completo');
    ok(!Catalogos.tiposTarea.some(function (t, i, a) { return a.indexOf(t) !== i; }), 'No hay tipos de tarea duplicados');
    ok(db.paquetes.length > 0 && db.servicios.length > 0, 'El catálogo de paquetes y servicios existe y las campañas lo referencian');

    const ofertasRotas = db.campanias.reduce(function (a, c) {
        return a + (c.ofertas || []).filter(function (o) {
            return (o.paqueteId && !db.paquetes.some(function (p) { return p.id === o.paqueteId; })) ||
                (o.servicioId && !db.servicios.some(function (s) { return s.id === o.servicioId; }));
        }).length;
    }, 0);
    igual(ofertasRotas, 0, 'Ninguna oferta de ejemplo apunta a un paquete o servicio inexistente');

    const etapasInvalidas = db.campanias.filter(function (c) {
        return c.etapas.filter(function (e) { return e.esInicial; }).length !== 1;
    }).length;
    igual(etapasInvalidas, 0, 'Todas las campañas de ejemplo tienen exactamente una etapa inicial');

    const tareasHuerfanas = db.tareas.filter(function (t) { return t.participacionId && !motor.participacion(t.participacionId); }).length;
    igual(tareasHuerfanas, 0, 'Ninguna tarea de ejemplo apunta a una participación inexistente');

    /* Utilidades de fecha usadas por todo el motor. */
    igual(Util.sumarDias('2026-01-31', 1), '2026-02-01', 'Sumar días cruza el fin de mes');
    igual(Util.diasEntre('2026-01-01', '2026-01-31'), 30, 'Calcula la diferencia de días');
    igual(Util.edad('2000-06-15', '2026-06-14'), 25, 'Calcula la edad antes del cumpleaños');
    igual(Util.edad('2000-06-15', '2026-06-15'), 26, 'Calcula la edad el día del cumpleaños');
    igual(Util.normalizar('María Fernanda RUIZ'), 'maria fernanda ruiz', 'Normaliza acentos y mayúsculas para buscar');
    ok(Util.esc('<b>"x"</b>').indexOf('<') === -1, 'Escapa HTML para evitar inyección de código en pantalla');
}

/* ── Bloque extra: reglas de operación (solo campañas activas) ── */
grupo('Reglas · solo una campaña ACTIVA recibe participantes y genera tareas');
{
    const { motor, db } = nuevo();
    const camp = motor.crearCampania({
        nombre: 'Campaña de reglas', objetivoPrincipal: 'x', fechaInicio: Util.hoy(),
        etapas: [
            { id: 'b1', nombre: 'Registrado', orden: 1, esInicial: true, esFinal: false, resultadoTipo: 'ninguno' },
            { id: 'b2', nombre: 'Contactado', orden: 2, esInicial: false, esFinal: true, resultadoTipo: 'ninguno' }
        ],
        plantillasTareas: [
            { id: 'pb1', nombre: 'Llamar al registrar', tipo: 'Contactar', prioridad: 'Alta', desplazamientoDias: 1, etapaOrigen: 'b1', activa: true },
            { id: 'pb2', nombre: 'Seguir al contactar', tipo: 'Seguimiento', prioridad: 'Normal', desplazamientoDias: 2, etapaOrigen: 'b2', activa: true }
        ]
    });
    const p = prospectoDePrueba(motor, 'Prospecto Reglas');
    const tareasAntes = db.tareas.length;

    /* 1. En borrador no opera */
    const estadoBorrador = motor.puedeRecibirParticipantes(camp);
    ok(!estadoBorrador.ok && estadoBorrador.codigo === 'campania-no-activa', 'Una campaña en borrador no recibe participantes');
    const rBorrador = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id });
    ok(!rBorrador.ok && rBorrador.codigo === 'campania-no-activa', 'El motor rechaza agregar a una campaña en borrador');
    igual(motor.participacionesDeCampania(camp.id).length, 0, 'No quedó ninguna participación en el borrador');
    igual(db.tareas.length, tareasAntes, 'Con la campaña en borrador NO se generó ninguna tarea');

    /* 2. Programada tampoco */
    motor.cambiarEstadoCampania(camp.id, 'programada');
    const rProgramada = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id });
    ok(!rProgramada.ok && rProgramada.codigo === 'campania-no-activa', 'Una campaña programada tampoco recibe participantes');
    igual(db.tareas.length, tareasAntes, 'Programada tampoco genera tareas');

    /* 3. Activada sí opera y genera las tareas de la etapa inicial */
    const activacion = motor.activarCampania(camp.id);
    ok(activacion.ok, 'La campaña se activa', activacion.errores);
    const rActiva = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id });
    ok(rActiva.ok, 'Ya activa sí recibe participantes', rActiva.errores);
    const generadas = motor.tareasDeParticipacion(rActiva.participacion.id);
    igual(generadas.length, 1, 'La campaña activa generó la tarea de la etapa inicial');
    igual(generadas[0].titulo, 'Llamar al registrar', 'Es la tarea configurada para esa etapa');
    igual(generadas[0].fecha, Util.sumarDias(Util.hoy(), 1), 'Quedó agendada con su desplazamiento de días');
    igual(generadas[0].campaniaId, camp.id, 'La tarea queda ligada a la campaña (aparece en el calendario)');

    /* 4. Pausada: se puede mover de etapa, pero NO genera tareas nuevas */
    motor.pausarCampania(camp.id);
    const otro = prospectoDePrueba(motor, 'Prospecto Pausado');
    const rPausada = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: otro.id });
    ok(!rPausada.ok && rPausada.codigo === 'campania-no-activa', 'Una campaña pausada no recibe participantes nuevos');
    const tareasTrasPausa = db.tareas.length;
    const avance = motor.cambiarEtapa(rActiva.participacion.id, 'b2');
    ok(avance.ok, 'La etapa sí se puede mover en una campaña pausada');
    igual(avance.tareasGeneradas.length, 0, 'Pero no genera tareas nuevas');
    igual(db.tareas.length, tareasTrasPausa, 'El total de tareas no cambió con la campaña pausada');

    /* 5. Reactivada vuelve a automatizar, sin duplicar */
    motor.activarCampania(camp.id);
    motor.cambiarEtapa(rActiva.participacion.id, 'b1');
    const avance2 = motor.cambiarEtapa(rActiva.participacion.id, 'b2');
    igual(avance2.tareasGeneradas.length, 1, 'Al reactivar, entrar a la etapa sí genera su tarea');
    igual(avance2.tareasGeneradas[0].titulo, 'Seguir al contactar', 'Es la tarea de esa etapa');
    motor.cambiarEtapa(rActiva.participacion.id, 'b1');
    const repetido = motor.cambiarEtapa(rActiva.participacion.id, 'b2');
    igual(repetido.tareasGeneradas.length, 0, 'No se duplica la tarea si ya está pendiente');

    /* 6. Una campaña cerrada no se reabre y solo acepta con acción explícita */
    motor.finalizarCampania(camp.id);
    const rCerrada = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: prospectoDePrueba(motor, 'Tarde').id });
    ok(!rCerrada.ok && rCerrada.codigo === 'campania-cerrada', 'Una campaña finalizada no recibe participantes');
    ok(!motor.activarCampania(camp.id).ok, 'Una campaña finalizada no se puede reactivar');

    ok(motor.validarIntegridad().ok, 'Las reglas de operación no dejaron registros huérfanos', motor.validarIntegridad().problemas);
}

/* ── Bloque extra: agrupación de tareas para el panel ── */
grupo('Reglas · tareas agrupadas por vencimiento y prioridad');
{
    const { motor } = nuevo();
    const p = prospectoDePrueba(motor, 'Prospecto Agrupado');
    const hoy = Util.hoy();
    const crear = function (titulo, fecha, prioridad, extra) {
        return motor.crearTarea(Object.assign({ titulo: titulo, fecha: fecha, prioridad: prioridad, prospectoId: p.id }, extra || {})).tarea;
    };
    const vencidaBaja = crear('Vencida baja', Util.sumarDias(hoy, -3), 'Baja');
    const vencidaAlta = crear('Vencida alta', Util.sumarDias(hoy, -1), 'Alta');
    const deHoy = crear('Para hoy', hoy, 'Normal');
    const proxima = crear('Próxima', Util.sumarDias(hoy, 5), 'Alta');
    const sinFecha = crear('Sin fecha', '', 'Normal');
    const completada = crear('Completada', Util.sumarDias(hoy, -2), 'Alta');
    motor.completarTarea(completada.id, {});

    const g = motor.tareasAgrupadas({ prospectoId: p.id });
    igual(g.vencidas.length, 2, 'Agrupa dos tareas vencidas');
    igual(g.hoy.length, 1, 'Agrupa una tarea para hoy');
    igual(g.proximas.length, 1, 'Agrupa una tarea próxima');
    igual(g.sinFecha.length, 1, 'Agrupa una tarea sin fecha');
    igual(g.completadas.length, 1, 'Las completadas van aparte');
    igual(g.pendientes, 5, 'Cuenta cinco pendientes en total');
    igual(g.vencidas[0].id, vencidaBaja.id, 'En las vencidas va primero la más atrasada (la que lleva más tiempo esperando)');
    igual(g.vencidas[1].id, vencidaAlta.id, 'Y después la que se venció más recientemente');

    /* A igual fecha manda la prioridad: Alta → Normal → Baja */
    const mismoDiaBaja = crear('Mismo día baja', Util.sumarDias(hoy, 2), 'Baja');
    const mismoDiaAlta = crear('Mismo día alta', Util.sumarDias(hoy, 2), 'Alta');
    const mismoDiaNormal = crear('Mismo día normal', Util.sumarDias(hoy, 2), 'Normal');
    const g2 = motor.tareasAgrupadas({ prospectoId: p.id });
    const posiciones = [mismoDiaAlta.id, mismoDiaNormal.id, mismoDiaBaja.id].map(function (id) {
        return g2.proximas.map(function (t) { return t.id; }).indexOf(id);
    });
    ok(posiciones[0] < posiciones[1] && posiciones[1] < posiciones[2], 'A igual fecha se ordena Alta, luego Normal, luego Baja', posiciones);
    igual(g2.proximas[0].fecha, Util.sumarDias(hoy, 2), 'La fecha de vencimiento manda sobre la prioridad: primero lo más próximo');
}

/* ── Bloque extra: las tareas sueltas no ensucian los informes ── */
grupo('Reglas · las tareas sueltas quedan fuera de las campañas');
{
    const { motor, almacen } = nuevo();
    const camp = campaniaLista(motor);
    const p = prospectoDePrueba(motor, 'Prospecto Informes');
    const part = motor.agregarParticipacion({ campaniaId: camp.id, prospectoId: p.id }).participacion;
    motor.crearTarea({ titulo: 'Tarea de la campaña', fecha: Util.hoy(), campaniaId: camp.id, participacionId: part.id, prospectoId: p.id, origen: 'campania' });
    const suelta = motor.crearTarea({ titulo: 'Tarea suelta', fecha: Util.hoy(), prospectoId: p.id, origen: 'manual' }).tarea;

    igual(suelta.campaniaId, null, 'La tarea suelta no queda ligada a ninguna campaña');
    igual(suelta.participacionId, null, 'Ni a ninguna participación');

    const e = motor.estadisticasCampania(camp.id);
    igual(e.tareasPendientes, 1, 'La campaña solo cuenta su propia tarea');
    igual(motor.resumenTareasDeCampania(camp.id).pendientes, 1, 'El resumen de la campaña solo cuenta lo suyo');
    igual(motor.tareasAgrupadas({ prospectoId: p.id }).pendientes, 2, 'El prospecto ve las dos tareas');
    igual(motor.tareasAgrupadas({ prospectoId: p.id, tipo: 'manuales' }).pendientes, 1, 'El filtro separa las sueltas');
    igual(motor.tareasAgrupadas({ prospectoId: p.id, tipo: 'campanias' }).pendientes, 1, 'Y las de campaña');

    const embudoAntes = motor.estadisticasCampania(camp.id).totalParticipantes;
    motor.completarTarea(suelta.id, {});
    const embudoDespues = motor.estadisticasCampania(camp.id).totalParticipantes;
    igual(embudoDespues, embudoAntes, 'Completar una tarea suelta no toca las métricas de la campaña');
    ok(!!almacen.prospecto(suelta.prospectoId).fechaUltimoContacto, 'Pero sí registra el último contacto del prospecto');
}

/* ───────────── Resultado final ───────────── */

console.log('\n' + '─'.repeat(64));
console.log('Total de comprobaciones: ' + total);
console.log('Fallidas: ' + fallos);
console.log(fallos === 0 ? 'RESULTADO: TODO EN VERDE' : 'RESULTADO: HAY FALLAS');
console.log('─'.repeat(64));

process.exit(fallos === 0 ? 0 : 1);
