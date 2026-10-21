// Casillas del FORMATO DE ESTRATEGIA DE CONTRATACIÓN (Art. 46.1 del Reglamento).
//
// El formato no es texto libre: casi todas sus variables se marcan con una (X)
// sobre una lista cerrada. `llenarEstrategia` no marcaba NI UNA —solo escribía
// los sustentos— así que el documento salía con todo el cuerpo en blanco.
//
// Cada celda sale de leer la plantilla real (lib/plantillas-f1/
// estrategia-contratacion.xlsx, byte a byte el archivo de la carpeta
// actuaciones-preparatorias), no de contar columnas a ojo.

/** Un valor del select de A4 → la celda que se marca en el formato. */
export type MapaCasillas = Readonly<Record<string, string>>;

// e) Tipo de evaluador y su perfil (Art. 46.1.e).
export const CELDA_TIPO_EVALUADOR: MapaCasillas = {
  oficial_compra: "F36",
  jurado: "J36",
  comite: "F37",
};

/**
 * Sustento SUGERIDO de la elección del tipo de evaluador. Va en la celda B40
 * del formato (rótulo "Sustento de la elección del tipo de evaluador:", var_e).
 *
 * Es un borrador EDITABLE que la DEC adopta con un botón en A4: no se rellena
 * solo, porque el evaluador lo decide la DEC según el procedimiento y el objeto
 * (Cuadro N° 6 y 7 de la Guía). Cada tipo lleva su propio fundamento: la
 * justificación de un gestor unipersonal (oficial de compra) no sirve para un
 * órgano colegiado (comité) ni para un jurado de expertos, así que el texto se
 * ofrece según el tipo marcado arriba.
 */
export const SUSTENTO_EVALUADOR_SUGERIDO: Readonly<Record<string, string>> = {
  oficial_compra: `Se determina la designación de un Oficial de Compra como evaluador del procedimiento, de conformidad con los artículos 56.2 y 58.1 del Reglamento de la Ley N° 32069, bajo los siguientes fundamentos:
Especialización Técnica: La naturaleza de la contratación requiere un manejo experto de la normativa de contrataciones y de las herramientas de gestión de la fase de selección. El Oficial de Compra, como servidor especializado designado por dicha dirección, garantiza la idoneidad en la preparación de bases y la conducción de la DEC.
Eficiencia Operativa: De acuerdo con el artículo 58.2, la figura del Oficial de Compra permite una gestión más ágil y directa del procedimiento en comparación con un órgano colegiado, optimizando los tiempos de evaluación sin comprometer la objetividad ni el cumplimiento de las normas.
Facultad Consultiva: En virtud del artículo 56.4, el Oficial de Compra está facultado para solicitar opiniones técnicas a las unidades pertinentes de la Entidad, lo que asegura que cualquier aspecto técnico complejo del requerimiento sea debidamente validado, manteniendo la responsabilidad de la conducción en un solo gestor especializado.`,
  comite: `Se determina la designación de un Comité como evaluador del procedimiento, de conformidad con los artículos 56.2 y 58.1 del Reglamento de la Ley N° 32069, bajo los siguientes fundamentos:
Órgano Colegiado: La relevancia y complejidad de la contratación justifican que la evaluación recaiga en un órgano colegiado de tres (3) integrantes, con al menos un comprador público, garantizando una decisión deliberada y con pluralidad de criterio en la conducción de la fase de selección.
Distribución de Responsabilidad: De acuerdo con el artículo 58.1, la actuación colegiada permite distribuir la responsabilidad de la evaluación entre sus integrantes y reforzar el control cruzado de las decisiones, lo que resulta idóneo frente a un procedimiento de mayor cuantía o riesgo.
Facultad Consultiva: En virtud del artículo 56.4, el Comité está facultado para solicitar opiniones técnicas a las unidades pertinentes de la Entidad, asegurando que los aspectos técnicos complejos del requerimiento sean debidamente validados antes de la adjudicación.`,
  jurado: `Se determina la designación de un Jurado como evaluador del procedimiento, de conformidad con los artículos 56.2 y 58.1 del Reglamento de la Ley N° 32069, bajo los siguientes fundamentos:
Especialización de Expertos: La naturaleza especializada de la contratación exige que la evaluación recaiga en un jurado integrado por expertos (tres o cinco), con la calificación y experiencia necesarias para valorar propuestas de alto contenido técnico o creativo.
Idoneidad Técnica: De acuerdo con el artículo 58.1, la conformación del jurado con especialistas garantiza que la evaluación de las propuestas se realice bajo criterios técnicos rigurosos, propios de procedimientos que requieren juicio experto (por ejemplo, concurso de proyectos o de diseño).
Facultad Consultiva: En virtud del artículo 56.4, el Jurado está facultado para solicitar opiniones técnicas a las unidades pertinentes de la Entidad, asegurando la validación de cualquier aspecto complejo del requerimiento y manteniendo la rigurosidad de la evaluación experta.`,
};

// h) Modalidad de pago (Art. 46.1.h).
export const CELDA_MODALIDAD_PAGO: MapaCasillas = {
  suma_alzada: "F62",
  pago_consumo: "J62",
  precios_unitarios: "F63",
  pago_disponibilidad: "J63",
  esquema_mixto: "F64",
  pago_activacion: "J64",
  tarifas: "F65",
  pago_mixto: "J65",
  porcentajes: "F66",
  costo_reembolsable: "J66",
  honorario_fijo_comision: "F67",
};

/**
 * Normativa de cada modalidad de pago, para consignarla en la celda B70 del
 * Formato (el sustento de h)). Contrastado VERBATIM contra el RAG del Reglamento:
 *
 *   Art. 130 · Modalidades de pago para bienes y servicios → a) suma alzada,
 *     b) precios unitarios, c) esquema mixto, d) tarifas, e) porcentajes,
 *     f) honorario fijo + comisión de éxito, g) pago por consumo.
 *   Art. 286 · Modalidad de pago en contratos de contingencia → a) disponibilidad,
 *     b) activación, c) mixto.
 *
 * `costo_reembolsable` (obras) se deja fuera: no se localizó una cita verbatim
 * que lo defina como modalidad de pago, y no se inventa un artículo.
 */
export const NORMA_MODALIDAD_PAGO: Readonly<Record<string, string>> = {
  suma_alzada:
    "La modalidad de pago se rige por la modalidad de Suma alzada de conformidad con el artículo 130.a del Reglamento.",
  precios_unitarios:
    "La modalidad de pago se rige por la modalidad de Precios unitarios de conformidad con el artículo 130.b del Reglamento.",
  esquema_mixto:
    "La modalidad de pago se rige por la modalidad de Esquema mixto de conformidad con el artículo 130.c del Reglamento.",
  tarifas:
    "La modalidad de pago se rige por la modalidad de Tarifas de conformidad con el artículo 130.d del Reglamento.",
  porcentajes:
    "La modalidad de pago se rige por el pago en base a porcentajes de conformidad con el artículo 130.e del Reglamento.",
  honorario_fijo_comision:
    "La modalidad de pago se rige por un honorario fijo y una comisión de éxito de conformidad con el artículo 130.f del Reglamento.",
  pago_consumo:
    "La modalidad de pago se rige por la modalidad de Pago por consumo de conformidad con el artículo 130.g del Reglamento.",
  pago_disponibilidad:
    "La modalidad de pago se rige por la modalidad de Pago por disponibilidad de conformidad con el artículo 286.a del Reglamento (contratos de contingencia).",
  pago_activacion:
    "La modalidad de pago se rige por la modalidad de Pago por activación de conformidad con el artículo 286.b del Reglamento (contratos de contingencia).",
  pago_mixto:
    "La modalidad de pago se rige por la modalidad de Pago mixto de conformidad con el artículo 286.c del Reglamento (contratos de contingencia).",
};

/**
 * Sustento a precargar al ELEGIR la modalidad de pago en h). Mismo criterio que
 * `sustentoAlElegirFactor`: devuelve la norma de la modalidad cuando el sustento
 * actual está VACÍO o es OTRA norma (venía de una modalidad anterior, sin editar)
 * — para que CAMBIAR de modalidad traiga la suya. Si la DEC escribió algo propio,
 * devuelve null y se respeta lo escrito.
 */
export function sustentoAlElegirModalidadPago(modalidad: string, actual: string): string | null {
  const norma = NORMA_MODALIDAD_PAGO[modalidad];
  if (!norma) return null;
  const a = actual.trim();
  const esOtraNorma = a !== "" && (Object.values(NORMA_MODALIDAD_PAGO) as string[]).includes(a);
  return !a || esOtraNorma ? norma : null;
}

// i) Sistema de entrega (Art. 46.1.i). El formato lo parte en tres bloques
// según el objeto: bienes y servicios, obras, y consultoría de obras.
export const CELDA_SISTEMA_ENTREGA: MapaCasillas = {
  llave_en_mano: "F74",
  diseno_operacion_mantenimiento: "J74",
  llave_en_mano_mantenimiento: "F75",
  gestion_instalaciones: "J75",
  suministro_comodato: "F76",
  no_aplica: "J76",
  solo_construccion: "F78",
  gestion_diseno_construccion_riesgo: "J78",
  diseno_construccion: "F79",
  gestion_diseno_construccion_agencia: "J79",
  diseno_construccion_operacion_mantenimiento: "F80",
  entrega_integrada_alianza: "J80",
  formulacion_diseno: "F81",
  solo_formulacion_o_diseno: "J81",
};

/**
 * Normativa de cada sistema de entrega, para consignarla en la celda B83 del
 * Formato (el sustento de i)). Contrastado VERBATIM contra el RAG del Reglamento:
 *
 *   Art. 129 · Sistemas de entrega para bienes y servicios → a) llave en mano,
 *     b) llave en mano con mantenimiento, c) suministro con comodato,
 *     d) diseño de la operación y mantenimiento, e) gestión de instalaciones.
 *   Art. 158.1 · Tipos de sistemas de entrega de obras → a) solo construcción,
 *     b) diseño y construcción, c) diseño, construcción, operación y
 *     mantenimiento, d) gestión del diseño y construcción al riesgo, e) …de
 *     agencia, f) entrega integrada de proyecto o alianza.
 *
 * `no_aplica` y los de consultoría de obras (formulación/diseño) quedan fuera:
 * no se localizó una cita verbatim que los defina como sistema de entrega, y no
 * se inventa un artículo.
 */
