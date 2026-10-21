// Clases Tailwind compartidas del módulo /expedientes-archivo, respaldadas
// por los tokens --exp-* registrados en app/tailwind.css.
//
// Existen aparte (en vez de vivir sueltas en cada componente) porque estas
// piezas visuales se REPITEN entre 5-9 archivos distintos —expBtn, expStatus,
// expCard, expListItem...— no son CSS aislado por componente. Migrar un
// archivo sin este punto de referencia compartido habría obligado a redefinir
// el mismo botón o la misma insignia de estado más de una vez, con el riesgo
// de que las copias se desalinearan con el tiempo.
//
// Mismo patrón que app/components/necesidad/ficha-estilos.ts, pero para este
// módulo. Se va ampliando conforme avanzan las siguientes fases de migración
// (ver el comentario de @source en app/tailwind.css).

import { cn } from "@/lib/utils";

// ── Insignia de estado (tarjetas, lista, tabla) ─────────────────────────────

const EXP_STATUS_BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.4px] " +
  "before:size-1.5 before:rounded-full before:bg-current before:content-['']";

const EXP_STATUS_TONE: Record<string, string> = {
  indexed: "bg-exp-success-soft text-[#166534]",
  uploaded: "bg-exp-info-soft text-[#1e40af]",
  processing: "bg-exp-warning-soft text-[#92400e] animate-exp-pulse",
  error: "bg-exp-danger-soft text-[#991b1b]",
};

export function expStatusClass(status: string): string {
  return cn(EXP_STATUS_BASE, EXP_STATUS_TONE[status] ?? EXP_STATUS_TONE.uploaded);
}

// ── Tarjetas (vista "tarjetas" y su skeleton) ───────────────────────────────

export const EXP_CARDS_GRID = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3";

export const EXP_CARD =
  "group relative flex flex-col gap-2 overflow-hidden rounded-exp border border-exp-line bg-exp-panel p-4 text-left " +
  "transition-[border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] " +
  "hover:-translate-y-0.5 hover:border-exp-brand hover:shadow-exp " +
  "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-exp-brand before:opacity-0 before:transition-opacity before:duration-[180ms] before:content-[''] " +
  "hover:before:opacity-100";

export const EXP_CARD_HEADER = "flex items-center justify-between gap-2";

export const EXP_CARD_ICON =
  "flex size-8 items-center justify-center rounded-lg bg-exp-brand-soft text-exp-brand";

export const EXP_CARD_TITLE =
  "m-0 line-clamp-2 text-sm font-bold leading-[1.4] text-exp-ink";

export const EXP_CARD_META = "flex flex-col gap-0.5 text-xs text-exp-muted";

export const EXP_CARD_UBICACION =
  "mt-auto inline-flex items-center gap-1 border-t border-dashed border-exp-line pt-1.5 font-mono text-[11px] font-medium text-exp-warning [&>svg]:shrink-0";

// ── Lista (vista "lista" y su skeleton) ─────────────────────────────────────

export const EXP_LIST = "flex flex-col gap-1.5";

export const EXP_LIST_ITEM =
  "grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-exp border border-exp-line bg-exp-panel px-3.5 py-3 " +
  "transition-[border-color,box-shadow] duration-[120ms] ease-linear hover:border-exp-brand hover:shadow-exp-sm";

export const EXP_LIST_ITEM_ICON =
  "flex size-10 shrink-0 items-center justify-center rounded-exp bg-exp-brand-soft text-exp-brand";

export const EXP_LIST_ITEM_BODY = "min-w-0";

export const EXP_LIST_ITEM_TITLE =
  "m-0 mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-exp-ink";

export const EXP_LIST_ITEM_META = "flex flex-wrap items-center gap-2 text-xs text-exp-muted";

export const EXP_LIST_ITEM_ACTIONS = "flex items-center gap-1";

// ── Estadísticas (dashboard y su skeleton) ──────────────────────────────────

export const EXP_STATS = "mb-5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5";

const EXP_STAT_TONE: Record<string, string> = {
  statBrand: "before:bg-exp-brand",
  statSuccess: "before:bg-exp-success",
  statWarning: "before:bg-exp-warning",
  statDanger: "before:bg-exp-danger",
  statInfo: "before:bg-exp-info",
};

export function expStatCardClass(tono?: keyof typeof EXP_STAT_TONE): string {
  return cn(
    "relative flex flex-col gap-1 overflow-hidden rounded-exp border border-exp-line bg-exp-panel p-3.5 " +
      "transition-shadow duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-exp " +
      "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
    tono ? EXP_STAT_TONE[tono] : "before:bg-exp-brand",
  );
}

export const EXP_STAT_HEADER = "flex items-center justify-between gap-1.5";

// ── Tabla (vista "tabla" y su skeleton) ─────────────────────────────────────

