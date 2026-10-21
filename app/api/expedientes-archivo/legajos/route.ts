import { NextResponse } from "next/server";
import { getArchivoScopeLevel, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import type { ExpedienteLegajo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,sgd_expediente,serie_documento,anio,asunto,materia,oficina,oficina_id,tipo_almacenamiento,nro_archivador,nro_paquete,nro_estante,nro_piso,nro_local,documentos_count,documentos_error_count,documentos_pending_count,uploaded_by,created_at";

// Busca/lista legajos: base del selector "añadir documento a legajo existente"
// del wizard de Subir (fase de UI, fuera de este plan). Mismo modelo de scope
// que GET /api/expedientes-archivo: admin todo; jefe su oficina; el resto solo
// lo que subió.
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    // Clave propia ("legajos-list"), no genérica "list": esa cadena la
    // comparte GET /api/expedientes-archivo, y sin distinguirlas ambas rutas
    // gastaban del mismo contador de rate limit sin que ninguna lo supiera.
    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "legajos-list"), RATE_LIMITS.search);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

    const scope = getArchivoScopeLevel(auth.user);
    const useOficinaId = scope === "oficina" && Boolean(auth.user.oficinaId);
    const scopeClause = () => {
      if (scope === "oficina") {
        return useOficinaId
          ? `&oficina_id=eq.${encodeURIComponent(auth.user.oficinaId ?? "")}`
          : `&oficina=eq.${encodeURIComponent(auth.user.entity ?? "")}`;
      }
      if (scope === "own") {
        return `&uploaded_by=eq.${encodeURIComponent(auth.user.id)}`;
      }
      return "";
    };

    let query = `expedientes_archivo_legajos?select=${SELECT}&order=created_at.desc&limit=${limit}`;
    query += scopeClause();
    if (q) {
      // Dentro de un arbol logico or=(...) la sintaxis de PostgREST es
      // columna.operador.valor (con puntos); los valores con espacios/°/comas
      // van entrecomillados para que el parser no los confunda con delimitadores.
      const quote = (value: string) => `"${encodeURIComponent(value.replace(/"/g, '\\"'))}"`;
      const safe = q.replace(/[%_]/g, (m) => `\\${m}`);
      query += `&or=(sgd_expediente.ilike.${quote(`%${safe}%`)},serie_documento.ilike.${quote(`%${safe}%`)},asunto.ilike.${quote(`%${safe}%`)})`;
    }

    let legajos = await supabaseRest<ExpedienteLegajo[]>(query);

    // Post-filtro robusto: el filtro PostgREST por texto es case-sensitive, así
    // que re-verificamos con entitiesMatch (normaliza acentos/mayúsculas/espacios).
    if (scope === "oficina" && !useOficinaId) {
      legajos = legajos.filter((l) => entitiesMatch(l.oficina, auth.user.entity));
    }

    return NextResponse.json({ legajos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo listar los legajos", legajos: [] },
      { status: 503 },
    );
  }
}
