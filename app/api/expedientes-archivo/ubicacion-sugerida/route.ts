import { NextResponse } from "next/server";
import { getOfficeFilter, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import { type ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOC_SELECT =
  "id,title,serie_documento,anio,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,created_at";

type UbicacionSugerida = {
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
};

function pickUbicacion(exp: ExpedienteArchivo): UbicacionSugerida {
  return {
    tipo_almacenamiento: exp.tipo_almacenamiento ?? null,
    nro_archivador: exp.nro_archivador ?? null,
    nro_paquete: exp.nro_paquete ?? null,
    empastado: exp.empastado ?? null,
    color_archivador: exp.color_archivador ?? null,
    nro_estante: exp.nro_estante ?? null,
    nro_piso: exp.nro_piso ?? null,
    nro_local: exp.nro_local ?? null,
  };
}

function hasUbicacion(u: UbicacionSugerida): boolean {
  return Boolean(
    u.tipo_almacenamiento ||
      u.nro_archivador ||
      u.nro_paquete ||
      u.color_archivador ||
      u.nro_estante ||
      u.nro_piso ||
      u.nro_local,
  );
}

// Sugiere el siguiente nro de paquete a partir del máximo numérico ya usado
// (en el ámbito serie/año si se indicó). Devuelve null si ninguno es numérico.
function nextPaquete(values: Array<string | null>): string | null {
  let max: number | null = null;
  for (const v of values) {
    if (!v) continue;
    const m = v.match(/\d+/);
    if (!m) continue;
    const n = Number.parseInt(m[0], 10);
    if (Number.isFinite(n)) {
      max = max === null ? n : Math.max(max, n);
    }
  }
  return max === null ? null : String(max + 1);
}

// Sugiere la ubicación física para un nuevo expediente, basándose en lo que ya
// está archivado (no es texto libre: refleja decisiones reales del archivo).
//   - `ultima`: la ubicación del último expediente con ubicación registrada,
//     filtrando por serie/año cuando se indica (lo más probable: misma caja).
//   - `siguientePaquete`: máximo nro_paquete numérico usado + 1.
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();

    const officeFilter = getOfficeFilter(auth.user);

    const url = new URL(request.url);
    const serie = url.searchParams.get("serie")?.trim();
    const anio = url.searchParams.get("anio")?.trim();

    let scope = `expedientes_archivo?select=${LOC_SELECT}&order=created_at.desc&limit=50`;
    if (officeFilter) scope += `&oficina=eq.${encodeURIComponent(officeFilter)}`;
    if (serie) scope += `&serie_documento=eq.${encodeURIComponent(serie)}`;
    if (anio) scope += `&anio=eq.${encodeURIComponent(anio)}`;

    let rows = await supabaseRest<ExpedienteArchivo[]>(scope);

    // Post-filter robusto: re-verificar oficina con normalizacion de acentos.
    if (officeFilter) {
      rows = rows.filter((r) => entitiesMatch(r.oficina, auth.user.entity));
    }

    const conUbicacion = rows.map(pickUbicacion).filter(hasUbicacion);
    const ultima = conUbicacion[0] ?? null;
    const siguientePaquete = nextPaquete(rows.map((r) => r.nro_paquete ?? null));

    return NextResponse.json({
      ultima,
      siguientePaquete,
      basadoEn: serie || anio ? { serie: serie ?? null, anio: anio ?? null } : null,
    });
  } catch {
    // No es crítico: la sugerencia es una ayuda, nunca debe romper la subida.
    return NextResponse.json(
      { ultima: null, siguientePaquete: null, basadoEn: null },
      { status: 200 },
    );
  }
}
