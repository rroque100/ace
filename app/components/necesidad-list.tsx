"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ClipboardList,
  Clock,
  Hourglass,
  Inbox,
  FolderCheck,
  FileUp,
  Hash,
  LayoutGrid,
  Plus,
  Rows3,
  CalendarClock,
  Building2,
  Coins,
  Target,
} from "lucide-react";
import type { PedidoNecesidadImport } from "@/lib/pedido-compra-import";

// Un pedido en revisión de lote, editable: mismos campos que el modal de un
// solo pedido (Nombre, Tipo de objeto, Área usuaria, Meta, Proyecto de
// inversión, Finalidad pública), para poder corregir CUALQUIER pedido de la
// lista antes de crear, no solo el primero.
type ImportItemEditable = PedidoNecesidadImport & { finalidadPublica?: string };
import { OBJETOS_NECESIDAD, objetoNecesidadLabel } from "@/lib/necesidades";
import { filasTextarea } from "@/lib/textarea-alto";
import { PROCESOS_SELECCION, type ObjetoFilter } from "@/lib/procesos-seleccion";
import {
  TIPO_AREA_OPCIONES,
  NECESIDAD_ESTADOS,
  ladoDeRol,
  necesidadStatusLabel,
  necesidadStatusTono,
  type TonoEstado,
} from "@/lib/necesidad-workflow";
import type { DefinicionFiltro } from "./barra-filtros";
import {
  ORDEN_OPCIONES,
  ORDEN_POR_DEFECTO,
  type OrdenNecesidad,
  esOrdenValido,
  proximoPaso,
} from "@/lib/necesidad-lista";
import { rolesConCapacidad } from "@/lib/permisos-contratacion";
import { useSettingsCatalog } from "./use-settings-catalog";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { FiltrosBar } from "./necesidades/filtros-bar";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "./ui";
import { cn } from "@/lib/utils";

type NecesidadExt = {
  id: string;
  codigo: string | null;
  nombre: string;
  tipo_objeto: string;
  tipo_proceso_seleccion: string | null;
  area_usuaria: string | null;
  meta_presupuestal: string | null;
  monto_estimado: number | string | null;
  fecha_requerida: string | null;
  responsable: string | null;
  /** Expediente ya abierto: la necesidad dejó de estar esperando. */
  process_id: string | null;
  status: string;
  created_at: string;
  /** Última transición: base de la antigüedad "en este estado". */
  updated_at: string | null;
};

type Faceta = { valor: string; total: number };

/** Lado del usuario en el flujo (para el "próximo paso" de cada fila). */
type Lado = { esDec: boolean; esAreaUsuaria: boolean };

/** Color de la franja de estado (los mismos tonos que usa el sistema). */
const TONO_COLOR: Record<TonoEstado, string> = {
  neutral: "var(--tono-neutral-ink)",
  progreso: "var(--tono-progreso-ink)",
  atencion: "var(--tono-atencion-ink)",
  exito: "var(--tono-exito-ink)",
  terminal: "var(--tono-terminal-ink)",
};

/**
 * Monto en soles, con separador de miles y sin decimales. En un listado que se
 * recorre comparando cifras, los céntimos son ruido: lo que se busca es el orden
 * de magnitud. El detalle exacto está en la ficha.
 */
