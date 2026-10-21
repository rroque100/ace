"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertCircle } from "lucide-react";

type Tone = "danger" | "warning" | "info";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmación modal reutilizable. Sustituye a `window.confirm`.
 *
 * Construida sobre la primitiva `AlertDialog` de Radix, que es la correcta para
 * esto: a diferencia de un diálogo normal, exige una respuesta y NO se cierra al
 * pulsar fuera —en una confirmación destructiva, un clic perdido no puede valer
 * como respuesta—. Radix aporta además lo que aquí estaba escrito a mano y a
 * medias: atrapa el foco (antes el tabulador se escapaba a la página de detrás),
 * lo devuelve al cerrar, bloquea el scroll y genera IDs únicos para el título y
 * el mensaje.
 *
 * Ese último punto era un fallo real: los IDs estaban fijos, y la pestaña de
 * Usuarios monta DOS de estos a la vez (borrar y restablecer contraseña), así
 * que el documento acababa con `id="confirm-dialog-title"` duplicado y un lector
 * de pantalla podía anunciar el diálogo equivocado.
 *
 * La API se mantiene igual que la de la versión anterior: los ~20 sitios que la
 * usan no cambian.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  tone = "warning",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      // Cubre a la vez Escape y el botón de cancelar de Radix.
      onOpenChange={(abierto) => {
        if (!abierto) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirmOverlay" />
        <AlertDialog.Content className="confirmDialog" data-tono={tone}>
          <div className="confirmDialogHead">
            <AlertCircle aria-hidden size={20} />
            <div>
              <AlertDialog.Title className="confirmDialogTitulo">{title}</AlertDialog.Title>
              <AlertDialog.Description className="confirmDialogMensaje">
                {message}
              </AlertDialog.Description>
            </div>
          </div>

          <div className="confirmDialogPie">
            {/* El foco entra en Cancelar: ante una acción destructiva, la tecla
                Intro por inercia no debe ejecutarla. */}
            <AlertDialog.Cancel asChild>
              <button className="secondaryButton" type="button">
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className="confirmDialogAccion" onClick={onConfirm} type="button">
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
