import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { buildStoragePath } from "@/lib/documents";
import { prefijoEettTdr, tipoFicheroEett } from "@/lib/eett-tdr-subida";
import { signUploadTicket } from "@/lib/archivo-upload-ticket";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAdminClient, getSupabaseServerConfig } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { name, size, type } → URL firmada para que el navegador suba el
// EETT/TDR directo a Storage, y la referencia firmada que luego se manda a
// POST /eett-tdr. Ver el porqué en lib/eett-tdr-subida.ts (límite de 4,5 MB
// del cuerpo en las funciones de Vercel).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "eett-tdr-subida"), RATE_LIMITS.upload);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await request.json().catch(() => null);
  const name = body?.name;
  const size = body?.size;
  if (typeof name !== "string" || !name || name.length > 255) {
    return NextResponse.json({ error: "Adjunta el EETT/TDR." }, { status: 400 });
  }
  if (!tipoFicheroEett(name, typeof body?.type === "string" ? body.type : "")) {
    return NextResponse.json({ error: "Solo se permiten archivos PDF o Word (.docx)." }, { status: 400 });
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxPdfSizeBytes) {
    return NextResponse.json({ error: `El archivo supera el límite de ${maxPdfSizeLabel}.` }, { status: 400 });
  }

  try {
    const { storageBucket, serviceRoleKey } = getSupabaseServerConfig();
    // Ruta definitiva del documento: el objeto subido no se mueve después.
    const path = `${prefijoEettTdr(auth.user.id)}${buildStoragePath(name)}`;
    const client = await getSupabaseAdminClient();
    const { data, error } = await client.storage.from(storageBucket).createSignedUploadUrl(path);
    if (error) throw error;
    const ticket = signUploadTicket(
      { userId: auth.user.id, path, name, size, expires: Date.now() + 30 * 60_000 },
      serviceRoleKey,
    );
    return NextResponse.json({ url: data.signedUrl, ticket }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[eett-tdr] preparar subida", error);
    return NextResponse.json({ error: "No se pudo preparar la subida del EETT/TDR." }, { status: 503 });
  }
}
