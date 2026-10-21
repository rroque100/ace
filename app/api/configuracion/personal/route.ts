import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { filaDePersonalRow, type PersonalRow } from "@/lib/personal";
import { getSupabaseServerConfig, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLS =
  "id,codigo,documento,apellido_paterno,apellido_materno,nombres,nombre_completo," +
  "tipo_empleado,estado,estado_civil,sexo,grado_inst,centro_costo,unidad," +
  "codigo_prof,profesion,colegiatura,fecha_ingreso";

/**
 * Total de personas (opcionalmente solo activas), leído del `Content-Range` que
 * PostgREST devuelve con `Prefer: count=exact`. El helper `supabaseUserRest` solo
 * expone el cuerpo, no las cabeceras, así que aquí se hace la petición directa —
 * pidiendo cero filas (`Range: 0-0`)— con el JWT del usuario (respeta RLS).
 */
async function contarPersonal(accessToken: string, soloActivos: boolean): Promise<number> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const filtro = soloActivos ? "&estado=eq.A" : "";
  const res = await fetch(`${supabaseUrl}/rest/v1/personal?select=id${filtro}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase count ${res.status}: ${await res.text()}`);
  const rango = res.headers.get("content-range") ?? "";
  const total = Number(rango.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

// GET /api/configuracion/personal?q=texto&limit=20&estado=activos&withTotal=1
//
// Busca en el padrón por nombre, DNI, código o unidad. Lo consumen la pestaña de
// Configuración (listado + conteo) y el selector de personas de Necesidades y
// Expedientes. Cualquier autenticado puede leer (RLS: personal_read = true), por
// eso `supabaseUserRest` con el JWT del usuario, no el service_role.
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const soloActivos = url.searchParams.get("estado") === "activos";
  const withTotal = url.searchParams.get("withTotal") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);

  const filtros: string[] = [];
  if (soloActivos) filtros.push("estado=eq.A");
  if (q) {
    // Escapamos comas y paréntesis, que separan condiciones en PostgREST, para
    // que un término con esos signos no rompa el `or`.
    const term = q.replace(/[(),*]/g, " ").trim();
    if (term) {
      const like = `*${term}*`;
      filtros.push(
        `or=(nombre_completo.ilike.${like},documento.ilike.${like},codigo.ilike.${like},unidad.ilike.${like})`,
      );
    }
  }

  const query = [`select=${COLS}`, ...filtros, "order=nombre_completo.asc", `limit=${limit}`].join("&");

  try {
    const [filas, total] = await Promise.all([
      supabaseUserRest<PersonalRow[]>(auth.user.accessToken, `personal?${query}`),
      withTotal ? contarPersonal(auth.user.accessToken, soloActivos) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({
      personal: (filas ?? []).map(filaDePersonalRow),
      ...(withTotal ? { total } : {}),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo consultar el padrón";
    // El padrón aún no existe si no se ha corrido docs/supabase/personal.sql:
    // se devuelve vacío en vez de 500 para que la pestaña se pueda abrir y guiar.
    if (/relation .*personal.* does not exist|42P01|Not Found|PGRST205/i.test(msg)) {
      return NextResponse.json({ personal: [], total: 0, sinTabla: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
