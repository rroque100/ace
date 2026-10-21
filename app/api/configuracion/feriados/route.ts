import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { type Feriado, parseFeriados } from "@/lib/feriados";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { feriados: unknown };

async function leerFeriados(): Promise<Feriado[]> {
  const rows = await supabaseRest<Row[]>("entity_settings?id=eq.default&select=feriados&limit=1").catch(
    () => [] as Row[],
  );
  return parseFeriados(rows[0]?.feriados);
}

// GET: cualquier usuario autenticado (el cronograma los lee para el cálculo).
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ feriados: await leerFeriados() });
  } catch {
    // Sin la columna aún (SQL no ejecutado) o sin fila: lista vacía, no error.
    return NextResponse.json({ feriados: [] });
  }
}

const putSchema = z.object({
  feriados: z
    .array(
      z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
        nombre: z.string().trim().max(120).optional().default(""),
      }),
    )
    .max(400),
});

// PUT: solo admin. Reemplaza toda la lista de feriados.
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const payload = putSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }
  // Se normaliza (ordena, deduplica, descarta fechas inválidas) antes de guardar.
  const feriados = parseFeriados(payload.data.feriados);

  try {
    await supabaseRest("entity_settings?on_conflict=id", {
      body: JSON.stringify({ id: "default", feriados }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
    await writeAuditLog({
      action: "configuracion.feriados.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { total: feriados.length },
      entityType: "entity_settings",
    });
    return NextResponse.json({ feriados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar los feriados" },
      { status: 500 },
    );
  }
}
