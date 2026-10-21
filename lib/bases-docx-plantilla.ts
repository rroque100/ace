// Word oficial (.docx) del OECE para cada tipo de procedimiento de selección.
// Vive en la MISMA carpeta que los PDF (actuaciones-preparatorias/bases/) y con
// el MISMO nombre, cambiando la extensión a .docx. Es la fuente para elaborar
// las Bases del procedimiento (A9) respetando el número de páginas, la
// tipografía, negritas, viñetas y numeración del formato oficial: el generador
// solo sustituye los marcadores "[...]" que puede resolver desde A1-A8 y deja
// el resto del documento intacto (lib/bases-docx-relleno.ts).
//
// Si falta el .docx de un tipo, la ruta de exportación cae al generador
// estructural de lib/bases-docx.ts (borrador recompuesto, sin fidelidad de
// página) — nunca falla por esto.

import { readFile } from "node:fs/promises";
import path from "node:path";

// Clave = `PlantillaBases.proceso` (lib/bases-plantillas.ts). Varias claves
// comparten un mismo .docx cuando el OECE publicó una sola base estándar para
// ese grupo (p. ej. "bienes" y "bienes especializados", o las tres variantes
// de obras) — igual criterio que `pdfBasesEstandar` en lib/procesos-seleccion.ts.
const ARCHIVO_DOCX: Record<string, string> = {
  "Licitación Pública para bienes": "7614342-1-bases-estandar-licitacion-publica-para-bienes.docx",
  "Licitación Pública para bienes especializados": "7614342-1-bases-estandar-licitacion-publica-para-bienes.docx",
  "Licitación Pública de obras": "7614342-5-bases-estandar-licitacion-publica-de-obras.docx",
  "Licitación Pública de obras con precalificación": "7614342-5-bases-estandar-licitacion-publica-de-obras.docx",
  "Licitación Pública de obras con negociación": "7614342-5-bases-estandar-licitacion-publica-de-obras.docx",
  "Concurso Público de servicios": "7614342-8-bases-estandar-concurso-publico-de-servicios.docx",
  "Concurso Público para consultoría en general":
    "7614342-10-bases-estandar-concurso-publico-para-consultoria-en-general.docx",
  "Concurso Público para consultoría de obra":
    "7614342-12-bases-estandar-concurso-publico-para-consultor-a-de-obra.docx",
  "Concurso Público para servicio de mantenimiento vial":
    "7614342-14-bases-estandar-concurso-publico-para-servicio-de-mantenimiento-vial.docx",
  "Subasta Inversa Electrónica": "7614342-17-bases-estandar-subasta-inversa-electronica.docx",
  "Comparación de Precios": "7614342-18-bases-estandar-comparacion-de-precios.docx",
  "Procedimiento de Selección No Competitivo":
    "7614342-19-bases-estandar-procedimiento-de-seleccion-no-competitivo.docx",
  "Licitación Pública abreviada para bienes":
    "7614342-2-bases-estandar-licitacion-publica-abreviada-para-bienes.docx",
  "Licitación Pública abreviada de obras": "7614342-6-bases-estandar-licitacion-publica-abreviada-de-obras.docx",
  "Concurso Público abreviado de servicios":
    "7614342-9-bases-estandar-concurso-publico-abreviado-de-servicios.docx",
  "Concurso Público abreviado para consultoría en general":
    "7614342-11-bases-estandar-concurso-publico-abreviado-para-consultoria-en-general.docx",
  "Concurso Público abreviado para consultoría de obra":
    "7614342-13-bases-estandar-concurso-publico-abreviado-para-consultoria-de-obra.docx",
  "Concurso Público abreviado para servicios de mantenimiento vial":
    "7614342-15-bases-estandar-concurso-publico-abreviado-para-servicio-de-mantenimiento-vial.docx",
};

const DIR = path.join(process.cwd(), "actuaciones-preparatorias", "bases");

export function nombrePlantillaDocx(proceso: string): string | null {
  return ARCHIVO_DOCX[proceso] ?? null;
}

/** Buffer del .docx oficial, o `null` si no hay archivo para ese tipo. */
export async function leerPlantillaDocx(proceso: string): Promise<Buffer | null> {
  const archivo = ARCHIVO_DOCX[proceso];
  if (!archivo) return null;
  try {
    return await readFile(path.join(DIR, archivo));
  } catch {
    return null;
  }
}
