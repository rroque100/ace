"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { FileText, Download, X, LoaderCircle } from "lucide-react";

type Bien = { paquete: string; descripcion: string; marca?: string; unidad: string; cantidad: string; entrega: string; nroEntrega: number };
type PrecioItem = { concepto: string; marca: string; unidad: string; cantidad: string; precioUnitario: string; precioTotal: string };
type Proceso = { nomenclatura: string; denominacion: string; entidadNombre: string; entidadRuc: string; entidadDomicilio: string; fechaBuenaPro: string };
type Postor = { razonSocial: string; ruc: string; domicilio: string; representante: string; docTipo: string; docNumero: string; correo: string; montoOferta: string };
type Garantia = { monto: string; nroCartaFianza: string; banco: string; vencimiento: string };
type Entrega = { nro: number; lugarEntrega: string; plazoEntrega: string; tipoDias: string };

type Props = {
  open: boolean;
  onClose: () => void;
  numeroContrato: string;
  proceso: Proceso;
  postor: Postor;
  monto: string;
  formaPago: string;
  nroPagos: number;
  entregas: Entrega[];
  inicioPlazo: string;
  bienes: Bien[];
  preciosItems: PrecioItem[];
  preciosTotalGeneral: string;
  garantiaAplica: boolean;
  garantiaDetalle?: string;
  garantia: Garantia;
  viciosOcultosAnios: string;
  institucionArbitral: string;
  recepcionArea: string;
  conformidadArea: string;
  plazoConformidadDias: string;
  ciudadFirma: string;
  fechaFirma: string;
  formato: "docx" | "pdf";
};

export function VistaPreviaContrato(props: Props) {
  const { open, onClose, numeroContrato, proceso, postor, monto, formaPago, nroPagos, entregas, inicioPlazo, bienes, preciosItems, preciosTotalGeneral, garantiaAplica, garantiaDetalle, viciosOcultosAnios, institucionArbitral, recepcionArea, conformidadArea, plazoConformidadDias, ciudadFirma, fechaFirma, formato } = props;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    generarPreview();
    return () => {
      document.body.style.overflow = prev;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function generarPreview() {
    setGenerando(true); setError(""); setPdfUrl(null);
    try {
      const res = await fetch("/api/contratos-sie/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato,
          numeroContrato: numeroContrato.trim() || undefined,
          proceso: { nomenclatura: proceso.nomenclatura, denominacion: proceso.denominacion, entidadNombre: proceso.entidadNombre, entidadRuc: proceso.entidadRuc, entidadDomicilio: proceso.entidadDomicilio, fechaBuenaPro: proceso.fechaBuenaPro || undefined },
          postor: { razonSocial: postor.razonSocial, ruc: postor.ruc, domicilio: postor.domicilio, representante: postor.representante, docTipo: postor.docTipo || undefined, docNumero: postor.docNumero || undefined, correo: postor.correo || undefined },
          contrato: {
            monto: monto || postor.montoOferta,
            formaPago: formaPago === "PAGO A CUENTA" ? `pago a cuenta en ${nroPagos} armadas` : "pago unico",
            inicioPlazo: inicioPlazo.trim() || undefined,
            cronograma: bienes,
            entregas: entregas.map((e) => ({ nro: e.nro, lugarEntrega: e.lugarEntrega.trim(), plazoEntrega: e.plazoEntrega.trim(), tipoDias: e.tipoDias })),
            preciosUnitarios: preciosItems.length > 0 ? preciosItems : undefined,
            preciosTotalGeneral: preciosTotalGeneral || undefined,
            garantiaAplica, garantiaDetalle,
            viciosOcultosAnios: viciosOcultosAnios.trim() || undefined,
            institucionArbitral: institucionArbitral || undefined,
            recepcionArea: recepcionArea.trim() || undefined,
            conformidadArea: conformidadArea.trim() || undefined,
            plazoConformidadDias: plazoConformidadDias.trim() || undefined,
            ciudadFirma: ciudadFirma || undefined,
            fechaFirma: fechaFirma || undefined,
          },
        }),
      });
      if (!res.ok) { const p = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(p.error ?? "No se pudo generar"); }
      const blob = await res.blob();
      if (formato === "pdf") {
        setPdfUrl(URL.createObjectURL(blob));
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `contrato-sie.docx`; a.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar");
    }
    setGenerando(false);
  }

  function descargar() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `contrato-sie.${formato}`;
    a.click();
  }

  // Foco atrapado, Escape y bloqueo de scroll los aporta Radix; los estilos, la
  // envoltura `.visorModal` compartida con la vista previa del contrato CP.
  return (
    <Dialog.Root open={open} onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="visorModalFondo" />
        <Dialog.Content className="visorModal">
          <div className="visorModalHead">
            <Dialog.Title asChild>
              <h3 className="visorModalTitulo">
                <FileText size={20} /> Vista previa del contrato
              </h3>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Cerrar" className="visorModalCerrar" type="button">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="visorModalCuerpo">
            {generando ? (
              <div className="visorModalEstado">
                <LoaderCircle className="spinIcon" size={32} />
                <p>Generando documento PDF…</p>
              </div>
            ) : error ? (
              <div className="visorModalEstado">
                <p className="visorModalError">{error}</p>
                <button className="secondaryButton" onClick={generarPreview} type="button">
                  Reintentar
                </button>
              </div>
            ) : pdfUrl ? (
              <embed src={pdfUrl} type="application/pdf" />
            ) : null}
          </div>

          <div className="visorModalPie">
            <button className="secondaryButton" onClick={onClose} type="button">
              Cerrar
            </button>
            <button className="primaryButton" disabled={!pdfUrl} onClick={descargar} type="button">
              <Download size={15} /> Descargar {formato.toUpperCase()}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
