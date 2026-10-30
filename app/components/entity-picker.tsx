"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { DirectoryEntity } from "@/lib/entity-directory";
export function EntityPicker({
  onSelect,
}: {
  onSelect: (entity: DirectoryEntity) => void;
}) {
  const id = useId();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<{
      entities: DirectoryEntity[];
      total: number;
      directoryTotal: number;
      documentTotal: number;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const r = await fetch(
          `/api/library/entities?${new URLSearchParams({ q, page: String(page) })}`,
          { signal: c.signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo consultar.");
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q, page]);
  return (
    <details className="tw rounded-xl border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-teal-800">
        Elegir entidad del directorio
      </summary>
      <label htmlFor={id} className="mt-3 block text-sm">
        Nombre, sigla o RUC
      </label>
      <input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="mt-2 w-full rounded-lg border p-3"
        autoComplete="off"
      />
      {error ? (
        <p role="alert" className="p-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="my-2 text-xs text-slate-600">
        {busy
          ? "Consultando…"
          : data
            ? `${data.directoryTotal} entidades registradas · ${data.documentTotal} documentos asociados en ACE`
            : "Directorio con procedencia y revisión separadas."}
      </p>
      <ul className="divide-y">
        {!busy &&
          data?.entities.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="w-full rounded p-3 text-left hover:bg-teal-50 focus-visible:outline-2"
              >
                <strong className="block text-sm">{e.name}</strong>
                <span className="text-xs text-slate-600">
                  {e.status === "verified"
                    ? "Nombre verificado"
                    : "Nombre detectado"}{" "}
                  ·{" "}
                  {e.ruc
                    ? e.ruc_verified
                      ? `RUC verificado: ${e.ruc}`
                      : `RUC por revisar: ${e.ruc}`
                    : "Sin RUC comprobado"}{" "}
                  · {e.document_count ?? 0} documentos
                </span>
              </button>
            </li>
          ))}
      </ul>
      {!busy && data?.total === 0 ? (
        <p className="p-2 text-sm">
          Sin coincidencias en este directorio. Puedes mantener la búsqueda
          libre.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="secondaryButton"
          disabled={busy || page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span className="text-xs">Página {page}</span>
        <button
          type="button"
          className="secondaryButton"
          disabled={busy || !data || page * 10 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
        <Link
          href="/normas?library=entities"
          className="text-sm text-teal-800 underline"
        >
          Ver directorio y revisiones
        </Link>
      </div>
    </details>
  );
}
