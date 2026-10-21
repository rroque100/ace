import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { datosConvocatoria } from "@/lib/convocatoria-docx-datos";
import { generarAvisoConvocatoria } from "@/lib/convocatoria-docx";
import { supabaseUserRest } from "@/lib/supabase-server";
import type { HitosMap } from "@/lib/procurement-fases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/{id}/fase2/convocatoria-docx → el aviso de Convocatoria
// (B1) en Word. 409 si B1 todavía no está "hecho".
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const [proceso] = await supabaseUserRest<
      Array<{ nomenclature: string; object_type: string; amount: number | null; hitos: HitosMap | null }>
    >(auth.user.accessToken, `procurement_processes?id=eq.${id}&select=nomenclature,object_type,amount,hitos`);
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const datos = datosConvocatoria(
      { amount: proceso.amount, nomenclature: proceso.nomenclature, objectType: proceso.object_type },
      proceso.hitos ?? {},
    );
    if (!datos) {
      return NextResponse.json(
        { error: "El paso B1 (Convocatoria) todavía no está cerrado." },
        { status: 409 },
      );
    }

    const buffer = await generarAvisoConvocatoria(datos);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="Convocatoria-${proceso.nomenclature}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la convocatoria" },
      { status: 500 },
    );
  }
}