export const NORMA_SISTEMA_ENTREGA: Readonly<Record<string, string>> = {
  llave_en_mano:
    "El sistema de entrega se rige por el sistema de Llave en mano de conformidad con el artículo 129.a del Reglamento.",
  llave_en_mano_mantenimiento:
    "El sistema de entrega se rige por el sistema de Llave en mano con mantenimiento de conformidad con el artículo 129.b del Reglamento.",
  suministro_comodato:
    "El sistema de entrega se rige por el sistema de Suministro con comodato de conformidad con el artículo 129.c del Reglamento.",
  diseno_operacion_mantenimiento:
    "El sistema de entrega se rige por el sistema de Diseño de la operación y mantenimiento de conformidad con el artículo 129.d del Reglamento.",
  gestion_instalaciones:
    "El sistema de entrega se rige por el sistema de Gestión de instalaciones de conformidad con el artículo 129.e del Reglamento.",
  solo_construccion:
    "El sistema de entrega se rige por el sistema de Solo construcción de conformidad con el artículo 158.1.a del Reglamento.",
  diseno_construccion:
    "El sistema de entrega se rige por el sistema de Diseño y construcción de conformidad con el artículo 158.1.b del Reglamento.",
  diseno_construccion_operacion_mantenimiento:
    "El sistema de entrega se rige por el sistema de Diseño, construcción, operación y mantenimiento de conformidad con el artículo 158.1.c del Reglamento.",
  gestion_diseno_construccion_riesgo:
    "El sistema de entrega se rige por el sistema de Gestión del diseño y construcción al riesgo de conformidad con el artículo 158.1.d del Reglamento.",
  gestion_diseno_construccion_agencia:
    "El sistema de entrega se rige por el sistema de Gestión del diseño y construcción de agencia de conformidad con el artículo 158.1.e del Reglamento.",
  entrega_integrada_alianza:
    "El sistema de entrega se rige por el sistema de Entrega integrada de proyecto o alianza de conformidad con el artículo 158.1.f del Reglamento.",
};

/**
 * Sustento a precargar al ELEGIR el sistema de entrega en i). Mismo criterio que
 * `sustentoAlElegirModalidadPago`: trae la norma del sistema cuando el sustento
 * actual está VACÍO o es OTRA norma (venía de un sistema anterior, sin editar);
 * si la DEC escribió algo propio, devuelve null y se respeta.
 */
export function sustentoAlElegirSistemaEntrega(sistema: string, actual: string): string | null {
  const norma = NORMA_SISTEMA_ENTREGA[sistema];
  if (!norma) return null;
  const a = actual.trim();
  const esOtraNorma = a !== "" && (Object.values(NORMA_SISTEMA_ENTREGA) as string[]).includes(a);
  return !a || esOtraNorma ? norma : null;
}

// k) Fuente de financiamiento (Art. 46.1.k).
export const CELDA_FINANCIAMIENTO: MapaCasillas = {
  recursos_ordinarios: "F93",
  donaciones_transferencias: "J93",
  recursos_directamente_recaudados: "F94",
  recursos_determinados: "J94",
  operaciones_credito: "F95",
  otros: "J95",
};

// q) Evaluación de la posibilidad de agrupar prestaciones (Art. 46.1.q).
export const CELDA_AGRUPAR: MapaCasillas = {
  paquete: "F152",
  items: "J152",
  lotes: "J153",
  tramos: "J154",
};

// Sustento normativo de cada mecanismo de agrupación según la casilla marcada.
// Contrastado contra el RAG del Reglamento (009-2025-EF), Art. 52 "Agrupamiento de
// prestaciones": 52.1.a Contratación por paquete; 52.1.b Procedimiento según
// relación de ítems/lotes/tramos (cada uno de valor superior al de un contrato
// menor, procedimiento independiente dentro del principal); 52.2 obliga a la DEC a
// sustentar en la estrategia que agrupar es más eficiente que contratar por
// separado; 53.3 fija la cuantía por la sumatoria. Paráfrasis con la cita —no
// reproducción textual—: la DEC la ajusta.
const normaRelacion = (unidad: string) =>
  `El agrupamiento de prestaciones se realiza mediante el Procedimiento según relación de ${unidad}: en un único procedimiento de selección se contratan bienes, servicios, consultorías u obras distintos pero vinculados entre sí, agrupados en ${unidad}, donde cada uno —de valor superior al de un contrato menor— constituye un procedimiento independiente dentro del principal, de conformidad con el artículo 52.1.b del Reglamento; la cuantía se establece por la sumatoria de los ${unidad} (artículo 53.3). La DEC sustenta que este agrupamiento resulta más eficiente que efectuar contrataciones por separado (artículo 52.2 del Reglamento).`;

export const NORMA_AGRUPACION: Readonly<Record<string, string>> = {
  paquete:
    "El agrupamiento de prestaciones se realiza mediante la Contratación por paquete: se agrupan en un mismo objeto contractual bienes o servicios distintos pero vinculados entre sí —u obras o consultorías de obras de similar naturaleza—, de conformidad con el artículo 52.1.a del Reglamento. La DEC sustenta que este agrupamiento resulta más eficiente que efectuar contrataciones por separado (artículo 52.2 del Reglamento).",
  items: normaRelacion("ítems"),
  lotes: normaRelacion("lotes"),
  tramos: normaRelacion("tramos"),
};

/**
 * Sustento a precargar al ELEGIR el tipo de agrupación en q). Mismo criterio que
 * `sustentoAlElegirModalidadPago`: trae la norma del mecanismo (Art. 52) cuando el
 * sustento actual está VACÍO o es OTRA norma (venía de otro mecanismo, sin editar);
 * si la DEC escribió algo propio, devuelve null y se respeta lo escrito.
 *
 * Sin tipo seleccionado ("Seleccionar", ningún mecanismo aplica) el sustento pasa
 * a "NO CORRESPONDE" bajo el mismo criterio de respeto: solo si estaba vacío o
 * traía la norma de un mecanismo anterior que ya no aplica.
 */
export function sustentoAlElegirAgrupacion(tipo: string, actual: string): string | null {
  const a = actual.trim();
  const esOtraNorma = a !== "" && (Object.values(NORMA_AGRUPACION) as string[]).includes(a);
  if (!tipo) return !a || esOtraNorma ? PUNTO_NO_CORRESPONDE : null;
  const norma = NORMA_AGRUPACION[tipo];
  if (!norma) return null;
  return !a || esOtraNorma ? norma : null;
}

/**
 * Sustento normativo del mecanismo de agrupación marcado, para el fallback del
 * export cuando el campo q) está vacío pero hay una casilla marcada. "" si no hay
 * tipo (entonces la limpieza de la plantilla deja "NO CORRESPONDE").
 */
export function sustentoNormativoAgrupacion(tipo: string): string {
  return NORMA_AGRUPACION[tipo] ?? "";
}

// d) Modalidad de contratación pública eficiente (Art. 46.1.d).
export const CELDA_MODALIDAD_EFICIENTE: MapaCasillas = {
  compra_encargo: "F25",
  compra_corporativa: "J25",
  compra_centralizada: "F26",
  acuerdos_marco: "J26",
  compra_innovacion: "F27",
};

// r) Fichas de estandarización del requerimiento (Art. 46.1.r).
export const CELDA_FICHA_ESTANDARIZACION: MapaCasillas = {
  ficha_tecnica: "H162",
  ficha_homologacion: "H163",
};

/**
 * Casillas SÍ/NO del formato.
 *
 * Se marcan las dos ramas a propósito: dejar las dos en blanco no significa
 * "no", significa "sin analizar", y el Art. 46.1 pide que la DEC se pronuncie.
 */
export const SI_NO_ESTRATEGIA = {
  /** b) ¿Del análisis se sustenta el uso de un procedimiento no competitivo? */
  sustenta_no_competitivo: { si: "F11", no: "H11" },
  /** c) ¿Esta contratación es una inversión? */
  es_inversion: { si: "H17", no: "J17" },
  /** c) ¿El proyecto de inversión es viable o el IOARR fue aprobado? */
  inversion_viable: { si: "H19", no: "J19" },
  /** d) ¿Se usa una modalidad de contratación pública eficiente? */
  modalidad_eficiente: { si: "F23", no: "H23" },
  /** k) ¿La cuantía se actualizó con motivo de la estrategia? */
  cuantia_actualizada: { si: "F96", no: "H96" },
  /** l) ¿Corresponde garantía de fiel cumplimiento? */
  garantia_fiel_cumplimiento: { si: "F102", no: "H102" },
  /** l) ¿Corresponde garantía por prestaciones accesorias? */
  garantia_accesorias: { si: "F104", no: "H104" },
  /** l) ¿Se selecciona la garantía por adelantos directos? */
  garantia_adelantos: { si: "F106", no: "H106" },
  /** m) ¿Se contrató anteriormente un bien igual o similar? */
  consumo_historico: { si: "F116", no: "H116" },
  /** II. ¿La cuantía de la contratación es punto de referencia? */
  cuantia_referencia: { si: "F253", no: "H253" },
} as const;

/**
 * n) Casilla de la clasificación de la segmentación (Art. 46.1.n).
 *
 * No es un campo de A4: la clasificación LA DETERMINA A2, y el 46.1.n solo pide
 * "verificar" el tipo de interacción que aquella determinó. Pedirla otra vez
 * sería invitar a que los dos documentos se contradigan.
 */
export const CELDA_CLASIFICACION_SEGMENTACION: MapaCasillas = {
  rutinaria: "D121",
  operacional: "D122",
  critico: "D123",
  estrategico: "D124",
  contratacion_basica: "D125",
  contratacion_avanzada: "D126",
};

/** a) Cabecera con el tipo de procedimiento y su nomenclatura. */
export const CELDA_TIPO_PROCEDIMIENTO = "B3";

/** n) "Registrar la interacción que corresponda o nivel superior". */
export const CELDA_INTERACCION_ELEGIDA = "G121";

/** c) Código Único de Inversión: celda de texto, no casilla. */
/**
 * a) ¿Se modifica el procedimiento registrado en el PAC?
 *
 * Fuera de SI_NO_ESTRATEGIA: no es una pregunta de A4. Se deduce comparando el
 * procedimiento del PAC (A1) con el que la DEC determina en la estrategia.
 */
export const SI_NO_MODIFICA_PAC = { si: "F4", no: "H4" } as const;

export const CELDA_CUI = "C19";

/**
 * r) ¿El requerimiento se encuentra estandarizado?
 *
 * Fuera de SI_NO_ESTRATEGIA a propósito: no es una pregunta de A4. Lo verifica
 * el área usuaria en la ficha (`verificacion_ficha_tecnica`), A3 lo hereda y
 * aquí solo se imprime. Preguntarlo otra vez daba tres dueños al mismo hecho.
 */
export const SI_NO_ESTANDARIZADO = { si: "F160", no: "H160" } as const;

/**
 * o) Cronograma estimado del proceso de contratación (Art. 46.1.o).
 *
 * La plantilla trae una tabla Fase / Actividad / Inicio / Fin. Las dos primeras
 * actividades de actuaciones preparatorias vienen impresas; las de selección y
 * ejecución contractual se rellenan.
 */
export const FILAS_CRONOGRAMA = {
  preparatorias: [133, 134],
  seleccion: [135, 136, 137],
  ejecucion: [138, 139, 140],
} as const;

export const COL_CRONOGRAMA = { actividad: "C", inicio: "G", fin: "I" } as const;

/**
 * En la fase de EJECUCIÓN CONTRACTUAL no se fijan fechas en el cronograma de la
 * estrategia: dependen del contrato/bases y del inicio del plazo contractual.
 * Ambas columnas (inicio y fin) llevan este texto en lugar de una fecha.
 */
export const CRONOGRAMA_SEGUN_BASES = "SEGÚN BASES";

/**
 * Nombre de cada casilla, tal y como la nombra el formato.
 *
 * Se deriva de los mapas de arriba para que no haya una tercera lista que
 * mantener: una etiqueta que se olvide aquí no rompería nada, solo dejaría la
 * casilla sin nombre en la vista previa.
 */