function formatearMonto(valor: number | string | null): string {
  if (valor === null || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

/** Fecha corta. Se parte la cadena en vez de usar `new Date`, que aplicaría la
 *  zona horaria y podría enseñar el día anterior. */
function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  if (!anio || !mes || !dia) return "—";
  return `${dia}/${mes}/${anio}`;
}

/** Días enteros transcurridos desde una fecha ISO (0 si no es válida). */
function diasDesde(iso: string | null | undefined): number {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// La antigüedad "en este estado" solo importa mientras alguien tiene que actuar:
// en borrador/derivada/anulada no hay espera que medir. Umbrales (días) a partir
// de los cuales la espera se marca como atrasada, por estado.
const UMBRAL_DIAS: Record<string, number> = {
  remitido_dec: 3,
  en_revision_dec: 5,
  observado: 5,
  no_objecion_pendiente: 3,
};

/**
 * Urgencia de la fecha requerida: "vencida" (ya pasó), "pronto" (dentro de 15
 * días) o null. No aplica a necesidades derivadas o anuladas. Se compara por
 * cadena aaaa-mm-dd para no depender de la zona horaria.
 */
function urgenciaFecha(fecha: string | null, status: string): "vencida" | "pronto" | null {
  if (!fecha || status === "incorporado_cmn" || status === "anulada") return null;
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoy = new Date();
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 15);
  const fr = fecha.slice(0, 10);
  if (fr < iso(hoy)) return "vencida";
  if (fr <= iso(limite)) return "pronto";
  return null;
}

/** Antigüedad de la necesidad en su estado: texto + si está atrasada. `null` si
 *  el estado no espera acción (no se muestra). */
function antiguedadEstado(status: string, updatedAt: string | null): { texto: string; atrasado: boolean } | null {
  if (!(status in UMBRAL_DIAS)) return null;
  const dias = diasDesde(updatedAt);
  const texto = dias === 0 ? "hoy" : dias === 1 ? "hace 1 día" : `hace ${dias} días`;
  return { texto, atrasado: dias >= UMBRAL_DIAS[status] };
}

/** Esqueleto de tarjeta con la misma forma que la real, para que el paso de
 *  cargando a cargado no dé saltos. */
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line bg-panel p-4 pl-5 shadow-card">
      <span className="absolute inset-y-0 left-0 w-1 bg-line" aria-hidden />
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 animate-pulse rounded bg-line" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-line" />
      </div>
      <div className="mt-3 h-3.5 w-[88%] animate-pulse rounded bg-line" />
      <div className="mt-1.5 h-3.5 w-[62%] animate-pulse rounded bg-line" />
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-line" />
        <div className="h-5 w-28 animate-pulse rounded-full bg-line" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-2.5 w-10 animate-pulse rounded bg-line" />
            <div className="mt-1 h-3 w-[80%] animate-pulse rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NecesidadList({ canManage, role = "" }: { canManage: boolean; role?: string }) {
  const { entity: configuredEntity } = useSettingsCatalog();
  const [necesidades, setNecesidades] = useState<NecesidadExt[]>([]);
  // Bandeja "lo que me toca": estados que esperan la acción de MI lado (área
  // usuaria o DEC). El servidor deriva los estados del rol; aquí solo se activa.
  const [soloMisPendientes, setSoloMisPendientes] = useState(false);
  const misEstados = useMemo(() => {
    const { esDec } = ladoDeRol(role);
    const lado = esDec ? "dec" : "area_usuaria";
    return new Set(NECESIDAD_ESTADOS.filter((e) => e.actor === lado).map((e) => e.value));
  }, [role]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  // Registro enfocado en obligatorios; los opcionales se revelan a demanda.
  const [optionalOpen, setOptionalOpen] = useState(false);
  // Importación desde pedido de compra del SIGA.
  const [importing, setImporting] = useState(false);
  const [importedItem, setImportedItem] = useState<PedidoNecesidadImport | null>(null);
  const [importInfo, setImportInfo] = useState<{ nro: string; count: number } | null>(null);
  // Multi-ítem: revisión y creación en lote. `finalidadPublica` no viene del
  // pedido (ninguna de las dos fuentes la trae) — se agrega vacía, igual que
  // en el modal de un solo pedido, para que se pueda escribir ahí mismo.
  const [importItems, setImportItems] = useState<ImportItemEditable[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [listOpen, setListOpen] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  // Vista previa expandible de cada pedido en el diálogo de importación en
  // lote: antes solo se veía nombre/área/cantidad, sin poder revisar los
  // ítems ni el monto antes de crear la necesidad.
  const [importExpandido, setImportExpandido] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Segunda forma de importar: buscar el pedido por su N°, en vez de subir el
  // .xlsx (ver app/api/necesidades/import-pedido-control/route.ts).
  const [nroPedidoDialogOpen, setNroPedidoDialogOpen] = useState(false);
  const [nroPedidoInput, setNroPedidoInput] = useState("");
  const [importingControl, setImportingControl] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const debouncedSearch = useDebouncedValue(searchQ, 300);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroProceso, setFiltroProceso] = useState("");
  const [filtroMeta, setFiltroMeta] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  // Vista de portafolio (E2): "" | "por_vencer" | "estancadas".
  const [vista, setVista] = useState("");
  // Orden del listado (server-side, porque la paginación lo es).
  const [orden, setOrden] = useState<OrdenNecesidad>(ORDEN_POR_DEFECTO);
  // Presentación: tarjetas (triage visual) o tabla (comparar muchas filas).
  const [presentacion, setPresentacion] = useState<"cards" | "tabla">("cards");
  // Hasta hidratar desde la URL no se pinta la URL ni se lanza el primer fetch,
  // para no pisar los parámetros compartidos con los valores por defecto.
  const [hidratado, setHidratado] = useState(false);
  // Fila resaltada por el teclado (j/k · flechas · Enter para abrir).
  const [seleccionado, setSeleccionado] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const [facetas, setFacetas] = useState<{ metas: Faceta[]; areas: Faceta[]; responsables: Faceta[] }>({
    metas: [],
    areas: [],
    responsables: [],
  });
  // Conteo por estado para el tablero de la cola (dashboard). estado→total.
  const [conteoEstados, setConteoEstados] = useState<Record<string, number>>({});
  // Conteos del portafolio para los chips de vista rápida.
  const [portafolio, setPortafolio] = useState<{ porVencer: number; estancadas: number }>({ porVencer: 0, estancadas: 0 });
  // Se incrementa para re-pedir las facetas/conteos (tras crear necesidades).
  const [recargaFacetas, setRecargaFacetas] = useState(0);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  const [nombre, setNombre] = useState("");
  const [tipoObjeto, setTipoObjeto] = useState("bienes");
  const [tipoArea, setTipoArea] = useState("area_usuaria");
  const [finalidadPublica, setFinalidadPublica] = useState("");
  const [metaPresupuestal, setMetaPresupuestal] = useState("");
  const [proyectoInversion, setProyectoInversion] = useState("");
  const [areaUsuaria, setAreaUsuaria] = useState("");

  const [oficinas, setOficinas] = useState<{ id: string; nombre: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchNecesidades = useCallback(
    async (pageNum: number, append: boolean) => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(PAGE_SIZE));
      if (debouncedSearch) params.set("search", debouncedSearch);
      // Precedencia: vista de portafolio > bandeja "lo que me toca" > estado. Cada
      // una filtra por VARIOS estados (que un select simple no expresa).
      if (vista) params.set("vista", vista);
      else if (soloMisPendientes) params.set("mine", "1");
      else if (filtroStatus) params.set("status", filtroStatus);
      if (filtroTipo) params.set("tipo_objeto", filtroTipo);
      if (filtroProceso) params.set("tipo_proceso_seleccion", filtroProceso);
      if (filtroMeta) params.set("meta_presupuestal", filtroMeta);
      if (filtroOficina) params.set("area_usuaria", filtroOficina);
      if (filtroResponsable) params.set("responsable", filtroResponsable);
      if (orden) params.set("orden", orden);

      if (!append) {
        setLoading(true);
        // El resaltado del teclado es un índice: al recargar (orden/filtro/búsqueda)
        // la posición i pasa a ser OTRA necesidad, así que se suelta.
        setSeleccionado(-1);
      } else setLoadingMore(true);
      setError("");

      try {
        const res = await fetch(`/api/necesidades?${params}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const payload = await res.json();
        if (ac.signal.aborted) return;

        if (!res.ok) {
          setError(payload.error ?? "No se pudieron cargar las necesidades.");
          return;
        }

        const items: NecesidadExt[] = payload.necesidades ?? [];
        setNecesidades((prev) => (append ? [...prev, ...items] : items));
        setHasMore(items.length === PAGE_SIZE);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("No se pudo conectar con el servidor.");
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, vista, soloMisPendientes, filtroStatus, filtroTipo, filtroProceso, filtroMeta, filtroOficina, filtroResponsable, orden],
  );

  // Hidratar orden/filtros desde la URL y la preferencia de vista (localStorage).
  // En un efecto de montaje —no en el render— para no romper la hidratación de
  // React ni tocar `window` en el servidor. Corre una sola vez.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const aplica = (clave: string, set: (s: string) => void) => {
      const v = p.get(clave);
      if (v) set(v);
    };
    aplica("q", setSearchQ);
    aplica("status", setFiltroStatus);
    aplica("tipo", setFiltroTipo);
    aplica("proc", setFiltroProceso);
    aplica("meta", setFiltroMeta);
    aplica("oficina", setFiltroOficina);
    aplica("resp", setFiltroResponsable);
    aplica("vista", setVista);
    if (p.get("mine") === "1") setSoloMisPendientes(true);
    if (esOrdenValido(p.get("orden"))) setOrden(p.get("orden") as OrdenNecesidad);
    try {
      const pres = localStorage.getItem("nec-presentacion");
      if (pres === "tabla" || pres === "cards") setPresentacion(pres);
    } catch {
      /* localStorage puede fallar (modo privado): la preferencia no es crítica. */
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    setPage(1);
    setHasMore(true);
    fetchNecesidades(1, false);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchNecesidades, hidratado]);

  // Reflejar orden y filtros en la URL: volver, guardar y compartir la vista.
  // `replaceState` (no navegación) evita re-render y no necesita <Suspense>.
  useEffect(() => {
    if (!hidratado) return;
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("q", debouncedSearch);
    // Misma precedencia que el fetch: vista > bandeja > estado.
    if (vista) p.set("vista", vista);
    else if (soloMisPendientes) p.set("mine", "1");
    else if (filtroStatus) p.set("status", filtroStatus);
    if (filtroTipo) p.set("tipo", filtroTipo);
    if (filtroProceso) p.set("proc", filtroProceso);
    if (filtroMeta) p.set("meta", filtroMeta);
    if (filtroOficina) p.set("oficina", filtroOficina);
    if (filtroResponsable) p.set("resp", filtroResponsable);
    if (orden !== ORDEN_POR_DEFECTO) p.set("orden", orden);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [
    hidratado, debouncedSearch, vista, soloMisPendientes, filtroStatus,
    filtroTipo, filtroProceso, filtroMeta, filtroOficina, filtroResponsable, orden,
  ]);

  // Persistir la preferencia de presentación.
  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem("nec-presentacion", presentacion);
    } catch {
      /* sin persistencia si localStorage falla */
    }
  }, [hidratado, presentacion]);

  // Teclado: «/» enfoca el buscador; j/k y flechas recorren la cola; Enter abre;
  // Esc quita el resaltado. Se ignora mientras se escribe o con un diálogo abierto.
  useEffect(() => {
    // Nº de columnas de la rejilla, leído del DOM (responsivo: 1/2/3). En la vista
    // tabla las filas no comparten `offsetTop`, así que sale 1 —y ↑/↓ se mueven de
    // una en una, que es lo correcto para una tabla—.
    function columnas(): number {
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-nec-idx]"));
      if (items.length === 0) return 1;
      const top0 = items[0].offsetTop;
      let cols = 0;
      for (const el of items) {
        if (Math.abs(el.offsetTop - top0) < 4) cols++;
        else break;
      }
      return Math.max(1, cols);
    }
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const escribiendo =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !escribiendo) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (escribiendo || formOpen || listOpen) return;
      const n = necesidades.length;
      // Primer movimiento cae en la primera fila; todo acotado al rango.
      const mover = (delta: number) => {
        if (n === 0) return;
        e.preventDefault();
        setSeleccionado((i) => (i < 0 ? 0 : Math.max(0, Math.min(n - 1, i + delta))));
      };
      // j/k recorren linealmente (semántica de lista); ↑/↓ saltan por filas —una
      // columna en tabla, varias en tarjetas—, que es lo que se espera al ver.
      if (e.key === "j") mover(1);
      else if (e.key === "k") mover(-1);
      else if (e.key === "ArrowDown") mover(columnas());
      else if (e.key === "ArrowUp") mover(-columnas());
      else if (e.key === "Enter") {
        setSeleccionado((i) => {
          if (i >= 0 && i < necesidades.length) router.push(`/necesidades/${necesidades[i].id}`);
          return i;
        });
      } else if (e.key === "Escape") setSeleccionado(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [necesidades, formOpen, listOpen, router]);

  // Mantener a la vista la fila resaltada por el teclado.
  useEffect(() => {
    if (seleccionado < 0) return;
    document.querySelector<HTMLElement>(`[data-nec-idx="${seleccionado}"]`)?.scrollIntoView({ block: "nearest" });
  }, [seleccionado]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [oRes, fRes] = await Promise.all([
          fetch("/api/oficinas", { cache: "no-store" }),
          fetch("/api/necesidades/facetas", { cache: "no-store" }),
        ]);
        const [oPayload, fPayload] = await Promise.all([oRes.json(), fRes.json()]);
        if (cancelled) return;
        // Que el filtro por oficina se quede vacío es tolerable; que no quede
        // constancia de por qué, no.
        if (!oRes.ok) {
          console.error("[necesidades] no se pudieron cargar las oficinas:", oPayload?.error);
        }
        setOficinas(oPayload.oficinas ?? []);
        setFacetas({ metas: fPayload.metas ?? [], areas: fPayload.areas ?? [], responsables: fPayload.responsables ?? [] });
        setConteoEstados(fPayload.estados ?? {});
        setPortafolio(fPayload.portafolio ?? { porVencer: 0, estancadas: 0 });
      } catch {
        if (!cancelled) setOficinas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recargaFacetas]);

  /**
   * Procedimientos que corresponden al objeto elegido. El catálogo ya sabe qué
   * objetos admite cada procedimiento (Art. 54.1), así que ofrecer una
   * combinación imposible sería ofrecer algo que nunca devuelve nada.
   */
  const procesosDelObjeto = PROCESOS_SELECCION.filter(
    (p) => p.value && (!filtroTipo || p.objetos.includes(filtroTipo as ObjetoFilter)),
  );

  // Cambiar el objeto puede dejar el procedimiento elegido fuera de lugar: se
  // suelta en vez de dejar un filtro combinado que devuelve cero.
  useEffect(() => {
    if (!filtroProceso) return;
    const sigueValiendo = procesosDelObjeto.some((p) => p.value === filtroProceso);
    if (!sigueValiendo) setFiltroProceso("");
  }, [filtroProceso, procesosDelObjeto]);

  async function loadMore() {
    const next = page + 1;
    setPage(next);
    await fetchNecesidades(next, true);
  }

  // Común a las dos formas de importar (archivo .xlsx y N° de pedido en
  // control): ambos endpoints devuelven `{items, count, pedidoGuardado}` con
  // la misma forma, así que lo que se hace con la respuesta es idéntico.
  function aplicarPedidoImportado(items: PedidoNecesidadImport[], count: number, pedidoGuardado?: boolean) {
    if (items.length === 0) {
      setError("El pedido no contiene ítems.");
      return;
    }
    // Varios ítems → revisión en lote. Un solo ítem → prellenar el modal.
    if (items.length > 1) {
      setImportItems(items.map((it): ImportItemEditable => ({ ...it, finalidadPublica: "" })));
      setImportSelected(new Set(items.map((_, i) => i)));
      setListOpen(true);
      return;
    }
    const item = items[0];
    setNombre(item.nombre ?? "");
    setTipoObjeto(item.tipoObjeto ?? "bienes");
    setAreaUsuaria(item.areaUsuaria ?? "");
    setProyectoInversion(item.proyectoInversion ?? "");
    setMetaPresupuestal(item.metaPresupuestal ?? "");
    setFinalidadPublica("");
    setImportedItem(item);
    setImportInfo({ nro: item.nroPedido ?? "—", count });
    if (pedidoGuardado === false) {
      setError(
        "El pedido se leyó pero no se pudo archivar en pedidos_siga (¿falta ejecutar el SQL?). Puedes crear la necesidad igualmente.",
      );
    }
    setOptionalOpen(true);
    setFormOpen(true);
  }

  async function handleImportPedido(file: File) {
    setImporting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/necesidades/import-pedido", { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo importar el pedido de compra.");
        return;
      }
      aplicarPedidoImportado(payload.items ?? [], payload.count, payload.pedidoGuardado);
    } catch {
      setError("No se pudo conectar para importar el pedido.");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportPedidoControl() {
    const nroPedido = nroPedidoInput.trim();
    if (!nroPedido) return;
    setImportingControl(true);
    setError("");
    try {
      const res = await fetch("/api/necesidades/import-pedido-control", {
        body: JSON.stringify({ nroPedido }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo importar el pedido.");
        return;
      }
      aplicarPedidoImportado(payload.items ?? [], payload.count, payload.pedidoGuardado);
      setNroPedidoDialogOpen(false);
      setNroPedidoInput("");
    } catch {
      setError("No se pudo conectar para importar el pedido.");
    } finally {
      setImportingControl(false);
    }
  }

  function toggleImportSel(i: number) {
    setImportSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleImportExpandido(i: number) {
    setImportExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function actualizarImportItem(i: number, patch: Partial<ImportItemEditable>) {
    setImportItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function createBatch() {
    const seleccion = importItems.filter((_, i) => importSelected.has(i));
    if (seleccion.length === 0) return;
    setCreatingBatch(true);
    setError("");
    try {
      const creadas: NecesidadExt[] = [];
      let fallidas = 0;
      let sinItems = 0;
      for (const item of seleccion) {
        const { items: itemsDelPedido, nroPedido, secuencia, ...fields } = item;
        const res = await fetch("/api/necesidades", {
          // nroPedido/pedidoSecuencia no son columnas: el POST los usa para
          // vincular la fila de pedidos_siga (trazabilidad pedido → necesidad).
          body: JSON.stringify({ tipoArea: "area_usuaria", ...fields, nroPedido, pedidoSecuencia: secuencia }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.necesidad) {
          fallidas += 1;
          continue;
        }
        creadas.push(payload.necesidad);
        // El desagregado del pedido, igual que en la creación de un solo
        // pedido (createNecesidad): antes se perdía en el lote, la necesidad
        // se creaba sin sus ítems.
        if (Array.isArray(itemsDelPedido) && itemsDelPedido.length > 0) {
          const resItems = await fetch(`/api/necesidades/${payload.necesidad.id}/items`, {
            body: JSON.stringify({ items: itemsDelPedido }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          });
          if (!resItems.ok) sinItems += 1;
        }
      }
      if (creadas.length > 0) {
        setNecesidades((prev) => [...creadas, ...prev]);
        setHasMore(true);
        setRecargaFacetas((n) => n + 1);
      }
      setListOpen(false);
      setImportItems([]);
      const avisos: string[] = [];
      if (fallidas > 0) avisos.push(`${fallidas} pedido(s) no se pudieron registrar`);
      if (sinItems > 0) avisos.push(`${sinItems} necesidad(es) se crearon sin sus ítems (añádelos desde su ficha)`);
      if (avisos.length > 0) {
        setError(`Se crearon ${creadas.length} necesidad(es). ${avisos.join("; ")}.`);
      }
    } catch {
      setError("No se pudo conectar para crear las necesidades.");
    } finally {
      setCreatingBatch(false);
    }
  }

  async function createNecesidad(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nombre.trim().length < 3) {
      setError("Escribe un nombre de contratación más completo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Campos extra derivados del pedido de compra (los ya visibles en el
      // formulario tienen prioridad; se excluyen con destructuring).
      let extra: Record<string, unknown> = {};
      // Los ítems del pedido NO van en el cuerpo de la necesidad: viven en su
      // propia tabla y se mandan aparte, una vez que la necesidad ya tiene id.
      let itemsImportados: unknown[] = [];
      if (importedItem) {
        const { nombre: _n, tipoObjeto: _t, areaUsuaria: _a, proyectoInversion: _p, items, nroPedido, secuencia, ...rest } = importedItem;
        extra = { ...rest, nroPedido, pedidoSecuencia: secuencia };
        itemsImportados = Array.isArray(items) ? items : [];
      }
      const res = await fetch("/api/necesidades", {
        body: JSON.stringify({
          nombre,
          tipoObjeto,
          tipoArea,
          finalidadPublica,
          metaPresupuestal,
          proyectoInversion,
          areaUsuaria,
          ...extra,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo registrar la necesidad.");
        return;
      }

      // El desagregado del pedido, en cuanto la necesidad tiene id. Si falla, la
      // necesidad ya está creada: se avisa en vez de perderla, y los ítems se
      // pueden reescribir a mano en la sección 3.2.
      if (payload.necesidad?.id && itemsImportados.length > 0) {
        const resItems = await fetch(`/api/necesidades/${payload.necesidad.id}/items`, {
          body: JSON.stringify({ items: itemsImportados }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (!resItems.ok) {
          const err = await resItems.json().catch(() => ({}));
          setError(
            `La necesidad se registró, pero los ${itemsImportados.length} ítems del pedido no se guardaron: ${err.error ?? "error desconocido"}. Añádelos desde la sección 3.2.`,
          );
        }
      }

      if (payload.necesidad) {
        setNecesidades((prev) => [payload.necesidad, ...prev]);
        setHasMore(true);
        setRecargaFacetas((n) => n + 1);
      }

      setNombre("");
      setFinalidadPublica("");
      setMetaPresupuestal("");
      setProyectoInversion("");
      setAreaUsuaria("");
      setOptionalOpen(false);
      setImportedItem(null);
      setImportInfo(null);
      setFormOpen(false);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  const hayFiltros = Boolean(
    debouncedSearch || filtroStatus || filtroTipo || filtroProceso || filtroMeta || filtroOficina ||
      filtroResponsable || soloMisPendientes || vista,
  );

  // Tablero de la cola: total de "lo que me toca" y si mostrar esa bandeja.
  const misPendientesTotal = useMemo(
    () => [...misEstados].reduce((sum, e) => sum + (conteoEstados[e] ?? 0), 0),
    [misEstados, conteoEstados],
  );
  const { esDec, esAreaUsuaria } = ladoDeRol(role);
  const lado = { esDec, esAreaUsuaria };
  const mostrarBandeja = (esDec || esAreaUsuaria) && misPendientesTotal > 0;

  const filtrosNecesidad: DefinicionFiltro[] = [
    {
      etiqueta: "Estado",
      id: "estado",
      onChange: setFiltroStatus,
      opciones: NECESIDAD_ESTADOS.map((e) => ({ label: e.label, value: e.value })),
      placeholder: "Todos los estados",
      valor: filtroStatus,
    },
    {
      etiqueta: "Objeto",
      id: "objeto",
      onChange: setFiltroTipo,
      opciones: OBJETOS_NECESIDAD.map((o) => ({ label: o.label, value: o.value })),
      placeholder: "Todos los objetos",
      valor: filtroTipo,
    },
    {
      etiqueta: "Procedimiento",
      id: "procedimiento",
      onChange: setFiltroProceso,
      opciones: procesosDelObjeto.map((p) => ({ label: p.label, value: p.value })),
      placeholder: filtroTipo
        ? `Procedimientos de ${objetoNecesidadLabel(filtroTipo).toLowerCase()}`
        : "Todos los procedimientos",
      valor: filtroProceso,
    },
    {
      etiqueta: "Meta",
      id: "meta",
      onChange: setFiltroMeta,
      opciones: facetas.metas.map((m) => ({ label: m.valor, total: m.total, value: m.valor })),
      placeholder: "Todas las metas",
      valor: filtroMeta,
    },
    {
      etiqueta: "Oficina",
      id: "oficina",
      onChange: setFiltroOficina,
      opciones: facetas.areas.map((a) => ({ label: a.valor, total: a.total, value: a.valor })),
      placeholder: "Todas las oficinas",
      valor: filtroOficina,
    },
    {
      etiqueta: "Responsable",
      id: "responsable",
      onChange: setFiltroResponsable,
      opciones: facetas.responsables.map((r) => ({ label: r.valor, total: r.total, value: r.valor })),
      placeholder: "Todos los responsables",
      valor: filtroResponsable,
    },
  ];

  return (
    <div className="tw flex flex-col gap-5">
      {/* ── Barra de herramientas ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13.5px] leading-relaxed text-muted">
          Registro de necesidades del área usuaria. Cada una avanza por el flujo hasta incorporarse al
          Cuadro Multianual de Necesidades (CMN) y derivar en un expediente de contratación.
        </p>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.XLS,.XLSX"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportPedido(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              loading={importing}
              onClick={() => fileInputRef.current?.click()}
              title="Importar un pedido de compra del SIGA (.xls) y prellenar la necesidad"
            >
              {!importing ? <FileUp className="size-4" /> : null}
              {importing ? "Importando…" : "Importar pedido"}
            </Button>

            {/* Segunda forma de importar: buscar el pedido por su N° en vez de
                subir el archivo — ver app/api/necesidades/import-pedido-control. */}
            <Dialog open={nroPedidoDialogOpen} onOpenChange={setNroPedidoDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  title="Buscar un pedido por su número e importarlo (sin subir archivo)"
                >
                  <Hash className="size-4" />
                  Importar por N° de pedido
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Importar por N° de pedido"
                description="Escribe el número del pedido de compra; se busca y se prellena la necesidad automáticamente, sin subir ningún archivo."
                size="sm"
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="ghost" type="button" disabled={importingControl}>
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button
                      variant="primary"
                      type="submit"
                      form="import-nro-pedido-form"
                      loading={importingControl}
                      disabled={!nroPedidoInput.trim()}
                    >
                      Buscar e importar
                    </Button>
                  </>
                }
              >
                <form
                  id="import-nro-pedido-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleImportPedidoControl();
                  }}
                >
                  <Field label="N° de pedido">
                    <Input
                      autoFocus
                      value={nroPedidoInput}
                      onChange={(event) => setNroPedidoInput(event.target.value)}
                      placeholder="Ej. 1388"
                      disabled={importingControl}
                    />
                  </Field>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={formOpen}
              onOpenChange={(open) => {
                setFormOpen(open);
                if (!open) {
                  setImportedItem(null);
                  setImportInfo(null);
                  setOptionalOpen(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="primary">
                  <Plus className="size-4" />
                  Nueva necesidad
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Nueva necesidad"
                description="Registra los datos obligatorios. Los opcionales puedes completarlos ahora o después desde la ficha de detalle."
                size="md"
                banner={
                  importInfo ? (
                    <Alert tone="info">
                      <FileUp className="inline size-3.5 -translate-y-px" /> Prellenado desde el pedido de compra
                      SIGA N° <strong>{importInfo.nro}</strong>
                      {importInfo.count > 1
                        ? ` · el pedido trae ${importInfo.count} ítems, todos incluidos en esta necesidad (un solo expediente)`
                        : ""}
                      . Revisa y completa lo que falte.
                    </Alert>
                  ) : undefined
                }
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button variant="primary" type="submit" form="nueva-necesidad-form" loading={saving}>
                      {!saving ? <Plus className="size-4" /> : null}
                      Registrar necesidad
                    </Button>
                  </>
                }
              >
                <form id="nueva-necesidad-form" onSubmit={createNecesidad} className="grid gap-3.5">
                  <Field label="Nombre de la contratación" required>
                    <Input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Adquisición de equipos de cómputo"
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="Tipo de objeto" required>
                      <Select value={tipoObjeto} onChange={(e) => setTipoObjeto(e.target.value)}>
                        {OBJETOS_NECESIDAD.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tipo de área solicitante" required>
                      <Select value={tipoArea} onChange={(e) => setTipoArea(e.target.value)}>
                        {TIPO_AREA_OPCIONES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field label="Área usuaria" required help="Escribe o elige la oficina solicitante.">
                    <Input
                      list="oficinas-datalist"
                      value={areaUsuaria}
                      onChange={(e) => setAreaUsuaria(e.target.value)}
                      placeholder="Oficina que solicita la contratación"
                    />
                    <datalist id="oficinas-datalist">
                      {oficinas.map((o) => (
                        <option key={o.id} value={o.nombre} />
                      ))}
                    </datalist>
                  </Field>

                  {optionalOpen ? (
                    <div className="grid gap-3.5 rounded-[12px] border border-dashed border-line bg-surface p-3.5">
                      <Field label="Meta presupuestal" required={false}>
                        <Input
                          value={metaPresupuestal}
                          onChange={(e) => setMetaPresupuestal(e.target.value)}
                          placeholder="Meta 0001"
                        />
                      </Field>
                      <Field
                        label="Proyecto de inversión"
                        required={false}
                        help="Nombre del proyecto en Invierte.pe (el CUI se registra aparte)."
                      >
                        <Textarea
                          value={proyectoInversion}
                          onChange={(e) => setProyectoInversion(e.target.value)}
                          placeholder="MEJORAMIENTO DEL SERVICIO DE…"
                          rows={filasTextarea(proyectoInversion)}
                        />
                      </Field>
                      <Field label="Finalidad pública" required={false}>
                        <Input
                          value={finalidadPublica}
                          onChange={(e) => setFinalidadPublica(e.target.value)}
                          placeholder="Necesidad pública que se satisface"
                        />
                      </Field>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOptionalOpen(true)}
                      className="inline-flex items-center gap-1.5 justify-self-start rounded-lg px-1 text-[13px] font-semibold text-brand hover:underline"
                    >
                      <Plus className="size-3.5" /> Mostrar campos opcionales (finalidad, meta…)
                    </button>
                  )}
                </form>
              </DialogContent>
            </Dialog>

            {/* Diálogo de importación en lote (varios pedidos → varias necesidades). */}
            <Dialog
              open={listOpen}
              onOpenChange={(open) => {
                setListOpen(open);
                if (!open) {
                  setImportItems([]);
                  setImportExpandido(new Set());
                }
              }}
            >
              <DialogContent
                title={`Importar — ${importItems.length} pedido${importItems.length === 1 ? "" : "s"}`}
                description="Cada pedido se registra como una sola necesidad (un expediente), aunque traiga varios ítems. Selecciona los pedidos a registrar; cada ficha podrás completarla después desde su detalle."
                size="lg"
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button
                      variant="primary"
                      loading={creatingBatch}
                      disabled={importSelected.size === 0}
                      onClick={createBatch}
                    >
                      {!creatingBatch ? <Plus className="size-4" /> : null}
                      Crear {importSelected.size} necesidad{importSelected.size === 1 ? "" : "es"}
                    </Button>
                  </>
                }
              >
                <datalist id="oficinas-datalist-lote">
                  {oficinas.map((o) => (
                    <option key={o.id} value={o.nombre} />
                  ))}
                </datalist>
                <div className="flex flex-col gap-2">
                  {importItems.map((it, i) => {
                    const checked = importSelected.has(i);
                    const expandido = importExpandido.has(i);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-[12px] border transition",
                          checked ? "border-brand/40 bg-brand-soft" : "border-line bg-panel hover:border-brand/25",
                        )}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImportSel(i)}
                            className="mt-2.5 size-4 shrink-0 accent-brand"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{it.nombre}</p>
                            <p className="mt-0.5 text-[12px] text-muted">
                              {it.nroPedido ? `Pedido N° ${it.nroPedido} · ` : ""}
                              {it.tipoObjeto === "servicios" ? "Servicio" : "Bien"}
                              {it.areaUsuaria ? ` · ${it.areaUsuaria}` : ""}
                              {it.cantidad != null ? ` · ${it.cantidad} ${it.unidadMedida ?? ""}` : ""}
                              {it.montoEstimado != null ? ` · S/ ${it.montoEstimado.toLocaleString("es-PE")}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleImportExpandido(i)}
                            className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand hover:bg-brand/10"
                          >
                            {expandido ? "Ocultar" : "Editar / ver detalle"}
                            <ChevronDown className={cn("size-3.5 transition-transform", expandido ? "rotate-180" : "")} />
                          </button>
                        </div>

                        {/* Igual que el modal de un solo pedido: los mismos campos
                            editables, para poder corregir CUALQUIER pedido de la
                            lista antes de crear — no solo revisarlo de lejos. */}
                        {expandido ? (
                          <div className="mx-3 mb-3 grid gap-3 rounded-[10px] border border-line bg-canvas p-3">
                            <Field label="Nombre de la contratación" required>
                              <Input
                                value={it.nombre}
                                onChange={(e) => actualizarImportItem(i, { nombre: e.target.value })}
                              />
                            </Field>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <Field label="Tipo de objeto" required>
                                <Select
                                  value={it.tipoObjeto}
                                  onChange={(e) =>
                                    actualizarImportItem(i, { tipoObjeto: e.target.value as PedidoNecesidadImport["tipoObjeto"] })
                                  }
                                >
                                  {OBJETOS_NECESIDAD.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Meta presupuestal">
                                <Input
                                  value={it.metaPresupuestal ?? ""}
                                  onChange={(e) => actualizarImportItem(i, { metaPresupuestal: e.target.value })}
                                />
                              </Field>
                            </div>
                            <Field label="Área usuaria" required help="Escribe o elige la oficina solicitante.">
                              <Input
                                list="oficinas-datalist-lote"
                                value={it.areaUsuaria ?? ""}
                                onChange={(e) => actualizarImportItem(i, { areaUsuaria: e.target.value })}
                              />
                            </Field>
                            <Field label="Proyecto de inversión" help="Nombre del proyecto en Invierte.pe.">
                              <Textarea
                                value={it.proyectoInversion ?? ""}
                                onChange={(e) => actualizarImportItem(i, { proyectoInversion: e.target.value })}
                                rows={filasTextarea(it.proyectoInversion ?? "")}
                              />
                            </Field>
                            <Field label="Finalidad pública">
                              <Input
                                value={it.finalidadPublica ?? ""}
                                onChange={(e) => actualizarImportItem(i, { finalidadPublica: e.target.value })}
                                placeholder="Necesidad pública que se satisface"
                              />
                            </Field>

                            {it.items && it.items.length > 0 ? (
                              <table className="w-full border-collapse text-[12px]">
                                <thead>
                                  <tr className="border-b border-line text-left text-muted">
                                    <th className="py-1 pr-2 font-medium">Ítem</th>
                                    <th className="py-1 pr-2 font-medium">Cant.</th>
                                    <th className="py-1 pr-2 font-medium">Unidad</th>
                                    <th className="py-1 text-right font-medium">Costo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {it.items.map((linea, j) => (
                                    <tr key={j} className="border-b border-line/60 last:border-0">
                                      <td className="py-1 pr-2 text-ink">{linea.descripcion}</td>
                                      <td className="py-1 pr-2 text-muted">{linea.cantidad ?? "—"}</td>
                                      <td className="py-1 pr-2 text-muted">{linea.unidadMedida ?? "—"}</td>
                                      <td className="py-1 text-right text-muted">
                                        {linea.costoTotal != null ? `S/ ${linea.costoTotal.toLocaleString("es-PE")}` : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      </div>

      {!canManage ? (
        <Alert tone="info">
          Tu perfil no registra necesidades. Puede hacerlo quien tenga rol{" "}
          <strong>{rolesConCapacidad("necesidad.manage").join(", ")}</strong>.
        </Alert>
      ) : null}

      {/* ── Tablero de la cola ────────────────────────────────────────────── */}
      {Object.keys(conteoEstados).length > 0 ? (
        <div className="rounded-[14px] border border-line bg-panel p-3 shadow-card">
          <div className="mb-2 flex items-center gap-2 px-0.5">
            <Inbox className="size-3.5 text-muted" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Cola de trabajo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {portafolio.porVencer > 0 ? (
              <QueueChip
                icon={<AlarmClock className="size-3.5" />}
                label="Por vencer"
                count={portafolio.porVencer}
                active={vista === "por_vencer"}
                tone="warning"
                title="Fecha requerida próxima o pasada y aún sin derivar"
                onClick={() => {
                  setVista((v) => (v === "por_vencer" ? "" : "por_vencer"));
                  setFiltroStatus("");
                  setSoloMisPendientes(false);
                }}
              />
            ) : null}
            {portafolio.estancadas > 0 ? (
              <QueueChip
                icon={<Hourglass className="size-3.5" />}
                label="Estancadas"
                count={portafolio.estancadas}
                active={vista === "estancadas"}
                tone="warning"
                title="En espera de acción y sin cambios desde hace 7+ días"
                onClick={() => {
                  setVista((v) => (v === "estancadas" ? "" : "estancadas"));
                  setFiltroStatus("");
                  setSoloMisPendientes(false);
                }}
              />
            ) : null}
            {mostrarBandeja ? (
              <QueueChip
                icon={<Inbox className="size-3.5" />}
                label="Lo que me toca"
                count={misPendientesTotal}
                active={soloMisPendientes}
                tone="brand"
                title="Necesidades que esperan tu acción (según tu rol)"
                onClick={() => {
                  setSoloMisPendientes((v) => !v);
                  setFiltroStatus("");
                  setVista("");
                }}
              />
            ) : null}

            {(portafolio.porVencer > 0 || portafolio.estancadas > 0 || mostrarBandeja) ? (
              <span className="mx-1 my-1 w-px self-stretch bg-line" aria-hidden />
            ) : null}

            {NECESIDAD_ESTADOS.filter((e) => (conteoEstados[e.value] ?? 0) > 0).map((e) => {
              const activo = !soloMisPendientes && !vista && filtroStatus === e.value;
              return (
                <QueueChip
                  key={e.value}
                  label={e.label}
                  count={conteoEstados[e.value]}
                  active={activo}
                  estadoTono={e.tono}
                  title={e.descripcion}
                  onClick={() => {
                    setSoloMisPendientes(false);
                    setVista("");
                    setFiltroStatus(activo ? "" : e.value);
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <FiltrosBar
        busqueda={searchQ}
        onBusqueda={setSearchQ}
        placeholderBusqueda="Buscar por nombre, código o área…  (pulsa «/»)"
        filtros={filtrosNecesidad}
        inputRef={searchRef}
        resultados={
          loading ? undefined : { hayMas: hasMore, sustantivo: ["necesidad", "necesidades"], total: necesidades.length }
        }
      />

      {/* ── Orden + presentación ──────────────────────────────────────────── */}
      {!loading && necesidades.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <ArrowUpDown className="size-3.5" aria-hidden />
            Ordenar
            <Select
              aria-label="Ordenar la lista"
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenNecesidad)}
              className="h-9 w-auto text-[13px]"
            >
              {ORDEN_OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <div
            className="inline-flex overflow-hidden rounded-[10px] border border-line bg-surface"
            role="group"
            aria-label="Presentación"
          >
            {[
              { modo: "cards" as const, icono: <LayoutGrid className="size-4" />, titulo: "Ver como tarjetas" },
              { modo: "tabla" as const, icono: <Rows3 className="size-4" />, titulo: "Ver como tabla" },
            ].map((v, i) => (
              <button
                key={v.modo}
                type="button"
                onClick={() => setPresentacion(v.modo)}
                aria-pressed={presentacion === v.modo}
                title={v.titulo}
                className={cn(
                  "grid size-9 cursor-pointer place-items-center text-muted outline-none transition-colors duration-150",
                  "focus-visible:relative focus-visible:z-10 focus-visible:shadow-[var(--shadow-focus)]",
                  i > 0 && "border-l border-line",
                  presentacion === v.modo ? "bg-brand text-white" : "hover:bg-brand-soft hover:text-brand",
                )}
              >
                {v.icono}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : necesidades.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={hayFiltros ? "Sin resultados" : canManage ? "Aún no hay necesidades" : "Nada que mostrar"}
          description={
            hayFiltros
              ? "No se encontraron necesidades con los filtros seleccionados. Prueba a quitar alguno."
              : canManage
                ? 'Registra la primera con el botón "Nueva necesidad", o importa un pedido de compra del SIGA.'
                : `Registrar necesidades requiere rol ${rolesConCapacidad("necesidad.manage").join(", ")}.`
          }
          action={
            !hayFiltros && canManage ? (
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" /> Nueva necesidad
              </Button>
            ) : undefined
          }
        />
      ) : presentacion === "tabla" ? (
        <>
          <NecTabla
            necesidades={necesidades}
            entityName={configuredEntity?.name}
            lado={lado}
            seleccionado={seleccionado}
          />

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                {!loadingMore ? <ChevronDown className="size-4" /> : null}
                {loadingMore ? "Cargando…" : "Mostrar más"}
              </Button>
            </div>
          ) : necesidades.length > PAGE_SIZE ? (
            <p className="pt-1 text-center text-[12px] text-muted">
              Mostrando todas las necesidades ({necesidades.length})
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {necesidades.map((necesidad, i) => (
              <NecCard
                key={necesidad.id}
                necesidad={necesidad}
                entityName={configuredEntity?.name}
                lado={lado}
                indice={i}
                seleccionado={seleccionado === i}
              />
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                {!loadingMore ? <ChevronDown className="size-4" /> : null}
                {loadingMore ? "Cargando…" : "Mostrar más"}
              </Button>
            </div>
          ) : necesidades.length > PAGE_SIZE ? (
            <p className="pt-1 text-center text-[12px] text-muted">
              Mostrando todas las necesidades ({necesidades.length})
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Chip del tablero de la cola. `tone` para los destacados (marca/aviso) y
 *  `estadoTono` para teñir los contadores por estado del flujo. */
function QueueChip({
  icon,
  label,
  count,
  active,
  tone,
  estadoTono,
  title,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
  tone?: "brand" | "warning";
  estadoTono?: TonoEstado;
  title?: string;
  onClick: () => void;
}) {
  const estadoStyle = estadoTono
    ? { color: `var(--tono-${estadoTono}-ink)`, background: active ? undefined : `var(--tono-${estadoTono}-bg)` }
    : undefined;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      style={estadoStyle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
        "outline-none focus-visible:shadow-[var(--shadow-focus)]",
        // Destacados
        tone === "brand" &&
          (active
            ? "border-brand bg-brand text-white"
            : "border-brand/30 bg-brand-soft text-brand hover:border-brand/50"),
        tone === "warning" &&
          (active
            ? "border-warning bg-warning text-white"
            : "border-warning/30 bg-warning-soft text-warning hover:border-warning/50"),
        // Estados del flujo
        estadoTono && (active ? "border-transparent ring-2 ring-current ring-offset-1 ring-offset-panel" : "border-transparent"),
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
          active && (tone === "brand" || tone === "warning") ? "bg-white/25 text-white" : "bg-current/15",
        )}
      >
        <span className={active && (tone === "brand" || tone === "warning") ? "" : "text-ink/70"}>{count}</span>
      </span>
    </button>
  );
}

/**
 * Tarjeta de una necesidad en la lista.
 *
 * Memoizada: la navegación por teclado (j/k/↑/↓) solo cambia `seleccionado` de
 * DOS tarjetas (la que sale y la que entra); sin `memo`, cambiarlo repintaba las
 * N tarjetas y recalculaba en cada una antigüedad/urgencia/próximo paso. Todas
 * las props son estables por identidad salvo `seleccionado` (booleano), así que
 * la comparación superficial por defecto basta.
 */
const NecCard = memo(function NecCard({
  necesidad,
  entityName,
  lado,
  indice,
  seleccionado,
}: {
  necesidad: NecesidadExt;
  entityName?: string | null;
  lado: Lado;
  indice: number;
  seleccionado: boolean;
}) {
  const tono = necesidadStatusTono(necesidad.status);
  const ant = antiguedadEstado(necesidad.status, necesidad.updated_at);
  const urg = urgenciaFecha(necesidad.fecha_requerida, necesidad.status);
  const paso = proximoPaso(necesidad.status, lado, Boolean(necesidad.process_id));

  return (
    <div
      data-nec-idx={indice}
      // content-visibility: el navegador no pinta las tarjetas fuera de pantalla
      // (listas largas tras «Mostrar más»); el tamaño intrínseco evita saltos.
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 260px" }}
      className={cn("rounded-[14px]", seleccionado && "ring-2 ring-brand")}
    >
    <Card interactive accent={TONO_COLOR[tono]} className="group p-0">
      <Link href={`/necesidades/${necesidad.id}`} className="flex h-full flex-col gap-2.5 p-4 pl-5">
        <div className="flex items-center justify-between gap-2">
          <code className="truncate rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted">
            {necesidad.codigo?.trim() || "Sin código"}
          </code>
          <Badge tone={tono} dot>
            {necesidadStatusLabel(necesidad.status)}
          </Badge>
        </div>

        {ant ? (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              ant.atrasado ? "bg-warning-soft text-warning" : "bg-ink/[0.04] text-muted",
            )}
          >
            <Clock className="size-3" aria-hidden /> {ant.texto} en este estado
          </span>
        ) : null}

        <p
          className="line-clamp-2 text-[15px] font-bold leading-snug text-ink group-hover:text-brand"
          title={necesidad.nombre}
        >
          {necesidad.nombre}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="objeto">
            {necesidad.tipo_objeto ? objetoNecesidadLabel(necesidad.tipo_objeto) : "Objeto sin definir"}
          </Badge>
          <Badge tone="neutral" title={necesidad.tipo_proceso_seleccion ?? undefined}>
            {necesidad.tipo_proceso_seleccion?.trim() || "Procedimiento por definir"}
          </Badge>
        </div>

        <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
          <DatoCard icon={<Building2 className="size-3" />} label="Oficina" value={necesidad.area_usuaria?.trim() || entityName || "Sin área"} />
          <DatoCard icon={<Target className="size-3" />} label="Meta" value={necesidad.meta_presupuestal?.trim() || "—"} />
          <DatoCard icon={<Coins className="size-3" />} label="Monto estimado" value={formatearMonto(necesidad.monto_estimado)} />
          <DatoCard
            icon={<CalendarClock className="size-3" />}
            label="Se necesita"
            value={
              <span
                className={cn(
                  "font-semibold",
                  urg === "vencida" && "text-danger",
                  urg === "pronto" && "text-warning",
                )}
              >
                {formatearFecha(necesidad.fecha_requerida)}
                {urg === "vencida" ? " · vencida" : urg === "pronto" ? " · pronto" : ""}
              </span>
            }
          />
        </dl>

        {/* Próximo paso: qué toca y de quién depende (no solo el estado). */}
        <div className="flex flex-wrap items-center gap-1.5">
          {paso.miTurno ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
              <ArrowRight className="size-3" aria-hidden /> Te toca: {paso.etiqueta}
            </span>
          ) : paso.tono === "muted" ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-ink/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted">
              {paso.etiqueta}
            </span>
          ) : null}
          {necesidad.process_id ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
              <FolderCheck className="size-3" aria-hidden /> Con expediente abierto
            </span>
          ) : null}
        </div>
      </Link>
    </Card>
    </div>
  );
});

function DatoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[13px] text-ink" title={typeof value === "string" ? value : undefined}>
        {value}
      </dd>
    </div>
  );
}

/** Vista compacta en tabla: densidad para comparar muchas filas de un vistazo.
 *  La fila entera navega al detalle; el enlace del nombre da el objetivo
 *  accesible por teclado y lector de pantalla. */
function NecTabla({
  necesidades,
  entityName,
  lado,
  seleccionado,
}: {
  necesidades: NecesidadExt[];
  entityName?: string | null;
  lado: Lado;
  seleccionado: number;
}) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-panel shadow-card">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-line bg-surface text-left text-[10.5px] uppercase tracking-[0.05em] text-muted">
            <th className="px-4 py-2.5 font-semibold">Estado</th>
            <th className="px-4 py-2.5 font-semibold">Necesidad</th>
            <th className="px-4 py-2.5 font-semibold">Objeto</th>
            <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
            <th className="px-4 py-2.5 font-semibold">Se necesita</th>
            <th className="px-4 py-2.5 font-semibold">Próximo paso</th>
          </tr>
        </thead>
        <tbody>
          {necesidades.map((n, i) => {
            const tono = necesidadStatusTono(n.status);
            const urg = urgenciaFecha(n.fecha_requerida, n.status);
            const ant = antiguedadEstado(n.status, n.updated_at);
            const paso = proximoPaso(n.status, lado, Boolean(n.process_id));
            return (
              <tr
                key={n.id}
                data-nec-idx={i}
                onClick={() => router.push(`/necesidades/${n.id}`)}
                className={cn(
                  "cursor-pointer border-b border-line/60 outline-none transition-colors duration-150 last:border-0",
                  "hover:bg-brand-soft/40 focus-visible:bg-brand-soft/40",
                  seleccionado === i && "bg-brand-soft/60",
                )}
              >
                <td className="px-4 py-3 align-middle">
                  <Badge tone={tono} dot>
                    {necesidadStatusLabel(n.status)}
                  </Badge>
                </td>
                <td className="max-w-[380px] px-4 py-3 align-middle">
                  <Link
                    href={`/necesidades/${n.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold leading-snug text-ink hover:text-brand"
                  >
                    <span className="line-clamp-1">{n.nombre}</span>
                  </Link>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">
                    {n.codigo?.trim() || "Sin código"} · {n.area_usuaria?.trim() || entityName || "Sin área"}
                    {ant ? (
                      <span className={cn("ml-1", ant.atrasado && "font-semibold text-warning")}>· {ant.texto}</span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle text-muted">
                  {n.tipo_objeto ? objetoNecesidadLabel(n.tipo_objeto) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                  {formatearMonto(n.monto_estimado)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-3 align-middle font-medium",
                    urg === "vencida" && "text-danger",
                    urg === "pronto" && "text-warning",
                  )}
                >
                  {formatearFecha(n.fecha_requerida)}
                  {urg === "vencida" ? " · vencida" : urg === "pronto" ? " · pronto" : ""}
                </td>
                <td className="px-4 py-3 align-middle">
                  {paso.miTurno ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-brand">
                      <ArrowRight className="size-3" aria-hidden /> {paso.etiqueta}
                    </span>
                  ) : (
                    <span className="text-muted">{paso.etiqueta}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
