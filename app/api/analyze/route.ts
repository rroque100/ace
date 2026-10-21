import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { analyzeLegalDocument } from "@/lib/legal-analysis";
import { extractPdfPlainText } from "@/lib/pdf-processing";
import { institutionalAuditDetails, supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const minTextLength = 120;

type DocumentRow = { id: string; title: string; document_type: string };
type ChunkRow = { content: string };
type ProcessRow = { id: string; nomenclature: string; procedure_type: string | null };

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const items = await supabaseUserRest(
    auth.user.accessToken,
    "document_analyses?select=id,source,document_id,title,result,model,created_at&order=created_at.desc&limit=30",
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "analyze"),
      RATE_LIMITS.chat,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const contentType = request.headers.get("content-type") ?? "";
    let text = "";
    let title: string | undefined;
    let documentType: string | undefined;
    let documentKind: string | undefined;
    let processType: string | undefined;
    let processId: string | null = null;
    let source: "upload" | "indexed" = "upload";
    let documentId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
      }
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
      }
      if (file.size > maxPdfSizeBytes) {
        return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
      }

      const titleValue = formData.get("title");
      const documentKindValue = formData.get("documentKind");
      const processTypeValue = formData.get("processType");
      const processIdValue = formData.get("processId");
      title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
      documentKind = typeof documentKindValue === "string" && documentKindValue.trim() ? documentKindValue.trim() : undefined;
      processType = typeof processTypeValue === "string" && processTypeValue.trim() ? processTypeValue.trim() : undefined;
      processId = typeof processIdValue === "string" && processIdValue.trim() ? processIdValue.trim() : null;
      const extracted = await extractPdfPlainText(file);
      text = extracted.text;
    } else {
      const payload = (await request.json().catch(() => ({}))) as {
        documentId?: string;
        documentKind?: string;
        processId?: string;
        processType?: string;
      };

      if (!payload.documentId) {
        return NextResponse.json({ error: "Falta documentId o archivo" }, { status: 400 });
      }

      source = "indexed";
      documentId = payload.documentId;
      documentKind = payload.documentKind;
      processType = payload.processType;
      processId = payload.processId ?? null;
      const [docs, chunks] = await Promise.all([
        supabaseRest<DocumentRow[]>(
          `documents?id=eq.${payload.documentId}&select=id,title,document_type`,
        ),
        // Texto completo: la deteccion deterministica de clausulas del art.60 corre
        // sobre todo el documento, asi que truncar (antes limit=80) marcaba como
        // FALTA clausulas presentes en chunks posteriores. El limite alto es solo
        // una red de seguridad ante documentos extremos.
        supabaseRest<ChunkRow[]>(
          `document_chunks?document_id=eq.${payload.documentId}&select=content&order=chunk_index.asc&limit=5000`,
        ),
      ]);
      const doc = docs[0];
      if (!doc) {
        return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
      }
      title = doc.title;
      documentType = doc.document_type;
      documentKind = documentKind || doc.document_type;
      text = chunks.map((chunk) => chunk.content).join("\n\n");
    }

    if (processId && !processType) {
      const [process] = await supabaseUserRest<ProcessRow[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${processId}&select=id,nomenclature,procedure_type&limit=1`,
      );
      processType = process?.procedure_type ?? undefined;
    }

    if (text.trim().length < minTextLength) {
      return NextResponse.json(
        { error: "No se pudo extraer texto suficiente del documento (¿PDF escaneado?)." },
        { status: 422 },
      );
    }

    const analysis = await analyzeLegalDocument({ documentKind, documentType, processType, text, title });

    const result = {
      checklist: analysis.checklist,
      clausulas: analysis.clausulas,
      confidence: analysis.confidence,
      confidenceReason: analysis.confidenceReason,
      coverage: analysis.coverage,
      criticalSources: analysis.criticalSources,
      documentKind,
      findings: analysis.findings,
      normasAplicables: analysis.normasAplicables,
      processId,
      processType,
      recomendaciones: analysis.recomendaciones,
      resumen: analysis.resumen,
      riesgos: analysis.riesgos,
      sources: analysis.sources,
    };

    await supabaseUserRest(auth.user.accessToken, "document_analyses", {
      body: JSON.stringify({
        document_id: documentId,
        model: analysis.model,
        owner_id: auth.user.id,
        result,
        source,
        title,
      }),
      method: "POST",
    }).catch(() => undefined);

    if (processId) {
      await supabaseUserRest(auth.user.accessToken, "process_evaluations", {
        body: JSON.stringify({
          matrix: analysis.checklist,
          model: analysis.model,
          observations: analysis.findings.length ? analysis.findings : analysis.riesgos,
          owner_id: auth.user.id,
          process_id: processId,
          result:
            analysis.findings.some((finding) => finding.category === "incumplimiento" && finding.severity === "alto") ||
            analysis.criticalSources.some((item) => !item.ok)
              ? "riesgo"
              : "cumple",
        }),
        method: "POST",
      }).catch(() => undefined);
    }

    await writeAuditLog({
      action: "document.analyze",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        ...institutionalAuditDetails({
          conclusion: analysis.confidence,
          documentId,
          entity: auth.user.entity,
          processId,
          processType,
          role: auth.user.role,
          sources: analysis.sources,
          userEmail: auth.user.email,
          userId: auth.user.id,
        }),
        confidence: analysis.confidence,
        documentId,
        documentKind,
        processId,
        processType,
        source,
        sources: analysis.sources.map((item) => ({
          article: item.article,
          documentId: item.documentId,
          documentType: item.documentType,
          pageStart: item.pageStart,
        })),
        title,
        user: { id: auth.user.id, role: auth.user.role },
      },
      entityId: documentId ?? undefined,
      entityType: "document_analysis",
      module: "analizar",
      processType,
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({ analysis, title });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el documento" },
      { status: 500 },
    );
  }
}
