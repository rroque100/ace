import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Ejecuta una acción que "Mi Yo" propuso (ver AccionPropuesta en lib/mi-yo.ts)
// y que el usuario confirmó con un clic en el widget. NUNCA escribe directo a
// la base: llama internamente al MISMO endpoint que usaría un clic en la UI
// (POST /api/necesidades, POST /api/necesidades/{id}/derivar, POST
// /api/processes), reenviando la cookie de sesión de esta misma petición —
// así esos endpoints hacen su propio requireCapability/RLS/validación/
// auditoría de siempre, sin que este archivo tenga que duplicar ninguna de
// esas reglas.
const bodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("crear_necesidad"),
    conversationId: z.string().uuid().optional(),
    parametros: z.object({
      nombre: z.string().trim().min(3).max(500),
      tipoObjeto: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]),
    }),
  }),
  z.object({
    tipo: z.literal("derivar_necesidad"),
    conversationId: z.string().uuid().optional(),
    parametros: z.object({ necesidadId: z.string().uuid() }),
  }),
  z.object({
    tipo: z.literal("crear_expediente"),
    conversationId: z.string().uuid().optional(),
    parametros: z.object({
      nomenclature: z.string().trim().min(3).max(200),
      objectType: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]),
    }),
  }),
]);

async function guardarMensajeAsistente(
  accessToken: string,
  userId: string,
  conversationId: string | undefined,
  content: string,
): Promise<void> {
  if (!conversationId) return;
  await supabaseUserRest(accessToken, "asistente_mensajes", {
    method: "POST",
    body: JSON.stringify({ conversacion_id: conversationId, user_id: userId, role: "assistant", content, intent: "accion" }),
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "asistente-accion"), RATE_LIMITS.bulk);
  if (!rl.allowed) return rateLimitResponse(rl);

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";

  try {
    let respuestaInterna: Response;
    let mensajeExito: string;

    if (payload.data.tipo === "crear_necesidad") {
      respuestaInterna = await fetch(`${origin}/api/necesidades`, {
        body: JSON.stringify({ nombre: payload.data.parametros.nombre, tipoObjeto: payload.data.parametros.tipoObjeto }),
        headers: { "Content-Type": "application/json", cookie },
        method: "POST",
      });
      mensajeExito = `Listo, registré la necesidad "${payload.data.parametros.nombre}".`;
    } else if (payload.data.tipo === "derivar_necesidad") {
      respuestaInterna = await fetch(`${origin}/api/necesidades/${payload.data.parametros.necesidadId}/derivar`, {
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json", cookie },
        method: "POST",
      });
      mensajeExito = "Listo, derivé la necesidad a expediente de contratación.";
    } else {
      respuestaInterna = await fetch(`${origin}/api/processes`, {
        body: JSON.stringify({
          nomenclature: payload.data.parametros.nomenclature,
          objectType: payload.data.parametros.objectType,
        }),
        headers: { "Content-Type": "application/json", cookie },
        method: "POST",
      });
      mensajeExito = `Listo, creé el expediente "${payload.data.parametros.nomenclature}".`;
    }

    const cuerpo = await respuestaInterna.json().catch(() => ({}));
    if (!respuestaInterna.ok) {
      const mensajeError = typeof cuerpo?.error === "string" ? cuerpo.error : "No se pudo completar la acción.";
      await guardarMensajeAsistente(auth.user.accessToken, auth.user.id, payload.data.conversationId, mensajeError);
      return NextResponse.json({ error: mensajeError, ok: false }, { status: respuestaInterna.status });
    }

    await guardarMensajeAsistente(auth.user.accessToken, auth.user.id, payload.data.conversationId, mensajeExito);
    await writeAuditLog({
      action: "asistente.accion_confirmada",
      actorReference: auth.user.email ?? auth.user.id,
      details: { tipo: payload.data.tipo, parametros: payload.data.parametros },
      entityType: "asistente",
      module: "asistente",
    });

    return NextResponse.json({ mensaje: mensajeExito, ok: true, resultado: cuerpo });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la acción", ok: false },
      { status: 500 },
    );
  }
}
