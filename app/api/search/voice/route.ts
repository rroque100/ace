import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getProvider, configuredTextProviders } from "@/lib/openai-server";
import { voiceAvailable, voiceConfiguration, transcribeSearchAudio } from "@/lib/voice-transcription";
import { VOICE_LIMITS, VOICE_MAX_BYTES, audioMimeFromBytes, isVoicePurpose } from "@/lib/voice-search";
import { voiceFailure } from "@/lib/voice-failure";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  return NextResponse.json({ available: voiceAvailable(), ...voiceConfiguration(), assistantProvider: getProvider(), assistantProviders:configuredTextProviders(), maxSeconds: VOICE_LIMITS.search.maxMs / 1000, limits: VOICE_LIMITS }, { headers });
}
export async function POST(request: Request) {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Abre la grabación desde ACE." }, { status: 403, headers });
  const rate = checkRateLimit(getRateLimitKey(request, auth.user.id, "voice-search"), { max: 5, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  if (!voiceAvailable()) return NextResponse.json({ error: "La transcripción no está disponible. Puedes escribir tu búsqueda." }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > VOICE_MAX_BYTES + 16_384) return NextResponse.json({ error: "La grabación es demasiado grande. Repite una más corta." }, { status: 413, headers });
  const data = await request.formData().catch(() => null);
  const file = data?.get("audio"); const duration = Number(data?.get("durationMs"));
  // Sin `purpose` es la búsqueda, como antes de que el chat pudiera dictar.
  const purposeField = data?.get("purpose") ?? "search"; const purpose = isVoicePurpose(purposeField) ? purposeField : null;
  if (!(file instanceof File) || data?.get("consent") !== "true" || data?.get("provider") !== voiceConfiguration().providerId || !purpose || !duration || duration < 500 || duration > VOICE_LIMITS[purpose].maxMs + 1500) return NextResponse.json({ error: "Revisa la grabación y acepta el procesamiento antes de enviarla." }, { status: 400, headers });
  if (file.size > VOICE_MAX_BYTES) return NextResponse.json({ error: "La grabación supera el tamaño permitido." }, { status: 413, headers });
  const mime = audioMimeFromBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime || file.type.split(";")[0] !== mime) return NextResponse.json({ error: "No se pudo leer el formato de audio. Vuelve a grabar." }, { status: 415, headers });
  try {
    const result = await transcribeSearchAudio(file, request.signal, VOICE_LIMITS[purpose].maxChars);
    return NextResponse.json(result, { headers });
  } catch (error) {
    // El usuario recibe siempre el mismo mensaje; el motivo real queda solo en el log del servidor. No se
    // registra el audio, el texto ni el usuario: proveedor, formato, tamaño y duración bastan para diagnosticar.
    const failure = voiceFailure(error);
    if (failure.kind !== "cancelada") {
      const log = failure.kind === "sin-texto" ? console.warn : console.error;
      log(`[voice-search] ${failure.kind} (${voiceConfiguration().providerId}, ${file.type}, ${file.size} B, ${duration} ms): ${failure.detail}`);
    }
    return NextResponse.json({ error: "No se pudo obtener una transcripción utilizable. Repite una grabación corta o escribe tu consulta." }, { status: 503, headers });
  }
}
