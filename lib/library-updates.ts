import { z } from "zod";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { validateOfficialUrl } from "./official-import/download";
import { OFFICIAL_CORPUS_TYPES } from "./official-corpus";
import { getSupabaseAdminClient } from "./supabase-server";
import { matchesFollow } from "./library-follow";
import {
  isOeceCatalogue,
  parseOeceCatalogue,
  type OfficialListingItem,
} from "./oece-official-source";
export const officialSourceSchema = z.object({
  label: z.string().trim().min(4).max(200),
  url: z
    .string()
    .url()
    .max(1500)
    .refine((v) => {
      try {
        validateOfficialUrl(v);
        return true;
      } catch {
        return false;
      }
    }, "Utiliza una publicación oficial autorizada."),
  documentType: z.enum(
    OFFICIAL_CORPUS_TYPES.map((x) => x.value) as [string, ...string[]],
  ),
  sourceEntity: z.string().trim().min(2).max(200),
});
export function discoverOfficialPdfs(html: string, base: string) {
  validateOfficialUrl(base);
  const found = new Map<string, string>();
  for (const m of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const u = validateOfficialUrl(
        new URL(m[1].replaceAll("&amp;", "&"), base).href,
      );
      if (!/\.pdf$/i.test(u.pathname)) continue;
      u.hash = "";
      const title = m[2]
        .replace(/<[^>]*>/g, " ")
        .replace(/&(?:nbsp|amp);/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      found.set(
        u.href,
        title.length >= 4
          ? title.slice(0, 400)
          : decodeURIComponent(u.pathname.split("/").at(-1) ?? "Documento PDF"),
      );
    } catch {
      /* Invalid or external links are not candidates. */
    }
  }
  return [...found].map(([url, title]) => ({ url, title }));
}
export function officialPublicationRedirect(from: string, to: string) {
  const origin = validateOfficialUrl(from);
  const destination = validateOfficialUrl(new URL(to, origin).href);
  if (
    origin.hostname !== "www.gob.pe" ||
    destination.hostname !== "www.gob.pe" ||
    !/^\/institucion\/[a-z0-9-]+\/(?:normas-legales|informes-publicaciones)\/\d+/.test(
      destination.pathname,
    )
  )
    throw Error("La redirección no corresponde a una publicación oficial.");
  return destination.href;
}
export async function officialPage(
  url: string,
  redirects = 0,
): Promise<string> {
  const u = validateOfficialUrl(url);
  const addresses = await lookup(u.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((x) =>
      x.address.includes(":")
        ? !/^2[0-9a-f]{3}:/i.test(x.address)
        : /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
            x.address,
          ),
    )
  )
    throw Error("Dirección de red no permitida.");
  const r = await fetch(u, {
    redirect: "manual",
    signal: AbortSignal.timeout(25000),
  });
  if ([301, 302, 303, 307, 308].includes(r.status)) {
    const location = r.headers.get("location");
    await r.body?.cancel();
    if (!location || redirects >= 5)
      throw Error("Demasiadas redirecciones de la fuente oficial.");
    return officialPage(
      officialPublicationRedirect(u.href, location),
      redirects + 1,
    );
  }
  if (!r.ok || !r.body) throw Error(`Fuente oficial HTTP ${r.status}`);
  if (!/text\/html|application\/json/.test(r.headers.get("content-type") ?? ""))
    throw Error("La fuente debe ser una página de publicaciones.");
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const n = await reader.read();
      if (n.done) break;
      size += n.value.length;
      if (size > 3 * 1024 * 1024) {
        await reader.cancel();
        throw Error("La página supera el límite de lectura.");
      }
      chunks.push(n.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function runOfficialSource(
  sourceId: string,
  actorId: string,
  latest = false,
) {
  const c = await getSupabaseAdminClient();
  const { data: s, error } = await c
    .from("legal_official_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error || !s) throw Error("Fuente no disponible.");
  const { data: run, error: runError } = await c
    .from("legal_update_runs")
    .insert({ source_id: s.id, actor_id: actorId, status: "running" })
    .select("id")
    .single();
  if (runError) throw runError;
  try {
    const pageUrl = latest ? s.url : (s.cursor_url ?? s.url);
    if (s.cursor_url && (!isOeceCatalogue(s.url) || !isOeceCatalogue(pageUrl)))
      throw Error("La continuación no corresponde al catálogo oficial.");
    const html = await officialPage(pageUrl);
    const parsed = isOeceCatalogue(s.url)
      ? parseOeceCatalogue(html, pageUrl)
      : null;
    const links: Array<
      Partial<OfficialListingItem> & { url: string; title: string }
    > = parsed?.items ?? discoverOfficialPdfs(html, pageUrl);
    const candidates = links.slice(0, 50);
    if (candidates.length) {
      const { error: e } = await c.from("legal_update_candidates").upsert(
        candidates.map((x) => ({
          source_id: s.id,
          run_id: run.id,
          file_url: x.url,
          title: x.title,
          ...("publicationUrl" in x
            ? {
                publication_url: x.publicationUrl,
                publication_date: x.publicationDate,
                document_number: x.number,
                detected_type: x.detectedType,
                summary: x.summary,
              }
            : { publication_url: pageUrl }),
        })),
        { onConflict: "source_id,file_url", ignoreDuplicates: true },
      );
      if (e) throw e;
    }
    const summary = {
      detected: links.length,
      examined: candidates.length,
      limit: 50,
      pageUrl,
      nextUrl: parsed?.nextUrl ?? null,
      publications: parsed?.publications ?? null,
      withoutPdf: parsed?.withoutPdf ?? 0,
      coverage:
        "Solo esta página. La biblioteca completa no está sincronizada.",
      annexes: "Pendientes de revisión individual",
    };
    const { error: e } = await c
      .from("legal_update_runs")
      .update({
        status:
          links.length > 50 ||
          Boolean(parsed?.nextUrl) ||
          Boolean(parsed?.withoutPdf)
            ? "partial"
            : "complete",
        summary,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    if (e) throw e;
    if (parsed && (!latest || !s.cursor_url)) {
      const { error: cursorError } = await c
        .from("legal_official_sources")
        .update({ cursor_url: parsed.nextUrl })
        .eq("id", s.id);
      if (cursorError) throw cursorError;
    }
    return { runId: run.id, ...summary };
  } catch (e) {
    await c
      .from("legal_update_runs")
      .update({
        status: "failed",
        summary: { error: e instanceof Error ? e.message : "Falló la lectura" },
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .throwOnError();
    throw e;
  }
}
export function followFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function publishDocumentEvent(
  documentId: string,
  kind: "publication" | "version",
  description: string,
) {
  const c = await getSupabaseAdminClient();
  const { data: d, error } = await c
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("es_institucional", true)
    .eq("status", "indexed")
    .single();
  if (error || !d || d.metadata.indexedTextComplete !== true)
    throw Error("La publicación todavía no está indexada completamente.");
  const { data: event, error: e } = await c
    .from("legal_document_events")
    .upsert(
      {
        document_id: d.id,
        kind,
        fingerprint: String(d.metadata.sha256),
        description,
        source_url: String(
          d.metadata.officialPublicationUrl ?? d.metadata.sourceUrl,
        ),
      },
      { onConflict: "document_id,kind,fingerprint" },
    )
    .select("id")
    .single();
  if (e) throw e;
  // Traverse followers by stable key; never discard subscribers at the REST default row cap.
  let cursor = "00000000-0000-0000-0000-000000000000";
  let notified = 0;
  for (let page = 0; page < 100; page++) {
    const { data: follows, error: fe } = await c
      .from("legal_source_follows")
      .select("*")
      .eq("paused", false)
      .gt("id", cursor)
      .order("id")
      .limit(500);
    if (fe) throw fe;
    const notices = (follows ?? []).filter(
      (f) =>
        f.document_id === d.id ||
        (d.metadata.relatedDocumentId === f.document_id && f.document_id) ||
        (f.search && matchesFollow(f.search, d)),
    );
    if (notices.length) {
      const { error: ne } = await c.from("legal_follow_notifications").upsert(
        notices.map((f) => ({
          owner_id: f.owner_id,
          follow_id: f.id,
          event_id: event.id,
        })),
        { onConflict: "follow_id,event_id", ignoreDuplicates: true },
      );
      if (ne) throw ne;
      notified += notices.length;
    }
    if (!follows || follows.length < 500) return { notified };
    cursor = follows.at(-1)!.id;
  }
  throw Error(
    "El reparto de novedades quedó parcial; requiere reintento administrativo.",
  );
}
