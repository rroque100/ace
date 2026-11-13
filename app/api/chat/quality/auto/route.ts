import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";
import { answerLegalQuestion, chatRequestSchema } from "@/lib/legal-chat";
import { sourceCoverage } from "@/lib/chat-quality";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";
import { detectGroundingViolations, groundingTexts } from "@/lib/eval-grounding";
import { caseSearchQuery } from "@/lib/chat-case-context";
import { reportedProvider } from "@/lib/openai-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cada caso corre el pipeline REAL (recuperación + modelo + verificación de citas),
// que puede tardar decenas de segundos; el tope de casos por pasada lo acota.
export const maxDuration = 300;

// Evaluación continua del chat jurídico: vuelve a correr los CASOS REVISADOS
// (legal_quality_cases, status=reviewed) por el pipeline real y registra indicadores
// deterministas por pasada. No crea conversaciones (persist:false). La revisión humana
// (legal_quality_runs) sigue siendo la que acredita corrección jurídica; esto detecta
// REGRESIONES (fuentes que dejaron de recuperarse, citas infieles, fallback del
// proveedor) sin esperar a que alguien evalúe a mano.
//
// La disparan personas con perfil jurídico/administrador o el cron diario
// (netlify/functions/calidad-juridica.mjs, con CRON_SECRET).

const bodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).optional(),
});

type QualityCase = {
  id: string;
  question: string;
  expected_sources: Array<{ documentId: string; article?: string }>;
};

type AutoRunRow = {
  case_id: string | null;
  question: string;
  model: string | null;
  provider: string | null;
  confidence: string | null;
  presentation: string | null;
  source_count: number;
  indicators: Record<string, unknown>;
  failures: string[];
  response_excerpt: string | null;
  regression: boolean;
  trigger: "manual" | "cron";
};

// La tabla de pasadas aún no existe (SQL manual sin ejecutar): se anuncia y no se
// corren casos. Es el único fallo que se traga y va nombrado, no en silencio.
function esTablaAusente(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /PGRST205|Could not find the table|404/.test(message);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const esCron = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  let accessToken = "";
  let ownerId = "";
  let disparo: "manual" | "cron" = "cron";
  if (!esCron) {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    if (!auth.user.isLegal && !auth.user.isAdmin) {
      return NextResponse.json({ error: "Requiere perfil jurídico o administrador" }, { status: 403 });
    }
    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "qualityAuto"), RATE_LIMITS.qualityAuto);
    if (!rl.allowed) return rateLimitResponse(rl);
    accessToken = auth.user.accessToken;
    ownerId = auth.user.id;
    disparo = "manual";
  } else {
    ownerId = "00000000-0000-4000-8000-000000000000";
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  const limit = parsedBody.success ? parsedBody.data.limit ?? 4 : 4;

  try {
    const cases: QualityCase[] = esCron
      ? await supabaseRest<QualityCase[]>("legal_quality_cases?status=eq.reviewed&select=id,question,expected_sources&order=created_at.desc&limit=" + (limit * 3))
      : await supabaseUserRest<QualityCase[]>(accessToken, "legal_quality_cases?status=eq.reviewed&select=id,question,expected_sources&order=created_at.desc&limit=" + (limit * 3));
    if (!cases.length) {
      return NextResponse.json({ error: "No hay casos revisados registrados para evaluar." }, { status: 409 });
    }
    // Ronda los casos (los más recientes primero) para no evaluar siempre los mismos.
    const paso = Math.max(1, Math.floor(cases.length / Math.min(limit, cases.length)));
    const elegidos = cases.filter((_, index) => index % paso === 0).slice(0, limit);

    const rows: AutoRunRow[] = [];
    for (const caso of elegidos) {
      const resultado = await answerLegalQuestion(
        chatRequestSchema.parse({ question: caso.question, mode: "tecnica", tone: "formal", length: "media" }),
        { accessToken, ownerId, persist: false, role: "admin" },
      );

      const cobertura = sourceCoverage(caso.expected_sources ?? [], resultado.sources);
      const fidelidad = checkCitationFaithfulness(resultado.answer, resultado.sources);
      const consulta = caseSearchQuery(caso.question, undefined);
      const grounding = detectGroundingViolations(resultado.answer, resultado.sources.length, [], consulta, groundingTexts(resultado.sources));
      const usoFallback = resultado.model.startsWith("fallback-source-extract");
      const failures = [
        ...fidelidad.issues.map((issue) => `Cita infiel: ${issue.reason}`),
        ...grounding,
        cobertura.expected > 0 && cobertura.located === 0 ? "No se recuperó ninguna de las fuentes esperadas del caso." : "",
        usoFallback ? "La respuesta salió del extracto de reserva (fallo del proveedor)." : "",
      ].filter(Boolean);
      const review = resultado.assessment.evidenceReview;

      rows.push({
        case_id: caso.id,
        question: caso.question,
        model: resultado.model,
        provider: reportedProvider(resultado.model),
        confidence: resultado.assessment.confidence,
        presentation: review?.presentation ?? null,
        source_count: resultado.sources.length,
        indicators: {
          ...cobertura,
          citationIssues: fidelidad.issues.length,
          groundingViolations: grounding.length,
          usedFallback: usoFallback,
        },
        failures,
        response_excerpt: resultado.answer.slice(0, 2000),
        regression: failures.length > 0,
        trigger: disparo,
      });
    }

    const insertados = esCron
      ? await supabaseRest<AutoRunRow[]>("legal_quality_auto_runs", { method: "POST", body: JSON.stringify(rows) })
      : await supabaseUserRest<AutoRunRow[]>(accessToken, "legal_quality_auto_runs", { method: "POST", body: JSON.stringify(rows) });

    return NextResponse.json({
      runs: insertados ?? rows,
      resumen: {
        corridos: rows.length,
        regresiones: rows.filter((row) => row.regression).length,
        disparo,
      },
    }, { status: 201 });
  } catch (error) {
    if (esTablaAusente(error)) {
      return NextResponse.json({ error: "La evaluación continua aún no está habilitada en la base de datos (falta el SQL de legal_quality_auto_runs)." }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo correr la evaluación" }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!auth.user.isLegal && !auth.user.isAdmin) {
    return NextResponse.json({ error: "Requiere perfil jurídico o administrador" }, { status: 403 });
  }
  try {
    const runs = await supabaseUserRest<Array<AutoRunRow & { id: string; ran_at: string }>>(
      auth.user.accessToken,
      "legal_quality_auto_runs?select=*&order=ran_at.desc&limit=100",
    );
    const ultimas24 = runs.filter((row) => Date.now() - new Date(row.ran_at).getTime() < 86_400_000);
    return NextResponse.json({
      runs,
      resumen: {
        ultimaPasada: runs[0]?.ran_at ?? null,
        regresionesUltimas24h: ultimas24.filter((row) => row.regression).length,
        corridasTotales: runs.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (esTablaAusente(error)) {
      return NextResponse.json({ error: "La evaluación continua aún no está habilitada en la base de datos.", disponible: false }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo cargar la evaluación continua" }, { status: 503 });
  }
}
