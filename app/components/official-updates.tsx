"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { OECE_OFFICIAL_SOURCE } from "@/lib/official-source-config";
import { DocumentSyncPanel } from './document-sync-panel';
type Source = {
  id: string;
  label: string;
  url: string;
  document_type: string;
  source_entity: string;
  cursor_url?: string | null;
};
type Candidate = {
  id: string;
  source_id: string;
  file_url: string;
  title: string;
  status: string;
  error: string | null;
  document_id: string | null;
  publication_url?: string | null;
  publication_date?: string | null;
  document_number?: string | null;
  detected_type?: string | null;
};
type Run = {
  id: string;
  status: string;
  created_at: string;
  summary: Record<string, unknown>;
};
export function OfficialUpdates() {
  const [data, setData] = useState<{
      canManage: boolean;
      sources: Source[];
      candidates: Candidate[];
      runs: Run[];
    } | null>(null),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Candidate | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/library/updates?page=${page}`, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [page, version]);
  async function request(body: Record<string, unknown>, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/library/updates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setVersion((v) => v + 1);
      setSelected(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "La ejecución quedó pendiente.",
      );
    } finally {
      setBusy(false);
    }
  }
  const source = selected
    ? data?.sources.find((s) => s.id === selected.source_id)
    : undefined;
  const input = (name: string, label: string, value = "", required = true) => (
    <label key={name} className="text-sm">
      {label}
      <input
        name={name}
        defaultValue={value}
        required={required}
        maxLength={name.toLowerCase().includes("url") ? 1500 : 400}
        className="mt-1 w-full rounded-lg border bg-white p-3"
      />
    </label>
  );
  const types = (value?: string) => (
    <label className="text-sm">
      Tipo documental
      <select
        name="type"
        defaultValue={value ?? ""}
        required
        className="mt-1 w-full rounded-lg border bg-white p-3"
      >
        <option value="">Selecciona el tipo tras revisar el original</option>
        {OFFICIAL_CORPUS_TYPES.filter(
          (t) => t.value !== "indice_documental",
        ).map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <details className="tw my-5 rounded-2xl border bg-white p-5">
      <summary className="cursor-pointer text-lg font-semibold text-teal-900">
        Actualización documental controlada
      </summary>
      <p className="my-3 text-sm text-slate-600">
        Detección manual de enlaces PDF directos en páginas oficiales. Los
        candidatos no entran en Chat antes de aprobar procedencia y completar
        indexación. La programación y la cola se gestionan en el panel inferior.
      </p>
      <p className="my-3 text-sm">
        <a
          className="text-teal-800 underline"
          href={OECE_OFFICIAL_SOURCE}
          target="_blank"
          rel="noreferrer"
        >
          Fuente principal: Normas y documentos legales del OECE
        </a>
      </p>
      {error ? (
        <p role="alert" className="my-3 rounded bg-amber-50 p-3">
          {error}
        </p>
      ) : null}
      {!data ? (
        <p>Cargando fuentes…</p>
      ) : !data.canManage ? (
        <p>
          Las incorporaciones las revisa un administrador. Las fuentes aceptadas
          aparecen en Novedades.
        </p>
      ) : (
        <>
          <DocumentSyncPanel />
          <form
            action={async (f) =>
              request({
                action: "register",
                label: f.get("label"),
                url: f.get("url"),
                documentType: f.get("type"),
                sourceEntity: f.get("entity"),
              })
            }
            className="my-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
          >
            <h3 className="font-semibold sm:col-span-2">
              Registrar página oficial
            </h3>
            <button
              className="secondaryButton sm:col-span-2"
              type="button"
              disabled={busy}
              onClick={() =>
                void request({
                  action: "register",
                  label: "OECE · Normas y documentos legales",
                  url: OECE_OFFICIAL_SOURCE,
                  documentType: "resolucion",
                  sourceEntity: "OECE",
                })
              }
            >
              Usar catálogo oficial del OECE
            </button>
            {input("label", "Nombre de la fuente")}
            {input("url", "URL oficial de publicaciones")}
            {input("entity", "Entidad emisora")}
            {types()}
            <div>
              <button className="primaryButton" disabled={busy}>
                Registrar fuente
              </button>
            </div>
          </form>
          {data.sources.slice(0, 20).map((s) => (
            <article key={s.id} className="my-3 rounded-lg border p-3">
              <strong className="text-sm">{s.label}</strong>
              <a
                className="mt-1 block break-all text-xs text-teal-800 underline"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.url}
              </a>
              <button
                className="secondaryButton mt-2 mr-2"
                disabled={busy}
                onClick={() => void request({ action: "run", sourceId: s.id, latest: true })}
              >
                Revisar publicaciones recientes
              </button>
              <button
                className="secondaryButton mt-2"
                disabled={busy}
                onClick={() => void request({ action: "run", sourceId: s.id })}
              >
                {busy
                  ? "Procesando…"
                  : s.cursor_url
                    ? "Revisar siguiente página oficial"
                    : "Detectar publicaciones ahora"}
              </button>
            </article>
          ))}
          <h3 className="my-4 font-semibold">Últimas ejecuciones</h3>
          {data.runs.map((r) => (
            <p key={r.id} className="my-2 text-xs text-slate-600">
              {new Date(r.created_at).toLocaleString("es-PE")} · {({ partial: "Revisión parcial", complete: "Página revisada", running: "En proceso", failed: "No se pudo completar" } as Record<string, string>)[r.status] ?? r.status} ·{" "}
              {typeof r.summary.detected === "number"
                ? `${r.summary.detected} enlaces detectados`
                : "Sin conteo confirmado"}
              {typeof r.summary.error === "string"
                ? ` · ${r.summary.error}`
                : ""}
            </p>
          ))}
          <h3 className="my-4 font-semibold">Candidatos y resultados</h3>
          {!data.candidates.length ? (
            <p>
              Sin candidatos en esta página. No acredita ausencia de
              publicaciones nuevas.
            </p>
          ) : null}
          {data.candidates.slice(0, 20).map((c) => (
            <article key={c.id} className="border-b py-3">
              <strong className="text-sm">{c.title}</strong>
              <p className="my-2 text-xs">
                {({ pending: "Pendiente", accepted: "Incorporado", processing: "Procesando", rejected: "Descartado", failed: "No se pudo incorporar" } as Record<string, string>)[c.status] ?? c.status} · Anexos, clasificación sugerida y versión requieren
                revisión individual.
              </p>
              {c.error ? (
                <p className="my-2 text-sm text-amber-900">{c.error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <a
                  className="secondaryButton"
                  href={c.file_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original oficial
                </a>
                {["pending", "failed"].includes(c.status) ? (
                  <button
                    className="secondaryButton"
                    disabled={busy}
                    onClick={() => setSelected(c)}
                  >
                    Revisar incorporación
                  </button>
                ) : null}
                {c.document_id ? (
                  <Link
                    className="secondaryButton"
                    href={`/normas?documentId=${c.document_id}`}
                  >
                    Ver en ACE
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          <div className="my-4 flex gap-3">
            <button
              className="secondaryButton"
              disabled={page === 1 || busy}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>Página {page}</span>
            <button
              className="secondaryButton"
              disabled={data.candidates.length <= 20 || busy}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
          {selected ? (
            <form
              key={selected.id}
              action={async (f) =>
                request(
                  {
                    id: selected.id,
                    title: f.get("title"),
                    documentType: f.get("type"),
                    sourceEntity: f.get("entity"),
                    publicationUrl: f.get("publicationUrl"),
                    number: f.get("number"),
                    version: f.get("version"),
                    relatedDocumentId: f.get("related") || undefined,
                    evidence: f.get("evidence"),
                    annexesAccounted: f.get("annexes") === "on",
                  },
                  "PATCH",
                )
              }
              className="my-4 grid gap-4 rounded-xl border border-teal-700 p-4 sm:grid-cols-2"
            >
              <h3 className="font-semibold sm:col-span-2">
                Revisar procedencia, versión y anexos
              </h3>
              {input("title", "Título", selected.title)}
              {input("entity", "Emisor", source?.source_entity)}
              {input(
                "publicationUrl",
                "Publicación oficial que enlaza este archivo",
                selected.publication_url ?? source?.url,
              )}
              {input(
                "number",
                "Número documental opcional",
                selected.document_number ?? "",
                false,
              )}
              {input("version", "Identificación de esta versión")}
              {input(
                "related",
                "ID de documento relacionado (opcional)",
                "",
                false,
              )}
              {types(
                selected.detected_type ??
                  (source?.url === OECE_OFFICIAL_SOURCE
                    ? undefined
                    : source?.document_type),
              )}
              <label className="text-sm sm:col-span-2">
                Evidencia y alcance de los anexos
                <textarea
                  name="evidence"
                  minLength={20}
                  maxLength={3000}
                  required
                  className="mt-1 w-full rounded-lg border p-3"
                />
              </label>
              <label className="flex items-start gap-3 text-sm sm:col-span-2">
                <input name="annexes" type="checkbox" required />
                Comprobé la procedencia y contabilicé los anexos necesarios. Las
                relaciones jurídicas quedan pendientes de revisión.
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button className="primaryButton" disabled={busy}>
                  {busy
                    ? "Comprobando e indexando…"
                    : "Aprobar incorporación y comprobar índice"}
                </button>
                <button
                  className="secondaryButton"
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </details>
  );
}
