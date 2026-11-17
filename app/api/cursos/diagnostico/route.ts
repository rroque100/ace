import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { examError } from "@/lib/exam-server";
import { iniciarDiagnostico } from "@/lib/cursos/diagnostico-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// Empieza (o retoma) la prueba diagnóstica del curso. El propietario sale de la sesión; no hay cuerpo que leer.
// Los errores pasan por examError, el mismo traductor del simulador: 409 si hay otro intento en curso y 503 si la
// función aún no existe porque falta correr docs/supabase/2026-11-17-cursos-prueba-diagnostica.sql.
export async function POST() {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  try {
    const id = await iniciarDiagnostico(auth.user.id);
    return NextResponse.json({ id }, { headers });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status, headers });
  }
}
