import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, GraduationCap, Info, Scale, ShieldCheck } from "lucide-react";
import { AppearanceControl } from "../appearance-control";

// Piezas compartidas por las pantallas de acceso: entrar (/login), pedir acceso (/acceso) y elegir la contraseña propia
// (/cambiar-password). Van con Tailwind acotado al contenedor `.tw` (ver app/tailwind.css): sin Preflight global.
//
// OJO con los títulos: styles.css fija `h1`/`h2` SIN capa, y lo que no está en una capa le gana a las utilidades. Por eso
// los títulos llevan el modificador `!` (`text-2xl!`); sin él, el tamaño que se ve no es el que se escribe.

export const authInput =
  "block w-full min-h-11 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[16px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted/60 focus:border-brand focus:outline-none focus:shadow-focus disabled:cursor-not-allowed disabled:bg-surface sm:text-md";
export const authInputError = "border-danger focus:border-danger";
export const authLabel = "mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink";
export const authBoton =
  "inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[14px] font-semibold text-[var(--on-brand)] transition-[background,transform] duration-150 hover:bg-brand-dark focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60";
export const authBotonSecundario =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 text-md font-semibold text-ink transition-colors duration-150 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:shadow-focus";
export const authEnlace = "font-semibold text-brand underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:shadow-focus";
// styles.css también fija `p { margin-top: 0 }` sin capa: un `mt-*` sobre un <p> no se aplica. Los textos de ayuda y de
// error que necesitan separación van con `mt-*!` o en un <div>/<small>.
export const authTitulo = "m-0 mb-1.5 text-2xl! font-bold! leading-tight! tracking-tight text-ink";
export const authAyuda = "mt-1.5! text-sm text-muted";
export const authErrorCampo = "mt-1.5! flex items-start gap-1.5 text-sm text-danger";

const TONOS = {
  error: { caja: "border-danger/30 bg-danger-soft text-ink", icono: "text-danger", Icono: AlertTriangle },
  aviso: { caja: "border-warning/40 bg-warning-soft text-ink", icono: "text-warning", Icono: AlertTriangle },
  info: { caja: "border-brand/25 bg-brand-soft text-ink", icono: "text-brand", Icono: Info },
  exito: { caja: "border-success/30 bg-success-soft text-ink", icono: "text-success", Icono: CheckCircle2 },
} as const;

/** Mensaje destacado. `error` y `aviso` se anuncian a los lectores de pantalla en cuanto aparecen. */
export function AuthAlert({ tono = "info", titulo, children }: { tono?: keyof typeof TONOS; titulo?: string; children: ReactNode }) {
  const { caja, icono, Icono } = TONOS[tono];
  return (
    <div role={tono === "error" || tono === "aviso" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-[1.5] ${caja}`}>
      <Icono size={18} className={`mt-0.5 shrink-0 ${icono}`} aria-hidden />
      <div>
        {titulo ? <p className="m-0 mb-0.5 font-bold">{titulo}</p> : null}
        <div className="m-0">{children}</div>
      </div>
    </div>
  );
}

const PUNTOS = [
  { Icono: Scale, titulo: "Comprende con fuentes", texto: "Consulta las respuestas junto a los documentos que las sustentan." },
  { Icono: FileSearch, titulo: "Búsqueda en la norma", texto: "Ley 32069, su Reglamento, opiniones y resoluciones en un solo lugar." },
  { Icono: GraduationCap, titulo: "Prepara tu examen", texto: "Practica con explicación y fuentes. Disponibilidad según revisión del banco." },
] as const;

/**
 * Marco de las pantallas de acceso: a la izquierda, qué es ACE (solo en pantallas anchas); a la derecha, el formulario.
 * En el móvil queda una sola columna con la marca arriba.
 */
export function AuthLayout({ children, ancho = "max-w-[420px]" }: { children: ReactNode; ancho?: string }) {
  return (
    <main className="tw relative min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="absolute right-5 top-5 z-10"><AppearanceControl /></div>
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-teal-950 to-teal-800 p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-panel/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-[360px] rounded-full bg-panel/[0.05]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-panel/15 text-lg font-extrabold">A</span>
          <div className="leading-tight">
            <strong className="block text-lg">ACE IA Jurídica</strong>
            <span className="text-sm text-white/75">Contrataciones públicas · Perú</span>
          </div>
        </div>
        <div className="relative max-w-[460px]">
          <p className="m-0 text-[30px] font-bold leading-[1.15] tracking-tight">La norma de contrataciones, con su fuente a la vista.</p>
          <ul className="m-0 mt-8 flex list-none flex-col gap-5 p-0">
            {PUNTOS.map(({ Icono, titulo, texto }) => (
              <li key={titulo} className="flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel/12"><Icono size={18} aria-hidden /></span>
                <span className="text-md leading-snug"><strong className="block">{titulo}</strong><span className="text-white/75">{texto}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative m-0 flex items-start gap-2 text-sm text-white/75">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          Acceso con cuenta personal. Para proteger el sistema, se registra la actividad de las cuentas externas.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-20 sm:px-8">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-bold text-[var(--on-brand)]">A</span>
          <div className="leading-tight">
            <strong className="block text-md">ACE IA Jurídica</strong>
            <span className="text-sm text-muted">Contrataciones públicas · Perú</span>
          </div>
        </div>
        <div className={`w-full bg-panel rounded-2xl border border-line p-6 shadow-card sm:p-8 ${ancho}`}>{children}</div>
      </div>
    </main>
  );
}
