import { NextResponse, after } from "next/server";
import { runDocumentSync } from "@/lib/document-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Programación no configurada." },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  after(async () => {
    await runDocumentSync();
  });
  return NextResponse.json({ queued: true });
}
