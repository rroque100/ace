"use client";

// Motor compartido del formulario de entity_settings. Antes vivía dentro de
// MunicipalidadTab, que hacía doble función (identidad de la entidad + parámetros
// de procesos de selección) en un solo componente de ~1.000 líneas. Aquí se aísla
// la parte delicada —estado, sincronización con el servidor, autoguardado con
// antirebote y validación por variante— para que las dos pestañas la compartan
// sin duplicarla y sin arriesgar el comportamiento al tocar una u otra.

import { AlertTriangle, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaveStatus } from "./save-status";
import { inputBase } from "./ui";
import { type EntitySettings, onlyDigits } from "@/lib/configuracion-types";
import {
  type EntityFormData,
  type FormState,
  calcularPacObras,
  entitySchema,
  formatearImporte,
  posicionTrasDigitos,
  toFormState,
} from "@/lib/configuracion-entidad";
import { useToastHelpers } from "@/lib/toast";
import { useYear } from "@/lib/year-context";
import { olvidarCatalogo } from "@/lib/settings-catalog-cache";

// Las dos variantes editan la MISMA fila de entity_settings: "entidad" (identidad,
// gobierno y gerente) y "procesos" (AGA y los parámetros que deciden el
// procedimiento de selección). Comparten estado: cada variante carga el `entity`
// completo, edita su subconjunto y PERSISTE EL FORMULARIO ENTERO, de modo que
// guardar en una no borra los campos de la otra.
export type Variant = "entidad" | "procesos";

// Qué campos edita cada variante. Sirve para que la validación del guardado dé un
// aviso HONESTO: los campos obligatorios que el servidor exige (name, ruc, address,
// executingUnit, governmentLevel) viven en la variante "entidad"; si están
// incompletos, no se puede guardar NADA (entity_settings es una sola fila). Estando
// en "procesos", marcar esos campos en rojo no sirve —no se ven— así que se avisa de
// que hay que completar el perfil en la otra pestaña, en vez de "revisa los campos".
const CAMPOS_ENTIDAD: ReadonlySet<keyof FormState> = new Set<keyof FormState>([
  "name",
  "ruc",
  "executingUnit",
  "address",
  "city",
  "department",
  "province",
  "governmentLevel",
  "managerDegree",
  "managerFullName",
  "managerDni",
  "managerPosition",
  "managerResolutionNumber",
  "managerResolutionDate",
]);

/** ¿El campo pertenece a la variante indicada? (procesos = todo lo que no es entidad). */
function perteneceAVariante(campo: keyof FormState, variante: Variant): boolean {
  return variante === "entidad" ? CAMPOS_ENTIDAD.has(campo) : !CAMPOS_ENTIDAD.has(campo);
}

/** Opciones de un campo renderizado por `campo()`. */
export type CampoOpts = {
  placeholder?: string;
  hint?: string;
  required?: boolean;
  inputMode?: "text" | "numeric";
  type?: string;
  maxDigits?: number;
  full?: boolean;
  moneda?: boolean;
};

/** Todo lo que una variante necesita del motor del formulario. */
export type EntityForm = ReturnType<typeof useEntityForm>;

