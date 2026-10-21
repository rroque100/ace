// Catalogo canonico del procedimiento de contratacion (Ley 32069), organizado
// en 3 FASES con sus hitos (sub-pasos). Fuente unica de verdad: la UI, la API y
// los reportes de avance leen de aqui. El estado por-expediente de cada hito se
// persiste aparte (columna jsonb `hitos` en procurement_processes); este modulo
// solo define QUE hitos existen, en que orden y quien es responsable.

export type FaseId = "F1" | "F2" | "F3";

export type HitoStatus = "pendiente" | "en_curso" | "hecho" | "na";

// Acciones oficiales de la Fase 1 (Guia de Actuaciones Preparatorias, Agenda
// I..VII + la programacion como precondicion). Los 10 sub-pasos A1..A10 se
// agrupan bajo estas acciones para reflejar la estructura canonica de la guia.
export type AccionF1Id = "prog" | "I" | "II" | "III-IV" | "V" | "VI" | "VII";

export type HitoCatalogo = {
  // Codigo estable del hito (A1..A9, B1..B8, C1..C8). Clave de persistencia.
  code: string;
  faseId: FaseId;
  // Orden dentro de la fase (1-based).
  order: number;
  label: string;
  // Rol(es) tipicamente responsable(s), como guia (no se enforce).
  responsable: string;
  // Tipo de documento sugerido (de processDocKinds) para vincular al hito.
  docKind?: string;
  // Accion oficial de la guia a la que pertenece el sub-paso (solo Fase 1).
  accionId?: AccionF1Id;
};

export type AccionF1 = {
  id: AccionF1Id;
  // Numeral romano (o "0" para la precondicion) que muestra la guia.
  numeral: string;
  label: string;
  // La accion es opcional / discrecional (ej. anuncio de contratacion futura).
  opcional?: boolean;
  // Es una precondicion previa a las acciones I..VII (programacion CMN/PAC).
  precondicion?: boolean;
};

// Las 7 acciones oficiales + la programacion como precondicion, en orden.
// Las etiquetas usan lenguaje de PROCESO (verbo en infinitivo) para que un
// usuario no técnico entienda qué se hace en cada bloque, sin reordenar nada:
// el orden I..VII es el de la Guía y el `numeral` sigue siendo el de la norma.
// EXCEPCIÓN: la acción I conserva el título literal de la norma, «Segmentación
// de las contrataciones» (Art. 42 del Reglamento; Art. 125 bienes/servicios,
// 153 obras), por pedido de fidelidad normativa. Es el nombre que ya usaba su
// `accionGuia`, así que además evita que A2 apareciera con dos nombres.
export const ACCIONES_F1: AccionF1[] = [
  { id: "prog", numeral: "0", label: "Programar en el CMN y el PAC", precondicion: true },
  { id: "I", numeral: "I", label: "Segmentación de las contrataciones" },
  { id: "II", numeral: "II", label: "Formular el requerimiento" },
  { id: "III-IV", numeral: "III–IV", label: "Definir la estrategia y consultar al mercado" },
  { id: "V", numeral: "V", label: "Armar y aprobar el expediente" },
  { id: "VI", numeral: "VI", label: "Elaborar las bases" },
  { id: "VII", numeral: "VII", label: "Anunciar la contratación futura", opcional: true },
];

export type Fase = {
  id: FaseId;
  numero: number;
  label: string;
  // Estados macro del expediente (procurement_processes.status) que caen en esta fase.
  statuses: string[];
};

export const FASES: Fase[] = [
  {
    id: "F1",
    numero: 1,
    label: "Actuaciones Preparatorias",
    statuses: ["actuaciones_preparatorias", "expediente", "aprobacion_aga"],
  },
  {
    id: "F2",
    numero: 2,
    label: "Selección",
    statuses: ["seleccion", "buena_pro", "desierto"],
  },
  {
    id: "F3",
    numero: 3,
    label: "Ejecución Contractual",
    statuses: ["contrato", "ejecucion", "conformidad", "liquidacion", "archivo"],
  },
];

