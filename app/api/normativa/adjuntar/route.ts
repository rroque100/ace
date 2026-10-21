import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import {
  getPineconeConfig,
  respuestaAdjuntosNamespace,
  type PineconeRecord,
  upsertTextRecords,
} from "@/lib/pinecone";
import { extractPdfText, chunkPages } from "@/lib/pdf-processing";
import { writeAuditLog, getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NAMESPACE = respuestaAdjuntosNamespace;
const MIN_CHARS = 80;
const MAX_CHARS_PER_CHUNK = 4500;

function validatePdf(file: File): { ok: true } | { ok: false; error: string } {
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Solo se aceptan archivos PDF" };
  }
  if (file.size > maxPdfSizeBytes) {
    return { ok: false, error: `El PDF supera el limite de ${maxPdfSizeLabel}` };
  }
  return { ok: true };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// POST /api/normativa/adjuntar
// Body: FormData con `file` (PDF) y opcional `titulo`.
// Indexa el PDF en el namespace `respuesta-adjuntos` de Pinecone y devuelve
// el documentId para que la IA lo use como base en la siguiente generacion.
// El documento se guarda con scope temporal (se elimina al cerrar el caso).
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json({ error: "Pinecone no configurado" }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const titulo = (formData.get("titulo") as string | null) ?? "";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
    }
    const validation = validatePdf(file);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    getPineconeConfig();
    const extracted = await extractPdfText(file);
    const text = normalizeText(extracted.text ?? "");
    if (text.length < MIN_CHARS) {
      return NextResponse.json(
        { error: "El PDF no tiene texto legible. Verifica el archivo o usa OCR." },
        { status: 422 },
      );
    }

    // Reutiliza el chunker por paginas si esta disponible; sino corta por longitud.
    const pageChunks = (() => {
      try {
        const pages = extracted.pages && extracted.pages.length > 0
          ? extracted.pages
          : [{ pageNumber: 1, text }];
        return chunkPages(pages);
      } catch {
        return null;
      }
    })();

    type RawChunk = { text: string; pageNumber: number };
    const chunks: RawChunk[] = pageChunks
      ? pageChunks.map((c) => ({
          text: c.content,
          pageNumber: c.pageStart ?? 1,
        }))
      : splitText(text, MAX_CHARS_PER_CHUNK);

    const documentId = `adjunto-${randomUUID()}`;
    const title = titulo.trim() || file.name.replace(/\.pdf$/i, "");
    const records: PineconeRecord[] = chunks.map((chunk, index) => ({
      _id: `${documentId}-${index}`,
      chunk_id: `${documentId}-${index}`,
      chunk_index: index,
      document_id: documentId,
      document_type: "adjunto_usuario",
      page_end: chunk.pageNumber,
      page_start: chunk.pageNumber,
      process_type: "respuesta_generada",
      source_entity: auth.user.entity ?? undefined,
      text: chunk.text,
      title,
      year: new Date().getFullYear(),
    }));

    await upsertTextRecords(records, NAMESPACE);

    // Persiste el adjunto en Supabase para tener trazabilidad
    // y permitir limpieza por antiguedad.
    try {
      getSupabaseServerConfig();
      await supabaseRest("normativa_adjuntos", {
        body: JSON.stringify({
          created_by: auth.user.id,
          document_id: documentId,
          file_name: file.name,
          file_size: file.size,
          namespace: NAMESPACE,
          title,
        }),
        method: "POST",
      });
    } catch {
      // No es critico persistir; la indexacion en Pinecone ya se hizo.
    }

    await writeAuditLog({
      action: "normativa.adjuntar",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        documentId,
        fileName: file.name,
        fileSize: file.size,
        chunkCount: records.length,
        namespace: NAMESPACE,
        title,
      },
      entityId: documentId,
      entityType: "normativa_adjunto",
      module: "expedientes-archivo",
    });

    return NextResponse.json({
      chunkCount: records.length,
      documentId,
      namespace: NAMESPACE,
      pages: extracted.pageCount,
      textLength: text.length,
      title,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el adjunto" },
      { status: 500 },
    );
  }
}

function splitText(text: string, maxChars: number): Array<{ pageNumber: number; text: string }> {
  const chunks: Array<{ pageNumber: number; text: string }> = [];
  let buffer = "";
  let pageNumber = 1;
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if ((buffer + " " + sentence).trim().length > maxChars) {
      if (buffer.trim().length > 0) {
        chunks.push({ pageNumber, text: buffer.trim() });
      }
      buffer = sentence;
      pageNumber += 1;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer.trim().length > 0) {
    chunks.push({ pageNumber, text: buffer.trim() });
  }
  return chunks;
}
