"use client";

import { FileSearch, FileText, Loader, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { estadoIndexacion, esDocxEett } from "@/lib/eett-tdr-analiza";

type MetadatosRag = {
  extractionMethod?: string;
  ocrParcial: boolean;
  indexedTextComplete: boolean;
  pageCount?: number;
  chunkCount?: number;
  recordCount?: number;
  namespace?: string;
  contentHash?: string;
  pipelineVersion?: string;
};
type RagState = {
  documento: {
    id: string;
    file_name: string;
    status: string;
    error_message: string | null;
    metadatos: MetadatosRag;
  };
  job: { status: string; error_message: string | null; started_at: string | null; completed_at: string | null } | null;
  resumen: { content: string } | null;
};
type Chunk = {
  id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  token_count: number | null;
};
type Resultado = { chunk_index: number; page_start: number | null; score: number; extracto: string };

// Tonos del tema (se adaptan a claro/oscuro y unifican con el resto del módulo),
// en vez de la paleta cruda de Tailwind (emerald/red/blue-100) que ignoraba los
// tokens y no seguía el modo oscuro.
const TONE_BADGE: Record<string, string> = {
  ok: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
  info: "bg-brand-soft text-brand",
  pending: "bg-warning-soft text-warning",
  muted: "bg-ink/[0.06] text-muted",
};

export function NecesidadEettAnalizaModal({
  necesidadId,
  docId,
  fileName,
  onClose,
}: {
  necesidadId: string;
  docId: string;
  fileName: string;
  onClose: () => void;
}) {
  const docx = esDocxEett(fileName);
  const [pestana, setPestana] = useState<"fragmentos" | "consulta" | "resumen">("fragmentos");
  const [rag, setRag] = useState<RagState | null>(null);
  const [cargandoRag, setCargandoRag] = useState(true);
  const [reindexando, setReindexando] = useState(false);

  const cargarRag = useCallback(async () => {
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/rag`, { cache: "no-store" });
      if (r.ok) setRag((await r.json()) as RagState);
    } catch {
      /* el estado se queda como estaba */
    } finally {
      setCargandoRag(false);
    }
  }, [necesidadId, docId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarRag();
  }, [cargarRag]);

  // Polling mientras el documento esté procesando.
  const procesando = rag?.documento.status === "processing";
  useEffect(() => {
    if (!procesando) return;
    const t = setInterval(() => void cargarRag(), 4000);
    return () => clearInterval(t);
  }, [procesando, cargarRag]);

  const status = rag?.documento.status ?? "uploaded";
  const est = estadoIndexacion(status, docx);

  async function reindexar() {
    if (!confirm("Se borrarán los vectores y fragmentos actuales y se reindexará el PDF. Continuar?")) return;
    setReindexando(true);
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/reindex`, { method: "POST" });
      if (r.ok) await cargarRag();
    } finally {
      setReindexando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        size="xl"
        className="max-w-[1100px]"
        title={
          <span className="flex items-center gap-2">
            <FileSearch size={18} /> Analiza — {fileName}
          </span>
        }
        description="Inspecciona y gestiona el RAG del EETT/TDR: estado de indexación, fragmentos, consulta de prueba y reindexado."
      >
        {cargandoRag ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader size={14} className="spinIcon" /> Cargando estado del RAG…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
            {/* Columna izquierda: estado + metadatos + reindexar */}
            <aside className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_BADGE[est.tone]}`}>
                  {est.label}
                </span>
                {procesando ? <Loader size={14} className="spinIcon text-muted" /> : null}
              </div>
              {est.razon ? <p className="text-[12px] text-muted">{est.razon}</p> : null}
              {rag?.documento.error_message ? (
                <p className="rounded-md bg-danger-soft p-2 text-[12px] text-danger">{rag.documento.error_message}</p>
              ) : null}

              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                <Meta k="Extracción" v={rag?.documento.metadatos.extractionMethod ?? "—"} />
                <Meta k="Páginas" v={fmtNum(rag?.documento.metadatos.pageCount)} />
                <Meta k="Fragmentos" v={fmtNum(rag?.documento.metadatos.chunkCount)} />
                <Meta k="Vectores" v={fmtNum(rag?.documento.metadatos.recordCount)} />
                <Meta k="Namespace" v={rag?.documento.metadatos.namespace ?? "—"} />
                <Meta k="Pipeline" v={rag?.documento.metadatos.pipelineVersion ?? "—"} />
              </dl>

              {rag?.documento.metadatos.ocrParcial ? (
                <p className="rounded-md bg-warning-soft p-2 text-[12px] text-warning">
                  OCR parcial: el PDF excedió el tope de páginas y el RAG puede estar incompleto.
                </p>
              ) : null}
              {rag && !rag.documento.metadatos.indexedTextComplete ? (
                <p className="rounded-md bg-warning-soft p-2 text-[12px] text-warning">
                  Indexación incompleta según el pipeline.
                </p>
              ) : null}

              {docx ? null : (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => void reindexar()}
                  loading={reindexando}
                  disabled={procesando}
                  className="w-fit"
                >
                  {reindexando ? null : <RefreshCw size={14} />}
                  Reindexar
                </Button>
              )}
            </aside>

            {/* Columna derecha: explorador */}
            <section className="flex min-h-[320px] flex-col">
              <div className="mb-3 flex gap-1 border-b border-line">
                {(["fragmentos", "consulta", "resumen"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPestana(p)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] font-semibold ${
                      pestana === p ? "border-brand text-brand" : "border-transparent text-muted"
                    }`}
                  >
                    {p === "fragmentos" ? "Fragmentos" : p === "consulta" ? "Consulta" : "Resumen IA"}
                  </button>
                ))}
              </div>

              {docx ? (
                <p className="text-[13px] text-muted">
                  Los .docx no se indexan: no hay fragmentos ni consulta de prueba disponibles.
                </p>
              ) : pestana === "fragmentos" ? (
                <Fragmentos necesidadId={necesidadId} docId={docId} />
              ) : pestana === "consulta" ? (
                <Consulta necesidadId={necesidadId} docId={docId} />
              ) : (
                <ResumenIa resumen={rag?.resumen ?? null} />
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </>
  );
}
function fmtNum(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

function Fragmentos({ necesidadId, docId }: { necesidadId: string; docId: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Chunk[]; total: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const limit = 20;

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    const url = `/api/necesidades/${necesidadId}/eett-tdr/${docId}/chunks?page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    void (async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok && vivo) setData(await r.json());
      } catch {
        /* lista vacía */
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [necesidadId, docId, page, q]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Buscar dentro del documento…"
          className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
        />
      </div>
      {cargando ? (
        <p className="flex items-center gap-2 text-[13px] text-muted"><Loader size={14} className="spinIcon" /> Cargando fragmentos…</p>
      ) : data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.items.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-surface p-2.5 text-[12.5px]">
              <div className="mb-1 flex justify-between text-muted">
                <span>#{c.chunk_index}{c.page_start != null ? ` · pág. ${c.page_start}` : ""}</span>
                <span>{c.token_count ?? 0} tokens</span>
              </div>
              <p className="whitespace-pre-wrap text-ink">{c.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Sin fragmentos.</p>
      )}
      {data && data.total > limit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">‹</button>
          Pág. {page} de {Math.ceil(data.total / limit)}
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= data.total} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">›</button>
        </div>
      ) : null}
    </div>
  );
}

function Consulta({ necesidadId, docId }: { necesidadId: string; docId: string }) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState("");

  async function buscar() {
    setError("");
    setBuscando(true);
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/consulta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "No se pudo consultar.");
      else setResultados(d.resultados ?? []);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe una consulta para ver qué fragmentos recupera el RAG…"
          rows={2}
          className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void buscar()}
          loading={buscando}
          disabled={!query.trim()}
          className="self-end"
        >
          {buscando ? null : <Search size={14} />} Probar
        </Button>
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {resultados && resultados.length === 0 ? (
        <p className="text-[13px] text-muted">Sin resultados para este documento.</p>
      ) : null}
      {resultados && resultados.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {resultados.map((r, i) => (
            <li key={i} className="rounded-md border border-line bg-surface p-2.5 text-[12.5px]">
              <div className="mb-1 flex justify-between text-muted">
                <span>#{r.chunk_index}{r.page_start != null ? ` · pág. ${r.page_start}` : ""}</span>
                <span>score {r.score.toFixed(3)}</span>
              </div>
              <p className="text-ink">{r.extracto}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ResumenIa({ resumen }: { resumen: { content: string } | null }) {
  if (!resumen) return <p className="text-[13px] text-muted">Este documento aún no tiene resumen ejecutivo.</p>;
  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-[13px] text-ink">
      <FileText size={15} className="mt-0.5 shrink-0 text-muted" />
      <p className="whitespace-pre-wrap">{resumen.content}</p>
    </div>
  );
}
