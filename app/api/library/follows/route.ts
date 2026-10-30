import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";
import { followSchema } from "@/lib/library-follow";
import { followFingerprint } from "@/lib/library-updates";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(new URL(request.url).searchParams.get("page") ?? 1);
  if (!page.success)
    return NextResponse.json({ error: "Página inválida." }, { status: 400 });
  try {
    const [follows, notifications] = await Promise.all([
      supabaseUserRest(
        a.user.accessToken,
        `legal_source_follows?owner_id=eq.${a.user.id}&order=created_at.desc&limit=21&offset=${(page.data - 1) * 20}`,
      ),
      supabaseUserRest(
        a.user.accessToken,
        `legal_follow_notifications?owner_id=eq.${a.user.id}&select=*,event:legal_document_events(*)&order=created_at.desc&limit=21&offset=${(page.data - 1) * 20}`,
      ),
    ]);
    return NextResponse.json(
      {
        follows,
        notifications,
        page: page.data,
        notice:
          "Avisos dentro de ACE. Las consultas guardadas detectan palabras en título y tema con sus filtros; no representan todas las coincidencias semánticas.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron consultar los seguimientos." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const p = followSchema.safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Revisa la fuente o los criterios de búsqueda." },
      { status: 400 },
    );
  try {
    if (p.data.documentId) {
      const docs = await supabaseUserRest<
        Array<{ id: string; es_institucional: boolean }>
      >(
        a.user.accessToken,
        `documents?id=eq.${p.data.documentId}&es_institucional=eq.true&select=id,es_institucional&limit=1`,
      );
      if (!docs.length)
        return NextResponse.json(
          { error: "Fuente institucional no disponible." },
          { status: 404 },
        );
    }
    const fingerprint = followFingerprint(
      p.data.documentId ? { documentId: p.data.documentId } : p.data.search,
    );
    await supabaseUserRest(
      a.user.accessToken,
      "legal_source_follows?on_conflict=owner_id,fingerprint",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          owner_id: a.user.id,
          document_id: p.data.documentId ?? null,
          search: p.data.search ?? null,
          label: p.data.label,
          fingerprint,
          paused: false,
        }),
      },
    );
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar el seguimiento." },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const p = z
    .discriminatedUnion("action", [
      z.object({
        id: z.string().uuid(),
        action: z.literal("pause"),
        paused: z.boolean(),
      }),
      z.object({ id: z.string().uuid(), action: z.literal("read") }),
    ])
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Aviso o seguimiento inválido." },
      { status: 400 },
    );
  try {
    const rows = await supabaseUserRest<Array<{ id: string }>>(
      a.user.accessToken,
      `${p.data.action === "read" ? "legal_follow_notifications" : "legal_source_follows"}?id=eq.${p.data.id}&owner_id=eq.${a.user.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          p.data.action === "read"
            ? { read_at: new Date().toISOString() }
            : { paused: p.data.paused },
        ),
      },
    );
    return NextResponse.json(
      { saved: rows.length > 0 },
      { status: rows.length ? 200 : 404 },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo actualizar el seguimiento." },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const id = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success)
    return NextResponse.json(
      { error: "Seguimiento inválido." },
      { status: 400 },
    );
  try {
    await supabaseUserRest(
      a.user.accessToken,
      `legal_source_follows?id=eq.${id.data}&owner_id=eq.${a.user.id}`,
      { method: "DELETE" },
    );
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo quitar el seguimiento." },
      { status: 503 },
    );
  }
}
