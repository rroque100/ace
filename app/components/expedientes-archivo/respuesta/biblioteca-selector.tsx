"use client";

import {
  CheckCircle2,
  FileUp,
  Library,
  Loader2,
  Scale,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  adjuntarNormativa,
  type AdjuntoResult,
  listNormativaBiblioteca,
  type NormativaEntry,
} from "@/lib/expedientes-archivo-actions";
import { ModalShell } from "../../modal-shell";
import { EXP_FIELD, EXP_FIELD_LABEL, EXP_SPIN, expBtnClass } from "../estilos";
import { cn } from "@/lib/utils";

// Selector de normativa para la pestaña Responder.
// - Permite buscar en la biblioteca de leyes/normas indexadas en Pinecone
// - Permite subir PDFs adicionales como adjuntos para esta generacion
// - Devuelve los documentIds seleccionados al padre via onChange
type AdjuntoAdjunto = AdjuntoResult;

export function BibliotecaSelector({
  normativaIds,
  adjuntosIds,
  onChange,
  onAdjuntosChange,
}: {
  normativaIds: string[];
  adjuntosIds: string[];
  onChange: (ids: string[]) => void;
  onAdjuntosChange: (adjuntos: AdjuntoAdjunto[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<NormativaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adjuntos, setAdjuntos] = useState<AdjuntoAdjunto[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => {
      void listNormativaBiblioteca(search, 200)
        .then((data) => {
          setEntries(data.entries);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "No se pudo cargar la biblioteca");
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [open, search]);

  // Enfoca el input de busqueda al abrir.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const selected = new Set(normativaIds);
  const adjuntoIds = new Set(adjuntosIds);

  function toggle(documentId: string) {
    const next = new Set(selected);
    if (next.has(documentId)) {
      next.delete(documentId);
    } else {
      next.add(documentId);
    }
    onChange(Array.from(next));
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await adjuntarNormativa(file, file.name.replace(/\.pdf$/i, ""));
      const updated = [...adjuntos, result];
      setAdjuntos(updated);
      onAdjuntosChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo adjuntar el PDF");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAdjunto(id: string) {
    const updated = adjuntos.filter((a) => a.documentId !== id);
    setAdjuntos(updated);
    onAdjuntosChange(updated);
  }

  const totalSelected = normativaIds.length + adjuntos.length;

  return (
    <div className={cn("tw", EXP_FIELD)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(EXP_FIELD_LABEL, "flex items-center gap-1.5")}>
          <Scale size={13} /> Normativa aplicable
        </label>
        <button
          type="button"
          className={expBtnClass("secondary", "small")}
          onClick={() => setOpen(true)}
        >
          <Library size={14} /> Biblioteca ({normativaIds.length})
        </button>
        <button
          type="button"
          className={expBtnClass("secondary", "small")}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={14} className={EXP_SPIN} /> : <FileUp size={14} />}{" "}
          {uploading ? "Subiendo..." : "Adjuntar PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        {totalSelected > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-exp-brand">
            <CheckCircle2 size={14} /> {totalSelected} documento(s) adjunto(s)
          </span>
        ) : null}
      </div>

      {adjuntos.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {adjuntos.map((a) => (
            <span
              key={a.documentId}
              className="inline-flex items-center gap-1 rounded-full border border-[#67e8f9] bg-[#ecfeff] px-2.5 py-1 text-[11px] font-medium text-[#155e75]"
            >
              <FileUp size={11} /> {a.title} ({a.chunkCount} frag.)
              <button
                type="button"
                aria-label="Quitar adjunto"
                onClick={() => removeAdjunto(a.documentId)}
                className="ml-1 border-0 bg-transparent p-0 text-inherit"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? <BibliotecaModal onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-exp-muted" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo, numero o fuente..."
              className="flex-1 rounded-lg border border-exp-line px-2.5 py-2 text-[13px]"
            />
            <button
              type="button"
              className={expBtnClass("primary")}
              onClick={() => setOpen(false)}
            >
              Listo ({normativaIds.length})
            </button>
          </div>
          {error ? (
            <p role="alert" className="m-0 rounded-md bg-exp-danger-soft px-2 py-2 text-xs text-[#991b1b]">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="m-0 text-sm text-exp-muted">
              <Loader2 size={14} className={EXP_SPIN} /> Buscando en la biblioteca...
            </p>
          ) : entries.length === 0 ? (
            <p className="m-0 text-sm text-exp-muted">
              No hay documentos que coincidan con la busqueda.
            </p>
          ) : (
            <div className="flex max-h-[380px] flex-col gap-1 overflow-y-auto">
              {entries.map((entry) => {
                const isSelected = selected.has(entry.documentId);
                return (
                  <button
                    key={entry.documentId}
                    type="button"
                    onClick={() => toggle(entry.documentId)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-inherit",
                      isSelected ? "border-[#67e8f9] bg-[#ecfeff]" : "border-exp-line bg-exp-panel",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(entry.documentId)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold">
                        {entry.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-exp-muted">
                        {entry.documentNumber ? (
                          <span>N° {entry.documentNumber}</span>
                        ) : null}
                        {entry.documentType ? (
                          <span>{entry.documentType}</span>
                        ) : null}
                        {entry.sourceEntity ? (
                          <span>{entry.sourceEntity}</span>
                        ) : null}
                        {entry.year ? <span>{entry.year}</span> : null}
                        <span>{entry.chunkCount} frag.</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BibliotecaModal> : null}

      {/* adjuntosIds no se usa directamente aqui pero el linter lo acepta */}
      <span hidden>{adjuntoIds.size}</span>
    </div>
  );
}

function BibliotecaModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Escape, foco atrapado y bloqueo de scroll los aporta ModalShell (Radix).
  return (
    <ModalShell
      claseTarjeta="bibliotecaNormativaModal"
      onClose={onClose}
      titulo={
        <>
          <Scale size={18} /> Biblioteca de normativa
        </>
      }
    >
      {children}
    </ModalShell>
  );
}
