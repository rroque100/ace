"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Briefcase, ChevronDown, FileStack, Loader, Plus } from "lucide-react";
import {
  objectTypeLabel,
  processStatusLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { processLabelFromOptions, useSettingsCatalog, withBlankProcessOption } from "./use-settings-catalog";
import { BarraFiltros, type DefinicionFiltro, type OpcionFiltro } from "./barra-filtros";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { OBJECT_TYPES, PROCESS_STATUSES } from "@/lib/legal-taxonomy";
import { FASES, type FaseProgress } from "@/lib/procurement-fases";
import { Badge, Button, Card, EmptyState } from "./ui";
import type { BadgeTone } from "./ui/badge";
import { FICHA_CTRL, FICHA_CTRL_H, FICHA_LABEL } from "./necesidad/ficha-estilos";
import { cn } from "@/lib/utils";

/**
 * Tono del badge de estado. Fiel al CSS anterior: la mayoría de estados salían
 * con el pill de marca (brand-soft, = "progreso"); `desierto` iba en rojo, y
 * `archivo` se trata como terminal (cierre) por claridad.
 */
function procesoTono(status: string): BadgeTone {
  if (status === "desierto") return "peligro";
  if (status === "archivo") return "terminal";
  return "progreso";
}

type NecesidadEmbebida = {
  codigo: string | null;
  area_usuaria: string | null;
  meta_presupuestal: string | null;
  fecha_requerida: string | null;
};

type Process = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  valor_estimado: number | null;
  entity: string | null;
  status: string;
  /** Avance de la fase actual, precalculado en el servidor (antes se enviaba el
   *  jsonb `hitos` entero y se calculaba en el cliente). */
  avance: FaseProgress | null;
  updated_at: string;
  /** Llega como array: PostgREST resuelve la relación por `necesidades.process_id`. */
  necesidades: NecesidadEmbebida[] | null;
};

type Faceta = { valor: string; total: number };

const PAGE_SIZE = 24;

/**
 * Fase en la que está el expediente, según su estado.
 *
 * Sale del mismo catálogo que usa el panel de fases, así que no hay dos listas
 * de estados que puedan desincronizarse.
 */
function faseDelEstado(status: string): (typeof FASES)[number] | undefined {
  return FASES.find((f) => f.statuses.includes(status));
}

/** Fecha corta sin pasar por `new Date`, que aplicaría zona horaria. */
function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "—";
}

