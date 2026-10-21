import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPineconeConfig, listDocumentCatalog, type DocumentCatalogEntry } from "@/lib/pinecone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/normativa/biblioteca
// Devuelve el catalogo de documentos unicos indexados en el namespace
// legal (Pinecone). El usuario lo ve en la pestana Responder para elegir
// que normativa quiere que la IA use como base.
//
// Query params:
//   - search: filtro por titulo (case-insensitive, contains)
//   - limit: maximo de entradas (default 200, max 1000)
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json(
        { entries: [], total: 0, message: "Pinecone no configurado" },
        { status: 200 },
      );
    }
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
    const limit = Math.min(
      1000,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "200", 10) || 200),
    );

    getPineconeConfig();
    const all = await listDocumentCatalog("legal-documents", Math.max(limit, 1000));

    const filtered = search
      ? all.filter((entry) =>
          [entry.title, entry.documentNumber, entry.sourceEntity, entry.documentType]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(search)),
        )
      : all;

    const entries: DocumentCatalogEntry[] = filtered.slice(0, limit);
    return NextResponse.json({
      entries,
      total: filtered.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        entries: [],
        total: 0,
        error: error instanceof Error ? error.message : "No se pudo cargar la biblioteca",
      },
      { status: 200 },
    );
  }
}
