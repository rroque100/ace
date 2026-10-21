"use client";

import { AlertTriangle, CalendarClock, User, Wallet } from "lucide-react";
import { useMemo } from "react";
import { BarraGuardado, NavAnclas, type EntityForm } from "./use-entity-form";
import { CronogramaDiasGrid } from "./cronograma-dias-grid";
import { ProcesosContratacionSection } from "./procesos-contratacion-section";
import { inputBase } from "./ui";
import type { Oficina } from "../oficinas/use-oficinas";
import { parseMonto } from "@/lib/configuracion-types";
import { avisosResoluciones, calcularPacObras } from "@/lib/configuracion-entidad";
import { fechaES } from "@/lib/fecha-es";
import { PORCENTAJE_LINEA_CORTE, soles } from "@/lib/segmentacion-parametros";
import { umbralContratoMenor } from "@/lib/umbral-contrato-menor";

const SECCIONES = [
  { id: "procesos-contratacion", label: "Procesos de contratación" },
  { id: "ejercicio", label: "Ejercicio fiscal" },
  { id: "aga", label: "Autoridad de gestión administrativa (AGA)" },
  { id: "resoluciones", label: "Resoluciones del PIA y PAC" },
  { id: "montos", label: "Montos del PAC" },
  { id: "uit", label: "UIT del ejercicio" },
  { id: "lpabreviada", label: "LP abreviada — bienes" },
  { id: "topes", label: "Topes por cuantía" },
  { id: "cronograma", label: "Días del cronograma" },
] as const;

/**
 * Variante "procesos de selección": la sección por-oficina «Procesos de
 * contratación», el ejercicio fiscal único, el AGA y los parámetros que deciden el
 * procedimiento (resoluciones, línea de corte, UIT, LP abreviada, topes, cronograma).
 */
