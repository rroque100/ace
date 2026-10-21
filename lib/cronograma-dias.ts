// Días ESTIMADOS del cronograma (o) del Art. 46.1.o), configurables POR
// PROCEDIMIENTO y año fiscal en Configuración. Son los plazos que el Reglamento NO
// fija: la duración de las actuaciones preparatorias y los pasos de la ejecución
// previos al contrato. La entidad los ajusta a su práctica y cada A4 arranca con los
// del procedimiento elegido en a).
//
// Lo que la LEY (o la directiva de la SIE) sí fija —el mínimo de 22 días hábiles
// convocatoria→ofertas (Art. 64.1), los 6 de la subasta inversa, las consultas
// (Art. 66.1), la integración→ofertas (Art. 68.1) y la apelación/consentimiento
// (Arts. 304/82.1)— se queda en código como PISO DURO y NO es editable. Las
// etapas/actividades de cada procedimiento tampoco se configuran (son los
// Arts. 93/94/95, anclados y verificados contra el RAG).

/** Días hábiles estimados —editables— de las actividades que la norma no fija. */
export type DiasCronograma = {
  /** Preparatorias · Aprobación del expediente de contratación. Defecto: 3. */
  aprobacionExpediente: number;
  /** Preparatorias · Elaboración de las bases del procedimiento. Defecto: 5. */
  elaboracionBases: number;
  /** Ejecución · Presentación de requisitos para la firma del contrato. Defecto: 8. */
  presentacionRequisitos: number;
  /** Ejecución · Suscripción del contrato. Defecto: 3. */
  suscripcionContrato: number;
};

/** Los mismos días para CADA procedimiento vigente. */
export type DiasCronogramaPorProcedimiento = Record<string, DiasCronograma>;

/** Días por defecto de un procedimiento (los que hoy están en código). */
export const DIAS_CRONOGRAMA_DEFAULT: DiasCronograma = {
  aprobacionExpediente: 3,
  elaboracionBases: 5,
  presentacionRequisitos: 8,
  suscripcionContrato: 3,
};

/** Los 7 procedimientos de selección VIGENTES (Ley 32069; Arts. 93/94/95). Cada uno
 *  tiene su fila en la rejilla de Configuración. Los `value` coinciden con los del
 *  select a) (`var_a_procedimiento`) y con las claves de plazos por procedimiento. */
export const PROCEDIMIENTOS_CRONOGRAMA = [
  "licitacion_publica",
  "licitacion_publica_abreviada",
  "concurso_publico",
  "concurso_publico_abreviado",
  "subasta_inversa_electronica",
  "comparacion_precios",
  "compra_publica_innovacion",
] as const;

/** Mapa por defecto: cada procedimiento arranca con los mismos días. */
export const DIAS_POR_PROCEDIMIENTO_DEFAULT: DiasCronogramaPorProcedimiento = Object.fromEntries(
  PROCEDIMIENTOS_CRONOGRAMA.map((p) => [p, { ...DIAS_CRONOGRAMA_DEFAULT }]),
);

const CAMPOS_DIAS: ReadonlyArray<keyof DiasCronograma> = [
  "aprobacionExpediente",
  "elaboracionBases",
  "presentacionRequisitos",
  "suscripcionContrato",
];

/** Entero positivo o el defecto (0/negativo/NaN se descartan: una actividad no dura cero). */
function entero(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
}

/** Un `DiasCronograma` saneado, cada campo cayendo al defecto si falta o es inválido. */
export function saneaDias(raw: unknown): DiasCronograma {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    aprobacionExpediente: entero(o.aprobacionExpediente, DIAS_CRONOGRAMA_DEFAULT.aprobacionExpediente),
    elaboracionBases: entero(o.elaboracionBases, DIAS_CRONOGRAMA_DEFAULT.elaboracionBases),
    presentacionRequisitos: entero(o.presentacionRequisitos, DIAS_CRONOGRAMA_DEFAULT.presentacionRequisitos),
    suscripcionContrato: entero(o.suscripcionContrato, DIAS_CRONOGRAMA_DEFAULT.suscripcionContrato),
  };
}

/**
 * Mapa por procedimiento saneado: SIEMPRE devuelve una fila por cada procedimiento
 * vigente (los que falten en `raw` caen a defecto), para que la rejilla y A4 tengan
 * datos completos. Acepta el objeto ya parseado o una cadena JSON.
 */
export function parseDiasPorProcedimiento(raw: unknown): DiasCronogramaPorProcedimiento {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") obj = p as Record<string, unknown>;
    } catch {
      /* JSON inválido → todo a defecto */
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  return Object.fromEntries(PROCEDIMIENTOS_CRONOGRAMA.map((p) => [p, saneaDias(obj[p])]));
}

/** Días del procedimiento `proc`, cayendo al set por defecto si no está configurado. */
export function diasParaProcedimiento(
  porProc: DiasCronogramaPorProcedimiento | null | undefined,
  proc: string | null | undefined,
): DiasCronograma {
  const key = (proc ?? "").trim();
  return (key && porProc?.[key]) || DIAS_CRONOGRAMA_DEFAULT;
}

export { CAMPOS_DIAS };
