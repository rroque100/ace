import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { limpiarPropuestaSimilares, promptServiciosSimilares } from "@/lib/servicios-similares";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Propone «servicios similares al objeto convocado» para la experiencia del
 * postor. Una sola llamada al modelo, sin RAG: qué se considera similar es un
 * juicio sobre el objeto, no una cita de la norma. El objeto se lee de la propia
 * necesidad —nombre y descripción de catálogo—, no del cliente, para que la
 * propuesta no dependa de lo que el navegador diga tener.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const [nec] = await supabaseUserRest<
      Array<{ nombre: string | null; descripcion_catalogo: string | null; tipo_objeto: string | null }>
    >(auth.user.accessToken, `necesidades?id=eq.${id}&select=nombre,descripcion_catalogo,tipo_objeto`);
    if (!nec) return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });

    const { system, user } = promptServiciosSimilares({
      nombre: nec.nombre,
      descripcion: nec.descripcion_catalogo,
      tipoObjeto: nec.tipo_objeto,
    });
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_output_tokens: 400,
      model,
      temperature: 0.3,
    });
    const texto = limpiarPropuestaSimilares(response.output_text);
    // Sin texto no se devuelve un 200 vacío: el cliente conserva su corchete y
    // avisa, en vez de borrar lo que hubiera con una respuesta en blanco.
    if (!texto) return NextResponse.json({ error: "El modelo no devolvió una propuesta." }, { status: 502 });
    return NextResponse.json({ texto });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la propuesta." },
      { status: 500 },
    );
  }
}