export const ETIQUETAS_ESTRATEGIA: Readonly<Record<string, string>> = {
  [SI_NO_MODIFICA_PAC.si]: "a) Modifica el procedimiento del PAC: SÍ",
  [SI_NO_MODIFICA_PAC.no]: "a) Modifica el procedimiento del PAC: NO",
  [SI_NO_ESTRATEGIA.sustenta_no_competitivo.si]: "b) Sustenta el procedimiento no competitivo: SÍ",
  [SI_NO_ESTRATEGIA.sustenta_no_competitivo.no]: "b) Sustenta el procedimiento no competitivo: NO",
  [SI_NO_ESTRATEGIA.cuantia_actualizada.si]: "k) La cuantía se actualizó: SÍ",
  [SI_NO_ESTRATEGIA.cuantia_actualizada.no]: "k) La cuantía se actualizó: NO",
  [SI_NO_ESTRATEGIA.garantia_fiel_cumplimiento.si]: "l) Garantía de fiel cumplimiento: SÍ",
  [SI_NO_ESTRATEGIA.garantia_fiel_cumplimiento.no]: "l) Garantía de fiel cumplimiento: NO",
  [SI_NO_ESTRATEGIA.garantia_accesorias.si]: "l) Garantía por prestaciones accesorias: SÍ",
  [SI_NO_ESTRATEGIA.garantia_accesorias.no]: "l) Garantía por prestaciones accesorias: NO",
  [SI_NO_ESTRATEGIA.garantia_adelantos.si]: "l) Garantía por adelantos directos: SÍ",
  [SI_NO_ESTRATEGIA.garantia_adelantos.no]: "l) Garantía por adelantos directos: NO",
  [SI_NO_ESTRATEGIA.consumo_historico.si]: "m) Se contrató antes un bien igual o similar: SÍ",
  [SI_NO_ESTRATEGIA.consumo_historico.no]: "m) Se contrató antes un bien igual o similar: NO",
  [SI_NO_ESTRATEGIA.cuantia_referencia.si]: "II) La cuantía es punto de referencia: SÍ",
  [SI_NO_ESTRATEGIA.cuantia_referencia.no]: "II) La cuantía es punto de referencia: NO",
  D121: "n) Segmentación: Rutinario",
  D122: "n) Segmentación: Operacional",
  D123: "n) Segmentación: Crítico",
  D124: "n) Segmentación: Estratégico",
  D125: "n) Segmentación: Contratación básica",
  D126: "n) Segmentación: Contratación avanzada",
  [SI_NO_ESTRATEGIA.es_inversion.si]: "c) Es una inversión: SÍ",
  [SI_NO_ESTRATEGIA.es_inversion.no]: "c) Es una inversión: NO",
  [SI_NO_ESTRATEGIA.inversion_viable.si]: "c) Proyecto viable / IOARR aprobado: SÍ",
  [SI_NO_ESTRATEGIA.inversion_viable.no]: "c) Proyecto viable / IOARR aprobado: NO",
  [SI_NO_ESTRATEGIA.modalidad_eficiente.si]: "d) Usa modalidad eficiente: SÍ",
  [SI_NO_ESTRATEGIA.modalidad_eficiente.no]: "d) Usa modalidad eficiente: NO",
  [SI_NO_ESTANDARIZADO.si]: "r) Requerimiento estandarizado: SÍ",
  [SI_NO_ESTANDARIZADO.no]: "r) Requerimiento estandarizado: NO",
  F36: "e) Evaluador: Oficial de compra",
  J36: "e) Evaluador: Jurado",
  F37: "e) Evaluador: Comité",
  F62: "h) Pago: Suma alzada",
  J62: "h) Pago: Pago por consumo",
  F63: "h) Pago: Precios unitarios",
  J63: "h) Pago: Pago por disponibilidad",
  F64: "h) Pago: Esquema mixto",
  J64: "h) Pago: Pago por activación",
  F65: "h) Pago: Tarifas",
  J65: "h) Pago: Pago mixto",
  F66: "h) Pago: En base a porcentajes",
  J66: "h) Pago: Costo reembolsable",
  F67: "h) Pago: Honorario fijo y comisión de éxito",
  H162: "r) Ficha técnica",
  H163: "r) Ficha de homologación",
};

/** Celdas de sustento del formato, con el nombre de su variable del Art. 46.1. */
export const SUSTENTOS_ESTRATEGIA: ReadonlyArray<{ celda: string; titulo: string }> = [
  { celda: "B7", titulo: "a) Sustento del cambio del procedimiento respecto del PAC" },
  { celda: "B13", titulo: "b) Procedimiento no competitivo" },
  { celda: "C19", titulo: "c) Código Único de Inversión (CUI)" },
  { celda: "B33", titulo: "d) Modalidad de contratación pública eficiente" },
  { celda: "B40", titulo: "e) Perfil del evaluador" },
  { celda: "B44", titulo: "f) Requisitos de calificación" },
  { celda: "B56", titulo: "g) Factores de evaluación" },
  { celda: "B70", titulo: "h) Modalidad de pago" },
  { celda: "B83", titulo: "i) Sistema de entrega" },
  { celda: "C87", titulo: "j) Puntos no negociables" },
  { celda: "B98", titulo: "k) Financiamiento y actualización de la cuantía" },
  { celda: "B112", titulo: "l) Garantías y adelantos" },
  { celda: "B117", titulo: "m) Consumo histórico" },
  { celda: "B129", titulo: "n) Interacción con el mercado" },
  { celda: "C135", titulo: "o) Cronograma (fase de selección)" },
  { celda: "B148", titulo: "p) Roles y responsabilidades" },
  { celda: "B156", titulo: "q) Agrupación de prestaciones" },
  { celda: "B166", titulo: "s) Objetivo del proceso" },
  { celda: "B179", titulo: "t) Otras variables" },
  // II) "Señalar si la cuantía de la contratación es punto de referencia".
  // El sustento solo se pide cuando la respuesta es SÍ (E253) —caso raro,
  // reservado a obras cuyo valor referencial es la cuantía—. No hay campo de A4
  // que lo llene, así que en el caso normal (NO) la celda quedaba con el marcador
  // "[Insertar sustento…]" literal. Con la respuesta por defecto (NO) toca
  // "NO CORRESPONDE.", igual que el resto de sustentos que no aplican.
  { celda: "B255", titulo: "II) Sustento de la cuantía como punto de referencia" },
  // Variables de obras y consultoría de obras (Art. 154.1 a–i). Sus celdas de
  // sustento estaban FUERA de esta limpieza: en cualquier expediente donde no se
  // llenaran —empezando por TODO bien/servicio, donde la sección de obras no
  // aplica— el marcador "[Insertar sustento…]" salía literal en el formato. Aquí
  // se les da el mismo trato que al resto: vacío → "NO CORRESPONDE.".
  { celda: "B197", titulo: "[Obras] a) Tipo de contrato a emplear" },
  { celda: "B203", titulo: "[Obras] b) Metodología BIM" },
  { celda: "B211", titulo: "[Obras] c) Incentivos por beneficios o mejoras" },
  { celda: "B216", titulo: "[Obras] d) Ejecución rápida (fast track)" },
  { celda: "B221", titulo: "[Obras] e) Disponibilidad física del terreno" },
  { celda: "B230", titulo: "[Obras] f) Plan de licencias, permisos y servidumbres" },
  { celda: "B236", titulo: "[Obras] g) Responsable del expediente técnico" },
  { celda: "B241", titulo: "[Obras/Consultoría] h) Estructura de costos" },
  { celda: "B249", titulo: "[Obras/Consultoría] i) Metodologías colaborativas" },
];

/** o) Una actividad del cronograma (Art. 46.1.o). */
export type ActividadCronograma = {
  fase?: "preparatorias" | "seleccion" | "ejecucion";
  actividad?: string;
  inicio?: string;
  fin?: string;
};

/** p) Un rol y su etapa (Art. 46.1.p). */
export type RolEstrategia = { rol?: string; etapa?: string };

export function leerFilas<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is T => typeof f === "object" && f !== null);
}

/**
 * Cronograma que el formato trae impreso en la fase de actuaciones
 * preparatorias (filas 133-134). No se piden: son siempre las mismas dos.
 */
export const ACTIVIDADES_PREPARATORIAS = [
  "Aprobación del expediente de contratación",
  "Elaboración de las bases del procedimiento de selección",
] as const;

/**
 * Actividades típicas de la fase de selección, para sembrar el cronograma.
 *
 * Salen del formato firmado por la entidad. Son una sugerencia editable: el
 * propio formato avisa de que "debe considerar las actividades de acuerdo al
 * tipo de procedimiento y al objeto contractual", así que varían.
 */
export const ACTIVIDADES_SELECCION_SUGERIDAS = [
  "Convocatoria",
  "Formulación de consultas y observaciones (electrónica)",
  "Absolución de consultas y observaciones (electrónica)",
  "Integración de las bases",
  "Otorgamiento de buena pro",
  "Consentimiento de buena pro",
] as const;

export const ACTIVIDADES_EJECUCION_SUGERIDAS = [
  "Presentación de requisitos para firma del contrato",
  "Suscripción del contrato",
  "Ejecución contractual",
] as const;

/**
 * La actividad "Ejecución contractual" no lleva fechas estimadas: su plazo lo
 * fijan las bases del procedimiento. En el cronograma sus columnas de inicio y
 * fin muestran `CRONOGRAMA_SEGUN_BASES` en vez de una fecha. Solo esa actividad.
 */
