"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Envoltura común de los modales de la aplicación, sobre la primitiva `Dialog`
 * de Radix.
 *
 * Seis vistas previa (Anexo 1, Anexo 2, certificación, estrategia, evaluadores,
 * informe de aprobación) repetían la MISMA estructura —overlay, tarjeta,
 * cabecera con aspa, cuerpo y pie de acciones— y cada una traía su propio
 * `useEffect` para cerrar con Escape. Ninguna atrapaba el foco: con el tabulador
 * se salía a la página de detrás, que seguía ahí debajo del overlay.
 *
 * Radix aporta lo que faltaba: foco atrapado y devuelto al cerrar, Escape,
 * bloqueo del scroll y un `aria-labelledby` con id único (antes cada modal
 * inventaba el suyo a mano, con el riesgo de repetirlo).
 *
 * Las clases son las mismas de siempre (`modalOverlay`, `modalCard`…), así que
 * el aspecto no cambia: esto es una migración de comportamiento, no de estilo.
 */
export function ModalShell({
  titulo,
  onClose,
  children,
  acciones,
  /** Clase extra de la tarjeta, para los anchos propios de cada vista previa. */
  claseTarjeta,
}: {
  titulo: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  acciones?: React.ReactNode;
  claseTarjeta?: string;
}) {
  return (
    // Estos modales solo se montan cuando toca mostrarlos, así que están
    // abiertos por definición; cerrarlos es desmontarlos (onClose).
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        {/* El contenido de Radix se monta en un portal FUERA del `.tw` de la
            página, así que la clase `tw` va aquí: sin ella el reset (box-sizing,
            estilos de borde/botón) no aplicaría a las utilidades. */}
        <Dialog.Overlay className="tw fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)] backdrop-blur-[3px]" />
        <Dialog.Content
          className={`tw fixed left-1/2 top-1/2 z-[101] flex max-h-[88vh] w-[min(860px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-line bg-panel shadow-[0_16px_48px_rgba(15,23,42,0.24)]${claseTarjeta ? ` ${claseTarjeta}` : ""}`}
        >
          <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5 [&>h3]:m-0 [&>h3]:!text-[15px]">
            <Dialog.Title asChild>
              <h3>{titulo}</h3>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Cerrar" className="flex cursor-pointer p-1 text-muted hover:text-ink" type="button">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* `modalBody`: gancho para que las vistas previa de hoja (que fijan una
              altura casi completa) hagan crecer el cuerpo y empujen los botones al
              borde inferior. En el resto de modales no hace nada (sin regla). */}
          <div className="modalBody overflow-y-auto p-[18px] [&_section+section]:mt-[18px] [&_h4]:m-0 [&_h4]:mb-2 [&_h4]:text-[12px] [&_h4]:uppercase [&_h4]:tracking-[0.04em] [&_h4]:text-muted">
            {children}
          </div>

          {acciones ? <div className="flex gap-2 border-t border-line px-[18px] py-3">{acciones}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
