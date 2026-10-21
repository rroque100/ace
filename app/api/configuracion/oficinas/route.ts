import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { seedCounters } from "@/lib/oficinas";
import { esIdSeguro, getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";
import {
  formatDocumentNumber,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "@/lib/document-number";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = TIPOS_DOCUMENTO;
type Tipo = TipoDocumento;

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
  activo: boolean;
  gestiona_contrataciones: boolean;
};
type CounterRow = { oficina_id: string; tipo: Tipo; siguiente: number; sufijo?: string | null };

const OFI_SELECT =
  "id,nombre,entidad,ruc,responsable_nombre,responsable_cargo,sufijo,ancho,membrete_path,activo,gestiona_contrataciones";

function text(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

function fmt(tipo: string, siguiente: number, ancho: number, sufijo: string | null): string {
  // Formato oficial peruano compartido: lib/document-number.ts
  return formatDocumentNumber({ tipo, siguiente, ancho, sufijo });
}

async function listOficinas(year: number) {
  const [oficinas, counters] = await Promise.all([
    // Sin `.catch`: si la lista de oficinas falla, esta pantalla no tiene nada
    // que enseñar. Devolver [] hacía pasar un fallo por "no hay oficinas", y
    // desde aquí se administran.
    supabaseRest<OficinaRow[]>(`expedientes_oficinas?select=${OFI_SELECT}&order=created_at.asc`),
    // Contadores del ejercicio. Ya no hay cadena de reintentos por columnas
    // ausentes: `year` y `sufijo` existen, y esa cadena solo servía para leer
    // las siglas de otro año como si fueran de este.
    supabaseRest<CounterRow[]>(
      `expedientes_doc_counters?select=oficina_id,tipo,siguiente,sufijo&year=eq.${year}`,
    ),
  ]);
  // Índice O(1) por (oficina, tipo): antes se hacía `counters.find` DENTRO del
  // doble bucle oficinas × tipos, recorriendo el array entero de contadores en
  // cada celda —O(oficinas × tipos × contadores), ~160 k comparaciones con 57
  // oficinas × 7 tipos × 400 contadores en cada mutación de oficina—.
  const porOficinaTipo = new Map<string, CounterRow>();
  for (const c of counters) porOficinaTipo.set(`${c.oficina_id}|${c.tipo}`, c);
  return oficinas.map((o) => ({
    ...o,
    membrete: Boolean(o.membrete_path),
    // enabled = existe la fila del contador: la oficina EMITE ese tipo.
    counters: TIPOS.map((tipo) => {
      const c = porOficinaTipo.get(`${o.id}|${tipo}`);
      const siguiente = c?.siguiente ?? 1;
      const sufijo = c?.sufijo ?? null;
      return {
        tipo,
        siguiente,
        sufijo,
        enabled: Boolean(c),
        // El sufijo del TIPO manda; si no tiene, se usa el de la oficina.
        preview: fmt(tipo, siguiente, o.ancho, sufijo ?? o.sufijo),
      };
    }),
  }));
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const year = getYearFromRequest(request);
    return NextResponse.json({ oficinas: await listOficinas(year) });
  } catch (error) {
    // 500, no 200: desde esta pantalla se ADMINISTRAN las oficinas. Una lista
    // vacía con estado 200 se veía igual que "aún no hay ninguna", e invitaba a
    // volver a crear lo que ya existe.
    console.error("[configuracion/oficinas] no se pudieron listar:", error);
    return NextResponse.json(
      { oficinas: [], error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const year = getYearFromRequest(request);
    const body = await request.json();
    if (!text(body.nombre)) {
      return NextResponse.json({ error: "El nombre de la oficina es obligatorio" }, { status: 400 });
    }
    const [created] = await supabaseRest<Array<{ id: string }>>("expedientes_oficinas?select=id", {
      body: JSON.stringify({
        nombre: text(body.nombre),
        entidad: text(body.entidad),
        ruc: text(body.ruc, 20),
        responsable_nombre: text(body.responsable_nombre),
        responsable_cargo: text(body.responsable_cargo),
        sufijo: text(body.sufijo, 60),
        ancho: int(body.ancho, 1, 6, 3),
        activo: body.activo !== false,
        created_by: auth.user.id,
      }),
      method: "POST",
    });
    if (created?.id) await seedCounters(created.id, year);

    await writeAuditLog({
      action: "oficinas.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nombre: text(body.nombre) },
      entityId: created?.id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas(year), id: created?.id ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la oficina" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const year = getYearFromRequest(request);
    const body = await request.json();
    const id = text(body.id, 60);
    if (!id) return NextResponse.json({ error: "Falta el id de la oficina" }, { status: 400 });
    // El id se interpola en el filtro: si no es un UUID, no se toca la base.
    if (!esIdSeguro(id)) return NextResponse.json({ error: "Id de oficina inválido" }, { status: 400 });

    await supabaseRest(`expedientes_oficinas?id=eq.${id}`, {
      body: JSON.stringify({
        nombre: text(body.nombre) ?? "Oficina",
        entidad: text(body.entidad),
        responsable_nombre: text(body.responsable_nombre),
        responsable_cargo: text(body.responsable_cargo),
        // ruc y sufijo ya no estan en el formulario de Areas: solo se tocan
        // si el cliente los envia (import Excel, scripts). El sufijo por tipo
        // vive en expedientes_doc_counters (pestaña Numeracion).
        ...("ruc" in body ? { ruc: text(body.ruc, 20) } : {}),
        ...("sufijo" in body ? { sufijo: text(body.sufijo, 60) } : {}),
        ...("gestiona_contrataciones" in body
          ? { gestiona_contrataciones: body.gestiona_contrataciones === true }
          : {}),
        ancho: int(body.ancho, 1, 6, 3),
        activo: body.activo !== false,
        updated_at: new Date().toISOString(),
      }),
      method: "PATCH",
    });

    // Numeración: upsert de los contadores por tipo (nº inicial editable).
    if (Array.isArray(body.counters)) {
      const rows = body.counters
        .filter((c: { tipo?: string }) => TIPOS.includes(c.tipo as Tipo))
        .map((c: { tipo: string; siguiente?: unknown }) => ({
          oficina_id: id,
          tipo: c.tipo,
          siguiente: int(c.siguiente, 1, 999999, 1),
          year,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        await supabaseRest("expedientes_doc_counters", {
          body: JSON.stringify(rows),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          method: "POST",
        });
      }
    }

    await writeAuditLog({
      action: "oficinas.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, nombre: text(body.nombre) },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas(year) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la oficina" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const year = getYearFromRequest(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    // Sin esta guarda, un id con `&` convierte el borrado de UNA oficina en masivo.
    if (!esIdSeguro(id)) return NextResponse.json({ error: "Id de oficina inválido" }, { status: 400 });
    // La fila es lo único que apunta a su hoja membretada: si se borra sin más,
    // el PDF se queda en el bucket sin que nadie pueda encontrarlo ni borrarlo.
    const [conMembrete] = await supabaseRest<Array<{ membrete_path: string | null; membrete_bucket: string | null }>>(
      `expedientes_oficinas?id=eq.${id}&select=membrete_path,membrete_bucket`,
    ).catch(() => []);
    await supabaseRest(`expedientes_oficinas?id=eq.${id}`, { method: "DELETE" });
    if (conMembrete?.membrete_path) {
      const { deleteStorageObjects } = await import("@/lib/supabase-server");
      const { storageBucket } = getSupabaseServerConfig();
      await deleteStorageObjects(conMembrete.membrete_bucket ?? storageBucket, [
        conMembrete.membrete_path,
      ]).catch(() => undefined);
    }
    await writeAuditLog({
      action: "oficinas.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });
    return NextResponse.json({ oficinas: await listOficinas(year) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar" }, { status: 500 });
  }
}
