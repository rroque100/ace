import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  selectedCaseAttachments,
  readCaseFile,
} from "@/lib/chat-case-attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  const session = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("sessionId"));
  if (!id.success || !session.success)
    return NextResponse.json({ error: "Adjunto inválido" }, { status: 400 });
  try {
    const [document] = await selectedCaseAttachments(
      auth.user.accessToken,
      auth.user.id,
      session.data,
      [id.data],
    );
    const bytes = await readCaseFile(document);
    return new Response(bytes, {
      headers: {
        "Content-Type": document.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Adjunto no encontrado" },
      { status: 404 },
    );
  }
}
