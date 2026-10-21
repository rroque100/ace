import { readArchivoFile } from "@/lib/archivo-upload-server";
import { classifyPdfError } from "@/lib/pdf-read-error";
import { NextResponse } from "next/server";
import { requireDecOrAreaUsuaria } from "@/lib/auth";
import { extractExpedienteInventory } from "@/lib/expedientes-archivo-processing";
import { writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Lee el PDF cargado y devuelve los datos detectados (numero/fecha/asunto/materia/
// remitente/destinatario/resumen/folios) para autocompletar el formulario de
// registro del archivo fisico. No guarda nada ni indexa.
export async function POST(request: Request) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }

    const formData = await request.formData();
    const file = await readArchivoFile(formData, auth.user.id);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" ? titleValue.trim() : "";
    // Reintento manual ("Volver a analizar"): salta la cache de OCR. La visión
    // no es 100% determinista — un mal resultado que superó el umbral de
    // caracteres quedaba cacheado para siempre sin forma de superarlo.
    const forceRefresh = formData.get("forceRefresh") === "true";

    const inventory = await extractExpedienteInventory(file, title, { skipCache: forceRefresh });

    await writeAuditLog({
      action: "expedientes.extract",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, extractionMethod: inventory.extractionMethod },
      entityType: "expediente_extract",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    const failure = classifyPdfError(error);
    console.error("[archivo/extract]", error);
    return NextResponse.json(
      { error: failure.message, retryable: failure.retryable },
      { status: failure.status },
    );
  }
}
