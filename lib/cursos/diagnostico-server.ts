import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { examRpc } from "@/lib/exam-server";
import { respuestasDeIntento, resultadoDiagnostico, type ResultadoDiagnostico } from "./diagnostico";
import type { Curso } from "./tipos";

// Lectura y arranque de la prueba diagnóstica.
//
// Por qué service_role aquí y no el JWT del usuario: las tablas del simulador (exam_attempts, exam_answers) tienen RLS
// sin políticas a propósito, porque cada intento guarda la opción correcta de sus preguntas. Todo el módulo del
// simulador lee con service_role filtrando SIEMPRE por owner_id = la persona de la sesión (lib/exam-learning-server.ts);
// aquí se sigue ese mismo patrón y al cliente solo llega el agregado, nunca las respuestas correctas.

export type EstadoDiagnostico =
  | { estado: "sin-hacer" }
  | { estado: "en-curso"; id: string }
  | { estado: "hecho"; id: string; fecha: string; resultado: ResultadoDiagnostico }
  | { estado: "error" };

type FilaIntento = { id: string; state: string; finished_at: string | null; questions: unknown };

export async function leerDiagnostico(userId: string, curso: Curso): Promise<Exclude<EstadoDiagnostico, { estado: "error" }>> {
  const c = await getSupabaseAdminClient();
  // Si la migración aún no se aplicó no hay ningún intento con este perfil: se ve «sin hacer», que es lo correcto.
  const t = await c
    .from("exam_attempts")
    .select("id,state,finished_at,questions")
    .eq("owner_id", userId)
    .eq("profile", "diagnostico")
    .order("started_at", { ascending: false })
    .limit(1);
  if (t.error) throw t.error;
  const ultimo = (t.data?.[0] ?? null) as FilaIntento | null;
  if (!ultimo) return { estado: "sin-hacer" };
  if (ultimo.state === "active") return { estado: "en-curso", id: ultimo.id };
  if (ultimo.state !== "submitted" || !ultimo.finished_at) return { estado: "sin-hacer" };

  const a = await c.from("exam_answers").select("question_id,option").eq("attempt_id", ultimo.id);
  if (a.error) throw a.error;
  const preguntas = Array.isArray(ultimo.questions) ? ultimo.questions : [];
  return {
    estado: "hecho",
    id: ultimo.id,
    fecha: ultimo.finished_at,
    resultado: resultadoDiagnostico(curso, respuestasDeIntento(preguntas, a.data ?? [])),
  };
}

/** Para la portada: el temario se tiene que ver aunque falle esta lectura. El fallo queda en el log, no se oculta. */
export async function diagnosticoParaPagina(userId: string, curso: Curso): Promise<EstadoDiagnostico> {
  try {
    return await leerDiagnostico(userId, curso);
  } catch (error) {
    console.error("[cursos] no se pudo leer la prueba diagnóstica", error);
    return { estado: "error" };
  }
}

export async function iniciarDiagnostico(userId: string): Promise<string> {
  return (await examRpc("ace_exam_start_diagnostic", { p_actor: userId })) as string;
}
