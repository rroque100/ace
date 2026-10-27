import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { validityReviewInput } from "@/lib/validity-review";

export const dynamic = "force-dynamic";
type Document = { id: string; metadata: Record<string, unknown> };
async function visibleDocument(id: string) {
  return (await supabaseRest<Document[]>(`documents?id=eq.${id}&es_institucional=eq.true&status=eq.indexed&select=id,metadata&limit=1`))[0];
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await context.params).id);
  const before = z.coerce.number().int().min(1).safeParse(new URL(request.url).searchParams.get("before") ?? 2147483647);
  if (!id.success || !before.success) return NextResponse.json({ error: "Documento o página inválidos" }, { status: 400 });
  try {
    const document = await visibleDocument(id.data);
    if (!document) return NextResponse.json({ error: "Documento institucional no disponible" }, { status: 404 });
    const history = await supabaseRest<Array<{ id: string; revision: number; record: unknown; created_at: string }>>(
      `document_validity_reviews?document_id=eq.${id.data}&revision=lt.${before.data}&select=id,revision,record,created_at&order=revision.desc&limit=21`);
    return NextResponse.json({
      revision: Number(document.metadata.validityRevision ?? 0),
      active: document.metadata.validityReviews ?? {},
      invalidatedAt: document.metadata.validityInvalidatedAt ?? null,
      history: history.slice(0, 20), nextBefore: history.length > 20 ? history[19].revision : null,
      canReview: auth.user.isAdmin || auth.user.isLegal,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la revisión; no significa que no exista" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!auth.user.isAdmin && !auth.user.isLegal) return NextResponse.json({ error: "Solo un administrador o perfil jurídico puede registrar la revisión" }, { status: 403 });
  const id = z.string().uuid().safeParse((await context.params).id);
  const body = validityReviewInput.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: body.error?.issues[0]?.message ?? "Documento inválido" }, { status: 400 });
  try {
    const review = await supabaseRest("rpc/ace_review_validity_v1", {
      method: "POST", body: JSON.stringify({ p_document: id.data, p_actor: auth.user.id, p_review: body.data }),
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    const status = /40001/.test(message) ? 409 : /42501/.test(message) ? 403 : /P0002/.test(message) ? 404 : /22023/.test(message) ? 400 : 503;
    return NextResponse.json({ error: status === 409 ? "Otra persona cambió la revisión. Recarga antes de guardar; tu texto permanece en el formulario." : status === 403 ? "Tu perfil no está autorizado para registrar revisiones." : status === 400 ? "Comprueba el alcance, la fuente y los artículos seleccionados." : status === 404 ? "Documento institucional no disponible." : "No se pudo guardar la revisión. Puedes reintentar sin perder el texto." }, { status });
  }
}
