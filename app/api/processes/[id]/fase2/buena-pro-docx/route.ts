import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { datosActaBuenaPro } from "@/lib/buena-pro-docx-datos";
import { generarActaBuenaPro } from "@/lib/buena-pro-docx";
import { supabaseUserRest } from "@/lib/supabase-server";
import type { HitosMap } from "@/lib/procurement-fases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/{id}/fase2/buena-pro-docx → el Acta de Otorgamiento de
// la Buena Pro (B7) en Word. 409 si B7 todavía no está "hecho": no se genera
// el acta de un otorgamiento que no ha ocurrido.
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

    const datos = datosActaBuenaPro(proceso.nomenclature, proceso.hitos ?? {});
    if (!datos) {
      return NextResponse.json(
        { error: "El paso B7 (Otorgamiento de la Buena Pro) todavía no está cerrado." },
        { status: 409 },
      );
    }

    const buffer = await generarActaBuenaPro(datos);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="Acta-Buena-Pro-${proceso.nomenclature}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el acta" },
      { status: 500 },
    );
  }
}
