import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  supabaseRest,
  downloadStorageObject,
  type DocumentRecord,
} from "@/lib/supabase-server";
import { extractSourceBlocks } from "@/lib/source-blocks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  if (!id.success)
    return NextResponse.json({ error: "Documento inválido" }, { status: 400 });
  try {
    const [d] = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${id.data}&select=*&limit=1`,
    );
    if (
      !d ||
      !(
        auth.user.isAdmin ||
        d.es_institucional ||
        (auth.user.oficinaId && auth.user.oficinaId === d.oficina_id)
      )
    )
      return NextResponse.json(
        { error: "Documento no disponible" },
        { status: 404 },
      );
    if (d.mime_type === "application/pdf")
      return NextResponse.json({
        format: "pdf",
        title: d.title,
        blocks: [],
        originalUrl: `/api/documents/${d.id}`,
        document:{metadata:d.metadata,documentType:d.document_type,sourceEntity:d.source_entity,sha256:d.metadata.sha256},
      });
    const original = await downloadStorageObject(
      d.storage_bucket,
      d.storage_path,
    );
    const blocks = await extractSourceBlocks(
      new Uint8Array(await original.arrayBuffer()),
      d.mime_type,
    );
    return NextResponse.json(
      {
        format: d.mime_type.startsWith("text/") ? "web" : "docx",
        title: d.title,
        version: d.metadata.officialVersion ?? null,
        sourceUrl: d.metadata.officialPublicationUrl ?? d.metadata.sourceUrl,
        blocks,
        originalUrl: `/api/documents/${d.id}`,
        notice:
          "Texto extraído del original. Las referencias corresponden a bloques, no a páginas.",
        document:{metadata:d.metadata,documentType:d.document_type,sourceEntity:d.source_entity,sha256:d.metadata.sha256},
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el documento. Puedes descargar el original." },
      { status: 503 },
    );
  }
}
