import { z } from "zod";
import { supabaseRest } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchLegalSources } from "@/lib/legal-chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const payload = (await request.json()) as { query?: string };
    const query = payload.query?.trim() ?? "";

    if (!z.string().uuid().safeParse(id).success || query.length < 5 || query.length > 500) {
      return NextResponse.json({ error: "Consulta insuficiente" }, { status: 400 });
    }

    const documents=await supabaseRest<Array<{id:string}>>(`documents?id=eq.${id}&es_institucional=eq.true&status=eq.indexed&select=id`);
    if(!documents.length)return NextResponse.json({error:"Documento no disponible"},{status:404});
    const result = await searchLegalSources({
      filters: { documentId: id },
      query,
      topK: 8,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo buscar dentro de la norma" },
      { status: 500 },
    );
  }
}
