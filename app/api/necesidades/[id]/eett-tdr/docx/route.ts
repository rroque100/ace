import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { buildEettTdrDocx } from "@/lib/eett-tdr-docx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  contenido: z.string().max(200000).default(""),
  titulo: z.string().max(300).default(""),
  tipo: z.enum(["eett", "tdr"]).default("tdr"),
});

function safeFileName(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// POST /api/necesidades/[id]/eett-tdr/docx
// Genera el .docx de la propuesta de EETT/TDR (formato Word descargable).
export async function POST(request: Request, _context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.contenido.trim()) {
    return NextResponse.json({ error: "No hay contenido para exportar." }, { status: 400 });
  }

  try {
    const buffer = await buildEettTdrDocx(parsed.data);
    const base = parsed.data.tipo === "eett" ? "EETT" : "TDR";
    const fileName = `${base}-${safeFileName(parsed.data.titulo || "propuesta")}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el .docx." },
      { status: 500 },
    );
  }
}
