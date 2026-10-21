import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { archivoSearchSchema } from "@/lib/archivo-schema";
import { searchArchivo } from "@/lib/archivo-search";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = archivoSearchSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const results = await searchArchivo(payload.data);

    await writeAuditLog({
      action: "archivo.search",
      actorReference: auth.user.email ?? auth.user.id,
      details: { query: payload.data.query, docKind: payload.data.docKind ?? null, hits: results.length },
      entityType: "archivo_search",
      module: "archivo",
    });

    return NextResponse.json({ query: payload.data.query, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la busqueda" },
      { status: 500 },
    );
  }
}
