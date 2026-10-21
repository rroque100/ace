// Catálogo de documentos administrativos generables (POST /api/processes/[id]/draft).
//
// Vive aparte de lib/process-agents.ts (que importa `docx`, `openai-server`,
// etc.) para que el <select> del cliente pueda importar esta lista sin
// arrastrar módulos de solo-servidor al bundle del navegador. El desplegable
// de process-detail.tsx tenía su PROPIA copia hardcodeada de este catálogo —al
// agregarse los 6 tipos de Fase 3 al backend, nadie actualizó esa segunda
// lista— así que ahora hay una sola fuente para los dos lados.

export type DraftKind =
  | "informe_tecnico"
  | "informe_legal"
  | "acta_admision"
  | "acta_calificacion"
  | "acta_buena_pro"
  | "acta_desierto"
  | "memorando"
  | "informe_evaluacion"
  // Ejecución contractual (Módulo 8) y archivo (Módulo 9)
  | "orden_inicio"
  | "acta_conformidad"
  | "informe_penalidad"
  | "informe_adicional"
  | "acta_liquidacion"
  | "expediente_unico";

export const draftKinds: Array<{ label: string; value: DraftKind }> = [
  { label: "Informe técnico", value: "informe_tecnico" },
  { label: "Informe legal", value: "informe_legal" },
  { label: "Acta de admisión", value: "acta_admision" },
  { label: "Acta de calificación", value: "acta_calificacion" },
  { label: "Acta de otorgamiento de buena pro", value: "acta_buena_pro" },
  { label: "Acta de declaratoria de desierto", value: "acta_desierto" },
  { label: "Memorando", value: "memorando" },
  { label: "Informe de evaluación de ofertas", value: "informe_evaluacion" },
  { label: "Orden de inicio de la prestación", value: "orden_inicio" },
  { label: "Acta de conformidad", value: "acta_conformidad" },
  { label: "Informe de penalidad", value: "informe_penalidad" },
  { label: "Informe de adicionales / ampliaciones", value: "informe_adicional" },
  { label: "Acta de liquidación del contrato", value: "acta_liquidacion" },
  { label: "Expediente electrónico único (índice)", value: "expediente_unico" },
];
