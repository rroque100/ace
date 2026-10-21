import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILAS = 1000;

type Fila = {
  necesidades: Array<{ area_usuaria: string | null; meta_presupuestal: string | null }> | null;
};

// GET /api/processes/facetas
//
// Oficinas y metas que tienen expediente, para llenar esos dos filtros.
//
// Se leen desde los EXPEDIENTES y no desde las necesidades a secas: si se
// sacaran del catálogo completo de necesidades, el desplegable ofrecería
// oficinas cuyas necesidades aún no derivaron en expediente, y elegir una de
// ellas devolvería cero sin explicar por qué.
//
// Con el token del usuario, para que las opciones respeten lo que RLS le deja
// ver: una opción que él no puede consultar es otro filtro que siempre sale
// vacío.
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const filas = await supabaseUserRest<Fila[]>(
      auth.user.accessToken,
      "procurement_processes?select=necesidades(area_usuaria,meta_presupuestal)" +
        `&order=updated_at.desc&limit=${MAX_FILAS}`,
    );

    const oficinas = new Map<string, number>();
    const metas = new Map<string, number>();
    for (const fila of filas) {
      // El embebido llega como array: PostgREST resuelve la relación por
      // `necesidades.process_id`, que es uno-a-muchos aunque en la práctica haya
      // una sola necesidad por expediente.
      for (const nec of fila.necesidades ?? []) {
        const oficina = (nec.area_usuaria ?? "").trim();
        if (oficina) oficinas.set(oficina, (oficinas.get(oficina) ?? 0) + 1);
        const meta = (nec.meta_presupuestal ?? "").trim();
        if (meta) metas.set(meta, (metas.get(meta) ?? 0) + 1);
      }
    }

    const ordenar = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([valor, total]) => ({ valor, total }))
        .sort((a, b) => a.valor.localeCompare(b.valor, "es"));

    return NextResponse.json({ oficinas: ordenar(oficinas), metas: ordenar(metas) });
  } catch {
    // Sin facetas los dos desplegables salen vacíos, pero el resto del listado y
    // la búsqueda siguen funcionando: no se convierte en un error de página.
    return NextResponse.json({ oficinas: [], metas: [] });
  }
}
