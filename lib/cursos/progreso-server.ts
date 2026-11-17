import { supabaseUserRest } from "@/lib/supabase-server";

// Progreso de la persona en un curso. Es dato privado: siempre con su JWT (RLS), nunca con service_role.
//
// El único error que se tolera es «la tabla aún no existe» (la migración de docs/supabase/2026-11-16-cursos-progreso.sql
// es manual): en ese caso se devuelve null y la página avisa de que el avance no se guarda. Cualquier otro error se
// propaga, porque un catch genérico ya escondió fallos reales en este proyecto.
const TABLA_AUSENTE = /PGRST205|42P01/;

function esTablaAusente(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : "";
  return TABLA_AUSENTE.test(mensaje) && mensaje.includes("curso_progreso");
}

/** Slugs de las clases completadas, o null si la tabla aún no se ha creado. */
export async function leerProgreso(token: string, curso: string): Promise<string[] | null> {
  try {
    const filas = await supabaseUserRest<{ clase: string }[]>(
      token,
      `curso_progreso?curso=eq.${encodeURIComponent(curso)}&select=clase`,
    );
    return (filas ?? []).map((f) => f.clase);
  } catch (error) {
    if (esTablaAusente(error)) return null;
    throw error;
  }
}

export type EstadoProgreso = { completadas: string[]; estado: "ok" | "sin-migrar" | "error" };

/**
 * Para las páginas: el contenido del curso se tiene que poder leer aunque falle la lectura del avance. Un fallo no se
 * oculta: queda en el log y la página muestra «no se pudo leer tu avance» (estado "error"), distinto de «aún no se
 * guarda» (estado "sin-migrar").
 */
export async function progresoParaPagina(token: string, curso: string): Promise<EstadoProgreso> {
  try {
    const completadas = await leerProgreso(token, curso);
    return completadas === null ? { completadas: [], estado: "sin-migrar" } : { completadas, estado: "ok" };
  } catch (error) {
    console.error("[cursos] no se pudo leer el progreso", error);
    return { completadas: [], estado: "error" };
  }
}

export class ProgresoNoDisponible extends Error {
  constructor() {
    super("El guardado del avance aún no está activado.");
  }
}

/** Marca o desmarca una clase. Idempotente: marcar dos veces no duplica ni falla. */
export async function marcarClase(token: string, userId: string, curso: string, clase: string, completada: boolean) {
  try {
    if (completada) {
      await supabaseUserRest(token, "curso_progreso?on_conflict=user_id,curso,clase", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, curso, clase }),
      });
    } else {
      await supabaseUserRest(
        token,
        `curso_progreso?curso=eq.${encodeURIComponent(curso)}&clase=eq.${encodeURIComponent(clase)}`,
        { method: "DELETE" },
      );
    }
  } catch (error) {
    if (esTablaAusente(error)) throw new ProgresoNoDisponible();
    throw error;
  }
}
