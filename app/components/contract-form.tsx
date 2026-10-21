"use client";

import { useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { useSettingsCatalog } from "./use-settings-catalog";

const initialForm = {
  entity: "",
  object: "",
  processType: "",
  amount: "",
  contractorName: "",
  contractorRuc: "",
  durationDays: "",
  place: "",
};

export function ContractForm() {
  const { entity: configuredEntity, processTypes } = useSettingsCatalog();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // El campo puede mostrar la entidad configurada en Municipalidad aunque el
  // usuario no la haya escrito; usamos ese valor efectivo para validar y enviar.
  const effectiveEntity = form.entity.trim() || configuredEntity?.name?.trim() || "";
  const canGenerate = effectiveEntity.length >= 2 && form.object.trim().length >= 3;

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDone(false);
  }

  function filenameFromResponse(response: Response) {
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return match?.[1] ? decodeURIComponent(match[1]) : "contrato.docx";
  }

  async function generate() {
    setError("");
    setDone(false);

    if (!canGenerate) {
      setError("Completa al menos la entidad y el objeto del contrato.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/contracts/generate", {
        body: JSON.stringify({ ...form, entity: effectiveEntity }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo generar el contrato.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromResponse(response);
      anchor.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Generación</p>
          <h2>Contrato con cláusulas obligatorias</h2>
        </div>
        <FileText size={22} />
      </div>

      <div className="toolBody">
        <div className="formGrid">
          <label className="promptInput">
            <span>Entidad contratante *</span>
            <input
              onChange={(event) => update("entity", event.target.value)}
              placeholder="Municipalidad de..."
              value={form.entity || configuredEntity?.name || ""}
            />
          </label>
          <label className="promptInput">
            <span>Tipo de proceso</span>
            <select onChange={(event) => update("processType", event.target.value)} value={form.processType}>
              <option value="">Selecciona...</option>
              {processTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="promptInput fullWidth">
            <span>Objeto del contrato *</span>
            <input
              onChange={(event) => update("object", event.target.value)}
              placeholder="Adquisición de equipos de cómputo"
              value={form.object}
            />
          </label>
          <label className="promptInput">
            <span>Contratista</span>
            <input onChange={(event) => update("contractorName", event.target.value)} placeholder="Razón social" value={form.contractorName} />
          </label>
          <label className="promptInput">
            <span>RUC del contratista</span>
            <input onChange={(event) => update("contractorRuc", event.target.value)} placeholder="20..." value={form.contractorRuc} />
          </label>
          <label className="promptInput">
            <span>Monto</span>
            <input onChange={(event) => update("amount", event.target.value)} placeholder="S/ 100,000.00" value={form.amount} />
          </label>
          <label className="promptInput">
            <span>Plazo (días)</span>
            <input inputMode="numeric" onChange={(event) => update("durationDays", event.target.value)} placeholder="60" value={form.durationDays} />
          </label>
          <label className="promptInput">
            <span>Lugar</span>
            <input onChange={(event) => update("place", event.target.value)} placeholder="Lima" value={form.place} />
          </label>
        </div>

        <div className="formActions">
          <button
            className="primaryButton"
            disabled={loading || !canGenerate}
            onClick={generate}
            type="button"
          >
            {loading ? <LoaderCircle className="spinIcon" size={18} /> : <FileText size={18} />}
            {loading ? "Generando..." : "Generar DOCX"}
          </button>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
        {done ? (
          <p className="formMessage">
            Contrato generado y descargado. Incluye las cláusulas obligatorias del artículo 60; revísalo
            antes de usarlo (es un borrador de apoyo).
          </p>
        ) : null}
      </div>
    </div>
  );
}
