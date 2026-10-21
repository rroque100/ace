// Precarga inteligente de la Fase 1 a partir de la Necesidad derivada.
//
// Cuando una Necesidad (Modulo 1) se deriva a un Expediente, ya trae capturados
// datos que la Fase 1 vuelve a pedir (CMN, objeto, descripcion, finalidad, no
// objecion). Esta funcion pura construye la precarga de los hitos A1
// (Programacion) y A3 (Requerimiento) para no re-preguntar lo ya conocido.
//
// Se persiste en procurement_processes.hitos al momento de derivar. Los hitos
// precargados quedan "en_curso" (datos para revisar, no dados por hechos).

import type { HitosMap, HitoStatus } from "./procurement-fases";
import type { Necesidad } from "./necesidades";
import { cuiDeCadenaFuncional } from "./pedido-compra-import";
import { componerRequisitos, parseRequisitos, repartirRequisitos, requisitosNormaDeNecesidad } from "./requisitos-calificacion";
import { fuenteFinanciamientoDeTexto, procedimientoGenerico, sistemaEntregaDeTexto } from "./estrategia-formato";

// Columnas de `necesidades` que consume la precarga.
//
// El tipo se DERIVA de esta lista a propósito. Antes eran dos listas separadas
// (el tipo aquí, el SELECT en cada endpoint) y el tipo es solo una aserción
// sobre la respuesta de PostgREST: añadir un campo al tipo sin añadirlo al
// SELECT no da error de compilación, llega `undefined` en silencio y el hito se
// siembra a medias. Con una sola fuente, eso no puede pasar.
export const COLUMNAS_SEED_NECESIDAD = [
  "version_cmn",
  "cmn_verificado",
  // Programación del CMN/PAC → A1 (Art. 42). Se capturan en la ficha y su dueño
  // es el paso A1: sin esto se quedaban muertos en la necesidad.
  "periodo_programacion",
  "trimestre",
  "mes_programado",
  "poi_actividad",
  "tipo_objeto",
  // Tipo de proceso que anticipó el área usuaria (Arts. 93/94/95) → A4 a): el
  // procedimiento competitivo que le corresponde, según objeto + proceso.
  "tipo_proceso_seleccion",
  "descripcion_detallada",
  "finalidad_publica",
  "fecha_remision_dec",
  "no_objecion",
  "no_objecion_sustento",
  "verificacion_ficha_tecnica",
  // Art. 14.2.e: la DEC verifica si la necesidad se cubre con existencias de
  // almacén o bienes patrimoniales → A3 (verificación de la DEC).
  "verificacion_almacen",
  "requisitos_calificacion",
  // Detalle de los requisitos de calificación (Art. 72.3.b). Son columnas
  // propias, NO parte de `requisitos_calificacion`: sin esto, el detalle que
  // redactó el área usuaria (experiencia del personal clave, formación,
  // capacitación, equipamiento e infraestructura estratégicos) se quedaba en la
  // ficha y no llegaba a la propuesta del expediente.
  "personal_clave_experiencia",
  "personal_clave_acreditacion",
  "formacion_academica",
  "formacion_academica_acreditacion",
  "capacitacion_personal_clave",
  "capacitacion_personal_clave_acreditacion",
  "equipamiento_estrategico",
  "equipamiento_estrategico_acreditacion",
  "infraestructura_estrategica",
  "infraestructura_estrategica_acreditacion",
  "sistema_entrega",
  // Consumo histórico (m), estandarización (r) y forma de pago (h) del requerimiento:
  // el área usuaria ya los redactó y no viajaban a la estrategia (se quedaban en la
  // ficha o solo iban al Word de la necesidad).
  "frecuencia",
  "ficha_tecnica_identificacion",
  "forma_pago",
  "forma_pago_tipo",
  "forma_pago_detalle",
  "proyecto_inversion",
  "ioarr",
  "cui",
  "cadena_funcional",
  "monto_estimado",
  "meta_presupuestal",
  "fuente_financiamiento",
  "anio_fiscal",
  "modalidad_pago",
  "alcance",
  "condiciones_ejecucion",
  "formula_reajuste",
  "plazo_ejecucion",
  // El cómputo (calendario/hábiles) del Art. 105.3 acompaña al plazo: sin él, un
  // plazo en días hábiles llegaba a A3 interpretado como calendario.
  "plazo_ejecucion_unidad",
  // Resto del contenido del requerimiento (Art. 44.2) → A3, y garantías → A4 l).
  // Estaban capturados en la ficha y NO viajaban: el requerimiento del Art. 44
  // llegaba al expediente sin sus condiciones de contratación, y la fase de
  // ejecución (C1/C6) heredaba de una estrategia que nunca las recibió.
  "cantidad",
  "unidad_medida",
  "departamento",
  "provincia",
  "distrito",
  "lugar_entrega",
  "recepcion_conformidad",
  "penalidad_mora",
  // Prestaciones accesorias (Art. 44.4) y normas técnicas (Art. 44.5): son
  // contenido del requerimiento y A3 tiene un campo idéntico para cada uno, pero
  // no se sembraban —se quedaban muertos en la ficha—.
  "prestaciones_accesorias",
  "normas_tecnicas",
  // Penalidades distintas de la mora y solución de controversias: condiciones
  // del requerimiento (todo objeto) con campo propio en A3.
  "otras_penalidades",
  "solucion_controversias",
  "subcontratacion",
  "garantias",
  "adelanto_directo",
  "equipamiento_minimo",
  "habilitaciones",
  "metas_fisicas",
  "disponibilidad_terreno",
  "seguros",
  "metodologia_bim",
  "gestion_calidad",
  "gestion_riesgos",
  "anexos_tecnicos",
] as const satisfies ReadonlyArray<keyof Necesidad>;

