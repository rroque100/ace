import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { formatDocumentNumber } from "@/lib/document-number";
import { entitiesMatch } from "@/lib/entity-utils";

export const dynamic = "force-dynamic";

type EntityRow = { city?: string | null };
type OficinaRow = { id: string; nombre: string; entidad?: string | null; sufijo?: string | null; ancho?: number };
type CounterRow = { siguiente: number; sufijo?: string | null };

type CounterInsert = { oficina_id: string; tipo: string; siguiente: number };

async function findOficina(oficinaId: string | null, entity: string | null): Promise<OficinaRow | undefined> {
  // 1. Resolucion directa por UUID.
  if (oficinaId) {
    const rows = await supabaseRest<OficinaRow[]>(
      `expedientes_oficinas?id=eq.${encodeURIComponent(oficinaId)}&select=id,nombre,sufijo,ancho&limit=1`,
    ).catch(() => []);
    if (rows?.[0]) return rows[0];
  }
  if (!entity) return undefined;
  // 2. Coincidencia por nombre o entidad con PostgREST (exacta y fuzzy).
  for (const column of ["nombre", "entidad"] as const) {
    let rows = await supabaseRest<OficinaRow[]>(
      `expedientes_oficinas?${column}=eq.${encodeURIComponent(entity)}&select=id,nombre,entidad,sufijo,ancho&limit=5`,
    ).catch(() => []);
    if (!rows?.length) {
      rows = await supabaseRest<OficinaRow[]>(
        `expedientes_oficinas?${column}=ilike.${encodeURIComponent(`%${entity}%`)}&select=id,nombre,entidad,sufijo,ancho&limit=5`,
      ).catch(() => []);
    }
    if (rows?.length) {
      const match = rows.find((r) => entitiesMatch(r.nombre, entity) || entitiesMatch(r.entidad, entity));
      if (match) return match;
      if (rows.length === 1) return rows[0];
      rows.sort((a, b) => a.nombre.length - b.nombre.length);
      return rows[0];
    }
  }
  return undefined;
}

// GET /api/contratos-sie/defaults
// Devuelve ciudad institucional y N° de contrato pre-llenado (sufijo + siguiente)
// basado en la oficina del usuario autenticado.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    let city = "";
    try {
      const [entity] = await supabaseRest<EntityRow[]>(
        "entity_settings?id=eq.default&select=city&limit=1",
      );
      city = entity?.city ?? "";
    } catch {
      // city column may not exist yet
    }

    let numeroContrato = "";
    const oficinaId = auth.user.oficinaId;
    const entity = auth.user.entity;
    try {
      let oficina = await findOficina(oficinaId ?? null, entity);
      // 3. Fallback final: buscar la primera oficina activa con contador CONTRATO.
      if (!oficina) {
        const conContrato = await supabaseRest<Array<{ oficina_id: string }>>(
          "expedientes_doc_counters?tipo=eq.CONTRATO&select=oficina_id&limit=1",
        ).catch(() => []);
        if (conContrato?.[0]) {
          const rows = await supabaseRest<OficinaRow[]>(
            `expedientes_oficinas?id=eq.${encodeURIComponent(conContrato[0].oficina_id)}&select=id,nombre,sufijo,ancho&limit=1`,
          ).catch(() => []);
          oficina = rows?.[0];
        }
      }
      if (oficina) {
        const counters = await supabaseRest<CounterRow[]>(
          `expedientes_doc_counters?oficina_id=eq.${oficina.id}&tipo=eq.CONTRATO&select=siguiente,sufijo&limit=1`,
        );
        let c = counters?.[0];
        // Si no existe el contador CONTRATO, crearlo con siguiente=1.
        if (!c) {
          await supabaseRest("expedientes_doc_counters", {
            body: JSON.stringify({
              oficina_id: oficina.id,
              siguiente: 1,
              tipo: "CONTRATO",
            } satisfies CounterInsert),
            headers: { Prefer: "resolution=merge-duplicates" },
            method: "POST",
          }).catch(() => undefined);
          c = { siguiente: 1, sufijo: null };
        }
        const siguiente = c.siguiente ?? 1;
        const sufijo = c.sufijo ?? oficina.sufijo ?? null;
        numeroContrato = formatDocumentNumber({
          siguiente,
          ancho: oficina.ancho ?? 3,
          sufijo,
          tipo: "CONTRATO",
        });
      }
    } catch (e) {
      console.error("GET /api/contratos-sie/defaults inner error:", e);
    }

    console.debug("GET /api/contratos-sie/defaults result:", { city, numeroContrato, oficinaId: auth.user.oficinaId, entity: auth.user.entity });
    return NextResponse.json({ city, numeroContrato });
  } catch (e) {
    console.error("GET /api/contratos-sie/defaults error:", e);
    return NextResponse.json({ city: "", numeroContrato: "" });
  }
}
