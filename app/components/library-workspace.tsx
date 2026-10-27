"use client";
import"./library-workspace.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LIBRARY_COLLECTIONS,
  LIBRARY_PROCEDURES,
  librarySourceNotice,
} from "@/lib/library-workspace";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
} from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { SaveButton } from "./save-button";
import { SourceWorkLink } from "./source-work-link";
import { LegalCenterNav } from "./legal-center-nav";
import { NormativeBrowser } from "./normative-browser";
type Row = {
  id: string;
  title: string;
  documentType: string;
  sourceEntity: string | null;
  processType: string | null;
  status: string;
  mimeType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  collections: string[];
};
const views = [
  { id: "catalogue", label: "Catálogo" },
  { id: "collections", label: "Por materia" },
  { id: "templates", label: "Bases editables" },
  { id: "news", label: "Novedades" },
];
export function LibraryLaunchBar() {
  return (
    <nav
      aria-label="Explorar la biblioteca"
      className="tw mb-4 flex flex-wrap gap-2"
    >
      {views.slice(1).map((v) => (
        <Link
          key={v.id}
          href={`/normas?library=${v.id}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2"
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
export function NormativeWorkspace() {
  const params = useSearchParams();
  const view = params.get("library") ?? "catalogue";
  if (params.get("documentId")) return <NormativeBrowser />;
  return (
    <>
      <nav
        aria-label="Formas de explorar Normativa"
        className="tw mb-4 flex flex-wrap gap-2"
      >
        {views.map((v) => (
          <Link
            key={v.id}
            aria-current={view === v.id ? "page" : undefined}
            href={v.id === "catalogue" ? "/normas" : `/normas?library=${v.id}`}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${view === v.id ? "border-teal-700 bg-teal-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-teal-50"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {view === "catalogue" ? (
        <NormativeBrowser />
      ) : (
        <LibraryWorkspace
          key={view}
          view={view === "templates" || view === "news" ? view : "collections"}
        />
      )}
    </>
  );
}
function date(value: unknown) {
  return typeof value === "string"
    ? value.slice(0, 10)
    : "Sin fecha comprobada";
}
export function LibraryWorkspace({
  view,
}: {
  view: "collections" | "templates" | "news";
}) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? ""),
    [collection, setCollection] = useState(params.get("collection") ?? ""),
    [entity, setEntity] = useState(params.get("contractingEntity") ?? ""),
    [ruc, setRuc] = useState(params.get("ruc") ?? ""),
    [type, setType] = useState(params.get("documentType") ?? ""),
    [process, setProcess] = useState(params.get("processType") ?? ""),
    [object, setObject] = useState(params.get("object") ?? ""),
    [regime, setRegime] = useState(params.get("regime") ?? ""),
    [includePdf, setIncludePdf] = useState(
      params.get("editableOnly") === "false",
    ),
    [from, setFrom] = useState(params.get("publishedFrom") ?? ""),
    [to, setTo] = useState(params.get("publishedTo") ?? ""),
    [version, setVersion] = useState(params.get("version") ?? ""),
    [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1)),
    [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(0),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [entityCount, setEntityCount] = useState(0),
    [rucCount, setRucCount] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const search = new URLSearchParams({
          view,
          q,
          collection,
          contractingEntity: entity,
          ruc: ruc.length === 11 ? ruc : "",
          editableOnly: includePdf ? "false" : "true",
          publishedFrom: from,
          publishedTo: to,
          version,
          documentType: type,
          processType: process,
          object,
          regime,
          page: String(page),
        });
        const r = await fetch(`/api/library?${search}`, {
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRows(d.documents);
        if (d.page !== page) setPage(d.page);
        const nav = new URLSearchParams(search);
        nav.delete("view");
        for(const[key,value]of [...nav])if(!value||(key==="page"&&value==="1")||(key==="editableOnly"&&value==="true"))nav.delete(key);
        nav.set("library", view);
        window.history.replaceState(window.history.state, "", `/normas?${nav}`);
        setTotal(d.total);
        setPages(d.pages);
        setCounts(d.facets?.collections ?? {});
        setEntityCount(d.facets?.entityClassified ?? 0);
        setRucCount(d.facets?.rucClassified ?? 0);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar la biblioteca.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    view,
    q,
    collection,
    entity,
    ruc,
    type,
    process,
    object,
    regime,
    page,
    includePdf,
    from,
    to,
    version,
  ]);
  const field =
    (set: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      set(e.target.value);
      setPage(1);
    };
  return (
    <section className="tw librarySourcesWorkspace min-w-0 space-y-5">
      <LegalCenterNav active="normas" />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
          Biblioteca oficial
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">
          {view === "templates"
            ? "Elige una base editable"
            : view === "news"
              ? "Publicaciones e incorporaciones recientes"
              : "Explora por materia"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {view === "news"
            ? "La publicación oficial y la incorporación a ACE son fechas distintas. El catálogo no acredita cobertura completa."
            : "Lee el original, reúne fuentes y consulta a la IA conservando la versión."}
        </p>
      </header>
      {view === "collections" ? (
        <nav
          className="grid grid-cols-2 gap-3 lg:grid-cols-3"
          aria-label="Materias"
        >
          {LIBRARY_COLLECTIONS.map((c) => (
            <button
              key={c.id}
              aria-pressed={collection === c.id}
              onClick={() => {
                setCollection(collection === c.id ? "" : c.id);
                setPage(1);
              }}
              className={`min-h-20 rounded-xl border p-4 text-left ${collection === c.id ? "border-teal-700 bg-teal-50" : "border-slate-200 bg-white"}`}
            >
              <strong className="block text-sm">{c.label}</strong>
              <span className="text-xs text-slate-500">
                {counts[c.id] ?? 0} documentos · clasificación orientativa
              </span>
            </button>
          ))}
        </nav>
      ) : null}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        {view === "templates" ? (
          <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={includePdf}
              onChange={(e) => {
                setIncludePdf(e.target.checked);
                setPage(1);
              }}
            />
            Incluir otras versiones publicadas en PDF
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-semibold">
          Título, número o tema
          <input
            className="rounded-xl border border-slate-300 px-3 py-3 font-normal"
            value={q}
            onChange={field(setQ)}
            placeholder="Busca en esta colección"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2 text-sm">
            {view === "templates" ? "Procedimiento" : "Tipo"}
            <select
              className="rounded-lg border p-2"
              value={view === "templates" ? process : type}
              onChange={field(view === "templates" ? setProcess : setType)}
            >
              <option value="">Todos</option>
              {(view === "templates"
                ? LIBRARY_PROCEDURES
                : DOCUMENT_TYPES.filter(
                    (t) =>
                      ![
                        "otros",
                        "contrato",
                        "expediente",
                        "bases_integradas",
                      ].includes(t.value),
                  )
              ).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Régimen revisado
            <select
              className="rounded-lg border p-2"
              value={regime}
              onChange={field(setRegime)}
            >
              <option value="">Todos</option>
              <option value="32069">Ley 32069</option>
              <option value="30225">Ley 30225</option>
              <option value="no_determinado">Sin identificar</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Objeto
            <select
              className="rounded-lg border p-2"
              value={object}
              onChange={field(setObject)}
            >
              <option value="">Todos</option>
              {["bienes", "servicios", "obras", "consultoria"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer py-2 text-sm font-semibold">
            Entidad/RUC y procedimiento
          </summary>
          <div className="my-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm">
              Publicación desde
              <input
                className="rounded-lg border p-2"
                type="date"
                value={from}
                onChange={field(setFrom)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Publicación hasta
              <input
                className="rounded-lg border p-2"
                type="date"
                value={to}
                onChange={field(setTo)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Versión o actualización
              <input
                className="rounded-lg border p-2"
                value={version}
                onChange={field(setVersion)}
                placeholder="Etiqueta registrada o título"
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm">
              Entidad contratante o solicitante
              <input
                className="rounded-lg border p-2"
                value={entity}
                onChange={field(setEntity)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              RUC
              <input
                inputMode="numeric"
                maxLength={11}
                className="rounded-lg border p-2"
                value={ruc}
                onChange={field(setRuc)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Procedimiento
              <select
                className="rounded-lg border p-2"
                value={process}
                onChange={field(setProcess)}
              >
                <option value="">Todos</option>
                {LIBRARY_PROCEDURES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {entityCount} documentos tienen entidad contratante/solicitante
            registrada. El emisor se muestra por separado; no se deduce el RUC.
            {rucCount === 0
              ? " Todavía no hay RUC clasificados; por ahora busca por nombre de entidad."
              : ` ${rucCount} documentos tienen RUC registrado.`}
          </p>
        </details>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-teal-800 underline"
          onClick={() => {
            setQ("");
            setCollection("");
            setEntity("");
            setRuc("");
            setType("");
            setProcess("");
            setObject("");
            setRegime("");
            setIncludePdf(false);
            setFrom("");
            setTo("");
            setVersion("");
            setPage(1);
          }}
        >
          Restablecer filtros
        </button>
      </form>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          {error}
        </div>
      ) : busy ? (
        <p role="status">Consultando documentos…</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {total} documentos · página {page} de {Math.max(1, pages)}
          </p>
          {!rows.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <strong>
                {collection && (counts[collection] ?? 0) === 0
                  ? "Esta materia aún no tiene documentos clasificados"
                  : "Sin coincidencias con estos filtros"}
              </strong>
              <p className="mt-2 text-sm">
                Prueba quitar un filtro. No significa que no existan otras
                fuentes pertinentes fuera del catálogo.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((d) => (
              <article
                key={d.id}
                className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-xs font-bold uppercase text-teal-800">
                  {documentTypeLabel(d.documentType)} ·{" "}
                  {d.mimeType.includes("wordprocessing")
                    ? "DOCX editable"
                    : d.mimeType.startsWith("text/")
                      ? "Texto web"
                      : "PDF"}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-6">{d.title}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Emisor: {d.sourceEntity ?? "Sin registrar"}
                </p>
                {d.metadata.contractingEntity || d.metadata.requestingEntity ? (
                  <p className="text-sm text-slate-600">
                    Entidad{" "}
                    {d.metadata.entityReviewStatus === "confirmed"
                      ? "revisada"
                      : "detectada en la fuente"}
                    :{" "}
                    {String(
                      d.metadata.contractingEntity ??
                        d.metadata.requestingEntity,
                    )}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-600">
                  Publicación: {date(d.metadata.publicationDate)} · En ACE:{" "}
                  {date(d.metadata.importedAt ?? d.createdAt)}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Versión:{" "}
                  {String(
                    d.metadata.officialVersion ?? "Sin etiqueta comprobada",
                  )}
                </p>
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  {librarySourceNotice(d.documentType)}
                  {d.metadata.isDerivedWebSnapshot ? (
                    <span className="block">
                      Copia de texto web; los anexos vinculados requieren
                      comprobación aparte.
                    </span>
                  ) : null}
                  <br />
                  {d.status === "indexed"
                    ? "Disponible para consulta. Vigencia y aplicación requieren revisión."
                    : `Consulta IA pendiente: ${String(d.metadata.indexingPendingReason ?? d.status)}`}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <PdfCiteButton
                    documentId={d.id}
                    label="Leer contenido"
                    sidePanel
                  />
                  <a
                    className="secondaryButton compactButton"
                    href={`/api/documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Descargar original
                  </a>
                  {d.status === "indexed" &&
                  d.documentType !== "indice_documental" ? (
                    <Link
                      className="secondaryButton compactButton"
                      href={`/chat?documentId=${d.id}&documentType=${d.documentType}`}
                    >
                      Consultar en Chat
                    </Link>
                  ) : null}
                  <SaveButton
                    itemType="documento"
                    title={d.title.slice(0, 300)}
                    documentId={d.id}
                  />
                  <SourceWorkLink documentIds={[d.id]} />
                  <Link
                    className="text-sm text-teal-800 underline"
                    href={`/busqueda?documentId=${d.id}`}
                  >
                    Ver en Búsqueda
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              className="secondaryButton"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anteriores
            </button>
            <span className="text-sm">
              {page} / {Math.max(1, pages)}
            </span>
            <button
              className="secondaryButton"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Siguientes
            </button>
          </div>
        </>
      )}
    </section>
  );
}
