"use client";

import { BookUp, FileText, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { EmptyState } from "../configuracion/empty-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROCESO_SELECCION_OPCIONES } from "@/lib/procesos-seleccion";
import { btnPrimary as btnPri, btnSecondary as btnSec } from "../configuracion/ui";

// Modelos de requerimiento (PDF) que la entidad sube en Configuración. Se indexan
// en el RAG (Pinecone) y el copiloto IA de Necesidades los usa para redactar y
// completar la ficha con el formato propio de la entidad.

type Estado = "uploaded" | "processing" | "indexed" | "error";
type Modelo = {
  id: string;
  title: string;
  file_name: string;
  status: Estado;
  error_message: string | null;
  source_entity: string | null;
  created_at: string;
  /** Tipo de proceso de selección al que está vinculado (metadata.procesoSeleccion). */
  procesoSeleccion: string | null;
  /** Objeto que sirve este modelo, cuando su procedimiento admite varios. */
  objeto: string | null;
};

const API = "/api/configuracion/modelos-requerimiento";

// Procedimientos reales del catálogo (sin el "— Por definir —", que es un
// marcador del desplegable de la ficha, no algo a lo que vincular un modelo).
const PROCESOS = PROCESO_SELECCION_OPCIONES.filter((p) => p.value !== "");

// Un procedimiento del Reglamento puede tener varias plantillas: el «Concurso
// Público abreviado» del Art. 94 cubre servicios y consultorías de obra, y la
// entidad tiene un modelo para cada caso. El objeto es lo que descarta el que no
// encaja antes de que el RAG ordene el resto.
const OBJETOS = [
  { value: "bienes", label: "Bienes" },
  { value: "servicios", label: "Servicios" },
  { value: "obras", label: "Obras" },
  { value: "consultoria_obra", label: "Consultoría de obra" },
];

const ESTADO_LABEL: Record<Estado, string> = {
  uploaded: "En cola…",
  processing: "Procesando…",
  indexed: "Indexado",
  error: "Error",
};

export function ModelosRequerimiento({ entidad }: { entidad?: string | null }) {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setModelos(data.documents ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los modelos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial: efecto de sincronización con el backend (patrón fetch-on-mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Mientras alguno se esté indexando, refresca el estado cada 4 s.
  useEffect(() => {
    if (!modelos.some((m) => m.status === "uploaded" || m.status === "processing")) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [modelos, load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name.replace(/\.pdf$/i, ""));
      if (entidad) fd.append("entidad", entidad);
      const res = await fetch(API, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el modelo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function vincular(id: string, cambio: { procesoSeleccion?: string; objeto?: string }) {
    setError(null);
    // Optimista: el desplegable responde al instante y se corrige con `load()`.
    setModelos((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              ...(cambio.procesoSeleccion !== undefined
                ? { procesoSeleccion: cambio.procesoSeleccion || null }
                : {}),
              ...(cambio.objeto !== undefined ? { objeto: cambio.objeto || null } : {}),
            }
          : m,
      ),
    );
    try {
      const res = await fetch(API, {
        body: JSON.stringify({ id, ...cambio }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular el modelo");
    } finally {
      await load();
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`${API}?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el modelo");
    }
  }

  // Dos cosas que solo se ven mirando el conjunto: qué procedimientos se han
  // quedado sin modelo, y cuáles tienen varios. Compartir procedimiento es
  // NORMAL: la tipología del Reglamento es más gruesa que las plantillas (el
  // «Concurso Público abreviado» del Art. 94 cubre servicios y consultorías, y la
  // entidad tiene una plantilla para cada uno). Lo que sí conviene decir es que
  // el copiloto los consulta TODOS y que el objeto declarado descarta antes.
  const { compartidos, sinModelo } = useMemo(() => {
    const porProceso = new Map<string, number>();
    for (const m of modelos) {
      if (m.procesoSeleccion) porProceso.set(m.procesoSeleccion, (porProceso.get(m.procesoSeleccion) ?? 0) + 1);
    }
    return {
      compartidos: new Map([...porProceso].filter(([, n]) => n > 1)),
      sinModelo: PROCESOS.filter((p) => !porProceso.has(p.value)),
    };
  }, [modelos]);

  return (
    <section className="tw flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h3 className="inline-flex items-center gap-1.5 m-0 mb-1 text-md font-[650] text-ink">
            <BookUp size={16} /> Modelos de requerimiento (PDF)
          </h3>
          <p className="m-0 text-sm leading-snug text-muted max-w-[62ch]">
            Sube plantillas o requerimientos modelo en PDF. Se indexan en el buscador con IA
            (RAG) y el <strong>copiloto de Necesidades</strong> los usa para redactar y completar
            la ficha con el formato propio de tu entidad.
          </p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') void upload(file);
          }}
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging ? 'border-brand bg-brand-soft/40' : 'border-line bg-transparent'
          }`}
        >
          <p className="text-sm text-muted mb-2">Arrastra un PDF aquí o haz clic para seleccionar</p>
          <div className="flex shrink-0 items-center gap-2 justify-center">
            <button
              className={btnSec}
              type="button"
              onClick={() => void load()}
              title="Actualizar estado del indexado"
              aria-label="Actualizar"
            >
              <RefreshCw size={15} />
            </button>
            <button
              className={btnPri}
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Subir PDF
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </div>
        </div>
      </div>

      {error ? <p className="m-0 text-sm text-[#b91c1c]">{error}</p> : null}

      {loading ? (
        <p className="inline-flex items-center gap-1.5 m-0 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Cargando modelos…
        </p>
      ) : modelos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay modelos"
          description="Sube el primer PDF para que la IA aprenda tu formato de requerimiento."
        />
      ) : (
        <ul className="flex list-none flex-col gap-1.5 m-0 p-0">
          {modelos.map((m) => (
            <li className="flex items-center gap-2.5 rounded-md border border-line bg-panel px-2.5 py-2" key={m.id}>
              <FileText size={16} className="shrink-0 text-brand" />
              <div className="flex min-w-0 flex-1 flex-col">
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-ink">{m.title}</strong>
                <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted">{m.file_name}</small>
                <label className="mt-1.5 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Tipo de proceso de selección</span>
                  <select
                    className="max-w-[420px] rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
                    value={m.procesoSeleccion ?? ""}
                    onChange={(e) => void vincular(m.id, { procesoSeleccion: e.target.value })}
                  >
                    <option value="">— Sin vincular —</option>
                    {PROCESOS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {!m.procesoSeleccion ? (
                    <span className="text-xs text-muted">
                      El copiloto no lo usará hasta que elijas su procedimiento.
                    </span>
                  ) : compartidos.has(m.procesoSeleccion) ? (
                    <span className="text-xs text-muted">
                      {compartidos.get(m.procesoSeleccion)} modelos para este procedimiento. El
                      copiloto los consulta todos y ordena por relevancia; declara el objeto para
                      descartar los que no encajan.
                    </span>
                  ) : null}
                </label>
                {m.procesoSeleccion ? (
                  <label className="mt-1.5 flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">Objeto que sirve este modelo</span>
                    <select
                      className="max-w-[420px] rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
                      value={m.objeto ?? ""}
                      onChange={(e) => void vincular(m.id, { objeto: e.target.value })}
                    >
                      <option value="">— Cualquiera del procedimiento —</option>
                      {OBJETOS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  m.status === "indexed" ? "bg-success-soft text-success"
                  : m.status === "error" ? "bg-danger-soft text-danger"
                  : "bg-brand-soft text-brand-ink"
                }`}
                title={m.error_message ?? undefined}
              >
                {m.status === "processing" || m.status === "uploaded" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : null}
                {ESTADO_LABEL[m.status]}
              </span>
              {confirmDelete === m.id ? (
                <span className="inline-flex shrink-0 gap-1">
                  <button className={btnSec} type="button" onClick={() => void remove(m.id)}>
                    Sí
                  </button>
                  <button className={btnSec} type="button" onClick={() => setConfirmDelete(null)}>
                    No
                  </button>
                </span>
              ) : (
                <button
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-white text-brand cursor-pointer hover:border-[rgba(176,71,60,0.45)] hover:bg-[#fbf1ef] hover:text-[#b0473c]"
                  type="button"
                  aria-label="Eliminar modelo"
                  onClick={() => setConfirmDelete(m.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && sinModelo.length > 0 ? (
        <p className="inline-flex items-center gap-1.5 m-0 text-sm text-muted">
          <strong>{sinModelo.length}</strong>{" "}
          {sinModelo.length === 1
            ? "procedimiento aún no tiene modelo"
            : "procedimientos aún no tienen modelo"}
          : {sinModelo.map((p) => p.label).join(" · ")}. Para esos, el copiloto redacta con el
          corpus legal, sin el formato de tu entidad.
        </p>
      ) : null}
    </section>
  );
}
