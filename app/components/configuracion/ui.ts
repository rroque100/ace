// Primitivos visuales del módulo Configuración.
//
// Antes cada pestaña definía SUS PROPIAS constantes de botones, inputs y badges,
// con small drift entre ellas: `min-h-[38px]` en un sitio y `min-h-[40px]` en el
// de al lado, `hover:text-brand-ink` (token que no existe, así que la utilidad
// no se generaba y el hover era mudo), `norm()` copiado en cuatro archivos…
//
// Centralizar aquí asegura que un ajuste de diseño se propaga a todas las
// pestañas a la vez y que los valores provengan del design system declarado en
// `app/tailwind.css` (tokens `bg-brand`, `border-line`, `text-ink`, radios…),
// no de hardcodes sueltos. Cualquier nueva pestaña debe importar de aquí en vez
// de volver a definir los suyos.

/** Minúsculas sin diacríticos — para buscar/filtrar sin importar tildes. */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ── Botones ──────────────────────────────────────────────────────────────────
// Tres alturas fijas para que la jerarquía sea consistente entre pestañas:
//   • primary   42 px  — acción principal de la vista (Guardar, Crear…)
//   • secondary 38 px  — acción corriente
//   • sm        34 px  — dentro de tablas, toolbars compactas o cabeceras
const btnBase =
  "inline-flex items-center justify-center gap-2 cursor-pointer transition-[background,border-color,color,box-shadow,transform] duration-150 ease";

export const btnPrimary = `${btnBase} min-h-[42px] rounded-lg border-0 bg-brand px-4 font-bold text-white hover:bg-brand-dark hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`;

export const btnSecondary = `${btnBase} min-h-[38px] rounded-lg border border-line bg-white px-3 text-sm text-ink font-[740] hover:border-[rgba(15,118,110,0.35)] hover:bg-brand-soft hover:text-brand-dark hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`;

export const btnSecondarySm = `${btnBase} min-h-[34px] rounded-lg border border-line bg-white px-2.5 text-sm text-ink font-[740] hover:border-[rgba(15,118,110,0.35)] hover:bg-brand-soft hover:text-brand-dark disabled:opacity-50 disabled:cursor-not-allowed`;

// ── Campos de formulario ─────────────────────────────────────────────────────
// El foco usa un anillo sutil (2 px, 12% marca) — más discreto que el
// `--shadow-focus` general (3 px, 22%) para no saturar en formularios densos.
const focusRing =
  "focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)] focus:outline-none";

export const inputBase = `w-full rounded-md border border-line bg-white px-2.5 py-2 text-base placeholder:text-muted/60 transition-[border-color,box-shadow] duration-150 ${focusRing}`;

export const inputSelect = `w-full rounded-md border border-line bg-white px-2.5 py-2 text-base transition-[border-color,box-shadow] duration-150 ${focusRing}`;

export const fieldLabel = "flex flex-col gap-1";

// ── Píldoras de estado ───────────────────────────────────────────────────────
// Activo/Inactivo aparecía duplicado en numeración y membrete con un color-mix
// ad-hoc sobre --accent. Se unifica a tokens del design system.
export function statusBadge(active: boolean): string {
  return active
    ? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-normal whitespace-nowrap bg-success-soft text-success"
    : "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-normal whitespace-nowrap bg-surface text-muted";
}