export function useEntityForm({
  entity,
  setEntity,
  variant,
}: {
  entity: EntitySettings;
  setEntity: React.Dispatch<React.SetStateAction<EntitySettings>>;
  variant: Variant;
}) {
  const { yearParam } = useYear();
  const { success, error: toastError } = useToastHelpers();

  const [formData, setFormData] = useState<FormState>(() => toFormState(entity));
  // Ultimo estado confirmado en el servidor: base para detectar cambios reales
  // y evitar auto-guardados en la carga inicial.
  const [savedData, setSavedData] = useState<FormState>(() => toFormState(entity));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState(
    variant === "procesos" ? "procesos-contratacion" : "datos",
  );

  const validateField = useCallback((name: keyof FormState, value: string) => {
    const fieldSchema = entitySchema.shape[name as keyof EntityFormData];
    if (!fieldSchema) return;
    const result = fieldSchema.safeParse(value);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.success) delete next[name];
      else next[name] = result.error.issues[0].message;
      return next;
    });
  }, []);

  // Valida todo el formulario, pero solo da FEEDBACK VISUAL (rojo + scroll) a los
  // campos de la variante activa. Devuelve si es válido y, cuando no, si el bloqueo
  // viene ENTERO de la otra variante (p. ej. estando en "procesos", falta el RUC de
  // la entidad): en ese caso no hay nada rojo que mostrar aquí y el aviso debe
  // remitir a la otra pestaña.
  const validateAll = useCallback((): { ok: boolean; soloAjenos: boolean } => {
    const result = entitySchema.safeParse(formData);
    if (result.success) {
      setErrors({});
      return { ok: true, soloAjenos: false };
    }
    const fieldErrors: Partial<Record<keyof FormState, string>> = {};
    result.error.issues.forEach((e) => {
      if (e.path[0]) fieldErrors[e.path[0] as keyof FormState] = e.message;
    });
    setErrors(fieldErrors);
    const claves = Object.keys(fieldErrors) as (keyof FormState)[];
    const propias = claves.filter((k) => perteneceAVariante(k, variant));
    // Un campo solo se pinta en rojo si además está "tocado" (para no regañar
    // mientras se escribe por primera vez). Solo se marcan los de ESTA variante:
    // marcar los de la otra pintaría un error invisible y el aviso mentiría.
    setTouched((prev) => {
      const next = { ...prev };
      for (const clave of propias) next[clave] = true;
      return next;
    });
    // Lleva la vista al primer campo con problema DE ESTA variante.
    const primero = propias[0];
    if (primero && typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-campo-entidad="${primero}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    return { ok: false, soloAjenos: propias.length === 0 };
  }, [formData, variant]);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(savedData),
    [formData, savedData],
  );

  // El efecto de sincronización necesita saber si hay cambios sin guardar, pero
  // NO puede depender de `isDirty`: eso lo re-dispararía en cada tecla. Se pasa
  // por una ref, actualizada en su propio efecto (asignarla durante el render
  // rompe el modelo de React) y declarada ANTES para que en un mismo commit se
  // actualice primero.
  const hayCambiosSinGuardar = useRef(false);
  useEffect(() => {
    hayCambiosSinGuardar.current = isDirty;
  }, [isDirty]);

  // Cuando el padre entrega/actualiza la entidad (carga o guardado), se
  // sincroniza el formulario y la base de comparacion sin marcar cambios.
  //
  // El formulario NO se pisa si el usuario tiene cambios sin guardar. El
  // autoguardado dispara a los 1.5 s de dejar de escribir, pero la respuesta
  // llega después: si para entonces se ha seguido tecleando, reemplazar el
  // formulario por lo que devolvió el servidor BORRA esos caracteres. Ese era el
  // motivo de que un monto largo pareciera cortarse a los pocos dígitos —el
  // resto se escribía y desaparecía—.
  useEffect(() => {
    const next = toFormState(entity);
    setSavedData(next);
    if (!hayCambiosSinGuardar.current) setFormData(next);
  }, [entity]);

  useEffect(() => {
    const sections = document.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute("data-section") || "");
          }
        });
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const persist = useCallback(
    async (mode: "auto" | "manual") => {
      const parsed = entitySchema.safeParse(formData);
      if (!parsed.success) {
        if (mode === "manual") {
          const { soloAjenos } = validateAll();
          if (soloAjenos) {
            toastError(
              "Falta completar la entidad",
              "Completa el perfil de la entidad en la pestaña «Municipalidad» antes de guardar aquí.",
            );
          } else {
            toastError("Datos incompletos", "Revisa los campos marcados en rojo.");
          }
        }
        return false;
      }

      setSaving(true);
      setSaveError(false);
      try {
        const response = await fetch(`/api/configuracion/settings?${yearParam}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: formData }),
        });
        const payload = await response.json();

        if (!response.ok) {
          const zodErrors = payload.details?.fieldErrors as Record<string, string[]> | undefined;
          const zodMsg = zodErrors
            ? Object.entries(zodErrors)
                .map(([k, v]) => `${k}: ${v.join(", ")}`)
                .join("; ")
            : "";
          throw new Error(
            zodMsg
              ? `${payload.error ?? "Error"} - ${zodMsg}`
              : payload.error ?? "No se pudo guardar la configuracion",
          );
        }

        // El catalogo que las demas pantallas tienen en memoria acaba de dejar
        // de ser cierto. Antes daba igual —cada componente lo repedia al
        // montarse—; ahora se comparte, asi que hay que decirle que lo olvide.
        olvidarCatalogo();
        // setEntity dispara el efecto de sincronizacion, que actualiza savedData.
        setEntity((prev) => ({ ...prev, ...payload.entity }));
        setSavedData(formData);
        setLastSaved(new Date());
        if (mode === "manual") {
          success("Configuracion guardada", "Los datos de la entidad se actualizaron.");
        }
        return true;
      } catch (err) {
        setSaveError(true);
        const message = err instanceof Error ? err.message : "No se pudo guardar la configuracion";
        toastError("Error al guardar", message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [formData, yearParam, setEntity, success, toastError, validateAll],
  );

  // Auto-guardado con antirebote: solo cuando el usuario cambio algo (isDirty)
  // y el formulario es valido. No se dispara en la carga inicial.
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || saving) return;
    if (!entitySchema.safeParse(formData).success) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void persist("auto");
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData, isDirty, saving, persist]);

  const handleChange = useCallback(
    (name: keyof FormState, value: string) => {
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        // El PAC de obras es el resto: se recalcula al tocar cualquiera de sus
        // dos sumandos, no se escribe.
        if (name === "pacMontoTotal" || name === "pacMontoBienesServicios") {
          next.pacMontoObras = calcularPacObras(next.pacMontoTotal, next.pacMontoBienesServicios);
        }
        return next;
      });
      if (touched[name]) validateField(name, value);
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (name: keyof FormState) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      validateField(name, formData[name] ?? "");
    },
    [formData, validateField],
  );

  // Año fiscal ÚNICO de los parámetros de procesos. En BD son cinco columnas
  // (`pac_anio`, `uit_anio`, `lp_abreviada_bienes_anio`, `tope_anio`,
  // `cronograma_anio`) que los consumidores leen por separado; se mantienen, pero
  // aquí se editan a la vez desde un solo campo para que no diverjan. El valor
  // mostrado es el primero no vacío (por si un dato antiguo trae columnas dispares).
  const ejercicioParametros =
    formData.topeAnio ||
    formData.cronogramaAnio ||
    formData.pacAnio ||
    formData.uitAnio ||
    formData.lpAbreviadaBienesAnio ||
    "";
  const setEjercicioParametros = useCallback((raw: string) => {
    const v = onlyDigits(raw, 4);
    setFormData((prev) => ({
      ...prev,
      pacAnio: v,
      uitAnio: v,
      lpAbreviadaBienesAnio: v,
      topeAnio: v,
      cronogramaAnio: v,
    }));
  }, []);

  const hasFieldError = useCallback(
    (name: keyof FormState) => Boolean(errors[name] && touched[name]),
    [errors, touched],
  );

  /** Lleva la vista al campo y lo enfoca (usado por el checklist como índice). */
  const irACampo = useCallback((campoId: string) => {
    const destino = document.querySelector<HTMLElement>(`[data-campo-entidad="${campoId}"]`);
    if (!destino) return;
    destino.scrollIntoView({ behavior: "smooth", block: "center" });
    destino.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
  }, []);

  // Estado del guardado para el indicador unico del pie.
  const saveStatus: "saving" | "error" | "dirty" | "saved" | "idle" = saving
    ? "saving"
    : saveError
      ? "error"
      : isDirty
        ? "dirty"
        : lastSaved
          ? "saved"
          : "idle";

  // Renderizador de campo compartido por ambas variantes (input con formato de
  // moneda, dígitos acotados, error, hint…). Se recrea en cada render como antes.
  const campo = (name: keyof FormState, label: string, opts: CampoOpts = {}) => (
    <label className={`flex flex-col gap-1${opts.full ? " col-span-2" : ""}`} data-campo-entidad={name}>
      <span className="text-xs font-semibold text-muted">
        {label}
        {opts.required ? (
          <em className="font-normal text-xs text-muted/60 not-italic ml-1">obligatorio</em>
        ) : null}
      </span>
      <div className={opts.moneda ? "flex items-stretch w-full" : undefined}>
        {opts.moneda ? (
          <span
            aria-hidden="true"
            className="flex items-center px-2 border border-line border-r-0 rounded-l-md bg-surface text-xs text-muted font-semibold select-none"
          >
            S/
          </span>
        ) : null}
        <input
          className={`${inputBase}${opts.moneda ? " rounded-r-md text-right tabular-nums" : " rounded-md"}`}
          type={opts.type ?? "text"}
          value={formData[name] ?? ""}
          placeholder={opts.placeholder}
          aria-invalid={hasFieldError(name) || undefined}
          aria-describedby={hasFieldError(name) ? `err-${name}` : undefined}
          inputMode={opts.moneda ? "decimal" : opts.inputMode}
          onChange={(e) => {
            if (!opts.moneda) {
              handleChange(name, opts.maxDigits ? onlyDigits(e.target.value, opts.maxDigits) : e.target.value);
              return;
            }
            const input = e.currentTarget;
            const digitosAntes = input.value
              .slice(0, input.selectionStart ?? input.value.length)
              .replace(/\D/g, "").length;
            const formateado = formatearImporte(input.value);
            handleChange(name, formateado);
            requestAnimationFrame(() => {
              const pos = posicionTrasDigitos(formateado, digitosAntes);
              input.setSelectionRange(pos, pos);
            });
          }}
          onBlur={() => handleBlur(name)}
        />
      </div>
      {hasFieldError(name) ? (
        <small className="text-xs font-semibold text-red-600" id={`err-${name}`} role="alert">
          {errors[name]}
        </small>
      ) : opts.hint ? (
        <small className="text-xs text-muted/70">{opts.hint}</small>
      ) : null}
    </label>
  );

  return {
    formData,
    errors,
    isDirty,
    saving,
    saveStatus,
    lastSaved,
    activeSection,
    handleChange,
    handleBlur,
    hasFieldError,
    validateAll,
    persist,
    campo,
    ejercicioParametros,
    setEjercicioParametros,
    irACampo,
  };
}

/** Navegación por anclas (idéntica en ambas variantes; cambia solo la lista). */
export function NavAnclas({
  secciones,
  activeSection,
}: {
  secciones: ReadonlyArray<{ id: string; label: string }>;
  activeSection: string;
}) {
  return (
    <nav className="sticky top-4 z-10 flex gap-1 overflow-x-auto pb-2 border-b border-line">
      {secciones.map((sec) => (
        <a
          key={sec.id}
          href={`#${sec.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
          }}
          className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-md transition-colors ${
            activeSection === sec.id ? "bg-brand text-white" : "text-muted hover:bg-surface"
          }`}
        >
          {sec.label}
        </a>
      ))}
    </nav>
  );
}

/** Barra de guardado del pie (idéntica en ambas variantes). */
export function BarraGuardado({ form }: { form: EntityForm }) {
  const { saving, isDirty, persist, saveStatus, lastSaved } = form;
  return (
    <div className="flex items-center gap-3 py-3 border-t border-line">
      <button
        className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 font-bold text-white bg-brand border-0 rounded-lg cursor-pointer hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        type="button"
        onClick={() => persist("manual")}
        disabled={saving || !isDirty}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{" "}
        {saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardado"}
      </button>
      <SaveStatus
        status={saveStatus}
        message={
          saveStatus === "saved" && lastSaved
            ? `Todo guardado - ${lastSaved.toLocaleTimeString("es-PE")}`
            : undefined
        }
      />
      {isDirty ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap bg-warning-soft text-warning ml-auto">
          <AlertTriangle size={12} aria-hidden /> Sin guardar
        </span>
      ) : null}
    </div>
  );
}
