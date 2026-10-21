import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDec } from "@/lib/auth";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const importSchema = z.object({
  ref: z.string().trim().min(3).max(1000),
  source: z.enum(["drive", "s3"]),
});

export async function POST(request: Request) {
  const auth = await requireDec();
  if ("error" in auth) {
    return auth.error;
  }

  const payload = importSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  await writeAuditLog({
    action: "document.import.requested",
    details: payload.data,
    entityType: "document_import",
  });

  return NextResponse.json(
    {
      planned: true,
      message:
        "Importación masiva preparada. Conecta credenciales del proveedor y reutiliza el pipeline existente: Storage -> documents(uploaded) -> drainer -> Pinecone.",
      nextSteps:
        payload.data.source === "drive"
          ? ["Configurar GOOGLE_SERVICE_ACCOUNT_JSON", "Autorizar carpeta Drive", "Mapear PDFs a documentos"]
          : ["Configurar credenciales AWS", "Autorizar bucket/prefijo S3", "Mapear PDFs a documentos"],
      source: payload.data.source,
    },
    { status: 202 },
  );
}