export const EXP_TABLE_WRAP = "overflow-hidden rounded-exp border border-exp-line bg-exp-panel";

export const EXP_TABLE = "w-full border-collapse text-[13px]";

export const EXP_TABLE_THEAD = "sticky top-0 z-[1] bg-exp-line-soft";

export const EXP_TABLE_TH =
  "whitespace-nowrap border-b border-exp-line px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted";

export const EXP_TABLE_TD = "border-b border-exp-line-soft px-3.5 py-3 align-middle text-exp-ink";

// El borde inferior de la última fila se quita desde el <tbody> (selector
// arbitrario), no por archivo: es más simple que calcular "soy la última"
// dentro del `.map`.
export const EXP_TABLE_TBODY = "[&>tr:last-child>td]:border-b-0";

export const EXP_TABLE_ROW = "transition-colors duration-[120ms] ease-linear hover:bg-exp-line-soft";
export const EXP_TABLE_ROW_SELECTED = "bg-exp-brand-soft hover:bg-exp-brand-soft";

// ── Botón de icono (acciones por fila: reindexar, descargar, eliminar...) ───

export const EXP_ICON_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg border border-exp-line bg-exp-panel text-exp-muted no-underline " +
  "transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-brand-soft hover:text-exp-brand " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const EXP_ICON_BUTTON_DANGER =
  "hover:border-exp-danger hover:bg-exp-danger-soft hover:text-exp-danger";

// ── Estado vacío (sin resultados / sin acceso) ───────────────────────────────

export const EXP_EMPTY =
  "flex flex-col items-center gap-3 rounded-exp-lg border border-dashed border-exp-line bg-exp-line-soft px-6 py-12 text-center text-exp-muted";

export const EXP_EMPTY_ICON =
  "flex size-16 items-center justify-center rounded-full bg-exp-panel text-exp-brand shadow-exp-sm";

export const EXP_EMPTY_TITLE = "m-0 text-base font-bold text-exp-ink";

export const EXP_EMPTY_DESC = "m-0 max-w-[360px] text-sm leading-normal text-exp-muted";

// Ilustración grande (aro punteado girando) del estado vacío principal de la
// pestaña Buscar/Subir — distinta del ícono chico de EXP_EMPTY_ICON.
export const EXP_EMPTY_ILLUSTRATION =
  "relative mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-exp-brand-soft)_0%,var(--color-exp-info-soft)_100%)] " +
  "before:absolute before:-inset-1 before:animate-[expSpin_20s_linear_infinite] before:rounded-full before:border-2 before:border-dashed before:border-exp-brand before:opacity-30 before:content-['']";

// ── Contenedor de una pestaña completa (Buscar / Subir) ─────────────────────

export const EXP_TAB_CONTENT = "px-[26px] pb-[26px] pt-5";

// ── Pie de página compartido (overlay/panel/toast/paginación) ──────────────

export const EXP_SKELETON = "animate-exp-shimmer rounded-md bg-[linear-gradient(90deg,var(--exp-line-soft)_25%,var(--exp-line)_50%,var(--exp-line-soft)_75%)] bg-[length:200%_100%]";

// ── Toast base (usado sin variante de color por UndoToasts) ─────────────────

export const EXP_TOAST =
  "flex animate-exp-slide-in-up items-center gap-2.5 rounded-exp bg-exp-ink px-4 py-3 text-[13px] text-white shadow-exp-lg";

export const EXP_TOAST_ICON = "shrink-0";

export const EXP_TOAST_MESSAGE = "flex-1 font-medium";

export const EXP_TOAST_CLOSE =
  "inline-flex size-6 shrink-0 items-center justify-center gap-1 rounded bg-white/20 text-white hover:bg-white/30";

// ── Paginación ───────────────────────────────────────────────────────────────

export const EXP_PAGINATION =
  "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-exp border border-exp-line bg-exp-panel px-3.5 py-3";

export const EXP_PAGINATION_INFO = "text-xs text-exp-muted [&>strong]:font-bold [&>strong]:text-exp-ink";

export const EXP_PAGINATION_CONTROLS = "flex items-center gap-1";

export const EXP_PAGINATION_BTN =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-exp-line bg-exp-panel px-2 text-[13px] font-semibold text-exp-ink-soft " +
  "transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-line-soft hover:text-exp-brand disabled:cursor-not-allowed disabled:opacity-40";

// `!` porque se combina con EXP_PAGINATION_BTN, que ya declara borde/fondo/texto
// sin condición (lo usan también los botones prev/next/puntos, sin estado
// activo) — ver el mismo comentario en borrador-editor.tsx.
export const EXP_PAGINATION_BTN_ACTIVE =
  "!border-exp-brand !bg-exp-brand !text-white hover:!bg-exp-brand-dark hover:!text-white";

