import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { completarDesdeModelo, completarModeloRequestSchema } from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Genera con OpenAI (no streaming, JSON estructurado); da margen al proxy.
export const maxDuration = 60;

// POST /api/necesidades/[id]/completar-modelo
// Analiza el requerimiento del proceso de selección elegido (PDF-modelo anclado
// + guía + norma) y propone valores para los campos vacíos aplicables, además de
// qué campos exige ese proceso. La ficha lo muestra en un panel de revisión.
export async function POST(request: Request, _context: { params: Promise<{ id: string }> }) {
  try {
    // Mismo permiso que editar la necesidad: no expone la IA a solo-lectura.
    const auth = await requireCapability("necesidad.manage");
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = completarModeloRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud inválida", details: payload.error.flatten() },
        { status: 400 },
      );
    }
    if (!payload.data.tipoProcesoSeleccion.trim()) {
      return NextResponse.json(
        { error: "Elige primero el tipo de proceso de selección para anclar el copiloto a su modelo." },
        { status: 400 },
      );
    }

    // La entidad viene del usuario autenticado (no del body): permite preferir el
    // PDF-modelo de la propia entidad cuando varias lo tienen cargado.
    const result = await completarDesdeModelo(payload.data, { entity: auth.user.entity });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar con el modelo" },
      { status: 500 },
    );
  }
}
