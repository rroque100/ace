// Qué pasos de las tres fases corresponden a ESTE expediente, según el tipo de
// objeto y el tipo de procedimiento de selección declarados en la ficha.
//
// ── Por qué existe ────────────────────────────────────────────────────────────
//
// El Art. 62.1 del Reglamento lo dice sin rodeos: los procedimientos de selección
// "PUEDEN CONTENER las siguientes etapas y subetapas, DEPENDIENDO DE SU TIPO,
// OBJETO Y MODALIDAD". No hay una secuencia única. Pedir las 26 casillas a todo
// el mundo obliga al usuario a decidir paso por paso si le toca, que es
// exactamente lo que el articulado ya respondió.
//
// El propio Reglamento está ORGANIZADO por objeto, lo que confirma el eje:
//   · Título III  (Arts. 41-124)  — disposiciones generales a bienes, servicios y obras
//   · Título IV   (Arts. 125-152) — proceso de contratación de BIENES Y SERVICIOS
//   · Título V    (Arts. 153-224) — proceso de contratación de OBRAS Y CONSULTORÍA DE OBRAS
//   · Título VI   (Arts. 226+)    — contratos menores y demás modalidades
//
// ── Qué NO se puede fundamentar ───────────────────────────────────────────────
//
// La tabla de etapas por modalidad no está en la norma publicada: los Arts. 93,
// 94 y 95 (licitación pública, concurso público, otras modalidades diferenciadas)
// remiten a un "Enlace Web (PDF)" que no forma parte del texto del Reglamento. Por
// eso aquí SOLO hay reglas con artículo literal detrás, y todo lo que se apoya en
// que un artículo no menciona una etapa se marca FACULTATIVO, nunca "no aplica":
// del silencio de la norma no se deduce una prohibición.
//
// ── Regla de la casa ──────────────────────────────────────────────────────────
//
// Nada de esto BLOQUEA. El tipo de proceso de la ficha es una referencia del área
// usuaria que la DEC confirma en la estrategia (Art. 46.1.a), así que un dato mal
// puesto no puede dejar un expediente sin salida. Se informa y se deja pasar.

import { PROCESO_NO_COMPETITIVO } from "./procesos-seleccion";

/** Objeto contractual en el vocabulario de A3 (singular). */
export type ObjetoContractual = "bien" | "servicio" | "obra" | "consultoria_obra";

export type EstadoAplicabilidad = "aplica" | "no_aplica" | "facultativo";

export type Aplicabilidad = {
  estado: EstadoAplicabilidad;
  /** Explicación con la cita literal que la sostiene. Vacío cuando aplica sin más. */
  motivo?: string;
  /** Advertencia sobre CÓMO se hace el paso en este procedimiento, aunque sí aplique. */
  nota?: string;
};

const APLICA: Aplicabilidad = { estado: "aplica" };

export type ContextoExpediente = {
  /** `objeto_contractual` de A3, o el `tipo_objeto` de la ficha ya normalizado. */
  objeto?: string | null;
  /** `tipo_proceso_seleccion` de la ficha (valor del catálogo PROCESOS_SELECCION). */
  tipoProceso?: string | null;
  /** `procedure_type` del expediente: los contratos menores tienen reglas propias. */
  contratoMenor?: boolean;
  /** La contratación se realiza por catálogos electrónicos de acuerdo marco (CEAM). */
  acuerdoMarco?: boolean;
  /** Causal del Art. 55 registrada en A1: la acreditación real del régimen. */
  causalArt55?: string | null;
};

/**
 * ¿La contratación se realiza por catálogos electrónicos de acuerdo marco (CEAM)?
 *
 * La Guía de Actuaciones Preparatorias no segmenta ni hace interacción con el
 * mercado en el CEAM, así que hay que reconocerlo. Llega por dos vías: el
 * `procedure_type` del expediente (código `acuerdo_marco` del catálogo de
 * Configuración) o el texto del procedimiento declarado en la ficha, que puede
 * traerlo con variantes de redacción. Se normaliza (sin tildes, en minúsculas)
 * para que cualquiera de las dos funcione.
 */
