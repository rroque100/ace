import { NextResponse } from "next/server";
import { requireDecOrAreaUsuaria } from "@/lib/auth";
import { drainStuckExpedientes } from "@/lib/expedientes-archivo-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// El OCR de un expediente escaneado es pesado. Ajustado al plan Hobby de Vercel,
// que topa las funciones en 60 s (en Pro se puede subir a 300).
export const maxDuration = 300;

// Tamaño del POOL de candidatos atascados a considerar, no cuántos se procesan
// de verdad: drainStuckExpedientes ahora reparte un presupuesto de ~50 s entre
// ellos (ver su comentario), así que un pool generoso solo cuesta una consulta
// más grande, no más tiempo de OCR. Antes esto SÍ limitaba el trabajo real
// (1 = un solo bloque de un solo documento por corrida), y con el cron de
// expedientes corriendo una vez al día en Hobby, un lote grande tardaba semanas
// en completarse por la vía automática.
const batchSize = Number.parseInt(process.env.EXPEDIENTES_DRAIN_BATCH ?? "20", 10);

// Autoriza al scheduled function / cron (Authorization: Bearer CRON_SECRET) o a un
// editor/admin/area_usuaria que dispare el drenado manualmente.
async function authorize(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (cronSecret && header === `Bearer ${cronSecret}`) {
    return null;
  }
  const auth = await requireDecOrAreaUsuaria();
  if ("error" in auth) {
    return auth.error;
  }
  return null;
}

async function handle(request: Request) {
  const denied = await authorize(request);
  if (denied) {
    return denied;
  }
  try {
    const summary = await drainStuckExpedientes(batchSize);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo drenar la cola de expedientes" },
      { status: 500 },
    );
  }
}

// GET para el cron; POST para el trigger manual.
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
