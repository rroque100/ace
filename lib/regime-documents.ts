// Ids de los documentos normativos de cada régimen (Ley y Reglamento de la 30225 con sus
// modificatorias y TUO; Ley y Reglamento de la 32069), para dirigir una búsqueda a UN régimen.
//
// Hace falta porque el filtro `regime` del catálogo usa solo el régimen revisado por una persona, y
// hoy 1 152 de 1 299 documentos están «sin régimen revisado»: filtrar por él devolvería casi nada.
// Aquí el régimen se deduce del número y título de la norma (lib/chat-regime.ts: sourceRegime).

import { sourceRegime, type Regime } from "./chat-regime";
import { supabaseRest, tragarPeroRegistrar } from "./supabase-server";

type Row = { id: string; title: string; document_type: string; metadata: Record<string, unknown> | null };
export type RegimeDocumentIds = Record<Regime, string[]>;

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; value: RegimeDocumentIds } | null = null;

export function classifyRegimeDocuments(rows: Row[]): RegimeDocumentIds {
  const ids: RegimeDocumentIds = { "30225": [], "32069": [] };
  for (const row of rows) {
    const number = typeof row.metadata?.documentNumber === "string" ? row.metadata.documentNumber : typeof row.metadata?.number === "string" ? row.metadata.number : null;
    const regime = sourceRegime({ documentNumber: number, documentTitle: row.title, documentType: row.document_type });
    if (regime) ids[regime].push(row.id);
  }
  return ids;
}

/** Las leyes y reglamentos indexados de cada régimen. Si el catálogo no responde, vacío (el resto de la búsqueda sigue). */
export async function getRegimeDocumentIds(): Promise<RegimeDocumentIds> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await supabaseRest<Row[]>(
    "documents?es_institucional=eq.true&status=eq.indexed&document_type=in.(ley,reglamento)&select=id,title,document_type,metadata&limit=200",
  ).catch((error) => {
    tragarPeroRegistrar("regime-documents")(error);
    return null;
  });
  if (!rows) return { "30225": [], "32069": [] };
  const value = classifyRegimeDocuments(rows);
  cache = { at: Date.now(), value };
  return value;
}
