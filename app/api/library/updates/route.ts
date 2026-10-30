import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { officialSourceSchema, runOfficialSource } from "@/lib/library-updates";
import {
  candidateApprovalSchema,
  acceptOfficialCandidate,
} from "@/lib/official-candidate-import";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  if (!a.user.isAdmin) return NextResponse.json({ canManage: false });
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(new URL(request.url).searchParams.get("page") ?? 1);
  if (!page.success)
    return NextResponse.json({ error: "Página inválida." }, { status: 400 });
  try {
    const [sources, runs, candidates] = await Promise.all([
      supabaseRest(
        "legal_official_sources?select=*&order=created_at.desc&limit=21",
      ),
      supabaseRest("legal_update_runs?select=*&order=created_at.desc&limit=10"),
      supabaseRest(
        `legal_update_candidates?select=*&order=created_at.desc&limit=21&offset=${(page.data - 1) * 20}`,
      ),
    ]);
    return NextResponse.json({
      canManage: true,
      sources,
      runs,
      candidates,
      page: page.data,
      notice:
        "Detección manual de enlaces PDF directos. Los candidatos pendientes no son fuentes del Chat.",
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el control de actualizaciones." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  if (!a.user.isAdmin)
    return NextResponse.json(
      { error: "Solo administración puede ejecutar conectores." },
      { status: 403 },
    );
  const body = await request.json().catch(() => null);
  try {
    if (body?.action === "register") {
      const p = officialSourceSchema.safeParse(body);
      if (!p.success)
        return NextResponse.json(
          { error: p.error.issues[0].message },
          { status: 400 },
        );
      const sources = await supabaseRest(
        "legal_official_sources?on_conflict=url",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify({
            label: p.data.label,
            url: p.data.url,
            document_type: p.data.documentType,
            source_entity: p.data.sourceEntity,
            created_by: a.user.id,
          }),
        },
      );
      return NextResponse.json({ sources });
    }
    const p = z
      .object({ action: z.literal("run"), sourceId: z.string().uuid(), latest: z.boolean().optional() })
      .safeParse(body);
    if (!p.success)
      return NextResponse.json(
        { error: "Fuente o acción inválida." },
        { status: 400 },
      );
    return NextResponse.json(
      await runOfficialSource(p.data.sourceId, a.user.id, p.data.latest),
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "La ejecución no pudo completarse.",
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
      { error: "Solo administración puede revisar incorporaciones." },
      { status: 403 },
    );
  const p = candidateApprovalSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!p.success)
    return NextResponse.json(
      { error: p.error.issues[0].message },
      { status: 400 },
    );
  try {
    return NextResponse.json(await acceptOfficialCandidate(p.data, a.user.id));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "La incorporación quedó pendiente.",
      },
      { status: 409 },
    );
  }
}