export function esAcuerdoMarco(
  procedureType?: string | null,
  tipoProceso?: string | null,
): boolean {
  const texto = `${procedureType ?? ""} ${tipoProceso ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    texto.includes("acuerdo marco") ||
    texto.includes("acuerdo_marco") ||
    texto.includes("catalogo electronico")
  );
}

/**
 * Familia del procedimiento, que es lo que la norma trata de forma distinta.
 *
 * "abreviada" no es una familia aparte en cuanto a etapas —sigue siendo
 * licitación o concurso— pero sí cambia plazos (Art. 64.1), así que se distingue.
 */
export type FamiliaProcedimiento =
  | "no_competitivo"
  | "comparacion_precios"
  | "subasta_inversa"
  | "abreviada"
  | "ordinaria"
  | "indefinida";

export function familiaProcedimiento(
  tipoProceso: string | null | undefined,
  causalArt55?: string | null,
): FamiliaProcedimiento {
  // La causal del Art. 55 acreditada en A1 manda sobre lo que anticipó la ficha:
  // es el documento que sustenta el régimen (Art. 54.3 + 55.1).
  if (typeof causalArt55 === "string" && causalArt55.trim()) return "no_competitivo";
  const v = (tipoProceso ?? "").trim();
  if (!v) return "indefinida";
  if (v === PROCESO_NO_COMPETITIVO) return "no_competitivo";
  if (/comparaci[óo]n de precios/i.test(v)) return "comparacion_precios";
  if (/subasta inversa/i.test(v)) return "subasta_inversa";
  if (/abreviad/i.test(v)) return "abreviada";
  return "ordinaria";
}

// ─── Procedimientos de selección NO COMPETITIVOS (Arts. 100-103) ──────────────
//
// El Art. 101.2 recorta la fase de selección a dos actos: "la fase de selección
// […] CONSISTE ÚNICAMENTE en la invitación al proveedor identificado, adjuntando
// las bases […] y la presentación de las ofertas técnica y económica por parte de
// este. En los procedimientos de selección no competitivos NO SE DESIGNAN
// EVALUADORES NI HAY EVALUACIÓN TÉCNICA NI ECONÓMICA DE OFERTAS."
//
// De ahí que caigan el registro de participantes, los cuestionamientos a las
// bases, la evaluación y la buena pro: no es que se omitan, es que la norma pone
// otra cosa en su lugar (la aprobación del Art. 102).
const NO_COMPETITIVO: Record<string, Aplicabilidad> = {
  A2: {
    estado: "no_aplica",
    motivo:
      "Art. 101.1 del Reglamento: «No corresponde realizar la segmentación de contrataciones».",
  },
  // OJO: aquí la norma tiene dos textos vivos y no dicen lo mismo.
  //
  //   · Texto original del 101.1: las actuaciones preparatorias se aplican
  //     "CON EXCEPCIÓN DE LA INTERACCIÓN CON EL MERCADO" → A5 no correspondía.
  //   · Texto sustituido por el D.S. 001-2026-EF: esa excepción DESAPARECE y en
  //     su lugar dice que "durante la estrategia de contratación, la DEC
  //     identifica al proveedor […] PUDIENDO APLICAR EL ARTÍCULO 47, SEGÚN LO
  //     CONSIDERE NECESARIO" —el Art. 47 es justamente la interacción con el
  //     mercado—, o sea que pasa de excluida a facultativa.
  //
  // La modificación entra en vigor recién al publicarse la R.D. que modifica las
  // bases estándar, dato que la aplicación no tiene. Por eso FACULTATIVO: es el
  // único estado compatible con los dos textos. Decir "no aplica" sería negar una
  // actuación que el texto vigente puede estar permitiendo.
  A5: {
    estado: "facultativo",
    motivo:
      "El texto original del Art. 101.1 excluye la interacción con el mercado en los procedimientos no competitivos. El texto sustituido por el D.S. 001-2026-EF suprime esa excepción y la vuelve facultativa: la DEC puede aplicar el Art. 47 «según lo considere necesario». Decide según qué texto esté vigente y deja constancia en el expediente.",
  },
  A6: {
    estado: "no_aplica",
    motivo:
      "Art. 101.2 del Reglamento: «En los procedimientos de selección no competitivos no se designan evaluadores».",
  },
  A9: {
    estado: "aplica",
    nota:
      "Las bases son las del formato de procedimientos no competitivos aprobado por la DGA, no las bases estándar competitivas (Art. 101.2).",
  },
  B1: {
    estado: "aplica",
    nota:
      "No hay convocatoria pública: la fase de selección es la invitación al proveedor ya identificado en la estrategia (Art. 101.2).",
  },
  B2: {
    estado: "no_aplica",
    motivo:
      "Art. 101.2: la fase de selección «consiste únicamente en la invitación al proveedor identificado […] y la presentación de las ofertas», sin registro abierto de participantes.",
  },
  B3: {
    estado: "no_aplica",
    motivo: "Art. 101.2: no hay etapa de cuestionamientos a las bases; solo invitación y oferta.",
  },
  B4: {
    estado: "no_aplica",
    motivo: "Art. 101.2: sin consultas ni observaciones no hay pliego absolutorio ni integración.",
  },
  B6: {
    estado: "no_aplica",
    motivo:
      "Art. 101.2 del Reglamento: «no hay evaluación técnica ni económica de ofertas». La DEC selecciona al proveedor según la causal invocada.",
  },
  B7: {
    estado: "no_aplica",
    motivo:
      "No hay buena pro: su lugar lo ocupa la aprobación del procedimiento no competitivo por resolución (Arts. 101.3 y 102), con informes técnico y legal obligatorios (Art. 102.3).",
  },
  B8: {
    estado: "no_aplica",
    motivo:
      "Art. 102.4: aprobado el procedimiento, la DEC comunica al proveedor y se pasa directamente al perfeccionamiento del contrato (Art. 88 y siguientes), sin plazo de consentimiento.",
  },
  C5: {
    estado: "aplica",
    nota:
      "Art. 103: no procede la aprobación de contrataciones complementarias, y en las causales b) y c) del Art. 55.1 tampoco los adicionales.",
  },
};

// ─── Comparación de precios (Arts. 97-99) ────────────────────────────────────
//
// Los Arts. 97 y 98 describen el procedimiento completo —convocatoria en la
// Pladicop con invitación a un mínimo de tres proveedores, evaluación económica y
// buena pro publicada por el oficial de compra— y no contemplan cuestionamientos
// a las bases. El Art. 64.1 confirma que existen procedimientos "que no contemplen
// etapas de consultas y observaciones".
//
// Aun así van como FACULTATIVO y no como "no aplica": lo que hay es un silencio
// del articulado, y la tabla de etapas por modalidad vive en el Enlace Web del
// Art. 95 que no está publicado en el Reglamento.
const COMPARACION_PRECIOS: Record<string, Aplicabilidad> = {
  B1: {
    estado: "aplica",
    nota:
      "Art. 97.2: además del registro en la Pladicop hay que invitar a un mínimo de tres proveedores, adjuntando las bases del formato aprobado por la DGA. El Art. 97.1 exige el informe de la DEC que sustente las condiciones para usar este procedimiento.",
  },
  B3: {
    estado: "facultativo",
    motivo:
      "Los Arts. 97 y 98 no contemplan consultas y observaciones para este procedimiento, y el Art. 64.1 reconoce procedimientos «que no contemplen etapas de consultas y observaciones». Verifica las bases estándar antes de darlo por omitido.",
  },
  B4: {
    estado: "facultativo",
    motivo: "Sin etapa de consultas y observaciones no hay pliego absolutorio ni integración (Arts. 97-98).",
  },
  B6: {
    estado: "aplica",
    nota:
      "Art. 98.1: el oficial de compra verifica los requisitos de calificación y luego evalúa SOLO la oferta económica —primer lugar al menor monto—. Se necesitan al menos dos ofertas que cumplan los requisitos; de lo contrario se declara desierto.",
  },
  B7: {
    estado: "aplica",
    nota:
      "Art. 98.2: la buena pro la otorga el oficial de compra publicándola en la Pladicop. En caso de empate, sorteo (Art. 98.3).",
  },
};

// ─── Subasta inversa electrónica (Art. 96) ───────────────────────────────────
const SUBASTA_INVERSA: Record<string, Aplicabilidad> = {
  A3: {
    estado: "aplica",
    nota:
      "Art. 96.2: no se pueden incluir requisitos de calificación adicionales o distintos a los de la ficha técnica, salvo que una normativa específica del objeto exija alguno.",
  },
  B6: {
    estado: "aplica",
    nota:
      "Art. 96.3: NO se realiza evaluación técnica de las ofertas, y los requisitos de calificación se revisan DESPUÉS de la evaluación económica. La buena pro va al menor precio por lances en línea (Art. 96.4).",
  },
};

// ─── Modalidades abreviadas ──────────────────────────────────────────────────
const ABREVIADA: Record<string, Aplicabilidad> = {
  B1: {
    estado: "aplica",
    nota:
      "Art. 64.1: el mínimo de veintidós días hábiles entre convocatoria y presentación de ofertas NO rige en las modalidades abreviadas. El plazo lo fijan las bases estándar.",
  },
};

// ─── Contratos menores (Título VI, Cap. I) ───────────────────────────────────
const CONTRATO_MENOR: Record<string, Aplicabilidad> = {
  A2: {
    estado: "no_aplica",
    motivo:
      "Art. 42.1: la segmentación clasifica las contrataciones del PAC del CMN «con excepción de aquellas que correspondan a contratos menores».",
  },
  A5: {
    estado: "no_aplica",
    motivo:
      "Guía de Actuaciones Preparatorias (R.D. 019-2026-EF/54.01): «No se realiza la interacción con el mercado en las siguientes contrataciones: Contratos Menores». El contrato menor no pasa por la consulta al mercado: el Art. 42.1 ya lo deja fuera de la segmentación y la Guía lo excluye de la interacción.",
  },
};

// ─── Catálogos electrónicos de acuerdo marco (CEAM) ──────────────────────────
//
// La Guía trata el CEAM igual que el contrato menor: no se segmenta y no se
// realiza interacción con el mercado. El Reglamento no lo regula paso a paso en
// la Fase 1 —es una modalidad de la Art. 55 de la Ley—, por eso el motivo cita
// la Guía, que es quien lo dice sin rodeos.
const ACUERDO_MARCO: Record<string, Aplicabilidad> = {
  A2: {
    estado: "no_aplica",
    motivo:
      "Guía de Actuaciones Preparatorias (R.D. 019-2026-EF/54.01): «No se segmentan las siguientes contrataciones: […] Catálogos electrónicos de acuerdo marco».",
  },
  A5: {
    estado: "no_aplica",
    motivo:
      "Guía de Actuaciones Preparatorias (R.D. 019-2026-EF/54.01): «No se realiza la interacción con el mercado en las siguientes contrataciones: Contratos Menores, Catálogos electrónicos de acuerdo marco». La compra por catálogo tiene precio y proveedor definidos en el acuerdo marco; la consulta al mercado no tiene objeto.",
  },
};

const POR_FAMILIA: Record<FamiliaProcedimiento, Record<string, Aplicabilidad>> = {
  no_competitivo: NO_COMPETITIVO,
  comparacion_precios: COMPARACION_PRECIOS,
  subasta_inversa: SUBASTA_INVERSA,
  abreviada: ABREVIADA,
  ordinaria: {},
  indefinida: {},
};

// ─── Eje por objeto ──────────────────────────────────────────────────────────
//
// La ejecución contractual está partida en dos títulos con reglas propias, así
// que el mismo paso se rige por artículos distintos según el objeto. No cambia si
// el paso corresponde —corresponde siempre—, sí cambia qué hay que hacer en él.
const NOTA_OBJETO: Record<string, Partial<Record<ObjetoContractual, string>>> = {
  C4: {
    obra:
      "Art. 176: el inicio del plazo de ejecución en obras está condicionado (entrega del terreno, expediente técnico, adelanto solicitado). El Art. 177 exige residente de obra.",
    consultoria_obra:
      "Art. 176: el inicio del plazo de ejecución en obras y consultoría de obras está sujeto a condiciones propias del Título V.",
  },
  C6: {
    bien: "Art. 144: recepción y conformidad de bienes y servicios, a cargo del área usuaria.",
    servicio: "Art. 144: recepción y conformidad de bienes y servicios, a cargo del área usuaria.",
    obra:
      "En obras no se aplica el Art. 144: la recepción sigue las reglas del Título V y desemboca en la liquidación del Art. 215.",
    consultoria_obra:
      "En consultoría de obras la recepción y la liquidación se rigen por el Título V (Art. 215), no por el Art. 144.",
  },
  C7: {
    obra:
      "Art. 210: en obras el pago va por valorizaciones periódicas, no por conformidad única. Los adelantos se amortizan conforme a los Arts. 178-181.",
    consultoria_obra: "Art. 211 y siguientes: valorización de la supervisión y de la consultoría de obra.",
  },
  C8: {
    obra: "Art. 215: liquidación de obras y consultorías de obra, con plazos y procedimiento propios.",
    consultoria_obra: "Art. 215: liquidación de obras y consultorías de obra.",
  },
};

function objetoValido(objeto: string | null | undefined): ObjetoContractual | null {
  const o = (objeto ?? "").trim();
  return o === "bien" || o === "servicio" || o === "obra" || o === "consultoria_obra" ? o : null;
}
/**
 * ¿Corresponde este paso, y con qué salvedad?
 *
 * El contrato menor y el CEAM se evalúan PRIMERO porque son modalidades del
 * Título VI y del Art. 55 de la Ley que conviven con cualquier objeto, y su
 * exclusión no depende de qué procedimiento se anticipó en la ficha.
 */
export function aplicabilidadHito(code: string, ctx: ContextoExpediente): Aplicabilidad {
  const familia = familiaProcedimiento(ctx.tipoProceso, ctx.causalArt55);
  const base =
    (ctx.contratoMenor ? CONTRATO_MENOR[code] : undefined) ??
    (ctx.acuerdoMarco ? ACUERDO_MARCO[code] : undefined) ??
    POR_FAMILIA[familia][code] ??
    APLICA;
  const objeto = objetoValido(ctx.objeto);
  const notaObjeto = objeto ? NOTA_OBJETO[code]?.[objeto] : undefined;
  if (!notaObjeto) return base;

  // Un paso que no corresponde no necesita instrucciones de cómo hacerlo.
  if (base.estado === "no_aplica") return base;
  return { ...base, nota: base.nota ? `${base.nota}\n\n${notaObjeto}` : notaObjeto };
}

/** Pasos que la norma descarta para este expediente, para resumirlos de una vez. */
export function pasosQueNoAplican(codes: string[], ctx: ContextoExpediente): string[] {
  return codes.filter((c) => aplicabilidadHito(c, ctx).estado === "no_aplica");
}

const NOMBRE_OBJETO: Record<ObjetoContractual, string> = {
  bien: "Bienes",
  consultoria_obra: "Consultoría de obra",
  obra: "Obra",
  servicio: "Servicios",
};

/**
 * Qué es este expediente, en una línea.
 *
 * Los pasos atenuados no se explican solos: quien los ve necesita saber que es
 * porque su expediente es un no competitivo, y ese dato vive en la ficha, a
 * varias pantallas de distancia. Devuelve "" cuando no hay nada que decir, para
 * no gastar espacio en un cartel vacío.
 */
export function perfilDelExpediente(ctx: ContextoExpediente): string {
  const partes: string[] = [];
  const objeto = objetoValido(ctx.objeto);
  if (objeto) partes.push(NOMBRE_OBJETO[objeto]);

  if (ctx.contratoMenor) {
    partes.push("contrato menor");
  } else if (ctx.acuerdoMarco) {
    partes.push("catálogo electrónico de acuerdo marco");
  } else if (typeof ctx.causalArt55 === "string" && ctx.causalArt55.trim()) {
    // La causal acreditada en A1 es más fuerte que la referencia de la ficha, y
    // decirlo así le enseña al usuario de dónde sale la clasificación.
    partes.push(`procedimiento no competitivo (causal ${ctx.causalArt55.trim()} del Art. 55.1)`);
  } else if ((ctx.tipoProceso ?? "").trim()) {
    partes.push((ctx.tipoProceso ?? "").trim());
  }

  if (partes.length === 0) return "";
  return `${partes.join(" · ")}.`;
}
