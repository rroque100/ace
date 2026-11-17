import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buscarClase, buscarCurso } from "@/lib/cursos/catalogo";
import { ProgresoNoDisponible, leerProgreso, marcarClase } from "@/lib/cursos/progreso-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// El propietario sale siempre de la sesión: el cuerpo solo dice qué clase. Cualquier otro campo se ignora.
const cuerpo = z.object({ curso: z.string().max(80), clase: z.string().max(120), completada: z.boolean() });

export async function GET(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const curso = buscarCurso(new URL(request.url).searchParams.get("curso") ?? "");
  if (!curso) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404, headers });
  const completadas = await leerProgreso(auth.user.accessToken, curso.slug);
  return NextResponse.json({ completadas: completadas ?? [], disponible: completadas !== null }, { headers });
}

export async function POST(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const p = cuerpo.safeParse(await request.json().catch(() => null));
  const curso = p.success ? buscarCurso(p.data.curso) : null;
  if (!p.success || !curso || !buscarClase(curso, p.data.clase)) {
    return NextResponse.json({ error: "La clase no pertenece a ningún curso." }, { status: 400, headers });
  }
  try {
    await marcarClase(auth.user.accessToken, auth.user.id, curso.slug, p.data.clase, p.data.completada);
  } catch (error) {
    if (error instanceof ProgresoNoDisponible) {
      return NextResponse.json({ error: error.message }, { status: 503, headers });
    }
    throw error;
  }
  return NextResponse.json({ ok: true }, { headers });
}
