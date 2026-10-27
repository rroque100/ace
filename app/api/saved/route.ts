import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  supabaseUserRest,
  downloadStorageObject,
  type DocumentRecord,
} from "@/lib/supabase-server";
import { sourceSnapshot } from "@/lib/source-dossier";
import { extractSourceBlocks } from "@/lib/source-blocks";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const optionalId = z.string().uuid().optional().or(z.literal(""));
const schema = z.object({
  itemType: z.enum([
    "documento",
    "articulo",
    "mensaje",
    "validacion",
    "analisis",
  ]),
  title: z.string().trim().min(1).max(300),
  documentId: optionalId,
  articleId: optionalId,
  messageId: optionalId,
  chunkId: optionalId,
  carpetaId: optionalId,
  note: z.string().max(2000).optional().or(z.literal("")),
  locator: z
    .string()
    .regex(/^b\d+-[a-f0-9]{12}$/)
    .optional(),
});
async function folderVisible(token: string, id?: string | null) {
  if (!id) return true;
  const rows = await supabaseUserRest<Array<{ id: string }>>(
    token,
    `carpetas?id=eq.${id}&select=id&limit=1`,
  );
  return rows.length === 1;
}
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const items = await supabaseUserRest(
      auth.user.accessToken,
      "guardados?select=id,carpeta_id,item_type,document_id,article_id,message_id,title,note,metadata,created_at&order=created_at.desc",
    );
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron consultar tus guardados." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Revisa los datos del elemento." },
      { status: 400 },
    );
  const d = parsed.data;
  try {
    if (!(await folderVisible(auth.user.accessToken, d.carpetaId)))
      return NextResponse.json(
        { error: "Carpeta no disponible." },
        { status: 404 },
      );
    let metadata: Record<string, unknown> = {};
    if (d.documentId) {
      const [doc] = await supabaseUserRest<DocumentRecord[]>(
        auth.user.accessToken,
        `documents?id=eq.${d.documentId}&select=*&limit=1`,
      );
      if (!doc)
        return NextResponse.json(
          { error: "Fuente no disponible." },
          { status: 404 },
        );
      let location: {
        locator?: string;
        locatorLabel?: string;
        quote?: string;
        pageStart?:number|null;pageEnd?:number|null;
      } = {};
      if (d.chunkId) {
        const [chunk] = await supabaseUserRest<
          Array<{
            content: string;
            page_start: number | null;
            page_end: number | null;
            chunk_index: number;
            metadata: Record<string, unknown>;
          }>
        >(
          auth.user.accessToken,
          `document_chunks?id=eq.${d.chunkId}&document_id=eq.${d.documentId}&select=content,page_start,page_end,chunk_index,metadata&limit=1`,
        );
        if (!chunk)
          return NextResponse.json(
            { error: "El pasaje no corresponde al documento seleccionado." },
            { status: 404 },
          );
        location = {
          pageStart:chunk.page_start,pageEnd:chunk.page_end,
          locator:
            typeof chunk.metadata.locator === "string"
              ? chunk.metadata.locator
              : undefined,
          locatorLabel:
            typeof chunk.metadata.locatorLabel === "string"
              ? chunk.metadata.locatorLabel
              : chunk.page_start
                ? `Página ${chunk.page_start}${chunk.page_end && chunk.page_end !== chunk.page_start ? `–${chunk.page_end}` : ""}`
                : `Fragmento ${chunk.chunk_index + 1}`,
          quote: chunk.content,
        };
      }
      if (d.locator && !d.chunkId) {
        const blob = await downloadStorageObject(
          doc.storage_bucket,
          doc.storage_path,
        );
        const blocks = await extractSourceBlocks(
          new Uint8Array(await blob.arrayBuffer()),
          doc.mime_type,
        );
        const b = blocks.find((b) => b.id === d.locator);
        if (!b)
          return NextResponse.json(
            { error: "El bloque ya no corresponde a esta versión." },
            { status: 409 },
          );
        location = { locator: b.id, locatorLabel: b.label, quote: b.content };
      }
      if (d.articleId) {
        const [a] = await supabaseUserRest<
          Array<{
            content: string;
            article_number: string;
            page_start: number | null;
          }>
        >(
          auth.user.accessToken,
          `norma_articulos?id=eq.${d.articleId}&document_id=eq.${d.documentId}&select=content,article_number,page_start&limit=1`,
        );
        if (!a)
          return NextResponse.json(
            { error: "Artículo no disponible en esta fuente." },
            { status: 404 },
          );
        location = {
          locatorLabel: `Artículo ${a.article_number}${a.page_start ? ` · página ${a.page_start}` : ""}`,
          pageStart:a.page_start,
          quote: a.content,
        };
      }
      metadata = { snapshot: sourceSnapshot(doc, location) };
    } else if (d.messageId) {
      const [m] = await supabaseUserRest<
        Array<{
          content: string;
          sources: unknown[];
          metadata: Record<string, unknown>;
        }>
      >(
        auth.user.accessToken,
        `chat_messages?id=eq.${d.messageId}&select=content,sources,metadata&limit=1`,
      );
      if (!m)
        return NextResponse.json(
          { error: "Respuesta no disponible." },
          { status: 404 },
        );
      metadata = {
        snapshot: {
          title: d.title,
          quote: m.content,
          contentKind: "respuesta asistida",
          consultedAt: new Date().toISOString(),
          review: "pendiente",
        },
        sources: m.sources,
        question: m.metadata?.question,
      };
    } else
      return NextResponse.json(
        { error: "Selecciona una fuente o respuesta accesible." },
        { status: 400 },
      );
    const [item] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      "guardados",
      {
        method: "POST",
        body: JSON.stringify({
          owner_id: auth.user.id,
          item_type: d.itemType,
          title: d.title,
          document_id: d.documentId || null,
          article_id: d.articleId || null,
          message_id: d.messageId || null,
          carpeta_id: d.carpetaId || null,
          note: d.note || null,
          metadata,
        }),
      },
    );
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo guardar la fuente. Revisa su disponibilidad e inténtalo de nuevo.",
      },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = z
    .object({
      id: z.string().uuid(),
      note: z.string().max(2000).optional(),
      carpetaId: z.string().uuid().nullable().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    if (!(await folderVisible(auth.user.accessToken, parsed.data.carpetaId)))
      return NextResponse.json(
        { error: "Carpeta no disponible." },
        { status: 404 },
      );
    const update = {
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      ...(parsed.data.carpetaId !== undefined
        ? { carpeta_id: parsed.data.carpetaId }
        : {}),
    };
    const items = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      `guardados?id=eq.${parsed.data.id}&owner_id=eq.${auth.user.id}`,
      { method: "PATCH", body: JSON.stringify(update) },
    );
    return NextResponse.json({ updated: items.length > 0 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo actualizar el guardado." },
      { status: 503 },
    );
  }
}
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success)
    return NextResponse.json(
      { error: "Identificador inválido." },
      { status: 400 },
    );
  try {
    await supabaseUserRest(
      auth.user.accessToken,
      `guardados?id=eq.${id.data}&owner_id=eq.${auth.user.id}`,
      { method: "DELETE" },
    );
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar el guardado." },
      { status: 503 },
    );
  }
}
