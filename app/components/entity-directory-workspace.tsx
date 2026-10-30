"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { DirectoryEntity } from "@/lib/entity-directory";
export function EntityDirectoryWorkspace() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<DirectoryEntity[]>([]),
    [total, setTotal] = useState(0),
    [documents, setDocuments] = useState(0),
    [canReview, setCanReview] = useState(false),
    [selected, setSelected] = useState<DirectoryEntity | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      setMessage("");
      try {
        const r = await fetch(
          `/api/library/entities?${new URLSearchParams({ q, page: String(page) })}`,
          { signal: c.signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRows(d.entities);
        setTotal(d.total);
        setDocuments(d.documentTotal);
        setCanReview(d.canReview);
      } catch (e) {
        if (!c.signal.aborted)
          setMessage(e instanceof Error ? e.message : "No se pudo consultar.");
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q, page, version]);
  async function review(form: FormData) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/library/entities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          revision: selected.revision,
          name: form.get("name"),
          aliases: String(form.get("aliases") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          ruc: form.get("ruc"),
          rucVerified: form.get("rucVerified") === "on",
          status: form.get("status"),
          sourceUrl: form.get("sourceUrl"),
          evidence: form.get("evidence"),
          reason: form.get("reason"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSelected(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tw librarySourcesWorkspace space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
          Procedencia y roles
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Directorio de entidades
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          La identidad de una entidad y la cobertura documental se comprueban
          por separado. Un nombre detectado todavía requiere revisión; no
          acredita un RUC.
        </p>
      </header>
      <label className="block text-sm font-semibold">
        Nombre, sigla o RUC
        <input
          className="mt-2 block w-full rounded-xl border bg-white p-3"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
      </label>
      <p className="text-sm text-slate-600" aria-live="polite">
        {busy
          ? "Consultando…"
          : `${total} coincidencias en el directorio · ${documents} documentos institucionales asociados en total`}
      </p>
      {message ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((e) => (
          <article key={e.id} className="rounded-2xl border bg-white p-5">
            <h3 className="font-semibold">{e.name}</h3>
            <p className="my-2 text-sm">
              {e.status === "verified"
                ? "Nombre verificado"
                : "Nombre detectado · pendiente de revisión"}
            </p>
            <p className="text-sm text-slate-600">
              {e.ruc
                ? `${e.ruc_verified ? "RUC verificado" : "RUC sin verificar"}: ${e.ruc}`
                : "RUC sin comprobar"}{" "}
              · {e.document_count ?? 0} documentos asociados
            </p>
            {e.aliases.length ? (
              <p className="mt-2 text-sm">También: {e.aliases.join(", ")}</p>
            ) : null}
            <details className="my-3 text-sm">
              <summary className="cursor-pointer">
                Procedencia y revisión
              </summary>
              <p className="mt-2 whitespace-pre-wrap">
                {e.evidence || "Sin evidencia registrada."}
              </p>
              {e.source_url ? (
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-800 underline"
                >
                  Consultar fuente oficial
                </a>
              ) : null}
              <p>
                Revisión {e.revision} ·{" "}
                {e.reviewed_at
                  ? new Date(e.reviewed_at).toLocaleDateString("es-PE")
                  : "Sin revisión administrativa"}
              </p>
            </details>
            <div className="flex flex-wrap gap-3">
              <Link
                className="secondaryButton"
                href={`/normas?library=collections&contractingEntity=${encodeURIComponent(e.name)}`}
              >
                Buscar documentos
              </Link>
              {canReview ? (
                <button
                  className="secondaryButton"
                  onClick={() => setSelected(e)}
                >
                  Revisar identidad
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!busy && !rows.length ? (
        <p>
          Sin entidades con estos criterios. El directorio no representa todas
          las entidades del país.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
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
          disabled={page * 10 >= total || busy}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
      {selected ? (
        <section
          aria-label="Revisión de identidad"
          className="rounded-2xl border border-teal-700 bg-white p-5"
        >
          <h3 className="text-lg font-bold">
            Revisar identidad · {selected.name}
          </h3>
          <p className="my-2 text-sm text-slate-600">
            Registra la evidencia oficial que respalda el nombre y, por
            separado, el RUC. Esta revisión no confirma vigencia jurídica.
          </p>
          <form
            action={review}
            className="grid gap-4 sm:grid-cols-2"
            key={selected.id}
          >
            {[
              ["name", "Nombre", selected.name],
              [
                "aliases",
                "Siglas o alias separados por coma",
                selected.aliases.join(", "),
              ],
              ["ruc", "RUC opcional", selected.ruc ?? ""],
              ["sourceUrl", "URL de fuente oficial", selected.source_url ?? ""],
            ].map(([name, label, value]) => (
              <label key={name} className="text-sm font-semibold">
                {label}
                <input
                  name={name}
                  defaultValue={value}
                  required={name === "name" || name === "sourceUrl"}
                  className="mt-2 w-full rounded-lg border p-3"
                  maxLength={name === "sourceUrl" ? 1500 : 250}
                />
              </label>
            ))}
            <label className="text-sm font-semibold">
              Estado del nombre
              <select
                name="status"
                defaultValue={selected.status}
                className="mt-2 w-full rounded-lg border p-3"
              >
                <option value="detected">Detectado</option>
                <option value="verified">Verificado con evidencia</option>
                <option value="rejected">Rechazado</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="rucVerified"
                defaultChecked={selected.ruc_verified}
              />
              La fuente acredita el RUC de esta entidad
            </label>
            <label className="text-sm sm:col-span-2">
              Evidencia textual
              <textarea
                name="evidence"
                required
                minLength={15}
                maxLength={3000}
                defaultValue={selected.evidence}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Motivo de la revisión
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <div className="flex gap-3">
              <button className="primaryButton" disabled={busy}>
                Guardar revisión
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </section>
  );
}
