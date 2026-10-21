import { NextResponse } from "next/server";
import { requireDec } from "@/lib/auth";
import { drainStuckDocuments } from "@/lib/indexing-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Ajustado al plan Hobby de Vercel: sus funciones se topan en 60 s (en Pro se
// puede subir a 300). El drainer procesa pocos documentos por invocacion.
export const maxDuration = 60;

// Por defecto 1 para caber en los 60 s del Hobby (un OCR escaneado ya se come
// media ventana). En Pro se sube con INDEXING_DRAIN_BATCH.
const batchSize = Number.parseInt(process.env.INDEXING_DRAIN_BATCH ?? "1", 10);

// Autoriza al cron de Vercel (Authorization: Bearer CRON_SECRET) o a un editor/admin
// que dispare el drenado manualmente desde el panel.
async function authorize(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (cronSecret && header === `Bearer ${cronSecret}`) {
    return null;
  }
  const auth = await requireDec();
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
    const summary = await drainStuckDocuments(batchSize);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo drenar la cola" },
      { status: 500 },
    );
  }
}

// GET para el cron de Vercel; POST para el trigger manual desde el panel.
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
