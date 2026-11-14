import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { comandoBalotario, intentoPublico, type IntentoBalotario } from "@/lib/balotarios-policy";
import { operarBalotario, iniciarBalotario, errorBalotario } from "@/lib/balotarios-server";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request?: Request) {
  const a = await requireUser({ usesAI: false });
  if ("error" in a) return a.error;
  try {
    const id = request ? new URL(request.url).searchParams.get("id") : null;
    if (id) {
      z.string().uuid().parse(id);
      const attempt = intentoPublico(await operarBalotario(a.user.id, "get", { id }) as IntentoBalotario);
      return NextResponse.json({ attempt, serverNow: new Date().toISOString() }, { headers });
    }
    const data = await operarBalotario(a.user.id, "dashboard");
    return NextResponse.json({ ...data, active: data.active ? intentoPublico(data.active) : null, serverNow: new Date().toISOString() }, { headers });
  } catch (e) {
    const x = errorBalotario(e);
    return NextResponse.json({ error: x.message }, { status: x.status, headers });
  }
}
export async function POST(request: Request) {
  const a = await requireUser({ usesAI: false });
  if ("error" in a) return a.error;
  try {
    const p = comandoBalotario.parse(await request.json());
    const attempt = p.action === "start" ? await iniciarBalotario(a.user.id, p.balotario) : intentoPublico(await operarBalotario(a.user.id, p.action, p) as IntentoBalotario);
    return NextResponse.json({ attempt, serverNow: new Date().toISOString() }, { headers });
  } catch (e) {
    const x = errorBalotario(e);
    return NextResponse.json({ error: x.message }, { status: x.status, headers });
  }
}