/** Lista lista para el `select=` de PostgREST. */
export const COLUMNAS_SEED = COLUMNAS_SEED_NECESIDAD.join(",");

/**
 * Embed PostgREST de los ÍTEMS del requerimiento (`necesidad_items`, tabla
 * aparte). Basta el N° de paquete para derivar el modo de agrupación de A4 q):
 * si algún ítem lleva paquete → paquete; si hay varios sin paquete → ítems.
 */
export const EMBED_ITEMS = "items:necesidad_items(nro_paquete)";

/** Ítem del requerimiento que la precarga necesita (solo para agrupación q). */
export type ItemSeed = { nro_paquete?: string | null };

// Subconjunto de la Necesidad que la precarga consume.
export type NecesidadSeedInput = Pick<Necesidad, (typeof COLUMNAS_SEED_NECESIDAD)[number]> & {
  /** Ítems del requerimiento (tabla aparte, llega por `EMBED_ITEMS`). */
  items?: ItemSeed[] | null;
};

// Normaliza el texto libre de modalidad de pago de la Necesidad a uno de los
// valores válidos del select var_h de la Estrategia (A4). undefined si no mapea.
export function normalizarModalidadPago(value: string): string | undefined {
  const v = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!v) return undefined;
  if (v.includes("suma alzada")) return "suma_alzada";
  if (v.includes("precio")) return "precios_unitarios";
  if (v.includes("esquema mixto")) return "esquema_mixto";
  if (v.includes("costo reembolsable") || v.includes("reembolsable")) return "costo_reembolsable";
  if (v.includes("disponibilidad")) return "pago_disponibilidad";
  if (v.includes("activacion")) return "pago_activacion";
  if (v.includes("pago mixto")) return "pago_mixto";
  if (v.includes("tarifa")) return "tarifas";
  if (v.includes("porcentaje")) return "porcentajes";
  if (v.includes("honorario")) return "honorario_fijo_comision";
  if (v.includes("consumo")) return "pago_consumo";
  if (v.includes("mixto")) return "esquema_mixto";
  return undefined;
}

// tipo_objeto de la Necesidad → objeto_contractual del formulario A3.
export const OBJETO_MAP: Record<Necesidad["tipo_objeto"], string> = {
  bienes: "bien",
  servicios: "servicio",
  obras: "obra",
  consultoria_obra: "consultoria_obra",
};

// Estado de no objecion de la Necesidad → opcion del select de A3.
// "solicitada" no tiene equivalente resuelto: se deja para que el usuario cierre.
const NO_OBJECION_MAP: Partial<Record<Necesidad["no_objecion"], string>> = {
  no_aplica: "no_aplica",
  otorgada: "otorgada",
  objetada: "objetado",
};

/**
 * Detalle del Art. 72.3.b compuesto como el CONTENIDO del tipo "Capacidad técnica
 * y profesional" (uno de los 5 del 72.3), con las claves del desglose del modelo
 * (C.1 personal clave, C.2.1 formación, C.2.2 capacitación, C.3 equipamiento e
 * infraestructura). Así el editor de A3 b) lo muestra DENTRO de la Capacidad
 * técnica —estructurado— y no como líneas sueltas en "datos heredados". Devuelve
 * null si no hay ningún dato del 72.3.b.
 */
function capacidadTecnicaDe(n: NecesidadSeedInput): { detalle: string; acreditacion: string } | null {
  const detalles: string[] = [];
  const acreditaciones: string[] = [];
  const bloque = (label: string, requisito?: string | null, acreditacion?: string | null) => {
    const req = (requisito ?? "").trim();
    if (!req) return;
    detalles.push(`${label}:\n${req}`);
    const acr = (acreditacion ?? "").trim();
    if (acr) acreditaciones.push(`${label}:\n${acr}`);
  };
  bloque("C.1 Experiencia del personal clave", n.personal_clave_experiencia, n.personal_clave_acreditacion);
  bloque("C.2.1 Formación académica", n.formacion_academica, n.formacion_academica_acreditacion);
  bloque("C.2.2 Capacitación del personal clave", n.capacitacion_personal_clave, n.capacitacion_personal_clave_acreditacion);
  bloque("C.3 Equipamiento estratégico", n.equipamiento_estrategico, n.equipamiento_estrategico_acreditacion);
  bloque("C.3 Infraestructura estratégica", n.infraestructura_estrategica, n.infraestructura_estrategica_acreditacion);
  if (detalles.length === 0) return null;
  return { detalle: detalles.join("\n\n"), acreditacion: acreditaciones.join("\n\n") };
}

