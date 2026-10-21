"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Database, FileText, FileUp, Gavel, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useSettingsCatalog } from "./use-settings-catalog";
import { VistaPreviaContrato } from "./contrato-sie-preview";
import { useAutoSave } from "./contrato-sie-autosave";
import { useContratoValidation } from "./contrato-sie-validation";
import { SectionBadge } from "./contrato-sie-section-badge";
import { parseSoles } from "@/lib/parse-soles";

type Bien = { paquete: string; descripcion: string; marca: string; unidad: string; cantidad: string; entrega: string; nroEntrega: number };

type Entrega = {
  nro: number;
  lugarEntrega: string;
  plazoEntrega: string;
  tipoDias: "habil" | "calendario";
};

type PrecioItem = {
  concepto: string;
  marca: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
  precioTotal: string;
};

type Proceso = {
  nomenclatura: string;
  denominacion: string;
  entidadNombre: string;
  entidadRuc: string;
  entidadDomicilio: string;
  fechaBuenaPro: string;
};

type Postor = {
  razonSocial: string;
  ruc: string;
  domicilio: string;
  partidaRegistral: string;
  asiento: string;
  ciudadRegistro: string;
  representante: string;
  docTipo: string;
  docNumero: string;
  poderPartida: string;
  poderAsiento: string;
  correo: string;
  montoOferta: string;
};

type Garantia = {
  monto: string;
  nroCartaFianza: string;
  banco: string;
  vencimiento: string;
};

const procesoVacio: Proceso = {
  nomenclatura: "", denominacion: "", entidadNombre: "", entidadRuc: "", entidadDomicilio: "", fechaBuenaPro: "",
};

const postorVacio: Postor = {
  razonSocial: "", ruc: "", domicilio: "", partidaRegistral: "", asiento: "", ciudadRegistro: "",
  representante: "", docTipo: "DNI", docNumero: "", poderPartida: "", poderAsiento: "", correo: "", montoOferta: "",
};

const garantiaVacia: Garantia = { monto: "", nroCartaFianza: "", banco: "", vencimiento: "" };

const INSTITUCIONES_ARBITRALES = [
  "ARKADIA CENTRO DE ARBITRAJE Y CONCILIACION - RUC 20490229567",
  "THE ANKANA GLOBAL GROUP SAC - RUC 20605105514",
];

