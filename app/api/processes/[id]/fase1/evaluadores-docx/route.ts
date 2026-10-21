import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_DOCX } from "@/lib/archivar-formato";
import { requireUser } from "@/lib/auth";
import { generarEvaluadorDoc } from "@/lib/evaluadores-docx-datos";
import type { EvaluadorDocKind } from "@/lib/evaluadores-docx";
import { emitirNumeroInforme } from "@/lib/informe-aprobacion-datos";
import { slugify } from "@/lib/slugify";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ARCHIVOS: Record<EvaluadorDocKind, string> = {
  memo: "Memorandum-Designacion-Evaluador",
  jurada: "Declaracion-Jurada-No-Conflicto",
  consentimiento: "Consentimiento-Datos-Personales",
};

function esKind(v: string | null): v is EvaluadorDocKind {
  return v === "memo" || v === "jurada" || v === "consentimiento";
}

// GET /api/processes/[id]/fase1/evaluadores-docx?doc=memo|jurada|consentimiento
//
// Genera uno de los tres documentos de la designación de evaluadores (A6). Los
// datos y el .docx salen de `generarEvaluadorDoc`, compartido con la vista
// previa: lo que se ve antes de descargar y lo que se descarga no pueden diferir.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const kind = url.searchParams.get("doc");
  if (!esKind(kind)) {
    return NextResponse.json({ error: "Documento desconocido" }, { status: 400 });
  }
  // Miembro concreto (jurada/consentimiento por integrante); sin él, el grupo.
  const miembroRaw = url.searchParams.get("miembro");
  const miembroIndex = miembroRaw != null && /^\d+$/.test(miembroRaw) ? Number(miembroRaw) : undefined;

  const { id } = await context.params;
  try {
    // El memo (memorándum de oficial de compra / informe de comité o jurado) es
    // quien lleva el `documento_designacion`. Al descargar la versión de GRUPO
    // se consume el correlativo de la oficina del usuario (fallback DEC) y se
    // congela, igual que A7/A8. Las juradas y los consentimientos no numeran, y
    // las descargas por miembro tampoco (son para firmar/imprimir).
    if (kind === "memo" && miembroIndex == null) {
      await emitirNumeroInforme(auth.user, id, "A6", "documento_designacion", getYearFromRequest(request), {
        oficinaId: auth.user.oficinaId,
      });
    }

    const r = await generarEvaluadorDoc(
      auth.user,
      id,
      kind,
      miembroIndex,
      [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    );
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    // Por miembro se añade su nombre al archivo para distinguir las descargas.
    const sufijoMiembro =
      miembroIndex != null && r.miembros[miembroIndex]
        ? `-${slugify(r.miembros[miembroIndex].nombre)}`
        : "";
    const filename = `${ARCHIVOS[kind]}${sufijoMiembro}-${slugify(r.nomenclatura || "expediente")}.docx`;
    // Se archiva solo la versión de GRUPO (todos los miembros): es el registro del
    // expediente. Las descargas por miembro son para firmar/imprimir y no se
    // archivan por separado, para no duplicar en el archivo.
    const archivable = miembroIndex == null ? FORMATOS_ARCHIVABLES[`A6|${kind}`] : undefined;
    if (archivable) {
      await archivarFormato({
        accessToken: auth.user.accessToken,
        actorReference: auth.user.email ?? auth.user.id,
        contenido: new Uint8Array(r.buffer),
        fileName: filename,
        formato: archivable,
        mimeType: MIME_DOCX,
        ownerId: auth.user.id,
        processId: id,
      });
    }

    return new Response(new Uint8Array(r.buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el documento." },
      { status: 500 },
    );
  }
}