export function ProcesosTab({
  form,
  oficinasContrataciones,
}: {
  form: EntityForm;
  oficinasContrataciones: Oficina[];
}) {
  const { formData, campo, handleChange, activeSection, ejercicioParametros, setEjercicioParametros } = form;

  // Tope del contrato menor en vivo (8 UIT). Se enseña aquí porque quien registra
  // la UIT no tiene por qué saber de memoria que son 8 UIT ni cuánto suman.
  const umbralResumen = useMemo(() => {
    const umbral = umbralContratoMenor(parseMonto(formData.uitValor));
    return umbral === null ? null : soles(umbral);
  }, [formData.uitValor]);

  // Rango de la LP abreviada para bienes, en vivo (solo si máximo ≥ mínimo).
  const lpAbreviadaResumen = useMemo(() => {
    const min = parseMonto(formData.lpAbreviadaBienesMin);
    const max = parseMonto(formData.lpAbreviadaBienesMax);
    if (min === null || max === null || min <= 0 || max < min) return null;
    return `${soles(min)} – ${soles(max)}`;
  }, [formData.lpAbreviadaBienesMin, formData.lpAbreviadaBienesMax]);

  const pacResumen = useMemo(() => {
    const bienesServicios = parseMonto(formData.pacMontoBienesServicios);
    if (bienesServicios === null || bienesServicios <= 0) return null;
    const total = parseMonto(formData.pacMontoTotal);
    const obras = calcularPacObras(formData.pacMontoTotal, formData.pacMontoBienesServicios);
    return {
      excede: total !== null && bienesServicios > total,
      lineaCorte: soles(Math.round(bienesServicios * PORCENTAJE_LINEA_CORTE * 100) / 100),
      obras: obras === "" ? "" : soles(Number(obras)),
      total: total === null ? "" : soles(total),
    };
  }, [formData.pacMontoBienesServicios, formData.pacMontoTotal]);

  // Cómo quedará la cita de las resoluciones en los informes exportados.
  const citasResoluciones = useMemo(() => {
    const cita = (numero: string | undefined, fecha: string | undefined) => {
      const n = (numero ?? "").trim();
      if (!n) return "";
      const f = fechaES(fecha);
      return f ? `${n}, del ${f}` : n;
    };
    return [
      { clave: "pia", etiqueta: "PIA", texto: cita(formData.piaResolutionNumber, formData.piaResolutionDate) },
      { clave: "pac", etiqueta: "PAC", texto: cita(formData.pacResolutionNumber, formData.pacResolutionDate) },
    ].filter((c) => c.texto !== "");
  }, [
    formData.pacResolutionDate,
    formData.pacResolutionNumber,
    formData.piaResolutionDate,
    formData.piaResolutionNumber,
  ]);

  const avisosResol = useMemo(
    () =>
      avisosResoluciones({
        ejercicio: formData.pacAnio,
        pacFecha: formData.pacResolutionDate,
        pacNumero: formData.pacResolutionNumber,
        piaFecha: formData.piaResolutionDate,
        piaNumero: formData.piaResolutionNumber,
      }),
    [
      formData.pacAnio,
      formData.pacResolutionDate,
      formData.pacResolutionNumber,
      formData.piaResolutionDate,
      formData.piaResolutionNumber,
    ],
  );

  return (
    <div className="tw flex flex-col gap-4">
      <p className="text-sm text-muted leading-relaxed max-w-[68ch] m-0">
        Parámetros que deciden el procedimiento de selección: la autoridad que aprueba (AGA), las
        resoluciones del PIA y PAC, la línea de corte, los topes por cuantía y los días del
        cronograma. Se guardan solos mientras escribes.
      </p>

      <NavAnclas secciones={SECCIONES} activeSection={activeSection} />

      <div className="flex flex-col gap-4">
        <ProcesosContratacionSection oficinas={oficinasContrataciones} />

        {/* ── Ejercicio fiscal único ─────────── */}
        <section id="ejercicio" data-section="ejercicio" className="border border-line rounded-lg bg-panel p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
            <CalendarClock size={14} /> Ejercicio fiscal de los parámetros
          </h2>
          <p className="text-sm text-muted leading-relaxed m-0 mb-3">
            El año al que corresponden los montos del PAC, la UIT, la LP abreviada, los topes por
            cuantía y los días del cronograma. Se aplica a todos a la vez.
          </p>
          <div className="flex items-start gap-4 flex-wrap">
            <label className="flex flex-col gap-1 w-[140px]">
              <span className="text-xs font-semibold text-muted">Ejercicio</span>
              <input
                className={`${inputBase} rounded-md`}
                inputMode="numeric"
                placeholder="2026"
                value={ejercicioParametros}
                onChange={(e) => setEjercicioParametros(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted/70 max-w-[52ch] m-0 mt-5">
              Estos parámetros son una foto única: no se archivan por año, así que cambiar el
              selector 2026/2027 de la cabecera no carga otros valores.
            </p>
          </div>
        </section>

        {/* ── AGA ────────────────────────────── */}
        <section id="aga" data-section="aga" className="border border-line rounded-lg bg-panel p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
            <User size={14} /> Autoridad de gestión administrativa (AGA)
          </h2>
          <p className="text-sm text-muted leading-relaxed m-0 mb-3">
            La más alta autoridad de la gestión administrativa: <strong>aprueba, autoriza y supervisa</strong>{" "}
            las contrataciones y aprueba el expediente (Ley 32069, Art. 25.1.b; Reglamento, Art. 19; Art. 54.2).
            En una municipalidad suele ser el gerente municipal; regístrala aquí aunque coincida.
          </p>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {campo("agaDegree", "Grado / Título profesional", { placeholder: "Ej. CPC., ING., ABOG." })}
            {campo("agaFullName", "Nombre completo", { placeholder: "Nombres y apellidos completos" })}
            {campo("agaDni", "DNI", {
              placeholder: "8 dígitos",
              inputMode: "numeric",
              maxDigits: 8,
              hint: `${(formData.agaDni ?? "").length}/8 dígitos`,
            })}
            {campo("agaPosition", "Cargo", { placeholder: "Ej. Gerente Municipal" })}
            {campo("agaResolutionNumber", "Resolución de designación Nro.", { placeholder: "Ej. 123-2026-MDCH/A" })}
            {campo("agaResolutionDate", "Fecha de la Resolución", { type: "date" })}
          </div>
        </section>

        {/* ── Resoluciones PIA/PAC ───────────── */}
        <section id="resoluciones" data-section="resoluciones" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Wallet size={14} /> Resoluciones del PIA y PAC
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0">
              Se citan <strong>literalmente</strong> como antecedente en los informes que se
              exportan y se firman. Se registran una vez por ejercicio.
            </p>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1">
              {campo("piaResolutionNumber", "Resolución que aprueba el PIA", {
                hint: "Tipo y número completos, tal como se citarán.",
                placeholder: "Ej. Resolución de Alcaldía N° 238-2025-MDP/ALC",
              })}
              {campo("piaResolutionDate", "Fecha de la Resolución del PIA", { type: "date" })}
              {campo("pacResolutionNumber", "Resolución que aprueba el PAC", {
                hint: "Documento de aprobación: resolución, memorando u otro.",
                placeholder: "Ej. Resolución de Gerencia Municipal N° 007-2026-MDP/GM",
              })}
              {campo("pacResolutionDate", "Fecha de la Resolución del PAC", { type: "date" })}
            </div>

            {citasResoluciones.length > 0 ? (
              <div className="p-3 rounded-lg border border-line/60 bg-surface">
                <span className="text-xs font-semibold text-muted block mb-2">Se citará así en los informes</span>
                {citasResoluciones.map((c) => (
                  <p key={c.clave} className="text-sm text-ink m-0 mb-1 last:mb-0">
                    <strong>{c.etiqueta}:</strong> {c.texto}
                  </p>
                ))}
              </div>
            ) : null}

            {avisosResol.map((a) => (
              <p key={a.texto} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md border text-xs leading-snug m-0 ${
                a.tono === "error"
                  ? "bg-danger-soft border-danger/30 text-danger"
                  : "bg-warning-soft border-warning/30 text-warning"
              }`}>
                <AlertTriangle size={13} className="shrink-0" /> {a.texto}
              </p>
            ))}
          </div>
        </section>

        {/* ── Montos del PAC ─────────────────── */}
        <section id="montos" data-section="montos" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-6">
            {umbralResumen !== null ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800">
                  Umbral del contrato menor: <strong>{umbralResumen}</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Contrataciones cuya cuantía de la contratación no supere este monto pueden agruparse por ítems (8 UIT - Ley 32069, Art. 34.1).
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Wallet size={14} /> Montos del PAC — línea de corte (Art. 125)
              </h2>
              <p className="text-sm text-muted leading-relaxed m-0">
                Registra el monto total del PAC y la parte de bienes y servicios. El PAC de obras y
                la línea de corte se calculan solos.
              </p>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                {campo("pacMontoTotal", "Monto total del PAC (S/)", { moneda: true, placeholder: "6,099,061.68" })}
                {campo("pacMontoBienesServicios", "PAC bienes y servicios (S/) — base del 10%", {
                  moneda: true,
                  placeholder: "1,226,465.70",
                  hint: "Incluye bienes, servicios, no competitivos y CEAM del PAC (Guía).",
                })}
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted">PAC obras (S/)</span>
                  <div className="flex items-stretch w-full">
                    <span aria-hidden="true" className="flex items-center px-2 border border-line border-r-0 rounded-l-md bg-surface text-muted text-xs font-semibold select-none">S/</span>
                    <input
                      readOnly
                      tabIndex={-1}
                      value={pacResumen?.obras ?? ""}
                      placeholder="Se calcula: total − bienes y servicios"
                      className="w-full px-2.5 py-2 border border-line text-sm bg-surface/50 outline-none rounded-r-md text-right tabular-nums"
                    />
                  </div>
                  <small className="text-xs text-muted/70">
                    Se calcula restando: monto total del PAC − PAC de bienes y servicios.
                  </small>
                </label>
              </div>

              {pacResumen ? (
                <div className="p-3 rounded-lg border border-line/60 bg-surface">
                  <strong className="block text-sm font-semibold text-ink mb-1.5">
                    Línea de corte por cuantía: {pacResumen.lineaCorte}
                  </strong>
                  <div className="text-xs text-muted leading-relaxed">
                    10% del PAC de bienes y servicios. Toda contratación por encima de ese monto es
                    de <em>alta cuantía</em> (Art. 125.2). Es una referencia: cada expediente
                    recalcula la línea sumando las no programadas ya convocadas, las otras que se
                    segmenten a la vez y la propia contratación si no está programada.
                  </div>
                  {pacResumen.excede ? (
                    <div className="mt-2 p-2.5 rounded-md bg-warning-soft border border-warning/30 text-xs text-warning">
                      Revisa las cifras: el PAC de bienes y servicios supera el monto total del PAC
                      ({pacResumen.total}), así que el PAC de obras saldría negativo. Mientras no
                      cuadren, el PAC de obras se deja sin registrar.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── UIT ────────────────────────────── */}
        <section id="uit" data-section="uit" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Wallet size={14} /> UIT del ejercicio — tope del contrato menor
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0">
              La norma expresa las cuantías en UIT. De este valor sale el tope del contrato menor,
              que decide si un requerimiento puede convocarse por ítems, lotes o tramos.
            </p>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("uitValor", "Valor de la UIT (S/)", {
                moneda: true,
                placeholder: "5,350.00",
                hint: "El vigente al momento de la contratación (Ley 32069, Art. 34.1).",
              })}
            </div>

            {umbralResumen ? (
              <div className="p-3 rounded-lg border border-line/60 bg-surface">
                <strong className="block text-sm font-semibold text-ink mb-1.5">
                  Tope del contrato menor: {umbralResumen}
                </strong>
                <div className="text-xs text-muted leading-relaxed">
                  8 UIT. Son contratos menores los de monto <em>igual o inferior</em> a esa cifra
                  (Ley 32069, Art. 34.1) y no requieren procedimiento de selección. Por eso un
                  requerimiento solo puede convocarse por ítems, lotes o tramos si{" "}
                  <strong>cada uno supera ese tope</strong> (Reglamento, Art. 52.1.b): en el importe
                  exacto todavía es contrato menor.
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── LP abreviada bienes ────────────── */}
        <section id="lpabreviada" data-section="lpabreviada" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Wallet size={14} /> Licitación Pública abreviada para bienes — rango de cuantía
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0">
              El umbral de la modalidad abreviada no está en la norma publicada (los Arts. 93-95
              remiten a una tabla web). Regístralo aquí: se usa para saber qué ítems de un
              requerimiento por relación de ítems caen en esa banda y redactar su experiencia por ítem.
            </p>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("lpAbreviadaBienesMin", "Cuantía mínima (S/)", { moneda: true, placeholder: "500,000.00" })}
              {campo("lpAbreviadaBienesMax", "Cuantía máxima (S/)", { moneda: true, placeholder: "5,000,000.00" })}
            </div>

            {lpAbreviadaResumen ? (
              <div className="p-3 rounded-lg border border-line/60 bg-surface">
                <strong className="block text-sm font-semibold text-ink mb-1.5">
                  Rango de la LP abreviada para bienes: {lpAbreviadaResumen}
                </strong>
                <div className="text-xs text-muted leading-relaxed">
                  Un ítem cuya cuantía cae dentro de este rango corresponde a una Licitación Pública
                  abreviada de bienes. Por encima del máximo es Licitación Pública plena.
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Topes por cuantía ──────────────── */}
        <section id="topes" data-section="topes" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Wallet size={14} /> Topes de procedimiento por cuantía — Año fiscal
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0">
              Importes de la tabla anual DSEACE-OECE (Arts. 93-95 del Reglamento) que deciden el
              procedimiento según la cuantía. No están en la norma publicada; se registran por año.
              Si los dejas vacíos, la app usa los valores 2026.
            </p>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("topePiso", "Piso — contrato menor (S/)", { moneda: true, placeholder: "44,000.00" })}
              {campo("topeLicitacionConcurso", "Frontera Licitación/Concurso (S/)", {
                moneda: true,
                placeholder: "485,000.00",
              })}
              {campo("topeLicitacionObras", "Licitación Pública de obras (S/)", {
                moneda: true,
                placeholder: "5,000,000.00",
              })}
              {campo("topeComparacionPrecios", "Techo Comparación de Precios (S/)", {
                moneda: true,
                placeholder: "100,000.00",
              })}
            </div>
            <div className="text-xs text-muted leading-relaxed">
              Bienes/servicios ≥ frontera → Licitación/Concurso Público; entre el piso y la frontera →
              su modalidad Abreviada; ≤ techo → cabe Comparación de Precios. Obras ≥ su umbral →
              Licitación Pública; por debajo, abreviada de obras.
            </div>
          </div>
        </section>

        {/* ── Días del cronograma ────────────── */}
        <section id="cronograma" data-section="cronograma" className="border border-line rounded-lg bg-panel p-4">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CalendarClock size={14} /> Días estimados del cronograma — Año fiscal
            </h2>
            <p className="text-sm text-muted leading-relaxed m-0">
              Días hábiles POR PROCEDIMIENTO con los que arranca el cronograma de A4, para lo que el
              Reglamento NO fija. Los mínimos legales (22 hábiles convocatoria→ofertas del Art. 64.1,
              consultas, apelación…) y las etapas de cada procedimiento (Arts. 93/94/95) se quedan fijos
              en la app. Si no editas nada, se usan los valores por defecto.
            </p>
            <CronogramaDiasGrid
              value={formData.cronogramaDias ?? ""}
              onChange={(json) => handleChange("cronogramaDias", json)}
            />
            <div className="text-xs text-muted leading-relaxed">
              Solo se editan las duraciones que el Reglamento no fija (preparatorias y ejecución). Los
              plazos legales de la selección —incluido el mínimo de 6 días hábiles de la subasta
              inversa— son piso fijo en la app y no aparecen en la rejilla.
            </div>
          </div>
        </section>
      </div>

      <BarraGuardado form={form} />
    </div>
  );
}
