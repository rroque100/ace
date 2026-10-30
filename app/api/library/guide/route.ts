import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getSupabaseAdminClient,
  supabaseUserRest,
} from "@/lib/supabase-server";
import { guidedReadingSchema, guidedQuestion } from "@/lib/guided-reading";
import {CORPUS_ANSWER_TYPES} from '@/lib/official-corpus';
export async function POST(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const p = guidedReadingSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!p.success)
    return NextResponse.json(
      { error: "Revisa la fuente y el pasaje." },
      { status: 400 },
    );
  try {
    const c = await getSupabaseAdminClient();
    const { data: d, error } = await c
      .from("documents")
      .select("id,title,metadata,document_type,status,es_institucional")
      .eq("id", p.data.documentId)
      .eq("es_institucional", true)
      .single();
    if (
      error ||
      !d ||
      !CORPUS_ANSWER_TYPES.includes(d.document_type) ||
      d.status !== "indexed" ||
      d.metadata.indexedTextComplete !== true
    )
      return NextResponse.json(
        { error: "La fuente aún no está disponible para análisis verificado." },
        { status: 409 },
      );
    if (p.data.sha256 && p.data.sha256 !== d.metadata.sha256)
      return NextResponse.json(
        {
          error: "El original cambió. Reabre el documento antes de consultar.",
        },
        { status: 409 },
      );
    let chunk: {
      id: string;
      metadata: Record<string, unknown>;
      page_start: number | null;
    } | null = null;
    if (p.data.chunkId || p.data.locator || p.data.page) {
      let query = c
        .from("document_chunks")
        .select("id,metadata,page_start")
        .eq("document_id", d.id);
      if (p.data.chunkId) query = query.eq("id", p.data.chunkId);
      else if (p.data.locator)
        query = query.contains("metadata", { locator: p.data.locator });
      else
        query = query
          .lte("page_start", p.data.page!)
          .gte("page_end", p.data.page!);
      const result = await query.order("chunk_index").limit(1);
      if (result.error) throw result.error;
      chunk = result.data?.[0] ?? null;
      // A block may lie inside an indexed group: validate the actual original block and its first containing chunk.
      if (!chunk && p.data.locator) {
        const { downloadStorageObject } = await import("@/lib/supabase-server");
        const { extractSourceBlocks } = await import("@/lib/source-blocks");
        const { data: original } = await c
          .from("documents")
          .select("storage_bucket,storage_path,mime_type")
          .eq("id", d.id)
          .single();
        if (original) {
          const response = await downloadStorageObject(
            original.storage_bucket,
            original.storage_path,
          );
          const blocks = await extractSourceBlocks(
            new Uint8Array(await response.arrayBuffer()),
            original.mime_type,
          );
          const b = blocks.find((b) => b.id === p.data.locator);
          if (b) {
            const { data: pieces, error: piecesError } = await c
              .from("document_chunks")
              .select("id,metadata,page_start,content")
              .eq("document_id", d.id)
              .order("chunk_index")
              .limit(5000);
            if (piecesError) throw piecesError;
            chunk =
              pieces?.find((row) =>
                row.content.includes(
                  b.content.slice(0, Math.min(100, b.content.length)),
                ),
              ) ?? null;
          }
        }
      }
      if (!chunk)
        return NextResponse.json(
          {
            error:
              "No se encontró el pasaje en esta versión. No se sustituirá por otro.",
          },
          { status: 409 },
        );
    }
    if (p.data.action === "explain" && !chunk)
      return NextResponse.json(
        { error: "Selecciona un pasaje o una página antes de explicarlo." },
        { status: 400 },
      );
    const filters = {
      documentId: d.id,
      documentIds: [d.id],
      selectedDocumentIds: [d.id],
      documentType: d.document_type,
      expandCorpus: p.data.action === "relate",
      ...(chunk ? { chunkId: chunk.id, sourceSha: d.metadata.sha256 } : {}),
    };
    const question = guidedQuestion(
      p.data.action,
      d.title,
      chunk
        ? String(
            chunk.metadata.locatorLabel ??
              (chunk.page_start
                ? `página ${chunk.page_start}`
                : "pasaje registrado"),
          )
        : undefined,
    );
    const [session] = await supabaseUserRest<Array<{ id: string }>>(
      a.user.accessToken,
      "chat_sessions",
      {
        method: "POST",
        body: JSON.stringify({
          owner_id: a.user.id,
          title: question.slice(0, 90),
          metadata: {
            kind: "legal_chat",
            prefill: question,
            filters,
            guidedAction: p.data.action,
          },
        }),
      },
    );
    return NextResponse.json({
      sessionId: session.id,
      href: `/chat?sessionId=${session.id}`,
      scope: filters.expandCorpus
        ? "Fuente inicial y fuentes adicionales"
        : "Solo documento seleccionado",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo preparar la consulta. La fuente permanece en el lector.",
      },
      { status: 503 },
    );
  }
}
