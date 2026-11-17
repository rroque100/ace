import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ComentarioNoEncontrado, ComentariosNoDisponibles, marcarMeGusta } from "@/lib/cursos/comentarios-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const cuerpo = z.object({ activo: z.boolean() });

// Da o quita «me gusta». Idempotente: dar dos veces no duplica y quitar uno que no estaba no falla.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const p = cuerpo.safeParse(await request.json().catch(() => null));
  if (!id.success || !p.success) return NextResponse.json({ error: "Petición no válida." }, { status: 400, headers });
  try {
    await marcarMeGusta(auth.user.accessToken, auth.user.id, id.data, p.data.activo);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    if (e instanceof ComentarioNoEncontrado) return NextResponse.json({ error: e.message }, { status: 404, headers });
    if (e instanceof ComentariosNoDisponibles) return NextResponse.json({ error: e.message }, { status: 503, headers });
    throw e;
  }
}
