import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";
import { caseFieldLimits, type CaseContext } from "@/lib/chat-case-context";
import { type CaseProfile } from "@/lib/case-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Perfil de caso activo guardado EN LA CUENTA (docs/supabase/2026-11-10-perfil-caso-cuenta.sql).
// Antes solo existía en localStorage y no viajaba a otros dispositivos. Toda fila se lee y
// escribe con el JWT del usuario (RLS: solo el dueño). Los hechos del caso nunca se guardan.

type CaseProfileRow = {
  owner_id: string;
  regime: string;
  dates: string;
  object: string;
  saved_at: number;
};

const putSchema = z.object({
  caseContext: z.object({
    regime: z.string().max(caseFieldLimits.regime),
    dates: z.string().max(caseFieldLimits.dates),
    object: z.string().max(caseFieldLimits.object).nullish(),
    facts: z.string().max(caseFieldLimits.facts).optional(),
  }),
  savedAt: z.number().int().min(0),
});

function rowToProfile(row: CaseProfileRow): CaseProfile {
  return {
    regime: row.regime ?? "",
    dates: row.dates ?? "",
    object: row.object ?? "",
    savedAt: row.saved_at ?? 0,
  };
}

function contextToRow(context: CaseContext, savedAt: number, ownerId: string): CaseProfileRow {
  return {
    owner_id: ownerId,
    regime: context.regime.trim().slice(0, caseFieldLimits.regime),
    dates: context.dates.trim().slice(0, caseFieldLimits.dates),
    object: (context.object ?? "").trim().slice(0, caseFieldLimits.object),
    saved_at: savedAt,
  };
}

// La tabla aún no existe (SQL manual sin ejecutar) o la fila no está: la sincronización
// queda no disponible y el cliente sigue con su copia local. Es el único fallo tragado
// y se anuncia con `syncAvailable: false`, no en silencio.
function esTablaAusente(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // PGRST205: schema cache podría no incluir la relación; 404 de PostgREST sin fila.
  return /PGRST205|Could not find the table|404/.test(message);
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const rows = await supabaseUserRest<CaseProfileRow[]>(
      auth.user.accessToken,
      `case_profiles?owner_id=eq.${auth.user.id}&select=owner_id,regime,dates,object,saved_at&limit=1`,
    );
    return NextResponse.json(
      { profile: rows[0] ? rowToProfile(rows[0]) : null, syncAvailable: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (esTablaAusente(error)) {
      return NextResponse.json({ profile: null, syncAvailable: false }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "No se pudo cargar el perfil del caso." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del perfil inválidos." }, { status: 400 });
  }
  const row = contextToRow(parsed.data.caseContext, parsed.data.savedAt, auth.user.id);
  try {
    // Upsert por owner_id (PK). El Prefer combinado hace que PostgREST devuelva la fila.
    const [saved] = await supabaseUserRest<CaseProfileRow[]>("case_profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ profile: saved ? rowToProfile(saved) : row }, { status: 200 });
  } catch (error) {
    if (esTablaAusente(error)) {
      return NextResponse.json({ error: "La sincronización del caso activo aún no está habilitada en la base de datos.", syncAvailable: false }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo guardar el perfil del caso en tu cuenta." }, { status: 503 });
  }
}

export async function DELETE() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    await supabaseUserRest(auth.user.accessToken, `case_profiles?owner_id=eq.${auth.user.id}`, { method: "DELETE" });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (esTablaAusente(error)) {
      return NextResponse.json({ deleted: false, syncAvailable: false }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo quitar el perfil del caso de tu cuenta." }, { status: 503 });
  }
}
