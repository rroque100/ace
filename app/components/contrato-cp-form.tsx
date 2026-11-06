"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { CheckCircle2, ChevronDown, Database, FileText, FileUp, LoaderCircle, Minus, Plus, Save, Trash2 } from "lucide-react";
import { useSettingsCatalog } from "./use-settings-catalog";
import { VistaPreviaContratoCp } from "./contrato-cp-preview";
import { SectionBadge } from "./contrato-sie-section-badge";
import { useAutoSave } from "./contrato-sie-autosave";
import type { SectionStatus } from "./contrato-sie-validation";
import { cn } from "@/lib/utils";

type Bien = { paquete: string; descripcion: string; marca: string; unidad: string; cantidad: string };
type PrecioItem = { concepto: string; marca: string; unidad: string; cantidad: string; precioUnitario: string; precioTotal: string };
type Proceso = { nomenclatura: string; denominacion: string; entidadNombre: string; entidadRuc: string; entidadDomicilio: string; fechaBuenaPro: string; entidadRepresentante: string; entidadRepresentanteDni: string; entidadRepresentanteCargo: string };
type Postor = { razonSocial: string; ruc: string; domicilio: string; partidaRegistral: string; asiento: string; ciudadRegistro: string; representante: string; docTipo: string; docNumero: string; poderPartida: string; poderAsiento: string; poderCiudad: string; correo: string };

const procesoVacio: Proceso = { nomenclatura: "", denominacion: "", entidadNombre: "", entidadRuc: "", entidadDomicilio: "", fechaBuenaPro: "", entidadRepresentante: "", entidadRepresentanteDni: "", entidadRepresentanteCargo: "" };
const postorVacio: Postor = { razonSocial: "", ruc: "", domicilio: "", partidaRegistral: "", asiento: "", ciudadRegistro: "", representante: "", docTipo: "DNI", docNumero: "", poderPartida: "", poderAsiento: "", poderCiudad: "", correo: "" };

