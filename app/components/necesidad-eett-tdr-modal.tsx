"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Loader,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { Necesidad } from "@/lib/necesidades";
import { numeroDesdeTexto, TrasladoPanel, type GrupoTraslado } from "./necesidad-traslado-panel";
import { Button, IconButton } from "./ui/button";
import { Alert } from "./ui/alert";
import { cn } from "@/lib/utils";

// Modal de revisión del EETT/TDR: visor del PDF subido a un lado y, al otro, la
// PROPUESTA generada por IA (conforme al modelo OECE del proceso) + la REVISIÓN
// (qué cumple/falta/corregir, justificado). La edición fina se hace descargando
// el .docx (Word). No hay editor embebido.

export type EettTdrDoc = { id: string; tipo: "eett" | "tdr"; file_name: string };
type Hallazgo = {
  tipo: "cumple" | "falta" | "corregir";
  pagina?: string;
  ubicacion: string;
  observacion: string;
  deberiaDecir: string;
  propuesta: string;
  justificacion: string;
};
export type EettPropuesta = {
  contenido: string;
  usoModelo?: boolean;
  generadoEn?: string;
};
export type EettRevision = {
  resumen: string;
  hallazgos: Hallazgo[];
  revisadoEn?: string;
  conteo?: { cumple: number; falta: number; corregir: number };
  veredicto?: "apto" | "requiere_subsanacion";
};

// Color por tipo de hallazgo como clases utilitarias (antes era un hex): `texto`
// para la etiqueta y «Debería decir», `bordeL` para el borde izquierdo de la tarjeta.
const HALLAZGO_META: Record<Hallazgo["tipo"], { label: string; texto: string; bordeL: string }> = {
  cumple: { label: "Cumple", texto: "text-success", bordeL: "border-l-success" },
  falta: { label: "Falta", texto: "text-warning", bordeL: "border-l-warning" },
  corregir: { label: "Corregir", texto: "text-danger", bordeL: "border-l-danger" },
};

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inlineMd = (s: string) =>
  escHtml(s.replace(/<u>(.+?)<\/u>/gi, "__$1__"))
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<u>$1</u>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>");

const esFilaTablaMd = (t: string) => t.startsWith("|") && t.endsWith("|") && t.length > 2;
const esSeparadorTablaMd = (t: string) =>
  t.replace(/^\|/, "").replace(/\|$/, "").split("|").every((c) => /^[\s:-]*$/.test(c) && c.includes("-"));
