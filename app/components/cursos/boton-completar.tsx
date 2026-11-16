"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/app/components/ui/button";

// Marca la clase como completada. Optimista: cambia al instante y, si el servidor falla, vuelve atrás y explica por
// qué. Al confirmar, refresca la página del servidor para que el temario y la barra de avance cuenten la clase.
export function BotonCompletar({
  curso,
  clase,
  completadaInicial,
  disponible,
}: {
  curso: string;
  clase: string;
  completadaInicial: boolean;
  disponible: boolean;
}) {
  const router = useRouter();
  const [completada, setCompletada] = useState(completadaInicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function alternar() {
    const nuevo = !completada;
    setCompletada(nuevo);
    setGuardando(true);
    setError("");
    try {
      const r = await fetch("/api/cursos/progreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curso, clase, completada: nuevo }),
      });
      if (!r.ok) {
        const x = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(x?.error ?? "No se pudo guardar tu avance.");
      }
      router.refresh();
    } catch (e) {
      setCompletada(!nuevo);
      setError((e as Error).message || "No se pudo guardar tu avance. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={completada ? "subtle" : "primary"}
        onClick={() => void alternar()}
        loading={guardando}
        disabled={!disponible}
        aria-pressed={completada}
        title={disponible ? undefined : "El guardado del avance aún no está activado."}
      >
        {!guardando && (completada ? <CheckCircle2 size={18} aria-hidden /> : <Circle size={18} aria-hidden />)}
        {completada ? "Clase completada" : "Marcar como completada"}
      </Button>
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