// Estilos migrados de inline a utilidades. Este formulario no vive dentro de un
// contenedor `.tw` (todavía usa clases compartidas: toolPanel, secondaryButton,
// formMessage…, que el reset de `.tw` rompería), así que los bordes llevan
// `border-solid` y los campos `box-border` explícitos —lo que `.tw` aportaría—.
const INPUT = "w-full box-border rounded-md border border-solid border-line bg-canvas px-[9px] py-[7px] text-[13px]";
const LABEL = "flex flex-col gap-1 text-[12.5px] font-semibold";
const PANEL_CARD = "rounded-[10px] border border-solid border-line bg-panel p-4";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="min-w-[180px] pt-1.5 text-[12.5px] font-semibold">{label}</span>
      <div className="min-w-[200px] flex-1">{children}</div>
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: { title: string; expanded?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={PANEL_CARD}>
      <button type="button" onClick={onToggle} className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-sm font-bold text-brand">
        {title}
        <ChevronDown size={18} className={cn("transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      {expanded !== false ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function ContratoCpForm({ contratoId, onSaved }: { contratoId?: string | null; onSaved?: () => void } = {}) {
  const { entity: configuredEntity } = useSettingsCatalog();
  const [proceso, setProceso] = useState<Proceso>(procesoVacio);
  const [postor, setPostor] = useState<Postor>(postorVacio);
  const [bienes, setBienes] = useState<Bien[]>([]);
  const [monto, setMonto] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [formato, setFormato] = useState<"docx" | "pdf">("docx");
  const [inicioPlazo, setInicioPlazo] = useState("");
  const [plazoEntrega, setPlazoEntrega] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [formaPago, setFormaPago] = useState<"PAGO UNICO" | "PAGO A CUENTA">("PAGO UNICO");
  const [nroPagos, setNroPagos] = useState(1);
  const [institucionArbitral, setInstitucionArbitral] = useState("");
  const [ciudadFirma, setCiudadFirma] = useState("");
  const [fechaFirma, setFechaFirma] = useState("");
  const [viciosOcultosAnios, setViciosOcultosAnios] = useState("");
  const [recepcionArea, setRecepcionArea] = useState("");
  const [conformidadArea, setConformidadArea] = useState("");
  const [plazoConformidadDias, setPlazoConformidadDias] = useState("");
  const [preciosItems, setPreciosItems] = useState<PrecioItem[]>([]);
  const [preciosTotalGeneral, setPreciosTotalGeneral] = useState("");
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [subiendo, setSubiendo] = useState<"proceso" | "postor" | "precios" | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [procesoCargado, setProcesoCargado] = useState(false);
  const [postorCargado, setPostorCargado] = useState(false);
  const [preciosCargados, setPreciosCargados] = useState(false);
  const [dbId, setDbId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const autosaveData = { proceso, postor, bienes, monto, numeroContrato, inicioPlazo, plazoEntrega, lugarEntrega, formaPago, nroPagos, viciosOcultosAnios, recepcionArea, conformidadArea, plazoConformidadDias, institucionArbitral, ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral };
  const { savedAt, restore, clear: clearAutosave } = useAutoSave("contrato-cp-borrador", autosaveData);

  useEffect(() => {
    const saved = restore();
    if (saved) {
      if (saved.proceso) setProceso(saved.proceso);
      if (saved.postor) setPostor(saved.postor);
      if (saved.bienes) setBienes(saved.bienes);
      if (saved.monto) setMonto(saved.monto);
      if (saved.numeroContrato) setNumeroContrato(saved.numeroContrato);
      if (saved.inicioPlazo) setInicioPlazo(saved.inicioPlazo);
      if (saved.plazoEntrega) setPlazoEntrega(saved.plazoEntrega);
      if (saved.lugarEntrega) setLugarEntrega(saved.lugarEntrega);
      if (saved.formaPago) setFormaPago(saved.formaPago);
      if (saved.nroPagos) setNroPagos(saved.nroPagos);
      if (saved.viciosOcultosAnios) setViciosOcultosAnios(saved.viciosOcultosAnios);
      if (saved.recepcionArea) setRecepcionArea(saved.recepcionArea);
      if (saved.conformidadArea) setConformidadArea(saved.conformidadArea);
      if (saved.plazoConformidadDias) setPlazoConformidadDias(saved.plazoConformidadDias);
      if (saved.institucionArbitral) setInstitucionArbitral(saved.institucionArbitral);
      if (saved.ciudadFirma) setCiudadFirma(saved.ciudadFirma);
      if (saved.fechaFirma) setFechaFirma(saved.fechaFirma);
      if (saved.preciosItems) setPreciosItems(saved.preciosItems);
      if (saved.preciosTotalGeneral) setPreciosTotalGeneral(saved.preciosTotalGeneral);
      setShowRestoreBanner(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validation: Record<string, SectionStatus> = (() => {
    const procFields = [
      { key: "nomenclatura", label: "Nomenclatura", valid: !!proceso.nomenclatura.trim() },
      { key: "denominacion", label: "Denominación", valid: !!proceso.denominacion.trim() },
      { key: "entidad", label: "Entidad", valid: !!proceso.entidadNombre.trim() },
    ];
    const postFields = [
      { key: "razonSocial", label: "Razón social", valid: !!postor.razonSocial.trim() },
      { key: "ruc", label: "RUC", valid: !!postor.ruc.trim() },
      { key: "representante", label: "Representante", valid: !!postor.representante.trim() },
    ];
    const ctrFields = [
      { key: "monto", label: "Monto contractual", valid: !!monto.replace(/[^\d]/g, "") },
      { key: "formaPago", label: "Forma de pago", valid: true },
      { key: "ciudadFirma", label: "Ciudad de firma", valid: !!ciudadFirma.trim() },
      { key: "fechaFirma", label: "Fecha de firma", valid: !!fechaFirma.trim() },
    ];
    const preciosFields = preciosItems.length > 0
      ? [{ key: "items", label: "Ítems cargados", valid: true }]
      : [];
    const make = (fields: Array<{ key: string; label: string; valid: boolean }>): SectionStatus => {
      const done = fields.filter((f) => f.valid).length;
      return { done, total: fields.length, fields, isComplete: done === fields.length };
    };
    return { proceso: make(procFields), postor: make(postFields), precios: make(preciosFields), contrato: make(ctrFields) };
  })();

  const toggleSection = (s: string) => setExpandedSections((p) => ({ ...p, [s]: !p[s] }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/contratos-sie/defaults");
        if (!res.ok) return;
        const data = await res.json();
        if (data.city) setCiudadFirma(data.city);
        if (data.numeroContrato) setNumeroContrato(data.numeroContrato);
      } catch { /* ok */ }
    })();
  }, []);

  // Cargar contrato desde la DB si se pasa un contratoId.
  useEffect(() => {
    if (!contratoId) return;
    (async () => {
      try {
        const res = await fetch(`/api/contratos-cp/${contratoId}`);
        if (!res.ok) return;
        const saved = await res.json();
        const d = saved.data;
        if (!d) return;
        setDbId(saved.id);
        if (d.proceso) setProceso(d.proceso);
        if (d.postor) setPostor(d.postor);
        if (d.bienes) setBienes(d.bienes);
        if (d.monto) setMonto(d.monto);
        if (d.numeroContrato) setNumeroContrato(d.numeroContrato);
        if (d.inicioPlazo) setInicioPlazo(d.inicioPlazo);
        if (d.plazoEntrega) setPlazoEntrega(d.plazoEntrega);
        if (d.lugarEntrega) setLugarEntrega(d.lugarEntrega);
        if (d.formaPago) setFormaPago(d.formaPago);
        if (d.nroPagos) setNroPagos(d.nroPagos);
        if (d.viciosOcultosAnios) setViciosOcultosAnios(d.viciosOcultosAnios);
        if (d.recepcionArea) setRecepcionArea(d.recepcionArea);
        if (d.conformidadArea) setConformidadArea(d.conformidadArea);
        if (d.plazoConformidadDias) setPlazoConformidadDias(d.plazoConformidadDias);
        if (d.institucionArbitral) setInstitucionArbitral(d.institucionArbitral);
        if (d.ciudadFirma) setCiudadFirma(d.ciudadFirma);
        if (d.fechaFirma) setFechaFirma(d.fechaFirma);
        if (d.preciosItems) setPreciosItems(d.preciosItems);
        if (d.preciosTotalGeneral) setPreciosTotalGeneral(d.preciosTotalGeneral);
      } catch { /* ignore */ }
    })();
  }, [contratoId]);

  useEffect(() => {
    if (!configuredEntity) return;
    setProceso((prev) => ({
      ...prev,
      entidadNombre: prev.entidadNombre || configuredEntity.name || "",
      entidadRuc: prev.entidadRuc || configuredEntity.ruc || "",
      entidadDomicilio: prev.entidadDomicilio || configuredEntity.address || "",
    }));
  }, [configuredEntity]);

  const upProc = (k: keyof Proceso, v: string) => setProceso((p) => ({ ...p, [k]: v }));
  const upPost = (k: keyof Postor, v: string) => setPostor((p) => ({ ...p, [k]: v }));
  const upBien = (idx: number, k: keyof Bien, v: string) => setBienes((r) => r.map((b, i) => (i === idx ? { ...b, [k]: v } : b)));

  function str(v: unknown): string {
    return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  }

  async function extraer(file: File, kind: "proceso" | "postor" | "precios") {
    setError(""); setOk(""); setSubiendo(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind === "postor" ? "oferta" : kind);
      const res = await fetch("/api/contratos-sie/extraer", { method: "POST", body: fd });
      const payload = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "No se pudo analizar el PDF");
      const d = payload.data ?? {};
      if (kind === "proceso") {
        setProceso((prev) => ({
          nomenclatura: str(d.nomenclatura),
          denominacion: str(d.denominacion),
          entidadNombre: str(d.entidadNombre),
          entidadRuc: str(d.entidadRuc),
          entidadDomicilio: str(d.entidadDomicilio),
          fechaBuenaPro: str(d.fechaBuenaPro),
          entidadRepresentante: prev.entidadRepresentante,
          entidadRepresentanteDni: prev.entidadRepresentanteDni,
          entidadRepresentanteCargo: prev.entidadRepresentanteCargo,
        }));
        const lista = Array.isArray(d.bienes) ? (d.bienes as Array<Record<string, unknown>>) : [];
        setBienes(lista.map((b) => ({
          paquete: str(b.paquete), descripcion: str(b.descripcion),
          marca: str(b.marca || ""), unidad: str(b.unidad), cantidad: str(b.cantidad),
        })));
        setProcesoCargado(true);
        setOk(`Proceso leído: ${str(d.nomenclatura) || "—"} · ${lista.length} bien(es) cargado(s). Revisa los datos.`);
      } else if (kind === "postor") {
        setPostor({
          razonSocial: str(d.razonSocial),
          ruc: str(d.ruc),
          domicilio: str(d.domicilio),
          partidaRegistral: str(d.partidaRegistral),
          asiento: str(d.asiento),
          ciudadRegistro: str(d.ciudadRegistro),
          representante: str(d.representante),
          docTipo: str(d.docTipo) || "DNI",
          docNumero: str(d.docNumero),
          poderPartida: str(d.poderPartida),
          poderAsiento: str(d.poderAsiento),
          poderCiudad: str(d.ciudadRegistro || ""),
          correo: str(d.correo),
        });
        setPostorCargado(true);
        setOk(`Contratista leído: ${str(d.razonSocial) || "—"} (RUC ${str(d.ruc) || "—"}). Revisa los datos.`);
      } else {
        // precios
        const lista = Array.isArray(d.items) ? (d.items as Array<Record<string, unknown>>)
          : Array.isArray(d.preciosUnitarios) ? (d.preciosUnitarios as Array<Record<string, unknown>>)
          : [];
        const items: PrecioItem[] = lista.map((p) => ({
          concepto: str(p.concepto || p.descripcion),
          marca: str(p.marca || ""),
          unidad: str(p.unidad || ""),
          cantidad: str(p.cantidad || ""),
          precioUnitario: str(p.precioUnitario || p.precio),
          precioTotal: str(p.precioTotal || p.total || p.precioSubTotal || ""),
        }));
        setPreciosItems(items);
        const tg = str(d.totalGeneral || d.preciosTotalGeneral);
        if (tg) {
          setPreciosTotalGeneral(tg);
        } else if (items.length > 0) {
          const total = items.reduce((s, it) => s + (Number.parseFloat(it.precioTotal.replace(/[^\d.]/g, "")) || 0), 0);
          setPreciosTotalGeneral(total.toFixed(2));
        }
        setPreciosCargados(true);
        setOk(`Precios leídos: ${items.length} ítem(s) cargado(s). Revisa los datos.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar el PDF");
    } finally {
      setSubiendo(null);
    }
  }

  function validarYPrevisualizar() {
    setError(""); setOk("");
    if (!proceso.denominacion.trim() && !proceso.nomenclatura.trim()) {
      setError("Completa la denominación o nomenclatura del proceso.");
      return;
    }
    if (!postor.razonSocial.trim()) { setError("Completa la razón social del contratista."); return; }
    if (!monto.replace(/[^\d.]/g, "") || Number(monto.replace(/[^\d.]/g, "")) <= 0) {
      setError("Ingresa un monto contractual válido.");
      return;
    }
    if (proceso.entidadRuc && !/^\d{11}$/.test(proceso.entidadRuc.trim())) { setError("El RUC de la entidad debe tener 11 dígitos."); return; }
    if (postor.ruc && !/^\d{11}$/.test(postor.ruc.trim())) { setError("El RUC del postor debe tener 11 dígitos."); return; }
    setMostrarPreview(true);
  }

  async function guardarEnDB() {
    setError(""); setOk("");
    const data = { proceso, postor, bienes, monto, numeroContrato, inicioPlazo, plazoEntrega, lugarEntrega, formaPago, nroPagos, viciosOcultosAnios, recepcionArea, conformidadArea, plazoConformidadDias, institucionArbitral, ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral };
    setGuardando(true);
    try {
      if (dbId) {
        const res = await fetch(`/api/contratos-cp/${dbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) { setError("Error al actualizar."); return; }
        setOk("Contrato actualizado.");
      } else {
        const res = await fetch("/api/contratos-cp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, numeroContrato, estado: "borrador" }),
        });
        if (!res.ok) { setError("Error al guardar."); return; }
        const saved = await res.json();
        setDbId(saved.id);
        setOk("Contrato guardado en la base de datos.");
        onSaved?.();
      }
    } catch { setError("Error de conexión."); }
    setGuardando(false);
  }

  async function eliminarDeDB() {
    if (!dbId) return;
    if (!window.confirm("¿Eliminar este contrato definitivamente?")) return;
    setError(""); setOk("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/contratos-cp/${dbId}`, { method: "DELETE" });
      if (!res.ok) { setError("Error al eliminar."); setGuardando(false); return; }
      setDbId(null);
      setOk("Contrato eliminado.");
      onSaved?.();
    } catch { setError("Error de conexión."); }
    setGuardando(false);
  }

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Comparación de Precios · Ley 32069 (2026)</p>
          <h2>Generar contrato de Comparación de Precios</h2>
        </div>
        <FileText size={22} />
      </div>

      <div className="toolBody flex flex-col gap-3">
        {error ? <p className="formMessage errorText">{error}</p> : null}
        {ok ? <p className="formMessage">{ok}</p> : null}

        {showRestoreBanner ? (
          <div className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-[12.5px] font-medium text-success">
            <span className="flex items-center gap-1.5"><Save size={15} /> Borrador restaurado automáticamente. Puedes continuar editando.</span>
            <div className="flex gap-2">
              <button type="button" className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-success underline" onClick={() => setShowRestoreBanner(false)}>Cerrar</button>
              <button type="button" className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-danger underline" onClick={() => { clearAutosave(); setShowRestoreBanner(false); }}>Descartar borrador</button>
            </div>
          </div>
        ) : null}

        {dbId ? (
          <div className="flex items-center gap-1.5 rounded-md bg-brand-soft px-3 py-2 text-[12.5px] font-medium text-brand">
            <Database size={15} /> Editando contrato guardado · {numeroContrato || proceso.nomenclatura || "(sin título)"}
          </div>
        ) : null}

        {savedAt ? (
          <div className="flex items-center gap-1 self-end text-[11px] font-medium text-muted">
            <Save size={11} /> Guardado automático - {new Date(savedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 rounded-md border border-solid border-line bg-canvas px-3 py-2">
          {[
            { key: "proceso", label: "1. Proceso" },
            { key: "postor", label: "2. Contratista" },
            { key: "precios", label: "3. Precios" },
            { key: "contrato", label: "4. Contrato" },
          ].map((sec) => (
            <button key={sec.key} type="button" onClick={() => toggleSection(sec.key)}
              className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-xs font-semibold text-ink">
              {sec.label}
              <SectionBadge status={validation[sec.key]} compact />
              <ChevronDown size={14} className={cn("transition-transform duration-150", expandedSections[sec.key] && "rotate-180")} />
            </button>
          ))}
        </div>

        <Section title="1. Datos del proceso de selección" expanded={expandedSections.proceso} onToggle={() => toggleSection("proceso")}>
          <div className="flex flex-col gap-2.5">
            <Row label="Nomenclatura CP N°">
              <input className={INPUT} placeholder="Ej. CP-01-2026-MDCH" value={proceso.nomenclatura} onChange={(e) => upProc("nomenclatura", e.target.value)} />
            </Row>
            <Row label="Denominación / Objeto">
              <input className={INPUT} placeholder="Ej. Adquisición de equipos de cómputo" value={proceso.denominacion} onChange={(e) => upProc("denominacion", e.target.value)} />
            </Row>
            <Row label="Entidad contratante">
              <input className={INPUT} value={proceso.entidadNombre} onChange={(e) => upProc("entidadNombre", e.target.value)} />
            </Row>
            <div className="flex flex-wrap gap-2.5">
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                RUC de la entidad
                <input className={INPUT} maxLength={11} placeholder="11 dígitos" value={proceso.entidadRuc} onChange={(e) => upProc("entidadRuc", e.target.value)} />
              </div>
              <div className={cn(LABEL, "min-w-[250px] flex-[2]")}>
                Domicilio legal
                <input className={INPUT} value={proceso.entidadDomicilio} onChange={(e) => upProc("entidadDomicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Representante de la entidad">
              <div className="flex flex-wrap gap-2">
                <input className={cn(INPUT, "min-w-[200px] flex-[2]")} placeholder="Nombre completo del representante" value={proceso.entidadRepresentante} onChange={(e) => upProc("entidadRepresentante", e.target.value)} />
                <input className={cn(INPUT, "min-w-[120px] flex-1")} placeholder="DNI / Carné" maxLength={12} value={proceso.entidadRepresentanteDni} onChange={(e) => upProc("entidadRepresentanteDni", e.target.value)} />
                <input className={cn(INPUT, "min-w-[150px] flex-1")} placeholder="Cargo (Ej. Alcalde, Gerente)" value={proceso.entidadRepresentanteCargo} onChange={(e) => upProc("entidadRepresentanteCargo", e.target.value)} />
              </div>
            </Row>
            <Row label="Fecha de la Buena Pro">
              <input type="date" className={INPUT} value={proceso.fechaBuenaPro} onChange={(e) => upProc("fechaBuenaPro", e.target.value)} />
            </Row>
            <Row label="PDF del proceso">
              <div className="flex flex-wrap items-center gap-2">
                <label className={cn(buttonClasses({ variant: "secondary" }), "gap-1.5 text-xs", subiendo === "proceso" ? "cursor-wait" : "cursor-pointer")}>
                  {subiendo === "proceso" ? <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={16} /> : procesoCargado ? <CheckCircle2 size={16} className="text-success" /> : <FileUp size={16} />}
                  {subiendo === "proceso" ? "Extrayendo con IA…" : procesoCargado ? "Leído con IA" : "Extraer datos con IA"}
                  <input type="file" accept="application/pdf" className="hidden" disabled={Boolean(subiendo)} onChange={(e) => { const f = e.target.files?.[0]; if (f) extraer(f, "proceso"); e.target.value = ""; }} />
                </label>
              </div>
            </Row>
          </div>
        </Section>

        <Section title="2. Datos del contratista" expanded={expandedSections.postor} onToggle={() => toggleSection("postor")}>
          <div className="flex flex-col gap-2.5">
            <Row label="Razón social">
              <input className={INPUT} value={postor.razonSocial} onChange={(e) => upPost("razonSocial", e.target.value)} />
            </Row>
            <div className="flex flex-wrap gap-2.5">
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                RUC
                <input className={INPUT} maxLength={11} placeholder="11 dígitos" value={postor.ruc} onChange={(e) => upPost("ruc", e.target.value)} />
              </div>
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                Domicilio legal
                <input className={INPUT} value={postor.domicilio} onChange={(e) => upPost("domicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Partida registral">
              <div className="flex gap-2">
                <input className={cn(INPUT, "flex-1")} placeholder="N° de partida" value={postor.partidaRegistral} onChange={(e) => upPost("partidaRegistral", e.target.value)} />
                <input className={cn(INPUT, "flex-1")} placeholder="Asiento" value={postor.asiento} onChange={(e) => upPost("asiento", e.target.value)} />
                <input className={cn(INPUT, "flex-1")} placeholder="Ciudad" value={postor.ciudadRegistro} onChange={(e) => upPost("ciudadRegistro", e.target.value)} />
              </div>
            </Row>
            <Row label="Representante legal">
              <div className="flex gap-2">
                <input className={cn(INPUT, "flex-[2]")} placeholder="Nombre completo" value={postor.representante} onChange={(e) => upPost("representante", e.target.value)} />
                <select className={cn(INPUT, "flex-1")} value={postor.docTipo} onChange={(e) => upPost("docTipo", e.target.value)}>
                  <option value="DNI">DNI</option>
                  <option value="Carné de extranjería">Carné de extranjería</option>
                </select>
                <input className={cn(INPUT, "flex-1")} placeholder="N° documento" value={postor.docNumero} onChange={(e) => upPost("docNumero", e.target.value)} />
              </div>
            </Row>
            <Row label="Correo electrónico">
              <input type="email" className={INPUT} placeholder="contratista@correo.com" value={postor.correo} onChange={(e) => upPost("correo", e.target.value)} />
            </Row>
            <Row label="PDF del contratista">
              <div className="flex flex-wrap items-center gap-2">
                <label className={cn(buttonClasses({ variant: "secondary" }), "gap-1.5 text-xs", subiendo === "postor" ? "cursor-wait" : "cursor-pointer")}>
                  {subiendo === "postor" ? <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={16} /> : postorCargado ? <CheckCircle2 size={16} className="text-success" /> : <FileUp size={16} />}
                  {subiendo === "postor" ? "Extrayendo con IA…" : postorCargado ? "Leído con IA" : "Extraer datos con IA"}
                  <input type="file" accept="application/pdf" className="hidden" disabled={Boolean(subiendo)} onChange={(e) => { const f = e.target.files?.[0]; if (f) extraer(f, "postor"); e.target.value = ""; }} />
                </label>
              </div>
            </Row>
          </div>
        </Section>

        <Section title="3. Bienes a contratar" expanded={expandedSections.bienes} onToggle={() => toggleSection("bienes")}>
          <div className="flex flex-col gap-2">
            {bienes.length === 0 && (
              <p className="text-[12.5px] italic text-muted">Agrega los bienes a contratar usando el botón +</p>
            )}
            {bienes.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input className={cn(INPUT, "w-20")} placeholder="Paq." value={b.paquete} onChange={(e) => upBien(i, "paquete", e.target.value)} />
                <input className={cn(INPUT, "min-w-[150px] flex-[2]")} placeholder="Descripción" value={b.descripcion} onChange={(e) => upBien(i, "descripcion", e.target.value)} />
                <input className={cn(INPUT, "w-[100px]")} placeholder="Marca" value={b.marca} onChange={(e) => upBien(i, "marca", e.target.value)} />
                <input className={cn(INPUT, "w-20")} placeholder="Unidad" value={b.unidad} onChange={(e) => upBien(i, "unidad", e.target.value)} />
                <input className={cn(INPUT, "w-20")} placeholder="Cant." value={b.cantidad} onChange={(e) => upBien(i, "cantidad", e.target.value)} />
                <button type="button" onClick={() => setBienes((r) => r.filter((_, j) => j !== i))} className="flex cursor-pointer border-0 bg-transparent p-1 text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => setBienes((r) => [...r, { paquete: "", descripcion: "", marca: "", unidad: "", cantidad: "" }])}>
                <Plus size={15} /> Agregar bien
              </button>
            </div>
          </div>
        </Section>

        <Section title="4. Condiciones del contrato" expanded={expandedSections.condiciones} onToggle={() => toggleSection("condiciones")}>
          <div className="flex flex-col gap-2.5">
            <Row label="N° de contrato">
              <input className={INPUT} placeholder="CONTRATO N° 001-2026-MDCH/GM" value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
            </Row>
            <Row label="Monto contractual (S/)">
              <input className={INPUT} placeholder="Ej. 603,806.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Row>
            <Row label="Forma de pago">
              <div className="flex items-center gap-2">
                <select className={cn(INPUT, "w-[180px]")} value={formaPago} onChange={(e) => setFormaPago(e.target.value as "PAGO UNICO" | "PAGO A CUENTA")}>
                  <option value="PAGO UNICO">Pago único</option>
                  <option value="PAGO A CUENTA">Pago a cuenta</option>
                </select>
                {formaPago === "PAGO A CUENTA" ? (
                  <>
                    <span className="text-[12.5px]">en</span>
                    <input type="number" min={2} max={24} className={cn(INPUT, "w-[60px]")} value={nroPagos} onChange={(e) => setNroPagos(Number(e.target.value))} />
                    <span className="text-[12.5px]">armadas</span>
                  </>
                ) : null}
              </div>
            </Row>
            <Row label="Plazo de ejecución">
              <input className={INPUT} placeholder="Ej. 30 días calendario" value={plazoEntrega} onChange={(e) => setPlazoEntrega(e.target.value)} />
            </Row>
            <Row label="Cómputo del plazo">
              <input className={INPUT} placeholder="Ej. el día siguiente del perfeccionamiento del contrato" value={inicioPlazo} onChange={(e) => setInicioPlazo(e.target.value)} />
            </Row>
            <Row label="Lugar de entrega">
              <input className={INPUT} placeholder="Ej. Almacén de la entidad" value={lugarEntrega} onChange={(e) => setLugarEntrega(e.target.value)} />
            </Row>
            <Row label="Área de recepción">
              <input className={INPUT} placeholder="Ej. Almacén de la entidad" value={recepcionArea} onChange={(e) => setRecepcionArea(e.target.value)} />
            </Row>
            <Row label="Área de conformidad">
              <input className={INPUT} placeholder="Ej. Área usuaria" value={conformidadArea} onChange={(e) => setConformidadArea(e.target.value)} />
            </Row>
            <Row label="Plazo de conformidad (días)">
              <input className={INPUT} placeholder="Ej. 7" value={plazoConformidadDias} onChange={(e) => setPlazoConformidadDias(e.target.value)} />
            </Row>
            <Row label="Vicios ocultos (años)">
              <input className={INPUT} placeholder="Ej. 1" value={viciosOcultosAnios} onChange={(e) => setViciosOcultosAnios(e.target.value)} />
            </Row>
            <Row label="Institución arbitral">
              <input className={INPUT} placeholder="Ej. Centro de Arbitraje de la CCL" value={institucionArbitral} onChange={(e) => setInstitucionArbitral(e.target.value)} />
            </Row>
          </div>
        </Section>

        <Section title="5. Precios unitarios (opcional)" expanded={expandedSections.precios} onToggle={() => toggleSection("precios")}>
          <div className="flex flex-col gap-2">
            <Row label="PDF de precios / oferta">
              <div className="flex flex-wrap items-center gap-2">
                <label className={cn(buttonClasses({ variant: "secondary" }), "gap-1.5 text-xs", subiendo === "precios" ? "cursor-wait" : "cursor-pointer")}>
                  {subiendo === "precios" ? <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={16} /> : preciosCargados ? <CheckCircle2 size={16} className="text-success" /> : <FileUp size={16} />}
                  {subiendo === "precios" ? "Extrayendo con IA…" : preciosCargados ? "Leído con IA" : "Extraer precios con IA"}
                  <input type="file" accept="application/pdf" className="hidden" disabled={Boolean(subiendo)} onChange={(e) => { const f = e.target.files?.[0]; if (f) extraer(f, "precios"); e.target.value = ""; }} />
                </label>
              </div>
            </Row>
            {preciosItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-left">Concepto</th>
                      <th className="p-1 text-left">Marca</th>
                      <th className="p-1 text-left">Unidad</th>
                      <th className="p-1 text-right">Cant.</th>
                      <th className="p-1 text-right">P. Unit.</th>
                      <th className="p-1 text-right">P. Total</th>
                      <th className="p-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preciosItems.map((it, i) => (
                      <tr key={i}>
                        <td className="p-0.5"><input className={INPUT} value={it.concepto} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x))} /></td>
                        <td className="p-0.5"><input className={INPUT} value={it.marca} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, marca: e.target.value } : x))} /></td>
                        <td className="p-0.5"><input className={INPUT} value={it.unidad} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))} /></td>
                        <td className="w-20 p-0.5"><input className={INPUT} value={it.cantidad} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} /></td>
                        <td className="w-[100px] p-0.5"><input className={INPUT} value={it.precioUnitario} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, precioUnitario: e.target.value } : x))} /></td>
                        <td className="w-[100px] p-0.5"><input className={INPUT} value={it.precioTotal} onChange={(e) => setPreciosItems((r) => r.map((x, j) => j === i ? { ...x, precioTotal: e.target.value } : x))} /></td>
                        <td className="p-0.5">
                          <button type="button" onClick={() => setPreciosItems((r) => r.filter((_, j) => j !== i))} className="flex cursor-pointer border-0 bg-transparent text-danger">
                            <Minus size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="p-1 text-right text-xs font-semibold">TOTAL GENERAL</td>
                      <td className="p-0.5 text-xs font-semibold">{preciosTotalGeneral}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => setPreciosItems((r) => [...r, { concepto: "", marca: "", unidad: "", cantidad: "", precioUnitario: "", precioTotal: "" }])}>
                <Plus size={15} /> Agregar ítem
              </button>
              {preciosItems.length > 0 ? (
                <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => { setPreciosItems([]); setPreciosTotalGeneral(""); }}>
                  Limpiar
                </button>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="6. Fecha y firma" expanded={expandedSections.firma} onToggle={() => toggleSection("firma")}>
          <div className="flex flex-wrap gap-2.5">
            <div className={cn(LABEL, "min-w-[180px] flex-1")}>
              Ciudad de firma
              <input className={INPUT} placeholder="Ej. Lima" value={ciudadFirma} onChange={(e) => setCiudadFirma(e.target.value)} />
            </div>
            <div className={cn(LABEL, "min-w-[180px] flex-1")}>
              Fecha de firma
              <input type="date" className={INPUT} value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} />
            </div>
          </div>
        </Section>

        <div className="formActions mt-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-sm border border-solid border-line">
              <button type="button" onClick={() => setFormato("docx")} className={cn("cursor-pointer border-0 px-3 py-1.5 text-xs", formato === "docx" ? "bg-brand font-bold text-white" : "bg-transparent font-normal text-ink")}>DOCX</button>
              <button type="button" onClick={() => setFormato("pdf")} className={cn("cursor-pointer border-0 px-3 py-1.5 text-xs", formato === "pdf" ? "bg-brand font-bold text-white" : "bg-transparent font-normal text-ink")}>PDF</button>
            </div>
            <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={guardando} onClick={guardarEnDB} title={dbId ? "Actualizar contrato guardado" : "Guardar en la base de datos"}>
              {guardando ? <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={15} /> : <Save size={15} />} {dbId ? "Actualizar" : "Guardar"}
            </button>
            {dbId ? (
              <button type="button" className={cn(buttonClasses({ variant: "secondary" }), "text-danger")} disabled={guardando} onClick={eliminarDeDB} title="Eliminar contrato guardado">
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>
          <button className={buttonClasses({ variant: "primary" })} type="button" onClick={validarYPrevisualizar}>
            <FileText size={18} /> Vista previa del contrato
          </button>
        </div>
      </div>

      {mostrarPreview ? (
        <VistaPreviaContratoCp
          proceso={proceso}
          postor={postor}
          monto={monto}
          numeroContrato={numeroContrato}
          bienes={bienes}
          inicioPlazo={inicioPlazo}
          plazoEntrega={plazoEntrega}
          lugarEntrega={lugarEntrega}
          formaPago={formaPago === "PAGO A CUENTA" ? `pago a cuenta en ${nroPagos} armadas` : "pago unico"}
          viciosOcultosAnios={viciosOcultosAnios}
          institucionArbitral={institucionArbitral}
          recepcionArea={recepcionArea}
          conformidadArea={conformidadArea}
          plazoConformidadDias={plazoConformidadDias}
          ciudadFirma={ciudadFirma}
          fechaFirma={fechaFirma}
          preciosItems={preciosItems}
          preciosTotalGeneral={preciosTotalGeneral}
          formato={formato}
          onCancel={() => setMostrarPreview(false)}
        />
      ) : null}

    </div>
  );
}
