"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Envoltura común de los paneles deslizantes del archivo, sobre la primitiva
 * `Dialog` de Radix.
 *
 * Cuatro paneles —detalle del expediente, chat, mover en bloque y reemplazar
 * PDF— repetían la misma estructura: un overlay que cierra al hacer clic, un
 * panel que detiene la propagación y una cabecera con título, subtítulo y aspa.
 *
 * Ninguno atrapaba el foco ni cerraba con Escape: con el tabulador se salía a la
 * página de detrás, que seguía navegable bajo el overlay. Radix aporta eso, más
 * el bloqueo del scroll, la devolución del foco al cerrar y un `aria-labelledby`
 * con id único en lugar del `aria-label` escrito a mano.
 *
 * La cabecera y el overlay ya están en Tailwind. El panel exterior
 * (`clasePanel`/`modificador`) sigue en las clases CSS de siempre a propósito:
 * `expedientes-archivo-workspace.tsx` (el modal de ayuda, `?`) todavía no está
 * migrado y le sigue pasando `modificador="expSlideOver-modal"` como texto —
 * cambiar ese contrato aquí lo habría roto sin tocarlo.
 */
export function ExpSlideOver({
  titulo,
  subtitulo,
  onClose,
  children,
  /** Clase del panel: la variante ancha del chat usa la suya. */
  clasePanel = "expSlideOver",
  /** Modificador opcional, p. ej. `expSlideOver-modal` para la variante centrada. */
  modificador,
  etiquetaCerrar = "Cerrar",
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  clasePanel?: string;
  modificador?: string;
  etiquetaCerrar?: string;
}) {
  return (
    // Estos paneles solo se montan cuando toca mostrarlos, así que están
    // abiertos por definición; cerrarlos es desmontarlos (onClose).
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="tw fixed inset-0 z-[100] flex animate-exp-fade-in justify-end bg-[rgba(15,23,42,0.5)] backdrop-blur-[3px]" />
        <Dialog.Content
          className={cn("tw", clasePanel, "expSlideOverPortal", modificador)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-exp-line bg-exp-panel px-5 py-[18px]">
            <div>
              <Dialog.Title asChild>
                <h3 className="m-0 text-base font-bold text-exp-ink">{titulo}</h3>
              </Dialog.Title>
              {subtitulo ? <p className="mt-0.5 text-xs text-exp-muted">{subtitulo}</p> : null}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label={etiquetaCerrar}
                className="inline-flex size-8 items-center justify-center rounded-lg text-exp-muted transition-colors duration-[120ms] ease-linear hover:bg-exp-line-soft hover:text-exp-ink"
                type="button"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
