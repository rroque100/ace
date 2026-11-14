import { getSupabaseAdminClient } from "./supabase-server";
import { catalogoBalotarios } from "./balotarios-catalogo";
import { barajarPreguntas, intentoPublico, type IntentoBalotario, type PreguntaBalotario } from "./balotarios-policy";

// RPC exclusivo de service_role. Todas las operaciones filtran owner_id dentro
// de la transacción; p_actor procede de requireUser, nunca del cuerpo HTTP.
export async function operarBalotario(actor: string, action: string, input: Record<string, unknown> = {}) {
  const c = await getSupabaseAdminClient();
  const { data, error } = await c.rpc("ace_balotario_operar", { p_actor: actor, p_action: action, p_input: input });
  if (error) throw error;
  return data;
}
export async function catalogoRevisado() {
  const c = await getSupabaseAdminClient();
  const { data, error } = await c.from("balotario_reviews").select("question_id,prompt,options,competency,correct,explanation,sources");
  if (error) throw error;
  const map = new Map((data ?? []).map(r => [r.question_id, r]));
  return catalogoBalotarios.map(b => ({ ...b, preguntas: b.preguntas.map(q => {
    const r = map.get(q.id);
    return r ? { ...q, pregunta: r.prompt, opciones: r.options.map((o: { id: string; text: string }) => ({ letra: o.id, texto: o.text })), competencia: r.competency, correcta: r.correct, explicacion: r.explanation, fuentes: r.sources, revisada: true, incidencia: undefined } as PreguntaBalotario : q;
  }) }));
}
export async function iniciarBalotario(actor: string, bal: number) {
  const catalogo = await catalogoRevisado();
  const questions = barajarPreguntas(catalogo.find(b => b.balotario === bal)!.preguntas);
  return intentoPublico(await operarBalotario(actor, "start", { balotario: bal, questions }) as IntentoBalotario);
}
export function errorBalotario(e: unknown) {
  const x = e as { code?: string; message?: string; issues?: { message: string }[] };
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(x.code ?? "")) return { status: 503, message: "El guardado de exámenes aún no está disponible. Puedes seguir usando Practicar. Administración debe activar esta función." };
  if (x.code === "40001") return { status: 409, message: "El intento cambió en otra pestaña. Se ha actualizado; revisa tus respuestas antes de continuar." };
  if (x.code === "P0002") return { status: 404, message: "No se encontró el intento de tu cuenta." };
  return { status: 400, message: x.issues?.[0]?.message ?? "No se pudo guardar el examen. Conservamos tus respuestas pendientes en este dispositivo." };
}
