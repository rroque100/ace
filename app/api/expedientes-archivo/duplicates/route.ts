import { NextResponse } from "next/server";
import { getOfficeFilter, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import { type ExpedienteArchivo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,title,sgd_expediente,serie_documento,anio,asunto,materia,oficina,status,file_name,created_at";

// Detecta posibles duplicados del archivo. Busca por:
//   - titulo exacto (case-insensitive, normalizado)
//   - sgd_expediente
//   - serie_documento
// Devuelve el listado de expedientes con la misma clave (sin incluir el opcional
// `excludeId` para que la UI pueda pedir "dame los duplicados de ESTE id" cuando
// está editando).
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();

    const officeFilter = getOfficeFilter(auth.user);

    const url = new URL(request.url);
    const title = url.searchParams.get("title")?.trim();
    const sgd = url.searchParams.get("sgd")?.trim();
    const serie = url.searchParams.get("serie")?.trim();
    const excludeId = url.searchParams.get("excludeId")?.trim();

    if (!title && !sgd && !serie) {
      return NextResponse.json({ error: "Falta al menos un criterio (title, sgd, serie)" }, { status: 400 });
    }

    // Dentro de un arbol logico `or=(...)` la sintaxis de PostgREST es
    // `columna.operador.valor` (con puntos), NO `columna=operador.valor` (esa es
    // para filtros de primer nivel). Ademas, los valores con espacios/puntos/° hay
    // que entrecomillarlos para que el parser no los confunda con delimitadores.
    const quote = (value: string) =>
      `"${encodeURIComponent(value.replace(/"/g, '\\"'))}"`;
    const filters: string[] = [];
    if (title) {
      const safe = title.replace(/[%_]/g, (m) => `\\${m}`);
      filters.push(`title.ilike.${quote(safe)}`);
    }
    if (sgd) filters.push(`sgd_expediente.eq.${quote(sgd)}`);
    if (serie) filters.push(`serie_documento.eq.${quote(serie)}`);

    let query = `expedientes_archivo?select=${SELECT}&status=eq.indexed&order=created_at.desc&limit=10`;
    if (officeFilter) query += `&oficina=eq.${encodeURIComponent(officeFilter)}`;
    if (filters.length > 0) query += `&or=(${filters.join(",")})`;
    if (excludeId) query += `&id=neq.${excludeId}`;

    let duplicates = await supabaseRest<ExpedienteArchivo[]>(query);

    // Post-filter robusto: el filtro PostgREST es case-sensitive, asi que
    // re-verificamos con entitiesMatch (normaliza acentos/mayusculas/espacios).
    if (officeFilter) {
      duplicates = duplicates.filter((d) => entitiesMatch(d.oficina, auth.user.entity));
    }

    // Si no hay nada con numero/sgd/serie, igual devolver los que tengan título similar
    if (duplicates.length === 0 && title) {
      const prefix = title.slice(0, 12).replace(/[%_]/g, (m) => `\\${m}`);
      let fuzzy = `expedientes_archivo?select=${SELECT}&status=eq.indexed&title=ilike.${encodeURIComponent(prefix + "%")}&order=created_at.desc&limit=5${excludeId ? `&id=neq.${excludeId}` : ""}`;
      if (officeFilter) fuzzy += `&oficina=eq.${encodeURIComponent(officeFilter)}`;
      const fuzzy2 = await supabaseRest<ExpedienteArchivo[]>(fuzzy);
      const filteredFuzzy = officeFilter
        ? fuzzy2.filter((d) => entitiesMatch(d.oficina, auth.user.entity))
        : fuzzy2;
      return NextResponse.json({ duplicates: filteredFuzzy, matchType: "fuzzy" });
    }

    return NextResponse.json({ duplicates, matchType: duplicates.length > 0 ? "exact" : "none" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo detectar duplicados" },
      { status: 500 },
    );
  }
}
