/* Generado por pruebas\preparar-motor-v5.ps1 — NO EDITAR A MANO.
   Es el motor de campanas TAL COMO quedo dentro del CRM v5.0: sirve para correrle
   las 224 pruebas originales del CRM Lite y comprobar que el port no cambio nada. */
'use strict';
// En la lite el rastro decia siempre 'Sesion de prueba'; en el CRM lo pone la sesion real.
// Aqui se devuelve el mismo texto de antes para poder comparar contra las pruebas originales.
if (typeof globalThis.usuarioDeSesion !== 'function') {
    globalThis.usuarioDeSesion = function () { return 'Sesión de prueba'; };
}
/* @JS-CAMPANIAS-MOTOR v5.0 — portado del CRM Lite             */
        /* Util y Catalogos + el motor puro (sin DOM y sin almacen      */
        /* propio: trabaja sobre el almacen REAL de este CRM).          */
        /* ═══════════════════════════════════════════════════════════ */
        // Nombre de quien queda en el rastro de auditoria de campanas.
        function usuarioDeSesion() {
            return (typeof usuarioActual !== 'undefined' && usuarioActual && usuarioActual.nombre) ? usuarioActual.nombre : 'Sistema';
        }
        (function (raiz) {
    function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }

    var Util = {
        /* Fecha de hoy en formato YYYY-MM-DD (hora local, sin UTC). */
        hoy: function () {
            var d = new Date();
            return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
        },

        /* Marca de tiempo local: YYYY-MM-DDTHH:MM:SS */
        ahora: function (fecha) {
            var d = fecha ? new Date(fecha) : new Date();
            return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate()) +
                'T' + dosDigitos(d.getHours()) + ':' + dosDigitos(d.getMinutes()) + ':' + dosDigitos(d.getSeconds());
        },

        /* Convierte 'YYYY-MM-DD' (o ISO completo) a Date local. */
        desdeIso: function (texto) {
            if (!texto) return null;
            var soloFecha = String(texto).slice(0, 10).split('-');
            if (soloFecha.length !== 3) return null;
            var d = new Date(Number(soloFecha[0]), Number(soloFecha[1]) - 1, Number(soloFecha[2]));
            if (String(texto).length > 10) {
                var hora = String(texto).slice(11, 19).split(':');
                d.setHours(Number(hora[0] || 0), Number(hora[1] || 0), Number(hora[2] || 0));
            }
            return isNaN(d.getTime()) ? null : d;
        },

        /* Suma (o resta) días a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
        sumarDias: function (fechaTexto, dias) {
            var d = Util.desdeIso(fechaTexto);
            if (!d) return '';
            d.setDate(d.getDate() + Number(dias || 0));
            return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
        },

        /* Días completos de diferencia entre dos fechas (b - a). */
        diasEntre: function (a, b) {
            var da = Util.desdeIso(a), db = Util.desdeIso(b);
            if (!da || !db) return null;
            var MS = 24 * 60 * 60 * 1000;
            return Math.round((db.setHours(12, 0, 0, 0) - da.setHours(12, 0, 0, 0)) / MS);
        },

        /* Texto legible de una fecha: '06 oct 2026' */
        fmtFecha: function (texto) {
            var d = Util.desdeIso(texto);
            if (!d) return '—';
            var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            return dosDigitos(d.getDate()) + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
        },

        /* Texto legible con hora: '06 oct 2026 · 14:30' */
        fmtFechaHora: function (texto) {
            if (!texto) return '—';
            var d = Util.desdeIso(texto);
            if (!d) return '—';
            var hora = (String(texto).length > 10) ? ' · ' + dosDigitos(d.getHours()) + ':' + dosDigitos(d.getMinutes()) : '';
            return Util.fmtFecha(texto) + hora;
        },

        /* Edad en años a partir de la fecha de nacimiento. */
        edad: function (fechaNacimiento, referencia) {
            var n = Util.desdeIso(fechaNacimiento);
            if (!n) return null;
            var hoy = Util.desdeIso(referencia || Util.hoy());
            var edad = hoy.getFullYear() - n.getFullYear();
            var m = hoy.getMonth() - n.getMonth();
            if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
            return edad;
        },

        moneda: function (n) {
            var valor = Number(n || 0);
            try {
                return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor);
            } catch (e) {
                return '$' + valor.toLocaleString('es-MX');
            }
        },

        numero: function (valor, porDefecto) {
            var n = typeof valor === 'string' ? Number(valor.replace(/[^0-9.\-]/g, '')) : Number(valor);
            return isNaN(n) ? (porDefecto === undefined ? 0 : porDefecto) : n;
        },

        /* Identificador único con prefijo: cmp_xxx, par_xxx, pro_xxx… */
        nuevoId: function (prefijo) {
            return (prefijo || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        },

        /* Texto sin acentos y en minúsculas, para buscar. */
        normalizar: function (texto) {
            return String(texto === null || texto === undefined ? '' : texto)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        },

        /* Escapa HTML: TODO lo que se dibuja en pantalla pasa por aquí. */
        esc: function (texto) {
            if (texto === null || texto === undefined) return '';
            return String(texto)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        /* Copia profunda sencilla (los datos son JSON puro). */
        clonar: function (obj) {
            return obj === null || obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
        },

        /* Une texto no vacío con un separador, sin dejar huecos. */
        unir: function (partes, separador) {
            return (partes || []).filter(function (p) { return p !== null && p !== undefined && String(p).trim() !== ''; }).join(separador || ' · ');
        },

        capitalizar: function (texto) {
            var t = String(texto || '');
            return t.charAt(0).toUpperCase() + t.slice(1);
        },

        /* Convierte 'contactada' o 'pendienteValidacion' en 'Pendiente validación' */
        etiquetaLegible: function (clave) {
            var texto = String(clave || '').replace(/([a-z])([A-Z])/g, '$1 $2');
            return Util.capitalizar(texto);
        },

        /* Cuenta elementos por una propiedad: agrupar(lista,'estado') */
        agrupar: function (lista, propiedad) {
            var salida = {};
            (lista || []).forEach(function (item) {
                var clave = item[propiedad];
                if (clave === undefined || clave === null || clave === '') clave = 'sinDato';
                salida[clave] = (salida[clave] || 0) + 1;
            });
            return salida;
        },

        ordenarPor: function (lista, fn, descendente) {
            return (lista || []).slice().sort(function (a, b) {
                var va = fn(a), vb = fn(b);
                if (va === vb) return 0;
                if (va === null || va === undefined) return 1;
                if (vb === null || vb === undefined) return -1;
                var r = va < vb ? -1 : 1;
                return descendente ? -r : r;
            });
        }
    };

    /* ───────────────────────── Catálogos ───────────────────────── */

    var Catalogos = {
        tiposCampania: ['Captación', 'Promoción', 'Reactivación', 'Fidelización', 'Generación de contenido', 'Conversión', 'Evento', 'Otro'],

        estadosCampania: [
            { id: 'borrador', etiqueta: 'Borrador', ayuda: 'Se puede editar todo. No genera participaciones ni tareas.' },
            { id: 'programada', etiqueta: 'Programada', ayuda: 'Lista y aprobada, pero todavía no arranca.' },
            { id: 'activa', etiqueta: 'Activa', ayuda: 'En operación: recibe participantes y genera tareas.' },
            { id: 'pausada', etiqueta: 'Pausada', ayuda: 'Conserva todo, pero no genera nuevas automatizaciones.' },
            { id: 'finalizada', etiqueta: 'Finalizada', ayuda: 'Cerrada con historial completo. Su configuración estructural queda congelada.' },
            { id: 'cancelada', etiqueta: 'Cancelada', ayuda: 'Descartada. Se conserva como registro histórico.' }
        ],

        /* Estados de la PARTICIPACIÓN (independientes de la fase comercial). */
        estadosParticipacion: [
            { id: 'registrada', etiqueta: 'Registrada', clase: 'neutra' },
            { id: 'pendienteValidacion', etiqueta: 'Pendiente de validación', clase: 'aviso' },
            { id: 'validada', etiqueta: 'Validada', clase: 'positiva' },
            { id: 'rechazada', etiqueta: 'Rechazada', clase: 'negativa' },
            { id: 'seleccionada', etiqueta: 'Seleccionada', clase: 'positiva' },
            { id: 'noSeleccionada', etiqueta: 'No seleccionada', clase: 'negativa' },
            { id: 'contactada', etiqueta: 'Contactada', clase: 'neutra' },
            { id: 'participando', etiqueta: 'Participando', clase: 'neutra' },
            { id: 'completada', etiqueta: 'Completada', clase: 'positiva' },
            { id: 'seguimientoComercial', etiqueta: 'Seguimiento comercial', clase: 'aviso' },
            { id: 'convertida', etiqueta: 'Convertida', clase: 'positiva' },
            { id: 'sinInteres', etiqueta: 'Sin interés', clase: 'negativa' },
            { id: 'noResponde', etiqueta: 'No responde', clase: 'negativa' },
            { id: 'cancelada', etiqueta: 'Cancelada', clase: 'negativa' }
        ],

        /* Fuentes de participantes que puede declarar una campaña. */
        fuentesParticipantes: [
            { id: 'prospectosNuevos', etiqueta: 'Prospectos nuevos (captación)' },
            { id: 'prospectosExistentes', etiqueta: 'Prospectos ya registrados' },
            { id: 'clientes', etiqueta: 'Clientes actuales' },
            { id: 'participantesAnteriores', etiqueta: 'Participantes de campañas anteriores' },
            { id: 'seleccionManual', etiqueta: 'Selección manual uno por uno' }
        ],

        origenes: ['Facebook', 'Instagram', 'WhatsApp', 'Web', 'Evento', 'Recomendación', 'Cliente anterior', 'Campaña anterior', 'Manual', 'Otro'],

        /* Fase COMERCIAL del prospecto: es otra cosa, no se mezcla con la etapa de campaña. */
        fasesComerciales: ['Interesado', 'Cotización', 'Negociación', 'Contrato', 'Frecuente', 'Cancelado', 'Inactivo'],

        tiposTarea: ['Validar registro', 'Solicitar información', 'Solicitar autorización', 'Contactar', 'Enviar mensaje',
            'Enviar información', 'Enviar cotización', 'Seguimiento', 'Segundo seguimiento', 'Confirmar', 'Agendar',
            'Sesión de fotos', 'Enviar promoción', 'Cerrar oportunidad', 'Otro'],

        prioridades: ['Alta', 'Normal', 'Baja'],

        resultadosContacto: [
            { id: 'noRespondio', etiqueta: 'No respondió' },
            { id: 'respondioInteresado', etiqueta: 'Respondió interesado' },
            { id: 'respondioNoInteresado', etiqueta: 'Respondió sin interés' },
            { id: 'solicitoInformacion', etiqueta: 'Solicitó información' },
            { id: 'solicitoPrecio', etiqueta: 'Solicitó precio' },
            { id: 'seEnvioCotizacion', etiqueta: 'Se envió cotización' },
            { id: 'quiereHablarDespues', etiqueta: 'Quiere hablar después' },
            { id: 'contrato', etiqueta: 'Contrató' },
            { id: 'numeroIncorrecto', etiqueta: 'Número incorrecto' },
            { id: 'otro', etiqueta: 'Otro' }
        ],

        /* Tipo de resultado que puede declarar una etapa del flujo. */
        tiposResultadoEtapa: [
            { id: 'ninguno', etiqueta: 'Sin resultado especial' },
            { id: 'interesado', etiqueta: 'Interesado' },
            { id: 'noInteresado', etiqueta: 'Sin interés' },
            { id: 'convertido', etiqueta: 'Conversión (venta)' },
            { id: 'descartado', etiqueta: 'Descartado' }
        ],

        tiposBeneficio: ['Regalo', 'Sesión', 'Descuento', 'Bono', 'Cortesía', 'Sorteo', 'Otro'],

        tiposCampo: [
            { id: 'texto', etiqueta: 'Texto corto' },
            { id: 'texto-largo', etiqueta: 'Texto largo' },
            { id: 'numero', etiqueta: 'Número' },
            { id: 'fecha', etiqueta: 'Fecha' },
            { id: 'booleano', etiqueta: 'Sí / No' },
            { id: 'seleccion', etiqueta: 'Selección (una opción)' },
            { id: 'seleccionMultiple', etiqueta: 'Selección (varias opciones)' },
            { id: 'telefono', etiqueta: 'Teléfono' }
        ],

        /* Campos permanentes del prospecto que una campaña puede exigir. */
        camposProspecto: [
            { id: 'nombre', etiqueta: 'Nombre completo' },
            { id: 'telefono', etiqueta: 'Teléfono' },
            { id: 'email', etiqueta: 'Correo' },
            { id: 'ciudad', etiqueta: 'Ciudad' },
            { id: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento' },
            { id: 'fechaEvento', etiqueta: 'Fecha del evento' },
            { id: 'tipoEvento', etiqueta: 'Tipo de evento' },
            { id: 'presupuesto', etiqueta: 'Presupuesto estimado' },
            { id: 'notas', etiqueta: 'Notas' }
        ],

        /* Tipos de criterio del motor de elegibilidad (estructurados, sin SQL). */
        tiposCriterio: [
            { id: 'faseComercial', etiqueta: 'Fase comercial es', tipoValor: 'lista-fases' },
            { id: 'ciudadContiene', etiqueta: 'Ciudad contiene', tipoValor: 'texto' },
            { id: 'origenEs', etiqueta: 'Origen es', tipoValor: 'lista-origenes' },
            { id: 'edadEntre', etiqueta: 'Edad entre', tipoValor: 'rango-edad' },
            { id: 'presupuestoMayor', etiqueta: 'Presupuesto mayor o igual a', tipoValor: 'numero' },
            { id: 'tipoEventoEs', etiqueta: 'Tipo de evento es', tipoValor: 'lista-eventos' },
            { id: 'registradoDesde', etiqueta: 'Registrado a partir de', tipoValor: 'fecha' },
            { id: 'registradoHasta', etiqueta: 'Registrado hasta', tipoValor: 'fecha' },
            { id: 'sinParticipacionPrevia', etiqueta: 'Sin participación previa en ninguna campaña', tipoValor: 'ninguno' },
            { id: 'participoEnCampania', etiqueta: 'Participó en la campaña', tipoValor: 'lista-campanias' },
            { id: 'noParticipoEnCampania', etiqueta: 'NO participó en la campaña', tipoValor: 'lista-campanias' },
            { id: 'participacionConvertida', etiqueta: 'Tiene alguna conversión registrada', tipoValor: 'si-no' },
            { id: 'ultimoContactoAntesDe', etiqueta: 'Último contacto anterior a', tipoValor: 'fecha' },
            { id: 'sinContacto', etiqueta: 'Nunca ha sido contactado', tipoValor: 'ninguno' },
            { id: 'nombreContiene', etiqueta: 'Nombre contiene', tipoValor: 'texto' }
        ],

        tiposEvento: ['Boda', 'XV Años', 'Bautizo', 'Cumpleaños', 'Corporativo', 'Graduación', 'Sesión familiar', 'Otro'],

        estadosCliente: ['Activo', 'Inactivo', 'Cancelado'],

        /* ── Ayudas de consulta ── */
        etiquetaEstadoCampania: function (id) {
            var e = Catalogos.estadosCampania.filter(function (x) { return x.id === id; })[0];
            return e ? e.etiqueta : Util.etiquetaLegible(id);
        },
        ayudaEstadoCampania: function (id) {
            var e = Catalogos.estadosCampania.filter(function (x) { return x.id === id; })[0];
            return e ? e.ayuda : '';
        },
        objetoEstadoParticipacion: function (id) {
            var e = Catalogos.estadosParticipacion.filter(function (x) { return x.id === id; })[0];
            return e || { id: id, etiqueta: Util.etiquetaLegible(id), clase: 'neutra' };
        },
        etiquetaResultadoContacto: function (id) {
            var e = Catalogos.resultadosContacto.filter(function (x) { return x.id === id; })[0];
            return e ? e.etiqueta : (id || '—');
        },
        claseFaseComercial: function (fase) {
            var mapa = {
                'Interesado': 'etiqueta-interesado', 'Cotización': 'etiqueta-cotizacion', 'Negociación': 'etiqueta-negociacion',
                'Contrato': 'etiqueta-contrato', 'Frecuente': 'etiqueta-frecuente', 'Cancelado': 'etiqueta-cancelado', 'Inactivo': 'etiqueta-inactivo'
            };
            return mapa[fase] || 'etiqueta-inactivo';
        },
        claseEstadoPaquete: function (estatus) {
            var mapa = {
                'Activo': 'etiqueta-paquete-activo', 'Próximo': 'etiqueta-paquete-proximo',
                'Especial de temporada': 'etiqueta-paquete-especial', 'Inactivo': 'etiqueta-paquete-inactivo', 'Caducado': 'etiqueta-paquete-caducado'
            };
            return mapa[estatus] || 'etiqueta-paquete-inactivo';
        },
        ayudaCriterio: function (id) {
            var c = Catalogos.tiposCriterio.filter(function (x) { return x.id === id; })[0];
            return c || { id: id, etiqueta: Util.etiquetaLegible(id), tipoValor: 'texto' };
        }
    };

    /* ───────────────────────── Estructuras base ───────────────────────── */

            raiz.Util = Util;
            raiz.Catalogos = Catalogos;
        })(typeof globalThis !== 'undefined' ? globalThis : this);

        (function (raiz) {
/* ═══════════════════════════════════════════════════════════════════════
   @JS-MOTOR — Motor de campañas (lógica pura, sin tocar el DOM)
   -----------------------------------------------------------------------
   Implementa la especificación `CRM_Campanas_Especificacion_Harness.md`:

     campaigns  ──1:N──▶  campaignParticipations  ──N:1──▶  prospectos
                                                     │
                                                     ├── tareas (sistema único)
                                                     ├── calendario (vistas)
                                                     └── conversión a cliente

   Reglas que respeta a propósito:
     · Un prospecto es único; se reutiliza entre campañas sin duplicarse.
     · La etapa de campaña NO es la fase comercial del prospecto.
     · El historial de una participación guarda snapshots de oferta/beneficio,
       para que un cambio posterior en la campaña no reescriba el pasado.
     · No hay borrado destructivo de campañas con historial.
     · No hay lógica escrita para "una campaña en particular": todo es dato.

   Este archivo funciona igual en el navegador y en Node (pruebas).
   ═══════════════════════════════════════════════════════════════════════ */
(function (raiz) {
    'use strict';

    var Util = raiz.Util;

    /* Estados de participación que se consideran "cerrados": ya no se siguen. */
    var ESTADOS_CERRADOS = ['convertida', 'cancelada', 'noSeleccionada', 'rechazada', 'sinInteres'];
    /* Estados que cuentan como "participante válido" para las métricas.
       Un participante es válido cuando pasó la validación: no está pendiente
       de validar, ni fue rechazado, ni se canceló. */
    var ESTADOS_NO_VALIDOS = ['pendienteValidacion', 'rechazada', 'noSeleccionada', 'cancelada'];
    var ESTADOS_VALIDOS = Catalogos.estadosParticipacion
        .map(function (e) { return e.id; })
        .filter(function (id) { return ESTADOS_NO_VALIDOS.indexOf(id) === -1; });

    function esParticipanteValido(part) {
        return ESTADOS_NO_VALIDOS.indexOf(part.estado) === -1;
    }
    /* Peso de la prioridad para ordenar tareas: Alta (1) → Baja (3). */
    function pesoPrioridad(prioridad) {
        var pesos = { 'Alta': 1, 'Normal': 2, 'Baja': 3 };
        return pesos[prioridad] || 2;
    }
    /* Resultados de contacto que cuentan como interés. */
    var RESULTADOS_INTERES = ['respondioInteresado', 'solicitoInformacion', 'solicitoPrecio', 'seEnvioCotizacion', 'quiereHablarDespues', 'contrato'];

    var ETIQUETAS_METAS = {
        registros: 'Registros',
        participantesValidos: 'Participantes válidos',
        contactados: 'Contactados',
        interesados: 'Interesados',
        cotizaciones: 'Cotizaciones',
        contratos: 'Contratos',
        valorPotencial: 'Valor potencial',
        valorConvertido: 'Valor convertido'
    };

    /* Campos de la campaña que NO se pueden tocar una vez finalizada. */
    var CAMPOS_ESTRUCTURALES = ['etapas', 'plantillasTareas', 'beneficios', 'ofertas', 'criteriosElegibilidad',
        'camposPersonalizados', 'datosRequeridos', 'fechaInicio', 'fechaFin', 'tipo', 'publicoObjetivo', 'metas'];

    function crearMotor(almacen) {
        var motor = {};

        function db() { return almacen.db; }

        function campania(id) { return almacen.campania(id); }
        function prospecto(id) { return almacen.prospecto(id); }
        function participacion(id) { return almacen.participacion(id); }
        function tarea(id) { return almacen.tarea(id); }

        /* ───────────── Historial (auditoría) ───────────── */

        motor.registrar = function (entidad, entidadId, entidadNombre, accion, detalle) {
            var entrada = {
                id: Util.nuevoId('his'), fecha: Util.ahora(), usuario: usuarioDeSesion(),
                entidad: entidad, entidadId: entidadId, entidadNombre: entidadNombre || '',
                accion: accion, detalle: detalle || ''
            };
            db().historial.unshift(entrada);
            if (db().historial.length > 600) db().historial.length = 600;
            return entrada;
        };

        motor.historialDe = function (entidad, entidadId) {
            return db().historial.filter(function (h) { return h.entidad === entidad && h.entidadId === entidadId; });
        };

        motor.historialFiltrado = function (filtros) {
            var f = filtros || {};
            return db().historial.filter(function (h) {
                if (f.entidad && f.entidad !== 'todas' && h.entidad !== f.entidad) return false;
                if (f.accion && f.accion !== 'todas' && h.accion !== f.accion) return false;
                if (f.texto) {
                    var t = Util.normalizar(f.texto);
                    var blob = Util.normalizar([h.entidadNombre, h.detalle, h.usuario, h.accion].join(' '));
                    if (blob.indexOf(t) === -1) return false;
                }
                return true;
            });
        };

        /* ───────────── Campañas ───────────── */

        function etapasOrdenadas(camp) {
            return (camp.etapas || []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
        }

        function etapaDe(camp, etapaId) {
            return (camp.etapas || []).filter(function (e) { return e.id === etapaId; })[0] || null;
        }

        motor.etapasOrdenadas = etapasOrdenadas;
        motor.etapaDe = etapaDe;
        motor.etapaInicial = function (camp) {
            var inicial = (camp.etapas || []).filter(function (e) { return e.esInicial; })[0];
            if (inicial) return inicial;
            var orden = etapasOrdenadas(camp);
            return orden.length ? orden[0] : null;
        };

        function etapaPorResultado(camp, tipoResultado) {
            return etapasOrdenadas(camp).filter(function (e) { return e.resultadoTipo === tipoResultado; })[0] || null;
        }
        motor.etapaPorResultado = etapaPorResultado;

        /* Campaña nueva con todos los campos de la especificación. */
        motor.crearCampania = function (datos) {
            var d = datos || {};
            var camp = {
                id: Util.nuevoId('cmp'),
                nombre: (d.nombre || '').trim() || 'Campaña sin nombre',
                descripcion: d.descripcion || '',
                tipo: d.tipo || Catalogos.tiposCampania[0],
                objetivoPrincipal: d.objetivoPrincipal || '',
                objetivosSecundarios: d.objetivosSecundarios || [],
                estado: d.estado || 'borrador',
                fechaInicio: d.fechaInicio || '',
                fechaFin: d.fechaFin || '',
                fechaCreacion: Util.ahora(),
                fechaActualizacion: Util.ahora(),
                publicoObjetivo: d.publicoObjetivo || { fuentes: [], descripcion: '' },
                criteriosElegibilidad: d.criteriosElegibilidad || [],
                datosRequeridos: d.datosRequeridos || [],
                camposPersonalizados: d.camposPersonalizados || [],
                etapas: d.etapas || [
                    { id: Util.nuevoId('etp'), nombre: 'Registrado', orden: 1, descripcion: 'El prospecto entró a la campaña.', esInicial: true, esFinal: false, resultadoTipo: 'ninguno' },
                    { id: Util.nuevoId('etp'), nombre: 'Contactado', orden: 2, descripcion: 'Ya se contactó.', esInicial: false, esFinal: false, resultadoTipo: 'ninguno' },
                    { id: Util.nuevoId('etp'), nombre: 'Convertido', orden: 3, descripcion: 'Cerró la venta.', esInicial: false, esFinal: true, resultadoTipo: 'convertido' }
                ],
                plantillasTareas: d.plantillasTareas || [],
                beneficios: d.beneficios || [],
                ofertas: d.ofertas || [],
                metas: d.metas || {},
                configuracion: Object.assign({
                    responsable: usuarioDeSesion(),
                    requiereAutorizacion: false,
                    permiteMultiplesParticipaciones: false,
                    permitirParticipacionFinalizada: false,
                    avisarSeguimiento: true,
                    sincronizarFaseComercial: { activo: false, mapa: {} }
                }, d.configuracion || {}),
                creadoPor: usuarioDeSesion(),
                actualizadoPor: usuarioDeSesion()
            };
            db().campanias.push(camp);
            motor.registrar('campania', camp.id, camp.nombre, 'crear', 'Campaña creada en estado ' + camp.estado + '.');
            almacen.guardar('campania-creada');
            return camp;
        };

        /* Validación de la campaña. Con {paraActivar:true} exige lo mínimo para operar. */
        motor.validarCampania = function (camp, opciones) {
            var op = opciones || {};
            var errores = [];
            var avisos = [];

            if (!camp) return { ok: false, errores: ['La campaña no existe.'], avisos: [] };

            if (!String(camp.nombre || '').trim()) errores.push('Falta el nombre de la campaña.');
            if (camp.fechaInicio && camp.fechaFin && Util.diasEntre(camp.fechaInicio, camp.fechaFin) < 0) {
                errores.push('La fecha de fin no puede ser anterior a la fecha de inicio.');
            }

            var etapas = camp.etapas || [];
            if (!etapas.length) {
                errores.push('La campaña necesita al menos una etapa.');
            } else {
                var iniciales = etapas.filter(function (e) { return e.esInicial; });
                if (iniciales.length === 0) errores.push('Debe existir exactamente una etapa inicial y no hay ninguna marcada.');
                if (iniciales.length > 1) errores.push('Hay ' + iniciales.length + ' etapas marcadas como iniciales: solo puede haber una.');
                var sinNombre = etapas.filter(function (e) { return !String(e.nombre || '').trim(); });
                if (sinNombre.length) errores.push('Hay ' + sinNombre.length + ' etapa(s) sin nombre.');
                var ordenes = {};
                etapas.forEach(function (e) {
                    ordenes[e.orden] = (ordenes[e.orden] || 0) + 1;
                });
                var repetidos = Object.keys(ordenes).filter(function (o) { return ordenes[o] > 1; });
                if (repetidos.length) avisos.push('Hay etapas con el mismo orden (' + repetidos.join(', ') + '). Se recomienda numerarlas 1, 2, 3…');
                var finales = etapas.filter(function (e) { return e.esFinal; });
                if (!finales.length) avisos.push('Ninguna etapa está marcada como final. La campaña nunca "cerraría" un participante.');
            }

            /* Plantillas de tareas contra las etapas reales */
            (camp.plantillasTareas || []).forEach(function (p) {
                if (!String(p.nombre || '').trim()) errores.push('Hay una plantilla de tarea sin nombre.');
                if (p.etapaOrigen && !etapaDe(camp, p.etapaOrigen)) errores.push('La plantilla "' + p.nombre + '" apunta a una etapa que ya no existe.');
                if (p.etapaDestino && !etapaDe(camp, p.etapaDestino)) errores.push('La plantilla "' + p.nombre + '" apunta a una etapa destino que ya no existe.');
                if (p.desplazamientoDias !== undefined && p.desplazamientoDias !== '' && isNaN(Number(p.desplazamientoDias))) {
                    errores.push('La plantilla "' + p.nombre + '" tiene días de desplazamiento inválidos.');
                }
            });

            /* Ofertas contra el catálogo real (no se duplica el catálogo) */
            (camp.ofertas || []).forEach(function (o) {
                if (!String(o.nombre || '').trim()) errores.push('Hay una oferta sin nombre.');
                if (!o.paqueteId && !o.servicioId) {
                    errores.push('La oferta "' + o.nombre + '" no referencia ningún paquete ni servicio del catálogo.');
                }
                if (o.paqueteId && !almacen.paquete(o.paqueteId)) errores.push('La oferta "' + o.nombre + '" apunta a un paquete que no existe.');
                if (o.servicioId && !almacen.servicio(o.servicioId)) errores.push('La oferta "' + o.nombre + '" apunta a un servicio que no existe.');
                if (o.precioEspecial !== undefined && o.precioEspecial !== '' && Number(o.precioEspecial) < 0) {
                    errores.push('La oferta "' + o.nombre + '" tiene un precio negativo.');
                }
            });

            /* Beneficios */
            (camp.beneficios || []).forEach(function (b) {
                if (!String(b.nombre || '').trim()) errores.push('Hay un beneficio sin nombre.');
                if (b.valorReferencia !== undefined && b.valorReferencia !== '' && Number(b.valorReferencia) < 0) {
                    errores.push('El beneficio "' + b.nombre + '" tiene un valor de referencia negativo.');
                }
            });

            /* Campos personalizados */
            var nombresCampo = {};
            (camp.camposPersonalizados || []).forEach(function (c) {
                if (!String(c.etiqueta || '').trim()) errores.push('Hay un campo personalizado sin etiqueta.');
                if (!String(c.nombre || '').trim()) errores.push('El campo "' + (c.etiqueta || '') + '" no tiene nombre técnico.');
                if (nombresCampo[c.nombre]) errores.push('El campo "' + c.nombre + '" está repetido: los nombres técnicos deben ser únicos.');
                nombresCampo[c.nombre] = true;
                if ((c.tipo === 'seleccion' || c.tipo === 'seleccionMultiple') && !(c.opciones || []).length) {
                    avisos.push('El campo "' + (c.etiqueta || c.nombre) + '" es de selección pero no tiene opciones.');
                }
            });

            /* Datos requeridos del prospecto */
            (camp.datosRequeridos || []).forEach(function (dr) {
                var existe = Catalogos.camposProspecto.filter(function (cp) { return cp.id === dr.campo; })[0];
                if (!existe) errores.push('Se pide un dato del prospecto que no existe: ' + dr.campo);
            });

            /* Criterios de elegibilidad */
            (camp.criteriosElegibilidad || []).forEach(function (c) {
                var tipo = Catalogos.ayudaCriterio(c.tipo);
                if (!tipo) { errores.push('Hay un criterio de elegibilidad desconocido: ' + c.tipo); return; }
                if (tipo.tipoValor === 'rango-edad' && (c.valor === '' || c.valor === undefined) && (c.valor2 === '' || c.valor2 === undefined)) {
                    errores.push('El criterio de edad no tiene ningún límite.');
                }
                if (tipo.tipoValor === 'lista-campanias' && !c.valor) {
                    errores.push('El criterio "' + tipo.etiqueta + '" no eligió campaña.');
                }
            });

            /* Metas */
            Object.keys(camp.metas || {}).forEach(function (k) {
                if (Number(camp.metas[k]) < 0) errores.push('La meta "' + (ETIQUETAS_METAS[k] || k) + '" no puede ser negativa.');
            });

            /* Lo que se exige sólo al activar */
            if (op.paraActivar) {
                if (!String(camp.objetivoPrincipal || '').trim()) errores.push('Antes de activar hay que escribir el objetivo principal.');
                if (!camp.fechaInicio) errores.push('Antes de activar hay que definir la fecha de inicio.');
                if (!(camp.publicoObjetivo && (camp.publicoObjetivo.fuentes || []).length)) {
                    avisos.push('La campaña no declaró de dónde saldrán los participantes (público objetivo).');
                }
                if (!(camp.etapas || []).length) errores.push('Antes de activar la campaña necesita etapas.');
                if (!String(camp.tipo || '').trim()) errores.push('Antes de activar hay que elegir el tipo de campaña.');
            }

            return { ok: errores.length === 0, errores: errores, avisos: avisos };
        };

        /* Cambios de estado con reglas: activar exige validación previa. */
        motor.cambiarEstadoCampania = function (id, estadoNuevo, motivo) {
            var camp = campania(id);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var anterior = camp.estado;

            if (estadoNuevo === 'activa') {
                var v = motor.validarCampania(camp, { paraActivar: true });
                if (!v.ok) return { ok: false, errores: v.errores, avisos: v.avisos };
            }
            if (anterior === 'finalizada' && (estadoNuevo === 'activa' || estadoNuevo === 'pausada')) {
                return { ok: false, errores: ['Una campaña finalizada no se puede reabrir sin duplicarla. Usa "Duplicar campaña" para volver a operar con la misma configuración.'] };
            }

            camp.estado = estadoNuevo;
            camp.fechaActualizacion = Util.ahora();
            camp.actualizadoPor = usuarioDeSesion();
            motor.registrar('campania', camp.id, camp.nombre, 'estado',
                'Estado cambiado de ' + Catalogos.etiquetaEstadoCampania(anterior) + ' a ' + Catalogos.etiquetaEstadoCampania(estadoNuevo) + (motivo ? ' · ' + motivo : ''));
            almacen.guardar('campania-estado');
            return { ok: true, campania: camp, estadoAnterior: anterior };
        };

        motor.activarCampania = function (id) { return motor.cambiarEstadoCampania(id, 'activa'); };
        motor.pausarCampania = function (id) { return motor.cambiarEstadoCampania(id, 'pausada'); };
        motor.finalizarCampania = function (id) { return motor.cambiarEstadoCampania(id, 'finalizada'); };
        motor.cancelarCampania = function (id) { return motor.cambiarEstadoCampania(id, 'cancelada'); };

        /* Edición de la campaña. Si está finalizada, solo se permiten campos no
           estructurales (o forzar:true, que deja aviso en el historial). */
        motor.actualizarCampania = function (id, cambios, opciones) {
            var op = opciones || {};
            var camp = campania(id);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var errores = [];
            var avisos = [];
            var campos = Object.keys(cambios || {});

            if (camp.estado === 'finalizada' && !op.forzar) {
                var estructurales = campos.filter(function (c) { return CAMPOS_ESTRUCTURALES.indexOf(c) !== -1; });
                if (estructurales.length) {
                    return {
                        ok: false,
                        errores: ['La campaña está finalizada: no se pueden cambiar ' + estructurales.join(', ') + ' porque alteraría el historial.'],
                        avisos: []
                    };
                }
            }
            if (camp.estado === 'finalizada' && op.forzar) {
                avisos.push('Se modificó una campaña finalizada. Queda registrado en el historial.');
            }

            campos.forEach(function (campo) {
                camp[campo] = Util.clonar(cambios[campo]);
            });
            camp.fechaActualizacion = Util.ahora();
            camp.actualizadoPor = usuarioDeSesion();
            motor.registrar('campania', camp.id, camp.nombre, 'editar', 'Se actualizó: ' + campos.join(', ') + '.');
            almacen.guardar('campania-editada');
            return { ok: true, campania: camp, errores: errores, avisos: avisos };
        };

        /* Duplicar configuración: sirve para repetir una campaña cada temporada. */
        motor.duplicarCampania = function (id, nuevoNombre) {
            var original = campania(id);
            if (!original) return { ok: false, errores: ['La campaña no existe.'] };
            var copia = Util.clonar(original);
            copia.id = Util.nuevoId('cmp');
            copia.nombre = (nuevoNombre || (original.nombre + ' (copia)')).trim();
            copia.estado = 'borrador';
            copia.fechaCreacion = Util.ahora();
            copia.fechaActualizacion = Util.ahora();
            copia.creadoPor = usuarioDeSesion();
            copia.actualizadoPor = usuarioDeSesion();
            /* Las etapas, plantillas, ofertas y beneficios se copian con IDs nuevos. */
            var mapaEtapas = {};
            copia.etapas = (original.etapas || []).map(function (e) {
                var nueva = Util.clonar(e);
                var idViejo = nueva.id;
                nueva.id = Util.nuevoId('etp');
                mapaEtapas[idViejo] = nueva.id;
                return nueva;
            });
            copia.plantillasTareas = (original.plantillasTareas || []).map(function (p) {
                var nueva = Util.clonar(p);
                nueva.id = Util.nuevoId('plt');
                if (mapaEtapas[nueva.etapaOrigen]) nueva.etapaOrigen = mapaEtapas[nueva.etapaOrigen];
                if (mapaEtapas[nueva.etapaDestino]) nueva.etapaDestino = mapaEtapas[nueva.etapaDestino];
                return nueva;
            });
            copia.camposPersonalizados = (original.camposPersonalizados || []).map(function (c) {
                var nueva = Util.clonar(c);
                nueva.id = Util.nuevoId('cp');
                return nueva;
            });
            copia.beneficios = (original.beneficios || []).map(function (b) { var n = Util.clonar(b); n.id = Util.nuevoId('ben'); return n; });
            copia.ofertas = (original.ofertas || []).map(function (o) { var n = Util.clonar(o); n.id = Util.nuevoId('oft'); return n; });
            copia.criteriosElegibilidad = (original.criteriosElegibilidad || []).map(function (c) { var n = Util.clonar(c); n.id = Util.nuevoId('cri'); return n; });
            if (copia.configuracion && copia.configuracion.sincronizarFaseComercial) {
                var mapa = copia.configuracion.sincronizarFaseComercial.mapa || {};
                var mapaNuevo = {};
                Object.keys(mapa).forEach(function (k) {
                    if (mapaEtapas[k]) mapaNuevo[mapaEtapas[k]] = mapa[k];
                });
                copia.configuracion.sincronizarFaseComercial.mapa = mapaNuevo;
            }
            db().campanias.push(copia);
            motor.registrar('campania', copia.id, copia.nombre, 'crear', 'Campaña duplicada de "' + original.nombre + '".');
            almacen.guardar('campania-duplicada');
            return { ok: true, campania: copia };
        };

        /* Una campaña con historial NO se borra: se cancela. */
        motor.eliminarCampania = function (id) {
            var camp = campania(id);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var usos = db().participaciones.filter(function (p) { return p.campaignId === id; }).length;
            if (usos > 0) {
                return {
                    ok: false,
                    errores: ['Esta campaña tiene ' + usos + ' participación(es) con historial. No se puede borrar: usa "Cancelar campaña" para conservar el registro.']
                };
            }
            db().campanias = db().campanias.filter(function (c) { return c.id !== id; });
            db().tareas = db().tareas.filter(function (t) { return t.campaniaId !== id; });
            motor.registrar('campania', id, camp.nombre, 'eliminar', 'Campaña sin participaciones eliminada definitivamente.');
            almacen.guardar('campania-eliminada');
            return { ok: true };
        };

        /* ───────────── Etapas del flujo ───────────── */

        motor.agregarEtapa = function (campaniaId, datos) {
            var camp = campania(campaniaId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var d = datos || {};
            var orden = Number(d.orden) || (etapasOrdenadas(camp).length + 1);
            var etapa = {
                id: Util.nuevoId('etp'),
                nombre: (d.nombre || '').trim() || ('Etapa ' + orden),
                orden: orden,
                descripcion: d.descripcion || '',
                esInicial: !!d.esInicial && !motor.etapaInicial(camp),
                esFinal: !!d.esFinal,
                resultadoTipo: d.resultadoTipo || 'ninguno'
            };
            camp.etapas.push(etapa);
            if (!camp.etapas.filter(function (e) { return e.esInicial; }).length) etapa.esInicial = true;
            camp.fechaActualizacion = Util.ahora();
            motor.registrar('campania', camp.id, camp.nombre, 'editar', 'Se agregó la etapa "' + etapa.nombre + '".');
            almacen.guardar('etapa-agregada');
            return { ok: true, etapa: etapa };
        };

        motor.actualizarEtapa = function (campaniaId, etapaId, cambios) {
            var camp = campania(campaniaId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var etapa = etapaDe(camp, etapaId);
            if (!etapa) return { ok: false, errores: ['La etapa no existe.'] };
            if (camp.estado === 'finalizada') return { ok: false, errores: ['La campaña está finalizada: sus etapas quedan congeladas para no romper el historial.'] };

            Object.keys(cambios || {}).forEach(function (k) {
                if (k === 'id') return;
                etapa[k] = cambios[k];
            });
            if (cambios && cambios.esInicial) {
                camp.etapas.forEach(function (e) { if (e.id !== etapaId) e.esInicial = false; });
            }
            camp.fechaActualizacion = Util.ahora();
            motor.registrar('campania', camp.id, camp.nombre, 'editar', 'Se actualizó la etapa "' + etapa.nombre + '".');
            almacen.guardar('etapa-editada');
            return { ok: true, etapa: etapa };
        };

        motor.moverEtapa = function (campaniaId, etapaId, direccion) {
            var camp = campania(campaniaId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var orden = etapasOrdenadas(camp);
            var i = orden.map(function (e) { return e.id; }).indexOf(etapaId);
            var j = i + (direccion === 'subir' ? -1 : 1);
            if (i < 0 || j < 0 || j >= orden.length) return { ok: false, errores: ['La etapa ya está en el extremo.'] };
            var temp = orden[i].orden;
            orden[i].orden = orden[j].orden;
            orden[j].orden = temp;
            almacen.guardar('etapas-reordenadas');
            return { ok: true };
        };

        /* No se elimina una etapa que ya tenga participaciones: hay que reasignarlas. */
        motor.eliminarEtapa = function (campaniaId, etapaId, etapaReemplazoId) {
            var camp = campania(campaniaId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var etapa = etapaDe(camp, etapaId);
            if (!etapa) return { ok: false, errores: ['La etapa no existe.'] };
            if (camp.etapas.length <= 1) return { ok: false, errores: ['La campaña necesita al menos una etapa.'] };

            var dentro = db().participaciones.filter(function (p) { return p.campaignId === campaniaId && p.etapaId === etapaId; });
            if (dentro.length) {
                if (!etapaReemplazoId) {
                    return { ok: false, errores: ['Hay ' + dentro.length + ' participación(es) en esta etapa. Elige a qué etapa moverlas antes de eliminarla.'], participacionesAfectadas: dentro.length };
                }
                var destino = etapaDe(camp, etapaReemplazoId);
                if (!destino) return { ok: false, errores: ['La etapa de reemplazo no existe.'] };
                dentro.forEach(function (p) {
                    p.historial = p.historial || [];
                    p.historial.push({ fecha: Util.ahora(), usuario: usuarioDeSesion(), campo: 'etapaId', valorAnterior: etapa.nombre, valorNuevo: destino.nombre, nota: 'Reasignada al eliminar la etapa.' });
                    p.etapaId = etapaReemplazoId;
                    p.fechaActualizacion = Util.ahora();
                });
            }
            camp.etapas = camp.etapas.filter(function (e) { return e.id !== etapaId; });
            if (etapa.esInicial) {
                var primera = etapasOrdenadas(camp)[0];
                if (primera) primera.esInicial = true;
            }
            camp.fechaActualizacion = Util.ahora();
            motor.registrar('campania', camp.id, camp.nombre, 'editar', 'Se eliminó la etapa "' + etapa.nombre + '"' + (dentro.length ? ' y se movieron ' + dentro.length + ' participación(es).' : '.'));
            almacen.guardar('etapa-eliminada');
            return { ok: true, reasignadas: dentro.length };
        };

        /* ───────────── Prospectos ───────────── */

        motor.crearProspecto = function (datos) {
            var d = datos || {};
            if (!String(d.nombre || '').trim()) return { ok: false, errores: ['El nombre del prospecto es obligatorio.'] };
            var nuevo = {
                id: Util.nuevoId('pro'),
                nombre: d.nombre.trim(),
                telefono: d.telefono || '',
                email: d.email || '',
                ciudad: d.ciudad || '',
                origen: d.origen || 'Manual',
                faseComercial: d.faseComercial || Catalogos.fasesComerciales[0],
                fechaNacimiento: d.fechaNacimiento || '',
                fechaEvento: d.fechaEvento || '',
                tipoEvento: d.tipoEvento || '',
                presupuesto: Util.numero(d.presupuesto, 0),
                notas: d.notas || '',
                fechaRegistro: d.fechaRegistro || Util.hoy(),
                fechaUltimoContacto: d.fechaUltimoContacto || '',
                convertido: false,
                clienteId: null,
                etiquetas: d.etiquetas || []
            };
            db().prospectos.push(nuevo);
            motor.registrar('prospecto', nuevo.id, nuevo.nombre, 'crear', 'Prospecto creado con origen ' + nuevo.origen + '.');
            almacen.guardar('prospecto-creado');
            return { ok: true, prospecto: nuevo };
        };

        motor.actualizarProspecto = function (id, cambios) {
            var p = prospecto(id);
            if (!p) return { ok: false, errores: ['El prospecto no existe.'] };
            var antes = Util.clonar(p);
            Object.keys(cambios || {}).forEach(function (k) {
                if (k === 'id') return;
                p[k] = cambios[k];
            });
            var detalle = Object.keys(cambios || {}).filter(function (k) { return k !== 'id'; }).join(', ');
            motor.registrar('prospecto', p.id, p.nombre, 'editar', 'Se actualizó: ' + detalle + '.');
            almacen.guardar('prospecto-editado');
            return { ok: true, prospecto: p, antes: antes };
        };

        /* Solo se permite borrar un prospecto sin ninguna participación ni cliente. */
        motor.eliminarProspecto = function (id) {
            var p = prospecto(id);
            if (!p) return { ok: false, errores: ['El prospecto no existe.'] };
            var participaciones = db().participaciones.filter(function (x) { return x.prospectId === id; });
            if (participaciones.length) {
                return { ok: false, errores: ['El prospecto tiene ' + participaciones.length + ' participación(es) en campañas. Primero elimínalas si de verdad quieres borrarlo.'] };
            }
            if (p.clienteId) return { ok: false, errores: ['El prospecto ya es cliente: no se puede borrar.'] };
            db().prospectos = db().prospectos.filter(function (x) { return x.id !== id; });
            db().tareas = db().tareas.map(function (t) {
                if (t.prospectoId === id) { t.prospectoId = null; }
                return t;
            });
            motor.registrar('prospecto', id, p.nombre, 'eliminar', 'Prospecto sin participaciones eliminado.');
            almacen.guardar('prospecto-eliminado');
            return { ok: true };
        };

        /* ───────────── Elegibilidad ───────────── */

        motor.participacionesDeProspecto = function (prospectoId) {
            return db().participaciones.filter(function (p) { return p.prospectId === prospectoId; });
        };
        motor.participacionesDeCampania = function (campaniaId) {
            return db().participaciones.filter(function (p) { return p.campaignId === campaniaId; });
        };
        motor.participacionDe = function (campaniaId, prospectoId) {
            return db().participaciones.filter(function (p) { return p.campaignId === campaniaId && p.prospectId === prospectoId; })[0] || null;
        };
        motor.participacion = function (id) { return participacion(id); };

        /* Evalúa un criterio estructurado contra un prospecto. Sin lenguaje SQL:
           cada criterio es un objeto {tipo, valor, valor2}. */
        motor.evaluarCriterio = function (prospecto, criterio) {
            var p = prospecto;
            var valor = criterio.valor;
            var participaciones = motor.participacionesDeProspecto(p.id);

            function siNo(v) { return v === true || v === 'si' || v === 'sí' || v === 'true'; }

            switch (criterio.tipo) {
                case 'faseComercial':
                    return { cumple: p.faseComercial === valor, detalle: 'Fase comercial: ' + (p.faseComercial || 'sin fase') };

                case 'ciudadContiene':
                    return { cumple: Util.normalizar(p.ciudad || '').indexOf(Util.normalizar(valor || '')) !== -1, detalle: 'Ciudad: ' + (p.ciudad || 'sin dato') };

                case 'origenEs':
                    return { cumple: p.origen === valor, detalle: 'Origen: ' + (p.origen || 'sin dato') };

                case 'edadEntre': {
                    var edad = Util.edad(p.fechaNacimiento);
                    var min = valor === '' || valor === undefined ? null : Number(valor);
                    var max = criterio.valor2 === '' || criterio.valor2 === undefined ? null : Number(criterio.valor2);
                    if (edad === null) return { cumple: false, detalle: 'Sin fecha de nacimiento' };
                    var ok = (min === null || edad >= min) && (max === null || edad <= max);
                    return { cumple: ok, detalle: 'Edad: ' + edad + ' años' };
                }

                case 'presupuestoMayor':
                    return { cumple: Util.numero(p.presupuesto, 0) >= Util.numero(valor, 0), detalle: 'Presupuesto: ' + Util.moneda(p.presupuesto) };

                case 'tipoEventoEs':
                    return { cumple: p.tipoEvento === valor, detalle: 'Tipo de evento: ' + (p.tipoEvento || 'sin dato') };

                case 'registradoDesde':
                    return { cumple: !!p.fechaRegistro && Util.diasEntre(p.fechaRegistro, valor) !== null && Util.diasEntre(valor, p.fechaRegistro) >= 0, detalle: 'Registrado: ' + Util.fmtFecha(p.fechaRegistro) };

                case 'registradoHasta':
                    return { cumple: !!p.fechaRegistro && Util.diasEntre(p.fechaRegistro, valor) >= 0, detalle: 'Registrado: ' + Util.fmtFecha(p.fechaRegistro) };

                case 'sinParticipacionPrevia':
                    return { cumple: participaciones.length === 0, detalle: participaciones.length + ' participación(es) previas' };

                case 'participoEnCampania':
                    return { cumple: participaciones.some(function (x) { return x.campaignId === valor; }), detalle: participaciones.length + ' participación(es) previas' };

                case 'noParticipoEnCampania':
                    return { cumple: !participaciones.some(function (x) { return x.campaignId === valor; }), detalle: participaciones.length + ' participación(es) previas' };

                case 'participacionConvertida': {
                    var hay = participaciones.some(function (x) { return x.convertida; });
                    var espera = siNo(valor);
                    return { cumple: espera ? hay : !hay, detalle: hay ? 'Ya convirtió antes' : 'Nunca ha convertido' };
                }

                case 'ultimoContactoAntesDe': {
                    if (!p.fechaUltimoContacto) return { cumple: false, detalle: 'Nunca contactado' };
                    return { cumple: Util.diasEntre(p.fechaUltimoContacto, valor) > 0, detalle: 'Último contacto: ' + Util.fmtFecha(p.fechaUltimoContacto) };
                }

                case 'sinContacto':
                    return { cumple: !p.fechaUltimoContacto && !participaciones.some(function (x) { return x.fechaUltimoContacto; }), detalle: p.fechaUltimoContacto ? 'Último contacto: ' + Util.fmtFecha(p.fechaUltimoContacto) : 'Nunca contactado' };

                case 'nombreContiene':
                    return { cumple: Util.normalizar(p.nombre).indexOf(Util.normalizar(valor || '')) !== -1, detalle: p.nombre };

                default:
                    return { cumple: true, detalle: 'Criterio desconocido ignorado (' + criterio.tipo + ')' };
            }
        };

        motor.evaluarElegibilidad = function (camp, prospecto) {
            var resultados = (camp.criteriosElegibilidad || []).map(function (c) {
                var r = motor.evaluarCriterio(prospecto, c);
                return { criterio: c, cumple: r.cumple, detalle: r.detalle, etiqueta: Catalogos.ayudaCriterio(c.tipo).etiqueta };
            });
            var yaParticipa = !!motor.participacionDe(camp.id, prospecto.id);
            return {
                elegible: resultados.every(function (r) { return r.cumple; }),
                resultados: resultados,
                yaParticipa: yaParticipa
            };
        };

        /* Candidatos para una campaña: prospectos + (si se pide) clientes.
           Devuelve el detalle de por qué cada uno entra o no. */
        motor.candidatos = function (camp, opciones) {
            var op = opciones || {};
            var fuentes = (camp.publicoObjetivo && camp.publicoObjetivo.fuentes) || [];
            var lista = [];

            var incluirProspectos = true;
            if (fuentes.length && fuentes.indexOf('clientes') !== -1 && fuentes.indexOf('prospectosExistentes') === -1 &&
                fuentes.indexOf('participantesAnteriores') === -1 && fuentes.indexOf('prospectosNuevos') === -1) {
                incluirProspectos = false;
            }

            if (incluirProspectos) {
                lista = lista.concat(db().prospectos.map(function (p) { return { prospecto: p, tipo: 'prospecto' }; }));
            }
            if (fuentes.indexOf('clientes') !== -1) {
                db().clientes.forEach(function (c) {
                    if (c.prospectoOrigenId && !db().prospectos.some(function (p) { return p.id === c.prospectoOrigenId; })) {
                        lista.push({
                            prospecto: {
                                id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email, ciudad: c.ciudad,
                                origen: 'Cliente anterior', faseComercial: 'Frecuente', fechaRegistro: c.fechaAlta,
                                esClienteSinProspecto: true
                            }, tipo: 'cliente'
                        });
                    }
                });
            }

            var salida = lista.map(function (entrada) {
                var p = entrada.prospecto;
                var ev = p.esClienteSinProspecto
                    ? { elegible: true, resultados: [], yaParticipa: false }
                    : motor.evaluarElegibilidad(camp, p);
                return {
                    prospecto: p, tipo: entrada.tipo,
                    elegible: ev.elegible, resultados: ev.resultados, yaParticipa: ev.yaParticipa
                };
            });

            if (op.busqueda) {
                var t = Util.normalizar(op.busqueda);
                salida = salida.filter(function (c) {
                    return Util.normalizar([c.prospecto.nombre, c.prospecto.telefono, c.prospecto.ciudad, c.prospecto.origen].join(' ')).indexOf(t) !== -1;
                });
            }
            if (!op.incluirYaParticipan) salida = salida.filter(function (c) { return !c.yaParticipa; });
            if (!op.incluirNoElegibles) salida = salida.filter(function (c) { return c.elegible; });
            if (op.origenFiltro) salida = salida.filter(function (c) { return c.prospecto.origen === op.origenFiltro; });
            salida = Util.ordenarPor(salida, function (c) { return Util.normalizar(c.prospecto.nombre); });
            if (op.limite) salida = salida.slice(0, op.limite);
            return salida;
        };

        /* ───────────── Participaciones ───────────── */

        function datosFaltantes(camp, Prospecto) {
            return (camp.datosRequeridos || []).filter(function (dr) {
                if (!dr.obligatorio) return false;
                var v = Prospecto[dr.campo];
                return v === undefined || v === null || String(v).trim() === '';
            }).map(function (dr) {
                var campo = Catalogos.camposProspecto.filter(function (c) { return c.id === dr.campo; })[0];
                return campo ? campo.etiqueta : dr.campo;
            });
        }
        motor.datosFaltantes = datosFaltantes;

        /* ¿Esta campaña puede recibir participantes y generar tareas?
           Regla de operación pedida por Jorge: SOLO una campaña ACTIVA opera.
           Una campaña en borrador o programada no arrancó; una pausada está
           detenida; una finalizada o cancelada ya cerró (estas dos últimas
           solo con la acción explícita `forzar`, según el pliego §7). */
        motor.puedeRecibirParticipantes = function (camp) {
            if (!camp) return { ok: false, motivo: 'La campaña no existe.', codigo: 'sin-campania' };
            if (camp.estado === 'activa') return { ok: true, motivo: '' };
            if (camp.estado === 'borrador') {
                return { ok: false, motivo: 'La campaña está en borrador: primero actívala para poder agregar participantes. Mientras no esté activa no genera tareas.', codigo: 'campania-no-activa' };
            }
            if (camp.estado === 'programada') {
                return { ok: false, motivo: 'La campaña está programada pero todavía no arranca: actívala para poder agregar participantes.', codigo: 'campania-no-activa' };
            }
            if (camp.estado === 'pausada') {
                return { ok: false, motivo: 'La campaña está pausada: no recibe participantes nuevos ni genera tareas. Reactívala para continuar.', codigo: 'campania-no-activa' };
            }
            return {
                ok: false,
                motivo: 'La campaña está ' + Catalogos.etiquetaEstadoCampania(camp.estado).toLowerCase() + ': ya no recibe nuevas participaciones.',
                codigo: 'campania-cerrada'
            };
        };

        motor.agregarParticipacion = function (datos) {
            var d = datos || {};
            var camp = campania(d.campaniaId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'], codigo: 'sin-campania' };
            var p = prospecto(d.prospectoId);
            if (!p) return { ok: false, errores: ['El prospecto no existe (no se crean participaciones huérfanas).'], codigo: 'sin-prospecto' };

            var puede = motor.puedeRecibirParticipantes(camp);
            if (!puede.ok) {
                var cerrada = camp.estado === 'finalizada' || camp.estado === 'cancelada';
                var permitido = d.forzar && cerrada; /* acción explícita, solo para campañas cerradas */
                if (!permitido) {
                    return { ok: false, errores: [puede.motivo], codigo: puede.codigo, campania: camp };
                }
                if (cerrada && !camp.configuracion.permitirParticipacionFinalizada) {
                    motor.registrar('participacion', '', p.nombre, 'crear',
                        'Se agregó a la campaña ' + camp.nombre + ' aunque está ' + camp.estado + ' (acción explícita).');
                }
            }

            var existente = motor.participacionDe(camp.id, p.id);
            if (existente && !camp.configuracion.permiteMultiplesParticipaciones && !d.forzar) {
                return {
                    ok: false,
                    errores: ['"' + p.nombre + '" ya participa en esta campaña. Puedes continuar su participación existente.'],
                    codigo: 'duplicado',
                    participacion: existente
                };
            }

            var inicial = motor.etapaInicial(camp);
            if (!inicial) return { ok: false, errores: ['La campaña no tiene una etapa inicial válida.'], codigo: 'sin-etapa' };

            var faltantes = datosFaltantes(camp, p);
            var nueva = {
                id: Util.nuevoId('par'),
                campaignId: camp.id,
                prospectId: p.id,
                fechaRegistro: d.fechaRegistro || Util.hoy(),
                fechaActualizacion: Util.ahora(),
                estado: faltantes.length ? 'pendienteValidacion' : 'registrada',
                etapaId: inicial.id,
                resultado: '',
                origen: d.origen || p.origen || 'Manual',
                datosCampania: d.datosCampania || {},
                autorizaciones: (camp.configuracion.requiereAutorizacion)
                    ? { requerida: true, estado: 'pendiente', responsableNombre: '', responsableTelefono: '', relacion: '', fecha: '', metodo: '', notas: '' }
                    : { requerida: false, estado: 'noRequerida', responsableNombre: '', responsableTelefono: '', relacion: '', fecha: '', metodo: '', notas: '' },
                ofertaAsignada: null,
                beneficioAsignado: null,
                valorPotencial: Util.numero(d.valorPotencial, Util.numero(p.presupuesto, 0)),
                valorConvertido: 0,
                fechaUltimoContacto: '',
                fechaProximoSeguimiento: d.fechaProximoSeguimiento || '',
                responsable: d.responsable || camp.configuracion.responsable || usuarioDeSesion(),
                notas: d.notas || '',
                tareasRelacionadas: [],
                convertida: false,
                fechaConversion: '',
                clienteId: null,
                historial: [{
                    fecha: Util.ahora(), usuario: usuarioDeSesion(), campo: 'participacion',
                    valorAnterior: '', valorNuevo: 'Creada en la etapa ' + inicial.nombre,
                    nota: 'Registrada en la campaña desde el origen ' + (d.origen || p.origen || 'Manual') + '.'
                }],
                creadoPor: usuarioDeSesion(),
                actualizadoPor: usuarioDeSesion()
            };
            db().participaciones.push(nueva);

            motor.registrar('participacion', nueva.id, p.nombre, 'crear',
                'Se agregó a la campaña "' + camp.nombre + '" en la etapa "' + inicial.nombre + '".');

            var avisos = [];
            if (faltantes.length) avisos.push('Faltan datos requeridos por la campaña: ' + faltantes.join(', ') + '. La participación queda pendiente de validación.');

            var tareas = [];
            if (d.generarTareas !== false) tareas = motor.generarTareasDeEtapa(nueva.id, inicial.id);

            almacen.guardar('participacion-creada');
            return { ok: true, participacion: nueva, avisos: avisos, tareasGeneradas: tareas, datosFaltantes: faltantes };
        };

        motor.agregarParticipaciones = function (campaniaId, prospectoIds, opciones) {
            var creadas = [], omitidas = [];
            (prospectoIds || []).forEach(function (pid) {
                var r = motor.agregarParticipacion(Object.assign({ campaniaId: campaniaId, prospectoId: pid }, opciones || {}));
                if (r.ok) creadas.push(r.participacion);
                else omitidas.push({ prospectoId: pid, motivo: (r.errores || [])[0] || 'No se pudo agregar', codigo: r.codigo });
            });
            return { ok: true, creadas: creadas, omitidas: omitidas, total: (prospectoIds || []).length };
        };

        /* Crear prospecto y participación de una sola vez (captación). */
        motor.crearProspectoYparticipar = function (campaniaId, datosProspecto, opciones) {
            var r = motor.crearProspecto(datosProspecto);
            if (!r.ok) return r;
            var rp = motor.agregarParticipacion(Object.assign({ campaniaId: campaniaId, prospectoId: r.prospecto.id }, opciones || {}));
            if (!rp.ok) return { ok: false, errores: rp.errores, prospecto: r.prospecto };
            return { ok: true, prospecto: r.prospecto, participacion: rp.participacion, avisos: rp.avisos };
        };

        /* Anota un cambio en el historial interno de la participación
           (esto es lo que permite interpretar el pasado años después). */
        function anotar(part, campo, antes, despues, nota) {
            part.historial = part.historial || [];
            part.historial.push({
                fecha: Util.ahora(), usuario: usuarioDeSesion(), campo: campo,
                valorAnterior: antes === undefined || antes === null ? '' : String(antes),
                valorNuevo: despues === undefined || despues === null ? '' : String(despues),
                nota: nota || ''
            });
        }
        motor.anotar = anotar;

        motor.actualizarParticipacion = function (id, cambios) {
            var part = participacion(id);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var protegidos = ['id', 'campaignId', 'prospectId', 'historial'];
            Object.keys(cambios || {}).forEach(function (k) {
                if (protegidos.indexOf(k) !== -1) return;
                var antes = part[k];
                part[k] = cambios[k];
                if (['estado', 'resultado', 'responsable', 'notas', 'valorPotencial', 'valorConvertido', 'fechaProximoSeguimiento', 'fechaUltimoContacto'].indexOf(k) !== -1) {
                    anotar(part, k, antes, cambios[k], '');
                }
            });
            part.fechaActualizacion = Util.ahora();
            part.actualizadoPor = usuarioDeSesion();
            almacen.guardar('participacion-editada');
            return { ok: true, participacion: part };
        };

        motor.cambiarEstadoParticipacion = function (id, estadoNuevo, nota) {
            var part = participacion(id);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var antes = part.estado;
            part.estado = estadoNuevo;
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'estado', Catalogos.objetoEstadoParticipacion(antes).etiqueta, Catalogos.objetoEstadoParticipacion(estadoNuevo).etiqueta, nota || '');
            motor.registrar('participacion', part.id, (prospecto(part.prospectId) || {}).nombre || '', 'estado',
                'Estado de la participación: ' + Catalogos.objetoEstadoParticipacion(antes).etiqueta + ' → ' + Catalogos.objetoEstadoParticipacion(estadoNuevo).etiqueta + (nota ? ' · ' + nota : ''));
            almacen.guardar('participacion-estado');
            return { ok: true, participacion: part };
        };

        /* Cambiar de etapa: NO toca la fase comercial del prospecto, salvo que la
           campaña tenga una regla explícita configurada (sincronizarFaseComercial). */
        motor.cambiarEtapa = function (participacionId, etapaId, nota) {
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var camp = campania(part.campaignId);
            if (!camp) return { ok: false, errores: ['La campaña no existe.'] };
            var destino = etapaDe(camp, etapaId);
            if (!destino) return { ok: false, errores: ['La etapa no pertenece a esta campaña.'] };

            var origen = etapaDe(camp, part.etapaId);
            part.etapaId = etapaId;
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'etapa', origen ? origen.nombre : '', destino.nombre, nota || '');

            /* Resultado declarado por la etapa (si declara alguno). */
            var cambiosEstado = [];
            if (destino.resultadoTipo && destino.resultadoTipo !== 'ninguno') {
                var mapaEstado = { interesado: null, noInteresado: 'sinInteres', convertido: 'convertida', descartado: 'noSeleccionada' };
                var nuevoEstado = mapaEstado[destino.resultadoTipo];
                if (nuevoEstado && part.estado !== nuevoEstado) {
                    var antesEstado = part.estado;
                    part.estado = nuevoEstado;
                    anotar(part, 'estado', Catalogos.objetoEstadoParticipacion(antesEstado).etiqueta, Catalogos.objetoEstadoParticipacion(nuevoEstado).etiqueta, 'Automático por la etapa "' + destino.nombre + '".');
                    cambiosEstado.push(nuevoEstado);
                }
            }

            /* Regla explícita y opcional de sincronización con la fase comercial. */
            var sincro = camp.configuracion && camp.configuracion.sincronizarFaseComercial;
            var faseAplicada = null;
            if (sincro && sincro.activo && sincro.mapa && sincro.mapa[etapaId]) {
                var p = prospecto(part.prospectId);
                if (p) {
                    faseAplicada = sincro.mapa[etapaId];
                    var faseAntes = p.faseComercial;
                    p.faseComercial = faseAplicada;
                    motor.registrar('prospecto', p.id, p.nombre, 'editar',
                        'Fase comercial actualizada por regla de la campaña "' + camp.nombre + '": ' + faseAntes + ' → ' + faseAplicada + '.');
                }
            }

            motor.registrar('participacion', part.id, (prospecto(part.prospectId) || {}).nombre || '', 'etapa',
                'Etapa: ' + (origen ? origen.nombre : '—') + ' → ' + destino.nombre + ' (campaña "' + camp.nombre + '")' + (nota ? ' · ' + nota : ''));

            var tareas = motor.generarTareasDeEtapa(part.id, etapaId);
            almacen.guardar('participacion-etapa');
            return { ok: true, participacion: part, tareasGeneradas: tareas, faseComercialAplicada: faseAplicada, cambiosEstado: cambiosEstado, etapaAnterior: origen };
        };

        /* Ofertas y beneficios: se guarda un SNAPSHOT en la participación, para
           que cambiar la campaña después no reescriba el pasado. */
        motor.asignarOferta = function (participacionId, ofertaId) {
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var camp = campania(part.campaignId);
            var oferta = (camp.ofertas || []).filter(function (o) { return o.id === ofertaId; })[0];
            if (!oferta) return { ok: false, errores: ['La oferta no existe en esta campaña.'] };

            var paquete = oferta.paqueteId ? almacen.paquete(oferta.paqueteId) : null;
            var servicio = oferta.servicioId ? almacen.servicio(oferta.servicioId) : null;
            var precioCatalogo = (paquete ? Util.numero(paquete.precio, 0) : 0) + (servicio ? Util.numero(servicio.precio, 0) : 0);

            var snapshot = {
                ofertaId: oferta.id,
                nombre: oferta.nombre,
                paqueteId: oferta.paqueteId || '',
                servicioId: oferta.servicioId || '',
                nombrePaquete: paquete ? paquete.nombre : '',
                nombreServicio: servicio ? servicio.nombre : '',
                precioCatalogo: precioCatalogo,
                precioEspecial: oferta.precioEspecial === '' || oferta.precioEspecial === undefined ? precioCatalogo : Util.numero(oferta.precioEspecial, precioCatalogo),
                condiciones: oferta.condiciones || '',
                vigencia: Util.clonar(oferta.vigencia || { fechaInicio: '', fechaFin: '', diasVigencia: 0 }),
                asignadaEn: Util.ahora()
            };
            part.ofertaAsignada = snapshot;
            /* Al asignar una oferta, el valor potencial pasa a ser el precio
               ofrecido (la cotización reemplaza la estimación inicial). */
            var valorAnterior = part.valorPotencial;
            part.valorPotencial = snapshot.precioEspecial;
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'ofertaAsignada', '', snapshot.nombre + ' (' + Util.moneda(snapshot.precioEspecial) + ')', 'Se guardó copia del precio y las condiciones del momento.');
            if (valorAnterior !== part.valorPotencial) {
                anotar(part, 'valorPotencial', Util.moneda(valorAnterior), Util.moneda(part.valorPotencial), 'Ajustado al precio de la oferta asignada.');
            }
            motor.registrar('participacion', part.id, (prospecto(part.prospectId) || {}).nombre || '', 'asignar', 'Oferta asignada: ' + snapshot.nombre + ' por ' + Util.moneda(snapshot.precioEspecial) + '.');
            almacen.guardar('oferta-asignada');
            return { ok: true, oferta: snapshot, participacion: part };
        };

        motor.asignarBeneficio = function (participacionId, beneficioId) {
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var camp = campania(part.campaignId);
            var beneficio = (camp.beneficios || []).filter(function (b) { return b.id === beneficioId; })[0];
            if (!beneficio) return { ok: false, errores: ['El beneficio no existe en esta campaña.'] };
            var snapshot = {
                beneficioId: beneficio.id,
                nombre: beneficio.nombre,
                tipo: beneficio.tipo || '',
                valorReferencia: Util.numero(beneficio.valorReferencia, 0),
                condiciones: beneficio.condiciones || '',
                vigencia: Util.clonar(beneficio.vigencia || { fechaInicio: '', fechaFin: '', diasVigencia: 0 }),
                asignadoEn: Util.ahora()
            };
            part.beneficioAsignado = snapshot;
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'beneficioAsignado', '', snapshot.nombre, 'Se guardó copia de las condiciones del momento.');
            motor.registrar('participacion', part.id, (prospecto(part.prospectId) || {}).nombre || '', 'asignar', 'Beneficio asignado: ' + snapshot.nombre + '.');
            almacen.guardar('beneficio-asignado');
            return { ok: true, beneficio: snapshot, participacion: part };
        };

        motor.quitarOferta = function (participacionId) {
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            anotar(part, 'ofertaAsignada', part.ofertaAsignada ? part.ofertaAsignada.nombre : '', '', 'Oferta retirada.');
            part.ofertaAsignada = null;
            almacen.guardar('oferta-retirada');
            return { ok: true };
        };

        motor.quitarBeneficio = function (participacionId) {
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            anotar(part, 'beneficioAsignado', part.beneficioAsignado ? part.beneficioAsignado.nombre : '', '', 'Beneficio retirado.');
            part.beneficioAsignado = null;
            almacen.guardar('beneficio-retirado');
            return { ok: true };
        };

        /* Registro de un contacto comercial: mueve el resumen de seguimiento. */
        motor.registrarContacto = function (participacionId, datos) {
            var d = datos || {};
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var antes = { ultimo: part.fechaUltimoContacto, proximo: part.fechaProximoSeguimiento, resultado: part.resultado };
            part.fechaUltimoContacto = d.fechaContacto || Util.hoy();
            if (d.fechaProximoSeguimiento !== undefined) part.fechaProximoSeguimiento = d.fechaProximoSeguimiento;
            if (d.resultado !== undefined) part.resultado = d.resultado;
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'contacto',
                antes.resultado ? Catalogos.etiquetaResultadoContacto(antes.resultado) : 'sin resultado',
                Catalogos.etiquetaResultadoContacto(part.resultado),
                (d.nota || '') + (part.fechaProximoSeguimiento ? ' · Próximo seguimiento: ' + Util.fmtFecha(part.fechaProximoSeguimiento) : ''));
            motor.registrar('participacion', part.id, (prospecto(part.prospectId) || {}).nombre || '', 'contacto',
                'Contacto registrado: ' + Catalogos.etiquetaResultadoContacto(part.resultado) + (d.nota ? ' · ' + d.nota : ''));
            almacen.guardar('contacto-registrado');
            return { ok: true, participacion: part };
        };

        /* Conversión: se reutiliza la persona, se crea/vincula el cliente. */
        motor.convertirParticipacion = function (participacionId, datos) {
            var d = datos || {};
            var part = participacion(participacionId);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            if (part.convertida) return { ok: false, errores: ['Esta participación ya está marcada como convertida.'], codigo: 'ya-convertida' };

            var camp = campania(part.campaignId);
            var p = prospecto(part.prospectId);
            if (!p) return { ok: false, errores: ['El prospecto de esta participación ya no existe.'] };

            var valor = d.valorConvertido !== undefined && d.valorConvertido !== ''
                ? Util.numero(d.valorConvertido, 0)
                : (part.ofertaAsignada ? Util.numero(part.ofertaAsignada.precioEspecial, 0) : Util.numero(part.valorPotencial, 0));

            var cliente = p.clienteId ? almacen.cliente(p.clienteId) : null;
            if (!cliente) {
                cliente = {
                    id: Util.nuevoId('cli'),
                    nombre: p.nombre,
                    telefono: p.telefono || '',
                    email: p.email || '',
                    ciudad: p.ciudad || '',
                    estado: 'Activo',
                    prospectoOrigenId: p.id,
                    campaniaOrigenId: camp ? camp.id : null,
                    participacionOrigenId: part.id,
                    paqueteId: (part.ofertaAsignada && part.ofertaAsignada.paqueteId) || '',
                    valorContratado: valor,
                    fechaAlta: Util.hoy(),
                    notas: 'Cliente generado desde la campaña "' + (camp ? camp.nombre : '—') + '".'
                };
                db().clientes.push(cliente);
                motor.registrar('cliente', cliente.id, cliente.nombre, 'crear', 'Cliente creado al convertir la participación en la campaña "' + (camp ? camp.nombre : '—') + '".');
            }

            p.convertido = true;
            p.clienteId = cliente.id;

            part.convertida = true;
            part.fechaConversion = d.fechaConversion || Util.hoy();
            part.clienteId = cliente.id;
            part.valorConvertido = valor;
            part.estado = 'convertida';
            part.fechaActualizacion = Util.ahora();
            anotar(part, 'conversion', '', Util.moneda(valor), 'Cliente vinculado: ' + cliente.nombre + '. Se conserva la misma persona, no se duplica.');

            /* Si la campaña tiene una etapa de conversión, se mueve ahí. */
            var movida = false;
            if (d.moverEtapa !== false) {
                var etapaConversion = etapaPorResultado(camp, 'convertido');
                if (etapaConversion && part.etapaId !== etapaConversion.id) {
                    var anterior = etapaDe(camp, part.etapaId);
                    part.etapaId = etapaConversion.id;
                    anotar(part, 'etapa', anterior ? anterior.nombre : '', etapaConversion.nombre, 'Movimiento automático al registrar la conversión.');
                    movida = true;
                }
            }

            motor.registrar('participacion', part.id, p.nombre, 'convertir', 'Conversión registrada por ' + Util.moneda(valor) + ' en la campaña "' + (camp ? camp.nombre : '—') + '".');
            almacen.guardar('participacion-convertida');
            return { ok: true, participacion: part, cliente: cliente, valorConvertido: valor, etapaMovida: movida };
        };

        motor.eliminarParticipacion = function (id) {
            var part = participacion(id);
            if (!part) return { ok: false, errores: ['La participación no existe.'] };
            var nombre = (prospecto(part.prospectId) || {}).nombre || '';
            db().participaciones = db().participaciones.filter(function (p) { return p.id !== id; });
            /* Las tareas no se destruyen: se desvinculan de la participación. */
            var desvinculadas = 0;
            db().tareas.forEach(function (t) {
                if (t.participacionId === id) { t.participacionId = null; desvinculadas++; }
            });
            motor.registrar('participacion', id, nombre, 'eliminar',
                'Participación eliminada' + (desvinculadas ? '. Se conservaron ' + desvinculadas + ' tarea(s) sin vínculo.' : '.'));
            almacen.guardar('participacion-eliminada');
            return { ok: true, tareasDesvinculadas: desvinculadas };
        };

        /* ───────────── Tareas (sistema único, compartido con el calendario) ───────────── */

        motor.crearTarea = function (datos) {
            var d = datos || {};
            if (!String(d.titulo || '').trim()) return { ok: false, errores: ['La tarea necesita un título.'] };
            var t = {
                id: Util.nuevoId('tar'),
                titulo: d.titulo.trim(),
                tipo: d.tipo || Catalogos.tiposTarea[0],
                descripcion: d.descripcion || '',
                /* Si no se manda fecha, se agenda para hoy. Si se manda vacía
                   a propósito (fecha: ''), la tarea queda SIN FECHA y aparece
                   en el grupo "Sin fecha" del panel del prospecto. */
                fecha: (d.fecha === undefined || d.fecha === null) ? Util.hoy() : d.fecha,
                hora: d.hora || '10:00',
                prioridad: d.prioridad || 'Normal',
                estado: d.estado || 'pendiente',
                prospectoId: d.prospectoId || null,
                campaniaId: d.campaniaId || null,
                participacionId: d.participacionId || null,
                plantillaId: d.plantillaId || null,
                responsable: d.responsable || usuarioDeSesion(),
                origen: d.origen || (d.campaniaId ? 'campania' : 'manual'),
                resultadoContacto: d.resultadoContacto || '',
                notaResultado: d.notaResultado || '',
                fechaProximoSeguimiento: d.fechaProximoSeguimiento || '',
                creadaEn: Util.ahora(),
                completadaEn: d.completadaEn || ''
            };
            db().tareas.push(t);
            if (t.participacionId) {
                var part = participacion(t.participacionId);
                if (part) {
                    part.tareasRelacionadas = part.tareasRelacionadas || [];
                    if (part.tareasRelacionadas.indexOf(t.id) === -1) part.tareasRelacionadas.push(t.id);
                }
            }
            motor.registrar('tarea', t.id, t.titulo, 'crear', 'Tarea para el ' + Util.fmtFecha(t.fecha) + (t.campaniaId ? ' (campaña).' : '.'));
            almacen.guardar('tarea-creada');
            return { ok: true, tarea: t };
        };

        /* Cuando una participación entra a una etapa, se crean las tareas que la
           campaña tenga configuradas para esa etapa (plantillasTareas). */
        motor.generarTareasDeEtapa = function (participacionId, etapaId) {
            var part = participacion(participacionId);
            if (!part) return [];
            var camp = campania(part.campaignId);
            if (!camp) return [];
            var etapa = etapaDe(camp, etapaId);
            if (!etapa) return [];
            /* Automatizaciones SOLO con la campaña activa: en borrador,
               programada, pausada, finalizada o cancelada no se generan tareas. */
            if (camp.estado !== 'activa') return [];

            var p = prospecto(part.prospectId);
            var generadas = [];
            (camp.plantillasTareas || []).forEach(function (plt) {
                if (!plt.activa) return;
                if (plt.etapaOrigen !== etapaId) return;
                var yaExiste = db().tareas.some(function (t) {
                    return t.participacionId === part.id && t.plantillaId === plt.id && t.estado === 'pendiente';
                });
                if (yaExiste) return;

                var fecha = Util.sumarDias(Util.hoy(), Number(plt.desplazamientoDias || 0));
                var r = motor.crearTarea({
                    titulo: plt.nombre,
                    tipo: plt.tipo,
                    descripcion: plt.descripcion,
                    fecha: fecha,
                    prioridad: plt.prioridad,
                    responsable: plt.responsable || part.responsable,
                    prospectoId: part.prospectId,
                    campaniaId: camp.id,
                    participacionId: part.id,
                    plantillaId: plt.id,
                    origen: 'campania'
                });
                if (r.ok) {
                    generadas.push(r.tarea);
                    motor.registrar('participacion', part.id, p ? p.nombre : '', 'editar',
                        'Tarea generada por la etapa "' + etapa.nombre + '": ' + plt.nombre + ' (' + Util.fmtFecha(fecha) + ').');
                }
            });
            if (generadas.length) almacen.guardar('tareas-generadas');
            return generadas;
        };

        motor.completarTarea = function (tareaId, datos) {
            var d = datos || {};
            var t = tarea(tareaId);
            if (!t) return { ok: false, errores: ['La tarea no existe.'] };
            if (t.estado === 'completada') return { ok: false, errores: ['La tarea ya estaba completada.'], codigo: 'ya-completada' };

            t.estado = 'completada';
            t.completadaEn = Util.ahora();
            if (d.resultado !== undefined) t.resultadoContacto = d.resultado;
            if (d.nota !== undefined) t.notaResultado = d.nota;
            if (d.fechaProximoSeguimiento !== undefined) t.fechaProximoSeguimiento = d.fechaProximoSeguimiento;

            var contacto = null;
            if (t.participacionId) {
                contacto = motor.registrarContacto(t.participacionId, {
                    resultado: t.resultadoContacto,
                    nota: t.notaResultado,
                    fechaProximoSeguimiento: t.fechaProximoSeguimiento,
                    fechaContacto: d.fechaContacto || Util.hoy()
                });
            } else if (t.prospectoId) {
                var p = prospecto(t.prospectoId);
                if (p) {
                    p.fechaUltimoContacto = d.fechaContacto || Util.hoy();
                    motor.registrar('prospecto', p.id, p.nombre, 'contacto', 'Contacto registrado desde una tarea: ' + Catalogos.etiquetaResultadoContacto(t.resultadoContacto) + '.');
                }
            }

            motor.registrar('tarea', t.id, t.titulo, 'editar', 'Tarea completada' + (t.resultadoContacto ? ' · Resultado: ' + Catalogos.etiquetaResultadoContacto(t.resultadoContacto) : '') + '.');
            almacen.guardar('tarea-completada');
            return { ok: true, tarea: t, contacto: contacto };
        };

        motor.reabrirTarea = function (tareaId) {
            var t = tarea(tareaId);
            if (!t) return { ok: false, errores: ['La tarea no existe.'] };
            t.estado = 'pendiente';
            t.completadaEn = '';
            motor.registrar('tarea', t.id, t.titulo, 'editar', 'Tarea reabierta.');
            almacen.guardar('tarea-reabierta');
            return { ok: true, tarea: t };
        };

        motor.actualizarTarea = function (tareaId, cambios) {
            var t = tarea(tareaId);
            if (!t) return { ok: false, errores: ['La tarea no existe.'] };
            Object.keys(cambios || {}).forEach(function (k) {
                if (k === 'id') return;
                t[k] = cambios[k];
            });
            motor.registrar('tarea', t.id, t.titulo, 'editar', 'Tarea actualizada.');
            almacen.guardar('tarea-editada');
            return { ok: true, tarea: t };
        };

        motor.eliminarTarea = function (tareaId) {
            var t = tarea(tareaId);
            if (!t) return { ok: false, errores: ['La tarea no existe.'] };
            db().tareas = db().tareas.filter(function (x) { return x.id !== tareaId; });
            var part = t.participacionId ? participacion(t.participacionId) : null;
            if (part && part.tareasRelacionadas) {
                part.tareasRelacionadas = part.tareasRelacionadas.filter(function (id) { return id !== tareaId; });
            }
            motor.registrar('tarea', tareaId, t.titulo, 'eliminar', 'Tarea eliminada.');
            almacen.guardar('tarea-eliminada');
            return { ok: true };
        };

        /* Agrupa tareas como se pidió para el panel derecho del prospecto:
           por vencimiento (vencidas · hoy · próximas · sin fecha) y, dentro de
           cada grupo, por FECHA y luego por PRIORIDAD (Alta → Normal → Baja).
           Las completadas van aparte, primero las más recientes. */
        motor.tareasAgrupadas = function (filtros) {
            var tareas = motor.tareasFiltradas(filtros || {});
            var hoy = Util.hoy();
            var grupos = { vencidas: [], hoy: [], proximas: [], sinFecha: [], completadas: [], total: tareas.length };

            tareas.forEach(function (t) {
                if (t.estado === 'completada') { grupos.completadas.push(t); return; }
                if (!t.fecha) { grupos.sinFecha.push(t); return; }
                var dias = Util.diasEntre(t.fecha, hoy);
                if (dias > 0) grupos.vencidas.push(t);
                else if (dias === 0) grupos.hoy.push(t);
                else grupos.proximas.push(t);
            });

            function porFechaYPrioridad(a, b) {
                if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
                return pesoPrioridad(a.prioridad) - pesoPrioridad(b.prioridad);
            }
            ['vencidas', 'hoy', 'proximas', 'sinFecha'].forEach(function (clave) {
                grupos[clave] = grupos[clave].slice().sort(porFechaYPrioridad);
            });
            grupos.completadas = Util.ordenarPor(grupos.completadas, function (t) { return t.completadaEn || ''; }, true);
            grupos.pendientes = grupos.vencidas.length + grupos.hoy.length + grupos.proximas.length + grupos.sinFecha.length;
            return grupos;
        };

        /* Conteo corto de las tareas de una campaña (para el panel del prospecto). */
        motor.resumenTareasDeCampania = function (campaniaId) {
            var tareas = motor.tareasDeCampania(campaniaId);
            var hoy = Util.hoy();
            return {
                total: tareas.length,
                pendientes: tareas.filter(function (t) { return t.estado === 'pendiente'; }).length,
                vencidas: tareas.filter(function (t) { return t.estado === 'pendiente' && t.fecha && Util.diasEntre(t.fecha, hoy) > 0; }).length,
                completadas: tareas.filter(function (t) { return t.estado === 'completada'; }).length
            };
        };

        motor.tareasFiltradas = function (filtros) {
            var f = filtros || {};
            return db().tareas.filter(function (t) {
                if (f.campaniaId && t.campaniaId !== f.campaniaId) return false;
                if (f.participacionId && t.participacionId !== f.participacionId) return false;
                if (f.prospectoId && t.prospectoId !== f.prospectoId) return false;
                if (f.estado && f.estado !== 'todas' && t.estado !== f.estado) return false;
                if (f.tipo && f.tipo !== 'todas') {
                    if (f.tipo === 'campanias' && t.origen !== 'campania') return false;
                    if (f.tipo === 'manuales' && t.origen === 'campania') return false;
                }
                if (f.desde && (!t.fecha || Util.diasEntre(f.desde, t.fecha) < 0)) return false;
                if (f.hasta && (!t.fecha || Util.diasEntre(t.fecha, f.hasta) < 0)) return false;
                if (f.texto) {
                    var p = t.prospectoId ? prospecto(t.prospectoId) : null;
                    var blob = Util.normalizar([t.titulo, t.tipo, t.descripcion, p ? p.nombre : ''].join(' '));
                    if (blob.indexOf(Util.normalizar(f.texto)) === -1) return false;
                }
                return true;
            });
        };

        motor.tareasDeParticipacion = function (participacionId) {
            return motor.tareasFiltradas({ participacionId: participacionId });
        };
        motor.tareasDeCampania = function (campaniaId) {
            return motor.tareasFiltradas({ campaniaId: campaniaId });
        };

        /* ───────────── Métricas, embudo y seguimientos ───────────── */

        motor.estadisticasCampania = function (campaniaId) {
            var camp = campania(campaniaId);
            var partes = motor.participacionesDeCampania(campaniaId);
            var tareas = motor.tareasDeCampania(campaniaId);
            var hoy = Util.hoy();

            var porEstado = {};
            var porEtapa = {};
            var porOrigen = {};
            var valorPotencial = 0, valorConvertido = 0, contactados = 0, interesados = 0, cotizaciones = 0, contratos = 0, validos = 0, rechazados = 0;

            partes.forEach(function (p) {
                porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
                porEtapa[p.etapaId] = (porEtapa[p.etapaId] || 0) + 1;
                var origen = p.origen || 'Sin origen';
                porOrigen[origen] = (porOrigen[origen] || 0) + 1;
                valorPotencial += Util.numero(p.valorPotencial, 0);
                valorConvertido += Util.numero(p.valorConvertido, 0);
                if (p.fechaUltimoContacto) contactados++;
                if (RESULTADOS_INTERES.indexOf(p.resultado) !== -1) interesados++;
                if (p.resultado === 'seEnvioCotizacion' || p.ofertaAsignada) cotizaciones++;
                if (p.convertida) contratos++;
                if (esParticipanteValido(p)) validos++;
                if (p.estado === 'rechazada' || p.estado === 'noSeleccionada') rechazados++;
            });

            var tareasPendientes = tareas.filter(function (t) { return t.estado === 'pendiente'; });
            var vencidas = tareasPendientes.filter(function (t) { return t.fecha && Util.diasEntre(t.fecha, hoy) > 0; });
            var seguimientosVencidos = partes.filter(function (p) {
                return p.fechaProximoSeguimiento && Util.diasEntre(p.fechaProximoSeguimiento, hoy) > 0 && ESTADOS_CERRADOS.indexOf(p.estado) === -1;
            });

            return {
                campaniaId: campaniaId,
                nombre: camp ? camp.nombre : '',
                estado: camp ? camp.estado : '',
                totalParticipantes: partes.length,
                porEstado: porEstado,
                porEtapa: porEtapa,
                porOrigen: porOrigen,
                validos: validos,
                rechazados: rechazados,
                contactados: contactados,
                interesados: interesados,
                cotizaciones: cotizaciones,
                contratos: contratos,
                tasaConversion: partes.length ? Math.round((contratos / partes.length) * 1000) / 10 : 0,
                valorPotencial: valorPotencial,
                valorConvertido: valorConvertido,
                tareasPendientes: tareasPendientes.length,
                tareasVencidas: vencidas.length,
                tareasCompletadas: tareas.filter(function (t) { return t.estado === 'completada'; }).length,
                seguimientosVencidos: seguimientosVencidos.length
            };
        };

        /* Embudo: total → validación → cada etapa configurable → conversión. */
        motor.embudo = function (campaniaId) {
            var camp = campania(campaniaId);
            if (!camp) return [];
            var partes = motor.participacionesDeCampania(campaniaId);
            var filas = [];
            filas.push({ clave: 'total', nombre: 'Total participantes', cantidad: partes.length, tipo: 'total' });

            var pendientesValidacion = partes.filter(function (p) { return p.estado === 'pendienteValidacion'; }).length;
            var validados = partes.filter(esParticipanteValido).length;
            filas.push({ clave: 'validacion', nombre: 'Validados', cantidad: validados, tipo: 'validacion', nota: pendientesValidacion ? pendientesValidacion + ' pendientes' : '' });

            etapasOrdenadas(camp).forEach(function (e) {
                filas.push({
                    clave: e.id, nombre: e.nombre,
                    cantidad: partes.filter(function (p) { return p.etapaId === e.id; }).length,
                    tipo: e.esInicial ? 'inicial' : (e.esFinal ? 'final' : 'etapa')
                });
            });
            filas.push({ clave: 'conversion', nombre: 'Conversiones', cantidad: partes.filter(function (p) { return p.convertida; }).length, tipo: 'conversion' });
            return filas;
        };

        motor.metasVsResultados = function (campaniaId) {
            var camp = campania(campaniaId);
            if (!camp) return [];
            var e = motor.estadisticasCampania(campaniaId);
            var reales = {
                registros: e.totalParticipantes,
                participantesValidos: e.validos,
                contactados: e.contactados,
                interesados: e.interesados,
                cotizaciones: e.cotizaciones,
                contratos: e.contratos,
                valorPotencial: e.valorPotencial,
                valorConvertido: e.valorConvertido
            };
            return Object.keys(ETIQUETAS_METAS).map(function (k) {
                var meta = Util.numero((camp.metas || {})[k], 0);
                var real = reales[k] || 0;
                return {
                    clave: k, etiqueta: ETIQUETAS_METAS[k], meta: meta, real: real,
                    pct: meta > 0 ? Math.min(300, Math.round((real / meta) * 100)) : (real > 0 ? 100 : 0),
                    esDinero: k.indexOf('valor') === 0
                };
            }).filter(function (m) { return m.meta > 0 || m.real > 0; });
        };

        /* Seguimientos calculados desde las participaciones (índice operativo). */
        motor.seguimientos = function (opciones) {
            var op = opciones || {};
            var hoy = Util.hoy();
            var salida = { vencidos: [], hoy: [], proximos: [], sinProgramar: [] };

            db().participaciones.forEach(function (p) {
                if (ESTADOS_CERRADOS.indexOf(p.estado) !== -1) return;
                var camp = campania(p.campaignId);
                if (camp && (camp.estado === 'cancelada')) return;
                var pro = prospecto(p.prospectId);
                var fila = {
                    participacion: p,
                    campania: camp,
                    prospecto: pro,
                    fecha: p.fechaProximoSeguimiento || '',
                    dias: p.fechaProximoSeguimiento ? Util.diasEntre(p.fechaProximoSeguimiento, hoy) : null
                };
                if (!p.fechaProximoSeguimiento) salida.sinProgramar.push(fila);
                else if (fila.dias > 0) salida.vencidos.push(fila);
                else if (fila.dias === 0) salida.hoy.push(fila);
                else if (fila.dias >= -7) salida.proximos.push(fila);
            });

            salida.vencidos = Util.ordenarPor(salida.vencidos, function (f) { return f.fecha; });
            salida.proximos = Util.ordenarPor(salida.proximos, function (f) { return f.fecha; });
            salida.sinProgramar = Util.ordenarPor(salida.sinProgramar, function (f) { return f.participacion.fechaRegistro; });
            if (op.limite) {
                ['vencidos', 'hoy', 'proximos', 'sinProgramar'].forEach(function (k) { salida[k] = salida[k].slice(0, op.limite); });
            }
            return salida;
        };

        /* Resumen para el panel general. */
        motor.resumenGlobal = function () {
            var hoy = Util.hoy();
            var partes = db().participaciones;
            var activas = db().campanias.filter(function (c) { return c.estado === 'activa'; });
            var seg = motor.seguimientos();
            var tareasPendientes = db().tareas.filter(function (t) { return t.estado === 'pendiente'; });
            var valorPotencial = 0, valorConvertido = 0;
            partes.forEach(function (p) {
                valorPotencial += Util.numero(p.valorPotencial, 0);
                valorConvertido += Util.numero(p.valorConvertido, 0);
            });
            var convertidas = partes.filter(function (p) { return p.convertida; }).length;

            return {
                campanias: db().campanias.length,
                campaniasActivas: activas.length,
                prospectos: db().prospectos.length,
                clientes: db().clientes.length,
                participaciones: partes.length,
                convertidas: convertidas,
                tasaConversion: partes.length ? Math.round((convertidas / partes.length) * 1000) / 10 : 0,
                valorPotencial: valorPotencial,
                valorConvertido: valorConvertido,
                tareasPendientes: tareasPendientes.length,
                tareasVencidas: tareasPendientes.filter(function (t) { return t.fecha && Util.diasEntre(t.fecha, hoy) > 0; }).length,
                seguimientosVencidos: seg.vencidos.length,
                seguimientosHoy: seg.hoy.length,
                sinSeguimiento: seg.sinProgramar.length
            };
        };

        /* Embudo consolidado de todas las campañas activas. */
        motor.embudoGlobal = function () {
            var activas = db().campanias.filter(function (c) { return c.estado === 'activa' || c.estado === 'programada'; });
            var partes = db().participaciones.filter(function (p) {
                return activas.some(function (c) { return c.id === p.campaignId; });
            });
            var convertidas = partes.filter(function (p) { return p.convertida; }).length;
            var contactadas = partes.filter(function (p) { return p.fechaUltimoContacto; }).length;
            var interesadas = partes.filter(function (p) { return RESULTADOS_INTERES.indexOf(p.resultado) !== -1; }).length;
            var cotizadas = partes.filter(function (p) { return p.resultado === 'seEnvioCotizacion' || p.ofertaAsignada; }).length;
            return [
                { nombre: 'Participantes', cantidad: partes.length, tipo: 'total' },
                { nombre: 'Contactados', cantidad: contactadas, tipo: 'etapa' },
                { nombre: 'Interesados', cantidad: interesadas, tipo: 'etapa' },
                { nombre: 'Con oferta o cotización', cantidad: cotizadas, tipo: 'etapa' },
                { nombre: 'Convertidos', cantidad: convertidas, tipo: 'final' }
            ];
        };

        /* Revisa que no haya registros huérfanos (integridad referencial). */
        motor.validarIntegridad = function () {
            var problemas = [];
            db().participaciones.forEach(function (p) {
                if (!campania(p.campaignId)) problemas.push('Participación ' + p.id + ' apunta a una campaña inexistente.');
                if (!prospecto(p.prospectId)) problemas.push('Participación ' + p.id + ' apunta a un prospecto inexistente.');
                var camp = campania(p.campaignId);
                if (camp && !etapaDe(camp, p.etapaId)) problemas.push('Participación ' + p.id + ' está en una etapa que ya no existe.');
            });
            db().tareas.forEach(function (t) {
                if (t.campaniaId && !campania(t.campaniaId)) problemas.push('Tarea ' + t.id + ' apunta a una campaña inexistente.');
                if (t.participacionId && !participacion(t.participacionId)) problemas.push('Tarea ' + t.id + ' apunta a una participación inexistente.');
                if (t.prospectoId && !prospecto(t.prospectoId)) problemas.push('Tarea ' + t.id + ' apunta a un prospecto inexistente.');
            });
            db().clientes.forEach(function (c) {
                if (c.participacionOrigenId && !participacion(c.participacionOrigenId)) problemas.push('Cliente ' + c.id + ' apunta a una participación inexistente.');
            });
            var duplicados = {};
            db().participaciones.forEach(function (p) {
                var clave = p.campaignId + '|' + p.prospectId;
                duplicados[clave] = (duplicados[clave] || 0) + 1;
            });
            Object.keys(duplicados).forEach(function (k) {
                if (duplicados[k] > 1) {
                    var partes = k.split('|');
                    var camp = campania(partes[0]), pro = prospecto(partes[1]);
                    problemas.push('Hay ' + duplicados[k] + ' participaciones de ' + (pro ? pro.nombre : partes[1]) + ' en ' + (camp ? camp.nombre : partes[0]) + '.');
                }
            });
            return { ok: problemas.length === 0, problemas: problemas };
        };

        /* Resumen de campañas de un prospecto: lo que se muestra en su ficha. */
        motor.resumenCampaniasDeProspecto = function (prospectoId) {
            var partes = motor.participacionesDeProspecto(prospectoId);
            var campanias = partes.map(function (p) { return campania(p.campaignId); }).filter(Boolean);
            var activas = campanias.filter(function (c) { return c.estado === 'activa'; });
            var ordenadas = Util.ordenarPor(partes, function (p) { return p.fechaRegistro; }, true);
            var enSeguimiento = partes.filter(function (p) {
                return p.estado === 'seguimientoComercial' || (p.fechaProximoSeguimiento && ESTADOS_CERRADOS.indexOf(p.estado) === -1);
            });
            return {
                participaciones: partes,
                total: partes.length,
                campaniasActivas: activas.length,
                ultimaParticipacion: ordenadas[0] || null,
                ultimaCampania: ordenadas[0] ? campania(ordenadas[0].campaignId) : null,
                enSeguimiento: enSeguimiento.length,
                convertidas: partes.filter(function (p) { return p.convertida; }).length,
                valorConvertido: partes.reduce(function (a, p) { return a + Util.numero(p.valorConvertido, 0); }, 0)
            };
        };

        /* Limpieza total de la sesión de prueba (no toca ninguna base externa). */
        motor.borrarTodo = function () {
            db().prospectos = [];
            db().clientes = [];
            db().campanias = [];
            db().participaciones = [];
            db().tareas = [];
            db().historial = [];
            almacen.guardar('todo-borrado');
            return { ok: true };
        };

        return motor;
    }

    raiz.crearMotor = crearMotor;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { crearMotor: crearMotor, ESTADOS_CERRADOS: ESTADOS_CERRADOS, ESTADOS_VALIDOS: ESTADOS_VALIDOS, ETIQUETAS_METAS: ETIQUETAS_METAS };
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);

        })(typeof globalThis !== 'undefined' ? globalThis : this);