export const HITOS: HitoCatalogo[] = [
  // ── FASE 1 · Actuaciones Preparatorias ────────────────────────────────────
  // Estructura alineada a la Guía de Actuaciones Preparatorias vigente
  // (R.D. 019-2026-EF/54.01), Ley 32069 y Reglamento D.S. 009-2025-EF mod. por
  // D.S. 001-2026-EF. Las 7 acciones oficiales se desagregan en 10 sub-pasos
  // (CCP y designación de evaluadores se llevan sueltos por trazabilidad).
  { code: "A1", faseId: "F1", order: 1, accionId: "prog", label: "Programar en el CMN y el PAC", responsable: "Área usuaria / DEC", docKind: "otros" },
  { code: "A2", faseId: "F1", order: 2, accionId: "I", label: "Segmentación de las contrataciones", responsable: "DEC" },
  { code: "A3", faseId: "F1", order: 3, accionId: "II", label: "Formular el requerimiento", responsable: "Área usuaria / ATE → DEC (no objeción)", docKind: "requerimiento" },
  { code: "A4", faseId: "F1", order: 4, accionId: "III-IV", label: "Definir la estrategia de contratación", responsable: "DEC + Área usuaria", docKind: "informe" },
  { code: "A5", faseId: "F1", order: 5, accionId: "III-IV", label: "Consultar al mercado", responsable: "DEC", docKind: "informe" },
  { code: "A6", faseId: "F1", order: 6, accionId: "V", label: "Designar a los evaluadores", responsable: "AGA / DEC", docKind: "otros" },
  { code: "A7", faseId: "F1", order: 7, accionId: "V", label: "Obtener la certificación presupuestal", responsable: "DEC / Presupuesto", docKind: "otros" },
  { code: "A8", faseId: "F1", order: 8, accionId: "V", label: "Aprobar el expediente de contratación", responsable: "AGA", docKind: "informe" },
  { code: "A9", faseId: "F1", order: 9, accionId: "VI", label: "Elaborar las bases", responsable: "Evaluadores / DEC", docKind: "bases" },
  { code: "A10", faseId: "F1", order: 10, accionId: "VII", label: "Anunciar la contratación futura (opcional)", responsable: "DEC" },

  // ── FASE 2 · Selección ────────────────────────────────────────────────────
  { code: "B1", faseId: "F2", order: 1, label: "Convocatoria en PLADICOP", responsable: "DEC / Oficial de Compra" },
  { code: "B2", faseId: "F2", order: 2, label: "Registro de Participantes", responsable: "Oficial de Compra" },
  { code: "B3", faseId: "F2", order: 3, label: "Consultas y Observaciones", responsable: "Comité" },
  { code: "B4", faseId: "F2", order: 4, label: "Absolución e Integración de Bases", responsable: "Comité", docKind: "bases_integradas" },
  { code: "B5", faseId: "F2", order: 5, label: "Presentación de Ofertas", responsable: "Comité", docKind: "oferta" },
  { code: "B6", faseId: "F2", order: 6, label: "Evaluación y Calificación", responsable: "Comité / Jurado", docKind: "acta" },
  { code: "B7", faseId: "F2", order: 7, label: "Otorgamiento de la Buena Pro", responsable: "Comité", docKind: "acta" },
  { code: "B8", faseId: "F2", order: 8, label: "Consentimiento de la Buena Pro", responsable: "DEC" },

  // ── FASE 3 · Ejecución Contractual ────────────────────────────────────────
  { code: "C1", faseId: "F3", order: 1, label: "Perfeccionamiento del Contrato", responsable: "DEC / Legal", docKind: "contrato" },
  { code: "C2", faseId: "F3", order: 2, label: "Verificación Posterior", responsable: "DEC" },
  { code: "C3", faseId: "F3", order: 3, label: "Suscripción o Notificación de Orden", responsable: "DEC", docKind: "contrato" },
  { code: "C4", faseId: "F3", order: 4, label: "Inicio de Ejecución (Condiciones)", responsable: "Área usuaria / DEC" },
  { code: "C5", faseId: "F3", order: 5, label: "Gestión de Modificaciones", responsable: "DEC / Legal" },
  { code: "C6", faseId: "F3", order: 6, label: "Recepción y Conformidad", responsable: "Área usuaria", docKind: "acta" },
  { code: "C7", faseId: "F3", order: 7, label: "Pago de la Contraprestación", responsable: "DEC" },
  { code: "C8", faseId: "F3", order: 8, label: "Liquidación y Cierre del Expediente", responsable: "DEC", docKind: "informe" },
];

