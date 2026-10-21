"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

/**
 * Globo de ayuda (el «?» que abre la base legal de un campo).
 *
 * Sustituye a una versión hecha a mano que tenía cuatro fallos, todos reales:
 *
 *   1. El disparador era un `<span role="button" tabIndex={0}>`. Se podía enfocar
 *      con el tabulador, pero NO se abría: Enter y Espacio no disparan `onClick`
 *      en un span. Para quien no usa ratón, la ayuda era inalcanzable.
 *   2. No cerraba con Escape.
 *   3. El globo iba en `absolute left-0 top-6 w-64`, sin detectar colisiones: en
 *      los campos del borde derecho o del final del formulario se salía de la
 *      pantalla.
 *   4. Sin `aria-expanded` ni relación con el contenido: un lector de pantalla
 *      anunciaba «Base legal, botón» y nada más, aunque el globo estuviera
 *      abierto.
 *
 * Radix resuelve los cuatro: el disparador es un `<button>` de verdad, cierra con
 * Escape y al pulsar fuera, se reposiciona solo cuando no cabe, y el estado va en
 * el ARIA. El contenido se porta al final del <body> —fuera de `.tw`—, así que
 * lleva `tw` para que el reset acotado y las utilidades sigan aplicando.
 */
export function InfoPopover({
  children,
  etiqueta = "Ver la base legal",
  className,
}: {
  children: React.ReactNode;
  /** Lo que anuncia el lector de pantalla al llegar al «?». */
  etiqueta?: string;
  className?: string;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        aria-label={etiqueta}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full bg-ink/[0.08] text-[10px] font-bold text-muted",
          "outline-none transition-colors hover:bg-brand-soft hover:text-brand",
          "focus-visible:shadow-[var(--shadow-focus)] data-[state=open]:bg-brand-soft data-[state=open]:text-brand",
          className,
        )}
        type="button"
      >
        ?
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className={cn(
            "tw z-50 w-72 rounded-[10px] border border-line bg-panel p-2.5",
            "text-[11.5px] leading-[1.5] text-ink shadow-pop",
            "animate-fade-in whitespace-pre-line",
          )}
          collisionPadding={12}
          sideOffset={6}
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-panel" height={5} width={10} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