function formatAmount(amount: number | null) {
  if (amount == null) return "—";
  return `S/ ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

/** Monto a enseñar: manda el valor estimado (lo fija A5) sobre el importe suelto. */
function montoDelExpediente(p: Process): number | null {
  const valor = p.valor_estimado ?? p.amount;
  return valor == null ? null : Number(valor);
}

type NecesidadConforme = {
  id: string;
  codigo: string | null;
  nombre: string;
  tipo_objeto: string;
  area_usuaria: string | null;
};

export function ProcessList({ canManage }: { canManage: boolean }) {
  const { processTypes: configuredProcessTypes } = useSettingsCatalog();
  const procedureTypes = withBlankProcessOption(configuredProcessTypes, "Sin definir");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // El expediente se crea derivando una necesidad en estado Conforme.
  const [procedureType, setProcedureType] = useState("");
  const [necesidadesConformes, setNecesidadesConformes] = useState<NecesidadConforme[]>([]);
  const [selectedNecesidadId, setSelectedNecesidadId] = useState("");
  const [loadingNecesidades, setLoadingNecesidades] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebouncedValue(busqueda, 300);
  const [fFase, setFFase] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fObjeto, setFObjeto] = useState("");
  const [fProcedimiento, setFProcedimiento] = useState("");
  const [fOficina, setFOficina] = useState("");
  const [fMeta, setFMeta] = useState("");
  const [facetas, setFacetas] = useState<{ oficinas: Faceta[]; metas: Faceta[] }>({
    oficinas: [],
    metas: [],
  });
  const [page, setPage] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(
    async (pagina: number, anexar: boolean) => {
      // Cancelar la anterior: al teclear en el buscador salen varias en vuelo y
      // sin esto la lista puede quedarse con la respuesta de una búsqueda vieja.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pagina) });
      if (busquedaDebounced) params.set("search", busquedaDebounced);
      if (fFase) params.set("fase", fFase);
      if (fEstado) params.set("status", fEstado);
      if (fObjeto) params.set("object_type", fObjeto);
      if (fProcedimiento) params.set("procedure_type", fProcedimiento);
      if (fOficina) params.set("oficina", fOficina);
      if (fMeta) params.set("meta", fMeta);

      if (anexar) setCargandoMas(true);
      else setLoading(true);
      try {
        const response = await fetch(`/api/processes?${params}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const payload = await response.json();
        if (ac.signal.aborted) return;
        if (!response.ok) {
          setError(payload.error ?? "No se pudieron cargar los expedientes.");
          return;
        }
        const items: Process[] = payload.processes ?? [];
        setProcesses((prev) => (anexar ? [...prev, ...items] : items));
        setHayMas(items.length === PAGE_SIZE);
        setError("");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("No se pudo conectar con el servidor.");
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false);
          setCargandoMas(false);
        }
      }
    },
    [busquedaDebounced, fFase, fEstado, fObjeto, fProcedimiento, fOficina, fMeta],
  );

  /** Recarga desde la primera página, para después de crear un expediente. */
  async function reload() {
    setPage(1);
    await cargar(1, false);
  }

  useEffect(() => {
    setPage(1);
    void cargar(1, false);
    return () => abortRef.current?.abort();
  }, [cargar]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await fetch("/api/processes/facetas", { cache: "no-store" });
        const payload = await res.json();
        if (!cancelado) {
          setFacetas({ oficinas: payload.oficinas ?? [], metas: payload.metas ?? [] });
        }
      } catch {
        // Sin facetas, esos dos desplegables salen vacíos y el resto funciona.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const aOpciones = (f: Faceta[]): OpcionFiltro[] =>
    f.map((x) => ({ label: x.valor, total: x.total, value: x.valor }));

  /**
   * Estados que se ofrecen: los de la fase elegida, o todos.
   *
   * Ofrecer "Buena pro" con la Fase 1 seleccionada sería ofrecer una combinación
   * que nunca devuelve nada.
   */
  const estadosOfrecidos = PROCESS_STATUSES.filter(
    (e) => !fFase || (FASES.find((f) => f.id === fFase)?.statuses ?? []).includes(e.value),
  );

  useEffect(() => {
    if (fEstado && !estadosOfrecidos.some((e) => e.value === fEstado)) setFEstado("");
  }, [fEstado, estadosOfrecidos]);

  const filtros: DefinicionFiltro[] = [
    {
      etiqueta: "Fase",
      id: "fase",
      onChange: setFFase,
      opciones: FASES.map((f) => ({ label: `Fase ${f.numero} · ${f.label}`, value: f.id })),
      placeholder: "Todas las fases",
      valor: fFase,
    },
    {
      etiqueta: "Estado",
      id: "estado",
      onChange: setFEstado,
      opciones: estadosOfrecidos.map((e) => ({ label: e.label, value: e.value })),
      placeholder: "Todos los estados",
      valor: fEstado,
    },
    {
      etiqueta: "Objeto",
      id: "objeto",
      onChange: setFObjeto,
      opciones: OBJECT_TYPES.map((o) => ({ label: o.label, value: o.value })),
      placeholder: "Todos los objetos",
      valor: fObjeto,
    },
    {
      etiqueta: "Procedimiento",
      id: "procedimiento",
      onChange: setFProcedimiento,
      opciones: procedureTypes
        .filter((p) => p.value)
        .map((p) => ({ label: p.label, value: p.value })),
      placeholder: "Todos los procedimientos",
      valor: fProcedimiento,
    },
    {
      etiqueta: "Oficina",
      id: "oficina",
      onChange: setFOficina,
      opciones: aOpciones(facetas.oficinas),
      placeholder: "Todas las oficinas",
      valor: fOficina,
    },
    {
      etiqueta: "Meta",
      id: "meta",
      onChange: setFMeta,
      opciones: aOpciones(facetas.metas),
      placeholder: "Todas las metas",
      valor: fMeta,
    },
  ];

  const hayFiltros = Boolean(
    busquedaDebounced || fFase || fEstado || fObjeto || fProcedimiento || fOficina || fMeta,
  );

  async function openForm() {
    setShowForm(true);
    setSelectedNecesidadId("");
    setError("");
    setLoadingNecesidades(true);
    try {
      const res = await fetch("/api/necesidades?status=conforme&limit=100", { cache: "no-store" });
      const payload = await res.json();
      setNecesidadesConformes(payload.necesidades ?? []);
    } catch {
      setError("No se pudieron cargar las necesidades conformes.");
    } finally {
      setLoadingNecesidades(false);
    }
  }

  async function deriveExpediente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNecesidadId) {
      setError("Selecciona una necesidad en estado Conforme.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/necesidades/${selectedNecesidadId}/derivar`, {
        body: JSON.stringify({ procedureType: procedureType || undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo crear el expediente.");
        return;
      }
      // Lleva al expediente recién creado (Fase 1 precargada desde la necesidad).
      if (payload.process?.id) {
        window.location.href = `/expedientes/${payload.process.id}`;
        return;
      }
      setShowForm(false);
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tw flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Mis expedientes</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Procedimientos de contratación con sus documentos, evaluaciones y riesgos.
          </p>
        </div>
        {canManage ? (
          <Button variant="primary" onClick={() => (showForm ? setShowForm(false) : void openForm())}>
            <Plus size={17} /> Nuevo expediente
          </Button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <form
          className="grid gap-3.5 rounded-[14px] border border-line bg-panel p-4 shadow-card sm:grid-cols-2"
          onSubmit={deriveExpediente}
        >
          <p className="text-[12.5px] leading-relaxed text-muted sm:col-span-2">
            El expediente se crea a partir de una{" "}
            <strong className="font-semibold text-ink">necesidad en estado Conforme</strong>{" "}
            (requerimiento aprobado y CMN verificado). Sus datos se precargan en la Fase 1.
          </p>
          {loadingNecesidades ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted sm:col-span-2">
              <Loader size={14} /> Cargando necesidades…
            </p>
          ) : necesidadesConformes.length === 0 ? (
            <p className="text-[12.5px] text-muted sm:col-span-2">
              No hay necesidades en estado Conforme. Regístralas y llévalas a «Conforme» en{" "}
              <Link className="font-semibold text-brand hover:underline" href="/necesidades">Necesidades</Link>.
            </p>
          ) : (
            <>
              <label className="flex flex-col sm:col-span-2">
                <span className={FICHA_LABEL}>Necesidad conforme *</span>
                <select
                  className={cn(FICHA_CTRL, FICHA_CTRL_H)}
                  onChange={(event) => setSelectedNecesidadId(event.target.value)}
                  value={selectedNecesidadId}
                >
                  <option value="">— Selecciona una necesidad —</option>
                  {necesidadesConformes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.codigo ? `${n.codigo} · ` : ""}
                      {n.nombre}
                      {n.area_usuaria ? ` — ${n.area_usuaria}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col">
                <span className={FICHA_LABEL}>Procedimiento registrado en el PAC</span>
                <select
                  className={cn(FICHA_CTRL, FICHA_CTRL_H)}
                  onChange={(event) => setProcedureType(event.target.value)}
                  value={procedureType}
                >
                  {procedureTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end sm:col-span-2">
                <Button variant="primary" type="submit" disabled={saving || !selectedNecesidadId} loading={saving}>
                  {!saving ? <Plus size={16} /> : null} Crear expediente
                </Button>
              </div>
            </>
          )}
        </form>
      ) : null}

      {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}

      <BarraFiltros
        busqueda={busqueda}
        filtros={filtros}
        onBusqueda={setBusqueda}
        placeholderBusqueda="Buscar por nomenclatura o entidad..."
        resultados={
          loading
            ? undefined
            : { hayMas, sustantivo: ["expediente", "expedientes"], total: processes.length }
        }
      />

      {loading ? (
        <p className="text-[13px] text-muted">Cargando expedientes…</p>
      ) : processes.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title={hayFiltros ? "Sin coincidencias" : "Aún no hay expedientes"}
          description={
            hayFiltros
              ? "Ningún expediente coincide con los filtros aplicados."
              : canManage
                ? "Crea uno con «Nuevo expediente» a partir de una necesidad en estado Conforme."
                : "Crear y gestionar expedientes requiere un rol con gestión (DEC, AGA, Titular o administrador)."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {processes.map((process) => {
              const nec = process.necesidades?.[0];
              const fase = faseDelEstado(process.status);
              // El avance (completados/total de la fase actual) lo precalcula el
              // servidor y llega en `process.avance`; así la lista no transporta
              // el jsonb `hitos` entero (~10 KB/fila) solo para pintar dos enteros.
              const avance = process.avance;
              return (
                <Card key={process.id} interactive className="p-0">
                  <Link href={`/expedientes/${process.id}`} className="flex h-full flex-col gap-[7px] p-4">
                    <div className="flex items-center justify-between gap-2 text-brand">
                      <FileStack size={18} />
                      {nec?.codigo ? (
                        <code className="flex-1 truncate font-mono text-[11.5px] text-muted">{nec.codigo}</code>
                      ) : (
                        <span className="flex-1" />
                      )}
                      <Badge tone={procesoTono(process.status)}>{processStatusLabel(process.status)}</Badge>
                    </div>

                    <strong
                      className="line-clamp-2 text-[14px] font-semibold leading-[1.4] text-ink"
                      title={process.nomenclature}
                    >
                      {process.nomenclature}
                    </strong>

                    <div className="flex flex-wrap gap-[5px]">
                      <span className="max-w-full truncate rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        {objectTypeLabel(process.object_type)}
                      </span>
                      <span
                        className="max-w-full truncate rounded-full border border-line bg-brand-soft px-2 py-0.5 text-[11px] text-muted"
                        title={process.procedure_type ?? undefined}
                      >
                        {process.procedure_type
                          ? processLabelFromOptions(configuredProcessTypes, process.procedure_type) ??
                            processTypeLabel(process.procedure_type) ??
                            process.procedure_type
                          : "Procedimiento sin definir"}
                      </span>
                    </div>

                    {avance ? (
                      <div className="mt-px grid gap-1">
                        <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-muted">
                          <span>
                            Fase {fase!.numero} · {fase!.label}
                          </span>
                          <strong className="text-[12px] text-ink">
                            {avance.completados}/{avance.total}
                          </strong>
                        </div>
                        <div className="h-[5px] overflow-hidden rounded-full bg-brand-soft" role="presentation">
                          <div
                            className="h-full rounded-full bg-brand transition-[width] duration-200"
                            style={{ width: `${avance.porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <dl className="mt-0.5 grid grid-cols-2 gap-x-2.5 gap-y-1.5">
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.04em] text-muted">Oficina</dt>
                        <dd
                          className="mt-px line-clamp-2 text-[12px] leading-[1.35] text-ink"
                          title={nec?.area_usuaria ?? undefined}
                        >
                          {nec?.area_usuaria?.trim() || process.entity?.trim() || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.04em] text-muted">Meta</dt>
                        <dd
                          className="mt-px line-clamp-2 text-[12px] leading-[1.35] text-ink"
                          title={nec?.meta_presupuestal ?? undefined}
                        >
                          {nec?.meta_presupuestal?.trim() || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.04em] text-muted">Cuantía de la contratación</dt>
                        <dd className="mt-px line-clamp-2 text-[12px] leading-[1.35] text-ink">
                          {formatAmount(montoDelExpediente(process))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.04em] text-muted">Se necesita</dt>
                        <dd className="mt-px line-clamp-2 text-[12px] leading-[1.35] text-ink">
                          {fechaCorta(nec?.fecha_requerida ?? null)}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </Card>
              );
            })}
          </div>

          {hayMas ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                loading={cargandoMas}
                onClick={() => {
                  const siguiente = page + 1;
                  setPage(siguiente);
                  void cargar(siguiente, true);
                }}
              >
                {!cargandoMas ? <ChevronDown size={15} /> : null} Mostrar más
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