export const EXP_PAGINATION_DOTS = "min-w-6 text-center font-semibold text-exp-muted";

// ── Campo de formulario (bulk-move, reemplazar, detalle) ────────────────────

export const EXP_FIELD = "flex min-w-0 flex-col gap-1";

export const EXP_FIELD_LABEL = "flex items-center gap-1 text-xs font-semibold text-exp-ink-soft";

export const EXP_FIELD_CONTROL =
  "w-full rounded-exp border border-exp-line bg-exp-panel px-3 py-2.5 font-[inherit] text-sm text-exp-ink " +
  "transition-colors duration-[120ms] ease-linear " +
  "hover:not-focus:not-disabled:border-[#cbd5e1] " +
  "focus:border-exp-brand focus:shadow-[0_0_0_3px_rgba(15,118,110,0.12)] focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-exp-line-soft disabled:text-exp-muted";

export const EXP_FIELD_TEXTAREA = cn(EXP_FIELD_CONTROL, "min-h-[70px] resize-y leading-normal");

// ── Mensaje inline (aviso corto con borde de color) ──────────────────────────

const EXP_MESSAGE_BASE =
  "mt-2.5 flex items-start gap-2.5 rounded-exp border-l-[3px] px-3.5 py-2.5 text-[13px] leading-relaxed [&>svg]:mt-px [&>svg]:shrink-0";

const EXP_MESSAGE_TONE: Record<"info" | "success" | "warning" | "error", string> = {
  info: "border-l-exp-info bg-exp-info-soft text-[#1e3a8a]",
  success: "border-l-exp-success bg-exp-success-soft text-[#14532d]",
  warning: "border-l-exp-warning bg-exp-warning-soft text-[#78350f]",
  error: "border-l-exp-danger bg-exp-danger-soft text-[#7f1d1d]",
};

export function expMessageClass(tono: keyof typeof EXP_MESSAGE_TONE): string {
  return cn(EXP_MESSAGE_BASE, EXP_MESSAGE_TONE[tono]);
}

// ── Slide-over: cuerpo y pie (la cabecera y el overlay viven en
//    slide-over-shell.tsx; clasePanel/modificador del panel exterior siguen
//    en CSS legacy porque expedientes-archivo-workspace.tsx —no migrado
//    todavía— también los pasa como className) ───────────────────────────────

export const EXP_SLIDE_OVER_BODY = "flex-1 overflow-auto p-[18px_20px]";

export const EXP_SLIDE_OVER_FOOTER =
  "flex justify-end gap-2.5 border-t border-exp-line bg-exp-line-soft px-5 py-3.5";

// ── Sección de formulario (bloques con título+línea punteada: subir, lote,
//    búsqueda avanzada) ───────────────────────────────────────────────────────

export const EXP_FORM_SECTION = "mb-5";

export const EXP_FORM_SECTION_HEADER =
  "mb-3 flex items-center justify-between gap-3 border-b border-dashed border-exp-line pb-2.5";

export const EXP_FORM_SECTION_TITLE =
  "m-0 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.5px] text-exp-ink [&>svg]:size-4 [&>svg]:text-exp-brand";

export const EXP_FORM_SECTION_HINT = "mt-0.5 text-xs font-normal normal-case tracking-normal text-exp-muted";

export function expFormSectionCounterClass(complete?: boolean): string {
  return cn(
    "rounded-full px-2 py-[3px] font-mono text-[11px] font-bold",
    complete ? "bg-exp-success-soft text-exp-success" : "bg-exp-line-soft text-exp-muted",
  );
}

// ── Selector de archivo con arrastrar-y-soltar (lote, subida individual) ────

export function expFilePickerClass(state?: "dragging" | "hasFile"): string {
  // El borde/fondo de reposo NO va en la base incondicional: Tailwind v4
  // genera las utilidades en el orden en que las descubre al escanear (no en
  // un orden fijo), así que `border-exp-line`/`bg-exp-line-soft` podían ganar
  // la cascada sobre `border-exp-brand`/`bg-exp-brand-soft` del estado
  // "dragging" aunque tuvieran la misma especificidad — arrastrar un PDF no
  // se veía. Con el color condicionado a CADA estado (nunca dos clases del
  // mismo tipo a la vez en el mismo elemento) el orden de generación deja de
  // importar.
  const base =
    "group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-exp-lg border-2 p-8 text-center " +
    "transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] " +
    "[&_input[type=file]]:absolute [&_input[type=file]]:inset-0 [&_input[type=file]]:size-full [&_input[type=file]]:cursor-pointer [&_input[type=file]]:opacity-0";
  if (state === "dragging") {
    return cn(
      base,
      "scale-[1.01] border-dashed border-exp-brand bg-exp-brand-soft shadow-[0_0_0_4px_rgba(15,118,110,0.10)]",
    );
  }
  if (state === "hasFile") {
    return cn(base, "border-solid border-exp-success bg-exp-success-soft p-5");
  }
  return cn(base, "border-dashed border-exp-line bg-exp-line-soft hover:border-exp-brand hover:bg-exp-brand-soft");
}