export function esActividadSegunBases(actividad: string | undefined): boolean {
  return (actividad ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .includes("ejecucion contractual");
}

/**
 * Rótulo de la "Ejecución contractual" con el PLAZO del requerimiento entre
 * paréntesis, cuando se conoce (Art. 126.2/105.3). El plazo es una DURACIÓN en
 * días —no una fecha—, así que no cabe en las columnas de inicio/fin (que siguen
 * mostrando "SEGÚN BASES"): se anota junto a la actividad. Sin plazo, el rótulo
 * queda como estaba. Sigue conteniendo "ejecución contractual", así que
 * `esActividadSegunBases` lo detecta igual.
 */
export function textoEjecucionConPlazo(dias: number | null | undefined, unidad: string | null | undefined): string {
  if (dias == null || !Number.isFinite(dias) || dias <= 0) return "Ejecución contractual";
  const u = String(unidad ?? "").toLowerCase().includes("habil") ? "días hábiles" : "días calendario";
  return `Ejecución contractual (plazo: ${dias} ${u})`;
}

/** Actividades de la fase de ejecución, con el plazo anotado en la última. */
export function actividadesEjecucionDe(dias?: number | null, unidad?: string | null): readonly string[] {
  return ACTIVIDADES_EJECUCION_SUGERIDAS.map((a) =>
    esActividadSegunBases(a) ? textoEjecucionConPlazo(dias, unidad) : a,
  );
}

/**
 * o) Cronograma inicial (Art. 46.1.o): las tres fases con SUS actividades mínimas
 * según el procedimiento elegido en a) —preparatorias fijas, selección propia del
 * procedimiento (Art. 64/66, la secuencia definitiva la fijan las bases
 * estándar), y ejecución con el plazo—. Es un punto de partida EDITABLE. Lo usan
 * tanto el botón "Sembrar" del editor como la auto-siembra al abrir A4.
 */
export function construirCronogramaInicial(
  procedimiento: string | null | undefined,
  plazoDias?: number | null,
  plazoUnidad?: string | null,
): ActividadCronograma[] {
  return [
    ...ACTIVIDADES_PREPARATORIAS.map((actividad) => ({ actividad, fase: "preparatorias" as const })),
    ...actividadesSeleccionDe(procedimiento).map((actividad) => ({ actividad, fase: "seleccion" as const })),
    ...actividadesEjecucionDe(plazoDias, plazoUnidad).map((actividad) => ({ actividad, fase: "ejecucion" as const })),
  ];
}

// Actividades de la fase de SELECCIÓN por tipo de procedimiento (Art. 46.1.o:
// "de acuerdo al tipo de procedimiento"). Son un PUNTO DE PARTIDA editable que
// la DEC debe verificar contra el Reglamento de la Ley N° 32069: la secuencia y
// los plazos definitivos los fijan las bases estándar de cada procedimiento.
// Las etapas de cada procedimiento salen de la columna "Etapas" de las tablas de
// los Arts. 93/94/95 del Reglamento (verificado verbatim contra el RAG), MÁS el
// hito que la norma fecha pero no lista como etapa: "Presentación de ofertas"
// (ancla del Art. 64.1/68.1). El cronograma de la fase de SELECCIÓN termina en el
// otorgamiento de la buena pro; el consentimiento (Art. 82.1) es de la ejecución.
//
// COMPETITIVOS (licitación / concurso público y sus abreviados, Art. 93/94):
// Convocatoria, Registro de participantes, "Consultas y observaciones" (plazo del
// Art. 66.1), "Absolución e integración" (su fin ancla el Art. 68.1), Presentación
// de ofertas, Evaluación y calificación, Otorgamiento de la buena pro. El registro
// es un RANGO (Art. 65.2): `aplicarRegistroParticipantes` le pone las fechas del
// día siguiente de la convocatoria a antes de las ofertas.
const ACT_COMPETITIVO = [
  "Convocatoria",
  "Registro de participantes",
  "Consultas y observaciones",
  "Absolución e integración",
  "Presentación de ofertas",
  "Evaluación y calificación de ofertas",
  "Otorgamiento de la buena pro",
] as const;

// SUBASTA INVERSA ELECTRÓNICA (Art. 95): sus etapas NO incluyen consultas ni
// observaciones —el requerimiento es la ficha técnica— y la evaluación es por
// lances (Art. 96.4). El registro va IMPLÍCITO en la ventana convocatoria→ofertas
// (mín. 6 días hábiles según la directiva de Perú Compras / bases estándar de la
// SIE), así que no se lista como fila con fecha propia.
const ACT_SUBASTA = [
  "Convocatoria",
  "Presentación de ofertas",
  "Evaluación de ofertas mediante lances (puja electrónica)",
  "Otorgamiento de la buena pro",
] as const;

// COMPARACIÓN DE PRECIOS (Art. 95): sus etapas son Convocatoria, Evaluación de
// ofertas económicas y Otorgamiento — SIN registro de participantes ni consultas.
// Se convoca invitando a un mínimo de tres proveedores (Art. 97.2).
const ACT_COMPARACION = [
  "Convocatoria / solicitud de cotizaciones",
  "Presentación de cotizaciones",
  "Evaluación de ofertas económicas",
  "Otorgamiento de la buena pro",
] as const;

/**
 * Las modalidades ABREVIADAS recorren las mismas etapas que su procedimiento
 * matriz (también tienen consultas y observaciones), así que comparten lista.
 * Lo que la norma sí separa son los PLAZOS, y esos van por procedimiento en
 * MIN_HABILES_CONVOCATORIA_OFERTAS (Art. 64.1), MIN_HABILES_CONSULTAS
 * (Art. 66.1) y DIAS_HABILES_APELACION (Art. 304.2).
 */
export const ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO: Readonly<Record<string, readonly string[]>> = {
  licitacion_publica: ACT_COMPETITIVO,
  licitacion_publica_abreviada: ACT_COMPETITIVO,
  concurso_publico: ACT_COMPETITIVO,
  concurso_publico_abreviado: ACT_COMPETITIVO,
  subasta_inversa_electronica: ACT_SUBASTA,
  comparacion_precios: ACT_COMPARACION,
  compra_publica_innovacion: ACT_COMPETITIVO,
};

/**
 * Art. 64.1: en los procedimientos de selección competitivos el plazo entre la
 * CONVOCATORIA y la PRESENTACIÓN DE OFERTAS no puede ser menor de 22 días
 * hábiles, "salvo en el caso de las modalidades abreviadas y aquellas que no
 * contemplen etapas de consultas y observaciones". `null` = no aplica el mínimo.
 *
 * (Art. 64.3: con anuncio de contratación futura publicado con ≥40 días
 * calendario de anticipación, el plazo puede reducirse conforme a las bases
 * estándar, nunca por debajo de 10 días calendario. Eso NO se automatiza: lo
 * decide la entidad y se ajusta a mano.)
 *
 * La SUBASTA INVERSA ELECTRÓNICA queda FUERA del Art. 64.1 (no tiene consultas),
 * pero su registro va implícito en la ventana convocatoria→ofertas: la directiva
 * de Perú Compras y las bases estándar de la SIE fijan un mínimo de 6 días
 * hábiles. Se modela aquí como piso para que las ofertas nunca queden antes.
 */
export const MIN_HABILES_CONVOCATORIA_OFERTAS: Readonly<Record<string, number | null>> = {
  licitacion_publica: 22,
  concurso_publico: 22,
  compra_publica_innovacion: 22,
  licitacion_publica_abreviada: null, // modalidad abreviada (excepción del 64.1)
  concurso_publico_abreviado: null, // modalidad abreviada (excepción del 64.1)
  subasta_inversa_electronica: 6, // mín. de la directiva SIE (no del Art. 64.1)
  comparacion_precios: null, // no contempla etapa de consultas y observaciones
};

/**
 * Art. 66.1: la formulación de consultas y observaciones tiene un plazo NO MENOR
 * a 7 días hábiles desde el día siguiente de la convocatoria; en las modalidades
 * ABREVIADAS, no menor a 3. 0 = el procedimiento no contempla esa etapa.
 */
export const MIN_HABILES_CONSULTAS: Readonly<Record<string, number>> = {
  licitacion_publica: 7,
  concurso_publico: 7,
  compra_publica_innovacion: 7,
  licitacion_publica_abreviada: 3,
  concurso_publico_abreviado: 3,
  subasta_inversa_electronica: 3,
  comparacion_precios: 0,
};

/**
 * Art. 68.1: la presentación de ofertas se realiza en un plazo NO MENOR de 7 días
 * hábiles desde la publicación de la integración de bases; en las MODALIDADES
 * ABREVIADAS, no menor de 3. `null` = el procedimiento no tiene etapa de integración
 * de bases (la comparación de precios cuenta desde la convocatoria, Art. 68.2).
 */
export const MIN_HABILES_INTEGRACION_OFERTAS: Readonly<Record<string, number | null>> = {
  licitacion_publica: 7,
  concurso_publico: 7,
  compra_publica_innovacion: 7,
  licitacion_publica_abreviada: 3,
  concurso_publico_abreviado: 3,
  subasta_inversa_electronica: 3,
  comparacion_precios: null,
};

/**
 * Art. 304: días hábiles para interponer recurso de apelación, contados desde la
 * notificación del otorgamiento de la buena pro.
 *   304.1 competitivos → 8 · 304.2 abreviados, selección de expertos y
 *   comparación de precios → 5 · 304.3 subasta inversa → 5 (u 8 si su cuantía
 *   corresponde a licitación/concurso público: eso se ajusta a mano).
 */
export const DIAS_HABILES_APELACION: Readonly<Record<string, number>> = {
  licitacion_publica: 8,
  concurso_publico: 8,
  compra_publica_innovacion: 8,
  licitacion_publica_abreviada: 5,
  concurso_publico_abreviado: 5,
  subasta_inversa_electronica: 5,
  comparacion_precios: 5,
};

/**
 * Art. 82.1: la buena pro queda consentida al día hábil siguiente de vencido el
 * plazo para apelar, de modo que el plazo es el de apelación (Art. 304) + 1.
 *
 * Ojo: el Art. 82.2 tiene una regla distinta — con UNA sola oferta, la buena pro
 * queda consentida el MISMO día de su otorgamiento. Eso no se puede deducir de
 * aquí, así que la fecha calculada es una sugerencia editable.
 */
export const DIAS_HABILES_CONSENTIMIENTO: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(DIAS_HABILES_APELACION).map(([proc, dias]) => [proc, dias + 1]),
);

/** ¿Es una actividad de "registro de participantes"? (Art. 65.2: es un RANGO). */
export function esRegistroParticipantes(actividad: string | undefined): boolean {
  return /registro de participantes/i.test(actividad ?? "");
}

/** ¿Es la actividad de convocatoria? */
export function esConvocatoria(actividad: string | undefined): boolean {
  return /^convocatoria|convocatoria \/ solicitud/i.test((actividad ?? "").trim());
}

/** ¿Es la actividad de presentación de ofertas (o de cotizaciones)? */
export function esPresentacionOfertas(actividad: string | undefined): boolean {
  return /presentaci[oó]n de (ofertas|cotizaci)/i.test(actividad ?? "");
}

/**
 * Actividades de selección para el procedimiento elegido en a). Si no hay
 * procedimiento (o no está mapeado), cae en la lista genérica editable.
 */
export function actividadesSeleccionDe(procedimiento: string | null | undefined): readonly string[] {
  return (
    (procedimiento && ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO[procedimiento]) ||
    ACTIVIDADES_SELECCION_SUGERIDAS
  );
}

function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return a.length === b.length && a.every((x, i) => norm(x) === norm(b[i]));
}

/**
 * ¿Las actividades de selección del cronograma o) son las del procedimiento
 * elegido en a)? Si a) cambia después de sembrar o), el cronograma se queda con
 * las actividades del procedimiento anterior y el formato sale contradiciéndose
 * a sí mismo (Art. 46.1.o: el cronograma es "de acuerdo al tipo de
 * procedimiento").
 *
 * Devuelve `null` cuando no se puede afirmar nada: sin procedimiento, sin filas
 * de selección, o con actividades editadas a mano —que es lo normal y no hay
 * nada que reprochar—. Solo devuelve `false` cuando la lista es EXACTAMENTE la
 * de otro procedimiento, es decir, cuando se sembró y luego se cambió a).
 *
 * Ojo: las modalidades abreviadas comparten lista con su procedimiento matriz,
 * así que ahí devuelve `true` y la diferencia (los plazos) la detecta
 * `validarCronograma`.
 */
export function cronogramaCoincideConProcedimiento(
  filas: readonly ActividadCronograma[],
  procedimiento: string | null | undefined,
): boolean | null {
  const esperadas = procedimiento ? ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO[procedimiento] : undefined;
  if (!esperadas) return null;
  const actuales = filas
    .filter((f) => f.fase === "seleccion")
    .map((f) => (f.actividad ?? "").trim())
    .filter(Boolean);
  if (actuales.length === 0) return null;
  if (mismaLista(actuales, esperadas)) return true;
  const deOtro = Object.entries(ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO).some(
    ([p, lista]) => p !== procedimiento && mismaLista(actuales, lista),
  );
  return deOtro ? false : null;
}

