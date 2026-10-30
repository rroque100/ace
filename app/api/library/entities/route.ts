import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import {
  entityQuerySchema,
  entityReviewSchema,
  ENTITY_ROLES,
} from "@/lib/entity-directory";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const q = entityQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!q.success)
    return NextResponse.json(
      { error: "Revisa la búsqueda de entidad." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      {
        ...(await supabaseRest<Record<string, unknown>>(
          "rpc/ace_entity_directory_v1",
          {
            method: "POST",
            body: JSON.stringify({ p_query: q.data.q, p_page: q.data.page }),
          },
        )),
        canReview: a.user.isAdmin,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo consultar el directorio. No significa que no exista la entidad.",
      },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  if (!a.user.isAdmin)
    return NextResponse.json(
      { error: "Solo administración puede verificar entidades." },
      { status: 403 },
    );
  const p = entityReviewSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!p.success)
    return NextResponse.json(
      { error: p.error.issues[0].message },
      { status: 400 },
    );
  try {
    return NextResponse.json({
      entity: await supabaseRest("rpc/ace_review_entity_v1", {
        method: "POST",
        body: JSON.stringify({ p_actor: a.user.id, p_input: p.data }),
      }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.message.includes("40001")
            ? "Otra revisión cambió el registro. Recarga antes de guardar."
            : "No se pudo registrar la revisión.",
      },
      { status: 409 },
    );
  }
}
export async function POST(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  if (!a.user.isAdmin)
    return NextResponse.json(
      { error: "Solo administración puede asociar entidades." },
      { status: 403 },
    );
  const p = z
    .object({
      entityId: z.string().uuid(),
      documentId: z.string().uuid(),
      role: z.enum(ENTITY_ROLES),
      evidence: z.string().trim().min(15).max(3000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Comprueba la fuente, entidad, rol y evidencia." },
      { status: 400 },
    );
  try {
    const [docs, entities] = await Promise.all([
      supabaseRest<Array<{ id: string }>>(
        `documents?id=eq.${p.data.documentId}&es_institucional=eq.true&select=id`,
      ),
      supabaseRest<Array<{ id: string }>>(
        `legal_entities?id=eq.${p.data.entityId}&status=neq.rejected&select=id`,
      ),
    ]);
    if (!docs.length || !entities.length)
      return NextResponse.json(
        { error: "Fuente o entidad no disponible." },
        { status: 404 },
      );
    await supabaseRest(
      "legal_entity_documents?on_conflict=entity_id,document_id,role",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          entity_id: p.data.entityId,
          document_id: p.data.documentId,
          role: p.data.role,
          evidence: p.data.evidence,
        }),
      },
    );
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo asociar la entidad." },
      { status: 503 },
    );
  }
}
