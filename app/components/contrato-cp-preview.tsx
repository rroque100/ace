"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { FileText, Download, X, LoaderCircle } from "lucide-react";

type Proceso = { nomenclatura: string; denominacion: string; entidadNombre: string; entidadRuc: string; entidadDomicilio: string; fechaBuenaPro: string; entidadRepresentante: string; entidadRepresentanteDni: string; entidadRepresentanteCargo: string };
type Postor = { razonSocial: string; ruc: string; domicilio: string; partidaRegistral: string; asiento: string; ciudadRegistro: string; representante: string; docTipo: string; docNumero: string; poderPartida: string; poderAsiento: string; poderCiudad: string; correo: string };
type Bien = { paquete: string; descripcion: string; marca: string; unidad: string; cantidad: string };
type PrecioItem = { concepto: string; marca: string; unidad: string; cantidad: string; precioUnitario: string; precioTotal: string };

type Props = {
  proceso: Proceso;
  postor: Postor;
  monto: string;
  numeroContrato: string;
  bienes: Bien[];
  inicioPlazo: string;
  plazoEntrega: string;
  lugarEntrega: string;
  formaPago: string;
  viciosOcultosAnios: string;
  institucionArbitral: string;
  recepcionArea: string;
  conformidadArea: string;
  plazoConformidadDias: string;
  ciudadFirma: string;
  fechaFirma: string;
  preciosItems: PrecioItem[];
  preciosTotalGeneral: string;
  formato: "docx" | "pdf";
  onCancel: () => void;
};

export function VistaPreviaContratoCp(props: Props) {
  const { proceso, postor, monto, numeroContrato, bienes, inicioPlazo, plazoEntrega, lugarEntrega, formaPago, viciosOcultosAnios, institucionArbitral, recepcionArea, conformidadArea, plazoConformidadDias, ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral, formato, onCancel } = props;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    generarPreview();
    return () => {
      document.body.style.overflow = prev;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function generarPreview() {
    setGenerando(true); setError(""); setPdfUrl(null);
    try {
      const res = await fetch("/api/contratos-cp/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato,
          numeroContrato: numeroContrato.trim() || undefined,
          proceso: { nomenclatura: proceso.nomenclatura, denominacion: proceso.denominacion, entidadNombre: proceso.entidadNombre, entidadRuc: proceso.entidadRuc, entidadDomicilio: proceso.entidadDomicilio, fechaBuenaPro: proceso.fechaBuenaPro || undefined, entidadRepresentante: proceso.entidadRepresentante || undefined, entidadRepresentanteDni: proceso.entidadRepresentanteDni || undefined, entidadRepresentanteCargo: proceso.entidadRepresentanteCargo || undefined },
          postor: { razonSocial: postor.razonSocial, ruc: postor.ruc, domicilio: postor.domicilio, partidaRegistral: postor.partidaRegistral || undefined, asiento: postor.asiento || undefined, ciudadRegistro: postor.ciudadRegistro || undefined, representante: postor.representante, docTipo: postor.docTipo || undefined, docNumero: postor.docNumero || undefined, poderPartida: postor.poderPartida || undefined, poderAsiento: postor.poderAsiento || undefined, poderCiudad: postor.ciudadRegistro || undefined, correo: postor.correo || undefined },
          contrato: {
            monto, formaPago, lugarEntrega: lugarEntrega.trim() || undefined, plazoEntrega: plazoEntrega.trim() || undefined, inicioPlazo: inicioPlazo.trim() || undefined,
            cronograma: bienes.map((b) => ({ paquete: b.paquete, descripcion: b.descripcion, marca: b.marca, unidad: b.unidad, cantidad: b.cantidad })),
            preciosUnitarios: preciosItems.length > 0 ? preciosItems : undefined,
            preciosTotalGeneral: preciosTotalGeneral || undefined,
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
        a.href = url; a.download = `contrato-cp.docx`; a.click();
        URL.revokeObjectURL(url);
        onCancel();
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
    a.download = `contrato-cp.${formato}`;
    a.click();
  }

  // Foco atrapado, Escape y bloqueo de scroll los aporta Radix; los estilos, la
  // envoltura `.visorModal` compartida con la vista previa del contrato SIE.
  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto) onCancel(); }}>
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
            <button className="secondaryButton" onClick={onCancel} type="button">
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
