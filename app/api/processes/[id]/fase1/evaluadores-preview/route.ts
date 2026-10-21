import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { leerDocx } from "@/lib/docx-a-bloques";
import { generarEvaluadorDoc } from "@/lib/evaluadores-docx-datos";
import type { EvaluadorDocKind } from "@/lib/evaluadores-docx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TITULOS: Record<EvaluadorDocKind, string> = {
  memo: "Memorándum de designación de evaluadores",
  jurada: "Declaración jurada de no conflicto de intereses",
  consentimiento: "Consentimiento de datos personales",
};

function esKind(v: string | null): v is EvaluadorDocKind {
  return v === "memo" || v === "jurada" || v === "consentimiento";
}

// GET /api/processes/[id]/fase1/evaluadores-preview?doc=memo|jurada|consentimiento
//
// Vista previa de uno de los tres documentos de A6 antes de descargarlo.
//
// Genera el MISMO .docx que la descarga (con `generarEvaluadorDoc`) y lo lee de
// vuelta con `leerDocx`: la previa no es una segunda composición que pueda
// desviarse, es literalmente el archivo. Es la garantía de fidelidad más fuerte
// posible para un documento que se firma.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const kind = url.searchParams.get("doc");
  if (!esKind(kind)) {
    return NextResponse.json({ error: "Documento desconocido" }, { status: 400 });
  }
  const miembroRaw = url.searchParams.get("miembro");
  const miembroIndex = miembroRaw != null && /^\d+$/.test(miembroRaw) ? Number(miembroRaw) : undefined;

  const { id } = await context.params;
  try {
    const r = await generarEvaluadorDoc(
      auth.user,
      id,
      kind,
      miembroIndex,
      [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    );
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const parrafos = await leerDocx(r.buffer);
    // `miembros` alimenta el selector "Todos / cada miembro" de la vista previa.
    return NextResponse.json({ parrafos, titulo: TITULOS[kind], miembros: r.miembros });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
