import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { datosConsentimiento } from "@/lib/consentimiento-docx-datos";
import { generarConsentimiento } from "@/lib/consentimiento-docx";
import { supabaseUserRest } from "@/lib/supabase-server";
import type { HitosMap } from "@/lib/procurement-fases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/{id}/fase2/consentimiento-docx → la Declaración de
// Consentimiento de la Buena Pro (B8) en Word. 409 si B8 todavía no está
// "hecho".
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const [proceso] = await supabaseUserRest<Array<{ nomenclature: string; hitos: HitosMap | null }>>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=nomenclature,hitos`,
    );
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const datos = datosConsentimiento(proceso.nomenclature, proceso.hitos ?? {});
    if (!datos) {
      return NextResponse.json(
        { error: "El paso B8 (Consentimiento de la Buena Pro) todavía no está cerrado." },
        { status: 409 },
      );
    }

    const buffer = await generarConsentimiento(datos);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="Consentimiento-Buena-Pro-${proceso.nomenclature}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el documento" },
      { status: 500 },
    );
  }
}
