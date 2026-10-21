import { z } from "zod";

/**
 * La Necesidad distingue "consultoria_obra" (Art. 44 Reglamento); el expediente
 * (`procurement_processes.object_type`) solo conoce "consultoria"
 * (CHECK procurement_processes_object_type_check). Sin este mapeo, derivar o
 * crear un expediente de consultoría de obra rompía el INSERT con un 400.
 */
export function objectTypeDeNecesidad(tipoObjeto: string): string {
  return tipoObjeto === "consultoria_obra" ? "consultoria" : tipoObjeto;
}

// Tipos y validacion del Expediente (procurement_processes) y sus documentos.
export type ProcurementProcess = {
  id: string;
  nomenclature: string;
  object_type: "bienes" | "servicios" | "obras" | "consultoria_obra";
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  summary: string | null;
  necesidad_id: string | null;

  // Campos Ley 32069 (Actuaciones Preparatorias / Mercado)
  valor_estimado: number | null;
  moneda: string | null;
  tipo_cambio: number | null;
  certificacion_presupuestal: string | null;
  sistema_contratacion: "suma_alzada" | "precios_unitarios" | "esquema_mixto" | "tarifas" | "porcentajes" | "honorario_fijo" | null;
  modalidad_ejecucion: "llave_en_mano" | "concurso_oferta" | null;
  formula_reajuste: string | null;
  pluralidad_marcas: boolean | null;
  resumen_ejecutivo: string | null;

  // Estrategia de contratación (Art. 46 Reglamento)
  requisitos_calificacion: string | null;
  requisitos_precalificacion: string | null;
  tipo_evaluador_perfil: string | null;
  factores_evaluacion: string | null;
  garantias_adelantos: string | null;
  cronograma_contratacion: string | null;
  tipo_interaccion_mercado: string | null;
  tipo_procedimiento: string | null;

  // Aprobacion
  /** Estado de los pasos de las tres fases (jsonb). Es la fuente de la ficha. */
  hitos?: Record<string, { data?: Record<string, unknown> | null }> | null;
  autoridad_aprobacion: "titular" | "aga" | null;
  delegacion_facultades: boolean | null;
  doc_aprobacion_expediente: string | null;

  created_at: string;
  updated_at: string;
};

export type ProcessDocument = {
  id: string;
  process_id: string;
  library_document_id?: string | null;
  kind: string;
  bidder_name: string | null;
  title: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// `nomenclaturaExpediente()` (lib/necesidad-denominacion.ts) arma "código —
// nombre", y el nombre de la necesidad admite hasta NOMBRE_MAX (500,
// lib/necesidades-limites.ts). Un tope de 200 aquí rechazaba una nomenclatura
// que la propia cascada "la denominación es UNA" ya había escrito sin pasar
// por este schema — el primer PATCH manual del nombre del expediente (sin
// tocar nada) ya fallaba con "Solicitud inválida". 550 cubre nombre + código
// con margen.
const NOMENCLATURE_MAX = 550;

export const processCreateSchema = z.object({
  nomenclature: z.string().trim().min(3).max(NOMENCLATURE_MAX),
  objectType: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]).default("servicios"),
  procedureType: optionalText(80),
  amount: z.coerce.number().nonnegative().optional(),
  entity: optionalText(160),
  summary: optionalText(2000),
});

export const processUpdateSchema = z.object({
  nomenclature: z.string().trim().min(3).max(NOMENCLATURE_MAX).optional(),
  procedureType: optionalText(80),
  amount: z.coerce.number().nonnegative().optional(),
  entity: optionalText(160),
  status: z
    .enum([
      "necesidad",
      "actuaciones_preparatorias",
      "expediente",
      "aprobacion_aga",
      "seleccion",
      "buena_pro",
      "desierto",
      "contrato",
      "ejecucion",
      "conformidad",
      "liquidacion",
      "archivo",
    ])
    .optional(),
  summary: optionalText(2000),
  
  // Campos Ley 32069
  valorEstimado: z.coerce.number().nonnegative().optional(),
  moneda: optionalText(10),
  tipoCambio: z.coerce.number().nonnegative().optional(),
  certificacionPresupuestal: optionalText(120),
  sistemaContratacion: z.enum(["suma_alzada", "precios_unitarios", "esquema_mixto", "tarifas", "porcentajes", "honorario_fijo"]).optional().nullable(),
  modalidadEjecucion: z.enum(["llave_en_mano", "concurso_oferta"]).optional().nullable(),
  formulaReajuste: optionalText(2000),
  pluralidadMarcas: z.boolean().optional().nullable(),
  resumenEjecutivo: optionalText(4000),

  requisitosCalificacion: optionalText(2000),
  requisitosPrecalificacion: optionalText(2000),
  tipoEvaluadorPerfil: optionalText(500),
  factoresEvaluacion: optionalText(2000),
  garantiasAdelantos: optionalText(2000),
  cronogramaContratacion: optionalText(2000),
  tipoInteraccionMercado: optionalText(200),
  tipoProcedimiento: optionalText(200),

  autoridadAprobacion: z.enum(["titular", "aga"]).optional().nullable(),
  delegacionFacultades: z.boolean().optional().nullable(),
  docAprobacionExpediente: optionalText(120),
});

export const processDocKinds = [
  "bases",
  "bases_integradas",
  "oferta",
  "contrato",
  "acta",
  "requerimiento",
  "tdr",
  "ee_tt",
  "informe",
  "carta",
  "cotizacion",
  "generado",
  "otros",
] as const;
