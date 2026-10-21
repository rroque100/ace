import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PerfilMin = {
  nombre_completo: string | null;
  grado_academico: string | null;
  cargo: string | null;
};

// GET /api/personas
//
// Padrón de personas de Configuración › Usuarios, para escribir un nombre como
// se FIRMA en los documentos: con su grado académico y en orden natural
// ("CPC. JUAN ROJAS MAYTAN").
//
// Hace falta porque el resto de tablas guardan el nombre como el padrón civil
// —apellidos primero y sin grado— y de forma inconsistente: en `necesidades`
// conviven "CCAHUANA MENDOZA NILDO" y "ABEL HURTADO PALOMINO". Reordenar a
// ciegas corrompería el segundo; emparejar contra esta lista no.
//
// Solo devuelve nombre, grado y cargo: no es un directorio de usuarios y no
// expone correo, rol ni DNI.
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const perfiles = await supabaseRest<PerfilMin[]>(
      "profiles?select=nombre_completo,grado_academico,cargo&nombre_completo=not.is.null&order=nombre_completo.asc",
    ).catch(() => []);
    return NextResponse.json({
      personas: perfiles
        .filter((p) => (p.nombre_completo ?? "").trim())
        .map((p) => ({
          nombre: (p.nombre_completo ?? "").trim(),
          grado: (p.grado_academico ?? "").trim(),
          cargo: (p.cargo ?? "").trim(),
        })),
    });
  } catch {
    // Sin padrón, quien lo consume conserva el nombre que ya tenía.
    return NextResponse.json({ personas: [] });
  }
}
