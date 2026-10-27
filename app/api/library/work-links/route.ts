import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, type DocumentRecord } from "@/lib/supabase-server";
import { workTargetSchema, targetTables } from "@/lib/chat-work-notes";
import { sourceSnapshot } from "@/lib/source-dossier";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const p = z
    .object({
      documentIds: z.array(z.string().uuid()).min(1).max(20),
      targetType: workTargetSchema,
      targetId: z.string().uuid(),
      comment: z.string().trim().max(2000).default(""),
    })
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Revisa las fuentes y el destino." },
      { status: 400 },
    );
  try {
    const [token, ids] = [
      auth.user.accessToken,
      [...new Set(p.data.documentIds)],
    ];
    const [targets, docs] = await Promise.all([
      supabaseUserRest<Array<{ id: string }>>(
        token,
        `${targetTables[p.data.targetType]}?id=eq.${p.data.targetId}&select=id&limit=1`,
      ),
      supabaseUserRest<DocumentRecord[]>(
        token,
        `documents?id=in.(${ids.join(",")})&select=*`,
      ),
    ]);
    if (!targets.length || docs.length !== ids.length)
      return NextResponse.json(
        {
          error:
            "Alguna fuente o el destino no está disponible para tu usuario.",
        },
        { status: 404 },
      );
    const snapshots = docs.map((doc) => sourceSnapshot(doc));
    if (new URL(request.url).searchParams.get("preview") === "1")
      return NextResponse.json({
        sources: snapshots,
        notice:
          "Referencias personales pendientes de revisión. El expediente o contrato no se modifica.",
      });
    const links = await supabaseUserRest(token, "legal_source_work_links", {
      method: "POST",
      body: JSON.stringify(
        docs.map((doc) => ({
          owner_id: auth.user.id,
          document_id: doc.id,
          target_type: p.data.targetType,
          target_id: p.data.targetId,
          comment: p.data.comment,
          snapshot: sourceSnapshot(doc),
        })),
      ),
    });
    return NextResponse.json({ links }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo vincular la selección. Tus fuentes se conservan." },
      { status: 503 },
    );
  }
}
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const u = new URL(request.url),
    p = z
      .object({ targetType: workTargetSchema, targetId: z.string().uuid() })
      .safeParse(Object.fromEntries(u.searchParams));
  if (!p.success)
    return NextResponse.json({ error: "Destino inválido" }, { status: 400 });
  try {
    const [target] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      `${targetTables[p.data.targetType]}?id=eq.${p.data.targetId}&select=id&limit=1`,
    );
    if (!target)
      return NextResponse.json(
        { error: "Destino no disponible" },
        { status: 404 },
      );
    const links = await supabaseUserRest(
      auth.user.accessToken,
      `legal_source_work_links?owner_id=eq.${auth.user.id}&target_type=eq.${p.data.targetType}&target_id=eq.${p.data.targetId}&select=id,snapshot,comment,created_at&order=created_at.desc`,
    );
    return NextResponse.json(
      { links },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron consultar las referencias." },
      { status: 503 },
    );
  }
}
