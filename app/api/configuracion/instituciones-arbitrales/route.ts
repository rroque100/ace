import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import {
  type InstitucionArbitralCatalogo,
  parseCatalogoInstituciones,
} from "@/lib/catalogo-instituciones-arbitrales";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { instituciones_arbitrales: unknown };

async function leer(): Promise<InstitucionArbitralCatalogo[]> {
  const rows = await supabaseRest<Row[]>(
    "entity_settings?id=eq.default&select=instituciones_arbitrales&limit=1",
  ).catch(() => [] as Row[]);
  return parseCatalogoInstituciones(rows[0]?.instituciones_arbitrales);
}

// GET: cualquier usuario autenticado (A3 lo lee para el desplegable de solución
// de controversias).
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ instituciones: await leer() });
  } catch {
    // Sin la columna aún (SQL no ejecutado) o sin fila: lista vacía, no error.
    return NextResponse.json({ instituciones: [] });
  }
}

const putSchema = z.object({
  instituciones: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        nombre: z.string().trim().min(1).max(200),
        ruc: z
          .string()
          .trim()
          .max(11)
          .regex(/^(\d{11})?$/, "El RUC debe tener 11 dígitos")
          .optional()
          .default(""),
      }),
    )
    .max(300),
});

// PUT: solo admin. Reemplaza toda la lista (mismo patrón que feriados).
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const payload = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Solicitud inválida", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  // Se normaliza (recorta, reasigna ids únicos, descarta sin nombre) antes de guardar.
  const instituciones = parseCatalogoInstituciones(payload.data.instituciones);

  try {
    await supabaseRest("entity_settings?on_conflict=id", {
      body: JSON.stringify({ id: "default", instituciones_arbitrales: instituciones }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
    await writeAuditLog({
      action: "configuracion.instituciones_arbitrales.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { total: instituciones.length },
      entityType: "entity_settings",
    });
    return NextResponse.json({ instituciones });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudieron guardar las instituciones arbitrales",
      },
      { status: 500 },
    );
  }
}