/**
 * Propuesta de requisitos de calificación (A3) COMPLETA: la propuesta base del
 * área usuaria (`requisitos_calificacion`) más el detalle del 72.3.b. Es lo que
 * la DEC revisa en A3; el detalle no debe perderse en el camino al expediente.
 * La variable f) de A4 sigue derivándose del `requisitos_calificacion` CRUDO
 * (solo los tipos marcados con su cita), no de esta composición.
 */
export function propuestaRequisitosCompleta(n: NecesidadSeedInput): string {
  const reparto = repartirRequisitos(parseRequisitos(n.requisitos_calificacion));
  const ct = capacidadTecnicaDe(n);
  // El detalle del 72.3.b entra como el tipo "Capacidad técnica y profesional"
  // (estructurado), no como texto suelto que caería en "datos heredados". Si la
  // propuesta base del área usuaria ya trae capacidad técnica, se FUSIONA (no se
  // pierde ninguna de las dos fuentes).
  if (ct) {
    const previo = reparto.porTipo.get("capacidad_tecnica");
    reparto.porTipo.set("capacidad_tecnica", {
      estado: previo?.estado === "facultativo" ? "facultativo" : "obligatorio",
      detalle: [previo?.detalle, ct.detalle].filter(Boolean).join("\n\n"),
      acreditacion: [previo?.acreditacion, ct.acreditacion].filter(Boolean).join("\n\n"),
      sustento: previo?.sustento ?? "",
    });
  }
  return componerRequisitos(reparto);
}

