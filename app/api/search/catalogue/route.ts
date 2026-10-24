import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadSearchCatalogue } from "@/lib/document-search-server";
import { classifySearchDocument } from "@/lib/document-search";
import { canonicalSourceEntity, documentaryDates } from "@/lib/search-document-metadata";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const catalogue = await loadSearchCatalogue();
    return NextResponse.json(
      {
        documents: catalogue.map((row) => ({
          documentType: row.document_type,
          documentId: row.id,
          dates: documentaryDates(row.metadata),
          year:
            typeof row.metadata.year === "number" ? row.metadata.year : null,
          entity: canonicalSourceEntity(row.source_entity),
          processType: row.process_type,
          classification: classifySearchDocument(row),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo cargar la clasificación disponible. Puedes reintentar.",
      },
      { status: 503 },
    );
  }
}
