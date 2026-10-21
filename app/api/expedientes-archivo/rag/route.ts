import { NextResponse } from "next/server";
import { requireUser, requireDecOrAreaUsuaria, getArchivoScopeLevel, canAccessArchivoRow } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { ragRecordFilters, restLiteral } from "@/lib/archivo-rag";
import { advanceRagDocument } from "@/lib/archivo-rag-worker";
import type { ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rate = checkRateLimit(getRateLimitKey(request, auth.user.id, "rag-list"), RATE_LIMITS.search);
  if (!rate.allowed) return rateLimitResponse(rate);
  const params = new URL(request.url).searchParams;
  let filters: string;
  try { filters = ragRecordFilters(params); } catch (error) { return NextResponse.json({ error: String(error) }, { status: 400 }); }
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("page") ?? "1") || 1));
  const scope = getArchivoScopeLevel(auth.user);
  if (scope === "own") filters += `&uploaded_by=eq.${restLiteral(auth.user.id)}`;
  if (scope === "oficina") {
    if (!auth.user.oficinaId && !auth.user.entity) return NextResponse.json({ rows: [], hasMore: false });
    filters += auth.user.oficinaId ? `&oficina_id=eq.${restLiteral(auth.user.oficinaId)}` : `&oficina=eq.${restLiteral(auth.user.entity!)}`;
  }
  try {
    const rows = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?select=id,title,file_name,serie_documento,tipo_documento,anio,nro_archivador,nro_estante,nro_local,nro_piso,status,error_message,metadata&order=created_at.desc,id.asc&limit=21&offset=${(page - 1) * 20}${filters}`);
    return NextResponse.json({ rows: rows.slice(0, 20), hasMore: rows.length > 20 });
  } catch { return NextResponse.json({ error: "No se pudieron consultar los registros" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const auth = await requireDecOrAreaUsuaria();
  if ("error" in auth) return auth.error;
  const rate = checkRateLimit(getRateLimitKey(request, auth.user.id, "rag-process"), RATE_LIMITS.search);
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    const { id } = await request.json();
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
    const [row] = await supabaseRest<Array<ExpedienteArchivo & { oficina_id?: string }>>(`expedientes_archivo?id=eq.${id}&select=*`);
    if (!row || !canAccessArchivoRow(auth.user, { oficina: row.oficina, oficinaId: row.oficina_id, owner: row.uploaded_by })) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    if (row.metadata?.uploadSource !== "rag-folder") return NextResponse.json({ error: "Usa la reindexación del documento para este archivo" }, { status: 400 });
    await advanceRagDocument(row);
    await writeAuditLog({ action: "expedientes.rag.advance", actorReference: auth.user.id, entityId: id, entityType: "expediente_archivo" });
    const [current] = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?id=eq.${id}&select=status,metadata`);
    return NextResponse.json({ ok: true, current });
  } catch { return NextResponse.json({ error: "No se pudo continuar el procesamiento. El avance completado se conserva; vuelve a intentarlo." }, { status: 503 }); }
}