/** Etapas de la fase de selección a las que se asigna un rol (Art. 46.1.p). */
export const ETAPAS_ROL = [
  { value: "actos_preparatorios", label: "ACTOS PREPARATORIOS" },
  { value: "convocatoria", label: "CONVOCATORIA" },
  { value: "post_convocatoria", label: "POST CONVOCATORIA" },
  { value: "ejecucion_contractual", label: "EJECUCIÓN CONTRACTUAL" },
];

/**
 * p) Involucrados de la entidad contratante en la fase de selección (Art. 46.1.p),
 * con su responsabilidad típica y la etapa en que actúan.
 *
 * Redactados según la variable p) de la Guía de Actuaciones Preparatorias (3.ª
 * versión, pág. 39): la DEC analiza —a partir del tipo de evaluador de la variable
 * e)— si la entidad cuenta con el personal con conocimiento y experiencia en el
 * objeto (con apoyo de RR. HH.), y verifica si hay que involucrar a otras unidades
 * (almacén, patrimonio, mantenimiento…) en la etapa de consultas y observaciones.
 *
 * La Guía NO diferencia los roles por procedimiento: lo único que cambia por
 * procedimiento es el TIPO DE EVALUADOR (Cuadro N° 6/7, variable e), Arts. 93/94/95
 * del Reglamento). Por eso el rol del evaluador se especializa con `rolesDe` según
 * el tipo elegido en e). Es un PUNTO DE PARTIDA editable.
 */
export const ROLES_HABITUALES: ReadonlyArray<{
  involucrado: string;
  responsabilidad: string;
  etapa: string;
}> = [
  {
    involucrado: "Dependencia Encargada de las Contrataciones (DEC)",
    responsabilidad:
      "Conduce la fase de selección (elabora las bases, gestiona la Pladicop y publica los actos) y analiza si la entidad cuenta con el personal con conocimiento y experiencia en el objeto —según el tipo de evaluador de la variable e)—, identificando su vinculación laboral.",
    etapa: "actos_preparatorios",
  },
  {
    involucrado: "Evaluador (oficial de compra / comité de selección / jurado)",
    responsabilidad:
      "Según el tipo definido en la variable e) para el procedimiento. Evalúa y califica las ofertas y otorga la buena pro conforme a las bases.",
    etapa: "post_convocatoria",
  },
  {
    involucrado: "Área usuaria",
    responsabilidad:
      "Absuelve las consultas y observaciones técnicas del requerimiento y verifica el cumplimiento técnico de las ofertas.",
    etapa: "post_convocatoria",
  },
  {
    involucrado: "Unidad de Recursos Humanos",
    responsabilidad:
      "Colabora con la DEC en verificar e identificar al personal disponible con el conocimiento y la experiencia en el objeto y su vinculación laboral (variable p), Art. 46.1.p).",
    etapa: "actos_preparatorios",
  },
  {
    involucrado: "Otras unidades de organización (almacén, patrimonio, mantenimiento, según corresponda)",
    responsabilidad:
      "En bienes, se involucran —según corresponda— en la atención de la etapa de consultas y observaciones del requerimiento.",
    etapa: "post_convocatoria",
  },
  {
    involucrado: "Titular de la entidad / Autoridad de Gestión Administrativa (AGA)",
    responsabilidad:
      "Aprueba el expediente de contratación, designa al evaluador y resuelve el recurso de apelación cuando corresponde.",
    etapa: "actos_preparatorios",
  },
  {
    involucrado: "Oficina de Presupuesto (OPP)",
    responsabilidad:
      "Otorga y mantiene la certificación de crédito presupuestario que respalda la contratación.",
    etapa: "actos_preparatorios",
  },
  {
    involucrado: "Asesoría jurídica",
    responsabilidad:
      "Emite opinión legal en las controversias, recursos y actos del procedimiento que lo requieran.",
    etapa: "post_convocatoria",
  },
];

/** ¿Es la fila del EVALUADOR? (su involucrado empieza por "Evaluador"). */
function esRolEvaluador(involucrado: string | undefined): boolean {
  return (involucrado ?? "").startsWith("Evaluador");
}

/**
 * Fila del EVALUADOR especializada por el tipo elegido en e) (Cuadro N° 6 de la
 * Guía): oficial de compra, comité o jurado. El jurado tiene una regla propia —solo
 * es responsable de la evaluación; la DEC del resto del procedimiento—.
 */
function rolEvaluador(tipoEvaluador?: string): { involucrado: string; responsabilidad: string; etapa: string } {
  switch (tipoEvaluador) {
    case "oficial_compra":
      return {
        involucrado: "Evaluador — Oficial de compra (DEC)",
        responsabilidad:
          "Comprador público de la DEC designado como evaluador (Art. 58 Reglamento). Evalúa y califica las ofertas y otorga la buena pro.",
        etapa: "post_convocatoria",
      };
    case "comite":
      return {
        involucrado: "Evaluador — Comité de selección",
        responsabilidad:
          "Tres integrantes (al menos uno comprador público de la DEC y uno experto/profesional con conocimiento del objeto). Evalúa las ofertas de forma colegiada y otorga la buena pro (Art. 59 Reglamento).",
        etapa: "post_convocatoria",
      };
    case "jurado":
      return {
        involucrado: "Evaluador — Jurado",
        responsabilidad:
          "Tres o cinco expertos que deciden de forma individual. El jurado es responsable SOLO de la evaluación de las ofertas; la DEC es responsable del resto de actuaciones y actos del procedimiento (Cuadro N° 6 de la Guía; Art. 60 Reglamento).",
        etapa: "post_convocatoria",
      };
    default:
      return ROLES_HABITUALES.find((r) => esRolEvaluador(r.involucrado))!;
  }
}

/**
 * Roles de p) para el tipo de evaluador elegido en e). Igual que ROLES_HABITUALES,
 * pero con la fila del evaluador especializada por su tipo (lo único que la Guía
 * hace variar por procedimiento). Sin tipo, deja la fila genérica.
 */
export function rolesDe(
  tipoEvaluador?: string,
): ReadonlyArray<{ involucrado: string; responsabilidad: string; etapa: string }> {
  const evaluador = rolEvaluador(tipoEvaluador);
  return ROLES_HABITUALES.map((r) => (esRolEvaluador(r.involucrado) ? evaluador : r));
}

/** Valor del desplegable para escribir un involucrado no listado. */
export const ROL_OTRO = "Otro (especificar)";

/** Texto "Involucrado: responsabilidad" que se vuelca en la columna del formato. */
export function textoRolHabitual(r: { involucrado: string; responsabilidad: string }): string {
  return `${r.involucrado}: ${r.responsabilidad}`;
}

/** Etiqueta del evaluador para el modelo de roles (fila de la CONVOCATORIA). */
function etiquetaEvaluadorRol(tipoEvaluador?: string): string {
  return (
    { oficial_compra: "Oficial de compra", comite: "Comité de selección", jurado: "Jurado" }[tipoEvaluador ?? ""] ??
    "Evaluador (oficial de compra / comité / jurado)"
  );
}

/** Entregable que el área usuaria elabora en actos preparatorios, según el objeto. */
function entregableAreaUsuaria(objeto?: string): string {
  switch (objeto) {
    case "bienes":
      return "las Especificaciones Técnicas, asegurando la coherencia con las Fichas Técnicas del Listado de Bienes y Servicios Comunes";
    case "obra":
      return "el expediente técnico de obra, asegurando su consistencia técnica y presupuestal";
    case "consultoria_obra":
      return "los Términos de Referencia de la consultoría de obra";
    default:
      return "los Términos de Referencia, definiendo con precisión el alcance del servicio";
  }
}

/** Cómo se nombra el objeto en la ejecución contractual. */
function objetoEjecucion(objeto?: string): { uso: string; entrega: string } {
  switch (objeto) {
    case "bienes":
      return { uso: "del bien", entrega: "el bien" };
    case "obra":
    case "consultoria_obra":
      return { uso: "de la obra", entrega: "la prestación" };
    default:
      return { uso: "del servicio", entrega: "la prestación" };
  }
}

/**
 * p) Modelo de roles y responsabilidades de los involucrados, estructurado por
 * ETAPA de la fase de selección (actos preparatorios / convocatoria / post
 * convocatoria / ejecución contractual), según el modelo real de la entidad.
 *
 * Es un PUNTO DE PARTIDA editable que se adapta a:
 *   · el PROCESO de a) (se cita en el rol del área usuaria),
 *   · el OBJETO (bienes → EETT + Listado de Bienes y Servicios Comunes; servicios →
 *     TDR; obra → expediente técnico),
 *   · el EVALUADOR de e) (oficial de compra / comité / jurado; el jurado solo evalúa,
 *     la DEC conduce el resto, Cuadro N° 6 de la Guía).
 *
 * La DEC también aparece en ejecución contractual (Art. 14.2.i y 14.2.k del
 * Reglamento): monitorea/evalúa la ejecución de TODOS los contratos y revisa
 * que la conformidad que emite el área usuaria cumpla la normativa de
 * contratación —sin entrar en lo técnico, que es responsabilidad de esta—.
 */
export function modeloRolesP(opts: {
  proceso?: string;
  objeto?: string;
  tipoEvaluador?: string;
}): Array<{ rol: string; etapa: string }> {
  const proceso = (opts.proceso ?? "").trim() || "este procedimiento de selección";
  const evaluador = etiquetaEvaluadorRol(opts.tipoEvaluador);
  const ej = objetoEjecucion(opts.objeto);

  const filaEvaluador =
    opts.tipoEvaluador === "jurado"
      ? "Jurado:\nEvaluación de ofertas: los expertos evalúan y califican las ofertas de forma individual y otorgan la buena pro. El jurado es responsable SOLO de la evaluación; la conducción del resto del procedimiento corresponde a la DEC (Cuadro N° 6 de la Guía)."
      : `${evaluador}:\nElaboración y aprobación de documentos: elabora y aprueba las bases del procedimiento.\nGestión de la convocatoria: publica el procedimiento en la Pladicop (SEACE).\nConducción del procedimiento: tiene a su cargo las actuaciones desde la convocatoria hasta el otorgamiento de la buena pro.\nDecisión final: declara el consentimiento de la buena pro o, de ser el caso, el desierto conforme a la Ley, garantizando la objetividad y la trazabilidad de sus actos.\nAutonomía y consulta: actúa con autonomía técnica en la evaluación y puede solicitar opiniones técnicas al área usuaria o a áreas especializadas.`;

  return [
    {
      etapa: "actos_preparatorios",
      rol: `Área usuaria: al tratarse de ${proceso}, el área usuaria es responsable de elaborar ${entregableAreaUsuaria(opts.objeto)}.`,
    },
    {
      etapa: "actos_preparatorios",
      rol: `Dependencia Encargada de las Contrataciones (DEC):\nPlanificación y segmentación: categoriza la compra.\nInteracción con el mercado: lidera la consulta o indagación al mercado para determinar la cuantía de la contratación.\nGestión de actuaciones preparatorias: consolida el expediente de contratación (solicitud de la certificación presupuestal y elaboración de la estrategia de contratación).\nDesignación y conducción: solicita la designación del ${evaluador.toLowerCase()} y gestiona la aprobación del expediente de contratación.`,
    },
    { etapa: "convocatoria", rol: filaEvaluador },
    {
      etapa: "post_convocatoria",
      rol: "Dependencia Encargada de las Contrataciones (DEC):\nGestión de la formalización contractual: revisa la documentación presentada por el postor ganador de la buena pro.\nElaboración y perfeccionamiento del contrato: redacta, publica y registra el contrato en el SEACE.\nGestión de procesos desiertos: de declararse desierto, devuelve el requerimiento al área usuaria para su reevaluación técnica y coordina los ajustes en la estrategia para una nueva convocatoria oportuna.",
    },
    {
      etapa: "ejecucion_contractual",
      rol: `Área usuaria (ejecución contractual): asume la responsabilidad técnica y operativa de asegurar el uso eficiente ${ej.uso}.\nControl de ingreso y registro: verifica que ${ej.entrega} ingrese en óptimas condiciones.\nGestión de la conformidad: hace el seguimiento de las entregas y emite las conformidades correspondientes dentro de los plazos legales.`,
    },
    {
      etapa: "ejecucion_contractual",
      rol: "Dependencia Encargada de las Contrataciones (DEC):\nMonitoreo de la ejecución: realiza el monitoreo y evaluación de la ejecución contractual del contrato.\nRevisión de la conformidad: verifica el cumplimiento de la normativa de contratación pública en la conformidad que emite el área usuaria, sin entrar en los aspectos técnicos del requerimiento, que son responsabilidad de esta.",
    },
  ];
}

