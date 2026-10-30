"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { eventLabel } from "@/lib/library-follow";
type Follow = {
  id: string;
  label: string;
  paused: boolean;
  document_id: string | null;
};
type Notice = {
  id: string;
  read_at: string | null;
  event: {
    kind: string;
    description: string;
    document_id: string;
    source_url: string;
    created_at: string;
  } | null;
};
export function FollowWorkspace() {
  const [data, setData] = useState<{
      follows: Follow[];
      notifications: Notice[];
    } | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/library/follows?page=${page}`, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [page, revision]);
  async function change(
    id: string,
    action: "read" | "pause" | "delete",
    paused?: boolean,
  ) {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/library/follows${action === "delete" ? `?id=${id}` : ""}`,
        {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body:
            action === "delete"
              ? undefined
              : JSON.stringify({ id, action, paused }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error ?? "Seguimiento no disponible.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="tw my-4 rounded-2xl border bg-white p-5">
      <summary className="cursor-pointer font-semibold text-teal-900">
        Mis seguimientos y novedades jurídicas
      </summary>
      <p className="my-3 text-xs text-slate-600">
        Avisos dentro de ACE. Las búsquedas guardadas siguen palabras del título
        y tema con sus filtros; la cobertura no es exhaustiva. Una publicación
        nueva no acredita modificación jurídica.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {!data && !error ? <p>Cargando seguimientos…</p> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Seguimientos">
          <h3 className="font-semibold">Fuentes y búsquedas</h3>
          {data?.follows.slice(0, 20).map((f) => (
            <article key={f.id} className="border-b py-3">
              <p className="text-sm">
                {f.label} · {f.paused ? "Pausado" : "Activo"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="secondaryButton"
                  disabled={busy}
                  onClick={() => void change(f.id, "pause", !f.paused)}
                >
                  {f.paused ? "Reanudar" : "Pausar"}
                </button>
                <button
                  className="secondaryButton"
                  disabled={busy}
                  onClick={() => void change(f.id, "delete")}
                >
                  Dejar de seguir
                </button>
                {f.document_id ? (
                  <Link
                    className="secondaryButton"
                    href={`/normas?documentId=${f.document_id}`}
                  >
                    Abrir fuente
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {data && !data.follows.length ? (
            <p className="my-3 text-sm">
              Todavía no sigues fuentes ni búsquedas.
            </p>
          ) : null}
        </section>
        <section aria-label="Avisos jurídicos">
          <h3 className="font-semibold">Cambios detectados</h3>
          {data?.notifications.slice(0, 20).map((n) => (
            <article key={n.id} className="border-b py-3">
              <p className="text-sm font-semibold">
                {eventLabel(n.event?.kind ?? "")}
              </p>
              <p className="my-2 text-sm">
                {n.event?.description ??
                  "La fuente del aviso ya no está disponible."}
              </p>
              {n.event ? (
                <Link
                  className="text-sm text-teal-800 underline"
                  href={`/normas?documentId=${n.event.document_id}`}
                >
                  Revisar documento
                </Link>
              ) : null}
              {!n.read_at ? (
                <button
                  className="secondaryButton ml-2"
                  disabled={busy}
                  onClick={() => void change(n.id, "read")}
                >
                  Marcar leído
                </button>
              ) : null}
            </article>
          ))}
          {data && !data.notifications.length ? (
            <p className="my-3 text-sm">
              Sin novedades registradas en esta página.
            </p>
          ) : null}
        </section>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          className="secondaryButton"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span className="text-xs">Página {page}</span>
        <button
          className="secondaryButton"
          disabled={
            !data ||
            (data.follows.length <= 20 && data.notifications.length <= 20)
          }
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </details>
  );
}
