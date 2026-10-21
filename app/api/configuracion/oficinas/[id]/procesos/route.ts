import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const processTypeSchema = z.object({
  active: z.boolean().default(true),
  category: z.enum(["competitivo", "no_competitivo", "contrato_menor"]).default("competitivo"),
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  frequentMunicipality: z.boolean().default(false),
  label: z.string().trim().min(3).max(140),
  legalBasis: z.string().trim().max(260).optional().or(z.literal("")),
  object: z.string().trim().max(160).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const saveSchema = z.object({
  processTypes: z.array(processTypeSchema).min(1).max(50),
});

type ProcessTypeRow = {
  active: boolean;
  category?: string | null;
  code: string;
  description: string | null;
  frequent_municipality?: boolean | null;
  label: string;
  legal_basis?: string | null;
  metadata?: Record<string, unknown>;
  object?: string | null;
  sort_order: number;
  oficina_id?: string | null;
  updated_at: string | null;
};

type EntitySettingsRow = {
  id: string;
  metadata: Record<string, unknown>;
};

function readOficinaProcessTypes(
  metadata: Record<string, unknown>,
  oficinaId: string,
): ProcessTypeRow[] | null {
  const officePt = metadata?.office_process_types as
    | Record<string, unknown>
    | undefined;
  if (!officePt) return null;
  const types = officePt[oficinaId] as ProcessTypeRow[] | undefined;
  if (!types || !Array.isArray(types)) return null;
  return types;
}

function setOficinaProcessTypes(
  metadata: Record<string, unknown>,
  oficinaId: string,
  types: ProcessTypeRow[],
): Record<string, unknown> {
  const officePt = { ...((metadata?.office_process_types as Record<string, unknown>) ?? {}) };
  officePt[oficinaId] = types;
  return { ...metadata, office_process_types: officePt };
}

// GET /api/configuracion/oficinas/[id]/procesos?year=2026
// Devuelve los tipos de proceso asignados a esta oficina. Si la oficina no
// tiene configuracion propia, devuelve los defaults de la entidad.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const year = getYearFromRequest(request);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }

    // 1. Buscar en entity_settings.metadata.office_process_types
    // Sin filtro de año: `entity_settings` es una fila única (PK `id`). Con el
    // filtro, un ejercicio sin fila devolvía 0 resultados SIN error y la oficina
    // parecía no tener procesos configurados.
    const entityRows = await supabaseRest<EntitySettingsRow[]>(
      `entity_settings?id=eq.default&select=id,metadata&limit=1`,
    ).catch(() => []);

    if (entityRows.length > 0) {
      const officeTypes = readOficinaProcessTypes(entityRows[0].metadata, id);
      if (officeTypes) {
        return NextResponse.json({
          processTypes: officeTypes.map((item) => ({
            active: item.active,
            category: item.category ?? "competitivo",
            code: item.code,
            description: item.description ?? "",
            frequentMunicipality: Boolean(item.frequent_municipality),
            label: item.label,
            legalBasis: item.legal_basis ?? "",
            object: item.object ?? "",
            sortOrder: item.sort_order,
            oficinaId: id,
            updatedAt: item.updated_at,
          })),
        });
      }
    }

    // 2. Fallback: defaults de la entidad (process_type_settings)
    const fallback = await supabaseRest<ProcessTypeRow[]>(
      `process_type_settings?select=code,label,description,active,category,object,legal_basis,frequent_municipality,sort_order,updated_at&year=eq.${year}&order=sort_order.asc,label.asc`,
    ).catch(() => []);

    return NextResponse.json({
      processTypes: fallback.map((item) => ({
        active: item.active,
        category: item.category ?? "competitivo",
        code: item.code,
        description: item.description ?? "",
        frequentMunicipality: Boolean(item.frequent_municipality),
        label: item.label,
        legalBasis: item.legal_basis ?? "",
        object: item.object ?? "",
        sortOrder: item.sort_order,
        oficinaId: id,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los procesos de la oficina" },
      { status: 500 },
    );
  }
}

// PUT /api/configuracion/oficinas/[id]/procesos?year=2026
// Body: { processTypes: [...] }
// Guarda los tipos de proceso para esta oficina en entity_settings.metadata.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    // Sin `year`: este PUT solo escribe en `entity_settings.metadata`, que no es
    // por ejercicio. Los tipos a nivel entidad (`process_type_settings`, esos sí
    // anuales) se guardan desde /api/configuracion/settings.
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const parsed = saveSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Leer metadata actual. SIN filtro de año, y no es un detalle: en esta
    // columna vive la configuración de procesos de TODAS las oficinas, y más
    // abajo se reescribe entera. Con el filtro puesto, un ejercicio sin fila
    // devolvía 0 resultados sin error, `currentMetadata` caía a `{}` y guardar
    // una sola oficina borraba la de todas las demás.
    const entityRows = await supabaseRest<EntitySettingsRow[]>(
      `entity_settings?id=eq.default&select=id,metadata&limit=1`,
    );

    const currentMetadata = entityRows.length > 0
      ? (entityRows[0].metadata ?? {})
      : {};

    const ptRows: ProcessTypeRow[] = parsed.data.processTypes.map((item) => ({
      active: item.active,
      category: item.category,
      code: item.code,
      description: item.description || null,
      frequent_municipality: item.frequentMunicipality,
      label: item.label,
      legal_basis: item.legalBasis || null,
      object: item.object || null,
      sort_order: item.sortOrder,
      oficina_id: id,
      updated_at: new Date().toISOString(),
    }));

    const newMetadata = setOficinaProcessTypes(currentMetadata, id, ptRows);

    await supabaseRest("entity_settings?on_conflict=id", {
      // Sin `year`: la fila describe a la entidad, no a un ejercicio. Sellarla
      // con el año del selector era lo que la dejaba fuera de la lectura.
      body: JSON.stringify({ id: "default", metadata: newMetadata, updated_by: auth.user.id }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });

    await writeAuditLog({
      action: "oficinas.procesos.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, processTypeCount: ptRows.length },
      entityId: id,
      entityType: "oficina",
      module: "configuracion",
    });

    return NextResponse.json({
      ok: true,
      processTypes: ptRows.map((item) => ({
        active: item.active,
        category: item.category,
        code: item.code,
        description: item.description ?? "",
        frequentMunicipality: Boolean(item.frequent_municipality),
        label: item.label,
        legalBasis: item.legal_basis ?? "",
        object: item.object ?? "",
        sortOrder: item.sort_order,
        oficinaId: id,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar los procesos de la oficina" },
      { status: 500 },
    );
  }
}
