"use client";
import { useEffect, useState, useCallback } from "react";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { syncStateLabels } from "@/lib/document-sync-policy";
type Config = {
  enabled: boolean;
  document_types: string[];
  regimes: string[];
  code_prefix: string;
  last_error?: string;
  last_checked_at?: string;
};
type Source = {
  id: string;
  label: string;
  url: string;
  document_type: string;
  config: Config | null;
};
type Overview = {
  settings: {
    enabled: boolean;
    daily_limit: number;
    ai_error: string | null;
    ai_blocked_until: string | null;
    last_finished_at: string | null;
  };
  sources: Source[];
  counts: Record<string, number>;
  stages: Record<string, number>;
  jobs: Array<{
    id: string;
    stage: string;
    state: string;
    last_error: string | null;
    document_id: string | null;
    updated_at: string;
  }>;
  events: Array<{ id: number; detail: string; created_at: string }>;
  cronConfigured: boolean;
  schedule: string;
  moreJobs: boolean;
  usage: { day: string; reserved: number } | null;
};
function SourceRule({
  source,
  save,
  busy,
}: {
  source: Source;
  save: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [enabled, setEnabled] = useState(source.config?.enabled ?? false),
    [types, setTypes] = useState<string[]>(
      source.config?.document_types ?? [source.document_type],
    ),
    [regimes, setRegimes] = useState<string[]>(
      source.config?.regimes ?? ["32069", "30225"],
    ),
    [prefix, setPrefix] = useState(source.config?.code_prefix ?? "");
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <form
      className="rounded-xl border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({
          action: "source",
          sourceId: source.id,
          enabled,
          documentTypes: types,
          regimes,
          codePrefix: prefix,
        });
      }}
    >
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {source.label}
      </label>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="my-2 block break-all text-xs text-brand-dark underline"
      >
        Ver fuente oficial
      </a>
      {source.config?.document_types.includes("informe_vicio_nulidad") && (
        <p className="my-2 text-xs text-muted">
          Vigilancia del catálogo público: solo se descargan informes
          identificados como IVN. La ausencia de resultados no acredita que no
          existan informes en SEACE u otros repositorios oficiales.
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm">
          Tipos y regímenes de esta fuente
        </summary>
        <div className="my-3 grid gap-2 sm:grid-cols-2">
          {OFFICIAL_CORPUS_TYPES.filter(
            (t) => !["laudo_arbitral", "indice_documental"].includes(t.value),
          ).map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={types.includes(t.value)}
                onChange={() => setTypes(toggle(types, t.value))}
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Sin tipos seleccionados: todos los tipos reconocidos por el conector.
        </p>
        <fieldset className="my-3">
          <legend className="text-sm font-medium">
            Regímenes que se desean consultar
          </legend>
          {["32069", "30225"].map((r) => (
            <label
              className="mr-4 inline-flex items-center gap-2 text-sm"
              key={r}
            >
              <input
                type="checkbox"
                checked={regimes.includes(r)}
                onChange={() => setRegimes(toggle(regimes, r))}
              />
              Ley {r}
            </label>
          ))}
          <p className="mt-1 text-xs text-muted">
            Sin selección: cualquier régimen. La clasificación se comprueba en
            el contenido.
          </p>
        </fieldset>
        <label className="block text-sm">
          Código de resolución
          <select
            className="mt-1 block w-full rounded-lg border p-2"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          >
            <option value="">Sin restricción por código</option>
            <option value="TCP-S">TCP-S y sus salas</option>
          </select>
        </label>
      </details>
      <p className="my-2 text-xs text-muted">
        Última revisión:{" "}
        {source.config?.last_checked_at
          ? new Date(source.config.last_checked_at).toLocaleString("es-PE", {
              timeZone: "America/Lima",
            })
          : "Todavía no ejecutada"}
      </p>
      {source.config?.last_error && (
        <p className="my-2 text-sm text-warning">
          {source.config.last_error}
        </p>
      )}
      <button className="secondaryButton mt-2" disabled={busy}>
        Guardar fuente
      </button>
    </form>
  );
}
export function DocumentSyncPanel() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [pollUntil, setPollUntil] = useState(0);
  const load = useCallback(async () => {
    const r = await fetch("/api/library/sync", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/library/sync", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (pollUntil < Date.now()) return;
    const timer = setInterval(() => {
      if (Date.now() > pollUntil) {
        clearInterval(timer);
        return;
      }
      void load().catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [load, pollUntil]);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/library/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(d.message ?? "Configuración guardada.");
      // El servidor dispone de hasta cinco minutos para concluir el lote.
      if (body.action === "run") setPollUntil(Date.now() + 300000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="documentSyncPanel tw my-4 rounded-2xl border border-brand/20 bg-panel p-4 sm:p-6"
      aria-labelledby="document-sync-title"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
        Administración de la biblioteca
      </p>
      <h2
        id="document-sync-title"
        className="mt-1 text-xl font-semibold text-ink"
      >
        Actualización documental
      </h2>
      <p className="mt-2 text-sm text-muted">
        Fuentes oficiales, descargas y cola de incorporación. Un PDF almacenado
        todavía puede estar pendiente de revisión o indexación.
      </p>
      {error && (
        <p
          role="alert"
          className="my-3 rounded-lg bg-warning-soft p-3 text-sm text-ink"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="my-3 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark"
        >
          {message}
        </p>
      )}
      {!data ? (
        <p className="my-4 text-sm">{error ? "La configuración no está disponible. Recarga esta página para reintentar." : "Consultando configuración…"}</p>
      ) : (
        <>
          <div className="my-4 rounded-xl bg-surface p-4">
            <p className="font-medium">
              {data.settings.enabled
                ? "Actualización activada"
                : "Actualización en pausa"}
            </p>
            <p className="mt-1 text-sm">{data.schedule}</p>
            <p className="mt-1 text-xs text-muted">
              {data.cronConfigured
                ? "El secreto de programación está configurado."
                : "Falta configurar el secreto de programación en el servidor."}{" "}
              Cada ejecución procesa una parte; el saldo pendiente continúa en
              el siguiente ciclo.
            </p>
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action({
                  action: "settings",
                  enabled: f.get("enabled") === "on",
                  dailyLimit: Number(f.get("limit")),
                });
              }}
              key={`${data.settings.enabled}-${data.settings.daily_limit}`}
            >
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={data.settings.enabled}
                />
                Revisar cada día
              </label>
              <label className="text-sm">
                Máximo de descargas al día
                <input
                  name="limit"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={data.settings.daily_limit}
                  className="ml-2 w-20 rounded-lg border p-2"
                />
              </label>
              <button disabled={busy} className="secondaryButton">
                Guardar programación
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="primaryButton"
                disabled={busy || !data.settings.enabled}
                onClick={() => void action({ action: "run" })}
              >
                Revisar y continuar cola
              </button>
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => void action({ action: "resume" })}
              >
                Reintentar tras restablecer IA
              </button>
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => void action({ action: "adopt" })}
              >
                Incluir lote TCP almacenado
              </button>
            </div>
            {data.settings.ai_error && (
              <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-ink">
                Indexación pausada por el proveedor: {data.settings.ai_error}.
                Los originales se conservan.
              </p>
            )}
          </div>
          <div className="my-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {Object.entries(data.counts).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-3">
                <span className="block text-xs text-muted">
                  {syncStateLabels[key]}
                </span>
                <strong className="text-xl">{value}</strong>
              </div>
            ))}
          </div>
          <p className="my-3 text-sm text-muted">
            Pendientes de descarga: {data.stages?.download ?? 0} · Originales
            pendientes de clasificación: {data.stages?.classify ?? 0} ·
            Pendientes de indexación: {data.stages?.index ?? 0}.
            {data.usage &&
              ` Intentos de descarga reservados el ${data.usage.day}: ${data.usage.reserved}/${data.settings.daily_limit}.`}
          </p>
          <details className="my-4" open>
            <summary className="cursor-pointer font-semibold">
              Fuentes y criterios de descarga
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {data.sources.map((s) => (
                <SourceRule
                  key={`${s.id}-${JSON.stringify(s.config)}`}
                  source={s}
                  busy={busy}
                  save={action}
                />
              ))}
            </div>
          </details>
          <details className="my-4">
            <summary className="cursor-pointer font-semibold">
              Cola e incidencias · últimas {data.jobs.length}
              {data.moreJobs ? " (hay más trabajos)" : ""}
            </summary>
            <ul className="mt-3 divide-y">
              {data.jobs.map((j) => (
                <li key={j.id} className="py-3 text-sm">
                  <strong>
                    {syncStateLabels[j.stage]} · {syncStateLabels[j.state]}
                  </strong>
                  <span className="ml-2 text-xs text-muted">
                    {new Date(j.updated_at).toLocaleString("es-PE", {
                      timeZone: "America/Lima",
                    })}
                  </span>
                  {j.last_error && (
                    <p className="mt-1 text-warning">{j.last_error}</p>
                  )}
                  {j.document_id && (
                    <a
                      className="mt-1 inline-block text-brand-dark underline"
                      href={`/api/documents/${j.document_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir PDF almacenado
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold">
              Registro de actividad
            </summary>
            <ul className="mt-2 divide-y">
              {data.events.map((e) => (
                <li className="py-2 text-sm" key={e.id}>
                  {new Date(e.created_at).toLocaleString("es-PE", {
                    timeZone: "America/Lima",
                  })}{" "}
                  · {e.detail}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
