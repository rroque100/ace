"use client";

import {
  BookOpen,
  FileCheck2,
  Lightbulb,
  Loader2,
  ScrollText,
  UploadCloud,
  X,
} from "lucide-react";
import { useState } from "react";
import type { AnalisisTecnico } from "@/lib/expedientes-archivo-actions";
import { ConfirmDialog } from "../../confirm-dialog";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_SPIN,
  expBtnClass,
  expFilePickerClass,
  expFilePickerIconClass,
  EXP_FILE_PICKER_SUB,
  EXP_FILE_PICKER_TITLE,
} from "../estilos";
import { cn } from "@/lib/utils";

type Props = {
  antecedenteId: string | null;
  antecedenteMeta: {
    chunkCount: number;
    extractionMethod: string;
    fileName: string;
    fileSize: number;
    pageCount: number | null;
  } | null;
  analisis: AnalisisTecnico | null;
  documentoTexto: string;
  handleFile: (file: File | null | undefined) => Promise<void>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  reading: boolean;
  removeAntecedente: () => Promise<void>;
  setDocumentoTexto: (v: string) => void;
  setIsDragging: (v: boolean) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
};

// Seccion 1: Documento recibido (antecedente) - PDF persistido en
// Supabase Storage + Pinecone namespace 'respuesta-antecedentes'.
export function DocumentoRecibido({
  antecedenteId,
  antecedenteMeta,
  analisis,
  documentoTexto,
  handleFile,
  inputRef,
  isDragging,
  reading,
  removeAntecedente,
  setDocumentoTexto,
  setIsDragging,
  showToast,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAnalisis, setShowAnalisis] = useState(true);

  function onFile(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("Solo se permiten archivos PDF.", "warning");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      showToast(`El PDF supera ${maxPdfSizeLabel}.`, "warning");
      return;
    }
    void handleFile(file);
  }

  return (
    <div className={cn("tw", EXP_FORM_SECTION)}>
      <div className={EXP_FORM_SECTION_HEADER}>
        <h3 className={EXP_FORM_SECTION_TITLE}>
          <ScrollText size={16} /> Documento recibido (antecedente)
          <span className={EXP_FORM_SECTION_HINT}>
            Sube el PDF: se persiste en Storage + Pinecone. La IA lo usa como referencia.
          </span>
        </h3>
      </div>

      <label
        className={cn(expFilePickerClass(isDragging ? "dragging" : undefined), "mb-3")}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className={expFilePickerIconClass()}>
          {reading ? <Loader2 size={22} className={EXP_SPIN} /> : <UploadCloud size={22} />}
        </div>
        <p className={EXP_FILE_PICKER_TITLE}>
          {reading
            ? "Procesando el PDF..."
            : isDragging
              ? "Suelta el PDF aqui"
              : "Arrastra el PDF recibido o haz clic"}
        </p>
        <p className={EXP_FILE_PICKER_SUB}>
          Se lee con OCR como antecedente. Max {maxPdfSizeLabel}.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="hidden"
        />
      </label>

      {documentoTexto ? (
        <div className={EXP_FIELD}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <label className={cn(EXP_FIELD_LABEL, "m-0")} htmlFor="resp-doc">
              Texto del documento recibido
            </label>
            {antecedenteId ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#67e8f9] bg-[#ecfeff] px-2.5 py-0.5 text-[11px] font-medium text-[#155e75]">
                <FileCheck2 size={11} /> Persistido
                {antecedenteMeta ? (
                  <>
                    {" "}· {antecedenteMeta.pageCount ?? "?"} pag
                    {" "}· {antecedenteMeta.chunkCount} frag
                    {" "}·{" "}
                    {antecedenteMeta.extractionMethod === "pdf-text" ? "texto" : "OCR"}
                  </>
                ) : null}
              </span>
            ) : null}
            {antecedenteId ? (
              <button
                type="button"
                className={cn(expBtnClass("ghost", "small"), "ml-auto")}
                onClick={() => setShowConfirm(true)}
              >
                <X size={11} /> Quitar antecedente
              </button>
            ) : null}
          </div>
          <textarea
            id="resp-doc"
            className={EXP_FIELD_CONTROL}
            value={documentoTexto}
            onChange={(e) => setDocumentoTexto(e.target.value)}
            rows={5}
          />
          <small className="mt-0.5 block text-[11px] text-exp-muted">
            {documentoTexto.length.toLocaleString("es-PE")} caracteres.
            {antecedenteId
              ? " Puedes editar el texto y la version editada se usara en la generacion."
              : null}
          </small>
        </div>
      ) : null}

      {analisis && (analisis.materia || analisis.puntosClave || analisis.tipoDocumento) ? (
        <div className={cn(EXP_FIELD, "mt-2 rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-3")}>
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen size={15} className="text-[#0c4a6e]" />
            <strong className="text-[13px] text-[#0c4a6e]">
              Resumen tecnico del documento
            </strong>
            <button
              type="button"
              onClick={() => setShowAnalisis((v) => !v)}
              className={cn(expBtnClass("ghost", "small"), "ml-auto")}
            >
              {showAnalisis ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showAnalisis ? (
            <div className="flex flex-col gap-2">
              <AnalisisRow label="Tipo" value={analisis.tipoDocumento} />
              <AnalisisRow label="Materia" value={analisis.materia} />
              {analisis.partes ? <AnalisisRow label="Partes" value={analisis.partes} /> : null}
              <AnalisisRow label="Puntos clave" value={analisis.puntosClave} />
              {analisis.normativaIdentificada ? (
                <AnalisisRow
                  label="Normativa que aplica el documento"
                  value={analisis.normativaIdentificada}
                />
              ) : null}
              {analisis.consultasSugeridas && analisis.consultasSugeridas.length > 0 ? (
                <div className="mt-1 rounded-md border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#92400e]">
                    <Lightbulb size={13} /> Consultas sugeridas para la biblioteca:
                  </div>
                  <ul className="m-0 pl-[18px] text-xs text-[#78350f]">
                    {analisis.consultasSugeridas.map((q, i) => (
                      <li key={i} className="mb-0.5">
                        {q}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1.5 text-[11px] italic text-[#92400e]">
                    Pega estas consultas en la biblioteca de normativa para encontrar
                    la ley aplicable. Si no aparece, marca “Buscar en internet” en
                    la generacion.
                  </div>
                </div>
              ) : null}
              {analisis.tokenUsage ? (
                <div className="mt-1 text-[10px] text-exp-muted">
                  Analisis IA: {analisis.tokenUsage.inputTokens} tokens entrada
                  + {analisis.tokenUsage.outputTokens} salida
                  {analisis.tokenUsage.estimatedCostUsd > 0
                    ? ` ($${analisis.tokenUsage.estimatedCostUsd.toFixed(4)})`
                    : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showConfirm ? (
        <ConfirmDialog
          open={true}
          title="¿Quitar el antecedente?"
          message="El texto extraido se conserva en el editor, pero se desvincula del documento persistido en Storage y Pinecone. Si vuelves a subir el mismo PDF, se creara un nuevo antecedente."
          tone="warning"
          confirmLabel="Quitar antecedente"
          onConfirm={() => {
            void removeAntecedente();
            setShowConfirm(false);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}
    </div>
  );
}

function AnalisisRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="text-xs leading-relaxed">
      <strong className="font-semibold text-[#0c4a6e]">{label}:</strong>{" "}
      <span className="text-exp-ink">{value}</span>
    </div>
  );
}
