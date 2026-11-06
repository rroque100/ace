"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Database, FileText, FileUp, Gavel, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useSettingsCatalog } from "./use-settings-catalog";
import { VistaPreviaContrato } from "./contrato-sie-preview";
import { useAutoSave } from "./contrato-sie-autosave";
import { useContratoValidation } from "./contrato-sie-validation";
import { SectionBadge } from "./contrato-sie-section-badge";
import { parseSoles } from "@/lib/parse-soles";
import { cn } from "@/lib/utils";

// Estilos migrados de inline a utilidades. El formulario no vive dentro de un
// contenedor `.tw` (aún usa clases compartidas: toolPanel, secondaryButton,
// formMessage…, que el reset de `.tw` rompería), así que los bordes llevan
// `border-solid`/`border-dashed` explícitos —lo que `.tw` aportaría—. El campo
// NO lleva box-border: el inline original era content-box (sin boxSizing).
const INPUT = "w-full rounded-md border border-solid border-line px-[9px] py-[7px] text-[13px]";
const TEXTAREA = cn(INPUT, "min-h-[60px] resize-y [font-family:inherit]");
const LABEL = "flex flex-col gap-1 text-[12.5px] font-semibold";

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
      className={cn("secondaryButton inline-flex items-center gap-1.5", subiendo ? "cursor-wait" : "cursor-pointer")}
    >
      {subiendo === kind ? (
        <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={16} />
      ) : done ? (
        <CheckCircle2 size={16} className="text-success" />
      ) : (
        <FileUp size={16} />
      )}
      {subiendo === kind ? "Leyendo con IA…" : label}
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
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
    <div className="flex flex-wrap items-start gap-2">
      <span className="min-w-[180px] pt-1.5 text-[12.5px] font-semibold">{label}</span>
      <div className="min-w-[200px] flex-1">{children}</div>
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: { title: string; expanded?: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-solid border-line bg-panel p-4">
      <button type="button" onClick={onToggle} className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-sm font-bold text-brand">
        {title}
        <ChevronDown size={18} className={cn("transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      {expanded !== false ? <div className="mt-3">{children}</div> : null}
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

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Subasta Inversa Electrónica · Ley 32069 (2026)</p>
          <h2>Contrato SIE con proforma oficial</h2>
        </div>
        <Gavel size={22} />
      </div>

      <div className="toolBody flex flex-col gap-4">
        {/* Banner de borrador restaurado */}
        {showRestoreBanner ? (
          <div className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-[12.5px] font-medium text-success">
            <span className="flex items-center gap-1.5">
              <Save size={15} /> Borrador restaurado automaticamente. Puedes continuar editando.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-success underline"
                onClick={() => setShowRestoreBanner(false)}
              >Cerrar</button>
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-danger underline"
                onClick={() => { clearAutosave(); setShowRestoreBanner(false); }}
              >Descartar borrador</button>
            </div>
          </div>
        ) : null}

        {cargandoDb ? (
          <div className="p-5 text-center text-[13px] text-muted">
            <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={20} /> Cargando contrato…
          </div>
        ) : null}

        {/* Indicador de autoguardado */}
        {savedAt ? (
          <div className="flex items-center gap-1 self-end text-[11px] font-medium text-muted">
            <Save size={11} /> Guardado automatico - {new Date(savedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        ) : null}

        {/* Resumen de validacion - click abre la seccion */}
        <div className="flex flex-wrap gap-2 rounded-md border border-solid border-line bg-canvas px-3 py-2">
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
              className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-xs font-semibold text-ink"
            >
              {sec.label}
              <SectionBadge status={validation[sec.key]} compact />
              <ChevronDown size={14} className={cn("transition-transform duration-150", expandedSections[sec.key] && "rotate-180")} />
            </button>
          ))}
        </div>

        {/* ============================================ */}
        {/* 1. DATOS DEL PROCESO */}
        {/* ============================================ */}
        <Section title="1. Datos del proceso de selección" expanded={expandedSections.proceso} onToggle={() => toggleSection("proceso")}>
          <div className="flex flex-col gap-2.5">
            <p className="m-0 text-[12.5px] text-muted">
              Sube la <strong>sección específica de las bases</strong> (OBJETO DE LA CONVOCATORIA con lista de bienes). La IA llena automáticamente los campos.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BotonSubirPdf kind="proceso" label="Extraer con IA (PDF)" done={procesoCargado} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            </div>
            <Row label="Nomenclatura">
              <input className={INPUT} value={proceso.nomenclatura} onChange={(e) => upP("nomenclatura", e.target.value)} placeholder="SUBASTA INVERSA ELECTRONICA N° 02-2026..." />
            </Row>
            <Row label="Denominación / Objeto">
              <input className={INPUT} value={proceso.denominacion} onChange={(e) => upP("denominacion", e.target.value)} placeholder="ADQUISICIÓN DE ..." />
            </Row>
            <Row label="Entidad contratante">
              <input className={INPUT} value={proceso.entidadNombre} onChange={(e) => upP("entidadNombre", e.target.value)} />
            </Row>
            <div className="flex flex-wrap gap-2.5">
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                RUC de la entidad
                <input className={INPUT} maxLength={11} placeholder="11 dígitos" value={proceso.entidadRuc} onChange={(e) => upP("entidadRuc", e.target.value)} />
              </div>
              <div className={cn(LABEL, "min-w-[250px] flex-[2]")}>
                Domicilio legal
                <input className={INPUT} value={proceso.entidadDomicilio} onChange={(e) => upP("entidadDomicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Fecha de la Buena Pro">
              <input type="date" className={INPUT} value={proceso.fechaBuenaPro} onChange={(e) => upP("fechaBuenaPro", e.target.value)} />
            </Row>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 2. DATOS DEL CONTRATISTA */}
        {/* ============================================ */}
        <Section title="2. Datos del contratista" expanded={expandedSections.postor} onToggle={() => toggleSection("postor")}>
          <div className="flex flex-col gap-2.5">
            <p className="m-0 text-[12.5px] text-muted">
              Sube la <strong>oferta del ganador de la buena pro</strong> (Anexo 1 — Datos del Postor). La IA extrae sus datos para el contrato.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BotonSubirPdf kind="oferta" label="Extraer con IA (PDF)" done={ofertaCargada} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            </div>
            <Row label="Razón social">
              <input className={INPUT} value={postor.razonSocial} onChange={(e) => upO("razonSocial", e.target.value)} />
            </Row>
            <div className="flex flex-wrap gap-2.5">
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                RUC
                <input className={INPUT} maxLength={11} placeholder="11 dígitos" value={postor.ruc} onChange={(e) => upO("ruc", e.target.value)} />
              </div>
              <div className={cn(LABEL, "min-w-[180px] flex-1")}>
                Domicilio legal
                <input className={INPUT} value={postor.domicilio} onChange={(e) => upO("domicilio", e.target.value)} />
              </div>
            </div>
            <Row label="Partida registral">
              <div className="flex gap-2">
                <input className={cn(INPUT, "flex-1")} placeholder="N° de partida" value={postor.partidaRegistral} onChange={(e) => upO("partidaRegistral", e.target.value)} />
                <input className={cn(INPUT, "flex-1")} placeholder="Asiento" value={postor.asiento} onChange={(e) => upO("asiento", e.target.value)} />
                <input className={cn(INPUT, "flex-1")} placeholder="Ciudad" value={postor.ciudadRegistro} onChange={(e) => upO("ciudadRegistro", e.target.value)} />
              </div>
            </Row>
            <Row label="Representante legal">
              <div className="flex gap-2">
                <input className={cn(INPUT, "flex-[2]")} placeholder="Nombre completo" value={postor.representante} onChange={(e) => upO("representante", e.target.value)} />
                <select className={cn(INPUT, "flex-1")} value={postor.docTipo} onChange={(e) => upO("docTipo", e.target.value)}>
                  <option value="DNI">DNI</option>
                  <option value="Carné de Extranjería">Carné de Extranjería</option>
                </select>
                <input className={cn(INPUT, "flex-1")} placeholder="N° documento" value={postor.docNumero} onChange={(e) => upO("docNumero", e.target.value)} maxLength={postor.docTipo === "DNI" ? 8 : 20} />
              </div>
            </Row>
            <Row label="Monto ofertado (S/)">
              <input className={INPUT} placeholder="S/ 0.00" value={postor.montoOferta}
                onChange={(e) => {
                  const formatted = formatSoles(e.target.value);
                  upO("montoOferta", formatted);
                  setMonto(formatted);
                }} />
            </Row>
            <Row label="Correo electrónico">
              <input type="email" className={INPUT} placeholder="contratista@correo.com" value={postor.correo} onChange={(e) => upO("correo", e.target.value)} />
            </Row>
          </div>
        </Section>

        {/* ============================================ */}
        {/* 3. PRECIOS UNITARIOS (opcional) */}
        {/* ============================================ */}
        <Section title="3. Detalle de precios unitarios (opcional)" expanded={expandedSections.precios} onToggle={() => toggleSection("precios")}>
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[12.5px] text-muted">
              Sube el <strong>detalle de precios unitarios del precio ofertado</strong>. La IA extrae la tabla para la cláusula de monto contractual.
            </p>
            <BotonSubirPdf kind="precios" label="Extraer con IA (PDF)" done={preciosCargados} subiendo={subiendo} onFile={(f, k) => void extraer(f, k)} />
            {preciosItems.length > 0 && (
              <div className="mt-1 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-canvas">
                      {["Concepto", "Marca", "Unidad", "Cant.", "P. Unitario", "P. Total"].map((h) => (
                        <th key={h} className="border-b border-solid border-line px-2 py-1.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preciosItems.map((it, i) => (
                      <tr key={i} className="border-b border-solid border-line-soft">
                        <td className="px-2 py-1">{it.concepto}</td>
                        <td className="px-2 py-1">{it.marca}</td>
                        <td className="px-2 py-1">{it.unidad}</td>
                        <td className="px-2 py-1 text-right">{it.cantidad}</td>
                        <td className="px-2 py-1 text-right">{it.precioUnitario}</td>
                        <td className="px-2 py-1 text-right">{it.precioTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-solid border-line font-bold">
                      <td colSpan={5} className="px-2 py-1.5 text-right">TOTAL S/</td>
                      <td className="px-2 py-1.5 text-right">{preciosTotalGeneral}</td>
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
          <div className="flex flex-col gap-2.5">
            <Row label="N° de contrato">
              <input className={INPUT} value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
            </Row>
            <Row label="Monto contractual (S/)">
              <input className={INPUT} value={monto} placeholder={postor.montoOferta || "S/ 0.00"} onChange={(e) => setMonto(formatSoles(e.target.value))} />
            </Row>
            <Row label="Forma de pago">
              <div className="flex items-center gap-2">
                <select className={cn(INPUT, "w-[180px]")} value={formaPago} onChange={(e) => { const v = e.target.value as "PAGO UNICO" | "PAGO A CUENTA"; setFormaPago(v); if (v === "PAGO UNICO") setNroPagos(1); else setNroPagos((n) => Math.max(2, n)); }}>
                  <option value="PAGO UNICO">Pago único</option>
                  <option value="PAGO A CUENTA">Pago a cuenta</option>
                </select>
                {formaPago === "PAGO A CUENTA" ? (
                  <>
                    <span className="text-[12.5px]">en</span>
                    <input type="number" min={2} max={24} className={cn(INPUT, "w-[60px]")} value={nroPagos} onChange={(e) => setNroPagos(Math.max(2, parseInt(e.target.value, 10) || 2))} />
                    <span className="text-[12.5px]">armadas</span>
                  </>
                ) : null}
              </div>
            </Row>
            <Row label="Inicio del plazo">
              <input className={INPUT} value={inicioPlazo} onChange={(e) => setInicioPlazo(e.target.value)} placeholder="Ej. el día siguiente del perfeccionamiento del contrato" />
            </Row>
            <Row label="Área de recepción">
              <input className={INPUT} value={recepcionArea} onChange={(e) => setRecepcionArea(e.target.value)} placeholder="Ej. Almacén central" />
            </Row>
            <Row label="Área de conformidad">
              <input className={INPUT} value={conformidadArea} onChange={(e) => setConformidadArea(e.target.value)} placeholder="Ej. Área usuaria" />
            </Row>
            <Row label="Plazo de conformidad (días)">
              <input className={INPUT} value={plazoConformidadDias} onChange={(e) => setPlazoConformidadDias(e.target.value)} placeholder="Ej. siete (7)" />
            </Row>
            <Row label="Vicios ocultos (años)">
              <input className={INPUT} value={viciosOcultosAnios} onChange={(e) => setViciosOcultosAnios(e.target.value)} placeholder="Ej. un (1)" />
            </Row>
            <Row label="Institución arbitral">
              <select className={INPUT} value={institucionArbitral} onChange={(e) => setInstitucionArbitral(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {INSTITUCIONES_ARBITRALES.map((inst) => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </Row>
            <Row label="Ciudad de firma">
              <input className={INPUT} value={ciudadFirma} onChange={(e) => setCiudadFirma(e.target.value)} />
            </Row>
            <Row label="Fecha de firma">
              <input type="date" className={INPUT} value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} />
            </Row>
            <Row label="Garantía de fiel cumplimiento">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={garantiaAplica} onChange={(e) => setGarantiaOverride(e.target.checked)} />
                  Requiere garantía (contratos mayores a 50 UIT — art. 139.a del Reglamento)
                </label>
                {montoContractual > 0 ? (
                  <p className={cn("m-0 rounded-sm px-2.5 py-1 text-xs font-medium", superaUmbral ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                    {superaUmbral
                      ? `⚠ El monto contractual (${formatSoles(String(montoContractual))}) supera 50 UIT (S/ ${UMBRAL_GARANTIA.toLocaleString("es-PE")}). La garantía es obligatoria.`
                      : `✓ El monto (${formatSoles(String(montoContractual))}) no supera 50 UIT (S/ ${UMBRAL_GARANTIA.toLocaleString("es-PE")}). Garantía no obligatoria.`}
                  </p>
                ) : null}
              </div>
            </Row>
            {garantiaAplica ? (
              <div className="flex flex-wrap gap-2.5 rounded-md bg-canvas px-3 py-2.5">
                <div className={cn(LABEL, "min-w-[160px] flex-1")}>
                  Monto (S/)
                  <input className={INPUT} value={garantia.monto} placeholder="S/ 0.00" onChange={(e) => upG("monto", formatSoles(e.target.value))} />
                </div>
                <div className={cn(LABEL, "min-w-[160px] flex-1")}>
                  N° Carta Fianza
                  <input className={INPUT} value={garantia.nroCartaFianza} onChange={(e) => upG("nroCartaFianza", e.target.value)} placeholder="Ej. 2026-00123" />
                </div>
                <div className={cn(LABEL, "min-w-[160px] flex-1")}>
                  Banco emisor
                  <input className={INPUT} value={garantia.banco} onChange={(e) => upG("banco", e.target.value)} placeholder="Ej. Banco de la Nación" />
                </div>
                <div className={cn(LABEL, "min-w-[160px] flex-1")}>
                  Vencimiento
                  <input type="date" className={INPUT} value={garantia.vencimiento} onChange={(e) => upG("vencimiento", e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          {/* Cronograma de entrega con lugar y plazo por armada */}
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <strong className="text-[13px]">
                Cronograma de entrega
                {formaPago === "PAGO A CUENTA" && nroPagos > 1 ? ` - ${nroPagos} armadas` : " - entrega unica"}
              </strong>
              <button type="button" className="secondaryButton px-2.5 py-0.5 text-xs"
                onClick={() => setBienes((r) => [...r, { paquete: String(r.length + 1), descripcion: "", marca: "", unidad: "", cantidad: "", entrega: "", nroEntrega: 1 }])}>
                <Plus size={13} /> Agregar bien
              </button>
            </div>
            {bienes.length === 0 ? (
              <p className="m-0 text-[12.5px] text-muted">
                Se carga automáticamente con la lista de bienes del <strong>OBJETO DE LA CONVOCATORIA</strong> al subir el PDF del proceso (paso 1). También puedes agregar filas a mano.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {entregas.map((ent) => {
                  const grupo = bienes.filter((b) => b.nroEntrega === ent.nro);
                  const isMulti = nroPagos > 1;
                  return (
                    // El resaltado al arrastrar sigue siendo inline (borderColor dinámico
                    // en los handlers); la base es la utilidad border-dashed border-line.
                    <div key={ent.nro}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand)"; }}
                      onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--line)"; const idx = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(idx)) upBien(idx, "nroEntrega", ent.nro); }}
                      className="overflow-hidden rounded-[10px] border-2 border-dashed border-line transition-[border-color] duration-150">
                      <div className="flex items-center justify-between border-b border-solid border-line bg-canvas px-3 py-2">
                        <strong className="text-[13px]">
                          {isMulti ? `Entrega ${ent.nro} de ${nroPagos}` : "Entrega única"}
                          {" - "}
                          <span className="text-[11.5px] text-muted">{grupo.length} bien(es)</span>
                        </strong>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 px-3 py-2.5">
                        <label className={cn(LABEL, "col-span-full")}>Lugar de entrega {isMulti ? `(armada ${ent.nro})` : ""} *
                          <textarea className={cn(TEXTAREA, "min-h-[40px]")} value={ent.lugarEntrega}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, lugarEntrega: e.target.value } : p))}
                            placeholder="Ej. Almacén central de la Municipalidad..." />
                        </label>
                        <label className={LABEL}>Plazo de entrega {isMulti ? `(armada ${ent.nro})` : ""} *
                          <input className={INPUT} value={ent.plazoEntrega}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, plazoEntrega: e.target.value } : p))}
                            placeholder="Ej. quince (15)" />
                        </label>
                        <label className={LABEL}>Tipo de días
                          <select className={INPUT} value={ent.tipoDias}
                            onChange={(e) => setEntregas((prev) => prev.map((p) => p.nro === ent.nro ? { ...p, tipoDias: e.target.value as "habil" | "calendario" } : p))}>
                            <option value="calendario">Días calendario</option>
                            <option value="habil">Días hábiles</option>
                          </select>
                        </label>
                        {isMulti ? (
                          <label className={cn(LABEL, "col-span-full")}>
                            <span className="text-[11.5px] text-muted">
                              Arrastra bienes desde otra entrega hacia esta zona para asignarlos a la armada {ent.nro}.
                            </span>
                          </label>
                        ) : null}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[12.5px]">
                          <thead>
                            <tr className="bg-canvas">
                              {["Paquete", "Descripción", "Marca", "Unidad", "Cantidad", isMulti ? "Mover a" : "", ""].filter(Boolean).map((h) => (
                                <th key={h} className="border-b border-solid border-line px-2 py-1.5 text-left font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.length === 0 ? (
                              <tr>
                                <td colSpan={isMulti ? 7 : 6} className="px-2 py-2.5 text-center text-xs italic text-muted">
                                  {isMulti ? "Arrastra bienes aquí o usa el selector para asignarlos a esta armada." : "Aún no hay bienes. Agrega uno con el botón de arriba."}
                                </td>
                              </tr>
                            ) : grupo.map((b) => {
                              const globalIdx = bienes.indexOf(b);
                              return (
                                <tr key={globalIdx} draggable
                                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(globalIdx)); e.dataTransfer.effectAllowed = "move"; }}
                                  className={cn("border-b border-solid border-line-soft opacity-90", isMulti ? "cursor-grab" : "cursor-default")}>
                                  <td className="w-[70px] p-1"><input className={INPUT} value={b.paquete} onChange={(e) => upBien(globalIdx, "paquete", e.target.value)} /></td>
                                  <td className="p-1"><input className={INPUT} value={b.descripcion} onChange={(e) => upBien(globalIdx, "descripcion", e.target.value)} /></td>
                                  <td className="w-[120px] p-1"><input className={INPUT} value={b.marca} onChange={(e) => upBien(globalIdx, "marca", e.target.value)} /></td>
                                  <td className="w-[120px] p-1"><input className={INPUT} value={b.unidad} onChange={(e) => upBien(globalIdx, "unidad", e.target.value)} /></td>
                                  <td className="w-[100px] p-1"><input className={INPUT} value={b.cantidad} onChange={(e) => upBien(globalIdx, "cantidad", e.target.value)} /></td>
                                  {isMulti ? (
                                    <td className="w-[110px] p-1">
                                      <select className={INPUT} value={b.nroEntrega} onChange={(e) => upBien(globalIdx, "nroEntrega", parseInt(e.target.value, 10))}>
                                        {entregas.map((p) => (<option key={p.nro} value={p.nro}>Entrega {p.nro}</option>))}
                                      </select>
                                    </td>
                                  ) : null}
                                  <td className={cn("whitespace-nowrap p-1", isMulti ? "w-20" : "w-9")}>
                                    {isMulti ? (
                                      <button type="button" aria-label="Duplicar" title="Distribuir este bien entre todas las entregas" onClick={() => duplicar(globalIdx)} className="mr-1 inline-flex cursor-pointer border-0 bg-transparent align-middle text-brand">
                                        <Copy size={15} />
                                      </button>
                                    ) : null}
                                    <button type="button" aria-label="Quitar bien" onClick={() => setBienes((r) => r.filter((_, idx) => idx !== globalIdx))} className="inline-flex cursor-pointer border-0 bg-transparent align-middle text-danger">
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
          <div className="flex flex-1 items-center gap-2">
            {/* Selector de formato */}
            <div className="flex overflow-hidden rounded-sm border border-solid border-line">
              <button type="button" onClick={() => setFormato("docx")} className={cn("cursor-pointer border-0 px-3 py-1.5 text-xs", formato === "docx" ? "bg-brand font-bold text-white" : "bg-transparent font-normal text-ink")}>DOCX</button>
              <button type="button" onClick={() => setFormato("pdf")} className={cn("cursor-pointer border-0 px-3 py-1.5 text-xs", formato === "pdf" ? "bg-brand font-bold text-white" : "bg-transparent font-normal text-ink")}>PDF</button>
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
              <button type="button" className="secondaryButton text-danger" disabled={guardando} onClick={eliminarDeDB}>
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
