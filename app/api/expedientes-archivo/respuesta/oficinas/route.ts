import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { normalizeEntity } from "@/lib/entity-utils";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";
import { formatDocumentNumber, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/document-number";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OficinaRow = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  membrete_path: string | null;
};
type CounterRow = {
  oficina_id: string;
  tipo: string;
  siguiente: number;
  sufijo?: string | null;
  year: number;
};

// El entity del usuario identifica SU OFICINA (ej. "OFICINA DE LOGISTICA"),
// no la entidad municipal ("SEDE CENTRAL", compartida por todas las oficinas).
// Se compara primero contra el nombre de la oficina; el match por entidad se
// mantiene como compatibilidad para usuarios con entity a nivel entidad.
function officesMatch(oficina: OficinaRow, userEntity: string): boolean {
  const entity = normalizeEntity(userEntity);
  if (!entity) return false;
  return normalizeEntity(oficina.nombre) === entity || normalizeEntity(oficina.entidad) === entity;
}

// GET /api/expedientes-archivo/respuesta/oficinas
// Lista oficinas activas con preview del siguiente correlativo por tipo.
// El listado se filtra segun el rol del usuario:
//   - admin: ve TODAS las oficinas activas
//   - otros (dec/consulta/legal): solo SU oficina (match por nombre o entidad)
// Devuelve ademas `defaultOficinaId` para que el cliente pre-seleccione
// la oficina del usuario sin que tenga que elegir manualmente.
//
// Formato del numero (lib/document-number.ts):
//   {TIPO} N° {NNN}-{AAAA}-{ENTIDAD}/{AREA}
//   OFICIO N° 001-2026-MDCH/GM
export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const [oficinas, counters, entityRows] = await Promise.all([
      supabaseRest<OficinaRow[]>(
        `expedientes_oficinas?activo=eq.true&select=id,nombre,entidad,ruc,responsable_nombre,responsable_cargo,sufijo,ancho,membrete_path&order=nombre.asc`,
      ).catch(() => []),
      // Sin filtrar por año, pero trayendo `year`: abajo se separan las dos
      // preguntas que la clave (oficina_id, tipo, year) mezcla —qué tipos emite
      // la oficina, que no cambia al pasar de ejercicio, y por qué número va la
      // serie de ESTE ejercicio, que sí—.
      supabaseRest<CounterRow[]>(
        `expedientes_doc_counters?select=oficina_id,tipo,siguiente,sufijo,year`,
      ).catch(() => []),
      // Ciudad institucional (Configuracion → Informacion institucional):
      // "Lugar" por defecto del encabezado de todos los documentos.
      supabaseRest<Array<{ city: string | null }>>(
        `entity_settings?id=eq.default&select=city&limit=1`,
      ).catch(() => [] as Array<{ city: string | null }>),
    ]);
    const ciudad = entityRows[0]?.city?.trim() || null;
    // La pestaña Responder no tiene selector de año: emite en el ejercicio en
    // curso, que es cuando se responde un expediente.
    const ejercicio = new Date().getFullYear();

    // Filtro por rol: admin ve todas, demas usuarios solo SU oficina
    // (por oficina_id del perfil o por match de nombre/entidad).
    const userEntity = auth.user.entity ?? null;
    const userOficinaId = auth.user.oficinaId ?? null;
    const isAdmin = Boolean(auth.user.isAdmin);
    const matchesUser = (o: OficinaRow) =>
      o.id === userOficinaId || officesMatch(o, userEntity ?? "");
    const filtered = isAdmin ? oficinas : oficinas.filter(matchesUser);

    // Default: la oficina asignada al usuario; si no hay coincidencia, la
    // primera de la lista filtrada.
    const defaultOficinaId =
      filtered.find(matchesUser)?.id ??
      filtered[0]?.id ??
      null;

    return NextResponse.json({
      ciudad,
      defaultOficinaId,
      isAdmin,
      oficinas: filtered.map((o) => {
        // Tipos habilitados = contadores existentes de la oficina EN CUALQUIER
        // ejercicio (en el orden del catalogo). Que la oficina emita oficios no
        // deja de ser cierto al cambiar de año, y mirar solo el ejercicio en
        // curso habria vaciado la lista cada 1 de enero.
        // Si no tiene ninguno (dato legacy), se ofrece el catalogo completo para
        // no bloquear la emision.
        const own = TIPOS_DOCUMENTO.filter((tipo) =>
          counters.some((x) => x.oficina_id === o.id && x.tipo === tipo),
        );
        const tipos = own.length > 0 ? own : [...TIPOS_DOCUMENTO];
        return {
          id: o.id,
          nombre: o.nombre,
          entidad: o.entidad,
          ruc: o.ruc,
          responsableNombre: o.responsable_nombre,
          responsableCargo: o.responsable_cargo,
          tieneMembrete: Boolean(o.membrete_path),
          tipos,
          previews: Object.fromEntries(
            tipos.map((tipo) => {
              const delTipo = counters.filter((x) => x.oficina_id === o.id && x.tipo === tipo);
              // El correlativo SI es del ejercicio: la serie se reinicia cada
              // año, asi que un ejercicio sin fila propia empieza en 1.
              const c = delTipo.find((x) => x.year === ejercicio) ?? delTipo[0];
              const siguiente = delTipo.find((x) => x.year === ejercicio)?.siguiente ?? 1;
              return [
                tipo,
                formatDocumentNumber({
                  tipo: tipo as TipoDocumento,
                  siguiente,
                  ancho: o.ancho,
                  // El sufijo del TIPO manda; si no tiene, el de la oficina.
                  sufijo: c?.sufijo ?? o.sufijo,
                }),
              ];
            }),
          ) as Partial<Record<TipoDocumento, string>>,
        };
      }),
      totalActivas: oficinas.length,
      userEntity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ciudad: null,
        defaultOficinaId: null,
        isAdmin: false,
        oficinas: [],
        totalActivas: 0,
        userEntity: null,
        error: error instanceof Error ? error.message : "Error",
      },
      { status: 200 },
    );
  }
}
