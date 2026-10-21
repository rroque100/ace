import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_DEFAULT,
  type TipoDocumento,
} from "@/lib/document-number";
import {
  esIdSeguro,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS = TIPOS_DOCUMENTO;
type Tipo = TipoDocumento;

// Esquema de un counter individual (solo los tipos HABILITADOS de la oficina)
const CounterSchema = z.object({
  tipo: z.enum(TIPOS),
  siguiente: z.coerce.number().int().min(1).max(999999),
  // Sigla propia del tipo (ej. "MDCH/LOG"); vacia = usa la de la oficina.
  sufijo: z.string().trim().max(60).nullish(),
});

// Esquema del body: { counters: [{ tipo, siguiente }, ...] }
// Los tipos NO incluidos se deshabilitan (se elimina su contador).
const BodySchema = z.object({
  counters: z.array(CounterSchema).min(1).max(20),
});

type CounterRow = { oficina_id: string; tipo: Tipo; siguiente: number; sufijo?: string | null; year: number };

// Upsert resiliente: `year` y `sufijo` son columnas opcionales cuya migración
// puede estar pendiente. Si PostgREST rechaza la escritura porque una de esas
// columnas no existe, se reintenta sin ese campo (primero year, luego sufijo).
// Así la numeración se guarda igual mientras la migración no se haya aplicado.
async function upsertCounters(rows: CounterRow[]): Promise<void> {
  let payload: Record<string, unknown>[] = rows;
  // A lo sumo dos degradaciones (year, sufijo) + el intento base.
  for (let intento = 0; intento < 3; intento++) {
    try {
      await supabaseRest("expedientes_doc_counters", {
        body: JSON.stringify(payload),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        method: "POST",
      });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/year/i.test(msg) && payload[0] && "year" in payload[0]) {
        payload = payload.map(({ year: _omit, ...rest }) => rest);
        continue;
      }
      if (/sufijo/i.test(msg) && payload[0] && "sufijo" in payload[0]) {
        payload = payload.map(({ sufijo: _omit, ...rest }) => rest);
        continue;
      }
      throw err;
    }
  }
}

// Borra los tipos NO incluidos. Filtra por year si la columna existe; si no,
// reintenta sin ese filtro (borra por oficina + tipo).
async function borrarNoIncluidos(id: string, year: number, enabledTipos: string): Promise<void> {
  const inList = encodeURIComponent(enabledTipos);
  try {
    await supabaseRest(
      `expedientes_doc_counters?oficina_id=eq.${id}&year=eq.${year}&tipo=not.in.(${inList})`,
      { method: "DELETE" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!/year/i.test(msg)) return; // otro error: no arriesgar un borrado amplio
    await supabaseRest(
      `expedientes_doc_counters?oficina_id=eq.${id}&tipo=not.in.(${inList})`,
      { method: "DELETE" },
    ).catch(() => undefined);
  }
}

// GET /api/configuracion/oficinas/[id]/numeracion?year=2026
// Devuelve los contadores de la oficina (crea defaults si no existen).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const year = getYearFromRequest(request);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    // El id se interpola en los filtros de contadores: se exige forma de UUID.
    if (!esIdSeguro(id)) {
      return NextResponse.json({ error: "Id de oficina inválido" }, { status: 400 });
    }
    // Incluir sufijo es CLAVE: sin el, un ciclo leer->guardar borra las siglas.
    // `year` y `sufijo` son columnas opcionales: si falta `year`, se reintenta
    // SIN el filtro de año pero CONSERVANDO `sufijo`; solo si tampoco existe
    // `sufijo` se cae al mínimo.
    const rows = await supabaseRest<CounterRow[]>(
      `expedientes_doc_counters?oficina_id=eq.${id}&year=eq.${year}&select=oficina_id,tipo,siguiente,sufijo`,
    ).catch(() =>
      supabaseRest<CounterRow[]>(
        `expedientes_doc_counters?oficina_id=eq.${id}&select=oficina_id,tipo,siguiente,sufijo`,
      ).catch(() =>
        supabaseRest<CounterRow[]>(
          `expedientes_doc_counters?oficina_id=eq.${id}&select=oficina_id,tipo,siguiente`,
        ).catch(() => []),
      ),
    );

    // Si la oficina es nueva y no tiene contadores, los creamos con siguiente=1.
    if (rows.length === 0) {
      const seed: CounterRow[] = TIPOS_DOCUMENTO_DEFAULT.map((tipo) => ({
        oficina_id: id,
        tipo,
        siguiente: 1,
        year,
      }));
      await upsertCounters(seed).catch(() => undefined);
      return NextResponse.json({ counters: seed });
    }
    return NextResponse.json({ counters: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener la numeración" },
      { status: 500 },
    );
  }
}

// PUT /api/configuracion/oficinas/[id]/numeracion?year=2026
// Body: { counters: [{ tipo, siguiente }, ...] }
// Reemplaza (upsert) los contadores de la oficina. NO toca la oficina misma.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const year = getYearFromRequest(request);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    // El id se interpola en los filtros de contadores: se exige forma de UUID.
    if (!esIdSeguro(id)) {
      return NextResponse.json({ error: "Id de oficina inválido" }, { status: 400 });
    }
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rows: CounterRow[] = parsed.data.counters.map((c) => ({
      oficina_id: id,
      tipo: c.tipo,
      siguiente: c.siguiente,
      sufijo: c.sufijo?.trim() || null,
      year,
    }));
    // Upsert resiliente a las columnas opcionales (year/sufijo) aún sin migrar.
    await upsertCounters(rows);

    // Los tipos no incluidos quedan DESHABILITADOS: se elimina su contador.
    // (El correlativo de un tipo deshabilitado se pierde; la UI lo advierte.)
    const enabledTipos = rows.map((r) => `"${r.tipo}"`).join(",");
    await borrarNoIncluidos(id, year, enabledTipos);

    await writeAuditLog({
      action: "oficinas.numeracion.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, counters: rows.map((r) => `${r.tipo}=${r.siguiente}`) },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });

    return NextResponse.json({ ok: true, counters: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la numeración" },
      { status: 500 },
    );
  }
}
