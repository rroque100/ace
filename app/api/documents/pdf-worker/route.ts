import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireUser } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Code from the installed PDF library, never a document or a user-supplied path.
export async function GET() {
  const access = await requireUser({ usesAI:false });
  if ("error" in access) return access.error;
  try {
    const script = await readFile(join(process.cwd(),"node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),"utf8");
    return new Response(script, { headers:{
      "Content-Type":"text/javascript; charset=utf-8",
      "Cache-Control":"private, max-age=86400",
      "X-Content-Type-Options":"nosniff",
    }});
  } catch {
    return new Response("No se pudo cargar el lector PDF.", { status:503, headers:{"Cache-Control":"no-store"} });
  }
}
