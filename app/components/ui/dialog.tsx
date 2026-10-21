"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

/**
 * Diálogo (modal) sobre Radix. El contenido se porta al final del <body>, FUERA
 * de `.tw`, así que se le añade la clase `tw` para que el reset acotado y las
 * utilidades de Tailwind funcionen dentro del portal. Trae encabezado con título,
 * descripción opcional y botón de cierre; el cuerpo scrollea si desborda.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const widths = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[640px]",
  xl: "max-w-[820px]",
} as const;

export type DialogContentProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Banda superior (avisos de importación, contexto). */
  banner?: React.ReactNode;
  /** Pie fijo con acciones. Si se omite, el diálogo no muestra barra inferior. */
  footer?: React.ReactNode;
  size?: keyof typeof widths;
  children: React.ReactNode;
  className?: string;
};

export function DialogContent({
  title,
  description,
  banner,
  footer,
  size = "md",
  children,
  className,
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="tw fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] animate-overlay-in" />
      <DialogPrimitive.Content
        // Radix enlaza Content con Description por contexto: pone en Content un
        // `aria-describedby` que apunta al id de la Description. Cuando NO hay
        // descripcion, ese enlace apunta a un id inexistente y Radix avisa por
        // consola; lo suyo es pasar `aria-describedby={undefined}` para anularlo.
        //
        // Pero cuando SI la hay, ese mismo `undefined` PISA el enlace que Radix
        // acaba de poner, y la descripcion se ve en pantalla sin anunciarse. La
        // version anterior lo pasaba en los dos casos (`description ? undefined
        // : undefined`, las dos ramas iguales), asi que ningun dialogo con
        // descripcion la comunicaba. Por eso se pasa la propiedad solo en el
        // caso sin descripcion, en vez de calcular su valor.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "tw fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "overflow-hidden rounded-[16px] border border-line bg-panel shadow-pop animate-content-in",
          "outline-none",
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[17px] font-bold tracking-tight text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton size="sm" aria-label="Cerrar" className="-mr-1 -mt-1 shrink-0">
              <X className="size-4" />
            </IconButton>
          </DialogPrimitive.Close>
        </div>

        {banner ? <div className="px-5 pt-4">{banner}</div> : null}

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2.5 border-t border-line bg-surface px-5 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