const celdasMd = (f: string) => f.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** Markdown (títulos, viñetas, numeración, tablas, [IMAGEN: …]) → HTML para previsualizar. */
function markdownToHtml(md: string): string {
  const lineas = (md ?? "").split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const cerrarLista = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  let i = 0;
  while (i < lineas.length) {
    const t = lineas[i].trim();
    // Cuadro de imagen (placeholder).
    const img = t.match(/^\[\s*IMAGEN\s*:?\s*(.*?)\s*\]$/i);
    if (img) {
      cerrarLista();
      out.push(
        `<div style="border:1px dashed var(--muted);border-radius:6px;padding:18px;text-align:center;color:var(--muted);font-style:italic;margin:8px 0">🖼 Espacio para imagen${img[1] ? ` · ${escHtml(img[1])}` : ""}</div>`,
      );
      i += 1;
      continue;
    }
    // Tabla.
    if (esFilaTablaMd(t)) {
      const filas: string[] = [];
      while (i < lineas.length && esFilaTablaMd(lineas[i].trim())) {
        filas.push(lineas[i].trim());
        i += 1;
      }
      const datos = filas.filter((f) => !esSeparadorTablaMd(f));
      if (datos.length >= 1) {
        cerrarLista();
        const th = celdasMd(datos[0]).map((c) => `<th style="border:1px solid var(--muted);padding:4px 6px;text-align:left;background:color-mix(in srgb,var(--muted) 10%,transparent)">${inlineMd(c)}</th>`).join("");
        const trs = datos.slice(1).map((f) => `<tr>${celdasMd(f).map((c) => `<td style="border:1px solid var(--muted);padding:4px 6px">${inlineMd(c)}</td>`).join("")}</tr>`).join("");
        out.push(`<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:12px"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
        continue;
      }
    }
    if (/^###\s+/.test(t)) {
      cerrarLista();
      out.push(`<h4 style="margin:10px 0 4px">${inlineMd(t.replace(/^###\s+/, ""))}</h4>`);
    } else if (/^#{1,2}\s+/.test(t)) {
      cerrarLista();
      out.push(`<h3 style="margin:14px 0 6px">${inlineMd(t.replace(/^#{1,2}\s+/, ""))}</h3>`);
    } else if (/^[-•*]\s+/.test(t)) {
      if (!inList) {
        out.push('<ul style="margin:4px 0 4px 18px">');
        inList = true;
      }
      out.push(`<li>${inlineMd(t.replace(/^[-•*]\s+/, ""))}</li>`);
    } else if (t) {
      cerrarLista();
      out.push(`<p style="margin:4px 0">${inlineMd(t)}</p>`);
    } else {
      cerrarLista();
    }
    i += 1;
  }
  cerrarLista();
  return out.join("");
}

/** Markdown → texto plano (para guardar en la ficha 3.4). */
function markdownToTexto(md: string): string {
  return (md ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^#{1,3}\s+/, "").replace(/^[-•*]\s+/, "• ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1"))
    .join("\n")
    .trim();
}

export function EettTdrModal({
  necesidadId,
  doc,
  initialText,
  initialHtml: _initialHtml,
  initialRevision,
  initialPropuesta,
  tipoProcesoSeleccion,
  tipoObjeto,
  camposObjetivo,
  valoresActuales,
  onClose,
  onSaved,
}: {
  necesidadId: string;
  doc: EettTdrDoc;
  initialText: string;
  initialHtml?: string;
  /** Última revisión guardada del documento (para no volver a gastar tokens). */
  initialRevision?: EettRevision | null;
  /** Última propuesta GENERADA y guardada (para no volver a gastar tokens). */
  initialPropuesta?: EettPropuesta | null;
  tipoProcesoSeleccion: string;
  tipoObjeto: string;
  /**
   * Campos de la ficha aplicables a este proceso/objeto, con su sección. Los
   * calcula la ficha (que es dueña del catálogo y del eje por procedimiento) y
   * se pasan como prop para no importar el módulo de la ficha desde aquí: la
   * ficha ya importa este modal, y al revés sería un ciclo.
   */
  camposObjetivo?: Array<{ api: string; label: string; seccion: string; kind?: string }>;
  /** Valor ACTUAL de cada campo en la ficha, para ver qué se pisaría. */
  valoresActuales?: Record<string, string>;
  onClose: () => void;
  /**
   * `apisTrasladados`: los campos de la ficha que este guardado escribió (solo
   * al trasladar a la ficha). Quien recibe reconcilia el formulario abierto con
   * esos valores para que el autoguardado no los revierta. Los demás guardados
   * (revisar, editar el documento) no tocan la ficha y no pasan nada.
   *
   * `necesidadFresca`: la necesidad que devuelve el PATCH del traslado, con el
   * `updated_at` ya avanzado. Se pasa para que el receptor sincronice el sello de
   * versión de la ficha en el MISMO turno, antes de un reload asíncrono: sin ella,
   * un autoguardado pendiente saldría con el sello viejo y chocaría con un 409.
   */
  onSaved?: (apisTrasladados?: string[], necesidadFresca?: Necesidad) => void;
}) {
  // Texto base del EETT/TDR (extraído del PDF) y propuesta generada por IA.
  const [contenidoBase, setContenidoBase] = useState(initialText ?? "");
  // La propuesta se inicializa con la GENERADA y guardada (si la hay): generar
  // cuesta tokens, así que no se vuelve a llamar a la IA hasta que el usuario
  // pulse «Volver a generar».
  const [propuesta, setPropuesta] = useState(initialPropuesta?.contenido ?? "");
  const [generadoEn, setGeneradoEn] = useState<string | null>(initialPropuesta?.generadoEn ?? null);
  const [saving, setSaving] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aviso (no error): p. ej. la propuesta/revisión se generó pero no se pudo
  // guardar, así que se perdería al cerrar si no se descarga o traslada antes.
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  // La revisión se inicializa con la GUARDADA (si la hay): no se vuelve a llamar
  // a la IA hasta que el usuario pulse «Volver a revisar».
  const [resumen, setResumen] = useState<string | null>(initialRevision?.resumen ?? null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>(initialRevision?.hallazgos ?? []);
  const [revisadoEn, setRevisadoEn] = useState<string | null>(initialRevision?.revisadoEn ?? null);
  const [veredicto, setVeredicto] = useState<EettRevision["veredicto"] | null>(initialRevision?.veredicto ?? null);
  const [conteo, setConteo] = useState<EettRevision["conteo"] | null>(initialRevision?.conteo ?? null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);

  // Traslado de la propuesta a la ficha. Nada se escribe hasta que el usuario da
  // el VISTO BUENO sección por sección: el traslado pisa lo que el área usuaria
  // ya redactó, y esa no es una decisión del modelo.
  const [extrayendo, setExtrayendo] = useState(false);
  const [trasladando, setTrasladando] = useState(false);
  const [camposPropuestos, setCamposPropuestos] = useState<Record<string, string> | null>(null);
  /** Secciones con el visto bueno dado. Sin él, la sección no se traslada. */
  const [seccionesOk, setSeccionesOk] = useState<Set<string>>(new Set());
  /** Campos descartados a mano dentro de una sección aprobada. */
  const [camposExcluidos, setCamposExcluidos] = useState<Set<string>>(new Set());
  const [trasladadas, setTrasladadas] = useState<number | null>(null);
  // «Guardar en la ficha» REEMPLAZA la sección 3.4 entera. Cuando ahí ya hay
  // texto, se pide confirmación: es la misma columna que el traslado escribe
  // con visto bueno, y sería incoherente que por esta vía se pisara en silencio.
  const [confirmandoGuardar, setConfirmandoGuardar] = useState(false);

  const sinProceso = !tipoProcesoSeleccion.trim();
  // Contenido base para las acciones: la propuesta generada si existe; si no, el
  // texto del PDF (para revisar/descargar el borrador tal cual).
  const contenidoActual = () => (propuesta.trim() ? propuesta : contenidoBase);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Rescata el texto del PDF si el modal abrió sin él (p. ej. documento subido
  // antes de cachear el texto, o escaneo procesado por OCR en el indexado).
  useEffect(() => {
    if (contenidoBase.trim()) return;
    let cancelado = false;
    setLeyendoPdf(true);
    void (async () => {
      try {
        const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${doc.id}/texto`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelado && res.ok && data.text?.trim()) setContenidoBase(data.text);
      } catch {
        /* el visor del PDF sigue disponible aunque no haya texto */
      } finally {
        if (!cancelado) setLeyendoPdf(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revisar() {
    if (sinProceso) {
      setError("Elige y guarda primero el tipo de proceso de selección en la ficha para revisar contra su modelo.");
      return;
    }
    setRevisando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoProcesoSeleccion, tipoObjeto, tipo: doc.tipo, contenido: contenidoActual(), docId: doc.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo revisar el EETT/TDR.");
        return;
      }
      setResumen(payload.resumen ?? "");
      setHallazgos(payload.hallazgos ?? []);
      setRevisadoEn(payload.revisadoEn ?? null);
      setVeredicto(payload.veredicto ?? null);
      setConteo(payload.conteo ?? null);
      // Si no quedó guardada, avisar: al cerrar el modal se perdería.
      setAviso(
        payload.persistida === false
          ? "La revisión se hizo pero no se pudo guardar. Se perderá al cerrar el modal; vuelve a revisar más tarde."
          : null,
      );
      onSaved?.();
    } catch {
      setError("No se pudo conectar para revisar.");
    } finally {
      setRevisando(false);
    }
  }

  async function generar() {
    if (sinProceso) {
      setError("Elige y guarda primero el tipo de proceso de selección en la ficha para generar según su modelo.");
      return;
    }
    setGenerando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/generar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoProcesoSeleccion, tipoObjeto, tipo: doc.tipo, contenido: contenidoBase, docId: doc.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo generar la propuesta.");
        return;
      }
      if (payload.contenido?.trim()) {
        setPropuesta(payload.contenido);
        setGeneradoEn(payload.generadoEn ?? new Date().toISOString());
        // La propuesta cambió: lo extraído de la anterior ya no corresponde.
        setCamposPropuestos(null);
        setSeccionesOk(new Set());
        setCamposExcluidos(new Set());
        // Y la revisión anterior juzgaba la propuesta vieja: se invalida para no
        // mostrar un veredicto que ya no aplica a esta propuesta.
        setResumen(null);
        setHallazgos([]);
        setRevisadoEn(null);
        setVeredicto(null);
        setConteo(null);
        // Si no quedó guardada, avisar: al cerrar el modal se perdería.
        setAviso(
          payload.persistida === false
            ? "La propuesta se generó pero no se pudo guardar. Descárgala o trasládala antes de cerrar el modal, o vuelve a generarla."
            : null,
        );
      } else setError("La IA no devolvió una propuesta. Reintenta.");
    } catch {
      setError("No se pudo conectar para generar la propuesta.");
    } finally {
      setGenerando(false);
    }
  }

  async function descargarDocx() {
    setDescargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: contenidoActual(), titulo: doc.file_name.replace(/\.pdf$/i, ""), tipo: doc.tipo }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        setError(p.error ?? "No se pudo generar el .docx.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.tipo === "eett" ? "EETT" : "TDR"}-propuesta.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el .docx.");
    } finally {
      setDescargando(false);
    }
  }

  /**
   * Agrupa la propuesta por sección de la ficha, en el orden del catálogo, y
   * marca qué campos PISARÍAN un valor ya escrito.
   */
  function propuestaPorSeccion(): GrupoTraslado[] {
    if (!camposPropuestos) return [];
    const orden: string[] = [];
    const porSeccion = new Map<string, GrupoTraslado["campos"]>();
    for (const c of camposObjetivo ?? []) {
      const valor = camposPropuestos[c.api];
      if (!valor) continue;
      const actual = (valoresActuales?.[c.api] ?? "").trim();
      if (!porSeccion.has(c.seccion)) {
        porSeccion.set(c.seccion, []);
        orden.push(c.seccion);
      }
      porSeccion.get(c.seccion)!.push({ api: c.api, label: c.label, valor, actual, pisa: actual !== "" });
    }
    return orden.map((seccion) => ({ seccion, campos: porSeccion.get(seccion)! }));
  }

  /** Campos que se trasladarían: los de secciones con visto bueno, menos los excluidos. */
  function camposAprobados(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const grupo of propuestaPorSeccion()) {
      if (!seccionesOk.has(grupo.seccion)) continue;
      for (const c of grupo.campos) {
        if (camposExcluidos.has(c.api)) continue;
        out[c.api] = c.valor;
      }
    }
    return out;
  }

  /** Pide a la IA el mapeo propuesta → campos. No escribe nada todavía. */
  async function extraerCampos() {
    if (!propuesta.trim() || !(camposObjetivo ?? []).length) return;
    setExtrayendo(true);
    setError(null);
    setTrasladadas(null);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/trasladar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: doc.tipo,
          tipoObjeto,
          tipoProcesoSeleccion,
          contenido: propuesta,
          camposObjetivo,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudieron extraer los campos.");
        return;
      }
      const campos = (payload.campos ?? {}) as Record<string, string>;
      setCamposPropuestos(campos);
      // Ninguna sección llega aprobada: el visto bueno es del usuario.
      setSeccionesOk(new Set());
      setCamposExcluidos(new Set());
      if (Object.keys(campos).length === 0) {
        setError("La propuesta no contiene datos que correspondan a campos de la ficha.");
      }
    } catch {
      setError("No se pudo conectar para extraer los campos.");
    } finally {
      setExtrayendo(false);
    }
  }

  /**
   * Aplica a la ficha SOLO lo aprobado.
   *
   * Los campos numéricos (cantidad, plazo) se convierten antes de enviarlos: la
   * extracción devuelve todo como texto y su schema los rechaza con "expected
   * number, received string". Si un valor no contiene ningún número, se omite en
   * vez de mandar algo que el servidor va a rebotar.
   */
  async function trasladarAFicha() {
    const kinds = new Map((camposObjetivo ?? []).map((c) => [c.api, c.kind]));
    const aprobados = camposAprobados();
    const body: Record<string, string | number> = {};
    const descartados: string[] = [];
    for (const [api, valor] of Object.entries(aprobados)) {
      if (kinds.get(api) !== "number") {
        body[api] = valor;
        continue;
      }
      const n = numeroDesdeTexto(valor);
      if (n === undefined) descartados.push(api);
      else body[api] = n;
    }
    const total = Object.keys(body).length;
    if (total === 0) {
      setError("Ningún campo aprobado tiene un valor aplicable a la ficha.");
      return;
    }
    setTrasladando(true);
    setError(null);
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "No se pudieron trasladar los campos a la ficha.");
        return;
      }
      // Deja constancia del ORIGEN: la ficha resalta después estos campos como
      // «propuestos por IA». Es informativo, así que si falla no se interrumpe
      // el traslado, que ya se aplicó.
      await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${doc.id}/trasladados`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campos: Object.keys(body) }),
      }).catch(() => undefined);

      setTrasladadas(total);
      if (descartados.length > 0) {
        setError(
          `Se trasladaron ${total} campos. Sin aplicar por no contener un número: ${descartados.join(", ")}.`,
        );
      }
      setCamposPropuestos(null);
      setSeccionesOk(new Set());
      setCamposExcluidos(new Set());
      onSaved?.(Object.keys(body), payload.necesidad as Necesidad | undefined);
    } catch {
      setError("No se pudo conectar para trasladar los campos.");
    } finally {
      setTrasladando(false);
    }
  }

  /** Pisa 3.4 si ya tiene contenido: entonces hay que confirmar. */
  function guardarPisaFicha(): boolean {
    return Boolean((valoresActuales?.descripcionDetallada ?? "").trim());
  }

  async function guardar() {
    setConfirmandoGuardar(false);
    setSaving(true);
    setError(null);
    try {
      const md = contenidoActual();
      const res = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/contenido`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, html: markdownToHtml(md), texto: markdownToTexto(md) }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo guardar el contenido.");
        return;
      }
      setGuardado(true);
      onSaved?.();
      window.setTimeout(() => setGuardado(false), 2000);
    } catch {
      setError("No se pudo conectar para guardar.");
    } finally {
      setSaving(false);
    }
  }

  const pdfUrl = `/api/necesidades/${necesidadId}/eett-tdr/${doc.id}/pdf`;
  const tipoLabel = doc.tipo === "eett" ? "Especificaciones Técnicas (EETT)" : "Términos de Referencia (TDR)";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="tw fixed inset-0 z-[1000] bg-ink/45 backdrop-blur-[2px]" />
        {/* Se usan los primitivos de Radix (no el helper DialogContent) porque este
            no es un diálogo simple: es un editor ANCHO de dos columnas con una barra
            de acciones propia. Radix aporta lo que el overlay a mano no tenía —trampa
            de foco, bloqueo de scroll, cierre con Escape y clic fuera, overlay del
            sistema—; el layout ancho lo mantiene el className. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="tw fixed left-1/2 top-1/2 z-[1000] flex max-h-[96dvh] w-[96vw] max-w-[1400px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] border border-line bg-panel shadow-pop outline-none"
        >
        {/* Cabecera */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <DialogPrimitive.Title asChild>
            <strong className="flex-1">
              Revisar · {tipoLabel}
              <span className="font-normal text-muted"> · {doc.file_name}</span>
            </strong>
          </DialogPrimitive.Title>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void generar()}
            loading={generando}
            disabled={sinProceso}
            title={sinProceso ? "Elige el tipo de proceso en la ficha" : "Genera una propuesta correcta según el modelo del proceso"}
          >
            {generando ? null : <WandSparkles size={14} />}
            {propuesta.trim() ? "Volver a generar" : "Generar propuesta (IA)"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void revisar()}
            loading={revisando}
            disabled={sinProceso}
            title={sinProceso ? "Elige el tipo de proceso en la ficha" : "Revisa contra el modelo oficial del proceso"}
          >
            {revisando ? null : <Sparkles size={14} />}
            {revisadoEn ? "Volver a revisar" : "Revisar con el modelo OECE"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void extraerCampos()}
            loading={extrayendo}
            disabled={!propuesta.trim() || !(camposObjetivo ?? []).length}
            title={!propuesta.trim() ? "Genera primero la propuesta" : "Revisa campo a campo qué se trasladaría a la ficha"}
          >
            {extrayendo ? null : <ClipboardCheck size={14} />} Trasladar a la ficha
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void descargarDocx()} loading={descargando}>
            {descargando ? null : <Download size={14} />} Descargar .docx
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => (guardarPisaFicha() ? setConfirmandoGuardar(true) : void guardar())}
            loading={saving}
            title="Reemplaza la sección 3.4 de la ficha (Términos de referencia / Especificaciones técnicas) con este documento completo"
          >
            {saving ? null : <CheckCircle2 size={14} />}
            {guardado ? "Guardado" : "Guardar en 3.4 de la ficha"}
          </Button>
          <IconButton aria-label="Cerrar" size="sm" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        {/* Banner del tipo de proceso */}
        <div className="px-4 pt-3">
          {sinProceso ? (
            <Alert tone="warning">
              Esta necesidad <strong>no tiene un tipo de proceso de selección</strong> elegido. Selecciónalo y
              guárdalo en la ficha para revisar y generar la propuesta contra el modelo oficial correcto.
            </Alert>
          ) : (
            <Alert tone="info">
              Revisando y generando contra el modelo oficial de: <strong>{tipoProcesoSeleccion}</strong>.
            </Alert>
          )}
        </div>

        {error ? (
          <div className="px-4 pt-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        {aviso ? (
          <div className="px-4 pt-3">
            <Alert tone="warning">{aviso}</Alert>
          </div>
        ) : null}

        {/* Cuerpo: PDF · (propuesta + revisión) */}
        <div className="grid min-h-0 flex-1 grid-cols-2">
          {/* Visor del PDF subido */}
          <div className="min-h-0 border-r border-line">
            <iframe title="PDF del EETT/TDR" src={pdfUrl} className="h-full w-full border-0" />
          </div>

          {/* Panel: propuesta generada + revisión */}
          <div className="flex min-h-0 flex-col bg-surface">
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {leyendoPdf ? (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-accent/25 bg-accent-soft px-2.5 py-2 text-[12.5px]">
                  <Loader size={15} className="shrink-0 text-accent" />
                  <span>
                    <strong>Leyendo el PDF</strong> (con OCR si es un escaneo)… la revisión usará su contenido detallado.
                  </span>
                </div>
              ) : !contenidoBase.trim() ? (
                <div className="mb-3 flex gap-2 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-[12.5px]">
                  <AlertTriangle size={15} className="shrink-0 text-warning" />
                  <span>
                    No se pudo leer texto del PDF (posible escaneo no legible). La revisión usará el{" "}
                    <strong>requerimiento guardado en la ficha</strong> como base.
                  </span>
                </div>
              ) : null}
              {/* Propuesta generada */}
              {/* Traslado a la ficha: visto bueno sección por sección. */}
              {confirmandoGuardar ? (
                <div className="mb-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12.5px]">
                  <div className="mb-2 flex gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-warning" />
                    <span>
                      La sección <strong>3.4</strong> de la ficha ya tiene contenido y se{" "}
                      <strong>reemplazará por completo</strong> con este documento. Si solo quieres pasar algunos datos, usa{" "}
                      <strong>«Trasladar a la ficha»</strong>, que aprueba sección por sección.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="primaryButton compactButton" type="button" onClick={() => void guardar()}>
                      Reemplazar 3.4
                    </button>
                    <button className="secondaryButton compactButton" type="button" onClick={() => setConfirmandoGuardar(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              {trasladadas !== null ? (
                <div className="mb-3 flex gap-2 rounded-md border border-success/30 bg-success-soft px-2.5 py-2 text-[12.5px]">
                  <CheckCircle2 size={15} className="shrink-0 text-success" />
                  <span>
                    <strong>
                      {trasladadas} campo{trasladadas === 1 ? "" : "s"}
                    </strong>{" "}
                    trasladado{trasladadas === 1 ? "" : "s"} a la ficha.
                  </span>
                </div>
              ) : null}

              {camposPropuestos && Object.keys(camposPropuestos).length > 0 ? (
                <TrasladoPanel
                  grupos={propuestaPorSeccion()}
                  seccionesOk={seccionesOk}
                  camposExcluidos={camposExcluidos}
                  aprobados={Object.keys(camposAprobados()).length}
                  trasladando={trasladando}
                  onToggleSeccion={(seccion) =>
                    setSeccionesOk((prev) => {
                      const next = new Set(prev);
                      if (next.has(seccion)) next.delete(seccion);
                      else next.add(seccion);
                      return next;
                    })
                  }
                  onToggleCampo={(api) =>
                    setCamposExcluidos((prev) => {
                      const next = new Set(prev);
                      if (next.has(api)) next.delete(api);
                      else next.add(api);
                      return next;
                    })
                  }
                  onTrasladar={() => void trasladarAFicha()}
                  onDescartar={() => {
                    setCamposPropuestos(null);
                    setSeccionesOk(new Set());
                    setCamposExcluidos(new Set());
                  }}
                />
              ) : null}

              {propuesta.trim() ? (
                <div className="mb-[18px]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold">
                    <WandSparkles size={15} className="text-accent" /> Propuesta generada (según modelo OECE)
                  </div>
                  {generadoEn ? (
                    <p className="mb-1.5 mt-0 text-[11.5px] text-muted">
                      Propuesta guardada · generada el {new Date(generadoEn).toLocaleString("es-PE")} · no gasta tokens al
                      reabrir.
                    </p>
                  ) : null}
                  <p className="mb-2 mt-0 text-xs text-muted">
                    Descárgala en <strong>.docx</strong> para editarla en Word, o pásala a la ficha con{" "}
                    <strong>«Trasladar a la ficha»</strong>, que te deja aprobar sección por sección.
                  </p>
                  <div
                    className="rounded-lg border border-muted/20 bg-panel px-3.5 py-3 text-[13px] leading-normal"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(propuesta) }}
                  />
                </div>
              ) : null}

              {/* Revisión */}
              <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold">
                <Sparkles size={15} className="text-accent" /> Revisión contra el modelo OECE
              </div>
              {revisadoEn ? (
                <p className="mb-2 mt-0 text-[11.5px] text-muted">
                  Última revisión guardada: {new Date(revisadoEn).toLocaleString("es-PE")} · no gasta tokens al reabrir.
                </p>
              ) : null}
              {!resumen && hallazgos.length === 0 ? (
                <p className="m-0 text-[13px] text-muted">
                  Pulsa <strong>«Revisar con el modelo OECE»</strong> para contrastar este EETT/TDR con el requerimiento
                  estándar del proceso elegido y ver, con su justificación, qué <strong>cumple</strong>, qué{" "}
                  <strong>falta</strong> y qué <strong>corregir</strong>. O <strong>«Generar propuesta»</strong> para
                  obtener la versión corregida completa.
                </p>
              ) : (
                <>
                  {/* Cabecera: veredicto + conteo de conformidad */}
                  {veredicto ? (
                    <div
                      className={cn(
                        "mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2",
                        veredicto === "apto" ? "border-success bg-success-soft" : "border-warning bg-warning-soft",
                      )}
                    >
                      <strong className={cn("text-[13px]", veredicto === "apto" ? "text-success" : "text-warning")}>
                        {veredicto === "apto" ? "✓ Apto para avanzar" : "⚠ Requiere subsanación"}
                      </strong>
                      {conteo ? (
                        <span className="text-xs text-muted">
                          {conteo.cumple} cumple · {conteo.falta} falta · {conteo.corregir} corregir
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {veredicto !== "apto" && conteo ? (
                    <p className="mb-2 mt-0 text-[11.5px] text-muted">
                      El requerimiento es la base de las siguientes fases (estrategia, expediente). Subsana lo pendiente
                      antes de avanzar.
                    </p>
                  ) : null}
                  {resumen ? <p className="mt-0 text-[13px]">{resumen}</p> : null}
                  <div className="flex flex-col gap-2.5">
                    {[...hallazgos]
                      .map((h, i) => ({ h, i }))
                      .sort((a, b) => {
                        const rank = (t: Hallazgo["tipo"]) => (t === "falta" ? 0 : t === "corregir" ? 1 : 2);
                        return rank(a.h.tipo) - rank(b.h.tipo);
                      })
                      .map(({ h, i }) => (
                      <div
                        key={i}
                        className={cn("rounded-md border-l-[3px] bg-panel px-3 py-2", HALLAZGO_META[h.tipo].bordeL)}
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className={cn("text-[11px] font-bold uppercase", HALLAZGO_META[h.tipo].texto)}>
                            {HALLAZGO_META[h.tipo].label}
                          </span>
                          {h.pagina && h.pagina !== "—" ? (
                            <span className="rounded-sm bg-muted/15 px-1.5 text-[11px] font-bold text-muted">
                              Pág. {h.pagina}
                            </span>
                          ) : null}
                          {h.ubicacion ? (
                            <span className="text-[12.5px] font-semibold">{h.ubicacion}</span>
                          ) : null}
                        </div>
                        {h.observacion ? (
                          <div className="mt-[3px] text-[12.5px] leading-[1.45] text-ink">
                            <span className="font-semibold text-muted">Cómo está: </span>
                            {h.observacion}
                          </div>
                        ) : null}
                        {h.deberiaDecir ? (
                          <div className="mt-[3px] text-[12.5px] leading-[1.45] text-ink">
                            <span className={cn("font-semibold", HALLAZGO_META[h.tipo].texto)}>Debería decir: </span>
                            {h.deberiaDecir}
                          </div>
                        ) : null}
                        {h.propuesta ? (
                          <div className="mt-1.5">
                            <div className="mb-[3px] flex items-center justify-between gap-2">
                              <span className="text-[11.5px] font-bold text-accent">
                                ✍️ Propuesta correcta (lista para pegar)
                              </span>
                              <button
                                type="button"
                                className="copilotoLink inline-flex items-center gap-1 text-[11.5px] text-accent"
                                onClick={() => {
                                  navigator.clipboard?.writeText(h.propuesta);
                                  setCopiado(i);
                                  window.setTimeout(() => setCopiado((c) => (c === i ? null : c)), 1500);
                                }}
                              >
                                <Copy size={12} /> {copiado === i ? "Copiado" : "Copiar"}
                              </button>
                            </div>
                            <div className="whitespace-pre-wrap rounded-md border border-accent/25 bg-accent/[0.07] px-2.5 py-2 text-[12.5px] leading-normal text-ink">
                              {h.propuesta}
                            </div>
                          </div>
                        ) : null}
                        {h.justificacion ? (
                          <div className="mt-1 text-[11.5px] italic leading-[1.4] text-muted">
                            Fundamento: {h.justificacion}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
