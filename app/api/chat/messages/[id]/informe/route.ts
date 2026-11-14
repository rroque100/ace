import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Informe técnico-jurídico en borrador a partir de un turno del chat. Es la pieza que
// faltaba del lado «agente» del asistente: respondía con fuentes, pero el paso al
// documento de trabajo (el informe que el área jurídica revisa y firma) había que
// rehacerlo a mano. La exportación plana (export/route.ts) ya volcaba pregunta +
// respuesta; aquí el MISMO turno sale estructurado como informe: consulta, respuesta,
// fundamento normativo con páginas, contexto declarado del caso y verificación.
//
// Es un BORRADOR: el pie lo dice y no hay datos del expediente (módulo Expedientes)
// ni firmantes; eso sigue siendo decisión de la persona que lo revisa.

type ChatMessageRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  model: string | null;
  role: "user" | "assistant" | "system";
  sources: Array<{
    article?: string | null;
    citation?: string;
    documentTitle?: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    vigencia?: string | null;
  }>;
  created_at: string;
};

function textoPlano(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/** Divide `**negrita**` en runs con su formato; el marcador [F#] se conserva literal. */
function runsConNegrita(line: string): TextRun[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? new TextRun({ bold: true, text: part.slice(2, -2) })
        : new TextRun(part.replace(/^#+\s*/, "")),
    );
}

function parrafo(line: string, opts: { bold?: boolean; spacing?: number } = {}) {
  return new Paragraph({
    children: opts.bold ? [new TextRun({ bold: true, text: line })] : runsConNegrita(line),
    spacing: { after: opts.spacing ?? 120 },
  });
}

function seccion(titulo: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun(titulo)],
    spacing: { before: 240, after: 120 },
  });
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "informe-ace"
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const [message] = await supabaseUserRest<ChatMessageRow[]>(
      auth.user.accessToken,
      `chat_messages?id=eq.${id}&select=id,role,content,sources,model,metadata,created_at`,
    );

    if (!message || message.role !== "assistant") {
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
    }

    const metadata = message.metadata ?? {};
    const question = textoPlano(metadata.question) || "Pregunta no registrada";
    const assessment = (metadata.assessment ?? {}) as {
      confidence?: string;
      evidenceWarnings?: string[];
      reason?: string;
    };
    const caseContext = (metadata.caseContext ?? {}) as {
      regime?: string;
      dates?: string;
      object?: string;
      facts?: string;
    };
    const sources = Array.isArray(message.sources) ? message.sources : [];
    const entidad = textoPlano(auth.user.entity) || "Entidad no registrada";

    const children = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun("INFORME TÉCNICO-JURÍDICO")],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ italics: true, text: "Borrador elaborado con asistencia de ACE · sujeto a revisión del área jurídica" })],
        spacing: { after: 240 },
      }),
      parrafo(`Entidad: ${entidad}`),
      parrafo(`Fecha del informe: ${new Date().toLocaleString("es-PE")}`),
      parrafo(`Fecha de la consulta: ${new Date(message.created_at).toLocaleString("es-PE")}`),
      parrafo(`Nivel de confianza documental de la respuesta: ${textoPlano(assessment.confidence) || "sin dato"}`),

      seccion("I. Consulta"),
      parrafo(question),

      seccion("II. Respuesta fundamentada"),
      ...message.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parrafo(line.startsWith("- ") || line.startsWith("* ") ? `• ${line.slice(2)}` : line)),

      seccion("III. Fundamento normativo citado"),
      ...(sources.length
        ? sources.map((source, index) =>
            parrafo(
              `${index + 1}. ${source.citation ?? [source.documentTitle, source.article ? `art. ${source.article}` : null, source.pageStart ? `pág. ${source.pageStart}` : null].filter(Boolean).join(", ")}${source.vigencia ? ` · vigencia registrada: ${source.vigencia}` : ""}`,
            ),
          )
        : [parrafo("Sin fuentes recuperadas para esta respuesta.")]),

      seccion("IV. Contexto declarado del caso"),
      parrafo(`Régimen: ${textoPlano(caseContext.regime) || "No indicado"}`),
      parrafo(`Objeto contractual: ${textoPlano(caseContext.object) || "No indicado"}`),
      parrafo(`Fechas relevantes: ${textoPlano(caseContext.dates) || "No indicadas"}`),
      parrafo(`Hechos declarados: ${textoPlano(caseContext.facts) || "No indicados"}`),

      seccion("V. Verificación y límites"),
      ...(textoPlano(assessment.reason) ? [parrafo(textoPlano(assessment.reason))] : []),
      ...(assessment.evidenceWarnings?.length
        ? [
            parrafo("Advertencias de la revisión automática:", { bold: true }),
            ...assessment.evidenceWarnings.map((warning) => parrafo(`• ${warning}`)),
          ]
        : []),
      parrafo(
        "Este informe reproduce una respuesta generada con recuperación documental y verificación automática de citas. La revisión automática no sustituye la revisión de un especialista: confirma vigencia, aplicabilidad al caso y exactitud jurídica antes de su uso oficial.",
      ),

      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun("Elaborado con asistencia de ACE — requiere revisión y conformidad del área jurídica.")],
        spacing: { before: 360 },
      }),
    ];

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    await writeAuditLog({
      action: "chat.response.informe_docx",
      entityId: id,
      entityType: "chat_message",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFileName(question)}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el informe" },
      { status: 500 },
    );
  }
}
