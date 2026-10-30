"use client";

import { useState } from "react";
import { Check, CheckCircle2, ChevronDown, Copy, Mail, ShieldAlert } from "lucide-react";
import { btnPrimary, btnSecondary } from "./ui";

// Lo que ve el administrador al crear una cuenta externa (a mano, aprobando una solicitud o restableciendo la contraseña).
// La contraseña temporal se muestra UNA vez: por eso va en un campo grande y legible, con su propio botón de copiar, y no
// dentro de un cuadro de texto que pueda recortarla. El mensaje completo para entregar queda desplegable.

type Props = {
  nombre: string | null;
  usuario: string;
  passwordTemporal: string;
  /** El texto listo para entregar (ver `mensajeBienvenida`). */
  mensaje: string;
  correo?: string | null;
  celular?: string | null;
  onCerrar: () => void;
};

/** Copia al portapapeles y devuelve true si se pudo (el navegador puede negarlo fuera de HTTPS o sin foco). */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function CampoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    if (!(await copiarTexto(valor))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-white">
        <code className="min-w-0 flex-1 select-all break-all px-3 py-2.5 font-mono text-md font-bold tracking-wide text-ink">{valor}</code>
        <button
          type="button"
          onClick={() => void copiar()}
          className={`grid w-11 shrink-0 place-items-center border-l border-line transition-colors focus-visible:outline-none focus-visible:shadow-focus ${copiado ? "bg-success-soft text-success" : "bg-surface text-muted hover:bg-brand-soft hover:text-brand-dark"}`}
          aria-label={copiado ? `${etiqueta} copiado` : `Copiar ${etiqueta.toLowerCase()}`}
          title={copiado ? "Copiado" : "Copiar"}
        >
          {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function CuentaCreadaCard({ nombre, usuario, passwordTemporal, mensaje, correo, celular, onCerrar }: Props) {
  const [mensajeCopiado, setMensajeCopiado] = useState(false);
  async function copiarMensaje() {
    if (!(await copiarTexto(mensaje))) return;
    setMensajeCopiado(true);
    setTimeout(() => setMensajeCopiado(false), 2500);
  }

  return (
    <section role="status" aria-label="Cuenta creada" className="overflow-hidden rounded-lg border border-success/40 bg-success-soft">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 size={20} aria-hidden /></span>
        <div className="min-w-0">
          <p className="m-0 text-base font-bold text-ink">Cuenta creada{nombre ? ` para ${nombre}` : ""}</p>
          <p className="m-0 mt-0.5! text-sm text-muted">Entrégale estos datos. Al entrar por primera vez deberá elegir su propia contraseña.</p>
        </div>
      </div>

      <div className="grid gap-3 px-4 pt-3.5 sm:grid-cols-2">
        <CampoCopiable etiqueta="Usuario (DNI)" valor={usuario} />
        <CampoCopiable etiqueta="Contraseña temporal" valor={passwordTemporal} />
      </div>

      <p className="mx-4 mb-0 mt-3! flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm leading-[1.45] text-ink">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        <span><strong>Se muestra solo ahora.</strong> No queda guardada en ninguna parte: si cierras esto sin copiarla, tendrás que restablecer la contraseña.</span>
      </p>

      <details className="group mx-4 mt-3 overflow-hidden rounded-md border border-line bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
          Ver el mensaje para entregar
          <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <pre className="m-0 whitespace-pre-wrap break-words border-t border-line bg-white p-3 font-sans text-sm leading-[1.6] text-ink">{mensaje}</pre>
      </details>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3.5">
        <button type="button" className={btnPrimary} onClick={() => void copiarMensaje()}>
          {mensajeCopiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {mensajeCopiado ? "Mensaje copiado" : "Copiar mensaje completo"}
        </button>
        {correo ? (
          <a className={btnSecondary} href={`mailto:${correo}?subject=${encodeURIComponent("Tu acceso a ACE IA Jurídica")}&body=${encodeURIComponent(mensaje)}`}>
            <Mail size={16} aria-hidden /> Escribir correo
          </a>
        ) : null}
        <button type="button" className={`${btnSecondary} sm:ml-auto`} onClick={onCerrar}>Ya lo entregué</button>
      </div>
      {correo || celular ? (
        <p className="m-0 border-t border-success/20 bg-white/50 px-4 py-2.5 text-sm text-muted">
          Contacto de la persona:{correo ? <> <strong className="font-semibold text-ink">{correo}</strong></> : null}{celular ? <> · <strong className="font-semibold text-ink">{celular}</strong></> : null}
        </p>
      ) : null}
    </section>
  );
}
