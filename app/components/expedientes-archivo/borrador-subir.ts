// Funciones puras del borrador del wizard de Subir. Sin DOM ni React: se
// testean en vitest (entorno node) y las consume use-borrador-subir.ts.
import type { ExpedienteLegajoItem, SubirForm, WizardStep } from "./types";

export const BORRADOR_SUBIR_KEY = "subir-borrador-v1";
export const BORRADOR_SUBIR_TTL_MS = 24 * 60 * 60 * 1000;

// El formulario intacto del wizard. Vive aquí (no en el workspace) para que la
// validación de shape del borrador y la definición de SubirForm no se separen:
// si SubirForm gana un campo, EMPTY_SUBIR_FORM lo obliga a aparecer aquí.
export const EMPTY_SUBIR_FORM: SubirForm = {
  title: "",
  sgdExpediente: "",
  serieDocumento: "",
  tipoDocumento: "",
  tipoDocumentoCustom: "",
  anio: "",
  folio: "",
  oficina: "",
  materia: "",
  asunto: "",
  resumen: "",
  observaciones: "",
  personaTipo: "",
  personaDocumento: "",
  personaNombre: "",
  tipoAlmacenamiento: "",
  nroArchivador: "",
  nroPaquete: "",
  empastado: "",
  colorArchivador: "",
  nroEstante: "",
  nroPiso: "",
  nroLocal: "",
};

export type BorradorSubir = {
  form: SubirForm;
  wizardStep: WizardStep;
  legajo: ExpedienteLegajoItem | null;
  // El File no es serializable: se guardan nombre/tamaño solo para el aviso
  // "vuelve a cargar el PDF (era X, Y MB)" al recuperar.
  fileName: string | null;
  fileSize: number | null;
  savedAt: number;
};

function esSubirForm(v: unknown): v is SubirForm {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return Object.keys(EMPTY_SUBIR_FORM).every((k) => typeof f[k] === "string");
}

// Validación laxa a propósito: al recuperar solo se necesita poder pintar el
// chip del legajo y enviar `expedienteId` en la subida; exigir el shape
// completo de ExpedienteLegajoItem haría caducar borradores válidos por una
// columna nueva en BD.
function esLegajoOLuegoVeras(v: unknown): v is ExpedienteLegajoItem | null {
  if (v === null || v === undefined) return true;
  return typeof v === "object" && typeof (v as { id?: unknown }).id === "string";
}

/** Parsea el borrador guardado; null si no hay, está corrupto o caducó (>24 h). */
export function parsearBorradorSubir(
  raw: string | null,
  ahora: number = Date.now(),
): BorradorSubir | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.savedAt !== "number" || ahora - d.savedAt > BORRADOR_SUBIR_TTL_MS) {
    return null;
  }
  if (!esSubirForm(d.form)) return null;
  const step = d.wizardStep;
  if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step > 2) {
    return null;
  }
  if (!esLegajoOLuegoVeras(d.legajo)) return null;
  if (d.fileName !== null && d.fileName !== undefined && typeof d.fileName !== "string") {
    return null;
  }
  if (d.fileSize !== null && d.fileSize !== undefined && typeof d.fileSize !== "number") {
    return null;
  }
  return {
    form: d.form,
    // Rango validado arriba (0..2): el cast solo estrecha number al union.
    wizardStep: step as WizardStep,
    // undefined legado → null para que el consumidor no vea undefined
    legajo: (d.legajo ?? null) as ExpedienteLegajoItem | null,
    fileName: (d.fileName ?? null) as string | null,
    fileSize: (d.fileSize ?? null) as number | null,
    savedAt: d.savedAt,
  };
}

/** ¿Merece la pena guardar? La oficina no cuenta: viene precargada del perfil
 *  del usuario y haría "significativo" el formulario recién montado. */
export function tieneContenidoBorrador(
  form: SubirForm,
  legajo: ExpedienteLegajoItem | null,
  wizardStep: WizardStep,
): boolean {
  const conDatos = (Object.keys(EMPTY_SUBIR_FORM) as (keyof SubirForm)[]).some(
    (k) => k !== "oficina" && String(form[k] ?? "").trim() !== "",
  );
  return conDatos || legajo !== null || wizardStep > 0;
}
