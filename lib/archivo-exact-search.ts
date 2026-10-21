import { supabaseUserRest } from "./supabase-server";
import type { ExpedienteSearchInput } from "./expedientes-archivo-schema";

type ExactDoc = { id: string; title: string; serie_documento: string | null; sgd_expediente: string | null };
type ExactChunk = { id: string; documento_id: string; chunk_index: number; page_start: number | null; page_end: number | null };
const literal = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function containsExactNumber(value: string | null, code: string) {
  return (value?.match(/\d+/g) ?? []).some(number => number.replace(/^0+(?=\d)/, "") === code.replace(/^0+(?=\d)/, ""));
}

/** RLS antes de recuperar candidatos; nunca consulta global con service_role. */
export async function searchArchivoExactNumbers(
  input: ExpedienteSearchInput & { uploadedBy?: string; accessToken?: string }, codes: string[],
): Promise<Array<Record<string, unknown>> | null> {
  if (!input.accessToken || !codes.length) return null;
  const params = new URLSearchParams({ select: "id,title,serie_documento,sgd_expediente", order: "id.asc", limit: "200" });
  params.set("or", `(${codes.flatMap(code => ["title", "serie_documento", "sgd_expediente"].map(field => `${field}.ilike.*${code.replace(/^0+(?=\d)/, "")}*`)).join(",")})`);
  if (input.documentId) params.set("id", `eq.${input.documentId}`);
  if (input.uploadedBy) params.set("uploaded_by", `eq.${input.uploadedBy}`);
  if (input.anio) params.set("anio", `eq.${input.anio}`);
  if (input.oficina) params.set("oficina", `ilike.${literal(`*${input.oficina}*`)}`);
  if (input.materia) params.set("materia", `ilike.${literal(`*${input.materia}*`)}`);
  if (input.serieDocumento) params.set("serie_documento", `ilike.${literal(`*${input.serieDocumento}*`)}`);
  const ids: string[] = [];
  // Paginar para que documentos con números similares no oculten al exacto.
  for (let offset = 0; ; offset += 200) {
    params.set("offset", String(offset));
    const rows = await supabaseUserRest<ExactDoc[]>(input.accessToken, `expedientes_archivo?${params}`);
    for (const row of rows) {
      if (codes.some(code => [row.title, row.serie_documento, row.sgd_expediente].some(value => containsExactNumber(value, code)))) ids.push(row.id);
    }
    if (rows.length < 200) break;
  }
  if (!ids.length) return null;
  const hits: Array<Record<string, unknown>> = [];
  const topK = input.topK ?? 8;
  // Una primera evidencia por documento evita que un PDF largo ocupe todos los resultados.
  for (const id of ids) {
    const chunks = await supabaseUserRest<ExactChunk[]>(input.accessToken,
      `expedientes_archivo_chunks?documento_id=eq.${id}&select=id,documento_id,chunk_index,page_start,page_end&order=chunk_index.asc&limit=1`);
    for (const chunk of chunks) hits.push({ _id: chunk.id, _score: 1, chunk_id: chunk.id, document_id: chunk.documento_id, chunk_index: chunk.chunk_index, page_start: chunk.page_start, page_end: chunk.page_end });
    if (hits.length >= topK) break;
  }
  return hits;
}