// `group-hover` porque expFilePickerClass ya marca la zona como `group`: el
// ícono reacciona al pasar el cursor sobre CUALQUIER punto del recuadro, no
// solo sobre sí mismo, para que la zona entera se sienta interactiva.
export function expFilePickerIconClass(hasFile?: boolean): string {
  return cn(
    "flex size-16 items-center justify-center rounded-full bg-exp-panel shadow-exp-sm ring-1 ring-exp-line " +
      "transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-105 group-hover:shadow-exp group-hover:ring-exp-brand/30",
    hasFile ? "text-exp-success" : "text-exp-brand",
  );
}

export const EXP_FILE_PICKER_TITLE = "mt-1 text-base font-semibold text-exp-ink";

export const EXP_FILE_PICKER_SUB = "text-xs text-exp-muted";

export const EXP_FILE_PICKER_FILE =
  "flex w-full max-w-[360px] items-center gap-2.5 rounded-exp border border-exp-line bg-exp-panel px-3.5 py-2.5 text-left [&>svg]:shrink-0 [&>svg]:text-exp-success";

export const EXP_FILE_PICKER_FILE_BODY = "min-w-0 flex-1";

export const EXP_FILE_PICKER_FILE_NAME = "block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-exp-ink";

export const EXP_FILE_PICKER_FILE_META = "text-[11px] text-exp-muted";

// ── Texto de ayuda inline y spinner ──────────────────────────────────────────

export const EXP_HELP_TEXT = "mt-1 inline-flex items-center gap-1 text-xs leading-snug text-exp-muted [&>svg]:shrink-0 [&>svg]:opacity-70";

export const EXP_SPIN = "animate-[expSpin_0.9s_linear_infinite]";

// ── Botón (la pieza más compartida: 9 archivos) ──────────────────────────────
//
// `expBtnClass` en vez de una constante fija porque el botón real combina
// variante + tamaño (p. ej. "ghost small", "primary large") y algunos
// llamadores deciden la variante en runtime (confirmar borrado vs. avisar).

// Sin `bg-transparent`/`border-transparent` aquí a propósito: Tailwind v4
// emite las utilidades en el orden en que las descubre al escanear (no en
// un orden fijo), así que una utilidad NUCLEO como `bg-transparent` puede
// terminar generada DESPUES de una utilidad de nuestro tema (`bg-exp-brand`)
// y ganarle la cascada aunque ambas tengan la misma especificidad — el botón
// "primary" salia con fondo transparente y texto blanco invisible. Cada
// variante ya declara su propio fondo/borde (ghost incluido), así que la
// base no necesita un valor por defecto que compita con ellos.
const EXP_BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-exp px-[18px] py-2.5 text-sm font-semibold no-underline " +
  "transition-[background,box-shadow,transform,border-color,color] duration-[120ms] ease-linear " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const EXP_BTN_VARIANT = {
  primary:
    "border border-exp-brand bg-exp-brand text-white shadow-[0_2px_6px_rgba(15,118,110,0.20)] " +
    "hover:not-disabled:bg-exp-brand-dark hover:not-disabled:shadow-[0_4px_12px_rgba(15,118,110,0.30)] hover:not-disabled:-translate-y-px " +
    "active:not-disabled:translate-y-0 active:not-disabled:shadow-[0_1px_3px_rgba(15,118,110,0.20)]",
  secondary:
    "border border-exp-line bg-exp-panel text-exp-ink " +
    "hover:not-disabled:border-exp-brand hover:not-disabled:bg-exp-line-soft hover:not-disabled:text-exp-brand",
  ghost: "border border-transparent bg-transparent text-exp-muted hover:not-disabled:bg-exp-line-soft hover:not-disabled:text-exp-ink",
  danger:
    "border border-[#fecaca] bg-exp-danger-soft text-exp-danger " +
    "hover:not-disabled:border-exp-danger hover:not-disabled:bg-exp-danger hover:not-disabled:text-white",
} as const;

const EXP_BTN_SIZE = {
  default: "",
  small: "px-3 py-1.5 text-xs",
  large: "px-6 py-3 text-[15px]",
} as const;

export function expBtnClass(
  variant: keyof typeof EXP_BTN_VARIANT,
  size: keyof typeof EXP_BTN_SIZE = "default",
): string {
  return cn(EXP_BTN_BASE, EXP_BTN_VARIANT[variant], EXP_BTN_SIZE[size]);
}