// Construye la precarga (hitos A1 y A3) desde la Necesidad. Solo incluye campos
// con valor real, para no sobrescribir con vacios lo que el usuario deba llenar.
export function seedHitosFromNecesidad(n: NecesidadSeedInput): HitosMap {
  const a1: Record<string, unknown> = {};
  if (typeof n.cmn_verificado === "boolean") a1.en_cmn = n.cmn_verificado;
  if (n.version_cmn) a1.version_cmn = n.version_cmn;
  // Programación del CMN/PAC (Art. 42). El trimestre viaja como texto porque su
  // campo en A1 es un select ("1".."4"); el mes es numérico.
  if (n.periodo_programacion) a1.periodo_programacion = n.periodo_programacion;
  if (typeof n.trimestre === "number") a1.trimestre = String(n.trimestre);
  if (typeof n.mes_programado === "number") a1.mes_programado = n.mes_programado;
  if (n.poi_actividad) a1.poi_actividad = n.poi_actividad;
  // Valor estimado (S/) del campo de A1 en las no programadas: parte de la
  // estimación de la necesidad (Art. 47.1, «estimación de partida»). Mismo dato
  // que alimenta el monto de A7 más abajo; se muestra en A1 solo en la rama no
  // programada, donde no hay monto del PAC del que partir.
  if (typeof n.monto_estimado === "number") a1.valor_estimado = n.monto_estimado;

  // A3 · Requerimiento. La Necesidad ES el requerimiento del área usuaria, así
  // que sus datos son la PROPUESTA del Art. 44.2, no la decisión de la DEC.
  const a3: Record<string, unknown> = {};
  const objeto = OBJETO_MAP[n.tipo_objeto];
  if (objeto) a3.objeto_contractual = objeto;
  // A3 · "a) Alcance de la contratación y condiciones de ejecución".
  //
  // El 44.2.a agrupa las dos cosas en un mismo contenido, así que se componen
  // en el orden del artículo: primero el alcance, luego el detalle técnico
  // (126.1: especificaciones técnicas o términos de referencia) y al final las
  // condiciones de ejecución.
  //
  // `alcance` no se sembraba: la ficha lo pedía como obligatorio y se quedaba
  // muerto en la base, obligando a reescribir el campo a mano en el expediente.
  const alcanceYCondiciones = [
    n.alcance,
    n.descripcion_detallada,
    n.condiciones_ejecucion ? `Condiciones de ejecución: ${n.condiciones_ejecucion}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (alcanceYCondiciones) a3.descripcion = alcanceYCondiciones;
  if (n.finalidad_publica) a3.finalidad_publica = n.finalidad_publica;
  // `verificado_cmn` se retiró de A3: duplicaba `en_cmn` de A1, que es donde
  // vive la verificación del CMN (Art. 42) y lo que comprueba el Art. 54.3.
  if (n.fecha_remision_dec) a3.fecha_recepcion_dec = n.fecha_remision_dec;
  const noObjecion = NO_OBJECION_MAP[n.no_objecion];
  if (noObjecion) a3.no_objecion = noObjecion;
  if (n.no_objecion_sustento) a3.sustento_objecion = n.no_objecion_sustento;
  // Verificación de ficha técnica / homologación / catálogo de acuerdo marco de
  // la ficha (Art. 44.9) → `estandarizado` (select Sí/NO obligatorio de A3).
  // Se siembran AMBOS sentidos: `true` → "si"; `false` explícito → "no" (la
  // mayoría de contrataciones NO están estandarizadas, así que es el default
  // correcto y evita que el obligatorio quede en null). Solo se deja sin sembrar
  // si el dato no consta (undefined/null), para no inventar una respuesta.
  if (n.verificacion_ficha_tecnica === true) a3.estandarizado = "si";
  else if (n.verificacion_ficha_tecnica === false) a3.estandarizado = "no";
  // Art. 14.2.e: la verificación de existencias/patrimonio hecha en la ficha.
  if (n.verificacion_almacen) a3.verificacion_almacen = true;

  const modalidad = n.modalidad_pago ? normalizarModalidadPago(n.modalidad_pago) : undefined;

  // Condiciones de contratación del 44.2 (b, c, e): son propuestas y se
  // conservan en A3 aunque la DEC decida otra cosa en la estrategia.
  // La propuesta de A3 lleva el requisitos_calificacion base MÁS el detalle del
  // 72.3.b (experiencia del personal clave, formación, capacitación, etc.).
  const propuestaCompleta = propuestaRequisitosCompleta(n);
  if (propuestaCompleta) a3.propuesta_requisitos_calificacion = propuestaCompleta;
  if (modalidad) a3.propuesta_modalidad_pago = modalidad;
  if (n.sistema_entrega) a3.propuesta_sistema_entrega = n.sistema_entrega;
  if (n.formula_reajuste) a3.formula_reajuste = n.formula_reajuste;
  // Insumo del Art. 126.2 (plazo mínimo de un año en provisión continua). El
  // cómputo (calendario/hábiles, Art. 105.3) viaja con él para no darlo por
  // «calendario» cuando la ficha dijo otra cosa.
  if (typeof n.plazo_ejecucion === "number") a3.plazo_dias = n.plazo_ejecucion;
  if (n.plazo_ejecucion_unidad) a3.plazo_unidad = n.plazo_ejecucion_unidad;

  // Resto de contenidos del Art. 44.2. Se componen igual que el alcance: varias
  // columnas de la ficha en el campo del formato que las agrupa, en un orden
  // fijo y con su rótulo, para que se lea como un requerimiento y no como un
  // volcado de base de datos.
  const cantidadUnidad = [
    typeof n.cantidad === "number" ? String(n.cantidad) : "",
    n.unidad_medida ?? "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (cantidadUnidad) a3.cantidad_unidad = cantidadUnidad;

  // Lugar de entrega: la ficha lo tiene partido en cuatro columnas y el formato
  // lo pide como un texto. Se compone "Dpto - Prov - Distrito (lugar concreto)",
  // el mismo formato que ya usa la Ficha de Necesidad en Word.
  const ubicacion = [n.departamento, n.provincia, n.distrito].filter(Boolean).join(" - ");
  const lugar = [ubicacion, n.lugar_entrega ? `(${n.lugar_entrega})` : ""].filter(Boolean).join(" ");
  if (lugar.trim()) a3.lugar_entrega = lugar.trim();

  if (n.recepcion_conformidad) a3.recepcion_conformidad = n.recepcion_conformidad;
  if (n.penalidad_mora) a3.penalidad_mora = n.penalidad_mora;
  if (n.subcontratacion) a3.subcontratacion = n.subcontratacion;
  // Destino directo: A3 tiene un campo con el mismo nombre para cada uno.
  if (n.prestaciones_accesorias) a3.prestaciones_accesorias = n.prestaciones_accesorias;
  if (n.normas_tecnicas) a3.normas_tecnicas = n.normas_tecnicas;
  if (n.otras_penalidades) a3.otras_penalidades = n.otras_penalidades;
  if (n.solucion_controversias) a3.solucion_controversias = n.solucion_controversias;

  // 44.2.d agrupa los recursos que necesita el contratista: equipamiento y
  // habilitaciones/permisos van al MISMO campo del formato.
  const recursos = [
    n.equipamiento_minimo ? `Equipamiento mínimo: ${n.equipamiento_minimo}` : "",
    n.habilitaciones ? `Habilitaciones y permisos: ${n.habilitaciones}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (recursos) a3.recursos_contratista = recursos;

  // Condiciones específicas de obra / consultoría de obra, en el orden del
  // formato de la ficha.
  const obra = [
    n.metas_fisicas ? `Metas físicas / objetivos funcionales: ${n.metas_fisicas}` : "",
    n.disponibilidad_terreno ? `Disponibilidad física del terreno: ${n.disponibilidad_terreno}` : "",
    n.seguros ? `Seguros: ${n.seguros}` : "",
    n.metodologia_bim ? `Metodologías colaborativas (BIM): ${n.metodologia_bim}` : "",
    n.gestion_calidad ? `Gestión de la calidad: ${n.gestion_calidad}` : "",
    n.anexos_tecnicos ? `Anexos técnicos: ${n.anexos_tecnicos}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (obra) a3.condiciones_obra = obra;

  // Riesgos y su asignación a las partes (Art. 44.3). La matriz que el área usuaria
  // redactó en `gestion_riesgos` NO es obra-específica: el 44.3 aplica a TODO objeto.
  // Por eso va al campo DEDICADO `riesgos_asignacion` —visible para bienes, servicios
  // y obras—, no a `condiciones_obra` (que solo se muestra en obra). Antes iba a
  // condiciones_obra y en un bien/servicio quedaba invisible en A3 aunque la ficha la
  // tuviera; ahora llega al sitio donde la DEC la ve y la usa como insumo de A4 s).
  if (n.gestion_riesgos) a3.riesgos_asignacion = n.gestion_riesgos;

  // A4 · Estrategia de contratación.
  //
  // f) Requisitos de calificación: se trae TAL CUAL la propuesta del área
  // usuaria (b) del requerimiento, Art. 44.2). Es el punto de partida que la
  // DEC revisa y del que puede excluir facultativos (Art. 44.8), no una
  // decisión dada por hecha: el hito queda "en_curso" y mergeSeedIntoHitos solo
  // rellena si f) está vacío, así que nunca pisa lo que la DEC ya editó.
  //
  // La modalidad de pago (h) y el sistema de entrega (i) se precargan en A4 con la
  // propuesta del área usuaria (Art. 44.2). `mergeSeedIntoHitos` solo rellena si
  // el campo está VACÍO, así que la DEC sigue decidiendo (Art. 72.1) y nunca se
  // pisa lo que ya editó; se le ahorra el paso manual de "Usar esta propuesta".
  const a4: Record<string, unknown> = {};
  // a) Tipo de procedimiento (Art. 46.1.a). Sale del "Tipo de proceso de
  // selección" de la ficha (Arts. 93/94/95): a) muestra ese proceso ESPECÍFICO
  // (var_a_proceso, solo lectura) y de él se DERIVA el genérico del Art. 54
  // (var_a_procedimiento) que consumen el cronograma y los plazos. Un no
  // competitivo (o sin proceso definido) no se siembra: eso va a la variable b).
  const proceso = (n.tipo_proceso_seleccion ?? "").trim();
  const generico = procedimientoGenerico(proceso);
  if (generico) {
    a4.var_a_proceso = proceso;
    a4.var_a_procedimiento = generico;
  }
  // f) NO copia el texto libre del requerimiento: trae SOLO los tipos del 72.3
  // que el área usuaria marcó, cada uno con su cita legal exacta. La propuesta
  // en crudo queda en A3 (propuesta_requisitos_calificacion, más abajo).
  const fNorma = requisitosNormaDeNecesidad(n.requisitos_calificacion, n.tipo_objeto);
  if (fNorma) a4.var_f_requisitos_calificacion = fNorma;
  // h) Modalidad de pago: mismo valor normalizado que la propuesta de A3 (valor
  // válido del select var_h). i) Sistema de entrega: se normaliza el texto de la
  // ficha al valor del select var_i; si no mapea a una opción, no se siembra.
  if (modalidad) a4.var_h_modalidad_pago = modalidad;
  if (n.sistema_entrega) {
    const sistema = sistemaEntregaDeTexto(n.sistema_entrega);
    if (sistema) a4.var_i_sistema_entrega = sistema;
  }
  const viabilidad = n.proyecto_inversion
    ? `Proyecto de inversión: ${n.proyecto_inversion}`
    : n.ioarr
      ? `IOARR: ${n.ioarr}`
      : "";
  // La viabilidad SÍ se precarga: es un hecho del proyecto de inversión, no una
  // decisión de la DEC.
  if (viabilidad) a4.var_c_viabilidad = viabilidad;

  // l) Garantías y adelantos (Art. 46.1.l). El texto es la PROPUESTA del área
  // usuaria, de partida. De las tres casillas se siembran las que SIGUEN un hecho
  // de la ficha: si el área usuaria propuso prestaciones accesorias corresponde su
  // garantía, y si propuso un adelanto directo corresponde la de adelantos. La de
  // FIEL CUMPLIMIENTO se deja a la DEC: es una determinación legal (Art. 138), no
  // un dato del requerimiento. Todo fill-if-empty (mergeSeedIntoHitos), así que la
  // DEC lo revisa, nunca se pisa lo editado, y C1 hereda de la decisión final.
  const garantiasAdelantos = [
    n.garantias ? `Garantías (propuesta del área usuaria): ${n.garantias}` : "",
    n.adelanto_directo ? `Adelanto directo (propuesta del área usuaria): ${n.adelanto_directo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (garantiasAdelantos) a4.var_l_garantias_adelantos = garantiasAdelantos;
  if (n.prestaciones_accesorias) a4.si_garantia_accesorias = "si";
  if (n.adelanto_directo) a4.si_garantia_adelantos = "si";

  // k) Fuente de financiamiento (Art. 46.1.k). La ficha ya la trae (`fuente_financiamiento`);
  // el select de A4 solo la mostraba al EXPORTAR (fuenteFinanciamientoDeTexto en el
  // volcado), así que en el formulario salía vacío pese a que la ayuda promete
  // "Se precarga desde la ficha". Se siembra el valor normalizado a la opción del
  // select cuando el texto libre se reconoce; si no, se deja a la DEC. También va a A7
  // (más abajo) como dato presupuestal. Fill-if-empty.
  const fuente = fuenteFinanciamientoDeTexto(n.fuente_financiamiento);
  if (fuente) a4.fuente_financiamiento = fuente;

  // h) Forma de pago (Art. 67). El área usuaria detalla en el requerimiento CÓMO se
  // paga (único/parcial, por avance, condiciones). Eso es el insumo del SUSTENTO de la
  // modalidad de pago (h), que sin esto arrancaba vacío hasta cambiar el select. Se
  // guarda como texto propio: `sustentoAlElegirModalidadPago` NO lo pisa con la norma.
  const formaPago = [
    n.forma_pago_tipo ? `Forma de pago: ${n.forma_pago_tipo}` : n.forma_pago ? `Forma de pago: ${n.forma_pago}` : "",
    n.forma_pago_detalle ?? "",
  ]
    .filter(Boolean)
    .join(". ");
  if (formaPago) a4.var_h_sustento_pago = formaPago;

  // m) Consumo histórico (Art. 46.1.m). La frecuencia que declaró el área usuaria es el
  // insumo natural de la recurrencia; m) era 100% manual. Se siembra el texto y la DEC
  // responde el SÍ/NO (no se presume: una frecuencia "única vez" no es recurrencia).
  if (n.frecuencia) a4.var_m_consumo_historico = `Frecuencia declarada en el requerimiento: ${n.frecuencia}.`;

  // r) Estandarización (Art. 46.1.r). Si la ficha identifica una ficha técnica u
  // homologación, ese texto va a r): además de documentar, el export marca las casillas
  // de estandarización buscando "ficha técnica"/"homologación" en este mismo campo.
  if (n.ficha_tecnica_identificacion) {
    a4.var_r_estandarizado = `Ficha técnica u homologación identificada: ${n.ficha_tecnica_identificacion}.`;
  }

  // c) El CUI (Art. 46.1.c). Viene de `act_proy` del pedido SIGA: es el NÚMERO
  // del proyecto (2661009), no su nombre. Antes A4 lo sacaba del texto de
  // `var_c_viabilidad` y escribía el nombre de la tarea donde el formato pide
  // el número.
  // Y si la ficha es anterior al mapeo de `act_proy`, se rescata de la cadena
  // funcional del SIGA, que lo lleva en su 4.º segmento.
  const cui = n.cui || cuiDeCadenaFuncional(n.cadena_funcional);
  if (cui) a4.cui = cui;

  // Si hay CUI o IOARR, la contratación ES una inversión: no es una opinión de
  // la DEC, es un hecho de la ficha. El formato condiciona el CUI a esta
  // casilla ("Si seleccionó SÍ, debe registrar lo siguiente"), así que sin
  // sembrarla el campo del CUI ni siquiera se mostraría.
  if (cui || n.proyecto_inversion || n.ioarr) a4.si_es_inversion = "si";

  // s) Objetivo del proceso (Art. 46.1.s): "incluye la gestión de riesgos". El área
  // usuaria ya identificó los riesgos en el requerimiento (Art. 44.3: `gestion_riesgos`,
  // el campo de prosa que la IA redacta como matriz). NO se vuelca directo a s): s)
  // arranca en "NO CORRESPONDE" y la matriz se OFRECE con un botón. Se guarda su texto
  // en `riesgos_necesidad` para que el botón de A4 pueda traerla cuando la DEC lo decida.
  if (n.gestion_riesgos) a4.riesgos_necesidad = `Gestión de riesgos (del requerimiento): ${n.gestion_riesgos}`;

  // Obras (Art. 154.1): dos de las nueve propuestas ya viven en la ficha. b) BIM
  // ← `metodologia_bim`; e) terreno ← `disponibilidad_terreno`. Las otras siete
  // (a, c, d, f, g, h, i) no tienen columna en la necesidad y las decide la DEC.
  if (n.metodologia_bim) a4.obra_b_bim = n.metodologia_bim;
  if (n.disponibilidad_terreno) a4.obra_e_terreno = n.disponibilidad_terreno;

  // q) Tipo de agrupación (Art. 46.1.q). Los ítems del requerimiento ya dicen si
  // el área usuaria armó paquetes (Art. 52/44.10). Se siembra el modo como
  // DEFECTO editable: con al menos un paquete → "paquete"; con dos o más ítems sin
  // paquete → "items". Un ítem suelto no se agrupa. La DEC decide el definitivo.
  const items = n.items ?? [];
  const hayPaquete = items.some((it) => String(it?.nro_paquete ?? "").trim() !== "");
  if (hayPaquete) a4.agrupacion_tipo = "paquete";
  else if (items.length >= 2) a4.agrupacion_tipo = "items";

  // Las condiciones de ejecución NO son una variable de la estrategia: el
  // Art. 44.2.a las pone en el requerimiento, así que van a A3 (antes se
  // volcaban en var_t "Otras variables", que es un cajón de sastre).

  // A7 · Certificación de crédito presupuestario (datos presupuestales del requerimiento).
  const a7: Record<string, unknown> = {};
  if (typeof n.monto_estimado === "number") a7.monto = n.monto_estimado;
  if (n.meta_presupuestal) a7.meta_presupuestal = n.meta_presupuestal;
  if (n.fuente_financiamiento) a7.fuente_financiamiento = n.fuente_financiamiento;
  if (typeof n.anio_fiscal === "number") a7.vigencia = n.anio_fiscal;
  if (Object.keys(a7).length > 0) a7.tipo = "ccp";

  const seed: HitosMap = {};
  if (Object.keys(a1).length > 0) seed.A1 = { status: "en_curso", data: a1 };
  if (Object.keys(a3).length > 0) seed.A3 = { status: "en_curso", data: a3 };
  if (Object.keys(a4).length > 0) seed.A4 = { status: "en_curso", data: a4 };
  if (Object.keys(a7).length > 0) seed.A7 = { status: "en_curso", data: a7 };
  return seed;
}

/**
 * Refresca los campos "espejo" de los requisitos de calificación cuando la
 * necesidad cambió DESPUÉS de una precarga previa.
 *
 * `mergeSeedIntoHitos` solo rellena huecos: nunca actualiza un campo que ya
 * tiene valor. Pero la propuesta del requerimiento (A3) y su copia tal cual en
 * la estrategia (A4 f)) están pensadas para reflejar la sección b) VIGENTE del
 * requerimiento. Si el área usuaria amplía esa sección, "Traer datos" debe
 * ponerlas al día; con solo-rellenar-huecos, se quedaban con la versión vieja.
 *
 * Regla de seguridad: A4 f) se refresca SOLO si sigue siendo un espejo intacto
 * —vacío, o idéntico a lo último traído (que quedó en A3 propuesta)—. Si la DEC
 * ya lo editó (difiere de la propuesta), no se toca: ese cambio es su decisión,
 * y su divergencia con el requerimiento la gobierna el Art. 44.7. La propuesta
 * de A3 sí se pone siempre al día: es el reflejo del requerimiento, no una
 * decisión de la DEC.
 */
export function refrescarRequisitosEspejo(
  hitos: HitosMap,
  n: NecesidadSeedInput,
): { hitos: HitosMap; refrescado: boolean } {
  const rawReq = (n.requisitos_calificacion ?? "").trim();
  const objeto = n.tipo_objeto;
  // A3 lleva la propuesta COMPLETA (requisitos base + detalle del 72.3.b); A4 f)
  // deriva de rawReq (solo los tipos marcados con su cita).
  const propuestaNueva = propuestaRequisitosCompleta(n);
  if (!propuestaNueva) return { hitos, refrescado: false };

  const a3data = { ...((hitos.A3?.data ?? {}) as Record<string, unknown>) };
  const a4data = { ...((hitos.A4?.data ?? {}) as Record<string, unknown>) };
  const propuestaAnterior =
    typeof a3data.propuesta_requisitos_calificacion === "string"
      ? a3data.propuesta_requisitos_calificacion
      : "";
  const fActual =
    typeof a4data.var_f_requisitos_calificacion === "string"
      ? a4data.var_f_requisitos_calificacion
      : "";

  let refrescado = false;

  // A3 propuesta: reflejo del requerimiento vigente (con su detalle). Siempre al día.
  if (propuestaAnterior !== propuestaNueva) {
    a3data.propuesta_requisitos_calificacion = propuestaNueva;
    refrescado = true;
  }
  // A4 f): las CITAS legales de los tipos marcados (no el texto crudo). Solo se
  // refresca si sigue siendo un espejo intacto: vacío, o igual a las citas de lo
  // último traído. Si la DEC lo editó (difiere), no se toca.
  //
  // Las citas se derivan del requisitos_calificacion CRUDO: requisitosNorma…
  // descarta lo que no sea un tipo del 72.3, así que el detalle añadido a la
  // propuesta no las contamina aunque `propuestaAnterior` lo incluya.
  const fCitasNuevas = requisitosNormaDeNecesidad(rawReq, objeto);
  const fCitasAnteriores = requisitosNormaDeNecesidad(propuestaAnterior, objeto);
  // Espejo intacto = vacío, o igual a las citas de lo último traído, o igual al
  // CRUDO de lo último traído (expedientes que hicieron un pull con el modelo
  // anterior, que copiaba el texto tal cual: también son un espejo pristino y se
  // migran a citas al volver a traer).
  const fEsEspejo =
    fActual.trim() === "" ||
    fActual === fCitasAnteriores ||
    fActual === propuestaAnterior ||
    fActual === rawReq;
  if (fEsEspejo && fActual !== fCitasNuevas) {
    a4data.var_f_requisitos_calificacion = fCitasNuevas;
    refrescado = true;
  }

  if (!refrescado) return { hitos, refrescado: false };

  const nowIso = new Date().toISOString();
  const next: HitosMap = { ...hitos };
  next.A3 = { ...hitos.A3, status: hitos.A3?.status ?? "en_curso", data: a3data, updatedAt: nowIso };
  next.A4 = { ...hitos.A4, status: hitos.A4?.status ?? "en_curso", data: a4data, updatedAt: nowIso };
  return { hitos: next, refrescado: true };
}

/**
 * Refresca A4 a) (tipo de procedimiento) cuando "Traer datos" trae una necesidad
 * cuya clasificación cambió: a) se ACTUALIZA con el competitivo que corresponde a
 * `tipo_objeto` + `tipo_proceso_seleccion` (Datos principales de la ficha).
 *
 * `mergeSeedIntoHitos` solo rellena huecos; aquí sí se actualiza un valor ya
 * puesto, pero con la misma regla de seguridad que f): SOLO si a) sigue siendo un
 * espejo del dato de la ficha —vacío, sin origen registrado (valor de una
 * precarga vieja), o igual al último auto-derivado—. Si la DEC eligió a propósito
 * otro procedimiento (Art. 46.1.a), a) difiere del origen y no se toca. El último
 * auto-derivado se recuerda en `var_a_procedimiento_origen` (oculto: no está en el
 * catálogo del formulario ni lo lee el Formato de Estrategia).
 */
export function refrescarProcedimientoA4(
  hitos: HitosMap,
  n: NecesidadSeedInput,
): { hitos: HitosMap; refrescado: boolean } {
  const proceso = (n.tipo_proceso_seleccion ?? "").trim();
  const generico = procedimientoGenerico(proceso);
  if (!generico) return { hitos, refrescado: false };

  const a4data = { ...((hitos.A4?.data ?? {}) as Record<string, unknown>) };
  // a) es de SOLO LECTURA (se hereda de la ficha, no la elige la DEC), así que no
  // hay decisión que respetar: siempre se sincroniza con la clasificación vigente.
  if (a4data.var_a_proceso === proceso && a4data.var_a_procedimiento === generico) {
    return { hitos, refrescado: false };
  }
  a4data.var_a_proceso = proceso;
  a4data.var_a_procedimiento = generico;
  // Marcador del modelo anterior (a) era editable): ya no aplica.
  delete a4data.var_a_procedimiento_origen;

  const next: HitosMap = { ...hitos };
  next.A4 = {
    ...hitos.A4,
    status: hitos.A4?.status && hitos.A4.status !== "pendiente" ? hitos.A4.status : "en_curso",
    data: a4data,
    updatedAt: new Date().toISOString(),
  };
  return { hitos: next, refrescado: true };
}

/**
 * Refresca las propuestas de A3 que REFLEJAN el requerimiento (no son decisión de
 * la DEC): c.2) Sistema de entrega y c.1) Modalidad de pago. `mergeSeedIntoHitos`
 * solo rellena huecos, pero estas dos son un espejo de la ficha —igual que la
 * propuesta de requisitos—, así que "Traer datos" las pone SIEMPRE al día con la
 * "Propuesta de sistema de entrega" / "Propuesta de modalidad de pago" de la
 * necesidad. La decisión de la DEC va en A4 (var_i / var_h), que no se toca aquí.
 */
export function refrescarPropuestasA3(
  hitos: HitosMap,
  n: NecesidadSeedInput,
): { hitos: HitosMap; refrescado: boolean } {
  const a3data = { ...((hitos.A3?.data ?? {}) as Record<string, unknown>) };
  let refrescado = false;

  const sistema = (n.sistema_entrega ?? "").trim();
  if (sistema && a3data.propuesta_sistema_entrega !== sistema) {
    a3data.propuesta_sistema_entrega = sistema;
    refrescado = true;
  }
  const modalidad = n.modalidad_pago ? normalizarModalidadPago(n.modalidad_pago) : undefined;
  if (modalidad && a3data.propuesta_modalidad_pago !== modalidad) {
    a3data.propuesta_modalidad_pago = modalidad;
    refrescado = true;
  }

  if (!refrescado) return { hitos, refrescado: false };
  const next: HitosMap = { ...hitos };
  next.A3 = {
    ...hitos.A3,
    status: hitos.A3?.status && hitos.A3.status !== "pendiente" ? hitos.A3.status : "en_curso",
    data: a3data,
    updatedAt: new Date().toISOString(),
  };
  return { hitos: next, refrescado: true };
}

// Fusiona la precarga en los hitos ya existentes de un expediente SIN sobrescribir
// lo que el usuario ya llenó: solo rellena campos vacíos/ausentes. Se usa para la
// sincronización retroactiva de expedientes derivados antes de la precarga.
export function mergeSeedIntoHitos(
  current: HitosMap,
  seed: HitosMap,
): { hitos: HitosMap; llenados: number } {
  const next: HitosMap = { ...current };
  const nowIso = new Date().toISOString();
  let llenados = 0;

  for (const [code, seedEstado] of Object.entries(seed)) {
    const existing = current[code];
    const existingData = (existing?.data ?? {}) as Record<string, unknown>;
    const mergedData: Record<string, unknown> = { ...existingData };
    let cambios = 0;

    for (const [key, value] of Object.entries(seedEstado.data ?? {})) {
      const actual = existingData[key];
      if (actual === undefined || actual === null || actual === "") {
        mergedData[key] = value;
        cambios += 1;
      }
    }

    if (cambios === 0) continue; // este paso ya estaba completo: no se toca.
    llenados += cambios;
    // No degradar el avance: si el paso ya iba más allá de "pendiente", se respeta.
    const status: HitoStatus =
      existing?.status && existing.status !== "pendiente" ? existing.status : "en_curso";
    next[code] = { ...existing, status, data: mergedData, updatedAt: nowIso };
  }

  return { hitos: next, llenados };
}
