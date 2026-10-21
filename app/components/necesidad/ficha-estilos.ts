/**
 * Clases compartidas de los controles de la ficha de necesidad.
 *
 * Viven aquí y no en `necesidad-detail.tsx` porque los paneles extraídos las
 * necesitan y el detalle importa esos paneles: dejarlas en el detalle haría el
 * import circular. Es un módulo de constantes, sin React, así que no arrastra
 * nada al que solo quiere una clase.
 */

/** Control base. `FICHA_CTRL_ERR` se añade encima cuando el campo tiene error. */
export const FICHA_CTRL =
  "w-full rounded-[10px] border border-line bg-panel px-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted/55 " +
  "focus:border-brand focus:shadow-[var(--shadow-focus)] disabled:bg-surface disabled:opacity-70";

export const FICHA_CTRL_H = "h-10";

// El alto lo fija `rows` con filasTextarea, que cuenta cuanto envuelve cada
// linea. Se probo `field-sizing:content` —que en teoria ajusta al contenido sin
// estimar— y MEDIDO en Chrome daba 40px y cortaba el texto, mientras que las
// filas calculadas daban 349px sin cortar. Descartado por eso, no por gusto.
export const FICHA_CTRL_AREA = "min-h-[80px] resize-y py-2.5 leading-relaxed";

export const FICHA_CTRL_ERR =
  "!border-danger focus:!border-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_20%,transparent)]";
export const FICHA_LABEL =
  "mb-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink";
export const FICHA_REQ =
  "rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand";
export const FICHA_OPT =
  "rounded-full bg-ink/[0.06] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-muted";
export const FICHA_IA =
  "inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-bold text-accent";