const UIT_2026 = 5350;
const UMBRAL_GARANTIA = 50 * UIT_2026;

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function formatSoles(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";
  const normalized = cleaned.replace(/,/g, "");
  const num = parseFloat(normalized);
  if (isNaN(num)) return "";
  return `S/ ${num.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ExtractKind = "proceso" | "oferta" | "precios";

function BotonSubirPdf({
  kind, label, done, subiendo, onFile,
}: {
  kind: ExtractKind;
  label: string;
  done: boolean;
  subiendo: ExtractKind | null;
  onFile: (file: File, kind: ExtractKind) => void;
}) {
  return (
    <label
      className="secondaryButton"
      style={{ cursor: subiendo ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {subiendo === kind ? (
        <LoaderCircle className="spinIcon" size={16} />
      ) : done ? (
        <CheckCircle2 size={16} style={{ color: "#059669" }} />
      ) : (
        <FileUp size={16} />
      )}
      {subiendo === kind ? "Leyendo con IA…" : label}
      <input
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        disabled={Boolean(subiendo)}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f, kind);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
      <span style={{ minWidth: 180, fontSize: 12.5, fontWeight: 600, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 200 }}>{children}</div>
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: { title: string; expanded?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid var(--line, #e2e4ea)", padding: 16, background: "var(--panel, #fff)" }}>
      <button type="button" onClick={onToggle} style={{ background: "transparent", border: 0, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0, fontSize: 14, fontWeight: 700, color: "var(--brand, #0f766e)" }}>
        {title}
        <ChevronDown size={18} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {expanded !== false ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}

export function ContratoSieForm({ contratoId, onSaved }: { contratoId?: string | null; onSaved?: () => void } = {}) {
  const { entity: configuredEntity } = useSettingsCatalog();
  const [proceso, setProceso] = useState<Proceso>(procesoVacio);
  const [postor, setPostor] = useState<Postor>(postorVacio);
  const [bienes, setBienes] = useState<Bien[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([
    { nro: 1, lugarEntrega: "", plazoEntrega: "", tipoDias: "calendario" },
  ]);
  const [monto, setMonto] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [formato, setFormato] = useState<"docx" | "pdf">("docx");
  const [guardando, setGuardando] = useState(false);
  const [garantiaOverride, setGarantiaOverride] = useState<boolean | null>(null);
  const [garantia, setGarantia] = useState<Garantia>(garantiaVacia);
  const [formaPago, setFormaPago] = useState<"PAGO UNICO" | "PAGO A CUENTA">("PAGO UNICO");
  const [nroPagos, setNroPagos] = useState(1);
  const [institucionArbitral, setInstitucionArbitral] = useState("");
  const [ciudadFirma, setCiudadFirma] = useState("");
  const [fechaFirma, setFechaFirma] = useState("");
  const [inicioPlazo, setInicioPlazo] = useState("");
  const [viciosOcultosAnios, setViciosOcultosAnios] = useState("");
  const [recepcionArea, setRecepcionArea] = useState("");
  const [conformidadArea, setConformidadArea] = useState("");
  const [plazoConformidadDias, setPlazoConformidadDias] = useState("");

  const [preciosItems, setPreciosItems] = useState<PrecioItem[]>([]);
  const [preciosTotalGeneral, setPreciosTotalGeneral] = useState("");

  const [subiendo, setSubiendo] = useState<"proceso" | "oferta" | "precios" | null>(null);
  const [procesoCargado, setProcesoCargado] = useState(false);
  const [ofertaCargada, setOfertaCargada] = useState(false);
  const [preciosCargados, setPreciosCargados] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [dbId, setDbId] = useState<string | null>(null);
  const [cargandoDb, setCargandoDb] = useState(false);

  // Autoguardado temporal en localStorage (cada 3s si hubo cambios).
  const autosaveData = {
    proceso, postor, bienes, entregas, monto, numeroContrato,
    inicioPlazo, viciosOcultosAnios, recepcionArea, conformidadArea, plazoConformidadDias,
    garantiaOverride, garantia, formaPago, nroPagos, institucionArbitral,
    ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral,
  };
  const { savedAt, restore, clear: clearAutosave } = useAutoSave("contrato-sie-borrador", autosaveData);

  // Restaurar borrador al montar (si existe y es < 24h).
  useEffect(() => {
    const saved = restore();
    if (saved) {
      if (saved.proceso) setProceso(saved.proceso);
      if (saved.postor) setPostor(saved.postor);
      if (saved.bienes) setBienes(saved.bienes);
      if (saved.entregas) setEntregas(saved.entregas);
      if (saved.monto) setMonto(saved.monto);
      if (saved.numeroContrato) setNumeroContrato(saved.numeroContrato);
      if (saved.inicioPlazo) setInicioPlazo(saved.inicioPlazo);
      if (saved.viciosOcultosAnios) setViciosOcultosAnios(saved.viciosOcultosAnios);
      if (saved.recepcionArea) setRecepcionArea(saved.recepcionArea);
      if (saved.conformidadArea) setConformidadArea(saved.conformidadArea);
      if (saved.plazoConformidadDias) setPlazoConformidadDias(saved.plazoConformidadDias);
      if (saved.garantia) setGarantia(saved.garantia);
      if (saved.formaPago) setFormaPago(saved.formaPago);
      if (saved.nroPagos) setNroPagos(saved.nroPagos);
      if (saved.institucionArbitral) setInstitucionArbitral(saved.institucionArbitral);
      if (saved.ciudadFirma) setCiudadFirma(saved.ciudadFirma);
      if (saved.fechaFirma) setFechaFirma(saved.fechaFirma);
      if (saved.preciosItems) setPreciosItems(saved.preciosItems);
      if (saved.preciosTotalGeneral) setPreciosTotalGeneral(saved.preciosTotalGeneral);
      if (saved.garantiaOverride !== undefined) setGarantiaOverride(saved.garantiaOverride);
      setShowRestoreBanner(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/contratos-sie/defaults");
        if (!res.ok) return;
        const data = await res.json();
        if (data.city) setCiudadFirma(data.city);
        if (data.numeroContrato) setNumeroContrato(data.numeroContrato);
      } catch {
        // fields can be filled manually
      }
    })();
  }, []);

  // Cargar contrato desde la DB si se pasa un contratoId.
  useEffect(() => {
    if (!contratoId) return;
    setCargandoDb(true);
    (async () => {
      try {
        const res = await fetch(`/api/contratos-sie/${contratoId}`);
        if (!res.ok) return;
        const saved = await res.json();
        const d = saved.data;
        if (!d) return;
        setDbId(saved.id);
        if (d.proceso) setProceso(d.proceso);
        if (d.postor) setPostor(d.postor);
        if (d.bienes) setBienes(d.bienes);
        if (d.entregas) setEntregas(d.entregas);
        if (d.monto) setMonto(d.monto);
        if (d.numeroContrato) setNumeroContrato(d.numeroContrato);
        if (d.inicioPlazo) setInicioPlazo(d.inicioPlazo);
        if (d.viciosOcultosAnios) setViciosOcultosAnios(d.viciosOcultosAnios);
        if (d.recepcionArea) setRecepcionArea(d.recepcionArea);
        if (d.conformidadArea) setConformidadArea(d.conformidadArea);
        if (d.plazoConformidadDias) setPlazoConformidadDias(d.plazoConformidadDias);
        if (d.garantia) setGarantia(d.garantia);
        if (d.formaPago) setFormaPago(d.formaPago);
        if (d.nroPagos) setNroPagos(d.nroPagos);
        if (d.institucionArbitral) setInstitucionArbitral(d.institucionArbitral);
        if (d.ciudadFirma) setCiudadFirma(d.ciudadFirma);
        if (d.fechaFirma) setFechaFirma(d.fechaFirma);
        if (d.preciosItems) setPreciosItems(d.preciosItems);
        if (d.preciosTotalGeneral) setPreciosTotalGeneral(d.preciosTotalGeneral);
        if (d.garantiaOverride !== undefined) setGarantiaOverride(d.garantiaOverride);
      } catch { /* ignore */ }
      setCargandoDb(false);
    })();
  }, [contratoId]);

  // Auto-copiar lugar de entrega de armada 1 a todas las demas siempre
  useEffect(() => {
    const l1 = entregas[0]?.lugarEntrega;
    if (!l1?.trim()) return;
    setEntregas((prev) => prev.map((e) => (e.nro === 1 ? e : { ...e, lugarEntrega: l1 })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregas[0]?.lugarEntrega]);

  // #5: Precargar entidad desde /configuracion si el usuario no sube PDF.
  useEffect(() => {
    if (!configuredEntity) return;
    setProceso((prev) => ({
      ...prev,
      entidadNombre: prev.entidadNombre || configuredEntity.name || "",
      entidadRuc: prev.entidadRuc || configuredEntity.ruc || "",
      entidadDomicilio: prev.entidadDomicilio || configuredEntity.address || "",
    }));
  }, [configuredEntity]);

  // #3: Cuando cambia el nro de pagos, resetear bienes que excedan el limite.
  useEffect(() => {
    setBienes((prev) =>
      prev.map((b) => (b.nroEntrega > nroPagos ? { ...b, nroEntrega: 1 } : b)),
    );
    setEntregas((prev) => {
      const next: Entrega[] = [];
      for (let i = 1; i <= nroPagos; i += 1) {
        const existing = prev.find((e) => e.nro === i);
        next.push(existing ?? { nro: i, lugarEntrega: "", plazoEntrega: "", tipoDias: "calendario" });
      }
      return next;
    });
  }, [nroPagos]);

  const montoContractual = parseSoles(monto || postor.montoOferta);
  const superaUmbral = montoContractual > UMBRAL_GARANTIA;
  const garantiaAplica = garantiaOverride ?? superaUmbral;

  // Mejera inteligente: auto-calcular monto de garantia (10% del monto contractual)
  // cuando se activa la garantia y el campo esta vacio.
  useEffect(() => {
    if (garantiaAplica && !garantia.monto && montoContractual > 0) {
      const diezPorciento = montoContractual * 0.1;
      const formatted = `S/ ${diezPorciento.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setGarantia((g) => ({ ...g, monto: formatted }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garantiaAplica]);

  // Sincronizar marca de precios unitarios a bienes del cronograma (matching por concepto ≈ descripcion)
  useEffect(() => {
    if (preciosItems.length === 0) return;
    setBienes((prev) => prev.map((b) => {
      if (b.marca) return b;
      const match = preciosItems.find((p) => p.concepto.trim().toLowerCase() === b.descripcion.trim().toLowerCase());
      return match ? { ...b, marca: match.marca } : b;
    }));
  }, [preciosItems]);

  // Validacion por seccion (visto bueno visual).
  const validation = useContratoValidation({
    proceso, postor, bienes, monto, entregas, formaPago, nroPagos,
    garantiaAplica, garantia, institucionArbitral, ciudadFirma,
    preciosItems, preciosTotalGeneral,
  });

  function upP<K extends keyof Proceso>(k: K, v: string) {
    setProceso((c) => ({ ...c, [k]: v }));
  }
  function upO<K extends keyof Postor>(k: K, v: string) {
    setPostor((c) => ({ ...c, [k]: v }));
  }
  function upBien(i: number, k: keyof Bien, v: string | number) {
    setBienes((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  }
  function duplicar(i: number) {
    const b = bienes[i];
    const total = parseInt(b.cantidad, 10);
    if (isNaN(total) || total < 1) return;
    const sorted = [...entregas].sort((a, bb) => a.nro - bb.nro);
    let remaining = total;
    const nuevos: typeof bienes = [];
    for (let j = 0; j < sorted.length; j++) {
      const ent = sorted[j];
      if (j === sorted.length - 1) {
        nuevos.push({ ...b, cantidad: String(remaining), nroEntrega: ent.nro });
      } else {
        const sugerido = Math.ceil(remaining / (sorted.length - j));
        const input = window.prompt(`Cantidad para Entrega ${ent.nro} (max ${remaining}, sug. ${sugerido})`, String(sugerido));
        const qty = Math.min(Math.max(parseInt(input || "0", 10) || 0, 0), remaining);
        nuevos.push({ ...b, cantidad: String(qty || remaining), nroEntrega: ent.nro });
        remaining -= qty || 0;
      }
    }
    setBienes((prev) => { const c = [...prev]; c.splice(i, 1, ...nuevos); return c; });
  }
  function upG<K extends keyof Garantia>(k: K, v: string) {
    setGarantia((c) => ({ ...c, [k]: v }));
  }
  const toggleSection = (s: string) => setExpandedSections((p) => ({ ...p, [s]: !p[s] }));

  async function extraer(file: File, kind: ExtractKind) {
    setError("");
    setOk("");
    setSubiendo(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/contratos-sie/extraer", { method: "POST", body: fd });
      const payload = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "No se pudo analizar el PDF");
      const d = payload.data ?? {};
      if (kind === "proceso") {
        setProceso({
          nomenclatura: str(d.nomenclatura),
          denominacion: str(d.denominacion),
          entidadNombre: str(d.entidadNombre),
          entidadRuc: str(d.entidadRuc),
          entidadDomicilio: str(d.entidadDomicilio),
          fechaBuenaPro: str(d.fechaBuenaPro),
        });
        const lista = Array.isArray(d.bienes) ? (d.bienes as Array<Record<string, unknown>>) : [];
        setBienes(
          lista.map((b) => ({
            paquete: str(b.paquete),
            descripcion: str(b.descripcion),
            marca: str(b.marca),
            unidad: str(b.unidad),
            cantidad: str(b.cantidad),
            entrega: "",
            nroEntrega: 1,
          })),
        );
        const fp = str(d.formaPago).toUpperCase();
        if (fp.includes("CUENTA")) {
          setFormaPago("PAGO A CUENTA");
          const n = parseInt(str(d.nroPagos), 10);
          if (n > 1) setNroPagos(n);
        } else {
          setFormaPago("PAGO UNICO");
          setNroPagos(1);
        }
        setProcesoCargado(true);
        setOk(`Proceso leído: ${str(d.nomenclatura) || "sin nomenclatura"} · ${lista.length} bien(es) cargado(s) al cronograma.`);
      } else if (kind === "oferta") {
        const montoRaw = str(d.montoOferta);
        const montoFmt = montoRaw ? formatSoles(montoRaw) : "";
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
          correo: str(d.correo),
          montoOferta: montoFmt,
        });
        if (montoFmt) setMonto((prev) => prev || montoFmt);
        setOfertaCargada(true);
        setOk(`Oferta leída: ${str(d.razonSocial) || "postor"} (RUC ${str(d.ruc) || "—"}). Revisa los datos extraídos.`);
      } else if (kind === "precios") {
        const items = Array.isArray(d.items) ? (d.items as Array<Record<string, unknown>>) : [];
        setPreciosItems(
          items.map((it) => ({
            concepto: str(it.concepto),
            marca: str(it.marca),
            unidad: str(it.unidad),
            cantidad: str(it.cantidad),
            precioUnitario: str(it.precioUnitario),
            precioTotal: str(it.precioTotal),
          })),
        );
        const totalStr = str(d.totalGeneral);
        const totalFmt = totalStr ? formatSoles(totalStr) : "";
        setPreciosTotalGeneral(totalFmt || totalStr);
        setPreciosCargados(true);
        // #2: Replicar el total general al monto ofertado y al monto contractual.
        if (totalFmt) {
          setMonto(totalFmt);
          setPostor((prev) => ({ ...prev, montoOferta: totalFmt }));
        }
        setOk(`Precios leídos: ${items.length} ítem(es) · Total general: ${totalFmt || "—"}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar el PDF");
    } finally {
      setSubiendo(null);
    }
  }

  const garantiaDetalle = garantiaAplica
    ? `${garantia.monto || "[monto]"}, Carta Fianza N° ${garantia.nroCartaFianza || "[...]"} emitida por ${garantia.banco || "[banco]"}, vence ${garantia.vencimiento || "[fecha]"}`
    : undefined;

  function validarYPrevisualizar() {
    setError("");
    setOk("");
    if (!proceso.denominacion.trim() && !proceso.nomenclatura.trim()) {
      setError("Sube el PDF del proceso de selección o completa la nomenclatura y el objeto.");
      return;
    }
    if (entregas.some((e) => !e.lugarEntrega.trim() || !e.plazoEntrega.trim())) {
      setError("Completa el lugar y plazo de entrega para cada armada de entrega.");
      return;
    }
    if (proceso.entidadRuc && !/^\d{11}$/.test(proceso.entidadRuc.trim())) {
      setError("El RUC de la entidad debe tener exactamente 11 dígitos.");
      return;
    }
    if (postor.ruc && !/^\d{11}$/.test(postor.ruc.trim())) {
      setError("El RUC del postor debe tener exactamente 11 dígitos.");
      return;
    }
    if (postor.docTipo === "DNI" && postor.docNumero && !/^\d{8}$/.test(postor.docNumero.trim())) {
      setError("El DNI del representante debe tener exactamente 8 dígitos.");
      return;
    }
    if (postor.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(postor.correo.trim())) {
      setError("El correo electrónico del postor no tiene un formato válido.");
      return;
    }
    const montoDigits = (monto || postor.montoOferta).replace(/[^\d.]/g, "");
    if (!montoDigits || Number(montoDigits) <= 0) {
      setError("Ingresa un monto contractual válido.");
      return;
    }
    if (garantiaAplica) {
      if (!garantia.monto || !garantia.nroCartaFianza || !garantia.banco || !garantia.vencimiento) {
        setError("Completa todos los campos de la garantía de fiel cumplimiento (monto, N° carta fianza, banco y fecha de vencimiento).");
        return;
      }
    }
    setMostrarPreview(true);
  }

  async function guardarEnDB() {
    setError(""); setOk("");
    const data = { proceso, postor, bienes, entregas, monto, numeroContrato, inicioPlazo, viciosOcultosAnios, recepcionArea, conformidadArea, plazoConformidadDias, garantiaOverride, garantia, formaPago, nroPagos, institucionArbitral, ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral };
    setGuardando(true);
    try {
      if (dbId) {
        const res = await fetch(`/api/contratos-sie/${dbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) { setError("Error al actualizar."); return; }
        setOk("Contrato actualizado.");
      } else {
        const res = await fetch("/api/contratos-sie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data,
            numero_contrato: numeroContrato.trim() || null,
            nomenclatura: proceso.nomenclatura,
            denominacion: proceso.denominacion,
            contratista: postor.razonSocial,
          }),
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
    setError(""); setOk("");
    setGuardando(true);
    try {
      const res = await fetch(`/api/contratos-sie/${dbId}`, { method: "DELETE" });
      if (!res.ok) { setError("Error al eliminar."); setGuardando(false); return; }
      setDbId(null);
      setOk("Contrato eliminado.");
      onSaved?.();
    } catch { setError("Error de conexión."); }
    setGuardando(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    borderRadius: 8,
    border: "1px solid var(--line, #e2e4ea)",
    fontSize: 13,
  };
  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 60,
    resize: "vertical",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 };

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Subasta Inversa Electrónica · Ley 32069 (2026)</p>
          <h2>Contrato SIE con proforma oficial</h2>
        </div>
        <Gavel size={22} />
      </div>

      <div className="toolBody" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Banner de borrador restaurado */}
        {showRestoreBanner ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", borderRadius: 8, background: "rgba(5,150,105,0.08)",
            color: "#047857", fontSize: 12.5, fontWeight: 500,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Save size={15} /> Borrador restaurado automaticamente. Puedes continuar editando.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{ background: "transparent", border: 0, color: "#047857", cursor: "pointer", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}
                onClick={() => setShowRestoreBanner(false)}
              >Cerrar</button>
              <button
                type="button"
                style={{ background: "transparent", border: 0, color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}
                onClick={() => { clearAutosave(); setShowRestoreBanner(false); }}
              >Descartar borrador</button>
            </div>
          </div>
        ) : null}

        {cargandoDb ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--muted, #667)" }}>
            <LoaderCircle className="spinIcon" size={20} /> Cargando contrato…
          </div>
        ) : null}

        {/* Indicador de autoguardado */}
        {savedAt ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "var(--muted, #94a3b8)", fontWeight: 500,
            alignSelf: "flex-end",
          }}>
            <Save size={11} /> Guardado automatico - {new Date(savedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : null}

        {/* Resumen de validacion - click abre la seccion */}
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          padding: "8px 12px", borderRadius: 8, background: "var(--bg, #f8fafc)",
          border: "1px solid var(--line, #e2e4ea)",
        }}>
          {[
            { key: "proceso", label: "1. Proceso" },
            { key: "postor", label: "2. Contratista" },
            { key: "precios", label: "3. Precios" },
            { key: "contrato", label: "4. Contrato" },
          ].map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() => toggleSection(sec.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "transparent", border: 0, cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "var(--ink, #1f2937)",
              }}
            >
              {sec.label}
              <SectionBadge status={validation[sec.key]} compact />
              <ChevronDown size={14} style={{ transform: expandedSections[sec.key] ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
          ))}
        </div>

        {/* ============================================ */}
        {/* 1. DATOS DEL PROCESO */}
        {/* ============================================ */}
        <Section title="1. Datos del proceso de selección" expanded={expandedSections.proceso} onToggle={() => toggleSection("proceso")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12.5, color: "var(--muted, #667)", margin: 0 }}>
              Sube la <strong>sección específica de las bases</strong> (OBJETO DE LA CONVOCATORIA con lista de bienes). La IA llena automáticamente los campos.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <BotonSubirPdf kind="proceso" label="Extraer con IA (PDF)" done={procesoCargado} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            </div>
            <Row label="Nomenclatura">
              <input style={inputStyle} value={proceso.nomenclatura} onChange={(e) => upP("nomenclatura", e.target.value)} placeholder="SUBASTA INVERSA ELECTRONICA N° 02-2026..." />
            </Row>
            <Row label="Denominación / Objeto">
              <input style={inputStyle} value={proceso.denominacion} onChange={(e) => upP("denominacion", e.target.value)} placeholder="ADQUISICIÓN DE ..." />
            </Row>
            <Row label="Entidad contratante">
              <input style={inputStyle} value={proceso.entidadNombre} onChange={(e) => upP("entidadNombre", e.target.value)} />
            </Row>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180, ...labelStyle }}>
                RUC de la entidad
                <input style={inputStyle} maxLength={11} placeholder="11 dígitos" value={proceso.entidadRuc} onChange={(e) => upP("entidadRuc", e.target.value)} />
              </div>
              <div style={{ flex: 2, minWidth: 250, ...labelStyle }}>
                Domicilio legal
                <input style={inputStyle} value={proceso.entidadDomicilio} onChange={(e) => upP("entidadDomicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Fecha de la Buena Pro">
              <input type="date" style={inputStyle} value={proceso.fechaBuenaPro} onChange={(e) => upP("fechaBuenaPro", e.target.value)} />
            </Row>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 2. DATOS DEL CONTRATISTA */}
        {/* ============================================ */}
        <Section title="2. Datos del contratista" expanded={expandedSections.postor} onToggle={() => toggleSection("postor")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12.5, color: "var(--muted, #667)", margin: 0 }}>
              Sube la <strong>oferta del ganador de la buena pro</strong> (Anexo 1 — Datos del Postor). La IA extrae sus datos para el contrato.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <BotonSubirPdf kind="oferta" label="Extraer con IA (PDF)" done={ofertaCargada} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            </div>
            <Row label="Razón social">
              <input style={inputStyle} value={postor.razonSocial} onChange={(e) => upO("razonSocial", e.target.value)} />
            </Row>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180, ...labelStyle }}>
                RUC
                <input style={inputStyle} maxLength={11} placeholder="11 dígitos" value={postor.ruc} onChange={(e) => upO("ruc", e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 180, ...labelStyle }}>
                Domicilio legal
                <input style={inputStyle} value={postor.domicilio} onChange={(e) => upO("domicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Partida registral">
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="N° de partida" value={postor.partidaRegistral} onChange={(e) => upO("partidaRegistral", e.target.value)} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Asiento" value={postor.asiento} onChange={(e) => upO("asiento", e.target.value)} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Ciudad" value={postor.ciudadRegistro} onChange={(e) => upO("ciudadRegistro", e.target.value)} />
              </div>
            </Row>
            <Row label="Representante legal">
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Nombre completo" value={postor.representante} onChange={(e) => upO("representante", e.target.value)} />
                <select style={{ ...inputStyle, flex: 1 }} value={postor.docTipo} onChange={(e) => upO("docTipo", e.target.value)}>
                  <option value="DNI">DNI</option>
                  <option value="Carné de Extranjería">Carné de Extranjería</option>
                </select>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="N° documento" value={postor.docNumero} onChange={(e) => upO("docNumero", e.target.value)} maxLength={postor.docTipo === "DNI" ? 8 : 20} />
              </div>
            </Row>
            <Row label="Monto ofertado (S/)">
              <input style={inputStyle} placeholder="S/ 0.00" value={postor.montoOferta}
                onChange={(e) => {
                  const formatted = formatSoles(e.target.value);
                  upO("montoOferta", formatted);
                  setMonto(formatted);
                }} />
            </Row>
            <Row label="Correo electrónico">
              <input type="email" style={inputStyle} placeholder="contratista@correo.com" value={postor.correo} onChange={(e) => upO("correo", e.target.value)} />
            </Row>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 3. PRECIOS UNITARIOS (opcional) */}
        {/* ============================================ */}
        <Section title="3. Detalle de precios unitarios (opcional)" expanded={expandedSections.precios} onToggle={() => toggleSection("precios")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12.5, color: "var(--muted, #667)", margin: 0 }}>
              Sube el <strong>detalle de precios unitarios del precio ofertado</strong>. La IA extrae la tabla para la cláusula de monto contractual.
            </p>
            <BotonSubirPdf kind="precios" label="Extraer con IA (PDF)" done={preciosCargados} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            {preciosItems.length > 0 && (
              <div style={{ overflowX: "auto", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg, #f8fafc)" }}>
                      {["Concepto", "Marca", "Unidad", "Cant.", "P. Unitario", "P. Total"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line, #e2e4ea)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preciosItems.map((it, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--line, #eef0f4)" }}>
                        <td style={{ padding: "4px 8px" }}>{it.concepto}</td>
                        <td style={{ padding: "4px 8px" }}>{it.marca}</td>
                        <td style={{ padding: "4px 8px" }}>{it.unidad}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>{it.cantidad}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>{it.precioUnitario}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right" }}>{it.precioTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line, #e2e4ea)" }}>
                      <td colSpan={5} style={{ padding: "6px 8px", textAlign: "right" }}>TOTAL S/</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{preciosTotalGeneral}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* ============================================ */}
        {/* 4. CONDICIONES DEL CONTRATO */}
        {/* ============================================ */}
        <Section title="4. Condiciones del contrato" expanded={expandedSections.contrato} onToggle={() => toggleSection("contrato")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="N° de contrato">
              <input style={inputStyle} value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
            </Row>
            <Row label="Monto contractual (S/)">
              <input style={inputStyle} value={monto} placeholder={postor.montoOferta || "S/ 0.00"} onChange={(e) => setMonto(formatSoles(e.target.value))} />
            </Row>
            <Row label="Forma de pago">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select style={{ ...inputStyle, width: 180 }} value={formaPago} onChange={(e) => { const v = e.target.value as "PAGO UNICO" | "PAGO A CUENTA"; setFormaPago(v); if (v === "PAGO UNICO") setNroPagos(1); else setNroPagos((n) => Math.max(2, n)); }}>
                  <option value="PAGO UNICO">Pago único</option>
                  <option value="PAGO A CUENTA">Pago a cuenta</option>
                </select>
                {formaPago === "PAGO A CUENTA" ? (
                  <>
                    <span style={{ fontSize: 12.5 }}>en</span>
                    <input type="number" min={2} max={24} style={{ ...inputStyle, width: 60 }} value={nroPagos} onChange={(e) => setNroPagos(Math.max(2, parseInt(e.target.value, 10) || 2))} />
                    <span style={{ fontSize: 12.5 }}>armadas</span>
                  </>
                ) : null}
              </div>
            </Row>
            <Row label="Inicio del plazo">
              <input style={inputStyle} value={inicioPlazo} onChange={(e) => setInicioPlazo(e.target.value)} placeholder="Ej. el día siguiente del perfeccionamiento del contrato" />
            </Row>
            <Row label="Área de recepción">
              <input style={inputStyle} value={recepcionArea} onChange={(e) => setRecepcionArea(e.target.value)} placeholder="Ej. Almacén central" />
            </Row>
            <Row label="Área de conformidad">
              <input style={inputStyle} value={conformidadArea} onChange={(e) => setConformidadArea(e.target.value)} placeholder="Ej. Área usuaria" />
            </Row>
            <Row label="Plazo de conformidad (días)">
              <input style={inputStyle} value={plazoConformidadDias} onChange={(e) => setPlazoConformidadDias(e.target.value)} placeholder="Ej. siete (7)" />
            </Row>
            <Row label="Vicios ocultos (años)">
              <input style={inputStyle} value={viciosOcultosAnios} onChange={(e) => setViciosOcultosAnios(e.target.value)} placeholder="Ej. un (1)" />
            </Row>
            <Row label="Institución arbitral">
              <select style={inputStyle} value={institucionArbitral} onChange={(e) => setInstitucionArbitral(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {INSTITUCIONES_ARBITRALES.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </Row>
            <Row label="Ciudad de firma">
              <input style={inputStyle} value={ciudadFirma} onChange={(e) => setCiudadFirma(e.target.value)} />
            </Row>
            <Row label="Fecha de firma">
              <input type="date" style={inputStyle} value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} />
            </Row>
            <Row label="Garantía de fiel cumplimiento">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <input type="checkbox" checked={garantiaAplica} onChange={(e) => setGarantiaOverride(e.target.checked)} />
                  Requiere garantía (contratos mayores a 50 UIT — art. 139.a del Reglamento)
                </label>
                {montoContractual > 0 ? (
                  <p style={{ margin: 0, fontSize: 12, padding: "4px 10px", borderRadius: 6, background: superaUmbral ? "rgba(234, 88, 12, 0.08)" : "rgba(5, 150, 105, 0.08)", color: superaUmbral ? "#c2410c" : "#047857", fontWeight: 500 }}>
                    {superaUmbral
                      ? `⚠ El monto contractual (${formatSoles(String(montoContractual))}) supera 50 UIT (S/ ${UMBRAL_GARANTIA.toLocaleString("es-PE")}). La garantía es obligatoria.`
                      : `✓ El monto (${formatSoles(String(montoContractual))}) no supera 50 UIT (S/ ${UMBRAL_GARANTIA.toLocaleString("es-PE")}). Garantía no obligatoria.`}
                  </p>
                ) : null}
              </div>
            </Row>
            {garantiaAplica ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: "var(--bg, #f8fafc)", borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 160, ...labelStyle }}>
                  Monto (S/)
                  <input style={inputStyle} value={garantia.monto} placeholder="S/ 0.00" onChange={(e) => upG("monto", formatSoles(e.target.value))} />
                </div>
                <div style={{ flex: 1, minWidth: 160, ...labelStyle }}>
                  N° Carta Fianza
                  <input style={inputStyle} value={garantia.nroCartaFianza} onChange={(e) => upG("nroCartaFianza", e.target.value)} placeholder="Ej. 2026-00123" />
                </div>
                <div style={{ flex: 1, minWidth: 160, ...labelStyle }}>
                  Banco emisor
                  <input style={inputStyle} value={garantia.banco} onChange={(e) => upG("banco", e.target.value)} placeholder="Ej. Banco de la Nación" />
                </div>
                <div style={{ flex: 1, minWidth: 160, ...labelStyle }}>
                  Vencimiento
                  <input type="date" style={inputStyle} value={garantia.vencimiento} onChange={(e) => upG("vencimiento", e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          {/* Cronograma de entrega con lugar y plazo por armada */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>
                Cronograma de entrega
                {formaPago === "PAGO A CUENTA" && nroPagos > 1 ? ` - ${nroPagos} armadas` : " - entrega unica"}
              </strong>
              <button type="button" className="secondaryButton" style={{ fontSize: 12, padding: "3px 10px" }}
                onClick={() => setBienes((r) => [...r, { paquete: String(r.length + 1), descripcion: "", marca: "", unidad: "", cantidad: "", entrega: "", nroEntrega: 1 }])}>
                <Plus size={13} /> Agregar bien
              </button>
            </div>
            {bienes.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted, #667)", margin: 0 }}>
                Se carga automáticamente con la lista de bienes del <strong>OBJETO DE LA CONVOCATORIA</strong> al subir el PDF del proceso (paso 1). También puedes agregar filas a mano.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {entregas.map((ent) => {
                  const grupo = bienes.filter((b) => b.nroEntrega === ent.nro);
                  const isMulti = nroPagos > 1;
                  return (
                    <div key={ent.nro}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand, #0f766e)"; }}
                      onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--line, #e2e4ea)"; }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--line, #e2e4ea)"; const idx = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(idx)) upBien(idx, "nroEntrega", ent.nro); }}
                      style={{ border: "2px dashed var(--line, #e2e4ea)", borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg, #f8fafc)", borderBottom: "1px solid var(--line, #e2e4ea)" }}>
                        <strong style={{ fontSize: 13 }}>
                          {isMulti ? `Entrega ${ent.nro} de ${nroPagos}` : "Entrega única"}
                          {" - "}
                          <span style={{ fontSize: 11.5, color: "var(--muted, #667)" }}>{grupo.length} bien(es)</span>
                        </strong>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, padding: "10px 12px" }}>
                        <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Lugar de entrega {isMulti ? `(armada ${ent.nro})` : ""} *
                          <textarea style={{ ...textareaStyle, minHeight: 40 }} value={ent.lugarEntrega}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, lugarEntrega: e.target.value } : p))}
                            placeholder="Ej. Almacén central de la Municipalidad..." />
                        </label>
                        <label style={labelStyle}>Plazo de entrega {isMulti ? `(armada ${ent.nro})` : ""} *
                          <input style={inputStyle} value={ent.plazoEntrega}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, plazoEntrega: e.target.value } : p))}
                            placeholder="Ej. quince (15)" />
                        </label>
                        <label style={labelStyle}>Tipo de días
                          <select style={inputStyle} value={ent.tipoDias}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, tipoDias: e.target.value as "habil" | "calendario" } : p))}>
                            <option value="calendario">Días calendario</option>
                            <option value="habil">Días hábiles</option>
                          </select>
                        </label>
                        {isMulti ? (
                          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                            <span style={{ fontSize: 11.5, color: "var(--muted, #667)" }}>
                              Arrastra bienes desde otra entrega hacia esta zona para asignarlos a la armada {ent.nro}.
                            </span>
                          </label>
                        ) : null}
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: "var(--bg, #f8fafc)" }}>
                              {["Paquete", "Descripción", "Marca", "Unidad", "Cantidad", isMulti ? "Mover a" : "", ""].filter(Boolean).map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line, #e2e4ea)", fontWeight: 600 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.length === 0 ? (
                              <tr>
                                <td colSpan={isMulti ? 7 : 6} style={{ padding: "10px 8px", textAlign: "center", color: "var(--muted, #94a3b8)", fontSize: 12, fontStyle: "italic" }}>
                                  {isMulti ? "Arrastra bienes aquí o usa el selector para asignarlos a esta armada." : "Aún no hay bienes. Agrega uno con el botón de arriba."}
                                </td>
                              </tr>
                            ) : grupo.map((b) => {
                              const globalIdx = bienes.indexOf(b);
                              return (
                                <tr key={globalIdx} draggable
                                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(globalIdx)); e.dataTransfer.effectAllowed = "move"; }}
                                  style={{ borderBottom: "1px solid var(--line, #eef0f4)", cursor: isMulti ? "grab" : "default", opacity: 0.9 }}>
                                  <td style={{ padding: 4, width: 70 }}><input style={inputStyle} value={b.paquete} onChange={(e) => upBien(globalIdx, "paquete", e.target.value)} /></td>
                                  <td style={{ padding: 4 }}><input style={inputStyle} value={b.descripcion} onChange={(e) => upBien(globalIdx, "descripcion", e.target.value)} /></td>
                                  <td style={{ padding: 4, width: 120 }}><input style={inputStyle} value={b.marca} onChange={(e) => upBien(globalIdx, "marca", e.target.value)} /></td>
                                  <td style={{ padding: 4, width: 120 }}><input style={inputStyle} value={b.unidad} onChange={(e) => upBien(globalIdx, "unidad", e.target.value)} /></td>
                                  <td style={{ padding: 4, width: 100 }}><input style={inputStyle} value={b.cantidad} onChange={(e) => upBien(globalIdx, "cantidad", e.target.value)} /></td>
                                  {isMulti ? (
                                    <td style={{ padding: 4, width: 110 }}>
                                      <select style={inputStyle} value={b.nroEntrega} onChange={(e) => upBien(globalIdx, "nroEntrega", parseInt(e.target.value, 10))}>
                                        {entregas.map((p) => (<option key={p.nro} value={p.nro}>Entrega {p.nro}</option>))}
                                      </select>
                                    </td>
                                  ) : null}
                                  <td style={{ padding: 4, width: isMulti ? 80 : 36, whiteSpace: "nowrap" }}>
                                    {isMulti ? (
                                      <button type="button" aria-label="Duplicar" title="Distribuir este bien entre todas las entregas" onClick={() => duplicar(globalIdx)} style={{ background: "transparent", border: 0, cursor: "pointer", color: "#0f766e", display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}>
                                        <Copy size={15} />
                                      </button>
                                    ) : null}
                                    <button type="button" aria-label="Quitar bien" onClick={() => setBienes((r) => r.filter((_, idx) => idx !== globalIdx))} style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c0392b", display: "inline-flex", verticalAlign: "middle" }}>
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        <div className="formActions">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            {/* Selector de formato */}
            <div style={{ display: "flex", border: "1px solid var(--line, #e2e4ea)", borderRadius: 6, overflow: "hidden" }}>
              <button type="button" onClick={() => setFormato("docx")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: formato === "docx" ? 700 : 400, background: formato === "docx" ? "var(--brand, #0f766e)" : "transparent", color: formato === "docx" ? "#fff" : "var(--text, #222)", border: 0, cursor: "pointer" }}>DOCX</button>
              <button type="button" onClick={() => setFormato("pdf")} style={{ padding: "6px 12px", fontSize: 12, fontWeight: formato === "pdf" ? 700 : 400, background: formato === "pdf" ? "var(--brand, #0f766e)" : "transparent", color: formato === "pdf" ? "#fff" : "var(--text, #222)", border: 0, cursor: "pointer" }}>PDF</button>
            </div>
            {/* Guardar borrador (localStorage) */}
            <button type="button" className="secondaryButton" disabled={guardando} onClick={async () => {
              setGuardando(true); setError("");
              try {
                const entry = { data: { proceso, postor, bienes, entregas, monto, numeroContrato, inicioPlazo, viciosOcultosAnios, recepcionArea, conformidadArea, plazoConformidadDias, garantiaOverride, garantia, formaPago, nroPagos, institucionArbitral, ciudadFirma, fechaFirma, preciosItems, preciosTotalGeneral }, savedAt: Date.now() };
                localStorage.setItem("contrato-sie-borrador", JSON.stringify(entry));
                setOk("Borrador guardado.");
              } catch { setError("No se pudo guardar el borrador."); } finally { setGuardando(false); }
            }}>
              <Save size={15} /> {guardando ? "Guardando…" : "Guardar borrador"}
            </button>
            {/* Guardar en DB */}
            <button type="button" className="secondaryButton" disabled={guardando} onClick={guardarEnDB}>
              <Database size={15} /> {guardando ? "Guardando…" : dbId ? "Actualizar" : "Guardar en DB"}
            </button>
            {dbId ? (
              <button type="button" className="secondaryButton" style={{ color: "#c0392b" }} disabled={guardando} onClick={eliminarDeDB}>
                <Trash2 size={15} /> Eliminar
              </button>
            ) : null}
          </div>
          <button className="primaryButton" type="button" disabled={Boolean(subiendo)} onClick={validarYPrevisualizar}>
            <FileText size={18} /> Vista previa del contrato
          </button>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
        {ok ? <p className="formMessage">{ok}</p> : null}
      </div>

      <VistaPreviaContrato
        open={mostrarPreview}
        onClose={() => setMostrarPreview(false)}
        numeroContrato={numeroContrato}
        proceso={proceso}
        postor={postor}
        monto={monto}
        formaPago={formaPago}
        nroPagos={nroPagos}
        entregas={entregas}
        inicioPlazo={inicioPlazo}
        bienes={bienes}
        preciosItems={preciosItems}
        preciosTotalGeneral={preciosTotalGeneral}
        garantiaAplica={garantiaAplica}
        garantiaDetalle={garantiaDetalle}
        garantia={garantia}
        viciosOcultosAnios={viciosOcultosAnios}
        institucionArbitral={institucionArbitral}
        recepcionArea={recepcionArea}
        conformidadArea={conformidadArea}
        plazoConformidadDias={plazoConformidadDias}
        ciudadFirma={ciudadFirma}
        fechaFirma={fechaFirma}
        formato={formato}
      />
    </div>
  );
}
