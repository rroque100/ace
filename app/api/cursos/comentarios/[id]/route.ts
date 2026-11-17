import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ComentariosNoDisponibles, borrarComentario } from "@/lib/cursos/comentarios-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// Borra un comentario y, en cascada, sus respuestas. El autor borra con su JWT (decide la RLS); un administrador
// modera cualquiera. Si no se borró nada es que no existe o que no es de esta cuenta: se responde igual (404) para no
// revelar si un id ajeno existe.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Comentario no válido." }, { status: 400, headers });
  try {
    const borrado = await borrarComentario(auth.user.accessToken, id.data, auth.user.isAdmin);
    if (!borrado) return NextResponse.json({ error: "Ese comentario ya no existe." }, { status: 404, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    if (e instanceof ComentariosNoDisponibles) return NextResponse.json({ error: e.message }, { status: 503, headers });
    throw e;
  }
}
