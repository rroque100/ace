import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Info, Sparkles } from "lucide-react";
import { fechaFin, textoDias, type EstadoCuentaExterna } from "@/lib/cuenta-externa-estado";

// Avisos de la cuenta externa, arriba de cada pantalla: la persona se entera ANTES de toparse con un error. Solo aparecen
// cuando hay algo que decir (cuota por agotarse o agotada, acceso por terminar); si todo está en orden no ocupan espacio.
// Tailwind acotado a `.tw`.

const TONOS = {
  critico: "border-danger/30 bg-danger-soft",
  aviso: "border-warning/40 bg-warning-soft",
  info: "border-brand/25 bg-brand-soft",
} as const;

function Aviso({ tono, icono, titulo, children }: { tono: keyof typeof TONOS; icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div role={tono === "critico" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-[1.5] text-ink ${TONOS[tono]}`}>
      <span className="mt-0.5 shrink-0" aria-hidden>{icono}</span>
      <p className="m-0">
        <strong className="font-bold">{titulo}</strong> <span className="text-ink/80">{children}</span>
      </p>
    </div>
  );
}

export function AvisosExterno({ estado }: { estado: EstadoCuentaExterna }) {
  const avisos: ReactNode[] = [];
  const { nivelIA, nivelVigencia, cuota, porcentajeIA, vigenteHasta, diasRestantes } = estado;

  if (nivelIA === "agotado") {
    avisos.push(
      cuota === 0 ? (
        <Aviso key="ia" tono="info" icono={<Info size={18} className="text-brand" />} titulo="Tu cuenta no incluye preguntas con IA.">
          Puedes buscar y leer las normas; para usar el chat, pide al administrador que habilite tu cuota.
        </Aviso>
      ) : (
        <Aviso key="ia" tono="critico" icono={<AlertTriangle size={18} className="text-danger" />} titulo="Agotaste tu cuota de IA de este mes.">
          Ya no puedes hacer preguntas al chat, pero sigues pudiendo leer tu historial y buscar en las normas. La cuota se renueva el primer día del mes.
        </Aviso>
      ),
    );
  } else if (nivelIA === "alto") {
    avisos.push(
      <Aviso key="ia" tono="aviso" icono={<Sparkles size={18} className="text-warning" />} titulo={`Llevas usado el ${porcentajeIA} % de tu cuota de IA.`}>
        Procura preguntas concretas: cada consulta gasta parte de lo que te queda este mes.
      </Aviso>,
    );
  }

  if (nivelVigencia === "por_vencer" && vigenteHasta !== null) {
    avisos.push(
      <Aviso key="vigencia" tono="aviso" icono={<CalendarClock size={18} className="text-warning" />} titulo={`Tu acceso termina ${textoDias(diasRestantes ?? 0)} (${fechaFin(vigenteHasta)}).`}>
        Si lo necesitas después, pide la renovación al administrador antes de que venza.
      </Aviso>,
    );
  }

  if (!avisos.length) return null;
  return <div className="tw mb-4 flex flex-col gap-2.5" aria-label="Avisos de tu cuenta">{avisos}</div>;
}
