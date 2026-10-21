import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireDecOrAreaUsuaria } from "@/lib/auth";
import { getSupabaseAdminClient, getSupabaseServerConfig } from "@/lib/supabase-server";
import { signUploadTicket } from "@/lib/archivo-upload-ticket";
import { maxPdfSizeBytes } from "@/lib/upload-limits";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requireDecOrAreaUsuaria();
  if ("error" in auth) return auth.error;
  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "archivo-upload"), RATE_LIMITS.upload);
  if (!rl.allowed) return rateLimitResponse(rl);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || body.name.length > 255 || body.type !== "application/pdf" || !Number.isSafeInteger(body.size) || body.size <= 0 || body.size > maxPdfSizeBytes) return NextResponse.json({ error: "Adjunta un PDF de hasta 100 MB." }, { status: 400 });
  try {
    const { storageBucket, serviceRoleKey } = getSupabaseServerConfig();
    const path = `archivo-temp/${auth.user.id}/${randomUUID()}.pdf`;
    const client = await getSupabaseAdminClient();
    const { data, error } = await client.storage.from(storageBucket).createSignedUploadUrl(path);
    if (error) throw error;
    const ticket = signUploadTicket({ userId: auth.user.id, path, name: body.name, size: body.size, expires: Date.now() + 30 * 60_000 }, serviceRoleKey);
    return NextResponse.json({ url: data.signedUrl, ticket }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[archivo] preparar subida", error);
    return NextResponse.json({ error: "No se pudo preparar la subida del PDF." }, { status: 503 });
  }
}
