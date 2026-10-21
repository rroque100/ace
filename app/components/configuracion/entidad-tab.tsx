"use client";

import { Building2, CheckCircle2, Landmark, User } from "lucide-react";
import { useMemo, useState } from "react";
import { BarraGuardado, NavAnclas, type EntityForm } from "./use-entity-form";
import { type GovernmentLevel, DEGREE_OPTIONS, entityChecklist } from "@/lib/configuracion-types";
import { governmentLevelOptions } from "@/lib/configuracion-entidad";

const SECCIONES = [
  { id: "datos", label: "Datos de la entidad" },
  { id: "gobierno", label: "Tipo de gobierno" },
  { id: "gerente", label: "Gerente municipal" },
  { id: "preview", label: "Vista previa" },
] as const;

/** Variante "entidad": identidad, tipo de gobierno, gerente y vista previa. */
export function EntidadTab({
  form,
  governmentLevels,
}: {
  form: EntityForm;
  governmentLevels: GovernmentLevel[];
}) {
  const { formData, errors, handleChange, handleBlur, hasFieldError, campo, irACampo, activeSection } = form;
  const [showPreview, setShowPreview] = useState(false);

  const levels = governmentLevels.length > 0 ? governmentLevels : governmentLevelOptions;

  // Mismo criterio que la barra lateral (isEntityComplete), desde la fuente única.
  const checklist = useMemo(() => entityChecklist(formData), [formData]);
  const complete = checklist.every((item) => item.done);
  const progress = checklist.filter((item) => item.done).length;
  const today = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

  const degreeIsPreset = DEGREE_OPTIONS.includes(
    formData.managerDegree as (typeof DEGREE_OPTIONS)[number],
  );

  const previewDl = (
    <dl className="flex flex-col gap-y-1.5 m-0">
      <Dato k="Entidad" v={formData.name} />
      <Dato k="RUC" v={formData.ruc} />
      <Dato k="Unidad ejecutora" v={formData.executingUnit} />
      <Dato k="Departamento" v={formData.department} />
      <Dato k="Provincia" v={formData.province} />
      <Dato k="Ciudad" v={formData.city} />
      <Dato k="Dirección" v={formData.address} />
      <Dato
        k="Nivel de gobierno"
        v={levels.find((l) => l.value === formData.governmentLevel)?.label ?? ""}
      />
      <Dato
        k="Gerente"
        v={
          formData.managerDegree || formData.managerFullName
            ? `${(formData.managerDegree ?? "").trim()} ${formData.managerFullName ?? ""}`.trim()
            : ""
        }
      />
      <Dato k="DNI del gerente" v={formData.managerDni} />
      <Dato
        k="Designación"
        v={formData.managerResolutionNumber ? `R.A. Nro. ${formData.managerResolutionNumber}` : ""}
      />
    </dl>
  );

  return (
    <div className="tw flex flex-col gap-4">
      {/* ── Header + checklist ─────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted leading-relaxed max-w-[68ch] m-0">
          Completa los datos de tu entidad. Se guardan solos mientras escribes; el
          contador de la derecha muestra cuántos campos clave faltan.
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
          complete ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
        }`}>
          {complete ? "Perfil completo" : `${progress} de ${checklist.length} campos`}
        </span>
      </div>

      <div className="border border-line rounded-lg bg-panel p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
          <CheckCircle2 size={14} /> Completa el perfil ({progress}/{checklist.length})
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden mb-3" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(progress / checklist.length) * 100}%` }}
          />
        </div>
        <ul className="grid gap-1.5 m-0 p-0 list-none">
          {checklist.map((item) => (
            <li key={item.label}>
              <button
                data-done={item.done}
                onClick={() => irACampo(item.campo)}
                title={item.done ? `${item.label} — completo` : `Ir a ${item.label}`}
                type="button"
                className={`flex items-center gap-2 text-sm cursor-pointer border-0 bg-transparent p-0 ${item.done ? "text-success" : "text-muted hover:text-ink"}`}
              >
                <CheckCircle2 size={14} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <NavAnclas secciones={SECCIONES} activeSection={activeSection} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Columna principal — formulario */}
        <div className="flex flex-col gap-4">
          {/* ── Datos de la entidad ────────────── */}
          <section id="datos" data-section="datos" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <Building2 size={14} /> Datos de la entidad
            </h2>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {campo("name", "Nombre de la entidad", {
                placeholder: "Ej. Municipalidad Distrital de...",
                hint: "Nombre oficial que aparecerá en documentos",
                required: true,
                full: true,
              })}
              {campo("ruc", "RUC", {
                placeholder: "11 dígitos",
                inputMode: "numeric",
                maxDigits: 11,
                required: true,
                hint: `${formData.ruc.length}/11 dígitos`,
              })}
              {campo("executingUnit", "Unidad ejecutora", {
                placeholder: "6 dígitos",
                inputMode: "numeric",
                maxDigits: 6,
                required: true,
                hint: `${formData.executingUnit.length}/6 dígitos`,
              })}
              {campo("department", "Departamento", { placeholder: "Ej. Apurímac" })}
              {campo("province", "Provincia", { placeholder: "Ej. Cotabambas" })}
              {campo("city", "Ciudad", {
                placeholder: "Ej. Challhuahuacho",
                hint: `Encabeza los documentos: "${(formData.city ?? "").trim() || "Ciudad"}, ${today}"`,
                full: true,
              })}
              {campo("address", "Dirección de la entidad", {
                placeholder: "Dirección fiscal o sede principal",
                required: true,
                full: true,
              })}
            </div>
          </section>

          {/* ── Tipo de gobierno ───────────────── */}
          <section id="gobierno" data-section="gobierno" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <Landmark size={14} /> Tipo de gobierno
            </h2>
            <div
              role="radiogroup"
              aria-label="Tipo de gobierno"
              aria-invalid={hasFieldError("governmentLevel") || undefined}
              data-campo-entidad="governmentLevel"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {levels.map((level) => {
                const selected = formData.governmentLevel === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleChange("governmentLevel", level.value)}
                    className={`flex flex-col gap-0.5 p-3 rounded-lg border text-left cursor-pointer font-inherit transition-colors ${
                      selected ? "border-brand/35 bg-brand-soft" : "border-line bg-white hover:border-brand/20"
                    }`}
                  >
                    <strong className={`text-sm font-semibold ${selected ? "text-brand-dark" : "text-ink"}`}>
                      {level.label}
                    </strong>
                    <small className="text-xs text-muted leading-snug">{level.examples}</small>
                  </button>
                );
              })}
            </div>
            {hasFieldError("governmentLevel") ? (
              <small className="text-xs font-semibold text-red-600 block mt-2" role="alert">
                {errors.governmentLevel}
              </small>
            ) : (
              <small className="text-xs text-muted/80 block mt-2">
                Identifica el ámbito institucional en reportes, expedientes y auditoría.
              </small>
            )}
          </section>

          {/* ── Gerente ────────────────────────── */}
          <section id="gerente" data-section="gerente" className="border border-line rounded-lg bg-panel p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
              <User size={14} /> Gerente de la entidad
            </h2>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">Grado / Título profesional</span>
                <select
                  className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white outline-none focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  value={degreeIsPreset ? formData.managerDegree : formData.managerDegree ? "__otro__" : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__otro__") handleChange("managerDegree", " ");
                    else handleChange("managerDegree", val);
                  }}
                  onBlur={() => handleBlur("managerDegree")}
                >
                  <option value="">Seleccionar...</option>
                  {DEGREE_OPTIONS.map((deg) => (
                    <option key={deg} value={deg}>
                      {deg}
                    </option>
                  ))}
                  <option value="__otro__">Otro</option>
                </select>
                {!degreeIsPreset && formData.managerDegree ? (
                  <input
                    placeholder="Ej. MBA., PH.D."
                    value={formData.managerDegree.trim()}
                    onChange={(e) => handleChange("managerDegree", e.target.value)}
                    onBlur={() => handleBlur("managerDegree")}
                    className="w-full px-2.5 py-2 rounded-md border border-line text-sm bg-white outline-none placeholder:text-slate-400 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  />
                ) : null}
              </label>
              {campo("managerFullName", "Nombre completo", { placeholder: "Nombres y apellidos completos" })}
              {campo("managerDni", "DNI", {
                placeholder: "8 dígitos",
                inputMode: "numeric",
                maxDigits: 8,
                hint: `${(formData.managerDni ?? "").length}/8 dígitos`,
              })}
              {campo("managerPosition", "Cargo", { placeholder: "Gerente General" })}
              {campo("managerResolutionNumber", "Resolución de Alcaldía Nro.", {
                placeholder: "Ej. 123-2026-MDCH/A",
              })}
              {campo("managerResolutionDate", "Fecha de la Resolución", { type: "date" })}
            </div>
          </section>

          {/* ── Mobile: toggle vista previa ────── */}
          <div className="lg:hidden">
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-dashed border-line rounded-lg bg-surface text-sm text-muted hover:text-ink hover:border-brand transition-colors"
              onClick={() => setShowPreview(!showPreview)}
              type="button"
            >
              {showPreview ? "Ocultar" : "Mostrar"} vista previa
            </button>
            {showPreview && (
              <div id="preview" data-section="preview" className="mt-3 border border-line rounded-lg bg-panel p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-3">
                  <Building2 size={14} /> Vista previa — cómo se verá en los documentos
                </div>
                {previewDl}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar desktop: vista previa ───── */}
        <aside className="sticky top-20 self-start hidden lg:block" data-section="preview">
          <div className="border border-line rounded-lg bg-panel p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              <Building2 size={12} /> Vista previa
            </div>
            {previewDl}
          </div>
        </aside>
      </div>

      <BarraGuardado form={form} />
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  const valor = (v ?? "").trim();
  return (
    <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2.5 py-0.5">
      <dt className="text-xs font-semibold text-muted leading-snug">{k}</dt>
      <dd className={`text-sm text-ink m-0 ${valor ? "" : "text-muted/55"}`}>{valor || "—"}</dd>
    </div>
  );
}
