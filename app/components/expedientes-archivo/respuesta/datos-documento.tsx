"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Download, Eye, EyeOff, FileText, Loader2, Settings, X } from "lucide-react";
import { cargoDeDestinatario, listDestinatariosFrecuentes } from "@/lib/destinatarios-frecuentes";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_SPIN,
  expBtnClass,
} from "../estilos";
import { cn } from "@/lib/utils";

type Props = {
  asunto: string;
  cargoDestinatario: string;
  cuerpo: string;
  destinatario: string;
  exportFormat: "pdf" | "docx";
  exporting: boolean;
  // Ciudad del encabezado "Lugar, dd de mes de año" (modelo oficial peruano).
  lugar: string;
  // true cuando el correlativo ya fue asignado con "Guardar y numerar".
  nroAsignado: boolean;
  numeroEfectivo: string;
  oficina: { tieneMembrete: boolean; entidad: string | null; responsableNombre?: string | null; responsableCargo?: string | null } | null;
  // REF.: numero del documento anterior al que se responde (opcional).
  referencia: string;
  setCargoDestinatario: (v: string) => void;
  setDestinatario: (v: string) => void;
  setExportFormat: (v: "pdf" | "docx") => void;
  setLugar: (v: string) => void;
  setReferencia: (v: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
  tipoDocumento: string;
  onExport: () => void;
  // Devuelve un object URL del PDF real (con membrete) o null si falló.
  onPreviewPdf: () => Promise<string | null>;
};

// Seccion 4: Datos del documento + checklist + vista previa + descargar
export function DatosDocumento({
  asunto,
  cargoDestinatario,
  cuerpo,
  destinatario,
  exportFormat,
  exporting,
  lugar,
  nroAsignado,
  numeroEfectivo,
  oficina,
  referencia,
  setCargoDestinatario,
  setDestinatario,
  setExportFormat,
  setLugar,
  setReferencia,
  tipoDocumento,
  onExport,
  onPreviewPdf,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const fecha = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  const lugarFecha = lugar.trim() ? `${lugar.trim()}, ${fecha}` : fecha;
  const isCarta = tipoDocumento.toUpperCase().includes("CARTA");

  // Directorio local de destinatarios frecuentes (autocompletado). Se carga
  // al enfocar el campo (localStorage solo existe en el cliente).
  const [frecuentes, setFrecuentes] = useState<Array<{ nombre: string; cargo: string }>>([]);
  const loadFrecuentes = () => {
    const items = listDestinatariosFrecuentes();
    if (items.length !== frecuentes.length) setFrecuentes(items);
  };

  // Liberar el object URL del PDF al cerrar/cambiar la vista previa.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function openPdfPreview() {
    setLoadingPdf(true);
    try {
      const url = await onPreviewPdf();
      if (url) setPdfUrl(url);
    } finally {
      setLoadingPdf(false);
    }
  }

  // Checklist en lenguaje llano antes de emitir. No bloquea: informa.
  const checklist: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(cuerpo.trim()), label: "El cuerpo del documento está redactado" },
    {
      ok: Boolean(destinatario.trim()),
      label: destinatario.trim() ? "Destinatario indicado" : "Falta el destinatario",
    },
    {
      ok: isCarta || Boolean(asunto.trim()),
      label: isCarta
        ? "Asunto opcional (carta)"
        : asunto.trim()
          ? "Asunto indicado"
          : "Falta el asunto",
    },
    {
      ok: nroAsignado,
      label: nroAsignado
        ? `Número asignado: ${numeroEfectivo}`
        : "Aún no asignaste número (usa «Guardar y numerar»)",
    },
  ];
  const pendientes = checklist.filter((c) => !c.ok).length;

  return (
    <div className={cn("tw", EXP_FORM_SECTION, "mt-4")}>
      <div className={EXP_FORM_SECTION_HEADER}>
        <h3 className={EXP_FORM_SECTION_TITLE}>
          <Building2 size={16} /> Datos del documento
          <span className={EXP_FORM_SECTION_HINT}>Nº, destinatario y formato</span>
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Nº de documento</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={numeroEfectivo}
            readOnly
          />
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Destinatario</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={destinatario}
            onChange={(e) => {
              const v = e.target.value;
              setDestinatario(v);
              // Si es un destinatario frecuente, autollenar su cargo.
              const cargo = cargoDeDestinatario(v);
              if (cargo && !cargoDestinatario.trim()) setCargoDestinatario(cargo);
            }}
            onFocus={loadFrecuentes}
            placeholder="Nombre del destinatario"
            list="destinatarios-frecuentes"
          />
          {frecuentes.length > 0 ? (
            <datalist id="destinatarios-frecuentes">
              {frecuentes.map((d) => (
                <option key={d.nombre} value={d.nombre}>
                  {d.cargo}
                </option>
              ))}
            </datalist>
          ) : null}
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Cargo del destinatario</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={cargoDestinatario}
            onChange={(e) => setCargoDestinatario(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Lugar (ciudad del encabezado)</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Ej. Challhuahuacho"
          />
          <small className="text-[11px] text-exp-muted">
            Sale como «{lugarFecha}». Se recuerda para tus próximos documentos.
          </small>
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Referencia (REF.)</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nº del documento al que respondes (opcional)"
          />
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Formato de salida</label>
          <select
            className={EXP_FIELD_CONTROL}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as "pdf" | "docx")}
          >
            <option value="pdf">PDF (sobre hoja membretada de la oficina)</option>
            <option value="docx">Word (.docx)</option>
          </select>
        </div>
      </div>

      {/* Checklist antes de emitir: en lenguaje llano, no bloquea */}
      <div
        className={cn(
          "mt-3 rounded-exp border px-3 py-2.5",
          pendientes > 0 ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#a7f3d0] bg-[#ecfdf5]",
        )}
      >
        <strong className="mb-1.5 block text-[12.5px]">
          {pendientes > 0
            ? `Antes de emitir: ${pendientes} pendiente${pendientes === 1 ? "" : "s"}`
            : "Todo listo para emitir"}
        </strong>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {checklist.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-center gap-1.5 text-[12.5px]",
                c.ok ? "text-[#065f46]" : "text-[#92400e]",
              )}
            >
              {c.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={expBtnClass("primary")}
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? <Loader2 size={16} className={EXP_SPIN} /> : <Download size={16} />}{" "}
          {exporting ? "Generando..." : `Descargar (.${exportFormat})`}
        </button>
        <button
          type="button"
          className={expBtnClass("secondary")}
          onClick={() => void openPdfPreview()}
          disabled={loadingPdf}
          title="Ver el PDF final (con membrete) sin descargarlo"
        >
          {loadingPdf ? <Loader2 size={16} className={EXP_SPIN} /> : <FileText size={16} />}{" "}
          {loadingPdf ? "Generando…" : "Ver PDF final"}
        </button>
        <button
          type="button"
          className={expBtnClass("secondary")}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {showPreview ? "Ocultar borrador" : "Vista rápida"}
        </button>
      </div>

      {/* Modal con el PDF real generado por el backend. Escape, foco atrapado y
          bloqueo de scroll los aporta Radix; los estilos, la envoltura `.visorModal`
          que comparten los demás visores de documento. */}
      {pdfUrl ? (
        <Dialog.Root
          open
          onOpenChange={(abierto) => {
            if (!abierto) setPdfUrl(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="visorModalFondo" />
            <Dialog.Content className="visorModal">
              <div className="visorModalHead">
                <Dialog.Title asChild>
                  <h3 className="visorModalTitulo">Así saldrá el documento</h3>
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    aria-label="Cerrar vista previa"
                    className="visorModalCerrar"
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>
              <div className="visorModalCuerpo">
                <iframe src={pdfUrl} title="Vista previa del PDF" />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
      {exportFormat === "pdf" && oficina && !oficina.tieneMembrete ? (
        <span className={EXP_HELP_TEXT}>
          <Settings size={12} /> Esta oficina no tiene hoja membretada cargada (config admin); el PDF saldrá en blanco.
        </span>
      ) : null}

      {showPreview && cuerpo ? (
        <div className="mt-3 max-h-[500px] overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white px-10 py-8 font-['Times_New_Roman',serif] text-[13px] leading-relaxed text-[#1a202c]">
          {oficina?.entidad ? (
            <div className="mb-4 text-center text-sm font-bold uppercase">
              {oficina.entidad}
            </div>
          ) : null}
          {/* Modelo oficial peruano: lugar y fecha arriba, luego numeración. */}
          <div className="mb-3 text-right text-xs">
            {lugarFecha}
          </div>
          <div className="mb-3 text-xs">
            <strong>{numeroEfectivo || "OFICIO N° ___"}</strong>
          </div>
          {destinatario ? (
            <div className="mb-1">
              <strong>Señor(a):</strong> {destinatario}
            </div>
          ) : null}
          {cargoDestinatario ? (
            <div className="mb-2 text-xs italic">
              {cargoDestinatario}
            </div>
          ) : null}
          {asunto ? (
            <div className={referencia.trim() ? "mb-1" : "mb-3"}>
              <strong>{isCarta ? "Asunto:" : "ASUNTO:"}</strong> {asunto}
            </div>
          ) : null}
          {referencia.trim() ? (
            <div className="mb-3">
              <strong>REF.:</strong> {referencia.trim()}
            </div>
          ) : null}
          <hr className="my-2 border-0 border-t border-[#cbd5e1]" />
          <div className="whitespace-pre-wrap text-justify">{cuerpo}</div>
          {/* Sin nombre ni cargo impresos: espacio para firma manuscrita y sello. */}
          <div className="mt-8 text-center">
            <div>Atentamente,</div>
            <div className="mt-12 text-[11px] text-[#94a3b8]">
              (espacio para firma y sello)
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