/**
 * ¿Las filas de p) son el MODELO auto-generado SIN EDITAR? Reconstruye el modelo con
 * el proceso que declara la propia fila del área usuaria (y el objeto/evaluador
 * indicados) y lo compara al completo. Si la DEC editó cualquier fila, deja de
 * coincidir → se respeta. Sirve para refrescar la mención del proceso de a) sin pisar
 * lo editado a mano.
 */
export function esModeloRolesP(value: unknown, objeto?: string, tipoEvaluador?: string): boolean {
  const filas = leerFilas<{ rol?: string; etapa?: string }>(value);
  if (filas.length !== 6) return false;
  const mm = /^Área usuaria: al tratarse de (.+?), el área usuaria es responsable/.exec(filas[0].rol ?? "");
  if (!mm) return false;
  const esperado = modeloRolesP({ proceso: mm[1], objeto, tipoEvaluador });
  return filas.every((f, i) => f.rol === esperado[i].rol && f.etapa === esperado[i].etapa);
}

export const FASES_CRONOGRAMA = [
  { value: "preparatorias", label: "Fase de actuaciones preparatorias" },
  { value: "seleccion", label: "Fase de selección" },
  { value: "ejecucion", label: "Fase de ejecución contractual" },
];

/** Filas de la tabla de roles en la plantilla (B145:E145 rol, F145:J145 etapa). */
export const FILA_ROLES_INICIO = 145;
export const FILAS_ROLES_PLANTILLA = 2;

/** t) Casillas de "Otras consideraciones/variables" (Art. 46.1.t). */
export const CELDA_OTRAS_VARIABLES: MapaCasillas = {
  jprd: "F172",
  formula_reajuste: "J172",
  documentos_perfeccionamiento: "F173",
  subcontratacion: "J173",
  otras_penalidades: "F174",
  resolucion_anticipada: "J174",
  documentacion_admision: "F177",
  muestras: "J177",
};

/**
 * Fuente de financiamiento de la Necesidad → casilla del formato (Art. 46.1.k).
 *
 * La ficha la guarda como texto libre ("RECURSOS DETERMINADOS", "RDR",
 * "Canon..."), así que hay que normalizarla. Devuelve null cuando no se
 * reconoce: marcar la casilla equivocada en un documento que se firma es peor
 * que dejarla en blanco y que la vista previa lo delate.
 */
export function fuenteFinanciamientoDeTexto(texto: string | null | undefined): string | null {
  if (!texto?.trim()) return null;
  const v = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (v.includes("ordinario") || /\bro\b/.test(v)) return "recursos_ordinarios";
  if (v.includes("directamente recaudado") || /\brdr\b/.test(v)) return "recursos_directamente_recaudados";
  if (v.includes("credito") || v.includes("endeudamiento")) return "operaciones_credito";
  if (v.includes("donacion") || v.includes("transferencia")) return "donaciones_transferencias";
  // El canon y el FONCOMUN son recursos determinados: es la fuente típica de
  // una municipalidad y sin esto ninguna casilla se marcaría.
  if (v.includes("determinado") || v.includes("canon") || v.includes("foncomun") || /\brd\b/.test(v)) {
    return "recursos_determinados";
  }
  return null;
}

/**
 * i) Sistema de entrega (Art. 46.1.i): opciones del formato.
 *
 * Los `value` son las claves de CELDA_SISTEMA_ENTREGA — el test guardián exige
 * que coincidan, porque si divergen la casilla no se marca y no falla nada.
 */
// Lista compartida con la ficha de necesidad: vive en lib/opciones-contratacion.ts
// (módulo puro) y se reexporta aquí para no romper a quien ya la importaba.
export { OPCIONES_SISTEMA_ENTREGA } from "./opciones-contratacion";

/**
 * Sistema de entrega de la Necesidad → opción del formato.
 *
 * La ficha lo guarda como texto libre. Devuelve null si no se reconoce: marcar
 * la casilla equivocada es peor que dejarla en blanco.
 */
export function sistemaEntregaDeTexto(texto: string | null | undefined): string | null {
  if (!texto?.trim()) return null;
  const v = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (v.includes("llave en mano") && v.includes("mantenimiento")) return "llave_en_mano_mantenimiento";
  if (v.includes("llave en mano")) return "llave_en_mano";
  if (v.includes("comodato")) return "suministro_comodato";
  if (v.includes("gestion de instalaciones")) return "gestion_instalaciones";
  if (v.includes("no aplica")) return "no_aplica";
  if (v.includes("solo construccion")) return "solo_construccion";
  if (v.includes("diseno y construccion")) return "diseno_construccion";
  return null;
}

/** g) Un factor de evaluación (Art. 46.1.g). */
export type FactorEvaluacion = { nombre?: string; sustento?: string };

/**
 * Opciones del "Nombre del factor" en g) (Art. 46.1.g). El editor las ofrece en
 * un desplegable para elegir en vez de teclear texto libre; así se evita que dos
 * factores iguales se escriban distinto. Lista editable: si falta uno, se elige
 * FACTOR_OTRO y se escribe. El sustento sigue siendo texto libre.
 *
 * La lista COMPLETA la fijan las bases estándar (R.D. N° 0001-2026-EF/54.01) por
 * objeto y modalidad (Art. 73.3) — esa resolución NO está en el corpus del RAG,
 * así que estos nombres siguen el catálogo estándar OECE, sin verificación
 * verbatim. La DEC elige de aquí los aplicables a su objeto.
 */
export const OPCIONES_FACTOR_EVALUACION = [
  "Precio",
  "Plazo de entrega o ejecución de la prestación",
  "Garantía comercial del postor",
  "Disponibilidad de servicios y repuestos",
  "Mantenimiento preventivo",
  "Capacitación del personal de la Entidad",
  "Mejora en las EE.TT.",
  "Sostenibilidad ambiental",
  "Sostenibilidad social",
  "Experiencia del postor",
  "Experiencia y calificaciones del personal clave",
  "Metodología o plan de trabajo",
  "Cumplimiento de la prestación",
  "Integridad en la contratación pública",
] as const;

/** Valor del desplegable para escribir un factor no listado. */
export const FACTOR_OTRO = "Otro (especificar)";

/**
 * g) Sustento RECOMENDADO por factor: plantilla de partida, EDITABLE.
 *
 * No es texto verbatim de la ley: los factores y sus criterios los fijan las
 * BASES ESTÁNDAR por objeto y modalidad (Art. 73.3), no la Ley ni el Reglamento.
 * Es una redacción base que la DEC ajusta. Solo el del Precio se apoya en artículo
 * (Art. 74/75); el resto invoca el principio de valor por dinero (Art. 73.2).
 */
export const SUSTENTO_FACTOR_SUGERIDO: Readonly<Record<string, string>> = {
  Precio:
    "La oferta económica es factor de evaluación (Art. 74.1). El mayor puntaje se otorga al menor monto ofertado y a las demás de forma inversamente proporcional (Art. 74.2), con un tope de cuarenta (40) puntos sobre el total (Art. 75.1).",
  "Plazo de entrega o ejecución de la prestación":
    "El plazo de entrega constituye un factor relevante para asegurar la atención oportuna de la necesidad institucional. Su determinación debe sustentarse en criterios técnicos y objetivos, vinculados a la naturaleza, complejidad y condiciones del mercado del bien o servicio a contratar.",
  "Garantía comercial del postor":
    "Se evaluará en función al tiempo de garantía comercial ofertada, el cual debe superar el tiempo mínimo de garantía exigido en el requerimiento.",
  "Disponibilidad de servicios y repuestos":
    "Se valora la disponibilidad acreditada de servicios de posventa y de repuestos, que asegura la continuidad operativa del bien contratado.",
  "Mantenimiento preventivo":
    "Se valora la oferta de mantenimiento preventivo del bien durante su vida útil, que asegura su continuidad operativa y reduce el costo total para la entidad (principio de valor por dinero, Art. 73.2).",
  "Capacitación del personal de la Entidad":
    "Se valora la capacitación ofrecida al personal de la entidad para la correcta operación y aprovechamiento de la prestación.",
  // Verbatim del formato OECE, erratas incluidas ("minino",
  // "caracterisitcas", "establecidadas"): la DEC pidió que salga tal cual.
  "Mejora en las EE.TT.":
    "se evaluara una mejora, todo aquello que agregue un valor adicional al parametro minino exigido en la EE.TT.y caracterisitcas de calidad establecidadas en el requerimiento",
  "Sostenibilidad ambiental":
    "Se valoran características o certificaciones ambientales de la prestación, en línea con el principio de valor por dinero y criterios de sostenibilidad (Art. 73.2).",
  "Sostenibilidad social":
    "Se valoran compromisos de responsabilidad social de la prestación (empleo local, inclusión, condiciones laborales dignas), en línea con el principio de valor por dinero (Art. 73.2).",
  "Experiencia del postor":
    "Se valora la experiencia del postor en contrataciones iguales o similares al objeto, como indicador de su capacidad para ejecutar la prestación.",
  "Experiencia y calificaciones del personal clave":
    "Se valora la experiencia y calificación del personal clave propuesto, determinante en servicios y consultorías para la calidad del resultado.",
  "Metodología o plan de trabajo":
    "Se valora la solidez y pertinencia de la metodología o plan de trabajo propuesto para alcanzar los objetivos de la contratación.",
  "Cumplimiento de la prestación":
    "Se valora el buen cumplimiento del postor en contratos anteriores, acreditado con constancias de prestación o conformidades.",
  "Integridad en la contratación pública":
    "Se valora que el postor acredite un sistema de gestión antisoborno (p. ej. certificación ISO 37001) u otras medidas de integridad, por reducir el riesgo de corrupción en la ejecución del contrato (principio de valor por dinero, Art. 73.2).",
};

