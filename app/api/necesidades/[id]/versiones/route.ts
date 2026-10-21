import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type VersionNecesidad = {
  id: string;
  snapshot: Record<string, unknown>;
  transicion: string | null;
  etiqueta: string | null;
  autor_referencia: string | null;
  autor_rol: string | null;
  created_at: string;
};

// GET /api/necesidades/[id]/versiones
//
// Snapshots del requerimiento (D3), en orden. El cliente compara los dos últimos
// relevantes (versión del área usuaria vs propuesta de la DEC) para el diff del
// ciclo de no objeción. RLS colaborativo, acceso con el JWT del usuario.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const versiones = await supabaseUserRest<VersionNecesidad[]>(
      auth.user.accessToken,
      `necesidad_versiones?necesidad_id=eq.${id}&select=id,snapshot,transicion,etiqueta,autor_referencia,autor_rol,created_at&order=created_at.asc`,
    );
    return NextResponse.json({ versiones });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las versiones", versiones: [] },
      { status: 500 },
    );
  }
}
