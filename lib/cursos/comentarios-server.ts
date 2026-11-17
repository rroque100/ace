import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";
import { armarHilos, type FilaComentario, type Hilo } from "./comentarios";

// Acceso a datos de los comentarios. Ver docs/supabase/2026-11-17-cursos-comentarios.sql para el reparto de permisos:
// leer, borrar lo propio y los «me gusta» van con el JWT del usuario (RLS); crear y moderar van con service_role,
// porque el servidor es quien fija autor y user_id y comprueba que una respuesta cuelgue de un comentario raíz.
//
// El único error que se tolera es «la tabla aún no existe» (migración manual pendiente). Cualquier otro se propaga.
const TABLA_AUSENTE = /PGRST205|42P01/;

export class ComentariosNoDisponibles extends Error {
  constructor() {
    super("Los comentarios aún no están disponibles.");
  }
}

export class ComentarioNoEncontrado extends Error {
  constructor() {
    super("Ese comentario ya no existe.");
  }
}

async function conTabla<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    if (TABLA_AUSENTE.test(mensaje) && mensaje.includes("curso_comentario")) throw new ComentariosNoDisponibles();
    throw error;
  }
}

const enc = encodeURIComponent;
const LIMITE = 300;

export function listarComentarios(token: string, curso: string, clase: string): Promise<FilaComentario[]> {
  return conTabla(async () =>
    (await supabaseUserRest<FilaComentario[]>(
      token,
      `curso_comentarios?curso=eq.${enc(curso)}&clase=eq.${enc(clase)}` +
        `&select=id,user_id,autor,texto,padre_id,created_at,curso_comentario_likes(user_id)` +
        `&order=created_at.desc&limit=${LIMITE}`,
    )) ?? [],
  );
}

/**
 * Para la página de la clase: la clase se tiene que poder leer aunque fallen los comentarios. Un fallo no se oculta:
 * queda en el log y la sección dice «no se pudieron cargar» (estado "error"), distinto de «aún no disponibles».
 */
export async function comentariosParaPagina(
  token: string,
  curso: string,
  clase: string,
  userId: string,
  isAdmin: boolean,
): Promise<{ hilos: Hilo[]; estado: "ok" | "sin-migrar" | "error" }> {
  try {
    return { hilos: armarHilos(await listarComentarios(token, curso, clase), userId, isAdmin), estado: "ok" };
  } catch (error) {
    if (error instanceof ComentariosNoDisponibles) return { hilos: [], estado: "sin-migrar" };
    console.error("[cursos] no se pudieron leer los comentarios", error);
    return { hilos: [], estado: "error" };
  }
}

/** Un comentario puede recibir respuestas solo si es raíz y es de la misma clase: los hilos tienen un nivel. */
export function buscarPadre(curso: string, clase: string, id: string) {
  return conTabla(async () => {
    const filas = await supabaseRest<{ id: string; padre_id: string | null }[]>(
      `curso_comentarios?id=eq.${enc(id)}&curso=eq.${enc(curso)}&clase=eq.${enc(clase)}&select=id,padre_id&limit=1`,
    );
    return filas?.[0] ?? null;
  });
}

export function crearComentario(datos: {
  curso: string;
  clase: string;
  userId: string;
  autor: string;
  texto: string;
  padreId: string | null;
}): Promise<FilaComentario> {
  return conTabla(async () => {
    const [fila] = await supabaseRest<FilaComentario[]>("curso_comentarios?select=id,user_id,autor,texto,padre_id,created_at", {
      method: "POST",
      body: JSON.stringify({
        curso: datos.curso,
        clase: datos.clase,
        user_id: datos.userId,
        autor: datos.autor,
        texto: datos.texto,
        padre_id: datos.padreId,
      }),
    });
    return { ...fila, curso_comentario_likes: [] };
  });
}

/**
 * Borra el comentario (y en cascada sus respuestas y «me gusta»). El autor borra con su JWT, de modo que la RLS es la
 * que decide; un administrador modera con service_role. Devuelve false si no había nada que borrar con esos permisos.
 */
export function borrarComentario(token: string, id: string, comoAdmin: boolean): Promise<boolean> {
  return conTabla(async () => {
    const ruta = `curso_comentarios?id=eq.${enc(id)}&select=id`;
    const init: RequestInit = { method: "DELETE", headers: { Prefer: "return=representation" } };
    const borradas = comoAdmin
      ? await supabaseRest<{ id: string }[]>(ruta, init)
      : await supabaseUserRest<{ id: string }[]>(token, ruta, init);
    return (borradas ?? []).length > 0;
  });
}

export function marcarMeGusta(token: string, userId: string, comentarioId: string, activo: boolean): Promise<void> {
  return conTabla(async () => {
    if (activo) {
      try {
        await supabaseUserRest(token, "curso_comentario_likes?on_conflict=comentario_id,user_id", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({ comentario_id: comentarioId, user_id: userId }),
        });
      } catch (error) {
        // 23503: el comentario se borró mientras tanto (clave foránea).
        if (error instanceof Error && error.message.includes("23503")) throw new ComentarioNoEncontrado();
        throw error;
      }
    } else {
      await supabaseUserRest(token, `curso_comentario_likes?comentario_id=eq.${enc(comentarioId)}&user_id=eq.${enc(userId)}`, {
        method: "DELETE",
      });
    }
  });
}