/**
 * Sustento a precargar al ELEGIR un factor en g). Devuelve el recomendado del
 * factor cuando el sustento actual está VACÍO o es OTRA plantilla (venía de un
 * factor anterior, sin editar) — para que CAMBIAR de factor traiga el suyo. Si la
 * DEC escribió algo propio (no coincide con ninguna plantilla), devuelve null: se
 * respeta lo escrito. Sin recomendado (factor libre), también null.
 */
export function sustentoAlElegirFactor(factor: string, actual: string): string | null {
  const sugerido = SUSTENTO_FACTOR_SUGERIDO[factor];
  if (!sugerido) return null;
  const a = actual.trim();
  const esOtraPlantilla = a !== "" && (Object.values(SUSTENTO_FACTOR_SUGERIDO) as string[]).includes(a);
  return !a || esOtraPlantilla ? sugerido : null;
}

/** Normaliza un nombre de factor para compararlo: sin mayúsculas, tildes ni espacios de sobra. */
function normalizarNombreFactor(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Resuelve un nombre de factor ESCRITO A MANO (modo "Otro") a la clave canónica
 * del catálogo, sin distinguir mayúsculas, tildes ni espacios de sobra. Así,
 * teclear "mejora en las ee.tt." reconoce el factor igual que elegirlo del
 * desplegable y su sustento oficial puede precargarse. Devuelve null si el nombre
 * no coincide con ningún factor con sustento sugerido.
 */
export function factorCanonicoDeNombre(nombre: string): string | null {
  const objetivo = normalizarNombreFactor(nombre);
  if (!objetivo) return null;
  return Object.keys(SUSTENTO_FACTOR_SUGERIDO).find((clave) => normalizarNombreFactor(clave) === objetivo) ?? null;
}

/**
 * g) Factores que ofrece el menú según el procedimiento elegido en a).
 *
 * La lista concreta (obligatorios/facultativos) la fijan las BASES ESTÁNDAR por
 * objeto y modalidad (Art. 73.3). Lo que el Reglamento SÍ fundamenta: en la
 * SUBASTA INVERSA ELECTRÓNICA y la COMPARACIÓN DE PRECIOS la buena pro se otorga
 * por MENOR MONTO (Art. 74.3), sin factores técnicos que ponderar → lista vacía.
 * Para el resto se ofrece el catálogo habitual y la DEC elige los aplicables.
 */
export function factoresDeProcedimiento(procedimiento: string | null | undefined): readonly string[] {
  if (procedimiento === "subasta_inversa_electronica" || procedimiento === "comparacion_precios") {
    return [];
  }
  return OPCIONES_FACTOR_EVALUACION;
}

/** j) Un punto no negociable del requerimiento y su sustento (Art. 46.1.j). */
export type PuntoNoNegociable = { punto?: string; sustento?: string };

/**
 * j) Valor por defecto del punto no negociable. Los puntos no negociables solo
 * aplican en procedimientos con subetapa de NEGOCIACIÓN o diálogo competitivo
 * (Art. 46.1.j); en la gran mayoría de casos no hay, así que el desplegable
 * arranca en "NO CORRESPONDE" y su sustento se fija igual. Para especificar puntos
 * reales se elige "Otro (especificar)".
 */
export const PUNTO_NO_CORRESPONDE = "NO CORRESPONDE";

/** j) Opciones fijas del desplegable de punto no negociable ("Otro" se maneja aparte, como en los factores). */
export const OPCIONES_PUNTO_NO_NEGOCIABLE = [PUNTO_NO_CORRESPONDE] as const;

/**
 * Sustento a fijar al ELEGIR un punto del desplegable. Si es "NO CORRESPONDE", el
 * sustento también es "NO CORRESPONDE". Para un punto real ("Otro") no hay
 * plantilla —lo redacta la DEC—, así que devuelve null y no toca el sustento.
 */
export function sustentoAlElegirPunto(punto: string): string | null {
  return punto === PUNTO_NO_CORRESPONDE ? PUNTO_NO_CORRESPONDE : null;
}

/**
 * f) Requisitos de calificación (Art. 46.1.f) y g) factores: filas de la
 * plantilla.
 *
 * El formato los pide fila a fila (nombre y, en los facultativos y los
 * factores, su sustento). Volcar el bloque entero en la primera celda —que es
 * lo que hacía— destruye una estructura que el editor de A4 ya tenía.
 */
export const FILAS_REQUISITOS = {
  /** B44, B45: nombre del requisito obligatorio. */
  obligatorios: { desde: 44, cuantas: 2, colNombre: "B" },
  /** B49:C51: nombre + sustento del requisito facultativo. */
  facultativos: { desde: 49, cuantas: 3, colNombre: "B", colSustento: "C" },
} as const;

/** g) B56:C58: nombre + sustento del factor de evaluación. */
export const FILAS_FACTORES = { desde: 56, cuantas: 3, colNombre: "B", colSustento: "C" } as const;

/**
 * a) Procedimientos de selección COMPETITIVOS (Art. 54 de la Ley 32069).
 *
 * Literal del 54.1: "Son procedimientos de selección competitivos: a) La
 * licitación pública para la contratación de bienes y obras. b) El concurso
 * público para la contratación de servicios."
 *
 * El 54.2 añade sus MODALIDADES ABREVIADAS y las DIFERENCIADAS (subasta inversa
 * electrónica, comparación de precios, compra pública de innovación), que el
 * Reglamento desarrolla — los cinco nombres están verificados en su texto.
 *
 * Ojo: NO es la lista de `PROCESS_TYPES` (lib/legal-taxonomy.ts), que sigue
 * siendo la de la Ley 30225 y trae figuras derogadas ("adjudicación
 * simplificada", "contratación directa"). Aquí manda la 32069, que es la que se
 * imprime en el formato.
 */
export const PROCEDIMIENTOS_COMPETITIVOS = [
  { value: "licitacion_publica", label: "Licitación pública", objeto: "bienes y obras" },
  { value: "licitacion_publica_abreviada", label: "Licitación pública abreviada", objeto: "bienes y obras" },
  { value: "concurso_publico", label: "Concurso público", objeto: "servicios" },
  { value: "concurso_publico_abreviado", label: "Concurso público abreviado", objeto: "servicios" },
  { value: "subasta_inversa_electronica", label: "Subasta inversa electrónica", objeto: "modalidad diferenciada" },
  { value: "comparacion_precios", label: "Comparación de precios", objeto: "modalidad diferenciada" },
  { value: "compra_publica_innovacion", label: "Compra pública de innovación", objeto: "modalidad diferenciada" },
] as const;

/** Etiqueta del procedimiento competitivo, en mayúsculas como el formato. */
export function labelProcedimiento(value: string): string | null {
  return PROCEDIMIENTOS_COMPETITIVOS.find((p) => p.value === value)?.label ?? null;
}

// Palabras que van en minúscula dentro del nombre de un procedimiento (salvo que
// abran la cadena): los conectores y EL OBJETO de la contratación —bienes, obras,
// servicios, consultorías—, que por convención se escribe en minúscula ("para
// bienes", "de obras"). El resto de palabras llevan inicial mayúscula.
const MINUSCULAS_PROCESO = new Set([
  // conectores
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "a",
  "para", "con", "por", "en", "al", "un", "una",
  // objeto de la contratación
  "bien", "bienes", "obra", "obras", "servicio", "servicios",
  "consultoria", "consultorias", "consultoría", "consultorías",
]);

/**
 * Normaliza la capitalización de un nombre de procedimiento para IMPRIMIRLO: el
 * catálogo lo guarda como "Licitación Pública abreviada para bienes" (así se
 * compara y se enlaza a su PDF-modelo), pero en el documento debe leerse con
 * inicial mayúscula en cada palabra significativa —"Licitación Pública Abreviada
 * para bienes"—, dejando en minúscula los conectores y el objeto (bienes, obras,
 * servicios). Solo cambia lo que se ve.
 */
export function capitalizarProceso(texto: string | null | undefined): string {
  const t = (texto ?? "").trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((palabra, i) => {
      const lower = palabra.toLowerCase();
      if (i > 0 && MINUSCULAS_PROCESO.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Procedimiento competitivo GENÉRICO (uno de los 7 del Art. 54) que corresponde a
 * un proceso de la ficha (los 21 de los Arts. 93/94/95, guardados como label:
 * "Licitación Pública abreviada de obras"). El label ya encierra el objeto
 * (Licitación = bienes/obras, Concurso = servicios) y la modalidad (abreviada).
 *
 * Se usa para DERIVAR el valor interno con el que trabajan el cronograma, los
 * plazos del Art. 64, la comparación con el PAC y el resto de la lógica —que
 * siguen indexados por los 7 genéricos—, mientras el campo a) muestra el proceso
 * específico de la ficha. Devuelve null si no hay competitivo (no competitivo, o
 * proceso sin definir).
 */
export function procedimientoGenerico(proceso: string | null | undefined): string | null {
  const v = (proceso ?? "").trim();
  if (!v) return null;
  // Ya es uno de los 7 genéricos (dato antiguo): se devuelve tal cual.
  if (PROCEDIMIENTOS_COMPETITIVOS.some((p) => p.value === v)) return v;
  if (/no\s+competitiv/i.test(v)) return null;
  if (/subasta\s+inversa/i.test(v)) return "subasta_inversa_electronica";
  if (/comparaci[óo]n\s+de\s+precios/i.test(v)) return "comparacion_precios";
  if (/innovaci[óo]n|precomercial/i.test(v)) return "compra_publica_innovacion";
  const abreviada = /abreviad/i.test(v);
  if (/licitaci[óo]n/i.test(v)) return abreviada ? "licitacion_publica_abreviada" : "licitacion_publica";
  if (/concurso/i.test(v)) return abreviada ? "concurso_publico_abreviado" : "concurso_publico";
  return null;
}

/**
 * Clave heredada: a) fue un único campo `var_a_tipo_procedimiento` antes de
 * separarse en el TIPO (`var_a_procedimiento`, un select) y el NÚMERO
 * (`var_a_nomenclatura`). Al renombrarlo, lo que ya estaba escrito se quedó
 * huérfano en el jsonb, invisible para el formulario y para el exportador — y lo
 * que había escrito la gente eran nomenclaturas ("04-2026-DEC-MDCH-1").
 */
const VAR_A_NOMENCLATURA_LEGACY = "var_a_tipo_procedimiento";

/**
 * Nomenclatura del procedimiento registrada en A4, recuperando el valor heredado
 * si el campo nuevo aún está vacío.
 */
export function nomenclaturaDeA4(a4: Record<string, unknown> | null | undefined): string | null {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return texto(a4?.var_a_nomenclatura) ?? texto(a4?.[VAR_A_NOMENCLATURA_LEGACY]);
}

/**
 * Nomenclatura que imprime el formato: la de A4 y, si no hay, la del expediente.
 *
 * El respaldo tiene una trampa: `nomenclature` unas veces trae una nomenclatura
 * de verdad ("CP N° 001-2026") y otras el TÍTULO de la necesidad que lo originó
 * ("REQ-2026-0004 — ADQUISICIÓN DE SERVIDOR PARA EL SISTEMA…"), porque así lo
 * arma la derivación. Lo segundo salía impreso como si fuera el número del
 * procedimiento.
 *
 * No se adivina por la pinta del texto: si el nombre del expediente contiene el
 * de la necesidad, es el título — y eso es un hecho, no una heurística.
 */
export function nomenclaturaDelFormato(
  a4: Record<string, unknown> | null | undefined,
  nomenclatureExpediente: string | null | undefined,
  nombreNecesidad?: string | null,
): string | null {
  const deA4 = nomenclaturaDeA4(a4);
  if (deA4) return deA4;
  const respaldo = (nomenclatureExpediente ?? "").trim();
  if (!respaldo) return null;
  const titulo = (nombreNecesidad ?? "").trim();
  if (titulo && respaldo.toUpperCase().includes(titulo.toUpperCase())) return null;
  return respaldo;
}

/**
 * Antepone "N° " a la nomenclatura para imprimirla (p. ej. "LICITACIÓN … N°
 * 44-DEC-MDCH-1"). La de A4 se registra como "solo el número" ("44-DEC-MDCH-1"),
 * así que el formato pone el "N°"; si ya lo trae —el respaldo del expediente suele
 * venir como "CP N° 001-2026"— no se duplica.
 */
export function nomenclaturaConNumero(nomenclatura: string | null | undefined): string {
  const n = (nomenclatura ?? "").trim();
  if (!n) return "";
  return /[nN][°º]/.test(n) ? n : `N° ${n}`;
}

/**
 * Clave con la que se compara un procedimiento para decidir si la estrategia
 * modifica el del PAC: la base genérica (`procedimientoGenerico`, que colapsa el
 * OBJETO —bienes/obras— y ya distingue "abreviada") MÁS un sufijo de SUBMODALIDAD
 * (con precalificación, diálogo competitivo, con negociación, MDA).
 *
 * Así, un cambio de submodalidad entre lo programado (A1) y lo determinado (A4)
 * cuenta como cambio —"Licitación pública" → "…con precalificación" da SÍ—, pero
 * un cambio de objeto (que no ocurre dentro de una misma necesidad) no. Para un
 * texto no reconocido o no competitivo, cae al texto normalizado, conservando la
 * comparación literal previa.
 */
export function claveProcedimientoPac(proceso: string | null | undefined): string {
  const raw = (proceso ?? "").trim();
  if (!raw) return "";
  const v = raw.toLowerCase();
  const base = procedimientoGenerico(raw) ?? v;
  let submod = "";
  if (/precalificaci/.test(v)) submod = ":precalificacion";
  else if (/di[áa]logo\s+competitivo/.test(v)) submod = ":dialogo_competitivo";
  else if (/negociaci/.test(v)) submod = ":negociacion";
  else if (/\bmda\b|mecanismos?\s+diferenciados/.test(v)) submod = ":mda";
  return base + submod;
}

/**
 * a) ¿La estrategia modifica el procedimiento registrado en el PAC?
 *
 * No es una pregunta que deba responder nadie a mano: es la comparación entre
 * el procedimiento PROGRAMADO (A1, un hecho del PAC) y el que la DEC DETERMINA
 * en la estrategia (A4, Art. 46.1.a). Pedirla suelta invitaba a que alguien
 * marcara "NO" con dos procedimientos distintos delante.
 *
 * La comparación es por `claveProcedimientoPac`, no por igualdad de texto: capta
 * el cambio de tipo Y de submodalidad, e ignora el objeto y el formato. Un
 * expediente antiguo cuyo `procedimiento_pac` se guardó como genérico y cuya
 * ficha trae submodalidad marcará SÍ (dirección segura: señala para revisión).
 *
 * Devuelve null cuando falta cualquiera de los dos: sin los dos datos no se
 * puede afirmar ni que se modifica ni que no.
 */
export function modificaProcedimientoDelPac(
  procedimientoPac: string | null | undefined,
  procedimientoEstrategia: string | null | undefined,
  /** ¿La contratación está incluida en el PAC? (A1 · `en_pac`) */
  enPac = true,
): boolean | null {
  // Una contratación NO PROGRAMADA no está en el PAC, así que no hay ningún
  // procedimiento registrado allí: no se puede modificar lo que no existe. La
  // respuesta es NO, y exigir un `procedimiento_pac` que por definición no hay
  // dejaba la casilla en blanco para siempre.
  if (!enPac) return false;

  const pac = procedimientoPac?.trim();
  const estrategia = procedimientoEstrategia?.trim();
  if (!pac || !estrategia) return null;
  return claveProcedimientoPac(pac) !== claveProcedimientoPac(estrategia);
}

/** d) Opciones de modalidad eficiente, alineadas con CELDA_MODALIDAD_EFICIENTE. */
export const OPCIONES_MODALIDAD_EFICIENTE = [
  { value: "compra_encargo", label: "Compra por encargo" },
  { value: "compra_corporativa", label: "Compra corporativa" },
  { value: "compra_centralizada", label: "Compra centralizada" },
  { value: "acuerdos_marco", label: "Acuerdos marco (sujeto a directiva DGA)" },
  { value: "compra_innovacion", label: "Compra pública de innovación (implementación progresiva)" },
];

/** q) Opciones de agrupación, alineadas con CELDA_AGRUPAR. */
export const OPCIONES_AGRUPACION = [
  { value: "paquete", label: "Contratación por paquete" },
  { value: "items", label: "Procedimiento según relación de ítems" },
  { value: "lotes", label: "Procedimiento según relación de lotes" },
  { value: "tramos", label: "Procedimiento según relación de tramos" },
];

/**
 * t) Otras variables a analizar (Art. 46.1.t): checkbox de A4 → casilla.
 *
 * `formula_reajuste` no está aquí: se marca sola desde la ficha (la declara el
 * área usuaria en el requerimiento, no la DEC).
 */
export const OTRAS_VARIABLES_CAMPOS: ReadonlyArray<{ campo: string; celda: string; label: string; ayuda: string }> = [
  { campo: "otra_var_jprd", celda: "F172", label: "Determinación de la JPRD como medio de solución de controversias", ayuda: "La Junta de Resolución de Disputas resuelve controversias durante la ejecución (típica en obras de alta complejidad). Márcala si se prevé usarla." },
  { campo: "otra_var_documentos_perfeccionamiento", celda: "F173", label: "Documentos adicionales para el perfeccionamiento del contrato", ayuda: "Documentos extra que el ganador debe presentar para firmar el contrato, además de los del Reglamento." },
  { campo: "otra_var_subcontratacion", celda: "J173", label: "Posibilidad de subcontratación", ayuda: "Márcala si se permitirá subcontratar parte de la prestación; el porcentaje máximo se fija en las bases." },
  { campo: "otra_var_otras_penalidades", celda: "F174", label: "Necesidad de establecer “Otras penalidades”", ayuda: "Penalidades distintas a la mora, por incumplimientos específicos del objeto, con su fórmula de cálculo." },
  { campo: "otra_var_resolucion_anticipada", celda: "J174", label: "Causal de resolución por terminación anticipada", ayuda: "Prevé una causal de resolución por terminación anticipada del contrato." },
  { campo: "otra_var_documentacion_admision", celda: "F177", label: "Documentación adicional en la admisión de ofertas", ayuda: "Documentos exigibles al admitir las ofertas, más allá de los mínimos del procedimiento." },
  { campo: "otra_var_muestras", celda: "J177", label: "Presentación excepcional de muestras (bienes)", ayuda: "Solo bienes: exigir muestras físicas de forma excepcional y sustentada." },
];

/**
 * l) Tabla de adelantos (Art. 46.1.l): tres filas fijas del formato.
 *
 * Los adelantos para materiales y por avance solo se usan en obras (nota (*)
 * de la plantilla).
 */
export const ADELANTOS_FILAS: ReadonlyArray<{
  prefijo: string;
  label: string;
  marcar: string;
  mecanismo: string;
  porcentaje: string;
  soloObras: boolean;
}> = [
  { prefijo: "adelanto_directo", label: "Adelanto directo", marcar: "D108", mecanismo: "E108", porcentaje: "I108", soloObras: false },
  { prefijo: "adelanto_materiales", label: "Adelanto para materiales, insumos, equipamiento y mobiliario", marcar: "D109", mecanismo: "E109", porcentaje: "I109", soloObras: true },
  { prefijo: "adelanto_avance", label: "Adelanto por avance", marcar: "D110", mecanismo: "E110", porcentaje: "I110", soloObras: true },
];

/** Una fila de la tabla de adelantos, alineada a ADELANTOS_FILAS por `prefijo`. */
export type AdelantoFila = { prefijo?: string; marcar?: boolean; mecanismo?: string; pct?: string };

/** Lee la tabla de adelantos (campo `adelantos_items`) como array de filas. */
export function leerAdelantos(value: unknown): AdelantoFila[] {
  return leerFilas<AdelantoFila>(value);
}

/**
 * Sustento de la aplicación de adelantos (celda B112 del formato) DERIVADO de la
 * tabla: lista cada adelanto marcado con su mecanismo de garantía y porcentaje.
 * Devuelve "" si no hay ninguno marcado, para que el exportador caiga al respaldo
 * (la propuesta del área usuaria) o a "NO CORRESPONDE".
 */
export function sustentoAdelantos(value: unknown, esObras = true): string {
  const filas = leerAdelantos(value).filter((r) => {
    if (!r.marcar) return false;
    // Los adelantos "solo obras" no cuentan fuera de obras (coherente con el volcado).
    const fila = ADELANTOS_FILAS.find((f) => f.prefijo === r.prefijo);
    return !(fila?.soloObras && !esObras);
  });
  if (filas.length === 0) return "";
  return filas
    .map((r) => {
      const fila = ADELANTOS_FILAS.find((f) => f.prefijo === r.prefijo);
      const label = fila?.label ?? "Adelanto";
      const partes = [(r.mecanismo ?? "").trim(), (r.pct ?? "").trim()].filter(Boolean);
      return partes.length > 0 ? `${label}: ${partes.join(", ")}.` : `${label}.`;
    })
    .join(" ");
}

/**
 * Etiquetas de las casillas nuevas (d, q, t, l), DERIVADAS de sus mapas para
 * que no exista una tercera lista que mantener. Va aparte de
 * ETIQUETAS_ESTRATEGIA solo porque estas constantes se declaran después.
 */
export const ETIQUETAS_EXTRA: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    OPCIONES_MODALIDAD_EFICIENTE.map((o) => [CELDA_MODALIDAD_EFICIENTE[o.value], `d) Modalidad eficiente: ${o.label}`]),
  ),
  ...Object.fromEntries(OPCIONES_AGRUPACION.map((o) => [CELDA_AGRUPAR[o.value], `q) Agrupación: ${o.label}`])),
  ...Object.fromEntries(OTRAS_VARIABLES_CAMPOS.map((v) => [v.celda, `t) ${v.label}`])),
  ...Object.fromEntries(ADELANTOS_FILAS.map((f) => [f.marcar, `l) ${f.label}`])),
};
