"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, AlertTriangle } from "lucide-react";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { ExpSlideOver } from "./slide-over-shell";
import type { ReplaceFileModalProps } from "./types";
import { EXP_SLIDE_OVER_BODY, EXP_SLIDE_OVER_FOOTER, expBtnClass, expMessageClass } from "./estilos";
import { cn } from "@/lib/utils";

export function ReplaceFileModal({ exp, onClose, onApply }: ReplaceFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF");
      setFile(null);
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      setError(`El PDF supera el límite de ${maxPdfSizeLabel}`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function confirm() {
    if (!file) return;
    onApply(file);
  }

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      modificador="expSlideOver-modal"
      onClose={onClose}
      subtitulo={<>&ldquo;{exp.title}&rdquo; se reprocesará automáticamente</>}
      titulo="Reemplazar PDF"
    >
        <div className={cn("tw", EXP_SLIDE_OVER_BODY)}>
          <div className="mb-3 flex items-center gap-2.5 rounded-exp border border-exp-line bg-exp-line-soft px-3 py-2.5 text-[13px] text-exp-muted [&>strong]:text-exp-ink [&_svg]:shrink-0 [&_svg]:text-exp-info">
            <FileText size={16} />
            <div>
              <strong>PDF actual:</strong> {exp.file_name} (
              {(exp.file_size / 1024).toFixed(0)} KB)
            </div>
          </div>
          <div className="mb-3.5 overflow-hidden rounded-exp border border-exp-line bg-exp-line-soft [&>iframe]:block [&>iframe]:h-60 [&>iframe]:w-full [&>iframe]:border-0">
            <iframe
              title="Vista previa del PDF actual"
              src={`/api/expedientes-archivo/${exp.id}`}
            />
          </div>
          <label
            className={cn(
              "relative mb-3 block cursor-pointer rounded-exp border-2 border-dashed p-5 text-center transition-colors duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              "hover:border-exp-brand hover:bg-exp-brand-soft",
              "[&_input[type=file]]:absolute [&_input[type=file]]:inset-0 [&_input[type=file]]:size-full [&_input[type=file]]:cursor-pointer [&_input[type=file]]:opacity-0",
              isDragging ? "border-exp-brand bg-exp-brand-soft" : "border-exp-line bg-exp-line-soft",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileChange(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            {!file ? (
              <div className="flex flex-col items-center gap-1 [&_svg]:text-exp-brand">
                <UploadCloud size={28} />
                <strong className="text-sm font-semibold text-exp-ink">Selecciona el nuevo PDF</strong>
                <span className="text-xs text-exp-muted">Máx. {maxPdfSizeLabel}</span>
              </div>
            ) : (
              <div className="pointer-events-none flex items-center gap-2.5 rounded-exp border border-exp-line bg-exp-panel px-3 py-2.5 text-left">
                <FileText size={20} />
                <div className="min-w-0 flex-1">
                  <strong className="block text-[13px] text-exp-ink">{file.name}</strong>
                  <span className="text-[11px] text-exp-muted">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  type="button"
                  className="pointer-events-auto border-0 bg-transparent text-xs font-semibold text-exp-brand underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Cambiar
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {error ? (
            <div className={expMessageClass("error")}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="mb-3.5 flex items-start gap-2.5 rounded-exp border border-[#fde68a] bg-exp-warning-soft px-3 py-2.5 text-xs leading-relaxed text-[#78350f] [&>svg]:mt-px [&>svg]:shrink-0 [&>svg]:text-exp-warning">
            <AlertTriangle size={16} />
            <div>
              El nuevo archivo se reprocesará con OCR y se re-indexará en Pinecone. Los
              metadatos (título, ubicación, etc.) se conservan.
            </div>
          </div>
        </div>
        <div className={EXP_SLIDE_OVER_FOOTER}>
          <button type="button" className={expBtnClass("ghost")} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={expBtnClass("primary")}
            onClick={confirm}
            disabled={!file}
          >
            <UploadCloud size={16} /> Confirmar reemplazo
          </button>
        </div>
    </ExpSlideOver>
  );
}
