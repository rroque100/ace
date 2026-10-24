import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProvider } from "@/lib/openai-server";
import { voiceAvailable, voiceConfiguration, transcribeSearchAudio } from "@/lib/voice-transcription";
import { VOICE_MAX_BYTES, VOICE_MAX_MS, audioMimeFromBytes } from "@/lib/voice-search";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  return NextResponse.json({ available: voiceAvailable(), ...voiceConfiguration(), assistantProvider: getProvider(), maxSeconds: VOICE_MAX_MS / 1000 }, { headers });
}
export async function POST(request: Request) {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Abre la grabación desde ACE." }, { status: 403, headers });
  const rate = checkRateLimit(getRateLimitKey(request, auth.user.id, "voice-search"), { max: 5, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (!voiceAvailable()) return NextResponse.json({ error: "La transcripción no está disponible. Puedes escribir tu búsqueda." }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > VOICE_MAX_BYTES + 16_384) return NextResponse.json({ error: "La grabación es demasiado grande. Graba hasta 45 segundos." }, { status: 413, headers });
  const data = await request.formData().catch(() => null);
  const file = data?.get("audio"); const duration = Number(data?.get("durationMs"));
  if (!(file instanceof File) || data?.get("consent") !== "true" || data?.get("provider") !== voiceConfiguration().providerId || !duration || duration < 500 || duration > VOICE_MAX_MS + 1500) return NextResponse.json({ error: "Revisa la grabación y acepta el procesamiento antes de enviarla." }, { status: 400, headers });
  if (file.size > VOICE_MAX_BYTES) return NextResponse.json({ error: "La grabación supera el tamaño permitido." }, { status: 413, headers });
  const mime = audioMimeFromBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime || file.type.split(";")[0] !== mime) return NextResponse.json({ error: "No se pudo leer el formato de audio. Vuelve a grabar." }, { status: 415, headers });
  try {
    const result = await transcribeSearchAudio(file, request.signal);
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener una transcripción utilizable. Repite una grabación corta o escribe tu consulta." }, { status: 503, headers });
  }
}
