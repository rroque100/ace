import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buscarClase, buscarCurso } from "@/lib/cursos/catalogo";
import { armarHilos, comentarioDeFila, nombreVisible, validarTexto } from "@/lib/cursos/comentarios";
import {
  ComentariosNoDisponibles, buscarPadre, crearComentario, listarComentarios,
} from "@/lib/cursos/comentarios-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

const noDisponible = (e: ComentariosNoDisponibles) =>
  NextResponse.json({ error: e.message, disponible: false }, { status: 503, headers });

function claseDe(curso: unknown, clase: unknown) {
  const c = typeof curso === "string" ? buscarCurso(curso) : null;
  return c && typeof clase === "string" && buscarClase(c, clase) ? { curso: c.slug, clase } : null;
}

export async function GET(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const p = new URL(request.url).searchParams;
  const destino = claseDe(p.get("curso"), p.get("clase"));
  if (!destino) return NextResponse.json({ error: "Clase no encontrada." }, { status: 404, headers });
  try {
    const filas = await listarComentarios(auth.user.accessToken, destino.curso, destino.clase);
    return NextResponse.json({ comentarios: armarHilos(filas, auth.user.id, auth.user.isAdmin), disponible: true }, { headers });
  } catch (e) {
    if (e instanceof ComentariosNoDisponibles) return NextResponse.json({ comentarios: [], disponible: false }, { headers });
    throw e;
  }
}

const cuerpo = z.object({
  curso: z.string().max(80),
  clase: z.string().max(120),
  texto: z.unknown(),
  padreId: z.string().uuid().nullish(),
});

// El autor y el user_id salen de la sesión; del cuerpo solo se toman la clase, el texto y a qué comentario responde.
export async function POST(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const p = cuerpo.safeParse(await request.json().catch(() => null));
  const destino = p.success ? claseDe(p.data.curso, p.data.clase) : null;
  if (!p.success || !destino) return NextResponse.json({ error: "Clase no encontrada." }, { status: 400, headers });
  const texto = validarTexto(p.data.texto);
  if (!texto.ok) return NextResponse.json({ error: texto.error }, { status: 400, headers });

  try {
    const padreId = p.data.padreId ?? null;
    if (padreId) {
      const padre = await buscarPadre(destino.curso, destino.clase, padreId);
      if (!padre) return NextResponse.json({ error: "El comentario al que respondes ya no existe." }, { status: 404, headers });
      if (padre.padre_id) {
        return NextResponse.json({ error: "Solo se puede responder a un comentario principal." }, { status: 400, headers });
      }
    }
    const fila = await crearComentario({
      ...destino,
      userId: auth.user.id,
      autor: nombreVisible(auth.user.nombreCompleto),
      texto: texto.texto,
      padreId,
    });
    // No con armarHilos: descarta las filas con padre, y una respuesta recién creada volvía como `undefined`.
    const comentario = comentarioDeFila(fila, auth.user.id, auth.user.isAdmin);
    return NextResponse.json({ comentario, padreId }, { status: 201, headers });
  } catch (e) {
    if (e instanceof ComentariosNoDisponibles) return noDisponible(e);
    throw e;
  }
}
