import { NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { syncOverview, runDocumentSync } from "@/lib/document-sync";
import {
  syncSettingsSchema,
  syncSourceSchema,
} from "@/lib/document-sync-policy";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function admin() {
  const a = await requireUser({ usesAI:false });
  return "error" in a
    ? a.error
    : (!a.user.isAdmin || a.user.esExterno)
      ? NextResponse.json(
          { error: "Solo administración puede gestionar actualizaciones." },
          { status: 403 },
        )
      : null;
}
export async function GET() {
  const denied = await admin();
  if (denied) return denied;
  try {
    return NextResponse.json(await syncOverview(), {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo consultar la cola. Comprueba que la migración esté aplicada.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const denied = await admin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const c = await getSupabaseAdminClient();
    if (body.action === "settings") {
      const p = syncSettingsSchema.parse(body);
      await c
        .from("legal_sync_settings")
        .update({
          enabled: p.enabled,
          daily_limit: p.dailyLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .throwOnError();
    } else if (body.action === "source") {
      const p = syncSourceSchema.parse(body);
      if (
        p.documentTypes.some(
          (t) => !OFFICIAL_CORPUS_TYPES.some((x) => x.value === t),
        )
      )
        throw Error("Tipo documental no autorizado.");
      await c
        .from("legal_sync_sources")
        .upsert({
          source_id: p.sourceId,
          enabled: p.enabled,
          document_types: p.documentTypes,
          regimes: p.regimes,
          code_prefix: p.codePrefix,
          updated_at: new Date().toISOString(),
        })
        .throwOnError();
    } else if (body.action === "run") {
      after(async () => {
        await runDocumentSync();
      });
      return NextResponse.json({
        queued: true,
        message:
          "Revisión iniciada en el servidor. La cola pendiente continúa en el siguiente ciclo.",
      });
    } else if (body.action === "resume") {
      await c
        .from("legal_sync_settings")
        .update({ ai_blocked_until: null, ai_error: null })
        .eq("id", true)
        .throwOnError();
      await c
        .from("legal_sync_jobs")
        .update({
          state: "queued",
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("state", "blocked")
        .throwOnError();
    } else if (body.action === "adopt") {
      const { data: settings, error: settingsError } = await c
        .from("legal_sync_settings")
        .select("ai_blocked_until")
        .single();
      if (settingsError) throw settingsError;
      const { data: docs, error } = await c
        .from("documents")
        .select("id,metadata")
        .eq("es_institucional", true)
        .eq("status", "uploaded")
        .contains("metadata", { importBatch: "tcp-s-32069-lote-001" })
        .limit(100);
      if (error) throw error;
      for (const d of docs ?? []) {
        await c
          .from("legal_sync_jobs")
          .upsert(
            {
              document_id: d.id,
              stage: "classify",
              ...(settings?.ai_blocked_until &&
              new Date(settings.ai_blocked_until).getTime() > Date.now()
                ? {
                    state: "blocked",
                    next_attempt_at: settings.ai_blocked_until,
                    last_error: "Pendiente de restablecer créditos de IA.",
                  }
                : {}),
            },
            { onConflict: "document_id", ignoreDuplicates: true },
          )
          .throwOnError();
        await c
          .from("documents")
          .update({ metadata: { ...d.metadata, syncManaged: true } })
          .eq("id", d.id)
          .throwOnError();
      }
    } else
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "No se pudo completar la acción.",
      },
      { status: 400 },
    );
  }
}