// Estado mutable por-expediente de cada hito (lo que se persiste en jsonb).
/** Etiqueta de un hito por su código ("A4" → "Definir la estrategia de contratación"). */
export function hitoLabel(code: string): string {
  return HITOS.find((h) => h.code === code)?.label ?? code;
}

export type HitoEstado = {
  status: HitoStatus;
  doneAt?: string | null;
  responsible?: string | null;
  documentId?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  // Payload estructurado del formulario del paso (segmentación, estrategia,
  // Anexo N° 2, etc.). El esquema de cada paso vive en lib/actuaciones-preparatorias.ts.
  data?: Record<string, unknown> | null;
};

// Mapa persistido: { [code]: HitoEstado }. Los hitos sin entrada se asumen "pendiente".
export type HitosMap = Record<string, HitoEstado>;

export const HITO_STATUS_META: Record<HitoStatus, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#94a3b8" },
  en_curso: { label: "En curso", color: "#d97706" },
  hecho: { label: "Hecho", color: "#0f766e" },
  na: { label: "No aplica", color: "#64748b" },
};

const HITO_CODES = new Set(HITOS.map((h) => h.code));

export function isHitoCode(code: string): boolean {
  return HITO_CODES.has(code);
}

export function hitosDeFase(faseId: FaseId): HitoCatalogo[] {
  return HITOS.filter((h) => h.faseId === faseId).sort((a, b) => a.order - b.order);
}

export function faseForStatus(status: string | null | undefined): FaseId | null {
  if (!status) return null;
  return FASES.find((f) => f.statuses.includes(status))?.id ?? null;
}

// Un hito cuenta para el avance si esta "hecho" o marcado "no aplica".
function cuenta(estado: HitoEstado | undefined): boolean {
  return estado?.status === "hecho" || estado?.status === "na";
}

export type FaseProgress = {
  faseId: FaseId;
  total: number;
  completados: number;
  porcentaje: number;
};

export function progresoDeFase(faseId: FaseId, hitos: HitosMap): FaseProgress {
  const items = hitosDeFase(faseId);
  const completados = items.filter((h) => cuenta(hitos[h.code])).length;
  const total = items.length;
  return {
    faseId,
    total,
    completados,
    porcentaje: total === 0 ? 0 : Math.round((completados / total) * 100),
  };
}

export type AccionF1Progress = AccionF1 & {
  hitos: HitoCatalogo[];
  total: number;
  completados: number;
  porcentaje: number;
};

// Agrupa los sub-pasos de la Fase 1 en las 7 acciones oficiales (+ precondicion),
// con el sub-progreso de cada grupo. La UI de F1 se renderiza a partir de esto.
export function accionesDeF1(hitos: HitosMap): AccionF1Progress[] {
  const items = hitosDeFase("F1");
  return ACCIONES_F1.map((accion) => {
    const pasos = items.filter((h) => h.accionId === accion.id);
    const completados = pasos.filter((h) => cuenta(hitos[h.code])).length;
    const total = pasos.length;
    return {
      ...accion,
      hitos: pasos,
      total,
      completados,
      porcentaje: total === 0 ? 0 : Math.round((completados / total) * 100),
    };
  });
}

export function progresoTotal(hitos: HitosMap): { completados: number; total: number; porcentaje: number } {
  const total = HITOS.length;
  const completados = HITOS.filter((h) => cuenta(hitos[h.code])).length;
  return { completados, total, porcentaje: total === 0 ? 0 : Math.round((completados / total) * 100) };
}
