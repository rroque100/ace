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
 * La cabecera, el overlay y el panel exterior están en Tailwind. El panel se
 * elige con `variante`: `drawer` (detalle, ancho), `chat` (más estrecho) y
 * `modal` (tarjeta centrada). Antes se pasaba el nombre de la clase CSS
 * (`clasePanel`/`modificador`); se cambió a este enum al retirar
 * expedientes-archivo.css. Cada variante es autónoma (ninguna comparte dos
 * utilidades del mismo tipo), así que el orden en que Tailwind las genera no
 * altera la cascada. Las animaciones (animate-exp-*) viven en app/workspace.css.
 */
const EXP_PANEL_BASE = "flex flex-col bg-exp-panel shadow-[-16px_0_48px_rgba(15,23,42,0.2)]";
// El modal se centra con `inset-0 m-auto` (y no con transform, que ya lo gasta
// la animación expPopIn); drawer y chat se anclan a la derecha, a pantalla
// completa en móvil, igual que hacían las reglas .expSlideOver/.expChatPanel.
const EXP_PANEL_VARIANTE = {
  drawer: "fixed right-0 top-0 z-[101] h-screen w-[min(720px,92vw)] animate-exp-slide-in-right max-[768px]:w-screen",
  chat: "fixed right-0 top-0 z-[101] h-screen w-[min(420px,92vw)] animate-exp-slide-in-right max-[768px]:w-screen",
  modal: "fixed inset-0 z-[101] m-auto h-auto max-h-[86vh] w-[min(560px,92vw)] self-center rounded-exp-lg animate-exp-pop-in",
} as const;

export function ExpSlideOver({
  titulo,
  subtitulo,
  onClose,
  children,
  /** `drawer` (por defecto), `chat` (más estrecho) o `modal` (centrado). */
  variante = "drawer",
  etiquetaCerrar = "Cerrar",
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  variante?: keyof typeof EXP_PANEL_VARIANTE;
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
          className={cn("tw", EXP_PANEL_BASE, EXP_PANEL_VARIANTE[variante])}
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
